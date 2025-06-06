
"use client";

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PackageCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function ReviewOrderPage() {
  const { user } = useAuth();
  const { cartItems, shippingAddress, paymentMethod, cartSubtotal, clearCart } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const shippingCost = cartSubtotal > 0 ? 500 : 0; // Placeholder flat shipping rate
  const orderTotal = cartSubtotal + shippingCost;

  useEffect(() => {
    if (!shippingAddress || !paymentMethod || cartItems.length === 0) {
      router.replace('/checkout/shipping'); // Or cart if conditions not met
    }
  }, [shippingAddress, paymentMethod, cartItems, router]);

  const handlePlaceOrder = async () => {
    if (!user || !shippingAddress || !paymentMethod || cartItems.length === 0) {
      toast({ title: "Error", description: "Missing order details. Please review your cart and shipping info.", variant: "destructive" });
      return;
    }
    setIsPlacingOrder(true);

    const orderItems: OrderItem[] = cartItems.map(item => ({
      productId: item.productId,
      name: item.name,
      price: item.currentPrice,
      quantity: item.quantity,
      imageUrl: item.imageUrl || null, // Ensure undefined becomes null
      customizations: item.customizations || null, // Ensure undefined becomes null
    }));

    const newOrder: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      customerId: user.uid,
      customerName: shippingAddress.fullName,
      customerEmail: shippingAddress.email || user.email || "",
      customerPhone: shippingAddress.phone,
      items: orderItems,
      subTotal: cartSubtotal,
      shippingCost: shippingCost,
      totalAmount: orderTotal,
      status: 'pending' as OrderStatus, 
      shippingAddress: shippingAddress,
      paymentMethod: paymentMethod,
      paymentStatus: 'pending',
      // Optional fields not explicitly set here will be omitted from the document,
      // which is fine for Firestore (unlike 'undefined' values).
      // If a field should always exist, it should be explicitly set to null or a default.
      deliveryHistory: [], // Default to empty array
      deliveryId: null,
      riderId: null,
      riderName: null,
      deliveryCoordinates: null,
      deliveryNotes: null,
      color: null,
      estimatedDeliveryTime: null,
      actualDeliveryTime: null,
      transactionId: null,
    };

    try {
      const ordersCollectionRef = collection(db, 'orders');
      const newOrderRef = await addDoc(ordersCollectionRef, {
        ...newOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);
      cartItems.forEach(item => {
        if (item.stock !== undefined && item.quantity !== undefined) { // Check if stock and quantity are defined
          const productRef = doc(db, 'products', item.productId);
          batch.update(productRef, { stock: item.stock - item.quantity });
        }
      });
      await batch.commit();

      toast({ title: "Order Placed!", description: `Your order #${newOrderRef.id.substring(0, 8)} has been successfully placed.` });
      clearCart();
      router.push(`/checkout/success/${newOrderRef.id}`);
    } catch (error: any) {
      console.error("Error placing order:", error);
      toast({ title: "Order Placement Failed", description: error.message || "Could not place your order. Please try again.", variant: "destructive" });
      setIsPlacingOrder(false);
    }
  };
  
  if (!shippingAddress || !paymentMethod) {
    return <div className="text-center p-8">Loading order details or missing information...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Review Your Order</CardTitle>
          <CardDescription>Please check your order details below before placing your order.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Shipping Details Section */}
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

          {/* Payment Method Section */}
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

          {/* Order Items Section */}
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
          
          {/* Order Summary */}
          <section className="pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Order Summary</h3>
            <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
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
