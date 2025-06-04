import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
// import { getFunctions, Functions } from "firebase/functions"; // Uncomment if needed
// import { getStorage, FirebaseStorage } from "firebase/storage"; // Uncomment if using Firebase Storage

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
// let functions: Functions; // Uncomment if needed
// let storage: FirebaseStorage; // Uncomment if needed

if (typeof window !== "undefined" && !getApps().length) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // functions = getFunctions(app); // Uncomment if needed
  // storage = getStorage(app); // Uncomment if needed
} else if (getApps().length > 0) {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  // functions = getFunctions(app); // Uncomment if needed
  // storage = getStorage(app); // Uncomment if needed
} else {
  // This case is for server-side rendering or environments where Firebase might not be initialized yet.
  // Handle gracefully or throw an error if Firebase services are accessed before initialization.
  // For this PWA, client-side initialization is primary.
}


// @ts-ignore
export { app, auth, db };
// export { app, auth, db, functions, storage }; // Uncomment if needed
