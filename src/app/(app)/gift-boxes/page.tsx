
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { ShoppingCart, Loader2, AlertTriangle, Gift } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation"; // Added useSearchParams
import { useEffect, useState, useCallback, useMemo } from "react"; // Added useMemo
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext"; // Added useCart

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const GIFT_BOX_CATEGORY_KEY = "Gift Boxes"; 

export default function GiftBoxesPage() { 
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams(); // Added
  const { cartTotalItems } = useCart(); // Added

  const [allGiftBoxes, setAllGiftBoxes] = useState<Product[]>([]); // Renamed for clarity
  const [isLoadingGiftBoxes, setIsLoadingGiftBoxes] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchTerm = searchParams.get('q') || ""; // Get search term

  const fetchGiftBoxes = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Database service is not available.", variant: "destructive" });
      setIsLoadingGiftBoxes(false);
      setFetchError("Database service unavailable.");
      return;
    }
    setIsLoadingGiftBoxes(true);
    setFetchError(null);
    try {
      const productsQuery = query(
        collection(db, "products"), 
        where("categories", "array-contains", GIFT_BOX_CATEGORY_KEY),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(productsQuery);
      const fetchedGiftBoxes: Product[] = [];
      querySnapshot.forEach((doc) => {
        fetchedGiftBoxes.push({ id: doc.id, ...doc.data() } as Product);
      });
      setAllGiftBoxes(fetchedGiftBoxes); // Set all fetched gift boxes
    } catch (error: any) {
      console.error("Error fetching gift boxes:", error);
      toast({ title: "Error Fetching Gift Boxes", description: error.message || "Could not load gift boxes.", variant: "destructive" });
      setFetchError("Could not load gift boxes. Please try again later.");
    } finally {
      setIsLoadingGiftBoxes(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }
    fetchGiftBoxes();
  }, [authLoading, user, router, fetchGiftBoxes]);

  const filteredGiftBoxes = useMemo(() => { // Filtered list based on search term
    if (!searchTerm) return allGiftBoxes;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allGiftBoxes.filter(product =>
      product.name.toLowerCase().includes(lowerSearchTerm) ||
      product.categories?.some(cat => cat.toLowerCase().includes(lowerSearchTerm)) // Also search categories if needed
    );
  }, [allGiftBoxes, searchTerm]);

  if (authLoading || isLoadingGiftBoxes) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))] space-y-2">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading gift boxes...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold">Failed to Load Gift Boxes</p>
        <p className="text-muted-foreground mb-4">{fetchError}</p>
        <Button onClick={fetchGiftBoxes}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Our Special Gift Boxes</h1>
        {role === 'Customer' && (
          <Link href="/orders/cart" passHref className="hidden sm:inline-flex">
            <Button variant="outline">
              <ShoppingCart className="mr-2 h-4 w-4" /> 
              View Cart {cartTotalItems > 0 && `(${cartTotalItems})`}
            </Button>
          </Link>
        )}
      </div>
      
      <p className="text-muted-foreground">
         {searchTerm ? `Showing results for "${searchTerm}" in Gift Boxes` : "Beautifully curated gift boxes for every occasion."}
      </p>

      {filteredGiftBoxes.length === 0 ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl font-semibold mb-2">
                {searchTerm ? "No Gift Boxes Match Your Search" : "No Gift Boxes Available Yet"}
            </p>
            <p className="text-muted-foreground">
                {searchTerm ? "Try a different search term or browse all products." : "Our special gift box collections will appear here soon. Check back later!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {filteredGiftBoxes.map((product) => (
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
                        data-ai-hint={product.categories?.includes(GIFT_BOX_CATEGORY_KEY) ? "gift box" : (product.categories?.[0]?.toLowerCase().split(" ")[0] || product.name.split(" ")[0]?.toLowerCase() || "gift item")}
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
