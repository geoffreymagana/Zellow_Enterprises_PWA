
// src/components/notifications/PushSubscriptionManager.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { User } from '@/types';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

async function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function PushSubscriptionManager() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isChanging, setIsChanging] = useState(false);

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    useEffect(() => {
        // This effect runs only once on mount to check initial subscription status from Firestore.
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.PushManager || !user || !db) {
            setIsLoading(false);
            return;
        }

        const checkSubscriptionInDb = async () => {
            setIsLoading(true);
            try {
                const subDocRef = doc(db, 'pushSubscriptions', user.uid);
                const docSnap = await getDoc(subDocRef);
                setIsSubscribed(docSnap.exists());
            } catch (error) {
                console.error("Error checking subscription in Firestore:", error);
                setIsSubscribed(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkSubscriptionInDb();
    }, [user]);

    const handleToggleSubscription = async () => {
        if (isChanging || !user) return;
        setIsChanging(true);

        if (isSubscribed) {
            // Unsubscribe logic
            try {
                const sw = await navigator.serviceWorker.ready;
                const subscription = await sw.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                }

                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error("Could not get auth token.");
                
                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                setIsSubscribed(false);
                toast({ title: "Unsubscribed", description: "You will no longer receive push notifications." });
            } catch (error) {
                console.error("Failed to unsubscribe:", error);
                toast({ title: "Unsubscribe Failed", variant: "destructive" });
            }
        } else {
            // Subscribe logic
            if (!VAPID_PUBLIC_KEY) {
                toast({ title: "Error", description: "Push notification key is not configured.", variant: "destructive" });
                setIsChanging(false);
                return;
            }
            if (!auth.currentUser) {
                toast({ title: "Error", description: "Authentication service not ready.", variant: "destructive" });
                setIsChanging(false);
                return;
            }
            
            try {
                const sw = await navigator.serviceWorker.ready;
                const applicationServerKey = await urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                const sub = await sw.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });

                const token = await auth.currentUser.getIdToken();
                if (!token) throw new Error("Could not get auth token.");

                await fetch('/api/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription: sub, token }),
                });

                setIsSubscribed(true);
                toast({ title: "Subscribed!", description: "You will now receive push notifications." });
            } catch (error: any) {
                console.error("Failed to subscribe:", error);
                if (Notification.permission === 'denied') {
                    toast({ title: "Permission Denied", description: "Please enable push notifications in your browser settings.", variant: "destructive" });
                } else {
                    toast({ title: "Subscription Failed", description: "Could not subscribe to notifications. Please try again.", variant: "destructive" });
                }
            }
        }
        setIsChanging(false);
    };

    if (isLoading) {
        return <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Checking notification status...</div>;
    }

    if (typeof window !== 'undefined' && (!('serviceWorker' in navigator) || !('PushManager' in window))) {
        return <p className="text-sm text-muted-foreground">Push notifications are not supported by this browser.</p>;
    }
    
    if (typeof window !== 'undefined' && Notification.permission === 'denied') {
        return <p className="text-sm text-destructive">You have blocked notifications. Please enable them in your browser settings to subscribe.</p>;
    }

    return (
        <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
                <label htmlFor="push-switch" className="text-sm font-medium">
                    Order Status Notifications
                </label>
                <p className="text-xs text-muted-foreground">
                    Receive push notifications for key order updates.
                </p>
            </div>
             <Switch
                id="push-switch"
                checked={isSubscribed}
                onCheckedChange={handleToggleSubscription}
                disabled={isChanging || !user}
                aria-label="Toggle push notifications"
            />
        </div>
    );
}
