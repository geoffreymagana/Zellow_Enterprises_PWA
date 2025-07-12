
"use client";

import type { User, UserRole, UserStatus } from '@/types';
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, // Added
  updateProfile 
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; 
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, writeBatch } from 'firebase/firestore'; // Added more imports
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface SignupData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  county: string;
  town: string;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>; // Added signup
  logout: () => Promise<void>;
  updateUserProfile: (newDisplayName: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
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
          const userData = userDoc.data() as User;
          
          if (userData?.disabled === true) {
            await firebaseSignOut(auth); 
            setUser(null); setRole(null); setLoading(false);
            toast({ title: "Account Disabled", description: "Your account has been disabled. Please contact support.", variant: "destructive", duration: 7000 });
            router.replace('/login'); 
            return;
          }

          if (userData?.status === 'pending') {
            setUser(null); setRole(null); setLoading(false);
            router.replace('/auth/pending');
            return;
          }

          if (userData?.status === 'rejected') {
            await firebaseSignOut(auth);
            setUser(null); setRole(null); setLoading(false);
            const reason = userData.rejectionReason || "No reason provided.";
            toast({ title: "Account Rejected", description: `Your account registration was rejected. Reason: ${reason}`, variant: "destructive", duration: 10000 });
            router.replace('/login');
            return;
          }

          const userRole = userData?.role as UserRole || null;
          const appUser: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: userRole,
            status: userData?.status || 'approved',
            disabled: userData?.disabled || false,
            firstName: userData?.firstName || null,
            lastName: userData?.lastName || null,
            createdAt: userData?.createdAt || null,
          };
          setUser(appUser);
          setRole(userRole);
        } else {
          // This case might happen if a user is created in Auth but not in Firestore.
          // For this app's logic, we should probably sign them out.
           await firebaseSignOut(auth);
           setUser(null); 
           setRole(null);
           console.warn(`User document for ${firebaseUser.uid} not found. User has been signed out.`);
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
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle the rest of the logic (fetching user doc, role, status checks, etc.)
      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      router.replace(redirectUrl);
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
    }
  };

  const signup = async (data: SignupData) => {
    if (!auth || !db) {
      toast({ title: "Signup Failed", description: "Firebase services not available.", variant: "destructive" });
      throw new Error("Firebase services not available.");
    }
    const { email, password, fullName, phone, county, town } = data;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      await updateProfile(firebaseUser, { displayName: fullName });

      const nameParts = fullName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      const batch = writeBatch(db);

      // 1. Create user document
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      batch.set(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: fullName,
        firstName,
        lastName,
        phone,
        county,
        town,
        role: 'Customer',
        status: 'pending',
        createdAt: serverTimestamp(),
        disabled: false,
      });

      // 2. Create approval request document
      const approvalRequestRef = doc(collection(db, 'approvalRequests'));
      batch.set(approvalRequestRef, {
        type: 'user_registration',
        status: 'pending',
        requestedBy: firebaseUser.uid,
        requestedByName: fullName,
        requestedByEmail: email,
        requestedAt: serverTimestamp(),
        details: {
          userId: firebaseUser.uid,
          userName: fullName,
          userEmail: email
        }
      });
      
      await batch.commit();
      
      toast({ title: "Registration Submitted", description: `Thank you, ${fullName}! Your account is pending admin approval.` });

    } catch (error: any) {
      console.error("Signup failed:", error);
      let errorMessage = "An unexpected error occurred. Please try again.";
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = "This email address is already in use. Please try a different email or login.";
          break;
        case 'auth/weak-password':
          errorMessage = "The password is too weak. Please choose a stronger password.";
          break;
        case 'auth/invalid-email':
          errorMessage = "The email address is not valid. Please enter a correct email.";
          break;
        default:
          errorMessage = error.message || "Failed to create account. Please try again.";
      }
      toast({ title: "Signup Failed", description: errorMessage, variant: "destructive" });
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
    <AuthContext.Provider value={{ user, role, loading, login, signup, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
