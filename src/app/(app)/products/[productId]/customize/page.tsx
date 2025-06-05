
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCustomizationOption, CustomizationChoiceOption } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { Loader2, AlertTriangle, ArrowLeft, ShoppingCart, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function CustomizeProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const productId = typeof params.productId === 'string' ? params.productId : null;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // Dynamically build Zod schema based on product customization options
  const [customizationSchema, setCustomizationSchema] = useState<z.ZodObject<any> | null>(null);
  
  const form = useForm<Record<string, any>>({
    resolver: customizationSchema ? zodResolver(customizationSchema) : undefined,
  });

  const calculatePrice = useCallback(() => {
    if (!product || !product.customizationOptions) {
      setCurrentPrice(product?.price || 0);
      return;
    }
    let calculatedPrice = product.price;
    const formValues = form.getValues();

    product.customizationOptions.forEach(opt => {
      const selectedValue = formValues[opt.id];
      if (opt.type === 'select' && opt.choices && selectedValue) {
        const choice = opt.choices.find(c => c.value === selectedValue);
        if (choice && choice.priceAdjustment) {
          calculatedPrice += choice.priceAdjustment;
        }
      }
      // Add logic for other types if they affect price (e.g., checkbox for gift wrap)
      if (opt.type === 'checkbox' && selectedValue === true && opt.choices?.[0]?.priceAdjustment) {
        // Assuming checkbox might have a single "choice" for its price impact
        calculatedPrice += opt.choices[0].priceAdjustment;
      }
    });
    setCurrentPrice(calculatedPrice);
  }, [product, form]);


  const fetchProductAndBuildSchema = useCallback(async () => {
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
        const fetchedProduct = { id: productDoc.id, ...productDoc.data() } as Product;
        setProduct(fetchedProduct);
        setCurrentPrice(fetchedProduct.price);

        if (fetchedProduct.customizationOptions && fetchedProduct.customizationOptions.length > 0) {
          const shape: Record<string, z.ZodTypeAny> = {};
          const defaultValues: Record<string, any> = {};

          fetchedProduct.customizationOptions.forEach(opt => {
            let fieldSchema: z.ZodTypeAny;
            switch (opt.type) {
              case 'select':
                fieldSchema = z.string();
                if (opt.required) fieldSchema = fieldSchema.min(1, `${opt.label} is required.`);
                else fieldSchema = fieldSchema.optional();
                defaultValues[opt.id] = opt.defaultValue || opt.choices?.[0]?.value || "";
                break;
              case 'text':
                fieldSchema = z.string();
                if (opt.required) fieldSchema = fieldSchema.min(1, `${opt.label} is required.`);
                if (opt.maxLength) fieldSchema = fieldSchema.max(opt.maxLength, `${opt.label} cannot exceed ${opt.maxLength} characters.`);
                else fieldSchema = fieldSchema.optional();
                defaultValues[opt.id] = opt.defaultValue || "";
                break;
              case 'checkbox':
                fieldSchema = z.boolean().optional();
                defaultValues[opt.id] = opt.defaultValue === true || String(opt.defaultValue).toLowerCase() === 'true';
                break;
              default:
                fieldSchema = z.any().optional();
            }
            shape[opt.id] = fieldSchema;
          });
          setCustomizationSchema(z.object(shape));
          form.reset(defaultValues); // Reset form with defaults after schema is ready
        } else {
          setCustomizationSchema(z.object({})); // Empty schema if no options
        }
      } else {
        setError("Product not found.");
        toast({ title: "Not Found", description: "The product you're looking for doesn't exist.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error fetching product:", e);
      setError("Failed to load product details. Please try again.");
      toast({ title: "Error", description: e.message || "Could not load product details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [productId, toast, form]); // form added as dependency

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (productId) {
      fetchProductAndBuildSchema();
    } else {
      setError("No product ID provided.");
      setIsLoading(false);
    }
  }, [authLoading, user, productId, router, fetchProductAndBuildSchema]);

  // Recalculate price when form values change
  useEffect(() => {
    if (product) {
        const subscription = form.watch((value, { name, type }) => {
            calculatePrice();
        });
        return () => subscription.unsubscribe();
    }
  }, [form, product, calculatePrice]);


  const onSubmit: SubmitHandler<Record<string, any>> = async (data) => {
    setIsSubmitting(true);
    // This is where you'd typically add the customized product to the cart.
    // For now, we'll just log the data.
    console.log("Customizations submitted:", data);
    console.log("Final Price:", currentPrice);
    toast({
      title: "Customizations Noted (Dev)",
      description: `Selected options: ${JSON.stringify(data)}. Final Price: ${formatPrice(currentPrice)}. Cart functionality to be implemented.`,
      duration: 5000,
    });
    // Example: await addToCart(productId, data, currentPrice);
    setIsSubmitting(false);
  };

  if (isLoading || authLoading || (product && !customizationSchema && (product.customizationOptions?.length || 0) > 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Loading customization options...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={() => router.push(`/products/${productId}`)} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Product
        </Button>
      </div>
    );
  }

  if (!product) {
    return ( /* Should be caught by error state, but as a fallback */ );
  }
  
  if (!product.customizationOptions || product.customizationOptions.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
        <h2 className="text-xl font-semibold mb-2">No Customizations Available</h2>
        <p className="text-muted-foreground mb-4">This product does not have any customization options.</p>
        <Button onClick={() => router.push(`/products/${productId}`)} variant="outline" className="mr-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Product
        </Button>
        <Button size="lg" disabled={product.stock === 0}>
            <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Button onClick={() => router.push(`/products/${productId}`)} variant="outline" size="sm" className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Product Details
      </Button>

      <Card className="overflow-hidden">
        <div className="md:grid md:grid-cols-12 gap-0">
          <div className="md:col-span-5 lg:col-span-4">
            <div className="aspect-[4/3] relative w-full bg-muted">
              <Image
                src={product.imageUrl || 'https://placehold.co/600x450.png'}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 40vw, 33vw"
                className="object-contain"
                data-ai-hint={product.categories?.[0]?.toLowerCase().split(" ")[0] || product.name.split(" ")[0]?.toLowerCase() || "product customization"}
              />
            </div>
             <div className="p-4 border-t bg-muted/50">
                <h3 className="text-lg font-semibold font-headline">{product.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-3">{product.description}</p>
            </div>
          </div>

          <div className="md:col-span-7 lg:col-span-8 p-6 md:p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-2xl lg:text-3xl font-headline font-bold">Customize Your Item</CardTitle>
              <CardDescription>Make it uniquely yours by selecting the options below.</CardDescription>
            </CardHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <CardContent className="p-0 space-y-5">
                  {product.customizationOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name={option.id}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">{option.label} {option.required && <span className="text-destructive">*</span>}</FormLabel>
                          {option.type === 'select' && option.choices && (
                            <Select onValueChange={field.onChange} defaultValue={String(field.value || "")} value={String(field.value || "")}>
                              <FormControl><SelectTrigger><SelectValue placeholder={`Select ${option.label.toLowerCase()}`} /></SelectTrigger></FormControl>
                              <SelectContent>
                                {option.choices.map(choice => (
                                  <SelectItem key={choice.value} value={choice.value}>
                                    {choice.label} 
                                    {choice.priceAdjustment ? ` (${choice.priceAdjustment > 0 ? '+' : ''}${formatPrice(choice.priceAdjustment)})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {option.type === 'text' && (
                            <Input 
                              {...field} 
                              value={String(field.value || "")}
                              placeholder={option.placeholder || `Enter ${option.label.toLowerCase()}`} 
                              maxLength={option.maxLength} 
                            />
                          )}
                          {option.type === 'checkbox' && (
                            <div className="flex items-center space-x-2 p-2 border rounded-md">
                               <Checkbox
                                id={option.id}
                                checked={field.value === true}
                                onCheckedChange={field.onChange}
                               />
                               <label htmlFor={option.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                 {option.placeholder || 'Yes, include this option'}
                                 {option.choices?.[0]?.priceAdjustment ? ` (+${formatPrice(option.choices[0].priceAdjustment)})` : ''}
                               </label>
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>

                <CardFooter className="p-0 mt-8 pt-6 border-t flex flex-col items-stretch gap-3">
                    <div className="text-2xl font-bold text-right mb-2">
                        Current Price: {formatPrice(currentPrice)}
                    </div>
                    {product.stock === 0 && (
                         <p className="text-destructive text-center font-semibold">This product is currently out of stock.</p>
                    )}
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || product.stock === 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" /> }
                    Add to Cart
                  </Button>
                  <Button type="button" variant="outline" size="lg" className="w-full" onClick={() => console.log("Save for later clicked", form.getValues())} disabled={product.stock === 0}>
                    <Save className="mr-2 h-5 w-5" /> Save For Later
                  </Button>
                </CardFooter>
              </form>
            </Form>
          </div>
        </div>
      </Card>
    </div>
  );
}

