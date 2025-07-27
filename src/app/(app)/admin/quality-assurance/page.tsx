

"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, PackageSearch, RefreshCw, Eye, XCircle } from 'lucide-react';
import type { Order, OrderStatus, DeliveryHistoryEntry, Task } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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
  
  const [rejectionRequest, setRejectionRequest] = useState<Order | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);


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
    setIsSubmitting(true);
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
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleRejectOrder = async () => {
    if (!db || !user || !rejectionRequest || !rejectionReason.trim()) {
        toast({ title: "Reason Required", description: "Please provide a reason for rejection.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        // 1. Update the order status and history
        const orderRef = doc(db, 'orders', rejectionRequest.id);
        const historyEntry: DeliveryHistoryEntry = {
            status: 'processing',
            timestamp: serverTimestamp(),
            notes: `QA Rejected. Reason: ${rejectionReason}. Sent back to production.`,
            actorId: user.uid,
        };
        batch.update(orderRef, {
            status: 'processing', // Send it back to the processing stage
            deliveryHistory: arrayUnion(historyEntry),
            updatedAt: serverTimestamp(),
        });

        // 2. Find all related tasks and revert them to 'pending'
        const tasksQuery = query(collection(db, 'tasks'), where("orderId", "==", rejectionRequest.id));
        const tasksSnapshot = await getDocs(tasksQuery);
        tasksSnapshot.forEach(taskDoc => {
            batch.update(taskDoc.ref, {
                status: 'pending',
                serviceManagerNotes: `QA Rejected: ${rejectionReason}`,
                updatedAt: serverTimestamp(),
            });
        });

        await batch.commit();
        toast({ title: "QA Rejected", description: `Order ${rejectionRequest.id.substring(0,8)}... sent back for rework.` });
        setRejectionRequest(null);
        setRejectionReason("");

    } catch (e: any) {
        console.error("Error rejecting QA:", e);
        toast({ title: "Rejection Failed", description: "Could not update the order status.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
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
    <>
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
                             <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" onClick={() => setRejectionRequest(order)} disabled={isSubmitting}>
                                    <XCircle className="mr-2 h-4 w-4"/> Reject
                                </Button>
                            </AlertDialogTrigger>
                            <Button size="sm" onClick={() => handleApproveOrder(order)} disabled={isSubmitting}>
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
        <AlertDialog open={!!rejectionRequest} onOpenChange={(open) => !open && setRejectionRequest(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Reject QA for Order {rejectionRequest?.id.substring(0,8)}...?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will send the order and all its tasks back to production for rework. Please provide a clear reason for the rejection.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="py-2 space-y-2">
                    <Label htmlFor="rejection-reason" className="sr-only">Reason for Rejection</Label>
                    <Textarea 
                        id="rejection-reason" 
                        value={rejectionReason} 
                        onChange={(e) => setRejectionReason(e.target.value)} 
                        placeholder="e.g., Engraving is off-center, color does not match proof..." 
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRejectionRequest(null)} disabled={isSubmitting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRejectOrder} disabled={!rejectionReason.trim() || isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirm Rejection
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
