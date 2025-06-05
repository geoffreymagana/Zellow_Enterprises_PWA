
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, FilterIcon, ExternalLink, ImageOff, UploadCloud, Settings2, GripVertical, MinusCircle } from 'lucide-react';
import type { Product as ProductType, ProductCustomizationOption, CustomizationChoiceOption } from '@/types';
import { useForm, Controller, SubmitHandler, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const predefinedCategories = [
  "Drinkware (Mugs, Tumblers, Flasks)", "Apparel (T-shirts, Hoodies, Caps)", "Stationery (Pens, Notebooks, Journals)",
  "Keepsakes (Keychains, Photo Frames, Ornaments)", "Home & Office Decor (Plaques, Coasters, Desk Accessories)",
  "Jewelry & Accessories (Bracelets, Necklaces, Bags, Wallets)", "Tech Gadgets (Power Banks, Earbuds, Phone Stands)",
  "Gourmet & Edibles (Gift Baskets, Chocolates)", "Experiences (Voucher base items)",
  "Seasonal & Holiday Specials", "For Him", "For Her", "For Kids", "For Pets", "Corporate Gifts", "Eco-Friendly"
];

const choiceOptionSchema = z.object({
  value: z.string().min(1, "Choice value is required"),
  label: z.string().min(1, "Choice label is required"),
  priceAdjustment: z.coerce.number().optional(),
});

const customizationOptionSchema = z.object({
  id: z.string().min(1, "Option ID is required (e.g., color_option)"),
  label: z.string().min(1, "Option label is required"),
  type: z.enum(['select', 'text', 'checkbox']),
  required: z.boolean().optional().default(false),
  choices: z.array(choiceOptionSchema).optional(),
  maxLength: z.coerce.number().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
});

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  stock: z.coerce.number().int().min(0, "Stock must be a non-negative integer"),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  imageUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal('')),
  supplier: z.string().optional(),
  customizationOptions: z.array(customizationOptionSchema).optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const ALL_CATEGORIES_SENTINEL = "__ALL_CATEGORIES__";
const CLOUDINARY_COLLECTION_URL = "https://collection.cloudinary.com/dwqwwb2fh/6376c18334415e9e66450df7af51e5a0";

