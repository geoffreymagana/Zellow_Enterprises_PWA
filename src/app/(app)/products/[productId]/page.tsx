
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCustomizationOption, CustomizationGroupDefinition } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, ShoppingCart, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function ProductDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const productId = typeof params.productId === 'string' ? params.productId : null;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const [fbtSuggestions, setFbtSuggestions] = useState<Product[]>([]);
  const [selectedFbtItems, setSelectedFbtItems] = useState<Set<string>>(new Set());
  const [isLoadingFbt, setIsLoadingFbt] = useState(false);


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
        let fetchedProductData = { id: productDoc.id, ...productDoc.data() } as Product;

        // If product has a customizationGroupId and no direct customizationOptions (or empty array),
        // fetch the group and use its options.
        if (fetchedProductData.customizationGroupId && (!fetchedProductData.customizationOptions || fetchedProductData.customizationOptions.length === 0)) {
          try {
            const groupDocRef = doc(db, 'customizationGroupDefinitions', fetchedProductData.customizationGroupId);
            const groupDoc = await getDoc(groupDocRef);
            if (groupDoc.exists()) {
              const groupData = groupDoc.data() as CustomizationGroupDefinition;
              fetchedProductData.customizationOptions = groupData.options as ProductCustomizationOption[];
            } else {
              console.warn(`Customization group ${fetchedProductData.customizationGroupId} not found for product ${fetchedProductData.id}`);
              // Ensure customizationOptions is an empty array if group not found, to avoid issues with .length later
              fetchedProductData.customizationOptions = [];
            }
          } catch (groupError) {
            console.error(`Error fetching customization group ${fetchedProductData.customizationGroupId}:`, groupError);
            fetchedProductData.customizationOptions = [];
          }
        } else if (!fetchedProductData.customizationOptions) {
          // Ensure customizationOptions is an empty array if null/undefined and no group ID
          fetchedProductData.customizationOptions = [];
        }
        setProduct(fetchedProductData);

      } else {
        setError("Item not found.");
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

  const fetchFBTSuggestions = useCallback(async () => {
    if (!product || !product.categories || product.categories.length === 0 || !db) {
      setFbtSuggestions([]);
      return;
    }
    setIsLoadingFbt(true);
    try {
      const q = query(
        collection(db, "products"),
        where("categories", "array-contains", product.categories[0]), // Use first category for suggestions
        where("id", "!=", product.id), // Exclude current product
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const querySnapshot = await getDocs(q);
      const suggestions: Product[] = [];
      querySnapshot.forEach((doc) => {
        suggestions.push({ id: doc.id, ...doc.data() } as Product);
      });
      setFbtSuggestions(suggestions);
    } catch (err) {
      console.error("Error fetching FBT suggestions:", err);
      // Optionally set an error state for FBT if needed
    } finally {
      setIsLoadingFbt(false);
    }
  }, [product]); // Depends on product state

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

  useEffect(() => {
    // Fetch FBT suggestions only after product data (and its categories) is available
    if (product && product.categories && product.categories.length > 0) {
      fetchFBTSuggestions();
    }
  }, [product, fetchFBTSuggestions]);


  const handleToggleFbtItem = (fbtProductId: string) => {
    setSelectedFbtItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fbtProductId)) {
        newSet.delete(fbtProductId);
      } else {
        newSet.add(fbtProductId);
      }
      return newSet;
    });
  };

  const handleMainAction = () => {
    if (!product) return;
    setIsAddingToCart(true);

    addToCart(product, 1, undefined, product.price); // Add main product (base price, no customizations)

    let fbtAddedCount = 0;
    selectedFbtItems.forEach(fbtId => {
      const fbtProduct = fbtSuggestions.find(p => p.id === fbtId);
      if (fbtProduct && fbtProduct.stock > 0) {
        addToCart(fbtProduct, 1, undefined, fbtProduct.price); 
        fbtAddedCount++;
      }
    });
    
    let description = `${product.name} added to cart.`;
    if (fbtAddedCount > 0) {
        description += ` ${fbtAddedCount} additional item(s) also added.`;
    }

    toast({ title: "Items Added", description });
    setSelectedFbtItems(new Set()); 
    
    setTimeout(() => {
        setIsAddingToCart(false);
        router.push('/orders/cart'); 
    }, 700);
  };

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
            Go Back
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
        <Button onClick={() => router.push('/products')} variant="outline">
            Back to Products
        </Button>
      </div>
    );
  }

  const hasCustomizations = product.customizationOptions && product.customizationOptions.length > 0;

  return (
    <div className="container mx-auto px-0 sm:px-4 py-8 pb-28">
      <Card className="overflow-hidden shadow-none sm:shadow-lg rounded-none sm:rounded-lg">
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
          <div className="md:w-1/2 p-4 sm:p-6 md:p-8 flex flex-col">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-2xl lg:text-3xl font-headline font-bold">{product.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-grow space-y-4">
              <p className="text-xl lg:text-2xl font-bold text-primary">{formatPrice(product.price)}</p>
              <CardDescription className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                {product.description}
              </CardDescription>
              
              {product.stock > 0 && product.stock < 10 && (
                <p className="text-sm text-orange-500 font-medium mt-1">{product.stock} left in stock!</p>
              )}
              {product.stock === 0 && (
                <p className="text-sm text-destructive mt-1 font-semibold">Out of stock</p>
              )}
            </CardContent>
          </div>
        </div>
      </Card>

      {isLoadingFbt ? (
        <div className="mt-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading suggestions...</p>
        </div>
      ) : fbtSuggestions.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Frequently Bought Together</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {fbtSuggestions.map(item => (
                <li key={item.id} className="flex items-center gap-3 p-2.5 border rounded-md hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id={`fbt-${item.id}`}
                    checked={selectedFbtItems.has(item.id)}
                    onCheckedChange={() => handleToggleFbtItem(item.id)}
                    disabled={item.stock === 0}
                  />
                  <Label htmlFor={`fbt-${item.id}`} className={`flex-grow cursor-pointer ${item.stock === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="relative w-12 h-12 bg-muted rounded-sm overflow-hidden flex-shrink-0">
                        <Image
                          src={item.imageUrl || 'https://placehold.co/48x48.png'}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                          data-ai-hint="related product"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        <p className="text-xs text-primary font-semibold">{formatPrice(item.price)}</p>
                        {item.stock === 0 && <p className="text-xs text-destructive">Out of stock</p>}
                      </div>
                    </div>
                  </Label>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 shadow-lg z-20 md:hidden">
        <div className="container mx-auto px-4 flex gap-3 items-center justify-center sm:justify-end">
          {hasCustomizations && (
            <Link href={`/products/${product.id}/customize`} passHref className="flex-1 sm:flex-none">
              <Button size="lg" variant="outline" className="w-full sm:w-auto" disabled={product.stock === 0}>
                Customize
              </Button>
            </Link>
          )}
          <Button
            size="lg"
            variant="default"
            className="flex-1 sm:flex-none w-full sm:w-auto"
            onClick={handleMainAction}
            disabled={product.stock === 0 || isAddingToCart}
          >
            {isAddingToCart ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Add to Cart
          </Button>
        </div>
      </div>
      <div className="hidden md:flex mt-8 pt-6 border-t justify-end gap-3">
        {hasCustomizations && (
            <Link href={`/products/${product.id}/customize`} passHref>
              <Button size="lg" variant="outline" disabled={product.stock === 0}>
                Customize
              </Button>
            </Link>
          )}
          <Button
            size="lg"
            variant="default"
            onClick={handleMainAction}
            disabled={product.stock === 0 || isAddingToCart}
          >
            {isAddingToCart ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
            Add to Cart
          </Button>
      </div>
    </div>
  );
}

    
