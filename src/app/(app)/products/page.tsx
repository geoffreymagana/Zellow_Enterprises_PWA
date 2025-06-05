
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { ShoppingCart, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // Added useSearchParams
import { useEffect, useState, useCallback, useMemo } from "react"; // Added useMemo
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext"; // Import useCart

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function ProductsPage() { 
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams(); // For local search
  const { toast } = useToast();
  const { cartTotalItems } = useCart(); // Get cart count

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchTerm = searchParams.get('q') || "";

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
      toast({ title: "Error Fetching Products", description: error.message || "Could not load items.", variant: "destructive" });
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
    if (role === 'Customer' && pathname === '/dashboard') { // Assuming pathname is available or use a different trigger
      router.replace('/products'); // Redirect customers from dashboard to products
    }
    fetchProducts();
  }, [authLoading, user, role, router, fetchProducts]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.categories?.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

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
          <Link href="/orders/cart" passHref className="hidden sm:inline-flex">
            <Button variant="outline">
              <ShoppingCart className="mr-2 h-4 w-4" /> 
              View Cart {cartTotalItems > 0 && `(${cartTotalItems})`}
            </Button>
          </Link>
        )}
      </div>
      
      <p className="text-muted-foreground">Browse our selection of customizable items.</p>

      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">
              {searchTerm ? "No Products Match Your Search" : "No Products Available Yet"}
            </p>
            <p className="text-muted-foreground">
              {searchTerm ? "Try a different search term." : "Check back soon for new arrivals!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {filteredProducts.map((product) => (
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
                        data-ai-hint={product.categories?.[0]?.toLowerCase().split(" ")[0] || product.name.split(" ")[0]?.toLowerCase() || "product item"}
                      />
                    </div>
                </CardHeader>
                <CardContent className="pt-3 pb-4 px-3 flex-grow flex flex-col justify-between">
                  <div>
                    <CardTitle className="text-base md:text-lg font-semibold mb-1 font-headline group-hover:text-primary transition-colors line-clamp-2">{product.name}</CardTitle>
                  </div>
                  <p className="text-lg md:text-xl font-bold text-primary mt-1">{formatPrice(product.price)}</p>
                </CardContent>
                 {product.stock > 0 && product.stock < 10 && (
                  <div className="px-3 pb-2 text-xs text-orange-500 font-medium">{product.stock} left in stock!</div>
                )}
                {product.stock === 0 && (
                  <div className="px-3 pb-2 text-xs text-destructive font-semibold">Out of stock</div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
