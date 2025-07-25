
// src/app/api/push/subscribe/route.ts
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getServiceAccount } from '@/lib/firebase-admin-config';

function initializeFirebaseAdmin(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }
  return initializeApp({
    credential: {
      projectId: getServiceAccount().project_id,
      clientEmail: getServiceAccount().client_email,
      privateKey: getServiceAccount().private_key,
    },
  });
}

export async function POST(request: Request) {
  const { subscription, token } = await request.json();

  if (!subscription || !token) {
    return NextResponse.json({ success: false, error: 'Missing subscription or token' }, { status: 400 });
  }

  try {
    initializeFirebaseAdmin();
    const db = getFirestore();
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
