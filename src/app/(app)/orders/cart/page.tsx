
"use client";

import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, ArrowLeft, CreditCard, ImageIcon, ListOrdered, Palette, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Separator } from '@/components/ui/separator';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCustomizationOption, CustomizationGroupDefinition } from '@/types';


const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

interface ResolvedOptionDetails {
  label: string;
  value: string;
  isColor?: boolean;
  colorHex?: string;
}

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartSubtotal, cartTotalItems, loading: cartLoading } = useCart();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [resolvedProductOptionsMap, setResolvedProductOptionsMap] = useState<Map<string, ProductCustomizationOption[]>>(new Map());
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  const fetchAndResolveProductOptions = useCallback(async () => {
    if (!db || cartItems.length === 0) {
      setResolvedProductOptionsMap(new Map());
      setIsLoadingOptions(false);
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
          console.error(`Failed to fetch options for product ${item.productId} in cart:`, error);
        }
      }
    });
    await Promise.all(promises);
    setResolvedProductOptionsMap(newMap);
    setIsLoadingOptions(false);
  }, [cartItems]);

  useEffect(() => {
    if(!cartLoading){
        fetchAndResolveProductOptions();
    }
  }, [cartItems, cartLoading, fetchAndResolveProductOptions]);
  
  const getDisplayableCustomizationValue = (
    optionId: string,
    selectedValue: any,
    optionsDefinitions?: ProductCustomizationOption[]
  ): ResolvedOptionDetails => {
    const optionDef = optionsDefinitions?.find(opt => opt.id === optionId);
    if (!optionDef) return { label: optionId.replace(/_/g, ' '), value: String(selectedValue) }; // Fallback to old display

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
        displayValue = "Uploaded Image";
        break;
      case 'checkbox':
        displayValue = selectedValue ? (optionDef.checkboxLabel || 'Selected') : 'Not selected';
        break;
      case 'checkbox_group':
        if (Array.isArray(selectedValue) && optionDef.choices) {
            displayValue = selectedValue.map(val => optionDef.choices?.find(c => c.value === val)?.label || val).join(', ');
        }
        break;
      default: // text
        displayValue = String(selectedValue);
    }
    return { label: optionDef.label, value: displayValue, isColor, colorHex };
  };

  if (authLoading || cartLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading cart...</div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }
  
  return (
    <div className="container mx-auto px-0 sm:px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-headline font-semibold">Your Cart</h1>
            <Button variant="outline" onClick={() => router.push('/products')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Continue Shopping
            </Button>
          </div>

          {cartItems.length === 0 ? (
            <Card>
              <CardContent className="pt-10 pb-10 text-center">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-xl font-semibold">Your cart is empty.</p>
                <p className="text-muted-foreground mt-2">Looks like you haven't added anything to your cart yet.</p>
                <div className="mt-6">
                  <Link href="/orders" passHref>
                    <Button variant="outline">
                      <ListOrdered className="mr-2 h-4 w-4" /> My Orders
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul role="list" className="divide-y divide-border">
                  {cartItems.map((item) => {
                    const itemOptionDefinitions = resolvedProductOptionsMap.get(item.cartItemId);
                    return (
                    <li key={item.cartItemId} className="flex flex-col sm:flex-row py-6 px-4 sm:px-6">
                      <div className="flex-shrink-0">
                        <Image
                          src={item.imageUrl || 'https://placehold.co/100x100.png'}
                          alt={item.name}
                          width={100}
                          height={100}
                          className="w-24 h-24 sm:w-32 sm:h-32 rounded-md object-cover bg-muted"
                          data-ai-hint="product in cart"
                        />
                      </div>

                      <div className="ml-0 sm:ml-6 mt-4 sm:mt-0 flex flex-1 flex-col justify-between">
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h3 className="text-lg font-semibold font-headline">
                              <Link href={`/products/${item.productId}`} className="hover:text-primary">{item.name}</Link>
                            </h3>
                            <p className="ml-4 text-lg font-semibold text-primary">{formatPrice(item.currentPrice * item.quantity)}</p>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">Unit Price: {formatPrice(item.currentPrice)}</p>
                          {item.customizations && Object.keys(item.customizations).length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              {isLoadingOptions ? (
                                <div className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/><span>Loading details...</span></div>
                              ) : (
                                Object.entries(item.customizations).map(([optionId, selectedValue]) => {
                                  const details = getDisplayableCustomizationValue(optionId, selectedValue, itemOptionDefinitions);
                                  return (
                                    <div key={optionId} className="flex items-start gap-1.5">
                                      <span className="font-medium text-foreground/80">{details.label}:</span>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {details.isColor && details.colorHex && (
                                          <span style={{ backgroundColor: details.colorHex }} className="inline-block w-3 h-3 rounded-sm border border-muted-foreground mr-1"></span>
                                        )}
                                        {optionId.toLowerCase().includes('image') && typeof selectedValue === 'string' && (() => {
                                            try {
                                                const url = new URL(selectedValue);
                                                const host = url.host;
                                                return host === 'res.cloudinary.com' || host.endsWith('.res.cloudinary.com');
                                            } catch (e) {
                                                return false;
                                            }
                                        })() ? (
                                            <a href={String(selectedValue)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center">
                                                <ImageIcon className="h-3 w-3 mr-1" /> View Image
                                            </a>
                                        ) : (
                                            <span className="text-muted-foreground">{details.value}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex items-center border rounded-md">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)} disabled={item.quantity <= 1}>
                              <MinusCircle className="h-4 w-4" />
                            </Button>
                            <span className="px-3 text-sm font-medium w-10 text-center">{item.quantity}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)} disabled={item.quantity >= item.stock}>
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/80" onClick={() => removeFromCart(item.cartItemId)}>
                            <Trash2 className="h-4 w-4 mr-1 sm:mr-2" /> Remove
                          </Button>
                        </div>
                      </div>
                    </li>
                  )})}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="lg:w-1/3">
            <Card className="sticky top-24 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl font-headline">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Subtotal ({cartTotalItems} items)</span>
                  <span>{formatPrice(cartSubtotal)}</span>
                </div>
                 <p className="text-xs text-muted-foreground">Shipping costs and final total will be calculated at checkout.</p>
              </CardContent>
              <CardFooter>
                <Button size="lg" className="w-full" onClick={() => router.push('/checkout/shipping')}>
                  <CreditCard className="mr-2 h-5 w-5" /> Proceed to Checkout
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
