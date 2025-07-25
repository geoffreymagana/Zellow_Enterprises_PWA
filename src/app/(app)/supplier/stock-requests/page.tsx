
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, RefreshCw, FilePlus2, Gavel, FileQuestion, Hourglass, Check, Send } from 'lucide-react';
import type { StockRequest, StockRequestStatus, Bid, Invoice, InvoiceStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_bids': return 'statusYellow';
    case 'pending_award': return 'statusAmber';
    case 'awarded': return 'statusIndigo';
    case 'awaiting_fulfillment': return 'statusLightBlue';
    case 'awaiting_receipt': return 'statusBlue';
    case 'received':
    case 'fulfilled':
      return 'statusGreen';
    case 'rejected_finance':
    case 'cancelled': 
      return 'statusRed';
    default: return 'outline';
  }
};

const formatKsh = (price?: number): string => {
    if (price === undefined || price === null) return 'N/A';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function SupplierStockRequestsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [openForBiddingRequests, setOpenForBiddingRequests] = useState<StockRequest[]>([]);
  const [awardedToMeRequests, setAwardedToMeRequests] = useState<StockRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]); // New state for invoices
  const [isLoading, setIsLoading] = useState(true);
  
  const [actionableRequest, setActionableRequest] = useState<StockRequest | null>(null);
  const [isBidModalOpen, setIsBidModalOpen] = useState(false);
  const [pricePerUnit, setPricePerUnit] = useState<number | string>("");
  const [taxRate, setTaxRate] = useState<number | string>(0);
  const [bidNotes, setBidNotes] = useState("");
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);

  const fetchRequests = useCallback(() => {
    if (!db || !user || role !== 'Supplier') {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);

    const openForBidsQuery = query(
        collection(db, 'stockRequests'), 
        where("status", "in", ["pending_bids", "pending_award"]),
        orderBy("createdAt", "desc")
    );
    
    const awardedToMeQuery = query(
      collection(db, 'stockRequests'),
      where('supplierId', '==', user.uid),
      where('status', 'in', ['awarded', 'awaiting_fulfillment', 'awaiting_receipt', 'fulfilled', 'received']),
      orderBy('updatedAt', 'desc')
    );

    const invoicesQuery = query(
        collection(db, 'invoices'),
        where('supplierId', '==', user.uid)
    );

    const unsubOpenBids = onSnapshot(openForBidsQuery, (snapshot) => {
        setOpenForBiddingRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
        setIsLoading(false); // Set loading to false after first query completes
    }, (error) => {
      console.error("Error fetching open stock requests:", error);
      toast({ title: "Error", description: "Could not load open requests.", variant: "destructive" });
      setIsLoading(false);
    });

    const unsubAwardedToMe = onSnapshot(awardedToMeQuery, (snapshot) => {
        setAwardedToMeRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
    }, (error) => {
      console.error("Error fetching awarded stock requests:", error);
      toast({ title: "Error", description: "Could not load your awarded requests.", variant: "destructive" });
    });
    
    const unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
        setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    }, (error) => {
        console.error("Error fetching invoices:", error);
        toast({ title: "Error", description: "Could not load related invoices.", variant: "destructive" });
    });


    return () => {
        unsubOpenBids();
        unsubAwardedToMe();
        unsubInvoices();
    };
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
    setTaxRate(0);
    setBidNotes("");
    setIsBidModalOpen(true);
  };

  const handleCreateInvoice = async (request: StockRequest) => {
    if(!request.supplierPrice || !db) {
        toast({ title: "Error", description: "Cannot create invoice, awarded price is missing.", variant: "destructive" });
        return;
    }
    const queryParams = new URLSearchParams({
        stockRequestId: request.id,
        productName: request.productName,
        fulfilledQty: String(request.requestedQuantity),
        supplierPrice: String(request.supplierPrice)
    });
    router.push(`/supplier/invoices/new?${queryParams.toString()}`);
  };

  const handleSendConsignment = async (request: StockRequest) => {
    if (!db || !user) return;
    try {
        const requestRef = doc(db, 'stockRequests', request.id);
        await updateDoc(requestRef, {
            status: 'awaiting_receipt',
            supplierActionTimestamp: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Consignment Sent", description: "The Inventory Manager has been notified to expect your delivery." });
    } catch (e: any) {
        console.error("Error updating status:", e);
        toast({ title: "Error", description: "Could not mark consignment as sent.", variant: "destructive" });
    }
  };

  const handleSubmitBid = async () => {
    if (!db || !user || !actionableRequest || pricePerUnit === "") return;
    
    const numPrice = Number(pricePerUnit);
    if (isNaN(numPrice) || numPrice <= 0) {
      toast({ title: "Invalid Price", description: "Price must be a positive number.", variant: "destructive" });
      return;
    }

    const numTaxRate = Number(taxRate);
    if (isNaN(numTaxRate) || numTaxRate < 0 || numTaxRate > 100) {
        toast({ title: "Invalid Tax Rate", description: "Tax rate must be between 0 and 100.", variant: "destructive" });
        return;
    }

    setIsSubmittingBid(true);
    try {
      const requestRef = doc(db, 'stockRequests', actionableRequest.id);
      const newBid: Bid = {
        id: doc(collection(db, 'bids')).id, 
        supplierId: user.uid,
        supplierName: user.displayName || user.email || "Unnamed Supplier",
        pricePerUnit: numPrice,
        taxRate: numTaxRate,
        notes: bidNotes,
        createdAt: new Date(), 
      };

      await updateDoc(requestRef, {
        bids: arrayUnion(newBid),
        status: 'pending_award',
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
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, 'PPp');
  };
  
  const userHasBid = (request: StockRequest) => {
    return request.bids?.some(bid => bid.supplierId === user?.uid);
  }

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  const myAwardedRequests = awardedToMeRequests.filter(req => req.status === 'awarded');
  const myAwaitingFulfillment = awardedToMeRequests.filter(req => req.status === 'awaiting_fulfillment');
  const myFulfilledRequests = awardedToMeRequests.filter(req => ['awaiting_receipt', 'fulfilled', 'received'].includes(req.status));

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
          {isLoading && openForBiddingRequests.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : openForBiddingRequests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No stock requests are currently open for bidding.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Req.</TableHead><TableHead>Requester</TableHead><TableHead>Date Req.</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {openForBiddingRequests.map((req) => (
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
          <CardDescription>These requests have been awarded to you. Create an invoice to proceed.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {isLoading && myAwardedRequests.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : myAwardedRequests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No requests have been awarded to you yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Awarded Price/Unit</TableHead><TableHead>Awarded On</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {myAwardedRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.productName}</TableCell>
                    <TableCell>{req.requestedQuantity}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatKsh(req.supplierPrice)}</TableCell>
                    <TableCell className="text-xs">{formatDate(req.financeActionTimestamp)}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="default" size="sm" onClick={() => handleCreateInvoice(req)} title="Create Invoice">
                            <FilePlus2 className="mr-1 h-3 w-3" /> Create Invoice
                        </Button>
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
          <CardTitle>Awaiting Consignment</CardTitle>
          <CardDescription>You have created an invoice for these items. Confirm when you have sent the goods.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {isLoading && myAwaitingFulfillment.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : myAwaitingFulfillment.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No requests are awaiting consignment.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Invoice ID</TableHead><TableHead>Invoice Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {myAwaitingFulfillment.map((req) => {
                  const invoice = invoices.find(inv => inv.id === req.invoiceId);
                  const isApproved = invoice?.status === 'approved_for_payment';
                  const sendButtonDisabled = !req.invoiceId || !isApproved;

                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.productName}</TableCell>
                      <TableCell>{req.requestedQuantity}</TableCell>
                      <TableCell className="text-xs">{req.invoiceId ? <Link href="/invoices" className="text-primary underline">{req.invoiceId.substring(0,8)}...</Link> : 'N/A'}</TableCell>
                      <TableCell>
                          {invoice ? <Badge variant={invoice.status === 'approved_for_payment' ? 'statusGreen' : 'statusYellow'}>{invoice.status.replace(/_/g, ' ')}</Badge> : <Badge variant="outline">N/A</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                           <Tooltip>
                              <TooltipTrigger asChild>
                                  <span tabIndex={0}> {/* Wrapper for Tooltip with disabled button */}
                                      <Button variant="default" size="sm" onClick={() => handleSendConsignment(req)} title="Mark as Sent" disabled={sendButtonDisabled}>
                                          <Send className="mr-1 h-3 w-3" /> Send Consignment
                                      </Button>
                                  </span>
                              </TooltipTrigger>
                              {sendButtonDisabled && (
                                <TooltipContent>
                                  <p>Invoice must be approved by finance before sending.</p>
                                </TooltipContent>
                              )}
                           </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card className="mb-20">
        <CardHeader>
            <CardTitle>My Fulfilled Requests History</CardTitle>
            <CardDescription>History of your completed fulfillments.</CardDescription>
        </CardHeader>
        <CardContent>
             {isLoading ? (
                <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
              ) : myFulfilledRequests.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">You have not fulfilled any requests yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {myFulfilledRequests.map(req => (
                        <Card key={req.id} className="shadow-md bg-muted/50">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-base font-semibold">{req.productName}</CardTitle>
                                    <Badge variant={getStockRequestStatusVariant(req.status)} className="capitalize text-xs whitespace-nowrap">{req.status.replace(/_/g, ' ')}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-1.5 pt-0 pb-3">
                                <p><strong>Qty Fulfilled:</strong> {req.fulfilledQuantity ?? 'N/A'}</p>
                                <p><strong>Awarded Price:</strong> {formatKsh(req.supplierPrice)}/unit</p>
                                <p><strong>Invoice ID:</strong> {req.invoiceId ? <Link href="/invoices" className="text-primary underline">{req.invoiceId.substring(0,8)}...</Link> : 'N/A'}</p>
                                <p><strong>Sent On:</strong> {formatDate(req.supplierActionTimestamp)}</p>
                                {req.receivedAt && <p className="text-green-600"><strong>Received On:</strong> {formatDate(req.receivedAt)}</p>}
                            </CardContent>
                        </Card>
                    ))}
                </div>
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
                <Label htmlFor="taxRate">Your Tax Rate (%)</Label>
                <Input 
                    id="taxRate" 
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    min="0"
                    max="100"
                    placeholder="e.g., 5 for 5%"
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
