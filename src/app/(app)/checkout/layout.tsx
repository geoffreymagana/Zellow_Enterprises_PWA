
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/contexts/CartContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const { cartItems, loading: cartLoading } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?redirect=/checkout/shipping");
    }
    if (!cartLoading && cartItems.length === 0) {
        // If cart is empty, redirect to cart page (which will show "empty cart") or products
        router.replace("/orders/cart"); 
    }
  }, [user, authLoading, cartItems, cartLoading, router]);

  if (authLoading || cartLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || cartItems.length === 0) {
    // This state should ideally be caught by useEffect redirects,
    // but as a fallback, show loading or a message.
    return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-background border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/orders/cart" className="flex items-center text-lg font-semibold font-headline text-primary hover:opacity-80 transition-opacity">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Cart
          </Link>
          <span className="text-xl font-bold font-headline">Checkout</span>
        </div>
      </header>
      <main className="py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-background">
        © {new Date().getFullYear()} Zellow Enterprises. Secure Checkout.
      </footer>
    </div>
  );
}