export default function AdminProductsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null);
  const [productToDelete, setProductToDelete] = useState<ProductType | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES_SENTINEL);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "", description: "", price: 0, stock: 0, categories: [], imageUrl: "", supplier: "", customizationOptions: []
    },
  });

  const { fields: customizationFields, append: appendCustomizationOption, remove: removeCustomizationOption } = useFieldArray({
    control: form.control,
    name: "customizationOptions",
  });

  const fetchProducts = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      const q = query(collection(db, 'products'), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedProducts: ProductType[] = [];
      querySnapshot.forEach((docSnapshot) => {
        fetchedProducts.push({ id: docSnapshot.id, ...docSnapshot.data() } as ProductType);
      });
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast({ title: "Error", description: "Failed to fetch products.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchProducts();
      }
    }
  }, [user, role, authLoading, router, fetchProducts]);

  const handleOpenDialog = (product: ProductType | null = null) => {
    setEditingProduct(product);
    if (product) {
      form.reset({
        name: product.name || "",
        description: product.description || "",
        price: product.price || 0,
        stock: product.stock || 0,
        categories: product.categories || [],
        imageUrl: product.imageUrl || "",
        supplier: product.supplier || "",
        customizationOptions: product.customizationOptions || [],
      });
    } else {
      form.reset({
        name: "", description: "", price: 0, stock: 0, categories: [], imageUrl: "", supplier: "", customizationOptions: []
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit: SubmitHandler<ProductFormValues> = async (values) => {
    if (!db) return;
    setIsSubmitting(true);
    
    const dataToSave: Omit<ProductFormValues, 'customizationOptions'> & { customizationOptions?: ProductCustomizationOption[], updatedAt: any, createdAt?: any } = {
      name: values.name,
      description: values.description,
      price: values.price,
      stock: values.stock,
      categories: values.categories,
      imageUrl: values.imageUrl,
      supplier: values.supplier,
      customizationOptions: values.customizationOptions?.map(opt => ({
        ...opt,
        choices: opt.type === 'select' ? opt.choices?.map(choice => ({...choice, priceAdjustment: choice.priceAdjustment || 0})) : undefined,
        maxLength: opt.type === 'text' ? opt.maxLength : undefined,
        placeholder: opt.type === 'text' ? opt.placeholder : undefined,
        defaultValue: opt.type === 'checkbox' ? (opt.defaultValue === true || opt.defaultValue === 'true') : (opt.type === 'text' ? opt.defaultValue : undefined),
      })) || [],
      updatedAt: serverTimestamp(),
    };
    if (!editingProduct) {
        dataToSave.createdAt = serverTimestamp();
    }

    try {
      if (editingProduct) {
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, dataToSave);
        toast({ title: "Product Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addDoc(collection(db, 'products'), dataToSave);
        toast({ title: "Product Created", description: `"${values.name}" has been added.` });
      }
      setIsDialogOpen(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error: any) {
      console.error("Failed to save product:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save product.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete || !db) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      toast({ title: "Product Deleted", description: `"${productToDelete.name}" has been deleted.` });
      setProductToDelete(null);
      fetchProducts();
    } catch (error: any) {
      console.error("Failed to delete product:", error);
      toast({ title: "Deletion Failed", description: error.message || "Could not delete product.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = categoryFilter !== ALL_CATEGORIES_SENTINEL ? product.categories?.includes(categoryFilter) : true;
      return nameMatch && categoryMatch;
    });
  }, [products, searchTerm, categoryFilter]);

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Unauthorized or session changed.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Product Catalog</h1>
          <p className="text-muted-foreground">Manage your inventory of giftable base products.</p>
        </div>
        <Button onClick={() => handleOpenDialog()}><PlusCircle className="mr-2 h-4 w-4" /> Create Product</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <Select
              value={categoryFilter === "" ? ALL_CATEGORIES_SENTINEL : categoryFilter}
              onValueChange={(value) => setCategoryFilter(value === ALL_CATEGORIES_SENTINEL ? "" : value)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_SENTINEL}>All Categories</SelectItem>
                {predefinedCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat.split(' (')[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || categoryFilter !== ALL_CATEGORIES_SENTINEL && categoryFilter !== "") && (
                <Button variant="outline" size="sm" onClick={() => {setSearchTerm(""); setCategoryFilter(ALL_CATEGORIES_SENTINEL);}}>Clear Filters</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && products.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredProducts.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{products.length === 0 ? "No products found. Start by creating one." : "No products match your search/filter criteria."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="w-16 h-16 relative bg-muted rounded-md overflow-hidden flex items-center justify-center">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.name} fill sizes="64px" className="object-cover" data-ai-hint={product.categories?.[0]?.toLowerCase() || "gift"}/>
                        ) : (
                          <ImageOff className="h-6 w-6 text-muted-foreground"/>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {product.categories?.map(cat => <Badge key={cat} variant="secondary">{cat.split(' (')[0]}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">Ksh {product.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{product.stock}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(product)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog open={productToDelete?.id === product.id} onOpenChange={(isOpen) => { if (!isOpen) setProductToDelete(null);}}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setProductToDelete(product)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredProducts.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredProducts.length} of {products.length} products.</p></CardFooter>}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) {setEditingProduct(null); form.reset();} }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Create New Product"}</DialogTitle>
            <DialogDescription>Fill in the details for the product and manage customization options.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <ScrollArea className="h-[calc(100vh-22rem)] md:h-[calc(80vh-12rem)] pr-6">
                <div className="space-y-6">
                  {/* Basic Product Info */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Basic Information</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Ceramic Mug 11oz" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="Detailed description of the product..." /></FormControl><FormMessage /></FormItem>)} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00" /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="stock" render={({ field }) => (<FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" {...field} placeholder="0" /></FormControl><FormMessage /></FormItem>)} />
                      </div>
                      <div className="space-y-2">
                        <Button type="button" variant="outline" onClick={() => window.open(CLOUDINARY_COLLECTION_URL, '_blank')}><UploadCloud className="mr-2 h-4 w-4" /> Browse Cloudinary Collection</Button>
                        <FormDescription>Open the Cloudinary collection, copy the desired image URL, and paste it below.</FormDescription>
                      </div>
                      <FormField control={form.control} name="imageUrl" render={({ field }) => (<FormItem><FormLabel>Image URL (Paste from Cloudinary)</FormLabel><div className="flex items-center gap-2"><FormControl><Input {...field} placeholder="https://res.cloudinary.com/..." /></FormControl>{field.value && (<a href={field.value} target="_blank" rel="noopener noreferrer" title="Open image in new tab"><Button type="button" variant="outline" size="icon"><ExternalLink className="h-4 w-4"/></Button></a>)}</div><FormMessage /></FormItem>)} />
                      {form.watch("imageUrl") && (<div className="my-2 p-2 border rounded-md flex justify-center items-center bg-muted aspect-video max-h-48 relative"><Image src={form.watch("imageUrl")!} alt="Image Preview" fill className="object-contain" onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = 'none'; const errorPlaceholder = target.parentElement?.querySelector('.error-placeholder'); if (errorPlaceholder) errorPlaceholder.classList.remove('hidden');}} data-ai-hint={"product image"}/><div className="error-placeholder hidden text-muted-foreground text-xs flex flex-col items-center"><ImageOff className="h-8 w-8 mb-1"/><span>Invalid URL or image</span></div></div>)}
                      <FormField control={form.control} name="supplier" render={({ field }) => (<FormItem><FormLabel>Supplier (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., Acme Supplies" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="categories" render={() => (<FormItem><FormLabel>Categories</FormLabel><ScrollArea className="h-40 rounded-md border p-2">{predefinedCategories.map((category) => (<FormField key={category} control={form.control} name="categories" render={({ field }) => (<FormItem key={category} className="flex flex-row items-start space-x-3 space-y-0 py-1.5"><FormControl><Checkbox checked={field.value?.includes(category)} onCheckedChange={(checked) => { return checked ? field.onChange([...(field.value || []), category]) : field.onChange((field.value || []).filter((value) => value !== category));}}/></FormControl><FormLabel className="font-normal text-sm">{category}</FormLabel></FormItem>)} />))}</ScrollArea><FormMessage /></FormItem>)}/>
                    </CardContent>
                  </Card>

                  {/* Customization Options */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Customization Options</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendCustomizationOption({ id: `opt_${Date.now()}`, label: '', type: 'text', required: false, choices: [], maxLength: undefined, placeholder: '', defaultValue: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Option
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {customizationFields.length === 0 && <p className="text-sm text-muted-foreground">No customization options added yet.</p>}
                      {customizationFields.map((field, index) => (
                        <Card key={field.id} className="p-4 border bg-muted/50">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium flex items-center"><GripVertical className="mr-1 h-4 w-4 cursor-grab text-muted-foreground"/> Option {index + 1}</h4>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomizationOption(index)}><MinusCircle className="h-4 w-4 text-destructive"/></Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name={`customizationOptions.${index}.label`} render={({ field }) => (<FormItem><FormLabel>Option Label</FormLabel><FormControl><Input {...field} placeholder="e.g., Color, Engraving Text"/></FormControl><FormMessage/></FormItem>)} />
                            <FormField control={form.control} name={`customizationOptions.${index}.id`} render={({ field }) => (<FormItem><FormLabel>Option ID</FormLabel><FormControl><Input {...field} placeholder="e.g., color_choice (unique)"/></FormControl><FormDescription className="text-xs">Unique identifier for this option.</FormDescription><FormMessage/></FormItem>)} />
                          </div>
                          <FormField control={form.control} name={`customizationOptions.${index}.type`} render={({ field: typeField }) => (
                            <FormItem className="mt-4"><FormLabel>Option Type</FormLabel>
                              <Select onValueChange={typeField.onChange} value={typeField.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select option type" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="select">Select List (Dropdown)</SelectItem>
                                  <SelectItem value="text">Text Input</SelectItem>
                                  <SelectItem value="checkbox">Checkbox (Yes/No)</SelectItem>
                                </SelectContent>
                              </Select><FormMessage/>
                            </FormItem>
                          )} />
                          
                          {form.watch(`customizationOptions.${index}.type`) === 'select' && (
                            <RenderSelectChoices control={form.control} nestIndex={index} />
                          )}
                          {form.watch(`customizationOptions.${index}.type`) === 'text' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                              <FormField control={form.control} name={`customizationOptions.${index}.placeholder`} render={({ field }) => (<FormItem><FormLabel>Placeholder</FormLabel><FormControl><Input {...field} placeholder="e.g., Enter your text here"/></FormControl><FormMessage/></FormItem>)} />
                              <FormField control={form.control} name={`customizationOptions.${index}.maxLength`} render={({ field }) => (<FormItem><FormLabel>Max Length</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 50"/></FormControl><FormMessage/></FormItem>)} />
                            </div>
                          )}
                           {form.watch(`customizationOptions.${index}.type`) === 'checkbox' && (
                             <FormField control={form.control} name={`customizationOptions.${index}.defaultValue`} render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 mt-3">
                                    <FormControl>
                                    <Checkbox
                                        checked={typeof field.value === 'boolean' ? field.value : String(field.value).toLowerCase() === 'true'}
                                        onCheckedChange={(checked) => field.onChange(checked)}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal">Default Checked State</FormLabel>
                                </FormItem>
                                )}
                            />
                           )}
                           <FormField control={form.control} name={`customizationOptions.${index}.required`} render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 mt-3">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <FormLabel className="font-normal">Required Option</FormLabel>
                                </FormItem>
                            )} />
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingProduct ? "Save Changes" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for rendering choices for 'select' type customization options
function RenderSelectChoices({ control, nestIndex }: { control: any, nestIndex: number }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `customizationOptions.${nestIndex}.choices`
  });

  return (
    <div className="mt-3 space-y-3 p-3 border rounded-md bg-background">
      <div className="flex justify-between items-center">
        <h5 className="text-sm font-medium">Choices for Select List</h5>
        <Button type="button" size="sm" variant="outline" onClick={() => append({ value: '', label: '', priceAdjustment: 0 })}>
          <PlusCircle className="mr-1 h-3 w-3"/> Add Choice
        </Button>
      </div>
      {fields.length === 0 && <p className="text-xs text-muted-foreground">No choices added yet.</p>}
      {fields.map((choiceField, choiceIndex) => (
        <div key={choiceField.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end p-2 border rounded bg-muted/20">
          <FormField control={control} name={`customizationOptions.${nestIndex}.choices.${choiceIndex}.label`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Display Label</FormLabel><FormControl><Input {...field} placeholder="e.g., Red, Small"/></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <FormField control={control} name={`customizationOptions.${nestIndex}.choices.${choiceIndex}.value`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Value (Unique)</FormLabel><FormControl><Input {...field} placeholder="e.g., red, sm"/></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <FormField control={control} name={`customizationOptions.${nestIndex}.choices.${choiceIndex}.priceAdjustment`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Price Adj. (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00"/></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <Button type="button" variant="ghost" size="sm" className="col-span-full sm:col-span-1 sm:ml-auto mt-1 h-8" onClick={() => remove(choiceIndex)}>Remove Choice</Button>
        </div>
      ))}
    </div>
  );
}

