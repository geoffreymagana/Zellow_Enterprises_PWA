
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { PlusCircle, ShoppingCart, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

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
      // Assuming products collection has an 'active' field or similar for customer visibility
      // For now, fetching all products. Add 'where("active", "==", true)' if applicable.
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
    if (role && role !== 'Customer') {
      router.replace('/dashboard');
      return;
    }
    if (role === 'Customer') {
      fetchProducts();
    }
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
  
  if (role !== 'Customer' && !authLoading) { // Additional check after loading in case role changes
    return <div className="text-center py-10">Access denied. This page is for customers only.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Our Products</h1>
        <Link href="/orders/cart" passHref>
           <Button variant="outline">
            <ShoppingCart className="mr-2 h-4 w-4" /> View Cart (0)
          </Button>
        </Link>
      </div>
      
      <p className="text-muted-foreground">Browse our collection and customize your items.</p>

      {products.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">No Products Available Yet</p>
            <p className="text-muted-foreground">Check back soon for new arrivals!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 group">
              <CardHeader className="p-0">
                <Link href={`/products/${product.id}`} passHref>
                  <div className="aspect-[4/3] relative w-full bg-muted overflow-hidden">
                    <Image 
                      src={product.imageUrl || 'https://placehold.co/600x400.png'} 
                      alt={product.name} 
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      data-ai-hint={product.dataAiHint || product.categories?.[0] || product.name.split(" ")[0]?.toLowerCase() || "gift item"}
                    />
                  </div>
                </Link>
              </CardHeader>
              <CardContent className="pt-4 flex-grow">
                <Link href={`/products/${product.id}`} passHref>
                    <CardTitle className="text-lg font-semibold mb-1 font-headline hover:text-primary transition-colors">{product.name}</CardTitle>
                </Link>
                <CardDescription className="text-sm text-muted-foreground mb-2 h-10 line-clamp-2">{product.description}</CardDescription>
                <p className="text-xl font-bold text-primary">Ksh {product.price.toFixed(2)}</p>
                {product.stock < 10 && product.stock > 0 && (
                  <p className="text-xs text-orange-500 mt-1">Only {product.stock} left in stock!</p>
                )}
                {product.stock === 0 && (
                  <p className="text-xs text-destructive mt-1">Out of stock</p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between items-center p-4 gap-2">
                <Link href={`/products/${product.id}/customize`} passHref className="w-full sm:w-auto">
                  <Button size="sm" variant="outline" className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> Customize
                  </Button>
                </Link>
                <Button size="sm" className="w-full sm:w-auto" disabled={product.stock === 0}>
                  <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

    