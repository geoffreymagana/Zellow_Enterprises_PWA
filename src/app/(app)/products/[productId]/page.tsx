
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, AlertTriangle, ShoppingCart, PlusCircle, ArrowLeft, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const productId = typeof params.productId === 'string' ? params.productId : null;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId || !db) {
      setError("Invalid product ID or database unavailable.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const productDocRef = doc(db, 'products', productId);
      const productDoc = await getDoc(productDocRef);

      if (productDoc.exists()) {
        setProduct({ id: productDoc.id, ...productDoc.data() } as Product);
      } else {
        setError("Item not found."); // Changed from Product to Item
        toast({ title: "Not Found", description: "The item you're looking for doesn't exist.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error fetching item:", e);
      setError("Failed to load item details. Please try again.");
      toast({ title: "Error", description: e.message || "Could not load item details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (productId) {
      fetchProduct();
    } else {
      setError("No item ID provided.");
      setIsLoading(false);
    }
  }, [authLoading, user, productId, router, fetchProduct]);

  if (isLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading item details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Item</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Item Not Found</h2>
        <p className="text-muted-foreground mb-4">The item you are looking for could not be found.</p>
        <Button onClick={() => router.push('/products')} variant="outline"> {/* Path remains /products */}
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gift Boxes 
        </Button>
      </div>
    );
  }

  const hasCustomizations = product.customizationOptions && product.customizationOptions.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button onClick={() => router.push('/products')} variant="outline" size="sm" className="mb-6"> {/* Path remains /products */}
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Gift Boxes
      </Button>
      <Card className="overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2">
            <div className="aspect-[4/3] relative w-full bg-muted">
              <Image
                src={product.imageUrl || 'https://placehold.co/800x600.png'}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain" 
                data-ai-hint={product.categories?.[0]?.toLowerCase().split(" ")[0] || product.name.split(" ")[0]?.toLowerCase() || "product detail"}
              />
            </div>
          </div>
          <div className="md:w-1/2 p-6 md:p-8 flex flex-col">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-3xl lg:text-4xl font-headline font-bold">{product.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-grow space-y-4">
              <p className="text-2xl lg:text-3xl font-bold text-primary">{formatPrice(product.price)}</p>
              <CardDescription className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                {product.description}
              </CardDescription>
              
              {product.stock > 0 && product.stock < 10 && (
                <p className="text-sm text-orange-500 mt-1">{product.stock} left in stock!</p>
              )}
              {product.stock === 0 && (
                <p className="text-sm text-destructive mt-1 font-semibold">Out of stock</p>
              )}

            </CardContent>
            <CardFooter className="p-0 mt-6 pt-6 border-t flex flex-col sm:flex-row gap-3">
              {hasCustomizations ? (
                <Link href={`/products/${product.id}/customize`} passHref className="w-full sm:w-auto"> {/* Path remains /products/.../customize */}
                  <Button size="lg" variant="outline" className="w-full" disabled={product.stock === 0}>
                    <Settings className="mr-2 h-5 w-5" /> Customize Item
                  </Button>
                </Link>
              ) : (
                <Button size="lg" variant="outline" className="w-full" disabled={true} title="No customization options available for this product">
                    <Settings className="mr-2 h-5 w-5" /> No Customizations
                </Button>
              )}
              <Button size="lg" className="w-full sm:w-auto" disabled={product.stock === 0}>
                <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
              </Button>
            </CardFooter>
          </div>
        </div>
      </Card>
    </div>
  );
}
