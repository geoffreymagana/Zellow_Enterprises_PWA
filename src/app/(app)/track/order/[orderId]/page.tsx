
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, DeliveryHistoryEntry, OrderStatus, PaymentStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Package, ShoppingBag, Truck, CheckCircle, MapPin, Clock, Star, MessageSquare, Home, Download, ThumbsUp, ThumbsDown, XCircle, Gift, Image as ImageIcon, Eye } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Logo } from '@/components/common/Logo';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any, includeTime: boolean = true) => {
  if (!timestamp) return 'N/A';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return includeTime ? format(date, 'PPp') : format(date, 'PP');
};

const getOrderStatusBadgeVariant = (status: OrderStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending':
    case 'pending_finance_approval':
       return 'statusYellow';
    case 'processing': return 'statusAmber';
    case 'in_production':
    case 'awaiting_quality_check':
    case 'production_complete':
      return 'statusPurple';
    case 'awaiting_assignment': return 'statusOrange';
    case 'awaiting_customer_approval': return 'statusOrange';
    case 'out_for_delivery': return 'statusBlue';
    case 'shipped': return 'statusIndigo';
    case 'delivered': return 'statusGreen';
    case 'completed': return 'statusGreen';
    case 'delivery_attempted': return 'statusPurple';
    case 'rejected_by_customer':
    case 'cancelled': 
      return 'statusRed';
    default: return 'outline';
  }
};

const MinimalHeader = () => (
  <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[var(--header-height)]">
    <div className="container mx-auto h-full flex items-center justify-between px-4">
      <Logo iconSize={24} textSize="text-xl" />
      <span className="text-sm text-muted-foreground">Gift Tracking</span>
    </div>
  </header>
);

const MinimalFooter = () => (
  <footer className="py-4 text-center text-xs text-muted-foreground border-t bg-background mt-8">
    © {new Date().getFullYear()} Zellow Enterprises. All rights reserved.
  </footer>
);


