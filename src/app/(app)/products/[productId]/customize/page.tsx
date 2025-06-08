
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCustomizationOption, CustomizationGroupDefinition } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { Loader2, AlertTriangle, ArrowLeft, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function CustomizeProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();
  
  const productId = typeof params.productId === 'string' ? params.productId : null;

  const [product, setProduct] = useState<Product | null>(null);
  const [resolvedOptions, setResolvedOptions] = useState<ProductCustomizationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  const [customizationSchema, setCustomizationSchema] = useState<z.ZodObject<any> | null>(null);
  
  const form = useForm<Record<string, any>>({
    resolver: customizationSchema ? zodResolver(customizationSchema) : undefined,
  });

  const calculatePrice = useCallback(() => {
    if (!product || resolvedOptions.length === 0) {
      setCurrentPrice(product?.price || 0);
      return;
    }
    let calculatedPrice = product.price;
    const formValues = form.getValues();

    resolvedOptions.forEach(opt => {
      const selectedValue = formValues[opt.id];
      if (opt.type === 'select' && opt.choices && selectedValue) {
        const choice = opt.choices.find(c => c.value === selectedValue);
        if (choice && choice.priceAdjustment) {
          calculatedPrice += choice.priceAdjustment;
        }
      }
      // For checkbox, priceAdjustmentIfChecked is on the option itself if it's a simple checkbox,
      // or on its single 'choice' if structured that way. Let's assume it's on the option.
      if (opt.type === 'checkbox' && selectedValue === true && (opt as any).priceAdjustmentIfChecked) {
        calculatedPrice += (opt as any).priceAdjustmentIfChecked;
      }
    });
    setCurrentPrice(calculatedPrice);
  }, [product, resolvedOptions, form]);

  const fetchProductAndOptions = useCallback(async () => {
    if (!productId || !db) {
      setError("Invalid item ID or database unavailable.");
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

        let finalOptions: ProductCustomizationOption[] = [];
        if (fetchedProduct.customizationGroupId) {
          const groupDocRef = doc(db, 'customizationGroupDefinitions', fetchedProduct.customizationGroupId);
          const groupDoc = await getDoc(groupDocRef);
          if (groupDoc.exists()) {
            finalOptions = (groupDoc.data() as CustomizationGroupDefinition).options as ProductCustomizationOption[];
          } else {
            console.warn(`Customization group ${fetchedProduct.customizationGroupId} not found.`);
          }
        } else if (fetchedProduct.customizationOptions && fetchedProduct.customizationOptions.length > 0) {
          finalOptions = fetchedProduct.customizationOptions;
        }
        setResolvedOptions(finalOptions);

        if (finalOptions.length > 0) {
          const shape: Record<string, z.ZodTypeAny> = {};
          const defaultValues: Record<string, any> = {};

          finalOptions.forEach(opt => {
            let fieldSchema: z.ZodTypeAny;
            switch (opt.type) {
              case 'select':
                fieldSchema = z.string();
                if (opt.required) fieldSchema = fieldSchema.min(1, `${opt.label} is required.`);
                else fieldSchema = fieldSchema.optional().nullable();
                defaultValues[opt.id] = opt.choices?.[0]?.value || "";
                break;
              case 'text':
                fieldSchema = z.string();
                if (opt.required) fieldSchema = fieldSchema.min(1, `${opt.label} is required.`);
                else fieldSchema = fieldSchema.optional().nullable();
                if (opt.maxLength) fieldSchema = fieldSchema.max(opt.maxLength, `${opt.label} cannot exceed ${opt.maxLength} characters.`);
                defaultValues[opt.id] = "";
                break;
              case 'checkbox':
                fieldSchema = z.boolean().optional();
                defaultValues[opt.id] = false;
                break;
              case 'image_upload': // Simple text input for URL for now
                fieldSchema = z.string().url({ message: "Please enter a valid image URL." }).optional().or(z.literal(''));
                defaultValues[opt.id] = "";
                break;
              default:
                fieldSchema = z.any().optional();
            }
            shape[opt.id] = fieldSchema;
          });
          
          const newSchema = z.object(shape);
          setCustomizationSchema(newSchema);
          form.reset(defaultValues);
          setTimeout(() => calculatePrice(), 0); // Initial price calculation
        } else {
          setCustomizationSchema(z.object({})); // No options, empty schema
        }
      } else {
        setError("Item not found.");
        toast({ title: "Not Found", description: "The item you're looking for doesn't exist.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error("Error fetching item/options:", e);
      setError("Failed to load item details. Please try again.");
      toast({ title: "Error", description: e.message || "Could not load item details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [productId, toast, form, calculatePrice]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (productId) {
      fetchProductAndOptions();
    } else {
      setError("No item ID provided.");
      setIsLoading(false);
    }
  }, [authLoading, user, productId, router, fetchProductAndOptions]);

  useEffect(() => {
    if (product && form && resolvedOptions.length > 0) {
        const subscription = form.watch(() => calculatePrice());
        return () => subscription.unsubscribe();
    }
  }, [form, product, resolvedOptions, calculatePrice]);


  const onSubmit: SubmitHandler<Record<string, any>> = async (data) => {
    if (!product) return;
    setIsSubmitting(true);
    
    const customizationsToSave: Record<string, any> = {};
    resolvedOptions.forEach(opt => {
      if (data[opt.id] !== undefined && data[opt.id] !== '' && data[opt.id] !== false) { // Only save if valued
        customizationsToSave[opt.id] = data[opt.id];
      }
    });

    addToCart(product, 1, customizationsToSave, currentPrice);
    router.push('/orders/cart');

    setIsSubmitting(false);
  };

  if (isLoading || authLoading || (product && resolvedOptions.length > 0 && !customizationSchema && !error)) {
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
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Item Details
        </Button>
      </div>
    );
  }

  if (!product) {
    return ( <div className="text-center p-4">Item data could not be loaded.</div> );
  }
  
  if (resolvedOptions.length === 0) {
    return (
      <div className="container mx-auto px-0 sm:px-4 py-8 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
        <h2 className="text-xl font-semibold mb-2">No Customizations Available</h2>
        <p className="text-muted-foreground mb-4">This item does not have any customization options.</p>
        <Button onClick={() => router.push(`/products/${productId}`)} variant="outline" className="mr-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Item Details
        </Button>
        <Button size="lg" disabled={product.stock === 0} onClick={() => { addToCart(product, 1, undefined, product.price); router.push('/orders/cart'); }}>
            <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0 sm:px-4 py-8">
      <Button onClick={() => router.push(`/products/${productId}`)} variant="outline" size="sm" className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Item Details
      </Button>

      <Card className="overflow-hidden shadow-none sm:shadow-lg rounded-none sm:rounded-lg">
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

          <div className="md:col-span-7 lg:col-span-8 p-4 sm:p-6 md:p-8">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-2xl lg:text-3xl font-headline font-bold">Customize Your Item</CardTitle>
              <CardDescription>Make it uniquely yours by selecting the options below.</CardDescription>
            </CardHeader>
            
            {customizationSchema && resolvedOptions.length > 0 && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <CardContent className="p-0 space-y-5">
                  {resolvedOptions.map((option) => (
                    <FormField
                      key={option.id}
                      control={form.control}
                      name={option.id}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-medium">{option.label} {option.required && <span className="text-destructive">*</span>}</FormLabel>
                          {option.type === 'select' && option.choices && (
                            <Select onValueChange={field.onChange} value={String(field.value ?? "")} defaultValue={String(field.value ?? "")}>
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
                            <Textarea 
                              {...field} 
                              value={String(field.value ?? "")}
                              placeholder={option.placeholder || `Enter ${option.label.toLowerCase()}`} 
                              maxLength={option.maxLength}
                              rows={option.maxLength && option.maxLength > 100 ? 4 : 2} 
                            />
                          )}
                          {option.type === 'checkbox' && (
                            <div className="flex items-center space-x-2 p-3 border rounded-md hover:border-primary transition-colors">
                               <Checkbox
                                id={option.id}
                                checked={field.value === true}
                                onCheckedChange={field.onChange}
                               />
                               <label htmlFor={option.id} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow cursor-pointer">
                                 {option.checkboxLabel || option.label}
                                 {(option as any).priceAdjustmentIfChecked ? ` (+${formatPrice((option as any).priceAdjustmentIfChecked)})` : ''}
                               </label>
                            </div>
                          )}
                           {option.type === 'image_upload' && ( // Simple URL input for now
                              <Input 
                                type="text"
                                {...field}
                                value={String(field.value ?? "")}
                                placeholder={option.placeholder || "Paste image URL here"}
                              />
                           )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </CardContent>

                <CardFooter className="p-0 mt-8 pt-6 border-t flex flex-col items-stretch gap-3">
                    <div className="text-2xl font-bold text-right mb-2">
                        Total Price: {formatPrice(currentPrice)}
                    </div>
                    {product.stock === 0 && (
                         <p className="text-destructive text-center font-semibold">This item is currently out of stock.</p>
                    )}
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || product.stock === 0}>
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" /> }
                    Save Customizations & Add to Cart
                  </Button>
                </CardFooter>
              </form>
            </Form>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
