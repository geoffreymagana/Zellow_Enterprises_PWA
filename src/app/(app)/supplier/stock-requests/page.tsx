
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, RefreshCw, FilePlus2 } from 'lucide-react'; // Changed Truck to FilePlus2
import type { StockRequest, StockRequestStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';


const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_finance_approval': return 'statusYellow';
    case 'pending_supplier_fulfillment': return 'statusAmber';
    case 'awaiting_receipt': return 'statusBlue';
    case 'received': return 'statusGreen';
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
  const [isPrepareInvoiceModalOpen, setIsPrepareInvoiceModalOpen] = useState(false);
  const [fulfilledQuantity, setFulfilledQuantity] = useState<number | string>("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [isSubmittingPreparation, setIsSubmittingPreparation] = useState(false);

  const fetchRequests = useCallback(() => {
    if (!db || !user || role !== 'Supplier') {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    const q = query(
        collection(db, 'stockRequests'), 
        where("status", "==", "pending_supplier_fulfillment"),
        // where("supplierId", "==", user.uid), // If we assign suppliers directly to requests later
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

  const handleOpenPrepareInvoiceModal = (request: StockRequest) => {
    setActionableRequest(request);
    setFulfilledQuantity(request.requestedQuantity); 
    setSupplierNotes(request.supplierNotes || ""); // Pre-fill if any notes were there
    setIsPrepareInvoiceModalOpen(true);
  };

  const handleConfirmPreparationAndNavigateToInvoice = async () => {
    if (!actionableRequest || fulfilledQuantity === "") return;
    
    const numFulfilledQuantity = Number(fulfilledQuantity);
    if (isNaN(numFulfilledQuantity) || numFulfilledQuantity <= 0) {
      toast({ title: "Invalid Quantity", description: "Fulfilled quantity must be a positive number.", variant: "destructive" });
      return;
    }
    if (numFulfilledQuantity > actionableRequest.requestedQuantity) {
      toast({ title: "Invalid Quantity", description: "Fulfilled quantity cannot exceed requested quantity.", variant: "destructive" });
      return;
    }

    setIsSubmittingPreparation(true);
    // Construct query parameters
    const queryParams = new URLSearchParams({
        stockRequestId: actionableRequest.id,
        productId: actionableRequest.productId,
        productName: actionableRequest.productName,
        fulfilledQty: String(numFulfilledQuantity),
        // Supplier notes from this dialog can be passed to prefill invoice notes
        supplierNotesDialog: supplierNotes, 
    });

    // For now, we just navigate. The actual stock request update will happen after invoice submission.
    router.push(`/supplier/invoices/new?${queryParams.toString()}`);
    setIsPrepareInvoiceModalOpen(false);
    setActionableRequest(null);
    setIsSubmittingPreparation(false); // Reset after navigation
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
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><FilePlus2 className="h-7 w-7 text-primary"/>Stock Fulfillment & Invoicing</h1>
        <Button onClick={fetchRequests} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">View requests, confirm fulfillment details, and generate invoices.</p>

      <Card>
        <CardHeader>
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
                      <Button variant="default" size="sm" onClick={() => handleOpenPrepareInvoiceModal(req)} title="Prepare & Invoice">
                        <FilePlus2 className="mr-1 h-3 w-3" /> Prepare & Invoice
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

      <Dialog open={isPrepareInvoiceModalOpen} onOpenChange={setIsPrepareInvoiceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prepare Invoice for {actionableRequest?.productName}</DialogTitle>
            <DialogDescription>
              Confirm quantity to fulfill. Requested: {actionableRequest?.requestedQuantity}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
                <Label htmlFor="fulfilledQuantityModal">Quantity You Will Fulfill (Max: {actionableRequest?.requestedQuantity})</Label>
                <Input 
                    id="fulfilledQuantityModal" 
                    type="number"
                    value={fulfilledQuantity}
                    onChange={(e) => setFulfilledQuantity(e.target.value === '' ? '' : Math.max(0, Math.min(Number(e.target.value), actionableRequest?.requestedQuantity || 0)))}
                    max={actionableRequest?.requestedQuantity}
                    min="1"
                />
            </div>
            <div>
                <Label htmlFor="supplierNotesModal">Notes for Zellow (Optional)</Label>
                <Textarea 
                    id="supplierNotesModal" 
                    value={supplierNotes} 
                    onChange={(e) => setSupplierNotes(e.target.value)}
                    placeholder="e.g., Partial fulfillment, expected restock..."
                />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmPreparationAndNavigateToInvoice} 
              disabled={isSubmittingPreparation || fulfilledQuantity === "" || Number(fulfilledQuantity) <= 0}
            >
              {isSubmittingPreparation && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Proceed to Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
