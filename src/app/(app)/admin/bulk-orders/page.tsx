
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, PackagePlus, FileWarning, Eye, CheckCircle, XCircle } from 'lucide-react';
import type { BulkOrderRequest, BulkOrderStatus, Order, OrderItem, DeliveryHistoryEntry } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const getStatusBadgeVariant = (status: BulkOrderStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_review': return 'statusYellow';
    case 'approved': return 'statusGreen';
    case 'rejected': return 'statusRed';
    case 'fulfilled': return 'statusBlue';
    default: return 'outline';
  }
};

const formatDate = (timestamp: any) => timestamp?.toDate ? format(timestamp.toDate(), 'PPp') : 'N/A';

export default function AdminBulkOrdersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<BulkOrderRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingRequest, setViewingRequest] = useState<BulkOrderRequest | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !['Admin', 'FinanceManager', 'ServiceManager'].includes(role || '')) {
        router.replace('/dashboard');
      }
    }
  }, [user, role, authLoading, router]);

  const fetchRequests = useCallback(() => {
    if (!db) return;
    setIsLoading(true);
    const q = query(collection(db, 'bulkOrderRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BulkOrderRequest)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching bulk order requests:", error);
      toast({ title: "Error", description: "Could not load bulk order requests.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [toast]);

  useEffect(() => {
    const unsubscribe = fetchRequests();
    return () => unsubscribe();
  }, [fetchRequests]);

  const handleOpenActionModal = (request: BulkOrderRequest, type: 'approve' | 'reject') => {
    setViewingRequest(request);
    setActionType(type);
    setAdminNotes(request.adminNotes || "");
    setIsActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!user || !db || !viewingRequest || !actionType) return;
    if (actionType === 'reject' && !adminNotes.trim()) {
      toast({ title: "Reason Required", description: "Please provide notes for rejection.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const requestRef = doc(db, 'bulkOrderRequests', viewingRequest.id);
    const newStatus: BulkOrderStatus = actionType === 'approve' ? 'approved' : 'rejected';

    try {
      if (actionType === 'approve') {
        const productIds = viewingRequest.items.map(item => item.productId);
        if(productIds.length === 0) throw new Error("Request has no items.");
        
        const productsQuery = query(collection(db, 'products'), where('id', 'in', productIds));
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = new Map(productsSnapshot.docs.map(doc => [doc.id, doc.data()]));
        
        const batch = writeBatch(db);
        const newOrderRef = doc(collection(db, 'orders'));

        const orderItems: OrderItem[] = viewingRequest.items.map(item => {
          const product = productsData.get(item.productId);
          if (!product) throw new Error(`Product with ID ${item.productId} not found.`);
          return {
            productId: item.productId,
            name: product.name,
            price: product.price,
            quantity: item.quantity,
            imageUrl: product.imageUrl || null,
            customizations: null, // Bulk orders might not have customizations at this stage
          };
        });

        const subTotal = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        
        const newOrder: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
          customerId: viewingRequest.requesterId,
          customerName: viewingRequest.requesterName,
          customerEmail: viewingRequest.requesterEmail,
          customerPhone: viewingRequest.requesterPhone,
          items: orderItems,
          totalAmount: subTotal, // Assuming no shipping/tax yet for bulk order
          subTotal,
          shippingCost: 0,
          status: 'processing', // Start in processing
          paymentStatus: 'pending',
          isBulkOrder: true,
          bulkOrderRequestId: viewingRequest.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Defaulting other required fields
          shippingAddress: { // A placeholder or require this in the form
            fullName: viewingRequest.requesterName,
            addressLine1: viewingRequest.companyName || 'To be confirmed',
            city: 'N/A',
            county: 'N/A',
            phone: viewingRequest.requesterPhone,
            email: viewingRequest.requesterEmail,
          },
          deliveryHistory: [{ status: 'pending', timestamp: serverTimestamp(), notes: 'Bulk order request approved and created.' }],
        };
        batch.set(newOrderRef, newOrder);
        batch.update(requestRef, { status: newStatus, adminNotes, updatedAt: serverTimestamp(), convertedOrderId: newOrderRef.id });
        await batch.commit();

      } else { // Reject
        await updateDoc(requestRef, { status: newStatus, adminNotes, updatedAt: serverTimestamp() });
      }

      toast({ title: `Request ${actionType}d`, description: `The bulk order request has been ${actionType}d.` });
      setIsActionModalOpen(false);
      setViewingRequest(null);
    } catch (e: any) {
      console.error("Action failed:", e);
      toast({ title: "Action Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold flex items-center gap-2">
        <PackagePlus className="h-7 w-7 text-primary"/> Bulk Order Services
      </h1>
      <p className="text-muted-foreground">Review and manage large or corporate order requests.</p>

      <Card>
        <CardHeader><CardTitle>Pending Bulk Order Requests</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
          ) : requests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground"><FileWarning className="h-12 w-12 mx-auto mb-4"/>No pending requests.</div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <Card key={req.id} className="p-4 flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-grow">
                    <p className="font-semibold">{req.requesterName} ({req.companyName || 'N/A'})</p>
                    <p className="text-sm text-muted-foreground">{req.items.length} item types, totaling {req.items.reduce((acc, item) => acc + item.quantity, 0)} units</p>
                    <p className="text-xs text-muted-foreground">Requested on: {formatDate(req.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(req.status)}>{req.status.replace(/_/g, ' ')}</Badge>
                    <Button variant="outline" size="icon" onClick={() => setViewingRequest(req)}><Eye className="h-4 w-4"/></Button>
                    {req.status === 'pending_review' && (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => handleOpenActionModal(req, 'reject')}><XCircle className="mr-2 h-4 w-4"/>Reject</Button>
                        <Button size="sm" onClick={() => handleOpenActionModal(req, 'approve')}><CheckCircle className="mr-2 h-4 w-4"/>Approve</Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingRequest && !isActionModalOpen} onOpenChange={() => setViewingRequest(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Request Details</DialogTitle><DialogDescription>From: {viewingRequest?.requesterName}</DialogDescription></DialogHeader>
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <p><strong>Company:</strong> {viewingRequest?.companyName || "N/A"}</p>
            <p><strong>Desired Delivery:</strong> {formatDate(viewingRequest?.desiredDeliveryDate)}</p>
            <p><strong>Contact:</strong> {viewingRequest?.requesterEmail} / {viewingRequest?.requesterPhone}</p>
            <div>
              <h4 className="font-semibold mb-2">Requested Items:</h4>
              <ul className="space-y-2">
                {viewingRequest?.items.map((item, index) => (
                  <li key={index} className="p-2 border rounded-md text-sm">
                    <p><strong>{item.name}</strong> (Qty: {item.quantity})</p>
                    {item.notes && <p className="text-xs text-muted-foreground">Notes: {item.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
            {viewingRequest?.adminNotes && <div><h4 className="font-semibold">Admin Notes:</h4><p className="text-sm text-muted-foreground">{viewingRequest.adminNotes}</p></div>}
            {viewingRequest?.convertedOrderId && <div><h4 className="font-semibold">Converted Order ID:</h4><Link href={`/admin/orders/edit/${viewingRequest.convertedOrderId}`} className="text-sm text-primary underline">{viewingRequest.convertedOrderId}</Link></div>}
          </div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isActionModalOpen} onOpenChange={() => setIsActionModalOpen(false)}>
         <DialogContent>
          <DialogHeader><DialogTitle className="capitalize">{actionType} Request</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="admin-notes">Notes / Reason</Label>
            <Textarea id="admin-notes" value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Provide approval notes or reason for rejection..."/>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleConfirmAction} disabled={isSubmitting || (actionType === 'reject' && !adminNotes.trim())} variant={actionType === 'reject' ? 'destructive' : 'default'}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Confirm {actionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
