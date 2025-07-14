// src/app/api/push/subscribe/route.ts
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { serviceAccount } from '@/lib/firebase-admin-config';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  initializeApp({
    credential: {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
    },
  });
}

const db = getFirestore();

export async function POST(request: Request) {
  const { subscription, token } = await request.json();

  if (!subscription || !token) {
    return NextResponse.json({ success: false, error: 'Missing subscription or token' }, { status: 400 });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Store subscription in Firestore
    const subscriptionRef = doc(db, 'pushSubscriptions', userId);
    await setDoc(subscriptionRef, {
      ...subscription,
      userId: userId,
      createdAt: serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ success: false, error: 'Authentication token expired' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
