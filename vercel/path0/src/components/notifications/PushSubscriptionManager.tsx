// src/components/notifications/PushSubscriptionManager.tsx
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Info, Bell, BellOff, Settings } from 'lucide-react';
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
    const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
    const [showPermissionDialog, setShowPermissionDialog] = useState(false);
    
    const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    // Check if PWA notifications are supported
    const isSupported = useCallback(() => {
        return (
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        );
    }, []);

    // Get current permission state
    const checkPermissionState = useCallback(() => {
        if (!isSupported()) return 'denied';
        return Notification.permission;
    }, [isSupported]);

    // Check current subscription status
    const checkSubscriptionStatus = useCallback(async () => {
        if (!isSupported() || !user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        const permission = checkPermissionState();
        setPermissionState(permission);

        if (permission !== 'granted') {
            setIsSubscribed(false);
            setIsLoading(false);
            return;
        }

        try {
            // Check if service worker has an active subscription
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                // Check if subscription exists in Firestore
                const subDocRef = doc(db, 'pushSubscriptions', user.uid);
                const docSnap = await getDoc(subDocRef);
                setIsSubscribed(docSnap.exists());
            } else {
                setIsSubscribed(false);
            }
        } catch (error) {
            console.error("Error checking subscription:", error);
            setIsSubscribed(false);
        } finally {
            setIsLoading(false);
        }
    }, [user, isSupported, checkPermissionState]);

    useEffect(() => {
        checkSubscriptionStatus();
    }, [checkSubscriptionStatus]);

    // Test notification function
    const testNotification = useCallback(async () => {
        if (!isSupported() || Notification.permission !== 'granted') return;

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Show notification via service worker
            await registration.showNotification('Test Notification', {
                body: 'Your notifications are working correctly!',
                icon: '/icons/Zellow-icon-192.png',
                badge: '/icons/Zellow-icon-72.png',
                tag: 'test-notification',
            });

            toast({
                title: "Test Notification Sent",
                description: "Check if you received the notification",
                duration: 3000
            });
        } catch (error) {
            console.error("Test notification failed:", error);
            toast({
                title: "Test Failed",
                description: "Could not send test notification",
                variant: "destructive"
            });
        }
    }, [isSupported, toast]);

    // Request permission and subscribe
    const requestPermissionAndSubscribe = useCallback(async () => {
        if (!isSupported() || !user || !VAPID_PUBLIC_KEY) {
            return false;
        }

        try {
            // Always try to request permission first
            const permission = await Notification.requestPermission();
            setPermissionState(permission);
            
            if (permission !== 'granted') {
                setShowPermissionDialog(true);
                return false;
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;
            
            // Subscribe to push notifications
            const applicationServerKey = await urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication token not available.");

            // Save subscription to Firestore
            const subRef = doc(db, 'pushSubscriptions', user.uid);
            await setDoc(subRef, {
                ...JSON.parse(JSON.stringify(subscription)),
                userId: user.uid,
                createdAt: serverTimestamp(),
            });

            return true;
        } catch (error: any) {
            console.error("Permission/subscription error:", error);
            
            if (error.name === 'NotAllowedError' || permissionState === 'denied') {
                setShowPermissionDialog(true);
            } else {
                toast({
                    title: "Subscription Failed",
                    description: error.message || "Could not enable notifications",
                    variant: "destructive"
                });
            }
            return false;
        }
    }, [user, VAPID_PUBLIC_KEY, isSupported, toast, permissionState]);

    // Unsubscribe from notifications
    const unsubscribeFromNotifications = useCallback(async () => {
        if (!user) return false;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                await subscription.unsubscribe();
            }
            
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Authentication token not available.");

            // Remove from Firestore
            const subRef = doc(db, 'pushSubscriptions', user.uid);
            await deleteDoc(subRef);

            return true;
        } catch (error) {
            console.error("Unsubscribe error:", error);
            return false;
        }
    }, [user]);

    // Handle toggle change
    const handleToggleChange = async (checked: boolean) => {
        if (isChanging || !user) return;

        setIsChanging(true);
        try {
            if (checked) {
                const success = await requestPermissionAndSubscribe();
                if (success) {
                    setIsSubscribed(true);
                    toast({
                        title: "Notifications Enabled",
                        description: "You'll receive order status updates",
                        duration: 3000
                    });
                    setTimeout(testNotification, 2000);
                } else {
                     // If it failed, the UI should reflect the actual state, which is not subscribed.
                    setIsSubscribed(false);
                }
            } else {
                const success = await unsubscribeFromNotifications();
                if (success) {
                    setIsSubscribed(false);
                    toast({
                        title: "Notifications Disabled",
                        description: "You won't receive push notifications",
                        duration: 3000
                    });
                } else {
                    // If unsubscribe failed, revert the toggle visually
                    setIsSubscribed(true);
                }
            }
        } finally {
            setIsChanging(false);
            // Re-check state after any action to be sure
            checkSubscriptionStatus();
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Checking notification status...
            </div>
        );
    }

    if (!isSupported()) {
        return (
            <div className="flex items-center text-sm text-muted-foreground">
                <Info className="mr-2 h-4 w-4"/>
                Push notifications are not supported in this browser.
            </div>
        );
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <label htmlFor="notification-toggle" className="text-sm font-medium">
                            Order Status Notifications
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Receive push notifications for key order updates.
                        </p>
                    </div>
                    <Switch
                        id="notification-toggle"
                        checked={isSubscribed}
                        onCheckedChange={handleToggleChange}
                        disabled={isChanging || !user}
                    />
                </div>
                {isSubscribed && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={testNotification}
                        disabled={permissionState !== 'granted'}
                    >
                        <Bell className="h-4 w-4 mr-2"/>
                        Test Notification
                    </Button>
                )}

                {permissionState === 'denied' && (
                    <p className="text-xs text-destructive">✗ Notifications are blocked in browser settings.</p>
                )}
            </div>
            
            <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
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
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
