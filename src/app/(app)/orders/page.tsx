
"use client";

import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// Table components are no longer needed
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import type { Order, OrderStatus } from "@/types";
import { Eye, RefreshCw, FileText, Loader2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return format(timestamp.toDate(), 'PPp');
    }
    if (timestamp instanceof Date) {
      return format(timestamp, 'PPp');
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return format(date, 'PPp');
  };


const getOrderStatusBadgeVariant = (status: OrderStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusYellow';
    case 'processing': return 'statusAmber';
    case 'awaiting_assignment': return 'statusOrange';
    case 'assigned': return 'statusOrderAssigned';
    case 'out_for_delivery': return 'statusBlue';
    case 'shipped': return 'statusIndigo';
    case 'delivered': return 'statusGreen';
    case 'delivery_attempted': return 'statusPurple';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

export default function OrdersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  const fetchOrders = useCallback(() => {
    if (!user || !db) {
      setIsLoadingOrders(false);
      return () => {}; 
    }
    setIsLoadingOrders(true);
    const ordersQuery = query(
      collection(db, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ordersQuery, (querySnapshot) => {
      const fetchedOrders: Order[] = [];
      querySnapshot.forEach((doc) => {
        fetchedOrders.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetchedOrders);
      setIsLoadingOrders(false);
    }, (error) => {
      console.error("Error fetching orders: ", error);
      toast({ title: "Error", description: "Could not fetch your orders.", variant: "destructive" });
      setIsLoadingOrders(false);
    });

    return unsubscribe; 
  }, [user, toast]); 

  useEffect(() => {
    if (authLoading) return; 

    if (!user) {
        router.replace('/login');
        return;
    }
    if (role === 'Customer') {
      const unsubscribe = fetchOrders();
      return () => unsubscribe(); 
    } else if (role !== null) { 
        router.replace('/dashboard');
    }
  }, [user, role, authLoading, router, fetchOrders]);
  

  if (authLoading || (isLoadingOrders && role === 'Customer')) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading your orders...</p>
      </div>
    );
  }
   if (role !== 'Customer' && !authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Redirecting...</div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">My Orders</h1>
        <Button variant="outline" onClick={fetchOrders} disabled={isLoadingOrders}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`} /> Refresh Orders
        </Button>
      </div>
      
      {orders.length === 0 && !isLoadingOrders ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-semibold">You have no orders yet.</p>
            <p className="text-muted-foreground mt-2">Ready to find something special?</p>
            <div className="text-center mt-6">
              <Link href="/products" passHref>
                <Button>Start Shopping</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <Card key={order.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="font-headline text-lg">Order ID: {order.id.substring(0,8)}...</CardTitle>
                  <Badge variant={getOrderStatusBadgeVariant(order.status)} className="capitalize text-xs">{order.status.replace(/_/g," ")}</Badge>
                </div>
                <CardDescription>
                  Date: {formatDate(order.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm font-semibold">Total: {formatPrice(order.totalAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {order.items.length} item(s)
                </p>
              </CardContent>
              <CardFooter>
                <Link href={`/track/order/${order.id}`} passHref className="w-full">
                  <Button variant="outline" className="w-full">
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      {orders.length > 0 && !isLoadingOrders && (
        <p className="text-xs text-muted-foreground mt-4">Showing {orders.length} orders.</p>
      )}
    </div>
  );
}
