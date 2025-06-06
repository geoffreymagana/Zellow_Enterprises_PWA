
"use client";

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderItem, OrderStatus, DeliveryHistoryEntry, GiftDetails } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PackageCheck, Gift } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function ReviewOrderPage() {
  const { user } = useAuth();
  const { 
    cartItems, 
    shippingAddress, 
    paymentMethod, 
    cartSubtotal, 
    clearCart,
    selectedShippingMethodInfo,
    isGiftOrder,
    giftRecipientName,
    giftRecipientContactMethod,
    giftRecipientContactValue,
    giftMessage,
    notifyRecipient,
    showPricesToRecipient,
    giftRecipientCanViewAndTrack
  } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const shippingCost = selectedShippingMethodInfo?.cost || 0;
  const orderTotal = cartSubtotal + shippingCost;

  useEffect(() => {
    if (!shippingAddress || !paymentMethod || !selectedShippingMethodInfo || cartItems.length === 0) {
      if (cartItems.length === 0) {
        router.replace('/orders/cart');
      } else if (!shippingAddress) {
        router.replace('/checkout/shipping');
      } else if (!selectedShippingMethodInfo || !paymentMethod) {
        router.replace('/checkout/payment');
      }
      toast({ title: "Missing Information", description: "Please complete all previous steps.", variant: "destructive" });
    }
  }, [shippingAddress, paymentMethod, selectedShippingMethodInfo, cartItems, router, toast]);

  const handlePlaceOrder = async () => {
    if (!user || !shippingAddress || !paymentMethod || cartItems.length === 0 || !selectedShippingMethodInfo) {
      toast({ title: "Error", description: "Missing order details. Please review your cart and shipping info.", variant: "destructive" });
      return;
    }
    setIsPlacingOrder(true);

    const orderItems: OrderItem[] = cartItems.map(item => ({
      productId: item.productId,
      name: item.name,
      price: item.currentPrice,
      quantity: item.quantity,
      imageUrl: item.imageUrl || null,
      customizations: item.customizations || null,
    }));

    const initialDeliveryHistoryEntry: DeliveryHistoryEntry = {
      status: 'pending',
      timestamp: Timestamp.now(), 
      notes: 'Order placed by customer.',
      actorId: user.uid,
    };

    let giftDetailsToSave: GiftDetails | null = null;
    if (isGiftOrder) {
      giftDetailsToSave = {
        recipientName: giftRecipientName,
        recipientContactMethod: giftRecipientContactMethod,
        recipientContactValue: giftRecipientContactValue,
        giftMessage: giftMessage || undefined, 
        notifyRecipient: notifyRecipient,
        showPricesToRecipient: notifyRecipient ? showPricesToRecipient : false, 
        recipientCanViewAndTrack: notifyRecipient ? giftRecipientCanViewAndTrack : false,
      };
    }

    const currentPaymentStatus = (paymentMethod === 'mpesa' || paymentMethod === 'card') ? 'paid' : 'pending';

    const newOrder: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      customerId: user.uid,
      customerName: shippingAddress.fullName,
      customerEmail: shippingAddress.email || user.email || "",
      customerPhone: shippingAddress.phone,
      items: orderItems,
      subTotal: cartSubtotal,
      shippingCost: selectedShippingMethodInfo.cost,
      totalAmount: orderTotal,
      status: 'pending' as OrderStatus, 
      shippingAddress: shippingAddress,
      paymentMethod: paymentMethod,
      paymentStatus: currentPaymentStatus,
      shippingMethodId: selectedShippingMethodInfo.id,
      shippingMethodName: selectedShippingMethodInfo.name,
      deliveryHistory: [initialDeliveryHistoryEntry],
      deliveryId: null,
      riderId: null,
      riderName: null,
      deliveryCoordinates: null, 
      deliveryNotes: shippingAddress.addressLine2 || null,
      color: null,
      estimatedDeliveryTime: null, 
      actualDeliveryTime: null,
      transactionId: null,
      isGift: isGiftOrder,
      giftDetails: giftDetailsToSave,
    };

    try {
      const ordersCollectionRef = collection(db, 'orders');
      const newOrderRef = await addDoc(ordersCollectionRef, {
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (cartItems.some(item => item.stock !== undefined && item.quantity !== undefined)) {
        const batch = writeBatch(db);
        cartItems.forEach(item => {
          if (item.stock !== undefined && item.quantity !== undefined) { 
            const productRef = doc(db, 'products', item.productId);
            batch.update(productRef, { stock: item.stock - item.quantity });
          }
        });
        await batch.commit();
      }
      
      toast({ title: "Order Placed!", description: `Your order #${newOrderRef.id.substring(0, 8)}... has been successfully placed.` });
      clearCart();
      router.push(`/checkout/success/${newOrderRef.id}`);
    } catch (error: any) {
      console.error("Error placing order:", error);
      toast({ title: "Order Placement Failed", description: error.message || "Could not place your order. Please try again.", variant: "destructive" });
      setIsPlacingOrder(false);
    }
  };
  
  if (!shippingAddress || !paymentMethod || !selectedShippingMethodInfo) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-2">Loading order details or redirecting...</p>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Review Your Order</CardTitle>
          <CardDescription>Please check your order details below before placing your order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <h3 className="text-lg font-semibold mb-3">Shipping To:</h3>
            <Card className="bg-muted/50 p-4">
              <p><strong>{shippingAddress.fullName}</strong> ({shippingAddress.email})</p>
              <p>{shippingAddress.addressLine1}</p>
              {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
              <p>{shippingAddress.city}, {shippingAddress.county} {shippingAddress.postalCode}</p>
              <p>Phone: {shippingAddress.phone}</p>
              <Link href="/checkout/shipping" className="text-sm text-primary hover:underline mt-2 inline-block">Edit Shipping Address</Link>
            </Card>
          </section>

          {isGiftOrder && giftDetailsToSave && (
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center"><Gift className="mr-2 h-5 w-5 text-primary"/>Gift Details:</h3>
              <Card className="bg-muted/50 p-4 text-sm">
                <p>This order is a gift for: <strong>{giftDetailsToSave.recipientName}</strong></p>
                {giftDetailsToSave.notifyRecipient && giftDetailsToSave.recipientContactValue && (
                  <>
                    <p>Recipient will be notified via {giftDetailsToSave.recipientContactMethod}: {giftDetailsToSave.recipientContactValue}</p>
                    {giftDetailsToSave.giftMessage && <p>Message: <em>"{giftDetailsToSave.giftMessage}"</em></p>}
                    <p>Prices {giftDetailsToSave.showPricesToRecipient ? "will" : "will NOT"} be shown in the notification.</p>
                    <p>Recipient {giftDetailsToSave.recipientCanViewAndTrack ? "CAN" : "CANNOT"} view order details & track the gift.</p>
                  </>
                )}
                {!giftDetailsToSave.notifyRecipient && <p>Recipient will not be notified directly by us.</p>}
                <Link href="/checkout/shipping" className="text-sm text-primary hover:underline mt-2 inline-block">Edit Gift Details</Link>
              </Card>
            </section>
          )}

          <section>
            <h3 className="text-lg font-semibold mb-3">Shipping Method:</h3>
            <Card className="bg-muted/50 p-4">
                <p className="font-semibold">{selectedShippingMethodInfo.name} ({selectedShippingMethodInfo.duration})</p>
                <p>Cost: {formatPrice(selectedShippingMethodInfo.cost)}</p>
                <Link href="/checkout/payment" className="text-sm text-primary hover:underline mt-2 inline-block">Change Shipping Method</Link>
            </Card>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Payment Method:</h3>
            <Card className="bg-muted/50 p-4">
              <p className="capitalize">
                {paymentMethod === 'cod' && 'Pay on Delivery'}
                {paymentMethod === 'mpesa' && 'M-Pesa (Paybill/Till)'}
                {paymentMethod === 'card' && 'Credit/Debit Card'}
              </p>
              <Link href="/checkout/payment" className="text-sm text-primary hover:underline mt-2 inline-block">Change Payment Method</Link>
            </Card>
          </section>

          <section>
            <h3 className="text-lg font-semibold mb-3">Items in Your Order:</h3>
            <ul role="list" className="divide-y divide-border border rounded-md">
              {cartItems.map((item) => (
                <li key={item.cartItemId} className="flex py-4 px-4 items-center">
                  <Image
                    src={item.imageUrl || 'https://placehold.co/64x64.png'}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-md object-cover mr-4 bg-muted"
                    data-ai-hint="checkout review item"
                  />
                  <div className="flex-grow">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity} x {formatPrice(item.currentPrice)}</p>
                    {item.customizations && Object.keys(item.customizations).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(item.customizations).map(([key, value]) => (
                            <span key={key} className="block capitalize">{key.replace(/_/g, ' ')}: {String(value)}</span>
                        ))}
                        </div>
                    )}
                  </div>
                  <p className="font-semibold">{formatPrice(item.currentPrice * item.quantity)}</p>
                </li>
              ))}
            </ul>
             <Link href="/orders/cart" className="text-sm text-primary hover:underline mt-3 inline-block">Edit Cart</Link>
          </section>
          
          <section className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping ({selectedShippingMethodInfo.name})</span>
                  <span>{formatPrice(shippingCost)}</span>
                </div>
                <Separator className="my-2"/>
                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>{formatPrice(orderTotal)}</span>
                </div>
            </div>
          </section>

        </CardContent>
        <CardFooter>
          <Button size="lg" className="w-full" onClick={handlePlaceOrder} disabled={isPlacingOrder}>
            {isPlacingOrder ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackageCheck className="mr-2 h-5 w-5" />}
            {isPlacingOrder ? "Placing Order..." : "Place Order & Pay"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

