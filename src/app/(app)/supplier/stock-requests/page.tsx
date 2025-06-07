
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, Filter, RefreshCw, Truck } from 'lucide-react';
import type { StockRequest, StockRequestStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot, Unsubscribe, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // For fulfilled quantity
import { Label } from '@/components/ui/label';


const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_finance_approval': return 'statusYellow';
    case 'pending_supplier_fulfillment': return 'statusAmber';
    case 'awaiting_receipt': return 'statusBlue'; // Changed from fulfilled to blue
    case 'received': return 'statusGreen'; // If suppliers ever see this
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance':
    case 'rejected_supplier':
    case 'cancelled': 
      return 'statusRed';
    default: return 'outline';
  }
};

export default function SupplierStockRequestsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [actionableRequest, setActionableRequest] = useState<StockRequest | null>(null);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [fulfilledQuantity, setFulfilledQuantity] = useState<number | string>("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [isSubmittingFulfillment, setIsSubmittingFulfillment] = useState(false);

  const fetchRequests = useCallback(() => {
    if (!db || !user || role !== 'Supplier') {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    const q = query(
        collection(db, 'stockRequests'), 
        where("status", "==", "pending_supplier_fulfillment"),
        // where("supplierId", "==", user.uid), // If direct assignment
        orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching stock requests for supplier:", error);
      toast({ title: "Error", description: "Could not load stock requests.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [db, user, role, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'Supplier') {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchRequests();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchRequests]);

  const handleOpenFulfillModal = (request: StockRequest) => {
    setActionableRequest(request);
    setFulfilledQuantity(request.requestedQuantity); 
    setSupplierNotes("");
    setIsFulfillModalOpen(true);
  };

  const handleConfirmFulfillment = async () => {
    if (!db || !user || !actionableRequest || fulfilledQuantity === "") return;
    
    const numFulfilledQuantity = Number(fulfilledQuantity);
    if (isNaN(numFulfilledQuantity) || numFulfilledQuantity <= 0) {
      toast({ title: "Invalid Quantity", description: "Fulfilled quantity must be a positive number.", variant: "destructive" });
      return;
    }
    if (numFulfilledQuantity > actionableRequest.requestedQuantity) {
      toast({ title: "Invalid Quantity", description: "Fulfilled quantity cannot exceed requested quantity.", variant: "destructive" });
      return;
    }

    setIsSubmittingFulfillment(true);
    try {
      const requestRef = doc(db, 'stockRequests', actionableRequest.id);
      await updateDoc(requestRef, {
        status: 'awaiting_receipt', // Changed status
        supplierId: user.uid, 
        supplierName: user.displayName || user.email,
        supplierActionTimestamp: serverTimestamp(),
        supplierNotes: supplierNotes || (numFulfilledQuantity < actionableRequest.requestedQuantity ? "Partially fulfilled." : "Fulfilled as requested."),
        fulfilledQuantity: numFulfilledQuantity,
        updatedAt: serverTimestamp(),
      });
      
      toast({ title: "Request Marked as Fulfilled", description: `Stock request for ${actionableRequest.productName} is now awaiting receipt by Inventory Manager.` });
      setIsFulfillModalOpen(false);
      setActionableRequest(null);
    } catch (e: any) {
      console.error("Error fulfilling request:", e);
      toast({ title: "Error", description: "Could not mark request as fulfilled.", variant: "destructive" });
    } finally {
      setIsSubmittingFulfillment(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate ? format(timestamp.toDate(), 'PPp') : 'Invalid Date';
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><Truck className="h-7 w-7 text-primary"/>Stock Fulfillment Requests</h1>
        <Button onClick={fetchRequests} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">View and fulfill pending stock requests assigned to you or awaiting fulfillment.</p>

      <Card>
        <CardHeader>
          {/* Filters could be added here if needed, e.g., by product */}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && requests.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : requests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No stock requests currently require your fulfillment.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Req.</TableHead><TableHead>Requester</TableHead><TableHead>Date Req.</TableHead><TableHead>Finance Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.productName}</TableCell>
                    <TableCell>{req.requestedQuantity}</TableCell>
                    <TableCell className="text-xs">{req.requesterName}</TableCell>
                    <TableCell className="text-xs">{formatDate(req.createdAt)}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{req.financeNotes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="default" size="sm" onClick={() => handleOpenFulfillModal(req)} title="Fulfill Request">
                        <CheckCircle className="mr-1 h-3 w-3" /> Fulfill
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {requests.length > 0 && 
          <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {requests.length} requests pending fulfillment.</p></CardFooter>}
      </Card>

      <Dialog open={isFulfillModalOpen} onOpenChange={setIsFulfillModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fulfill Stock Request for {actionableRequest?.productName}</DialogTitle>
            <DialogDescription>
              Requested Qty: {actionableRequest?.requestedQuantity}. Finance approved by: {actionableRequest?.financeManagerName || 'N/A'} on {formatDate(actionableRequest?.financeActionTimestamp)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
                <Label htmlFor="fulfilledQuantity">Quantity Fulfilled (Max: {actionableRequest?.requestedQuantity})</Label>
                <Input 
                    id="fulfilledQuantity" 
                    type="number"
                    value={fulfilledQuantity}
                    onChange={(e) => setFulfilledQuantity(e.target.value === '' ? '' : Math.max(0, Math.min(Number(e.target.value), actionableRequest?.requestedQuantity || 0)))}
                    max={actionableRequest?.requestedQuantity}
                    min="1"
                />
            </div>
            <div>
                <Label htmlFor="supplierNotes">Notes (Optional)</Label>
                <Textarea 
                    id="supplierNotes" 
                    value={supplierNotes} 
                    onChange={(e) => setSupplierNotes(e.target.value)}
                    placeholder="e.g., Partial fulfillment due to stock, expected restock date..."
                />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmFulfillment} 
              disabled={isSubmittingFulfillment || fulfilledQuantity === "" || Number(fulfilledQuantity) <= 0}
            >
              {isSubmittingFulfillment && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Mark as Fulfilled
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
