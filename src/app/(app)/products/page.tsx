
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { ShoppingCart, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function ProductsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Database service is not available.", variant: "destructive" });
      setIsLoadingProducts(false);
      setFetchError("Database service unavailable.");
      return;
    }
    setIsLoadingProducts(true);
    setFetchError(null);
    try {
      const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(productsQuery);
      const fetchedProducts: Product[] = [];
      querySnapshot.forEach((doc) => {
        fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(fetchedProducts);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast({ title: "Error Fetching Products", description: error.message || "Could not load products.", variant: "destructive" });
      setFetchError("Could not load products. Please try again later.");
    } finally {
      setIsLoadingProducts(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }
    // This page is now primarily for customers, but Admins might want to see it too.
    // Other roles might be redirected from their dashboard if it points here.
    if (role && !['Customer', 'Admin'].includes(role)) {
        // Allow if navigated to directly, but dashboard for other roles won't point here by default.
    }
    fetchProducts();
  }, [authLoading, user, role, router, fetchProducts]);

  if (authLoading || isLoadingProducts) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))] space-y-2">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading products...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold">Failed to Load Products</p>
        <p className="text-muted-foreground mb-4">{fetchError}</p>
        <Button onClick={fetchProducts}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Discover Our Products</h1>
        {role === 'Customer' && (
          <Link href="/orders/cart" passHref>
            <Button variant="outline">
              <ShoppingCart className="mr-2 h-4 w-4" /> View Cart (0) {/* TODO: Implement cart count */}
            </Button>
          </Link>
        )}
      </div>
      
      <p className="text-muted-foreground">Browse our collection and find the perfect item.</p>

      {products.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">No Products Available Yet</p>
            <p className="text-muted-foreground">Check back soon for new arrivals!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/products/${product.id}`} passHref>
              <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 group h-full">
                <CardHeader className="p-0">
                    <div className="aspect-[4/3] relative w-full bg-muted overflow-hidden rounded-t-lg">
                      <Image 
                        src={product.imageUrl || 'https://placehold.co/600x400.png'} 
                        alt={product.name} 
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        data-ai-hint={product.categories?.[0]?.toLowerCase().split(" ")[0] || product.name.split(" ")[0]?.toLowerCase() || "gift item"}
                      />
                    </div>
                </CardHeader>
                <CardContent className="pt-3 pb-4 px-3 flex-grow flex flex-col justify-between">
                  <div>
                    <CardTitle className="text-base md:text-lg font-semibold mb-1 font-headline group-hover:text-primary transition-colors line-clamp-2">{product.name}</CardTitle>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-primary mt-1">{formatPrice(product.price)}</p>
                </CardContent>
                 {/* Stock information can be added here if desired, e.g., for low stock warnings */}
                 {product.stock < 10 && product.stock > 0 && (
                  <div className="px-3 pb-2 text-xs text-orange-500">Low stock!</div>
                )}
                {product.stock === 0 && (
                  <div className="px-3 pb-2 text-xs text-destructive">Out of stock</div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
