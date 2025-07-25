
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCustomizationOption, CustomizationGroupDefinition, CustomizationGroupChoiceDefinition } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { Loader2, AlertTriangle, ArrowLeft, ShoppingCart, UploadCloud, ImagePlus, CheckCircleIcon, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

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
  const [defaultFormValues, setDefaultFormValues] = useState<Record<string, any>>({});
  const [uploadStates, setUploadStates] = useState<Record<string, { progress: number; error?: string; uploading: boolean; url?: string }>>({});

  const form = useForm<Record<string, any>>({
    resolver: customizationSchema ? zodResolver(customizationSchema) : undefined,
    defaultValues: defaultFormValues,
  });

  const calculatePrice = useCallback(() => {
    if (!product) return;
    
    let calculatedPrice = product.price;
    const formValues = form.getValues();

    resolvedOptions.forEach(opt => {
      const selectedValue = formValues[opt.id];
      if (!selectedValue) return;

      if (opt.type === 'dropdown' && opt.choices) {
        const choice = opt.choices.find(c => c.value === selectedValue);
        if (choice && choice.priceAdjustment) {
          calculatedPrice += choice.priceAdjustment;
        }
      } else if (opt.type === 'checkbox_group' && opt.choices && Array.isArray(selectedValue)) {
          selectedValue.forEach(val => {
              const choice = opt.choices?.find(c => c.value === val);
              if(choice && choice.priceAdjustment) {
                  calculatedPrice += choice.priceAdjustment;
              }
          });
      } else if (opt.type === 'checkbox' && selectedValue === true && opt.priceAdjustmentIfChecked) {
        calculatedPrice += opt.priceAdjustmentIfChecked;
      } else if (opt.type === 'color_picker' && opt.choices) {
        const choice = opt.choices.find(c => c.value === selectedValue);
        if (choice && choice.priceAdjustment) {
          calculatedPrice += choice.priceAdjustment; 
        }
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
    setCustomizationSchema(null);
    setDefaultFormValues({});

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
                const groupData = groupDoc.data() as CustomizationGroupDefinition;
                finalOptions = (groupData.options || []).filter(opt => opt.showToCustomerByDefault !== false);
            } else {
                console.warn(`Customization group ${fetchedProduct.customizationGroupId} not found for product ${productId}. Checking direct product options.`);
                if (fetchedProduct.customizationOptions && fetchedProduct.customizationOptions.length > 0) {
                    finalOptions = fetchedProduct.customizationOptions.filter(opt => opt.showToCustomerByDefault !== false);
                }
            }
        } else if (fetchedProduct.customizationOptions && fetchedProduct.customizationOptions.length > 0) {
            finalOptions = fetchedProduct.customizationOptions.filter(opt => opt.showToCustomerByDefault !== false);
        }
        setResolvedOptions(finalOptions);

        if (finalOptions.length > 0) {
          const shape: Record<string, z.ZodTypeAny> = {};
          const newDefaultValues: Record<string, any> = {};
          const initialUploadStates: Record<string, any> = {};

          finalOptions.forEach(opt => {
            let fieldSchema: z.ZodTypeAny;
            let defaultValue: any = opt.defaultValue;

            switch (opt.type) {
              case 'dropdown':
                fieldSchema = z.string();
                if (opt.required) fieldSchema = fieldSchema.min(1, `${opt.label} is required.`);
                else fieldSchema = fieldSchema.optional().nullable();
                defaultValue = defaultValue ?? (opt.choices?.[0]?.value || null);
                break;
              case 'checkbox_group':
                fieldSchema = z.array(z.string()).optional();
                defaultValue = defaultValue ?? [];
                break;
              case 'text':
                let textSchemaBase = z.string();
                if (opt.maxLength) {
                  textSchemaBase = textSchemaBase.max(opt.maxLength, `${opt.label} cannot exceed ${opt.maxLength} characters.`);
                }
                if (opt.required) {
                  fieldSchema = textSchemaBase.min(1, `${opt.label} is required.`);
                } else {
                  fieldSchema = textSchemaBase.optional().nullable();
                }
                defaultValue = defaultValue ?? "";
                break;
              case 'checkbox':
                fieldSchema = z.boolean().optional();
                defaultValue = typeof defaultValue === 'boolean' ? defaultValue : false;
                break;
              case 'image_upload':
                fieldSchema = z.string().url({ message: "A valid image URL is required after upload." }).optional().or(z.literal(''));
                if (opt.required) fieldSchema = z.string().url({message: "Image upload is required."}).min(1, `${opt.label} is required.`);
                defaultValue = defaultValue ?? ""; 
                initialUploadStates[opt.id] = { progress: 0, error: undefined, uploading: false, url: defaultValue || undefined };
                break;
              case 'color_picker':
                fieldSchema = z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/i, `${opt.label} must be a valid hex color.`);
                if (opt.required) fieldSchema = fieldSchema.min(1, `${opt.label} is required.`);
                else fieldSchema = fieldSchema.optional().nullable();
                defaultValue = defaultValue ?? (opt.choices?.[0]?.value || null);
                break;
              default:
                fieldSchema = z.any().optional();
            }
            shape[opt.id] = fieldSchema;
            newDefaultValues[opt.id] = defaultValue;
          });
          
          setCustomizationSchema(z.object(shape));
          setDefaultFormValues(newDefaultValues);
          setUploadStates(initialUploadStates);
        } else {
          setCustomizationSchema(z.object({}));
          setDefaultFormValues({});
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
  }, [productId, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/products/' + productId + '/customize');
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
    if (customizationSchema && Object.keys(defaultFormValues).length > 0) {
      form.reset(defaultFormValues);
      if(product && resolvedOptions.length > 0) {
          calculatePrice();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customizationSchema, defaultFormValues, product, resolvedOptions]);

  useEffect(() => {
    if (product && resolvedOptions.length > 0) { 
        const subscription = form.watch(() => calculatePrice());
        return () => subscription.unsubscribe();
    }
  }, [form, product, calculatePrice, resolvedOptions]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, option: ProductCustomizationOption) => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      toast({ title: "Upload Error", description: "Cloudinary environment variables not configured.", variant: "destructive" });
      setUploadStates(prev => ({ ...prev, [option.id]: { ...prev[option.id], error: "Upload service not configured.", uploading: false }}));
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    if (option.acceptedFileTypes) {
      const allowedTypes = option.acceptedFileTypes.split(',').map(t => t.trim().toLowerCase());
      const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
      if (!allowedTypes.includes(fileExtension) && !allowedTypes.includes(file.type.toLowerCase())) {
          setUploadStates(prev => ({ ...prev, [option.id]: { ...prev[option.id], error: `Invalid file type. Allowed: ${option.acceptedFileTypes}`, uploading: false }}));
          toast({ title: "Upload Error", description: `Invalid file type. Allowed: ${option.acceptedFileTypes}`, variant: "destructive"});
          return;
      }
    }
    if (option.maxFileSizeMB && file.size > option.maxFileSizeMB * 1024 * 1024) {
        setUploadStates(prev => ({ ...prev, [option.id]: { ...prev[option.id], error: `File too large. Max: ${option.maxFileSizeMB}MB`, uploading: false }}));
        toast({ title: "Upload Error", description: `File too large. Max: ${option.maxFileSizeMB}MB`, variant: "destructive"});
        return;
    }

    setUploadStates(prev => ({ ...prev, [option.id]: { progress: 0, error: undefined, uploading: true }}));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data = await response.json();
      form.setValue(option.id, data.secure_url);
      setUploadStates(prev => ({ ...prev, [option.id]: { progress: 100, error: undefined, uploading: false, url: data.secure_url }}));
      calculatePrice(); 
      toast({ title: "Image Uploaded", description: `${option.label} updated successfully.`, variant: "default" });
    } catch (err: any) {
      console.error("Cloudinary upload error:", err);
      form.setValue(option.id, ""); 
      setUploadStates(prev => ({ ...prev, [option.id]: { ...prev[option.id], error: err.message || "Upload failed", uploading: false, url: undefined }}));
      toast({ title: "Upload Failed", description: err.message || "Could not upload image.", variant: "destructive" });
    }
  };

  const onSubmit: SubmitHandler<Record<string, any>> = async (data) => {
    if (!product) return;
    setIsSubmitting(true);
    
    const customizationsToSave: Record<string, any> = {};
    resolvedOptions.forEach(opt => {
      if (data[opt.id] !== undefined && data[opt.id] !== '' && data[opt.id] !== false && (!Array.isArray(data[opt.id]) || data[opt.id].length > 0) && data[opt.id] !== null) {
        customizationsToSave[opt.id] = data[opt.id];
      } else if (opt.required && (data[opt.id] === undefined || data[opt.id] === '' || data[opt.id] === false || (Array.isArray(data[opt.id]) && data[opt.id].length === 0) || data[opt.id] === null)) {
        console.warn(`Required field ${opt.id} missing value during submission attempt.`);
      }
    });

    addToCart(product, 1, customizationsToSave, currentPrice);
    router.push('/orders/cart');

    setIsSubmitting(false);
  };

  if (authLoading || isLoading) {
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
        <Button onClick={() => router.push(productId ? `/products/${productId}` : '/products')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Item
        </Button>
      </div>
    );
  }

  if (!product) {
    return ( 
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))] text-center p-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-6">Item data could not be loaded or does not exist.</p>
        <Button onClick={() => router.push('/products')} variant="outline">Back to Products</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-0 sm:px-4 py-8">
      <Button onClick={() => router.push(productId ? `/products/${productId}` : '/products')} variant="outline" size="sm" className="mb-6">
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
            
            {resolvedOptions.length === 0 ? (
              <div className="text-center py-6">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3 mx-auto" />
                <p className="text-muted-foreground">This item does not have specific customization options.</p>
                <p className="text-sm text-muted-foreground mt-1">You can add it to your cart as is.</p>
                 <CardFooter className="p-0 mt-8 pt-6 border-t flex flex-col items-stretch gap-3">
                    <div className="text-2xl font-bold text-right mb-2">
                        Total Price: {formatPrice(currentPrice)}
                    </div>
                     {product.stock === 0 && (
                         <p className="text-destructive text-center font-semibold">This item is currently out of stock.</p>
                    )}
                  <Button type="button" size="lg" className="w-full" 
                    onClick={() => {
                        addToCart(product, 1, undefined, product.price);
                        router.push('/orders/cart');
                    }} 
                    disabled={isSubmitting || product.stock === 0}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" /> }
                    Add to Cart
                  </Button>
                </CardFooter>
              </div>
            ) : customizationSchema ? (
              <TooltipProvider>
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
                              {option.type === 'dropdown' && option.choices && (
                                <Select 
                                  onValueChange={(value) => { field.onChange(value); calculatePrice(); }} 
                                  value={String(field.value ?? "")} 
                                  defaultValue={String(field.value ?? "")}
                                >
                                  <FormControl><SelectTrigger><SelectValue placeholder={`Select ${option.label.toLowerCase()}`} /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {option.choices.map(choice => (
                                      <SelectItem key={choice.value} value={choice.value}>
                                        {choice.label} 
                                        {choice.priceAdjustment && choice.priceAdjustment !== 0 ? ` (${choice.priceAdjustment > 0 ? '+' : ''}${formatPrice(choice.priceAdjustment)})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {option.type === 'checkbox_group' && option.choices && (
                                <div className="space-y-2 pt-1">
                                  {option.choices.map((choice) => (
                                    <FormField
                                      key={choice.value}
                                      control={form.control}
                                      name={option.id}
                                      render={({ field: checkboxGroupField }) => {
                                        const currentValue = Array.isArray(checkboxGroupField.value) ? checkboxGroupField.value : [];
                                        return (
                                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:border-primary transition-colors">
                                            <FormControl>
                                              <Checkbox
                                                checked={currentValue.includes(choice.value)}
                                                onCheckedChange={(checked) => {
                                                  let newValue;
                                                  if (checked) {
                                                    newValue = [...currentValue, choice.value];
                                                  } else {
                                                    newValue = currentValue.filter((v: string) => v !== choice.value);
                                                  }
                                                  checkboxGroupField.onChange(newValue);
                                                  calculatePrice();
                                                }}
                                              />
                                            </FormControl>
                                            <FormLabel className="font-normal flex-grow cursor-pointer">
                                              {choice.label}
                                              {choice.priceAdjustment && choice.priceAdjustment !== 0 ? ` (+${formatPrice(choice.priceAdjustment)})` : ''}
                                            </FormLabel>
                                          </FormItem>
                                        );
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                              {option.type === 'text' && (
                                <Textarea 
                                  {...field} 
                                  value={String(field.value ?? "")}
                                  onChange={(e) => {field.onChange(e); setTimeout(calculatePrice, 0);}}
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
                                    onCheckedChange={(checked) => {field.onChange(checked); setTimeout(calculatePrice, 0);}}
                                  />
                                  <label htmlFor={option.id} className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow cursor-pointer">
                                    {option.checkboxLabel || option.label}
                                    {option.priceAdjustmentIfChecked && option.priceAdjustmentIfChecked !== 0 ? ` (+${formatPrice(option.priceAdjustmentIfChecked)})` : ''}
                                  </label>
                                </div>
                              )}
                              {option.type === 'image_upload' && (
                                <div className="space-y-2">
                                  <Input
                                    id={option.id}
                                    type="file"
                                    accept={option.acceptedFileTypes || "image/*"}
                                    onChange={(e) => handleImageUpload(e, option)}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                    disabled={uploadStates[option.id]?.uploading}
                                  />
                                  {uploadStates[option.id]?.uploading && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin"/> Uploading...
                                    </div>
                                  )}
                                  {uploadStates[option.id]?.error && <p className="text-xs text-destructive">{uploadStates[option.id]?.error}</p>}
                                  {field.value && uploadStates[option.id]?.url && !uploadStates[option.id]?.uploading && (
                                    <div className="mt-2 p-2 border rounded-md bg-muted/50 relative w-32 h-32 group">
                                      <Image src={field.value} alt="Upload preview" layout="fill" objectFit="cover" className="rounded-md" data-ai-hint="customized image"/>
                                      <Button 
                                        type="button" 
                                        variant="destructive" 
                                        size="icon" 
                                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => {
                                          form.setValue(option.id, "");
                                          setUploadStates(prev => ({ ...prev, [option.id]: { ...prev[option.id], url: undefined, error: undefined }}));
                                        }}
                                      > X </Button>
                                    </div>
                                  )}
                                  {(!field.value || !uploadStates[option.id]?.url) && !uploadStates[option.id]?.uploading && (
                                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground p-2 border rounded-md border-dashed justify-center h-24">
                                        <ImagePlus className="h-5 w-5"/> <span>Upload Image</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {option.type === 'color_picker' && (
                                <div className="flex flex-wrap gap-2 items-center pt-1">
                                  {option.choices && option.choices.length > 0 ? (
                                    option.choices.map(choice => (
                                      <Tooltip key={choice.value}>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className={cn(
                                              "h-8 w-8 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center justify-center transition-all",
                                              field.value === choice.value ? 'ring-2 ring-offset-2 ring-primary border-primary scale-110 shadow-md' : 'border-muted hover:border-muted-foreground'
                                            )}
                                            style={{ backgroundColor: choice.value }}
                                            onClick={() => {
                                              field.onChange(choice.value);
                                              calculatePrice(); 
                                            }}
                                            aria-label={choice.label || choice.value}
                                          >
                                            {field.value === choice.value && <Check className="h-4 w-4 text-white mix-blend-difference" />}
                                            <span className="sr-only">{choice.label || choice.value}</span>
                                          </button>
                                        </TooltipTrigger>
                                        {choice.label && (
                                          <TooltipContent side="bottom">
                                              <p>{choice.label} ({choice.value})</p>
                                              {choice.priceAdjustment && choice.priceAdjustment !== 0 ? <p>({choice.priceAdjustment > 0 ? '+' : ''}{formatPrice(choice.priceAdjustment)})</p> : null}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    ))
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No color options defined.</p>
                                  )}
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
                            Total Price: {formatPrice(currentPrice)}
                        </div>
                        {product.stock === 0 && (
                            <p className="text-destructive text-center font-semibold">This item is currently out of stock.</p>
                        )}
                      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || product.stock === 0 || Object.values(uploadStates).some(s => s.uploading)}>
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" /> }
                        Save Customizations & Add to Cart
                      </Button>
                    </CardFooter>
                  </form>
                </Form>
              </TooltipProvider>
            ) : (
                 <div className="flex flex-col items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">Preparing customization form...</p>
                 </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
