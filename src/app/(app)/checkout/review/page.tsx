
"use client";

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, doc, writeBatch, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderItem, OrderStatus, DeliveryHistoryEntry, GiftDetails, Product, CustomizationGroupDefinition, ProductCustomizationOption, CartItem as CartItemType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PackageCheck, Gift, Image as ImageIconPlaceholder, Palette } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { sendGiftNotification, GiftNotificationInput } from '@/ai/flows/send-gift-notification-flow'; 
import { OrderSuccessModal } from '@/components/checkout/OrderSuccessModal'; 

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

interface ResolvedOptionDetails {
  label: string;
  value: string;
  isColor?: boolean;
  colorHex?: string;
}

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
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false); 
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null); 

  const [resolvedProductOptionsMap, setResolvedProductOptionsMap] = useState<Map<string, ProductCustomizationOption[]>>(new Map());
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const shippingCost = selectedShippingMethodInfo?.cost || 0;
  const orderTotal = cartSubtotal + shippingCost;

  const giftDetailsToSave = useMemo((): GiftDetails | null => {
    if (isGiftOrder) {
      return {
        recipientName: giftRecipientName,
        recipientContactMethod: giftRecipientContactMethod,
        recipientContactValue: giftRecipientContactValue,
        giftMessage: giftMessage || "", // Ensure empty string if not provided
        notifyRecipient: notifyRecipient,
        showPricesToRecipient: notifyRecipient ? showPricesToRecipient : false,
        recipientCanViewAndTrack: notifyRecipient ? giftRecipientCanViewAndTrack : true, 
      };
    }
    return null;
  }, [isGiftOrder, giftRecipientName, giftRecipientContactMethod, giftRecipientContactValue, giftMessage, notifyRecipient, showPricesToRecipient, giftRecipientCanViewAndTrack]);

  const fetchAndResolveProductOptions = useCallback(async () => {
    if (!db || cartItems.length === 0) {
      setResolvedProductOptionsMap(new Map()); 
      return;
    }
    setIsLoadingOptions(true);
    const newMap = new Map<string, ProductCustomizationOption[]>();
    const promises = cartItems.map(async (item) => {
      if (item.customizations && Object.keys(item.customizations).length > 0) {
        try {
          const productDocRef = doc(db, 'products', item.productId);
          const productDoc = await getDoc(productDocRef);
          if (productDoc.exists()) {
            const productData = productDoc.data() as Product;
            let optionsToUse: ProductCustomizationOption[] = productData.customizationOptions || [];
            if (productData.customizationGroupId) {
              const groupDocRef = doc(db, 'customizationGroupDefinitions', productData.customizationGroupId);
              const groupDoc = await getDoc(groupDocRef);
              if (groupDoc.exists()) {
                optionsToUse = (groupDoc.data() as CustomizationGroupDefinition).options || [];
              }
            }
            newMap.set(item.cartItemId, optionsToUse);
          }
        } catch (error) {
          console.error(`Failed to fetch options for product ${item.productId}:`, error);
        }
      }
    });
    await Promise.all(promises);
    setResolvedProductOptionsMap(newMap);
    setIsLoadingOptions(false);
  }, [cartItems, db]);

  useEffect(() => {
    fetchAndResolveProductOptions();
  }, [fetchAndResolveProductOptions]);


  useEffect(() => {
    if (!shippingAddress || !paymentMethod || !selectedShippingMethodInfo || cartItems.length === 0) {
      if (cartItems.length === 0 && !isSuccessModalOpen) { 
        router.replace('/orders/cart');
      } else if (!shippingAddress) {
        router.replace('/checkout/shipping');
      } else if (!selectedShippingMethodInfo || !paymentMethod) {
        router.replace('/checkout/payment');
      }
      // Removed the "Missing Information" toast here to avoid it firing when cart is legitimately cleared after order success.
      // The individual pages should handle their own validation toasts if a user tries to proceed without filling details.
    }
  }, [shippingAddress, paymentMethod, selectedShippingMethodInfo, cartItems, router, isSuccessModalOpen]);

  const getDisplayableCustomizationValue = (
    optionId: string, 
    selectedValue: any, 
    optionsDefinitions?: ProductCustomizationOption[]
  ): ResolvedOptionDetails => {
    const optionDef = optionsDefinitions?.find(opt => opt.id === optionId);
    if (!optionDef) return { label: optionId, value: String(selectedValue) };

    let displayValue = String(selectedValue);
    let isColor = false;
    let colorHex: string | undefined = undefined;

    switch (optionDef.type) {
      case 'dropdown':
        displayValue = optionDef.choices?.find(c => c.value === selectedValue)?.label || String(selectedValue);
        break;
      case 'color_picker':
        const colorChoice = optionDef.choices?.find(c => c.value === selectedValue);
        displayValue = colorChoice?.label || String(selectedValue);
        isColor = true;
        colorHex = colorChoice?.value;
        break;
      case 'image_upload':
        displayValue = selectedValue ? "Uploaded Image" : "No image";
        break;
      case 'checkbox':
        displayValue = selectedValue ? (optionDef.checkboxLabel || 'Selected') : 'Not selected';
        break;
      default: // text
        displayValue = String(selectedValue);
    }
    return { label: optionDef.label, value: displayValue, isColor, colorHex };
  };

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
      status: 'pending_finance_approval',
      timestamp: Timestamp.now(),
      notes: 'Order placed by customer and awaits finance approval.',
      actorId: user.uid,
    };
    
    const currentPaymentStatus = (paymentMethod === 'mpesa' || paymentMethod === 'card') ? 'paid' : 'pending';

    const newOrderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> = {
      customerId: user.uid,
      customerName: shippingAddress.fullName,
      customerEmail: shippingAddress.email || user.email || "",
      customerPhone: shippingAddress.phone,
      items: orderItems,
      subTotal: cartSubtotal,
      shippingCost: selectedShippingMethodInfo.cost,
      totalAmount: orderTotal,
      status: 'pending_finance_approval' as OrderStatus,
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
        ...newOrderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (cartItems.some(item => item.stock !== undefined && item.quantity !== undefined)) {
        const batch = writeBatch(db);
        cartItems.forEach(item => {
          if (item.stock !== undefined && item.quantity !== undefined && item.productId) {
            const productRef = doc(db, 'products', item.productId);
            batch.update(productRef, { stock: item.stock - item.quantity });
          }
        });
        await batch.commit();
      }

       if (isGiftOrder && notifyRecipient && giftDetailsToSave && giftDetailsToSave.recipientContactMethod && giftDetailsToSave.recipientContactValue) {
        try {
          const notificationInput: GiftNotificationInput = {
            orderId: newOrderRef.id,
            recipientName: giftDetailsToSave.recipientName,
            recipientContactMethod: giftDetailsToSave.recipientContactMethod,
            recipientContactValue: giftDetailsToSave.recipientContactValue,
            giftMessage: giftDetailsToSave.giftMessage,
            senderName: user.displayName || shippingAddress.fullName || "A friend",
            canViewAndTrack: giftDetailsToSave.recipientCanViewAndTrack,
            showPricesToRecipient: giftDetailsToSave.showPricesToRecipient,
          };
          await sendGiftNotification(notificationInput);
        } catch (notificationError: any) {
          console.error("Error sending gift notification:", notificationError);
          toast({ title: "Gift Notification Issue", description: "Order placed, but could not send gift notification: " + notificationError.message, variant: "destructive", duration: 7000 });
        }
      }

      // Critical: Set modal state BEFORE clearing cart
      setConfirmedOrderId(newOrderRef.id);
      setIsSuccessModalOpen(true);       
      clearCart(); 
      
      toast({ title: "Order Placed!", description: `Your order #${newOrderRef.id.substring(0,8)}... is confirmed.`, duration: 6000});

    } catch (error: any) {
      console.error("Error placing order:", error);
      toast({ title: "Order Placement Failed", description: error.message || "Could not place your order. Please try again.", variant: "destructive" });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (!shippingAddress || !paymentMethod || !selectedShippingMethodInfo || isLoadingOptions) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-2">Loading order details or redirecting...</p>
        </div>
    );
  }

  return (
    <>
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
                      <p>Prices {giftDetailsToSave.showPricesToRecipient ? "WILL" : "will NOT"} be shown in the notification.</p>
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
              {isLoadingOptions && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/> <p className="text-sm text-muted-foreground">Loading item details...</p></div>}
              {!isLoadingOptions && (
                <ul role="list" className="divide-y divide-border border rounded-md">
                  {cartItems.map((item: CartItemType) => {
                    const itemOptions = resolvedProductOptionsMap.get(item.cartItemId);
                    return (
                      <li key={item.cartItemId} className="flex py-4 px-4 items-start sm:items-center flex-col sm:flex-row">
                        <Image
                          src={item.imageUrl || 'https://placehold.co/64x64.png'}
                          alt={item.name}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-md object-cover mr-0 sm:mr-4 mb-2 sm:mb-0 bg-muted flex-shrink-0"
                          data-ai-hint="checkout review item"
                        />
                        <div className="flex-grow">
                          <p className="font-semibold">{item.name}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity} x {formatPrice(item.currentPrice)}</p>
                          {item.customizations && Object.keys(item.customizations).length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                              {Object.entries(item.customizations).map(([optionId, selectedValue]) => {
                                const details = getDisplayableCustomizationValue(optionId, selectedValue, itemOptions);
                                return (
                                  <div key={optionId} className="flex items-center gap-1">
                                    <span className="font-medium">{details.label}:</span> 
                                    {details.isColor && details.colorHex && (
                                      <span style={{ backgroundColor: details.colorHex }} className="inline-block w-3 h-3 rounded-full border border-muted-foreground mr-1"></span>
                                    )}
                                    <span>{details.value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <p className="font-semibold mt-2 sm:mt-0 text-right sm:text-left">{formatPrice(item.currentPrice * item.quantity)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
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
            <Button size="lg" className="w-full" onClick={handlePlaceOrder} disabled={isPlacingOrder || isLoadingOptions}>
              {isPlacingOrder ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PackageCheck className="mr-2 h-5 w-5" />}
              {isPlacingOrder ? "Placing Order..." : "Place Order & Pay"}
            </Button>
          </CardFooter>
        </Card>
      </div>
      <OrderSuccessModal
        isOpen={isSuccessModalOpen}
        onOpenChange={setIsSuccessModalOpen}
        orderId={confirmedOrderId}
      />
    </>
  );
}
