
"use client";

import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import type { Order, OrderStatus } from "@/types";
import { Eye, RefreshCw, FileText, Loader2, ShoppingCart } from "lucide-react"; // Added Loader2 and ShoppingCart
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react"; // Added useCallback
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'; // Added onSnapshot for real-time updates
import { db } from '@/lib/firebase'; // Ensure db is imported
import { useToast } from "@/hooks/use-toast"; // For error notifications
import { format } from 'date-fns'; // For date formatting

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    // Check if it's a Firestore Timestamp-like object with a toDate method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return format(timestamp.toDate(), 'PPp');
    }
    // Check if it's already a Date object
    if (timestamp instanceof Date) {
      return format(timestamp, 'PPp');
    }
    // Try to parse it (e.g., if it's a string or number)
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
      return () => {}; // Return an empty unsubscribe function if no user or db
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

    return unsubscribe; // Return the unsubscribe function for cleanup
  }, [user, toast]); // Removed db from dependencies as it's unlikely to change

  useEffect(() => {
    if (authLoading) return; 

    if (!user) {
        router.replace('/login');
        return;
    }
    // Only fetch orders if the user is a Customer
    if (role === 'Customer') {
      const unsubscribe = fetchOrders();
      return () => unsubscribe(); // Cleanup subscription on component unmount
    } else if (role !== null) { // If user has a role but not Customer, redirect to dashboard
        router.replace('/dashboard');
    }
    // If role is null (still loading role or an issue), do nothing yet
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
    // This state implies the user is logged in but not a customer,
    // and they somehow landed here. The useEffect should handle redirection.
    // Showing a loader or a message can be a fallback.
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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id.substring(0,8)}...</TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={getOrderStatusBadgeVariant(order.status)} className="capitalize">{order.status.replace(/_/g," ")}</Badge>
                    </TableCell>
                    <TableCell>{formatPrice(order.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/track/order/${order.id}`} passHref>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-1 sm:mr-2 h-4 w-4" /> View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter className="pt-4">
             <p className="text-xs text-muted-foreground">Showing {orders.length} orders.</p>
           </CardFooter>
        </Card>
      )}
    </div>
  );
}
