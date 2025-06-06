
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShoppingBag, Gift } from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { Loader2 } from 'lucide-react';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId && db) {
      const fetchOrder = async () => {
        setLoading(true);
        try {
          const orderDocRef = doc(db, 'orders', orderId);
          const orderDoc = await getDoc(orderDocRef);
          if (orderDoc.exists()) {
            setOrder({ id: orderDoc.id, ...orderDoc.data() } as Order);
          } else {
            setError("Order not found.");
          }
        } catch (err: any) {
          console.error("Error fetching order:", err);
          setError("Failed to load order details.");
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    } else if (!orderId) {
        setError("No order ID provided.");
        setLoading(false);
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem)-10rem)] text-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your order confirmation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem)-10rem)] text-center p-4">
        <CheckCircle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-2xl font-headline font-semibold mb-2">Error</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/products')} variant="outline">
          Continue Shopping
        </Button>
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem)-10rem)] text-center p-4">
         <p className="text-muted-foreground mb-6">Order details could not be loaded.</p>
        <Button onClick={() => router.push('/products')} variant="outline">
          Continue Shopping
        </Button>
      </div>
    );
  }


  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto bg-green-100 dark:bg-green-900 rounded-full p-3 w-fit mb-4">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-3xl font-headline">Order Confirmed!</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Thank you for your purchase, {order.customerName}!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p>Your order ID is: <strong className="text-primary">{order.id.substring(0,12)}...</strong></p>
          <p>An email confirmation with your order details has been sent to <strong className="text-primary">{order.customerEmail}</strong>.</p>
          
          {order.isGift && order.giftDetails?.notifyRecipient && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md text-blue-700 dark:text-blue-300 text-sm">
              <p className="flex items-center justify-center"><Gift className="h-4 w-4 mr-2"/> This is a gift for <strong>{order.giftDetails.recipientName}</strong>.</p>
              <p>
                They will be notified shortly
                {order.giftDetails.recipientCanViewAndTrack ? " with details to view and track their gift" : ""}
                {order.giftDetails.recipientContactValue ? ` via ${order.giftDetails.recipientContactMethod}` : " (if contact details were provided)"}.
              </p>
            </div>
          )}

          <div className="text-left border-t pt-4 mt-4">
            <h4 className="font-semibold mb-2">Order Summary:</h4>
            <p><strong>Total Amount:</strong> {formatPrice(order.totalAmount)}</p>
            <p><strong>Payment Method:</strong> <span className="capitalize">{order.paymentMethod?.replace(/_/g, ' ')}</span></p>
            <p><strong>Shipping to:</strong> {order.shippingAddress.addressLine1}, {order.shippingAddress.city}</p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/orders" passHref>
              <Button variant="outline" className="w-full sm:w-auto">View My Orders</Button>
            </Link>
            <Link href="/products" passHref>
              <Button className="w-full sm:w-auto"><ShoppingBag className="mr-2 h-4 w-4"/>Continue Shopping</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
