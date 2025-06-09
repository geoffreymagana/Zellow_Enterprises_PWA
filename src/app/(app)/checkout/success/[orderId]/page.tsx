
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShoppingBag, Truck, Loader2, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
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
            const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
            setOrder(orderData);
            toast({
              title: "Order Placed Successfully!",
              description: `Your order #${orderData.id.substring(0, 8)}... is confirmed.`,
              variant: "default", 
              duration: 7000, // Increased duration for better visibility
            });
          } else {
            setError("Order not found. It might still be processing or the ID is incorrect.");
             toast({
              title: "Order Not Found",
              description: "Could not retrieve order details. Please check 'My Orders' or contact support.",
              variant: "destructive",
            });
          }
        } catch (err: any) {
          console.error("Error fetching order:", err);
          setError("Failed to load your order confirmation.");
          toast({
            title: "Error Loading Confirmation",
            description: "There was an issue loading your order confirmation.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    } else if (!orderId) {
        setError("No order ID provided. Cannot display confirmation.");
        setLoading(false);
        toast({
            title: "Missing Order ID",
            description: "Cannot display confirmation without an order ID.",
            variant: "destructive",
        });
    }
  }, [orderId, toast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <p className="text-lg text-muted-foreground">Confirming your order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-2xl font-headline font-semibold mb-2">Order Confirmation Issue</h1>
        <p className="text-muted-foreground mb-8">{error || "Could not load order details."}</p>
        <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => router.push('/products')} variant="default">
                <ShoppingBag className="mr-2 h-4 w-4" /> Continue Shopping
            </Button>
            <Button onClick={() => router.push('/orders')} variant="outline">
                View My Orders
            </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl text-center rounded-lg overflow-hidden">
        <CardContent className="p-6 sm:p-8 pt-8 sm:pt-10">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 mb-5">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-headline font-bold text-primary mb-2">
            Woohoo!
          </h2>
          <p className="text-lg font-semibold text-foreground mb-3">
            Your order has been placed
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Order ID: <strong className="text-foreground/80">{order.id.substring(0,12)}...</strong>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            Pull up a chair, sit back and relax as your order is on its way to you! An email confirmation {order.customerEmail ? `has been sent to ${order.customerEmail}` : 'will be sent shortly'}.
          </p>
          
          <div className="border-t border-border pt-6 space-y-3">
            <Button 
              onClick={() => router.push(`/track/order/${order.id}`)} 
              className="w-full"
              variant="default"
              size="lg"
            >
              <Truck className="mr-2 h-5 w-5" /> Track This Order
            </Button>
            <Button 
              onClick={() => router.push('/products')} 
              className="w-full" 
              variant="outline"
              size="lg"
            >
              <ShoppingBag className="mr-2 h-5 w-5" /> Continue Shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
