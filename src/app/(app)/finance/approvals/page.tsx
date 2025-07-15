
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, RefreshCw, Coins, Trophy, ArrowRight, FilePlus2, Hourglass, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { StockRequest, StockRequestStatus, Bid, Product } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const getStockRequestStatusVariant = (status?: StockRequestStatus | null): BadgeProps['variant'] => {
  if (!status) return 'outline';
  switch (status) {
    case 'pending_bids': return 'statusYellow';
    case 'pending_award': return 'statusAmber';
    case 'awarded': return 'statusIndigo';
    case 'awaiting_fulfillment': return 'statusLightBlue';
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance': return 'statusRed';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

const formatKsh = (amount?: number): string => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
};


export default function FinanceApprovalsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewingRequest, setViewingRequest] = useState<StockRequest | null>(null);
  const [isSubmittingAward, setIsSubmittingAward] = useState(false);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, 'PPp');
  };

  const fetchRequestsAndProducts = useCallback(async () => {
    if (!db || !user || !['Admin', 'FinanceManager', 'InventoryManager'].includes(role || '')) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    try {
      // Fetch products first to have them available for lookups
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);

      // Fetch requests needing bid awards
      const requestsQuery = query(
        collection(db, 'stockRequests'), 
        where("status", "in", ["pending_award", "pending_bids"]), 
        orderBy("createdAt", "desc")
      );
      
      const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
        setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
        setIsLoading(false); // Only set loading false after requests are fetched
      }, (error) => {
        console.error("Error fetching stock requests:", error);
        toast({ title: "Error", description: "Could not load stock requests for approval.", variant: "destructive" });
        setIsLoading(false);
      });

      return unsubscribe;

    } catch (error) {
       console.error("Error fetching initial data:", error);
       toast({ title: "Error", description: "Could not load page data.", variant: "destructive" });
       setIsLoading(false);
    }
  }, [db, user, role, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['Admin', 'FinanceManager', 'InventoryManager'].includes(role || '')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchRequestsAndProducts();
    // This will return the onSnapshot unsubscriber if it was created
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [authLoading, user, role, router, fetchRequestsAndProducts]);

  const handleAwardBid = async (request: StockRequest, winningBid: Bid) => {
    if (!db || !user) return;
    setIsSubmittingAward(true);
    
    const requestRef = doc(db, 'stockRequests', request.id);

    try {
      await updateDoc(requestRef, {
        status: 'awarded', // Change status to awarded
        winningBidId: winningBid.id,
        supplierPrice: winningBid.pricePerUnit,
        supplierId: winningBid.supplierId,
        supplierName: winningBid.supplierName,
        financeManagerId: user.uid,
        financeManagerName: user.displayName || user.email,
        financeActionTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Bid Awarded", description: `Request awarded to ${winningBid.supplierName}.` });
      setViewingRequest(null);
    } catch (e: any) {
      console.error("Error awarding bid:", e);
      toast({ title: "Error", description: `Could not award bid: ${e.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingAward(false);
    }
  };
  
  const requestsNeedingAward = requests.filter(r => r.status === 'pending_award');

  const productForViewingRequest = viewingRequest ? products.find(p => p.id === viewingRequest.productId) : null;

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><Trophy className="h-7 w-7 text-primary"/>Bid & Award Center</h1>
        <Button onClick={fetchRequestsAndProducts} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Review supplier bids on stock requests and award the contract.</p>

      <Card>
        <CardHeader>
          <CardTitle>Requests Awaiting Bid Award</CardTitle>
          <CardDescription>These requests have received one or more bids and are ready for you to select a winner.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && requestsNeedingAward.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : requestsNeedingAward.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No stock requests are currently awaiting a bid award.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Req.</TableHead><TableHead># Bids</TableHead><TableHead>Best Bid</TableHead><TableHead>Date Req.</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {requestsNeedingAward.map((req) => {
                  const bestBid = req.bids?.sort((a,b) => a.pricePerUnit - b.pricePerUnit)[0];
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.productName || ''}</TableCell>
                      <TableCell>{req.requestedQuantity}</TableCell>
                      <TableCell>{req.bids?.length || 0}</TableCell>
                      <TableCell>{bestBid ? formatKsh(bestBid.pricePerUnit) : 'N/A'}</TableCell>
                      <TableCell className="text-xs">{formatDate(req.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setViewingRequest(req)} disabled={!req.bids || req.bids.length === 0}>
                           <Eye className="mr-2 h-4 w-4"/> Review Bids
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {requestsNeedingAward.length > 0 && 
          <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {requestsNeedingAward.length} requests awaiting bid award.</p></CardFooter>}
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Open for Bidding</CardTitle>
            <CardDescription>These requests are live and awaiting bids from suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : requests.filter(r => r.status === 'pending_bids').length === 0 ? (
             <p className="p-6 text-center text-muted-foreground">No requests are currently open for bidding.</p>
          ) : (
            requests.filter(r => r.status === 'pending_bids').map(req => (
              <div key={req.id} className="text-sm p-2 border-b last:border-b-0 flex justify-between items-center">
                <span>{req.productName} (Qty: {req.requestedQuantity})</span>
                <Badge variant="statusYellow" className="text-xs">Awaiting Bids</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>


      <Dialog open={!!viewingRequest} onOpenChange={() => setViewingRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Bids for: {viewingRequest?.productName}</DialogTitle>
            <DialogDescription>
              Requested Qty: {viewingRequest?.requestedQuantity}. Select the winning bid to proceed.
            </DialogDescription>
             {productForViewingRequest && (
              <div className="text-sm text-muted-foreground pt-2">
                Current Product Price: <span className="font-semibold text-foreground">{formatKsh(productForViewingRequest.price)}</span>
              </div>
            )}
          </DialogHeader>
          <div className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {viewingRequest?.bids && viewingRequest.bids.length > 0 ? (
                viewingRequest.bids.sort((a,b) => a.pricePerUnit - b.pricePerUnit).map(bid => {
                  const currentProductPrice = productForViewingRequest?.price;
                  const priceDifference = currentProductPrice !== undefined ? bid.pricePerUnit - currentProductPrice : 0;
                  const isBetterPrice = priceDifference < 0;
                  const isWorsePrice = priceDifference > 0;
                  const Icon = isBetterPrice ? TrendingDown : isWorsePrice ? TrendingUp : Minus;
                  const iconColor = isBetterPrice ? 'text-green-500' : isWorsePrice ? 'text-red-500' : 'text-muted-foreground';

                  return (
                    <Card key={bid.id} className="bg-muted/50">
                        <CardContent className="p-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                <div>
                                    <p className="font-semibold">{bid.supplierName}</p>
                                    <p className="text-xs text-muted-foreground">Submitted: {formatDate(bid.createdAt)}</p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <p className="font-bold text-lg text-primary">{formatKsh(bid.pricePerUnit)} <span className="text-sm font-normal text-muted-foreground">/ unit</span></p>
                                    <p className="text-xs">Tax Rate: {bid.taxRate ?? 0}%</p>
                                    <p className="text-sm font-medium">Total Bid (Excl. Tax): {formatKsh(bid.pricePerUnit * (viewingRequest.requestedQuantity || 0))}</p>
                                    {currentProductPrice !== undefined && (
                                      <p className={cn("text-xs font-medium flex items-center justify-start sm:justify-end gap-1", iconColor)}>
                                        <Icon className="h-3 w-3" />
                                        {formatKsh(Math.abs(priceDifference))} {isBetterPrice ? 'below' : (isWorsePrice ? 'above' : 'equal to')} list price
                                      </p>
                                    )}
                                </div>
                            </div>
                            {bid.notes && <p className="text-xs mt-2 border-t pt-2">Notes: {bid.notes}</p>}
                            <div className="mt-3 flex justify-end">
                                <Button 
                                    size="sm" 
                                    onClick={() => handleAwardBid(viewingRequest, bid)} 
                                    disabled={isSubmittingAward}
                                >
                                    {isSubmittingAward && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    <Trophy className="mr-2 h-4 w-4"/> Award to this Supplier
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                  )
                })
            ) : (
                <p>No bids submitted for this request yet.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
