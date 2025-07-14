
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, RefreshCw, FilePlus2, Gavel, FileQuestion, Hourglass, Check } from 'lucide-react';
import type { StockRequest, StockRequestStatus, Bid } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_bids': return 'statusYellow';
    case 'pending_award': return 'statusAmber';
    case 'awarded': return 'statusIndigo';
    case 'awaiting_fulfillment': return 'statusLightBlue';
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance':
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
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [pricePerUnit, setPricePerUnit] = useState<number | string>("");
  const [bidNotes, setBidNotes] = useState("");
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);

  const fetchRequests = useCallback(() => {
    if (!db || !user || role !== 'Supplier') {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    // Suppliers see requests open for bidding, AND requests they have been awarded
    const q = query(
        collection(db, 'stockRequests'), 
        where("status", "in", ["pending_bids", "awaiting_fulfillment"]),
        orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetchedRequests = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest));
      // For 'awaiting_fulfillment', filter to only show if it was awarded to the current supplier
      fetchedRequests = fetchedRequests.filter(req => {
        if (req.status === 'awaiting_fulfillment') {
          return req.supplierId === user.uid;
        }
        return true; // Keep all 'pending_bids' requests
      });

      setRequests(fetchedRequests);
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

  const handleOpenBidModal = (request: StockRequest) => {
    setActionableRequest(request);
    setPricePerUnit(""); 
    setBidNotes("");
    setIsBidModalOpen(true);
  };
  
  const handleFulfillAndInvoice = (request: StockRequest) => {
    if(!request.supplierPrice) {
        toast({ title: "Error", description: "Cannot create invoice, supplier price is missing.", variant: "destructive" });
        return;
    }
     const queryParams = new URLSearchParams({
        stockRequestId: request.id,
        productId: request.productId,
        productName: request.productName,
        fulfilledQty: String(request.requestedQuantity),
        supplierPrice: String(request.supplierPrice) // Pass the awarded price
    });
    router.push(`/supplier/invoices/new?${queryParams.toString()}`);
  }

  const handleSubmitBid = async () => {
    if (!db || !user || !actionableRequest || pricePerUnit === "") return;
    
    const numPrice = Number(pricePerUnit);
    if (isNaN(numPrice) || numPrice <= 0) {
      toast({ title: "Invalid Price", description: "Price must be a positive number.", variant: "destructive" });
      return;
    }

    setIsSubmittingBid(true);
    try {
      const requestRef = doc(db, 'stockRequests', actionableRequest.id);
      const newBid: Bid = {
        id: doc(collection(db, 'bids')).id, // Generate a unique ID for the bid
        supplierId: user.uid,
        supplierName: user.displayName || user.email || "Unnamed Supplier",
        pricePerUnit: numPrice,
        notes: bidNotes,
        createdAt: serverTimestamp(),
      };

      await updateDoc(requestRef, {
        bids: arrayUnion(newBid),
        status: 'pending_award', // Change status to indicate bids are present
        updatedAt: serverTimestamp(),
      });
      
      toast({ title: "Bid Submitted", description: `Your bid for ${actionableRequest.productName} has been submitted.` });
      setIsBidModalOpen(false);
      setActionableRequest(null);
    } catch (e: any) {
      console.error("Error submitting bid:", e);
      toast({ title: "Error", description: "Could not submit your bid.", variant: "destructive" });
    } finally {
      setIsSubmittingBid(false);
    }
  };


  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate ? format(timestamp.toDate(), 'PPp') : 'Invalid Date';
  };
  
  const userHasBid = (request: StockRequest) => {
    return request.bids?.some(bid => bid.supplierId === user?.uid);
  }

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><FileQuestion className="h-7 w-7 text-primary"/>Stock Fulfillment</h1>
        <Button onClick={fetchRequests} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">View open requests for bids and manage your awarded contracts.</p>

      <Card>
        <CardHeader>
          <CardTitle>Open for Bidding</CardTitle>
          <CardDescription>Place your bid on these open stock requests.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : requests.filter(r => r.status === 'pending_bids').length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No stock requests are currently open for bidding.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Req.</TableHead><TableHead>Requester</TableHead><TableHead>Date Req.</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.filter(r => r.status === 'pending_bids').map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.productName}</TableCell>
                    <TableCell>{req.requestedQuantity}</TableCell>
                    <TableCell className="text-xs">{req.requesterName}</TableCell>
                    <TableCell className="text-xs">{formatDate(req.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {userHasBid(req) ? (
                         <Badge variant="statusGreen"><Check className="mr-1 h-3 w-3"/> Bid Submitted</Badge>
                      ) : (
                        <Button variant="default" size="sm" onClick={() => handleOpenBidModal(req)} title="Place Bid">
                            <Gavel className="mr-1 h-3 w-3" /> Place Bid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Awaiting My Fulfillment</CardTitle>
          <CardDescription>These requests have been awarded to you. Fulfill the order and create an invoice.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : requests.filter(r => r.status === 'awaiting_fulfillment').length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No requests have been awarded to you yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Awarded Price/Unit</TableHead><TableHead>Awarded On</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {requests.filter(r => r.status === 'awaiting_fulfillment').map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.productName}</TableCell>
                    <TableCell>{req.requestedQuantity}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatKsh(req.supplierPrice)}</TableCell>
                    <TableCell className="text-xs">{formatDate(req.financeActionTimestamp)}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="default" size="sm" onClick={() => handleFulfillAndInvoice(req)} title="Fulfill and Create Invoice">
                            <FilePlus2 className="mr-1 h-3 w-3" /> Fulfill & Invoice
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isBidModalOpen} onOpenChange={setIsBidModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Bid for {actionableRequest?.productName}</DialogTitle>
            <DialogDescription>
              Requested Qty: {actionableRequest?.requestedQuantity}. Your bid will be reviewed by management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
                <Label htmlFor="pricePerUnit">Your Price Per Unit (KES)</Label>
                <Input 
                    id="pricePerUnit" 
                    type="number"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    min="0"
                    placeholder="e.g., 500.00"
                />
            </div>
            <div>
                <Label htmlFor="bidNotes">Notes (Optional)</Label>
                <Textarea 
                    id="bidNotes" 
                    value={bidNotes} 
                    onChange={(e) => setBidNotes(e.target.value)}
                    placeholder="e.g., Delivery timeline, bulk discounts..."
                />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleSubmitBid} 
              disabled={isSubmittingBid || pricePerUnit === "" || Number(pricePerUnit) <= 0}
            >
              {isSubmittingBid && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Submit Bid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
