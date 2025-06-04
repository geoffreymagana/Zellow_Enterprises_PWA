
"use client";

import type { User, UserRole } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // auth and db can now be undefined
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
    if (!auth || !db) {
      toast({
        title: "Configuration Error",
        description: "Firebase services could not be initialized. Please check the setup.",
        variant: "destructive",
        duration: Infinity, 
      });
      setLoading(false);
      setUser(null);
      setRole(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        let userRole: UserRole = null; 
        
        if (userDoc.exists()) {
          userRole = userDoc.data()?.role as UserRole || null;
        } else {
          console.warn(`User document for ${firebaseUser.uid} not found or role is missing.`);
        }
        
        // Allow Admin to log in, but other roles might have specific PWA paths.
        // The previous check for 'Admin' to log them out has been removed.

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
    if (!auth) {
      toast({ title: "Login Failed", description: "Firebase Auth service not available.", variant: "destructive" });
      setLoading(false); 
      throw new Error("Firebase Auth service not available.");
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast({ title: "Login Successful", description: "Welcome back!"});
    } catch (error: any) {
      console.error("Login failed:", error);
      toast({ title: "Login Failed", description: error.message || "Invalid credentials", variant: "destructive" });
      setLoading(false); 
      throw error; 
    }
  };

  const logout = async () => {
    if (!auth) {
      toast({ title: "Logout Failed", description: "Firebase Auth service not available.", variant: "destructive" });
      setLoading(false);
      throw new Error("Firebase Auth service not available.");
    }
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
