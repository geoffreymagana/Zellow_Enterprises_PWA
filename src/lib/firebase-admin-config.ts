// src/lib/firebase-admin-config.ts

// This configuration is intended for server-side use only.
// It uses environment variables that should be set in your Vercel project settings
// and not exposed to the client-side.

let serviceAccountConfig: any;

export function getServiceAccount() {
  if (serviceAccountConfig) {
    return serviceAccountConfig;
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID is not set');
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error('FIREBASE_CLIENT_EMAIL is not set');
  }
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('FIREBASE_PRIVATE_KEY is not set');
  }

  serviceAccountConfig = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID, // This is often optional
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID, // Optional
    auth_uri: "https://accounts.google.com/o/oauth2/auth", // Standard value
    token_uri: "https://oauth2.googleapis.com/token", // Standard value
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs", // Standard value
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`, // Standard value
  };
  return serviceAccountConfig;
}