export default function TrackOrderPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isGiftRecipientView = searchParams.get('ctx') === 'gift_recipient';

  useEffect(() => {
    if (!orderId || !db) {
      setError(orderId ? "Database service unavailable." : "No order ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const orderDocRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(orderDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order;

        if (isGiftRecipientView && orderData.isGift && orderData.giftDetails && !orderData.giftDetails.recipientCanViewAndTrack) {
          setOrder(null);
          setError("Access to detailed tracking for this gift is restricted by the sender.");
        } else {
          setOrder(orderData);
          if (orderData.rating) {
            setSelectedRating(orderData.rating.value);
            setComment(orderData.rating.comment || "");
          }
          setError(null);
        }
      } else {
        setError("Order not found.");
        setOrder(null);
      }
      setLoading(false);
    }, (err: any) => {
      console.error("Error fetching order for tracking:", err);
      setError("Failed to load order tracking details.");
      setOrder(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [orderId, isGiftRecipientView]);
  
  const handleUpdateStatus = async (newStatus: OrderStatus, notes?: string, newPaymentStatus?: PaymentStatus) => {
    if (!order || !db || !user) return;
    setIsUpdating(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const newHistoryEntry: DeliveryHistoryEntry = {
        status: newStatus,
        timestamp: Timestamp.now(),
        notes: notes || `Order status updated to ${newStatus} by customer.`,
        actorId: user.uid,
      };
      
      const updatePayload: any = {
        status: newStatus,
        deliveryHistory: arrayUnion(newHistoryEntry),
        updatedAt: serverTimestamp(),
      };
      if (newPaymentStatus) {
        updatePayload.paymentStatus = newPaymentStatus;
      }
      
      await updateDoc(orderRef, updatePayload);
      toast({ title: "Order Updated", description: "Your order status has been successfully updated." });
    } catch (e: any) {
      console.error("Error updating order status:", e);
      toast({ title: "Error", description: "Could not update your order status. Please contact support.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAcceptDelivery = () => {
    handleUpdateStatus('completed', 'Customer accepted delivery.');
  };

  const handleRejectDelivery = () => {
    if (!rejectionReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for rejecting the delivery.", variant: "destructive" });
      return;
    }
    handleUpdateStatus('rejected_by_customer', `Customer rejected delivery. Reason: ${rejectionReason}`);
    setIsRejectModalOpen(false);
  };
  
  const handleCancelOrder = () => {
    if (!order) return;
    const newPaymentStatus = order.paymentStatus === 'paid' ? 'refund_requested' : 'failed';
    const notes = order.paymentStatus === 'paid' 
      ? "Order cancelled by customer. Payment was made, refund requested."
      : "Order cancelled by customer before payment.";
    handleUpdateStatus('cancelled', notes, newPaymentStatus);
  };

  const handleFeedbackSubmit = async () => {
    if (!orderId || !db || !user || (order && order.customerId !== user.uid) || selectedRating === 0) {
      toast({ title: "Feedback Error", description: "Please select a rating. Only the order placer can leave feedback.", variant: "destructive"});
      return;
    }
    setIsSubmittingFeedback(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        rating: {
          value: selectedRating,
          comment: comment,
          ratedAt: serverTimestamp(),
          userId: user.uid,
        },
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Feedback Submitted", description: "Thank you for your feedback!"});
    } catch (e: any) {
      console.error("Error submitting feedback:", e);
      toast({ title: "Error", description: "Could not submit feedback.", variant: "destructive"});
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  
  const handleProofOfWorkApproval = async (approved: boolean) => {
    if (!order || !user || !rejectionReason.trim() && !approved) {
        toast({ title: "Reason Required", description: "Please provide feedback or a reason for rejection.", variant: "destructive" });
        return;
    }
    const newStatus: OrderStatus = approved ? 'in_production' : 'processing';
    const notes = approved 
        ? 'Customer approved the proof of work.'
        : `Customer rejected proof of work. Reason: ${rejectionReason}`;

    handleUpdateStatus(newStatus, notes);
    setIsRejectModalOpen(false);
  };

  const pageContent = (
  <>
  {loading ? (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Loading order tracking information...</p>
    </div>
  ) : error && !order ? (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
      <h1 className="text-xl font-semibold mb-2">Tracking Unavailable</h1>
      <p className="text-muted-foreground mb-6">{error}</p>
      {isGiftRecipientView ? (
        <p className="text-sm text-muted-foreground">If you believe this is an error, please contact the sender.</p>
      ) : (
        <Button onClick={() => router.push('/dashboard')} variant="outline">
          Go to Dashboard
        </Button>
      )}
    </div>
  ) : !order ? (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <Package className="h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-muted-foreground mb-6">Order details could not be loaded.</p>
      {isGiftRecipientView ? (
        <p className="text-sm text-muted-foreground">Please check the link or contact the sender.</p>
      ) : (
        <Button onClick={() => router.push('/')} variant="outline">Go to Homepage</Button>
      )}
    </div>
  ) : (() => {
    const currentStatusEntry = order.deliveryHistory && order.deliveryHistory.length > 0
      ? order.deliveryHistory[order.deliveryHistory.length - 1]
      : { status: order.status, timestamp: order.updatedAt || order.createdAt, notes: 'Order status updated.' };

    const canRateOrder = !isGiftRecipientView && user && order.customerId === user.uid && order.status === 'completed' && !order.rating;
    const hasBeenRated = !isGiftRecipientView && user && order.customerId === user.uid && !!order.rating;
    const canDownloadReceipt = !isGiftRecipientView && user && order.customerId === user.uid && ['paid', 'refund_requested', 'refunded'].includes(order.paymentStatus);
    const isOrderMutable = !['delivered', 'completed', 'cancelled', 'rejected_by_customer'].includes(order.status);
    const canConfirmDelivery = !isGiftRecipientView && user && order.customerId === user.uid && order.status === 'delivered';
    const canApproveProof = !isGiftRecipientView && user && order.customerId === user.uid && order.status === 'awaiting_customer_approval';

    if (isGiftRecipientView && order.status === 'completed') {
       return (
        <div className="flex items-center justify-center p-4">
            <Card className="shadow-lg max-w-md w-full text-center">
            <CardHeader>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <CardTitle className="text-2xl font-headline">Your Gift Has Been Delivered!</CardTitle>
                <CardDescription>Order ID: {order.id.substring(0,12)}...</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">We hope you enjoy your special gift from {order.customerName || "your sender"}!</p>
                {order.actualDeliveryTime && (
                    <p className="text-xs text-muted-foreground mt-2">Delivered on: {formatDate(order.actualDeliveryTime)}</p>
                )}
            </CardContent>
            <CardFooter className="justify-center">
                 <Link href="/products" passHref>
                    <Button variant="outline"><ShoppingBag className="mr-2 h-4 w-4"/> Explore More Gifts</Button>
                 </Link>
            </CardFooter>
            </Card>
        </div>
       );
    }
    
    return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          {order.status === 'completed' || order.status === 'delivered' ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
          ) : (
            <Truck className="h-16 w-16 text-primary mx-auto mb-3" />
          )}
          <CardTitle className="text-2xl font-headline">
            Order Tracking
          </CardTitle>
          <CardDescription>
            Order ID: <span className="font-semibold text-primary">{order.id}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Current Status:</p>
             <Badge variant={getOrderStatusBadgeVariant(currentStatusEntry.status as OrderStatus)} className="text-xl capitalize font-semibold my-1">
                {currentStatusEntry.status.replace(/_/g, ' ')}
            </Badge>
            <p className="text-xs text-muted-foreground">As of: {formatDate(currentStatusEntry.timestamp)}</p>
            {currentStatusEntry.notes && <p className="text-xs text-muted-foreground mt-1">Note: {currentStatusEntry.notes}</p>}
          </div>

          {canApproveProof && (
             <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                    <CardTitle className="text-lg">Proof of Work Approval</CardTitle>
                    <CardDescription>Please review the proof of work for your customized item. Approve to continue or reject with feedback.</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Placeholder for actual proof image */}
                    <div className="relative w-full aspect-video bg-muted-foreground/10 rounded-md overflow-hidden flex items-center justify-center">
                       <ImageIcon className="h-12 w-12 text-muted-foreground/50"/>
                       <p className="absolute bottom-2 text-xs text-muted-foreground">Proof image will be shown here</p>
                    </div>
                </CardContent>
                <CardFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={() => handleProofOfWorkApproval(true)} disabled={isUpdating} className="w-full sm:w-auto"><ThumbsUp className="mr-2 h-4 w-4"/> Approve Proof</Button>
                    <Button onClick={() => setIsRejectModalOpen(true)} variant="destructive" disabled={isUpdating} className="w-full sm:w-auto"><ThumbsDown className="mr-2 h-4 w-4"/> Reject Proof</Button>
                </CardFooter>
            </Card>
          )}

          {canConfirmDelivery && (
             <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                    <CardTitle className="text-lg">Confirm Your Delivery</CardTitle>
                    <CardDescription>Please confirm if you have received your order in good condition.</CardDescription>
                </CardHeader>
                <CardFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={handleAcceptDelivery} disabled={isUpdating} className="w-full sm:w-auto"><ThumbsUp className="mr-2 h-4 w-4"/> Accept Delivery</Button>
                    <Button onClick={() => setIsRejectModalOpen(true)} variant="destructive" disabled={isUpdating} className="w-full sm:w-auto"><ThumbsDown className="mr-2 h-4 w-4"/> Reject Delivery</Button>
                </CardFooter>
            </Card>
          )}

          {(!isGiftRecipientView || (order.isGift && order.giftDetails?.showPricesToRecipient)) && (
            <div>
                <h4 className="font-semibold mb-2">Order Summary:</h4>
                <ul className="space-y-1 text-sm">
                {order.items.map((item, index) => (
                    <li key={`order-item-${item.productId}-${index}`} className="flex justify-between">
                    <span>{item.name} (x{item.quantity})</span>
                    <span>{formatPrice(item.price * item.quantity)}</span>
                    </li>
                ))}
                <li className="flex justify-between border-t pt-1 mt-1">
                    <span>Shipping</span>
                    <span>{formatPrice(order.shippingCost)}</span>
                </li>
                <li className="flex justify-between font-bold text-md border-t pt-1 mt-1">
                    <span>Total</span>
                    <span>{formatPrice(order.totalAmount)}</span>
                </li>
                </ul>
            </div>
          )}
          
           {!isGiftRecipientView && order.isGift && order.giftDetails && (
             <div>
                <h4 className="font-semibold mb-1 flex items-center"><Gift className="h-4 w-4 mr-2 text-primary"/>Gift Recipient Details:</h4>
                <p className="text-sm">Name: {order.giftDetails.recipientName}</p>
                {order.giftDetails.notifyRecipient && <p className="text-sm">Contact: {order.giftDetails.recipientContactValue} ({order.giftDetails.recipientContactMethod})</p>}
             </div>
           )}

          {order.shippingAddress && (
            <div>
              <h4 className="font-semibold mb-1 flex items-center"><MapPin className="h-4 w-4 mr-2 text-primary"/>Shipping To:</h4>
              <p className="text-sm">{order.shippingAddress.fullName}</p>
              <p className="text-sm">{order.shippingAddress.addressLine1}, {order.shippingAddress.city}</p>
            </div>
          )}

          {order.estimatedDeliveryTime && order.status !== 'delivered' && (
            <div>
              <h4 className="font-semibold mb-1 flex items-center"><Clock className="h-4 w-4 mr-2 text-primary"/>Estimated Delivery:</h4>
              <p className="text-sm">{formatDate(order.estimatedDeliveryTime)}</p>
            </div>
          )}

          {order.deliveryHistory && order.deliveryHistory.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Delivery History:</h4>
              <ul className="space-y-2 text-xs">
                {order.deliveryHistory.slice().reverse().map((entry, index) => (
                  <li key={`history-item-${index}`} className="pb-2 border-b last:border-b-0">
                    <p className="font-medium capitalize">{entry.status.replace(/_/g, ' ')} - {formatDate(entry.timestamp)}</p>
                    {entry.notes && <p className="text-muted-foreground pl-2">- {entry.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(canRateOrder || hasBeenRated) && (
            <Card className="mt-6 bg-muted/50">
              <CardHeader><CardTitle className="text-lg flex items-center"><MessageSquare className="mr-2 h-5 w-5 text-primary"/>{hasBeenRated ? "Your Feedback" : "Rate Your Order"}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center space-x-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (<Button key={star} variant={selectedRating >= star ? "default" : "outline"} size="icon" onClick={() => !hasBeenRated && setSelectedRating(star)} disabled={hasBeenRated || isSubmittingFeedback} className="rounded-full"><Star className={`h-5 w-5 ${selectedRating >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} /><span className="sr-only">{star} star</span></Button>))}
                </div>
                <Textarea value={comment} onChange={(e) => !hasBeenRated && setComment(e.target.value)} placeholder="Optional: Tell us more..." rows={3} disabled={hasBeenRated || isSubmittingFeedback} />
              </CardContent>
              {!hasBeenRated && (<CardFooter><Button onClick={handleFeedbackSubmit} disabled={isSubmittingFeedback || selectedRating === 0}>{isSubmittingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Feedback</Button></CardFooter>)}
              {hasBeenRated && order.rating?.ratedAt && (<CardFooter className="text-xs text-muted-foreground">Thank you for your feedback submitted on {formatDate(order.rating.ratedAt)}.</CardFooter>)}
            </Card>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            {canDownloadReceipt && (<Link href={`/orders/receipt/${order.id}`} passHref><Button variant="outline"><Download className="mr-2 h-4 w-4"/> Receipt</Button></Link>)}
            <Link href={isGiftRecipientView ? "/" : "/products"} passHref><Button variant={canDownloadReceipt ? "outline" : "default"}><ShoppingBag className="mr-2 h-4 w-4"/> {isGiftRecipientView ? "Explore Gifts" : "Continue Shopping"}</Button></Link>
            {isOrderMutable && !isGiftRecipientView && <Button variant="destructive" size="sm" onClick={handleCancelOrder} disabled={isUpdating}><XCircle className="mr-2 h-4 w-4" /> Cancel Order</Button>}
          </div>
        </CardContent>
      </Card>
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Delivery or Proof</DialogTitle>
                <DialogDescription>Please provide a reason for the rejection. This will be sent to our team.</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-1">
                <Label htmlFor="rejectionReason">Reason</Label>
                <Textarea 
                    id="rejectionReason" 
                    value={rejectionReason} 
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder={canApproveProof ? "e.g., The engraving text is incorrect, please change..." : "e.g., Item was damaged, wrong item received..."}
                />
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button 
                    onClick={() => canApproveProof ? handleProofOfWorkApproval(false) : handleRejectDelivery()} 
                    disabled={!rejectionReason.trim() || isUpdating} 
                    variant="destructive"
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Rejection
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    );
  })()}
  </>
  );

  return (
    isGiftRecipientView ? (
      <div className="flex flex-col min-h-screen bg-muted/40">
        <MinimalHeader />
        <main className="flex-grow flex items-center justify-center p-4">
            {pageContent}
        </main>
        <MinimalFooter />
      </div>
    ) : (
      pageContent
    )
  );
}
