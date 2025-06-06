
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, DeliveryHistoryEntry } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Package, ShoppingBag, Truck, CheckCircle, MapPin, Clock } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns'; // For formatting timestamps

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any, includeTime: boolean = true) => {
  if (!timestamp) return 'N/A';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return includeTime ? format(date, 'PPp') : format(date, 'PP');
};

export default function TrackOrderPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId || !db) {
      setError(orderId ? "Database service unavailable." : "No order ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const orderDocRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(orderDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order;
        
        // Check if this is a gift and if the recipient is allowed to view details
        if (orderData.isGift && orderData.giftDetails && !orderData.giftDetails.recipientCanViewAndTrack) {
          setOrder(null); // Clear order to show generic message
          setError("Access to detailed tracking for this gift is restricted by the sender.");
        } else {
          setOrder(orderData);
          setError(null);
        }
      } else {
        setError("Order not found.");
        setOrder(null);
      }
      setLoading(false);
    }, (err: any) => {
      console.error("Error fetching order for tracking:", err);
      setError("Failed to load order tracking details.");
      setOrder(null);
      setLoading(false);
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading order tracking information...</p>
      </div>
    );
  }

  if (error && !order) { // Show error only if order is also null (e.g. for restricted access)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Tracking Unavailable</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/')} variant="outline">
          Go to Homepage
        </Button>
      </div>
    );
  }
  
  if (!order) { // Fallback if order is null without a specific error message from above
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-6">Order details could not be loaded.</p>
        <Button onClick={() => router.push('/')} variant="outline">Go to Homepage</Button>
      </div>
    );
  }

  const currentStatusEntry = order.deliveryHistory && order.deliveryHistory.length > 0 
    ? order.deliveryHistory[order.deliveryHistory.length - 1] 
    : { status: order.status, timestamp: order.updatedAt || order.createdAt, notes: 'Order status updated.' };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          {order.status === 'delivered' ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
          ) : (
            <Truck className="h-16 w-16 text-primary mx-auto mb-3" />
          )}
          <CardTitle className="text-2xl font-headline">
            Order Tracking
          </CardTitle>
          <CardDescription>
            Order ID: <span className="font-semibold text-primary">{order.id.substring(0, 12)}...</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Current Status:</p>
            <p className="text-xl font-semibold capitalize">{currentStatusEntry.status.replace(/_/g, ' ')}</p>
            <p className="text-xs text-muted-foreground">As of: {formatDate(currentStatusEntry.timestamp)}</p>
            {currentStatusEntry.notes && <p className="text-xs text-muted-foreground mt-1">Note: {currentStatusEntry.notes}</p>}
          </div>

          {order.isGift && order.giftDetails && !order.giftDetails.showPricesToRecipient ? (
             <p className="text-sm text-center text-muted-foreground italic">This is a gift order. Price details are hidden.</p>
          ) : (
            <div>
                <h4 className="font-semibold mb-2">Order Summary:</h4>
                <ul className="space-y-1 text-sm">
                {order.items.map(item => (
                    <li key={item.productId} className="flex justify-between">
                    <span>{item.name} (x{item.quantity})</span>
                    {!order.isGift || order.giftDetails?.showPricesToRecipient ? <span>{formatPrice(item.price * item.quantity)}</span> : null}
                    </li>
                ))}
                <li className="flex justify-between border-t pt-1 mt-1">
                    <span>Shipping</span>
                    {!order.isGift || order.giftDetails?.showPricesToRecipient ? <span>{formatPrice(order.shippingCost)}</span> : null}
                </li>
                <li className="flex justify-between font-bold text-md border-t pt-1 mt-1">
                    <span>Total</span>
                    {!order.isGift || order.giftDetails?.showPricesToRecipient ? <span>{formatPrice(order.totalAmount)}</span> : null}
                </li>
                </ul>
            </div>
          )}


          {order.shippingAddress && (
            <div>
              <h4 className="font-semibold mb-1 flex items-center"><MapPin className="h-4 w-4 mr-2 text-primary"/>Shipping To:</h4>
              <p className="text-sm">{order.shippingAddress.fullName}</p>
              <p className="text-sm">{order.shippingAddress.addressLine1}, {order.shippingAddress.city}</p>
            </div>
          )}

          {order.estimatedDeliveryTime && order.status !== 'delivered' && (
            <div>
              <h4 className="font-semibold mb-1 flex items-center"><Clock className="h-4 w-4 mr-2 text-primary"/>Estimated Delivery:</h4>
              <p className="text-sm">{formatDate(order.estimatedDeliveryTime)}</p>
            </div>
          )}
          
          {order.deliveryHistory && order.deliveryHistory.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Delivery History:</h4>
              <ul className="space-y-2 text-xs">
                {order.deliveryHistory.slice().reverse().map((entry, index) => (
                  <li key={index} className="pb-2 border-b last:border-b-0">
                    <p className="font-medium capitalize">{entry.status.replace(/_/g, ' ')} - {formatDate(entry.timestamp)}</p>
                    {entry.notes && <p className="text-muted-foreground pl-2">- {entry.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link href="/products" passHref>
              <Button variant="outline"><ShoppingBag className="mr-2 h-4 w-4"/> Continue Shopping</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
