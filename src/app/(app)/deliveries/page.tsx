
"use client";

import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Order, OrderStatus } from "@/types";
import { MapPin, Navigation, CheckCircle, PackageSearch, UserPlus, Filter, Loader2, AlertTriangle, Edit, Truck, PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, Unsubscribe, Timestamp, arrayUnion } from 'firebase/firestore'; 
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { sendDeliveryConfirmation } from "@/ai/flows/send-delivery-confirmation-flow";

const getDeliveryStatusBadgeVariant = (status: OrderStatus): BadgeProps['variant'] => {
  // Delivery Status uses the same mapping as Order Status for these colors
  switch (status) {
    case 'pending': return 'statusYellow'; // Though 'pending' might not be a typical *delivery* status
    case 'processing': return 'statusAmber'; // Similarly, processing is pre-dispatch
    case 'awaiting_assignment': return 'statusAmber'; // User table specific
    case 'assigned': return 'statusLightBlue';
    case 'out_for_delivery': return 'statusBlue';
    case 'shipped': return 'statusIndigo'; // If 'shipped' is used for deliveries
    case 'delivered': return 'statusGreen';
    case 'delivery_attempted': return 'statusPurple';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

export default function DeliveriesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeliveries = useCallback(() => {
    if (!user || !db) {
      setIsLoading(false);
      return () => {}; // Return an empty unsubscribe function
    }

    setIsLoading(true);
    let q;
    if (role === 'Rider') {
      q = query(collection(db, 'orders'), 
                where('riderId', '==', user.uid), 
                where('status', 'in', ['assigned', 'out_for_delivery', 'delivery_attempted']));
    } else if (role === 'DispatchManager' || role === 'Admin') {
      // Dispatch manager might want to see a broader range of statuses
      q = query(collection(db, 'orders'), 
                where('status', 'in', ['assigned', 'out_for_delivery', 'delivered', 'delivery_attempted', 'cancelled', 'awaiting_assignment']));
    } else {
      setIsLoading(false);
      router.replace('/dashboard'); // Redirect if not an authorized role for this page
      return () => {};
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedDeliveries: Order[] = [];
      querySnapshot.forEach((doc) => {
        fetchedDeliveries.push({ id: doc.id, ...doc.data() } as Order);
      });
      // Sort by creation date, newest first, or by status
      fetchedDeliveries.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      setDeliveries(fetchedDeliveries);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching deliveries: ", error);
      toast({ title: "Error", description: "Could not fetch deliveries.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [user, role, router, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    // Redirect DispatchManager to the new Dispatch Center page
    if (role === 'DispatchManager') {
        router.replace('/admin/dispatch');
        return;
    }
    if (role !== 'Rider' && role !== 'Admin') { // Admin can view for oversight
        router.replace('/dashboard');
        return;
    }

    const unsubscribe = fetchDeliveries();
    return () => unsubscribe(); // Cleanup subscription on unmount

  }, [authLoading, user, role, router, fetchDeliveries]);

  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus, notes?: string) => {
    if (!db || !user) return;
    try {
      const orderRef = doc(db, 'orders', order.id);
      const newHistoryEntry = {
        status: newStatus,
        timestamp: Timestamp.now(), 
        notes: notes || `Status updated to ${newStatus} by ${role}`,
        actorId: user.uid,
      };
      
      const updatePayload: any = { 
        status: newStatus,
        updatedAt: serverTimestamp(),
        deliveryHistory: arrayUnion(newHistoryEntry)
      };

      if (newStatus === 'delivered') {
        updatePayload.actualDeliveryTime = serverTimestamp();
      }

      await updateDoc(orderRef, updatePayload);

      // Send customer notification via API
      try {
        await fetch('/api/push/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: order.customerId,
                title: "Your Order Has Been Updated!",
                body: `Your order #${order.id.substring(0,8)} is now: ${newStatus.replace(/_/g, ' ')}`,
                data: { url: `/track/order/${order.id}` }
            }),
        });
      } catch (notificationError) {
        console.error("Failed to send push notification:", notificationError);
        // Don't block main flow for this
      }
      
      // If delivered, send email confirmation flow
      if (newStatus === 'delivered') {
        try {
          await sendDeliveryConfirmation({ order });
          toast({ title: "Delivery & Email Confirmation Sent", description: "Customer has been notified via email." });
        } catch (emailError) {
          console.error("Failed to send delivery confirmation email:", emailError);
          toast({ title: "Delivery Confirmed (Email Failed)", description: "Order status updated, but email notification failed.", variant: "destructive" });
        }
      } else {
        toast({ title: "Status Updated", description: `Delivery ${order.id} marked as ${newStatus}.` });
      }

    } catch (error) {
      console.error("Error updating status: ", error);
      toast({ title: "Error", description: "Could not update delivery status.", variant: "destructive" });
    }
  };
  

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (role === 'DispatchManager') { // Should have been redirected, but as a fallback
    return <div className="p-4 text-center">Redirecting to Dispatch Center... If not redirected, please <Link href="/admin/dispatch" className="text-primary underline">click here</Link>.</div>;
  }

  if (role !== 'Rider' && role !== 'Admin') {
     return <div className="text-center py-10">Access denied. This page is for Riders. Admins can view for oversight.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Rider' ? "My Active Deliveries" : "All Deliveries (Admin View)"}
        </h1>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDeliveries} disabled={isLoading}><Filter className="mr-2 h-4 w-4" /> Refresh</Button>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : "No active deliveries found."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deliveries.map((delivery) => (
            <Card key={delivery.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-lg">Order ID: {delivery.id.substring(0,8)}...</CardTitle>
                    <Badge variant={getDeliveryStatusBadgeVariant(delivery.status)} className="capitalize">{delivery.status.replace(/_/g, ' ')}</Badge>
                </div>
                <CardDescription>
                  Customer: {delivery.customerName || delivery.customerId}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2">
                <p className="text-sm flex items-center"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /> {delivery.shippingAddress?.addressLine1}, {delivery.shippingAddress?.city}</p>
                {delivery.deliveryNotes && <p className="text-sm text-muted-foreground">Notes: {delivery.deliveryNotes}</p>}
                 {delivery.estimatedDeliveryTime && <p className="text-sm">ETA: {new Date(delivery.estimatedDeliveryTime.seconds * 1000).toLocaleString()}</p>}
                 {delivery.isBulkOrder && <Badge variant="outline" className="text-xs mt-2"><PackagePlus className="h-3 w-3 mr-1"/>Bulk Order</Badge>}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2 justify-end items-center">
                <Link href={`/rider/map?orderId=${delivery.id}`} passHref>
                  <Button variant="outline" size="sm"><Navigation className="mr-2 h-4 w-4" /> View on Map</Button>
                </Link>
                {role === 'Rider' && delivery.status === 'assigned' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(delivery, 'out_for_delivery')}>
                    <Truck className="mr-2 h-4 w-4" /> Start Delivery
                  </Button>
                )}
                {role === 'Rider' && delivery.status === 'out_for_delivery' && (
                  <>
                    <Button size="sm" onClick={() => handleUpdateStatus(delivery, 'delivered')}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Mark Delivered
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(delivery, 'delivery_attempted')}>
                      <AlertTriangle className="mr-2 h-4 w-4" /> Attempt Failed
                    </Button>
                  </>
                )}
                 {role === 'Admin' && ( // Admins can edit for correction
                    <Link href={`/admin/orders/edit/${delivery.id}`} passHref>
                        <Button variant="ghost" size="icon"><Edit className="h-4 w-4"/></Button>
                    </Link>
                 )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
