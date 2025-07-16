
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, format } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import type { Product, BulkOrderRequest, User as AppUser, ProductCustomizationOption, CustomizationGroupDefinition } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, PackagePlus, PlusCircle, Trash2, Send, CalendarIcon, Check, ChevronsUpDown, ImageOff, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formatPrice = (price?: number) => {
    if (price === undefined || price === null) return 'N/A';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const bulkOrderItemSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  notes: z.string().optional(),
  customizations: z.record(z.string(), z.any()).optional(),
});

const bulkOrderRequestSchema = z.object({
  companyName: z.string().optional(),
  requesterName: z.string().min(2, "Contact name is required."),
  requesterEmail: z.string().email("Invalid email address."),
  requesterPhone: z.string().min(10, "A valid phone number is required."),
  desiredDeliveryDate: z.date({ required_error: "Please select a delivery date."}),
  items: z.array(bulkOrderItemSchema).min(1, "Please add at least one item to the request."),
});

type BulkOrderRequestFormValues = z.infer<typeof bulkOrderRequestSchema>;

export default function BulkOrderRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [productOptions, setProductOptions] = useState<Map<string, ProductCustomizationOption[]>>(new Map());
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openPopoverIndex, setOpenPopoverIndex] = useState<number | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  const form = useForm<BulkOrderRequestFormValues>({
    resolver: zodResolver(bulkOrderRequestSchema),
    defaultValues: {
      requesterName: user?.displayName || "",
      requesterEmail: user?.email || "",
      requesterPhone: "",
      companyName: "",
      items: [{ productId: "", quantity: 1, notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  useEffect(() => {
    if (user) {
        form.setValue('requesterName', user.displayName || '');
        form.setValue('requesterEmail', user.email || '');
    }
    if (appUser) {
        if (!form.getValues('requesterPhone') && appUser.phone) form.setValue('requesterPhone', appUser.phone);
    }
  }, [user, appUser, form]);

  const fetchUserData = useCallback(async () => {
    if (!user || !db) return;
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const userData = docSnap.data() as AppUser;
      setAppUser(userData);
      // Pre-fill form if not already filled
      if (!form.getValues('requesterPhone') && userData.phone) form.setValue('requesterPhone', userData.phone);
    }
  }, [user, form]);


  const fetchProductsAndOptions = useCallback(async () => {
    if (!db) return;
    setIsLoadingProducts(true);
    try {
      const q = query(collection(db, 'products'), where("published", "==", true), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const productsData: Product[] = [];
      const optionsMap = new Map<string, ProductCustomizationOption[]>();

      for (const productDoc of snapshot.docs) {
        const productData = { id: productDoc.id, ...productDoc.data() } as Product;
        productsData.push(productData);

        if (productData.customizationGroupId) {
          const groupDoc = await getDoc(doc(db, 'customizationGroupDefinitions', productData.customizationGroupId));
          if (groupDoc.exists()) {
            optionsMap.set(productData.id, (groupDoc.data() as CustomizationGroupDefinition).options || []);
          }
        }
      }
      setProducts(productsData);
      setProductOptions(optionsMap);
    } catch (e: any) {
      toast({ title: "Error", description: `Could not load product list: ${e.message}`, variant: "destructive" });
    } finally {
      setIsLoadingProducts(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProductsAndOptions();
    fetchUserData();
  }, [fetchProductsAndOptions, fetchUserData]);
  
  const onSubmit = async (values: BulkOrderRequestFormValues) => {
    if (!db || !user) return;
    setIsSubmitting(true);
    
    const requestData: Omit<BulkOrderRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        ...values,
        requesterId: user.uid,
        status: 'pending_review',
        items: values.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return { ...item, name: product?.name || 'Unknown Product' };
        })
    };
    
    try {
        await addDoc(collection(db, 'bulkOrderRequests'), {
            ...requestData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Request Submitted", description: "Your bulk order request has been sent for review." });
        router.push('/dashboard');
    } catch (e: any) {
        toast({ title: "Submission Failed", description: "There was an error submitting your request.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <PackagePlus /> Request a Bulk Order
          </CardTitle>
          <CardDescription>
            Planning a large order for a corporate event, party, or special occasion? Fill out the form below and our team will get back to you with a confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="requesterName" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="requesterEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="requesterPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="desiredDeliveryDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Desired Delivery Date</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus/>
                        </PopoverContent></Popover><FormMessage/>
                    </FormItem>
                 )}/>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-t pt-4">Requested Items</h3>
                {fields.map((field, index) => {
                    const selectedProductId = form.watch(`items.${index}.productId`);
                    const quantity = form.watch(`items.${index}.quantity`);
                    const selectedProduct = products.find(p => p.id === selectedProductId);
                    const optionsForProduct = selectedProductId ? productOptions.get(selectedProductId) : [];
                    const rowTotal = selectedProduct ? selectedProduct.price * (quantity || 0) : 0;

                    return (
                        <div key={field.id} className="p-4 border rounded-lg space-y-3 relative bg-muted/50">
                            <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                            <FormField
                                control={form.control}
                                name={`items.${index}.productId`}
                                render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Product</FormLabel>
                                    <Popover open={openPopoverIndex === index} onOpenChange={(open) => setOpenPopoverIndex(open ? index : null)}>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                            disabled={isLoadingProducts}
                                        >
                                            {field.value ? products.find((p) => p.id === field.value)?.name : (isLoadingProducts ? "Loading..." : "Select product")}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                        <CommandInput placeholder="Search product..." />
                                        <CommandList>
                                            <CommandEmpty>No product found.</CommandEmpty>
                                            <CommandGroup>
                                            {products.map((p) => (
                                                <CommandItem
                                                    value={p.name}
                                                    key={p.id}
                                                    onSelect={() => {
                                                        form.setValue(`items.${index}.productId`, p.id);
                                                        setOpenPopoverIndex(null);
                                                    }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <div className="relative w-8 h-8 rounded-sm bg-accent overflow-hidden flex-shrink-0">
                                                        {p.imageUrl ? <Image src={p.imageUrl} alt={p.name} layout="fill" objectFit="cover" data-ai-hint="product"/> : <ImageOff className="h-4 w-4 text-muted-foreground"/>}
                                                    </div>
                                                    <span className="flex-grow truncate">{p.name}</span>
                                                    <Check className={cn("mr-2 h-4 w-4", p.id === field.value ? "opacity-100" : "opacity-0")} />
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                        </CommandList>
                                        </Command>
                                    </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} min="1"/></FormControl><FormMessage/></FormItem>)}/>
                                <div><FormLabel>Total Price</FormLabel><Input value={formatPrice(rowTotal)} disabled /></div>
                            </div>
                            <FormField control={form.control} name={`items.${index}.notes`} render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Any specific instructions for this item..." rows={2}/></FormControl><FormMessage/></FormItem>)}/>
                        
                            {optionsForProduct && optionsForProduct.length > 0 && (
                                <div className="pt-2 border-t mt-3 space-y-3">
                                <h4 className="text-sm font-medium flex items-center gap-1"><Settings className="h-4 w-4"/> Customizations</h4>
                                {optionsForProduct.map(option => (
                                    <FormField
                                    key={option.id}
                                    control={form.control}
                                    name={`items.${index}.customizations.${option.id}`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">{option.label}</FormLabel>
                                            {option.type === 'text' && <FormControl><Input {...field} placeholder={option.placeholder || ''} /></FormControl>}
                                            {option.type === 'checkbox' && <div className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-xs font-normal">{option.checkboxLabel}</FormLabel></div>}
                                            {option.type === 'dropdown' && <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={`Select ${option.label.toLowerCase()}`} /></SelectTrigger></FormControl><SelectContent>{option.choices?.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                ))}
                                </div>
                            )}
                        </div>
                    )
                })}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, notes: ""})}><PlusCircle className="mr-2 h-4 w-4"/>Add Another Item</Button>
              </div>

              <CardFooter className="p-0 pt-6">
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                  Submit Request
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
