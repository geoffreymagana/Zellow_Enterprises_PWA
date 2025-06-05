
"use client";

import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { Trash2, PlusCircle, MinusCircle, ShoppingCart, ArrowLeft, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Separator } from '@/components/ui/separator';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function CartPage() {
  const { cartItems, removeFromCart, updateQuantity, cartSubtotal, cartTotalItems, loading: cartLoading } = useCart();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const shippingCost = cartSubtotal > 0 ? 500 : 0; // Placeholder flat shipping rate
  const orderTotal = cartSubtotal + shippingCost;

  if (authLoading || cartLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading cart...</div>;
  }

  if (!user) {
    router.push('/login'); // Should be handled by AppLayout, but as a fallback
    return null;
  }

  return (
    <div className="container mx-auto px-0 sm:px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/3 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-headline font-semibold">Your Shopping Cart</h1>
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ul role="list" className="divide-y divide-border">
                  {cartItems.map((item) => (
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
                            <div className="mt-1 text-xs text-muted-foreground">
                              {Object.entries(item.customizations).map(([key, value]) => (
                                <span key={key} className="block capitalize">{key.replace(/_/g, ' ')}: {String(value)}</span>
                              ))}
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
                  ))}
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal ({cartTotalItems} items)</span>
                  <span>{formatPrice(cartSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Shipping</span>
                  <span>{formatPrice(shippingCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Order Total</span>
                  <span>{formatPrice(orderTotal)}</span>
                </div>
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
