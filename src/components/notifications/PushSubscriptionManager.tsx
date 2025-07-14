// src/components/notifications/PushSubscriptionManager.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

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
    const [isPermissionDenied, setIsPermissionDenied] = useState(false);
    const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);

    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const checkSubscriptionStatus = useCallback(async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !window.PushManager || !user || !db) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setIsPermissionDenied(Notification.permission === 'denied');
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
    }, [user]);

    useEffect(() => {
        checkSubscriptionStatus();
    }, [checkSubscriptionStatus]);

    const handleToggleSubscription = async (checked: boolean) => {
        if (isChanging || !user) return;

        if (checked) { // User wants to subscribe
             if (Notification.permission === 'denied') {
                setIsPermissionDenied(true);
                setIsPermissionModalOpen(true);
                return;
            }
            setIsChanging(true);
            try {
                const sw = await navigator.serviceWorker.ready;
                if (!VAPID_PUBLIC_KEY) throw new Error("VAPID public key not configured.");
                
                const applicationServerKey = await urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                const subscription = await sw.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
                
                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error("Authentication token not available.");
                
                const subRef = doc(db, 'pushSubscriptions', user.uid);
                await setDoc(subRef, { ...JSON.parse(JSON.stringify(subscription)), userId: user.uid, createdAt: serverTimestamp() });
                
                setIsSubscribed(true);
                toast({ title: "Subscribed!", description: "You will now receive push notifications." });
            } catch (error: any) {
                console.error("Failed to subscribe:", error);
                if (error.name === 'NotAllowedError' || Notification.permission === 'denied') {
                    setIsPermissionDenied(true);
                    setIsPermissionModalOpen(true);
                } else {
                    toast({ title: "Subscription Failed", description: "Could not subscribe to notifications. Please try again.", variant: "destructive" });
                }
            } finally {
                setIsChanging(false);
            }
        } else { // User wants to unsubscribe
            setIsChanging(true);
            try {
                const sw = await navigator.serviceWorker.ready;
                const subscription = await sw.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                }

                const token = await auth.currentUser?.getIdToken();
                if (!token) throw new Error("Could not get auth token.");
                
                const subRef = doc(db, 'pushSubscriptions', user.uid);
                await deleteDoc(subRef);

                setIsSubscribed(false);
                toast({ title: "Unsubscribed", description: "You will no longer receive push notifications." });
            } catch (error) {
                console.error("Failed to unsubscribe:", error);
                toast({ title: "Unsubscribe Failed", variant: "destructive" });
            } finally {
                setIsChanging(false);
            }
        }
    };
    
    if (isLoading) {
        return <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Checking notification status...</div>;
    }

    if (typeof window !== 'undefined' && (!('serviceWorker' in navigator) || !('PushManager' in window))) {
        return <p className="text-sm text-muted-foreground">Push notifications are not supported by this browser.</p>;
    }

    return (
        <>
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

            <Dialog open={isPermissionModalOpen} onOpenChange={setIsPermissionModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary"/> Notifications Blocked</DialogTitle>
                        <DialogDescription>
                            To receive notifications, you need to allow them in your browser settings for this site.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-sm space-y-2 py-2">
                       <p><strong>Here's how to fix it:</strong></p>
                       <ol className="list-decimal list-inside space-y-1">
                          <li>Click the padlock icon (🔒) in your browser's address bar.</li>
                          <li>Find the "Notifications" setting.</li>
                          <li>Change the permission from "Blocked" to "Allowed".</li>
                          <li>You may need to reload the page for the change to take effect.</li>
                       </ol>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Got it</Button>
                        </DialogClose>
                        <Button onClick={() => { checkSubscriptionStatus(); setIsPermissionModalOpen(false); }}>
                            Re-check Permission
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
