
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, RefreshCw, Coins, Trophy, ArrowRight, FilePlus2, Hourglass, TrendingUp, TrendingDown, Minus, ShoppingCart, Info } from 'lucide-react';
import type { StockRequest, StockRequestStatus, Bid, Product, Order, OrderStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, writeBatch, getDocs, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const getStockRequestStatusVariant = (status?: StockRequestStatus | null): BadgeProps['variant'] => {
  if (!status) return 'outline';
  switch (status) {
    case 'pending_bids': return 'statusYellow';
    case 'pending_award': return 'statusAmber';
    case 'awarded': return 'statusIndigo';
    case 'awaiting_fulfillment': return 'statusLightBlue';
    case 'received': return 'statusGreen';
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

  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [orderRequests, setOrderRequests] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewingRequest, setViewingRequest] = useState<StockRequest | null>(null);
  const [isSubmittingAward, setIsSubmittingAward] = useState(false);

  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [isOrderActionModalOpen, setIsOrderActionModalOpen] = useState(false);
  const [orderActionType, setOrderActionType] = useState<"approve" | "reject" | null>(null);
  const [orderRejectionReason, setOrderRejectionReason] = useState("");
  const [isSubmittingOrderAction, setIsSubmittingOrderAction] = useState(false);


  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, 'PPp');
  };

  const fetchAllData = useCallback(async () => {
    if (!db || !user || !['Admin', 'FinanceManager', 'InventoryManager'].includes(role || '')) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

      const unsubscribers: (() => void)[] = [];

      // Fetch stock requests needing bid awards
      const stockRequestsQuery = query(
        collection(db, 'stockRequests'), 
        where("status", "in", ["pending_award", "pending_bids"]), 
        orderBy("createdAt", "desc")
      );
      unsubscribers.push(onSnapshot(stockRequestsQuery, (snapshot) => {
        setStockRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
      }));

      // Fetch orders needing finance approval
      const orderRequestsQuery = query(
        collection(db, 'orders'),
        where("status", "==", "pending_finance_approval"),
        orderBy("createdAt", "desc")
      );
      unsubscribers.push(onSnapshot(orderRequestsQuery, (snapshot) => {
        setOrderRequests(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Order)));
      }));

      setIsLoading(false);
      return () => unsubscribers.forEach(unsub => unsub());

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
    const unsubscribe = fetchAllData();
    return () => {
      if (unsubscribe) {
        unsubscribe.then(unsub => unsub && unsub()).catch(err => console.error(err));
      }
    };
  }, [authLoading, user, role, router, fetchAllData]);

  const handleAwardBid = async (request: StockRequest, winningBid: Bid) => {
    if (!db || !user) return;
    setIsSubmittingAward(true);
    
    const requestRef = doc(db, 'stockRequests', request.id);

    try {
      await updateDoc(requestRef, {
        status: 'awarded', 
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

  const handleOpenOrderActionModal = (order: Order, type: 'approve' | 'reject') => {
    setViewingOrder(order);
    setOrderActionType(type);
    setOrderRejectionReason("");
    setIsOrderActionModalOpen(true);
  };
  
  const handleConfirmOrderAction = async () => {
    if (!db || !user || !viewingOrder || !orderActionType) return;
    if (orderActionType === 'reject' && !orderRejectionReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    setIsSubmittingOrderAction(true);
    
    const newStatus: OrderStatus = orderActionType === 'approve' ? 'processing' : 'cancelled';
    const notes = orderActionType === 'approve' 
        ? `Order approved by ${user.displayName || user.email}.`
        : `Order rejected by ${user.displayName || user.email}. Reason: ${orderRejectionReason}`;

    const newHistoryEntry = {
        status: newStatus,
        timestamp: Timestamp.now(),
        notes: notes,
        actorId: user.uid,
    };

    try {
        const orderRef = doc(db, 'orders', viewingOrder.id);
        await updateDoc(orderRef, {
            status: newStatus,
            deliveryHistory: arrayUnion(newHistoryEntry),
            updatedAt: serverTimestamp(),
        });
        toast({ title: `Order ${newStatus}`, description: `Order ${viewingOrder.id.substring(0,8)}... has been ${newStatus}.` });
        setIsOrderActionModalOpen(false);
        setViewingOrder(null);
    } catch (e: any) {
        toast({ title: "Action Failed", description: `Could not ${orderActionType} order.`, variant: "destructive" });
    } finally {
        setIsSubmittingOrderAction(false);
    }
  };
  
  const requestsNeedingAward = stockRequests.filter(r => r.status === 'pending_award');
  const productForViewingRequest = viewingRequest ? products.find(p => p.id === viewingRequest.productId) : null;

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><Coins className="h-7 w-7 text-primary"/>Finance & Stock Approvals</h1>
        <Button onClick={fetchAllData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Review and approve customer orders and supplier bids on stock requests.</p>

      {/* Order Approvals Section */}
       <Card>
        <CardHeader>
          <CardTitle>Customer Order Approvals</CardTitle>
          <CardDescription>Review new customer orders before they are sent for processing.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && orderRequests.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : orderRequests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No customer orders are currently awaiting approval.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Payment</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {orderRequests.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id.substring(0,8)}...</TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{formatKsh(order.totalAmount)}</TableCell>
                      <TableCell><Badge variant={order.paymentStatus === 'paid' ? 'statusGreen' : 'statusAmber'}>{order.paymentStatus}</Badge></TableCell>
                      <TableCell className="text-xs">{formatDate(order.createdAt)}</TableCell>
                      <TableCell className="text-right flex justify-end gap-2">
                        <Button size="sm" variant="destructive" onClick={() => handleOpenOrderActionModal(order, 'reject')}>
                            <XCircle className="mr-2 h-4 w-4" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => handleOpenOrderActionModal(order, 'approve')}>
                            <CheckCircle className="mr-2 h-4 w-4" /> Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {orderRequests.length > 0 && 
          <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {orderRequests.length} orders awaiting approval.</p></CardFooter>}
      </Card>


      {/* Stock Requests Awarding Section */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Requests - Bid Award</CardTitle>
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

      {/* Order Action Modal */}
      <Dialog open={isOrderActionModalOpen} onOpenChange={setIsOrderActionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="capitalize">{orderActionType} Order</DialogTitle><DialogDescription>You are about to {orderActionType} order: {viewingOrder?.id.substring(0,8)}...</DialogDescription></DialogHeader>
          {orderActionType === 'reject' && (
            <div className="py-2 space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea id="rejection-reason" value={orderRejectionReason} onChange={(e) => setOrderRejectionReason(e.target.value)} placeholder="Provide a brief reason for rejection..." />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="button" onClick={handleConfirmOrderAction} disabled={isSubmittingOrderAction || (orderActionType === 'reject' && !orderRejectionReason.trim())} variant={orderActionType === 'reject' ? 'destructive' : 'default'}>
                {isSubmittingOrderAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Confirm {orderActionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
