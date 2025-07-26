
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, PackageSearch, RefreshCw, Eye } from 'lucide-react';
import type { Order, OrderStatus, DeliveryHistoryEntry } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import Link from 'next/link';

const getOrderStatusBadgeVariant = (status: OrderStatus): BadgeProps['variant'] => {
    switch (status) {
      case 'awaiting_quality_check': return 'statusAmber';
      default: return 'outline';
    }
};

export default function QualityAssurancePage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrdersForQA = useCallback(() => {
    if (!db || !user || !['Quality Check', 'Admin'].includes(role || '')) {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    const q = query(
        collection(db, 'orders'),
        where("status", "==", "awaiting_quality_check"),
        orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching orders for QA:", error);
        toast({ title: "Error", description: "Could not load orders for quality check.", variant: "destructive" });
        setIsLoading(false);
    });
    return unsubscribe;
  }, [db, user, role, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['Quality Check', 'Admin'].includes(role || '')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchOrdersForQA();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchOrdersForQA]);

  const handleApproveOrder = async (order: Order) => {
    if (!db || !user) return;
    try {
        const orderRef = doc(db, 'orders', order.id);
        const newStatus: OrderStatus = 'awaiting_assignment';
        const historyEntry: DeliveryHistoryEntry = {
            status: newStatus,
            timestamp: serverTimestamp(),
            notes: `Quality check passed. Approved by ${user.displayName || user.email}. Order is now ready for dispatch.`,
            actorId: user.uid,
        };
        await updateDoc(orderRef, {
            status: newStatus,
            deliveryHistory: arrayUnion(historyEntry),
            updatedAt: serverTimestamp(),
        });
        toast({ title: "QA Approved", description: `Order ${order.id.substring(0,8)}... passed quality check.` });
    } catch (e: any) {
        console.error("Error approving QA:", e);
        toast({ title: "Approval Failed", description: "Could not update the order status.", variant: "destructive" });
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate ? format(timestamp.toDate(), 'PPp') : 'Invalid Date';
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2">
            <PackageSearch className="h-7 w-7 text-primary"/> Quality Assurance Dashboard
        </h1>
        <Button onClick={fetchOrdersForQA} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Review customized orders to ensure they meet quality standards before dispatch.</p>

      <Card>
        <CardHeader>
          <CardTitle>Orders Awaiting Quality Check</CardTitle>
          <CardDescription>These orders have completed the production phase and require your approval.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No orders are currently awaiting quality check.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {orders.map((order) => (
                <Card key={order.id} className="flex flex-col shadow-md">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <CardTitle className="text-base font-semibold">{order.id.substring(0,8)}...</CardTitle>
                            <Badge variant={getOrderStatusBadgeVariant(order.status)} className="capitalize">{order.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <CardDescription className="text-xs">Customer: {order.customerName}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-1 text-sm">
                        <p><strong>Items:</strong> {order.items.length}</p>
                        <p><strong>Last Update:</strong> {formatDate(order.updatedAt)}</p>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2 pt-3 border-t">
                        <Link href={`/admin/orders/edit/${order.id}`} passHref>
                           <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4"/> View Order</Button>
                        </Link>
                        <Button size="sm" onClick={() => handleApproveOrder(order)}>
                            <CheckCircle className="mr-2 h-4 w-4"/> Approve
                        </Button>
                    </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
