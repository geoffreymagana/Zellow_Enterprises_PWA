// src/app/api/push/unsubscribe/route.ts
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, doc, deleteDoc } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getServiceAccount } from '@/lib/firebase-admin-config';

if (!getApps().length) {
  initializeApp({
    credential: {
      projectId: getServiceAccount().project_id,
      clientEmail: getServiceAccount().client_email,
      privateKey: getServiceAccount().private_key,
    },
  });
}
const db = getFirestore();

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing token' }, { status: 400 });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptionRef = doc(db, 'pushSubscriptions', userId);
    await deleteDoc(subscriptionRef);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error removing push subscription:', error);
    if (error.code === 'auth/id-token-expired') {
        return NextResponse.json({ success: false, error: 'Authentication token expired' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
