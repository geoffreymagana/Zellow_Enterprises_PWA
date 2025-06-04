"use client";

import type { User, UserRole } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Fetch user role from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        let userRole: UserRole = null; // Default to null
        
        if (userDoc.exists()) {
          userRole = userDoc.data()?.role as UserRole || null;
        } else {
          // Handle case where user document doesn't exist or role is missing
          // For now, assume 'Customer' or handle appropriately
          console.warn(`User document for ${firebaseUser.uid} not found or role is missing.`);
        }

        // For PWA, Admin role should not typically login. Redirect if Admin.
        if (userRole === 'Admin') {
          toast({ title: "Access Denied", description: "Admin role is for the dashboard.", variant: "destructive" });
          await firebaseSignOut(auth);
          setUser(null);
          setRole(null);
          router.push('/login');
          setLoading(false);
          return;
        }
        
        const appUser: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: userRole,
        };
        setUser(appUser);
        setRole(userRole);

      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, toast]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // Auth state change will handle setting user and role
      // Redirection will happen in page.tsx or (app)/layout.tsx
      toast({ title: "Login Successful", description: "Welcome back!"});
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({ title: "Login Failed", description: error.message || "Invalid credentials", variant: "destructive" });
      setLoading(false);
      throw error; // Re-throw to handle in form
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      router.push('/login');
      toast({ title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error: any) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
