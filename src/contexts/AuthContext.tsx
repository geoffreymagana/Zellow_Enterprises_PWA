
"use client";

import type { User, UserRole } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; 
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (newDisplayName: string) => Promise<void>;
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
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData?.disabled === true) {
            await firebaseSignOut(auth); // Sign out the disabled user from Firebase Auth
            setUser(null);
            setRole(null);
            setLoading(false);
            toast({
              title: "Account Disabled",
              description: "Your account has been disabled. Please contact support.",
              variant: "destructive",
              duration: 7000,
            });
            router.replace('/login'); // Ensure redirect to login if disabled
            return;
          }

          const userRole = userData?.role as UserRole || null;
          const appUser: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: userRole,
            disabled: userData?.disabled || false,
            firstName: userData?.firstName || null,
            lastName: userData?.lastName || null,
            createdAt: userData?.createdAt || null,
          };
          setUser(appUser);
          setRole(userRole);
        } else {
          if (auth.currentUser && auth.currentUser.uid === firebaseUser.uid) {
             setUser(null); 
             setRole(null);
          }
          console.warn(`User document for ${firebaseUser.uid} not found or role is missing. Current auth state might be affected.`);
        }
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
      let errorMessage = "An unexpected error occurred. Please try again.";
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
          break;
        case 'auth/user-disabled':
          errorMessage = "This account has been disabled. Please contact support.";
          break;
        case 'auth/too-many-requests':
            errorMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
            break;
        default:
          errorMessage = error.message || "Failed to login. Please try again.";
      }
      toast({ title: "Login Failed", description: errorMessage, variant: "destructive" });
      setLoading(false); 
      // Do not re-throw common auth errors to prevent Next.js overlay for these cases.
      // If it's an unexpected error, you might still choose to throw it or handle differently.
      // For now, all login errors will just result in a toast.
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
      router.push('/login'); 
      toast({ title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error: any) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: error.message || "An error occurred.", variant: "destructive" });
    }
  };

  const updateUserProfile = async (newDisplayName: string) => {
    if (!auth || !auth.currentUser || !db) {
      toast({ title: "Update Failed", description: "User not authenticated or Firebase services unavailable.", variant: "destructive" });
      throw new Error("User not authenticated or Firebase services unavailable.");
    }
    setLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName: newDisplayName });
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, { displayName: newDisplayName });
      setUser(prevUser => prevUser ? { ...prevUser, displayName: newDisplayName } : null);
      toast({ title: "Profile Updated", description: "Your display name has been successfully updated." });
    } catch (error: any) {
      console.error("Profile update failed:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update profile.", variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, login, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

