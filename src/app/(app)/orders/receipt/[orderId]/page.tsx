
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Printer, Download, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/common/Logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, 'PP');
};

export default function OrderReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return; // Wait until auth state is resolved

    if (!user) {
        // If user is not logged in after auth check, redirect.
        router.replace('/login');
        return;
    }

    if (!orderId || !db) {
      setError(orderId ? "Database service unavailable." : "No order ID provided.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);
      const orderDocRef = doc(db, 'orders', orderId);
      const docSnapshot = await getDoc(orderDocRef);

      if (docSnapshot.exists()) {
        const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order;
        // Security check: only the customer who owns the order or an admin can view it.
        if (user && (orderData.customerId === user.uid || user.role === 'Admin')) {
          setOrder(orderData);
          setError(null);
        } else {
          setError("You do not have permission to view this receipt.");
          setOrder(null);
        }
      } else {
        setError("Order not found.");
        setOrder(null);
      }
      setLoading(false);
    };
    
    fetchOrder();

  }, [orderId, user, authLoading, router]);

  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/orders')} variant="outline">
          Back to My Orders
        </Button>
      </div>
    );
  }
  
  if (!order) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-6">Order data could not be loaded.</p>
        <Button onClick={() => router.push('/orders')} variant="outline">Back to My Orders</Button>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 min-h-screen p-4 sm:p-8">
        <div className="max-w-3xl mx-auto bg-background p-6 sm:p-8 rounded-lg shadow-lg">
            <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <Logo iconSize={28} textSize="text-2xl"/>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">GTC Office Tower, 5th Floor, Westlands, Nairobi</p>
                </div>
                <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0">
                    <h1 className="text-2xl font-bold font-headline text-primary">RECEIPT</h1>
                    <p className="text-sm">Order #{order.id.substring(0,8)}...</p>
                    <p className="text-sm text-muted-foreground">Date: {formatDate(order.createdAt)}</p>
                </div>
            </header>
            
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                <div>
                    <h2 className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">Billed To</h2>
                    <div className="text-sm space-y-0.5">
                        <p className="font-medium">{order.shippingAddress.fullName}</p>
                        <p>{order.shippingAddress.addressLine1}</p>
                        <p>{order.shippingAddress.city}, {order.shippingAddress.county}</p>
                        <p>{order.customerEmail}</p>
                        <p>{order.shippingAddress.phone}</p>
                    </div>
                </div>
                <div className="sm:text-right">
                    <h2 className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">Payment Details</h2>
                     <div className="text-sm space-y-0.5">
                        <p>Method: <span className="capitalize font-medium">{order.paymentMethod?.replace(/_/g, " ")}</span></p>
                        <p>Status: <span className="font-medium text-green-600 capitalize">{order.paymentStatus}</span></p>
                        {order.transactionId && <p className="text-xs">Ref: {order.transactionId}</p>}
                    </div>
                </div>
            </section>
            
            <section className="mb-8">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-center">Qty</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map((item, index) => (
                             <TableRow key={index}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatPrice(item.price)}</TableCell>
                                <TableCell className="text-right">{formatPrice(item.price * item.quantity)}</TableCell>
                             </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </section>

            <section className="flex justify-end mb-8">
                <div className="w-full max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium">{formatPrice(order.subTotal)}</span>
                    </div>
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping:</span>
                        <span className="font-medium">{formatPrice(order.shippingCost)}</span>
                    </div>
                    <Separator />
                     <div className="flex justify-between text-lg font-bold">
                        <span>Grand Total:</span>
                        <span>{formatPrice(order.totalAmount)}</span>
                    </div>
                </div>
            </section>
            
            <Separator className="my-8"/>

            <footer className="text-center">
                <p className="text-lg font-semibold mb-2">Thank you for your business!</p>
                <p className="text-xs text-muted-foreground">If you have any questions, please contact support@zellowenterprises.com</p>
            </footer>

        </div>
        <div className="max-w-3xl mx-auto mt-6 flex justify-between items-center print:hidden">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4"/>
                Back
            </Button>
            <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4"/>
                Print Receipt
            </Button>
        </div>
    </div>
  );
}
