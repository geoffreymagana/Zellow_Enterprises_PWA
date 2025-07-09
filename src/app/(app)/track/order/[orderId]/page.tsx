
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import { doc, onSnapshot, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, DeliveryHistoryEntry, OrderStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Package, ShoppingBag, Truck, CheckCircle, MapPin, Clock, Star, MessageSquare, Home, Download } from 'lucide-react'; // Added Home, Download
import Link from 'next/link';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth'; 
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Logo } from '@/components/common/Logo'; // For minimal header

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
    case 'pending': return 'statusYellow';
    case 'processing': return 'statusAmber';
    case 'awaiting_assignment': return 'statusOrange';
    case 'assigned': return 'statusOrderAssigned';
    case 'out_for_delivery': return 'statusBlue';
    case 'shipped': return 'statusIndigo';
    case 'delivered': return 'statusGreen';
    case 'delivery_attempted': return 'statusPurple';
    case 'cancelled': return 'statusRed';
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
  const searchParams = useSearchParams(); // For reading query parameters
  const { user } = useAuth(); 
  const { toast } = useToast();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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

  if (loading) {
    const loadingContent = (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading order tracking information...</p>
      </div>
    );
    if (isGiftRecipientView) {
      return (
        <div className="flex flex-col min-h-screen bg-muted/40">
          <MinimalHeader />
          <main className="flex-grow">{loadingContent}</main>
          <MinimalFooter />
        </div>
      );
    }
    return loadingContent; // Render within main app layout if not gift recipient
  }

  if (error && !order) { 
    const errorContent = (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Tracking Unavailable</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        {isGiftRecipientView ? (
          <p className="text-sm text-muted-foreground">If you believe this is an error, please contact the sender.</p>
        ) : (
          <Button onClick={() => router.push('/')} variant="outline">
            Go to Homepage
          </Button>
        )}
      </div>
    );
    if (isGiftRecipientView) {
      return (
        <div className="flex flex-col min-h-screen bg-muted/40">
          <MinimalHeader />
          <main className="flex-grow">{errorContent}</main>
          <MinimalFooter />
        </div>
      );
    }
    return errorContent;
  }
  
  if (!order) { 
     const noOrderContent = (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-6">Order details could not be loaded.</p>
        {isGiftRecipientView ? (
          <p className="text-sm text-muted-foreground">Please check the link or contact the sender.</p>
        ) : (
          <Button onClick={() => router.push('/')} variant="outline">Go to Homepage</Button>
        )}
      </div>
    );
    if (isGiftRecipientView) {
      return (
        <div className="flex flex-col min-h-screen bg-muted/40">
          <MinimalHeader />
          <main className="flex-grow">{noOrderContent}</main>
          <MinimalFooter />
        </div>
      );
    }
    return noOrderContent;
  }

  const currentStatusEntry = order.deliveryHistory && order.deliveryHistory.length > 0 
    ? order.deliveryHistory[order.deliveryHistory.length - 1] 
    : { status: order.status, timestamp: order.updatedAt || order.createdAt, notes: 'Order status updated.' };

  const canRateOrder = !isGiftRecipientView && user && order.customerId === user.uid && order.status === 'delivered' && !order.rating;
  const hasBeenRated = !isGiftRecipientView && user && order.customerId === user.uid && !!order.rating;
  const canDownloadReceipt = !isGiftRecipientView && order.status === 'delivered';


  if (isGiftRecipientView && order.status === 'delivered') {
    return (
      <div className="flex flex-col min-h-screen bg-muted/40">
        <MinimalHeader />
        <main className="flex-grow flex items-center justify-center p-4">
            <Card className="shadow-lg max-w-md w-full text-center">
            <CardHeader>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
                <CardTitle className="text-2xl font-headline">Your Gift Has Been Delivered!</CardTitle>
                <CardDescription>Order ID: {order.id.substring(0,12)}...</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">We hope you enjoy your special gift from {order.giftDetails?.recipientName || order.senderName || "your sender"}!</p>
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
        </main>
        <MinimalFooter />
      </div>
    );
  }
  
  const trackingContent = (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          {order.status === 'delivered' ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
          ) : (
            <Truck className="h-16 w-16 text-primary mx-auto mb-3" />
          )}
          <CardTitle className="text-2xl font-headline">
            Order Tracking
          </CardTitle>
          <CardDescription>
            Order ID: <span className="font-semibold text-primary">{order.id.substring(0, 12)}...</span>
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
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5 text-primary"/>
                  {hasBeenRated ? "Your Feedback" : "Rate Your Order"}
                </CardTitle>
                {!hasBeenRated && <CardDescription>Let us know how we did with order {order.id.substring(0,8)}...</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      variant={selectedRating >= star ? "default" : "outline"}
                      size="icon"
                      onClick={() => !hasBeenRated && setSelectedRating(star)}
                      disabled={hasBeenRated || isSubmittingFeedback}
                      className="rounded-full"
                    >
                      <Star className={`h-5 w-5 ${selectedRating >= star ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                      <span className="sr-only">{star} star</span>
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={comment}
                  onChange={(e) => !hasBeenRated && setComment(e.target.value)}
                  placeholder="Optional: Tell us more about your experience..."
                  rows={3}
                  disabled={hasBeenRated || isSubmittingFeedback}
                />
              </CardContent>
              {!hasBeenRated && (
                <CardFooter>
                  <Button onClick={handleFeedbackSubmit} disabled={isSubmittingFeedback || selectedRating === 0}>
                    {isSubmittingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Feedback
                  </Button>
                </CardFooter>
              )}
              {hasBeenRated && order.rating?.ratedAt && (
                <CardFooter className="text-xs text-muted-foreground">
                   Thank you for your feedback submitted on {formatDate(order.rating.ratedAt)}.
                </CardFooter>
              )}
            </Card>
          )}

          <div className="mt-6 text-center space-x-4">
            {canDownloadReceipt && (
                <Link href={`/orders/receipt/${order.id}`} passHref>
                    <Button variant="default">
                        <Download className="mr-2 h-4 w-4"/> Download Receipt
                    </Button>
                </Link>
            )}
            <Link href={isGiftRecipientView ? "/" : "/products"} passHref>
              <Button variant="outline">
                  {isGiftRecipientView ? <Home className="mr-2 h-4 w-4"/> : <ShoppingBag className="mr-2 h-4 w-4"/> }
                  {isGiftRecipientView ? "Zellow Home" : "Continue Shopping"}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (isGiftRecipientView) {
    return (
      <div className="flex flex-col min-h-screen bg-muted/40">
        <MinimalHeader />
        <main className="flex-grow">{trackingContent}</main>
        <MinimalFooter />
      </div>
    );
  }

  return trackingContent;
}
