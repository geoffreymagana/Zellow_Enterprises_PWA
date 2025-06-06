
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, ArrowLeft, UploadCloud, ExternalLink, ImageOff } from 'lucide-react';
import type { Product as ProductType, CustomizationGroupDefinition } from '@/types';
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, doc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const predefinedCategories = [
  "Drinkware (Mugs, Tumblers, Flasks)", "Apparel (T-shirts, Hoodies, Caps)", "Stationery (Pens, Notebooks, Journals)",
  "Keepsakes (Keychains, Photo Frames, Ornaments)", "Home & Office Decor (Plaques, Coasters, Desk Accessories)",
  "Jewelry & Accessories (Bracelets, Necklaces, Bags, Wallets)", "Tech Gadgets (Power Banks, Earbuds, Phone Stands)",
  "Gourmet & Edibles (Gift Baskets, Chocolates)", "Experiences (Voucher base items)", "Gift Boxes",
  "Seasonal & Holiday Specials", "For Him", "For Her", "For Kids", "For Pets", "Corporate Gifts", "Eco-Friendly"
];

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  stock: z.coerce.number().int().min(0, "Stock must be a non-negative integer"),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  imageUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal('')),
  supplier: z.string().optional(),
  customizationGroupId: z.string().optional().nullable(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const CLOUDINARY_COLLECTION_URL = "https://collection.cloudinary.com/dwqwwb2fh/6376c18334415e9e66450df7af51e5a0";
const NONE_GROUP_SENTINEL_VALUE = "__NONE_GROUP_SENTINEL__";

export default function CreateProductPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customizationGroups, setCustomizationGroups] = useState<CustomizationGroupDefinition[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "", description: "", price: undefined, stock: undefined, categories: [], imageUrl: "", supplier: "", customizationGroupId: null
    },
  });

  const fetchCustomizationGroups = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available for groups.", variant: "destructive" });
      setIsLoadingGroups(false); return;
    }
    setIsLoadingGroups(true);
    try {
      const q = query(collection(db, 'customizationGroupDefinitions'), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      setCustomizationGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomizationGroupDefinition)));
    } catch (e: any) {
      console.error("Error fetching customization groups:", e);
      toast({ title: "Error", description: "Could not load customization groups.", variant: "destructive" });
    } finally {
      setIsLoadingGroups(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchCustomizationGroups();
      }
    }
  }, [user, role, authLoading, router, fetchCustomizationGroups]);

  const onSubmit: SubmitHandler<ProductFormValues> = async (values) => {
    if (!db) return;
    setIsSubmitting(true);
    
    const dataToSave: Omit<ProductType, 'id' | 'customizationOptions'> & { createdAt: any, updatedAt: any } = {
      name: values.name,
      description: values.description,
      price: values.price,
      stock: values.stock,
      categories: values.categories,
      imageUrl: values.imageUrl,
      supplier: values.supplier,
      customizationGroupId: values.customizationGroupId, // This will be null if "None" was selected
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    try {
      await addDoc(collection(db, 'products'), dataToSave);
      toast({ title: "Product Created", description: `"${values.name}" has been added successfully.` });
      router.push('/admin/products'); 
    } catch (error: any) {
      console.error("Failed to create product:", error);
      toast({ title: "Creation Failed", description: error.message || "Could not create product.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoadingGroups) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Create New Product</h1>
        <Button variant="outline" onClick={() => router.push('/admin/products')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column (Main Content) */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Ceramic Mug 11oz" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={5} placeholder="Detailed description of the product..." /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="stock" render={({ field }) => (<FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" {...field} placeholder="0" /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Media</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Button type="button" variant="outline" onClick={() => window.open(CLOUDINARY_COLLECTION_URL, '_blank')}><UploadCloud className="mr-2 h-4 w-4" /> Browse Cloudinary Collection</Button>
                    <FormDescription>Open the Cloudinary collection, copy the desired image URL, and paste it below.</FormDescription>
                  </div>
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (<FormItem><FormLabel>Image URL</FormLabel><div className="flex items-center gap-2"><FormControl><Input {...field} placeholder="https://res.cloudinary.com/..." /></FormControl>{field.value && (<a href={field.value} target="_blank" rel="noopener noreferrer" title="Open image in new tab"><Button type="button" variant="outline" size="icon"><ExternalLink className="h-4 w-4"/></Button></a>)}</div><FormMessage /></FormItem>)} />
                  {form.watch("imageUrl") && (<div className="my-2 p-2 border rounded-md flex justify-center items-center bg-muted aspect-video max-h-48 relative"><Image src={form.watch("imageUrl")!} alt="Image Preview" fill className="object-contain" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; const errorPlaceholder = target.parentElement?.querySelector('.error-placeholder'); if (errorPlaceholder) errorPlaceholder.classList.remove('hidden');}} data-ai-hint={"product image"} /><div className="error-placeholder hidden text-muted-foreground text-xs flex flex-col items-center"><ImageOff className="h-8 w-8 mb-1"/><span>Invalid URL or image</span></div></div>)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
                <CardContent>
                  <FormField control={form.control} name="categories" render={() => (
                    <FormItem>
                      <ScrollArea className="h-60 rounded-md border p-2">
                        {predefinedCategories.map((category) => (
                          <FormField key={category} control={form.control} name="categories" render={({ field }) => (
                            <FormItem key={category} className="flex flex-row items-start space-x-3 space-y-0 py-1.5">
                              <FormControl><Checkbox checked={field.value?.includes(category)} onCheckedChange={(checked) => { return checked ? field.onChange([...(field.value || []), category]) : field.onChange((field.value || []).filter((value) => value !== category));}}/></FormControl>
                              <FormLabel className="font-normal text-sm">{category}</FormLabel>
                            </FormItem>
                          )} />
                        ))}
                      </ScrollArea>
                      <FormMessage />
                    </FormItem>
                  )}/>
                </CardContent>
              </Card>
            </div>

            {/* Right Column (Side Content) */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader><CardTitle>Supplier</CardTitle></CardHeader>
                <CardContent>
                  <FormField control={form.control} name="supplier" render={({ field }) => (<FormItem><FormLabel>Supplier (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., Acme Supplies" /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Customization Group</CardTitle></CardHeader>
                <CardContent>
                  <FormField
                    control={form.control} name="customizationGroupId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Customization Group (Optional)</FormLabel>
                        <Select 
                          onValueChange={(valueFromSelectItem) => {
                            if (valueFromSelectItem === NONE_GROUP_SENTINEL_VALUE) {
                              field.onChange(null);
                            } else {
                              field.onChange(valueFromSelectItem);
                            }
                          }} 
                          value={field.value === null ? NONE_GROUP_SENTINEL_VALUE : (field.value || "")}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value={NONE_GROUP_SENTINEL_VALUE}>None</SelectItem>
                            {customizationGroups.map(group => (
                              <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>Choose a pre-defined set of customization options.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Product
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

