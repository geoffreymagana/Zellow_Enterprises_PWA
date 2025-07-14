// src/components/notifications/PushSubscriptionManager.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BellOff, BellRing } from 'lucide-react';
import type { User } from '@/types'; // Import User type

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
    const [subscription, setSubscription] = useState<PushSubscription | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isChanging, setIsChanging] = useState(false);

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.PushManager) {
            setIsLoading(false);
            return;
        }

        navigator.serviceWorker.ready.then(reg => {
            reg.pushManager.getSubscription().then(sub => {
                if (sub) {
                    setIsSubscribed(true);
                    setSubscription(sub);
                }
                setIsLoading(false);
            });
        });
    }, []);

    const subscribe = useCallback(async (currentUser: User) => {
        if (!VAPID_PUBLIC_KEY) {
            toast({ title: "Error", description: "Push notification key is not configured.", variant: "destructive" });
            return;
        }

        const sw = await navigator.serviceWorker.ready;
        try {
            const applicationServerKey = await urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            const sub = await sw.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Could not get auth token.");

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub, token }),
            });

            setSubscription(sub);
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
    }, [VAPID_PUBLIC_KEY, toast]);

    const unsubscribe = useCallback(async (currentSubscription: PushSubscription) => {
        try {
            await currentSubscription.unsubscribe();
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Could not get auth token.");
            
            await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            setIsSubscribed(false);
            setSubscription(null);
            toast({ title: "Unsubscribed", description: "You will no longer receive push notifications." });
        } catch (error) {
            console.error("Failed to unsubscribe:", error);
            toast({ title: "Unsubscribe Failed", variant: "destructive" });
        }
    }, [toast]);

    const handleToggleSubscription = async () => {
        if (isChanging || !user) return;
        setIsChanging(true);

        if (isSubscribed && subscription) {
            await unsubscribe(subscription);
        } else {
            await subscribe(user);
        }
        setIsChanging(false);
    };

    if (isLoading) {
        return <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Checking notification status...</div>;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return <p className="text-sm text-muted-foreground">Push notifications are not supported by this browser.</p>;
    }
    
    if (Notification.permission === 'denied') {
        return <p className="text-sm text-destructive">You have blocked notifications. Please enable them in your browser settings to subscribe.</p>
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
