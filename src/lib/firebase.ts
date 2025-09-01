
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAnalytics, Analytics } from "firebase/analytics"; // Added
// import { getFunctions, Functions } from "firebase/functions"; // Uncomment if needed
// import { getStorage, FirebaseStorage } from "firebase/storage"; // Uncomment if needed

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pathfinder-ai-eight.vercel.app',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Added
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let analytics: Analytics | undefined; // Added
// let functions: Functions; // Uncomment if needed
// let storage: FirebaseStorage; // Uncomment if needed

// Only attempt to initialize Firebase on the client side
// and if the necessary configuration (especially API key and Project ID) is present.
if (typeof window !== "undefined") {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) { // Ensure critical config is present
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    db = getFirestore(app);
    if (firebaseConfig.measurementId) { // Conditionally initialize analytics
        analytics = getAnalytics(app);
    }
    // functions = getFunctions(app); // Uncomment if needed
    // storage = getStorage(app); // Uncomment if needed
  } else {
    // Firebase services (app, auth, db) will remain undefined if config is missing.
    // AuthContext will handle notifying the user.
  }
}
// On the server side (when typeof window === "undefined"), app, auth, db will also be undefined.

export { app, auth, db, analytics }; // Added analytics
// export { app, auth, db, functions, storage }; // Uncomment if needed
