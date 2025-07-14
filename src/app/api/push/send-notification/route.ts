
// src/app/api/push/send-notification/route.ts
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getServiceAccount } from '@/lib/firebase-admin-config';
import webPush, { PushSubscription } from 'web-push';

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

function initializeWebPush() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webPush.setVapidDetails(
            'mailto:support@zellow.com', // Replace with your contact email
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        return true;
    }
    console.warn("VAPID keys are not set. Push notifications will not be sent.");
    return false;
}

interface NotificationPayload {
  title: string;
  options: {
    body?: string;
    icon?: string;
    badge?: string;
    data?: any;
  };
}

// This is an internal function to be triggered by Firestore triggers or other server logic
// For demonstration, we'll create an API route. In production, secure this endpoint.
export async function sendPushNotification(userId: string, payload: NotificationPayload) {
    const isWebPushInitialized = initializeWebPush();
    if (!isWebPushInitialized) {
        console.log("Cannot send notification: VAPID keys not configured.");
        return;
    }
    
    initializeFirebaseAdmin();
    const db = getFirestore();

    try {
        const subscriptionDoc = await db.collection('pushSubscriptions').doc(userId).get();
        if (!subscriptionDoc.exists) {
            console.log(`No push subscription found for user ${userId}`);
            return;
        }

        const subscription = subscriptionDoc.data() as PushSubscription;
        await webPush.sendNotification(subscription, JSON.stringify(payload));
        console.log(`Push notification sent to user ${userId}`);
    } catch (error: any) {
        console.error(`Error sending push notification to user ${userId}:`, error);
        // If subscription is invalid (e.g., user unsubscribed or browser revoked permission), delete it
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Subscription for user ${userId} is invalid. Deleting.`);
            await db.collection('pushSubscriptions').doc(userId).delete();
        }
    }
}


// Example usage via an API route (for testing/demonstration)
// In a real app, you would call `sendPushNotification` from a server-side event handler
// (e.g., when an order status changes via a Firestore Function).
export async function POST(request: Request) {
    const { userId, title, body } = await request.json();
    if (!userId || !title || !body) {
        return NextResponse.json({ success: false, error: 'Missing userId, title, or body' }, { status: 400 });
    }

    const payload: NotificationPayload = {
        title: title,
        options: {
            body: body,
            icon: '/icons/Zellow-icon-192.png',
            badge: '/icons/Zellow-icon-72.png',
            data: { url: `/track/order/${userId}` } // Just an example, maybe link to an order
        }
    };
    
    await sendPushNotification(userId, payload);

    return NextResponse.json({ success: true, message: `Notification sent to ${userId}`});
}
