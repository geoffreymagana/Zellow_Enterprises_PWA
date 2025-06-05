
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
          // User exists in Firebase Auth but not in Firestore (e.g., mid-creation or error)
          // Treat as effectively logged out for app purposes if Firestore doc is required.
          // Or, if admin created user, this state might be transient.
          // For now, if an admin is creating a user, this path might be hit when the *new user* is authed.
          // If the admin is already logged in, their session should ideally be restored.
          // This part needs careful handling based on app flow.
          // If the current FirebaseUser is the newly created one, it won't have a role yet unless handleCreateUser is very fast.
          // This could lead to the new user being temporarily treated as role:null.
          
          // If an admin is performing an action (like creating a user), their own auth state shouldn't be nullified here
          // unless they themselves are the firebaseUser and their doc is missing.
          // This primarily affects the *newly authenticated* user.
          if (auth.currentUser && auth.currentUser.uid === firebaseUser.uid) {
            // Only nullify if the *current* firebase auth user is the one missing the doc
             setUser(null); // Or a user object with role:null
             setRole(null);
          }
          console.warn(`User document for ${firebaseUser.uid} not found or role is missing. Current auth state might be affected.`);
        }
      } else { // firebaseUser is null (logged out)
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, toast]); // db object is stable, auth is stable.

  const login = async (email: string, pass: string) => {
    if (!auth) {
      toast({ title: "Login Failed", description: "Firebase Auth service not available.", variant: "destructive" });
      setLoading(false); 
      throw new Error("Firebase Auth service not available.");
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting user and role, including disabled check
      toast({ title: "Login Successful", description: "Welcome back!"});
    } catch (error: any)
{
      console.error("Login failed:", error);
      toast({ title: "Login Failed", description: error.message || "Invalid credentials", variant: "destructive" });
      setLoading(false); 
      throw error; 
    }
    // setLoading(false) will be handled by onAuthStateChanged
  };

  const logout = async () => {
    if (!auth) {
      toast({ title: "Logout Failed", description: "Firebase Auth service not available.", variant: "destructive" });
      setLoading(false); // Ensure loading is false if auth isn't available
      throw new Error("Firebase Auth service not available.");
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set user and role to null
      router.push('/login'); // Explicitly redirect
      toast({ title: "Logged Out", description: "You have been successfully logged out."});
    } catch (error: any) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: error.message || "An error occurred.", variant: "destructive" });
    } finally {
      // setLoading(false) will be handled by onAuthStateChanged
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
