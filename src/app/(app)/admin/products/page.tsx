
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
import { Loader2, PlusCircle, Edit, Trash2, Search, FilterIcon, ExternalLink, ImageOff } from 'lucide-react';
import type { Product as ProductType } from '@/types';
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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

const productFormSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().min(0, "Price must be a positive number"),
  stock: z.coerce.number().int().min(0, "Stock must be a non-negative integer"),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  imageUrl: z.string().url({ message: "Please enter a valid URL" }).optional().or(z.literal('')),
  supplier: z.string().optional(),
  sku: z.string().optional(),
  dataAiHint: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

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
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "", description: "", price: 0, stock: 0, categories: [], imageUrl: "", supplier: "", sku: "", dataAiHint: ""
    },
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
      querySnapshot.forEach((docSnapshot) => { // Using docSnapshot
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
        ...product,
        categories: product.categories || [],
      });
    } else {
      form.reset({
        name: "", description: "", price: 0, stock: 0, categories: [], imageUrl: "", supplier: "", sku: "", dataAiHint: ""
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit: SubmitHandler<ProductFormValues> = async (values) => {
    if (!db) return;
    setIsSubmitting(true);
    const dataToSave = {
      ...values,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingProduct) {
        const productRef = doc(db, 'products', editingProduct.id);
        await updateDoc(productRef, dataToSave);
        toast({ title: "Product Updated", description: `"${values.name}" has been updated.` });
      } else {
        await addDoc(collection(db, 'products'), { ...dataToSave, createdAt: serverTimestamp() });
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
      const skuMatch = product.sku ? product.sku.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      const categoryMatch = categoryFilter ? product.categories?.includes(categoryFilter) : true;
      return (nameMatch || skuMatch) && categoryMatch;
    });
  }, [products, searchTerm, categoryFilter]);

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Unauthorized or session changed.</div>;
  }
  
  // console.log("Preparing to render AdminProductsPage main content."); // Debug log

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
                placeholder="Search by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {predefinedCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat.split(' (')[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || categoryFilter) && (
                <Button variant="outline" size="sm" onClick={() => {setSearchTerm(""); setCategoryFilter("");}}>Clear Filters</Button>
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
                  <TableHead>SKU</TableHead>
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
                          <Image src={product.imageUrl} alt={product.name} fill sizes="64px" className="object-cover" data-ai-hint={product.dataAiHint || product.categories?.[0]?.toLowerCase() || "gift"}/>
                        ) : (
                          <ImageOff className="h-6 w-6 text-muted-foreground"/>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.sku || '-'}</TableCell>
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
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Create New Product"}</DialogTitle>
            <DialogDescription>Fill in the details for the product.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <ScrollArea className="h-[calc(100vh-20rem)] md:h-[calc(80vh-10rem)] pr-6">
                <div className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Ceramic Mug 11oz" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="Detailed description of the product..." /></FormControl><FormMessage /></FormItem>)} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="e.g., 350.00" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="stock" render={({ field }) => (<FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 100" /></FormControl><FormMessage /></FormItem>)} />
                  </div>
                  <FormField control={form.control} name="imageUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                       <div className="flex items-center gap-2">
                        <FormControl><Input {...field} placeholder="https://..." /></FormControl>
                        {field.value && (
                          <a href={field.value} target="_blank" rel="noopener noreferrer" title="Open image in new tab">
                            <Button type="button" variant="outline" size="icon"><ExternalLink className="h-4 w-4"/></Button>
                          </a>
                        )}
                      </div>
                      <FormDescription>Enter a direct link to the product image (e.g., from Google Drive, Imgur, or your own CDN).</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                   {form.watch("imageUrl") && (
                    <div className="my-2 p-2 border rounded-md flex justify-center items-center bg-muted aspect-video max-h-48 relative">
                      <Image src={form.watch("imageUrl")!} alt="Image Preview" fill className="object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement?.querySelector('.error-placeholder')?.classList.remove('hidden');}}
                        data-ai-hint={form.watch("dataAiHint") || "product image"}
                      />
                      <div className="error-placeholder hidden text-muted-foreground text-xs flex flex-col items-center"><ImageOff className="h-8 w-8 mb-1"/><span>Invalid URL or image</span></div>
                    </div>
                   )}

                  <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., ZMUG-WHT-11" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="supplier" render={({ field }) => (<FormItem><FormLabel>Supplier (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., Acme Supplies" /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="dataAiHint" render={({ field }) => (<FormItem><FormLabel>AI Image Hint (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., white mug, blue t-shirt" /></FormControl><FormDescription>Max 2 keywords for AI placeholder generation if image URL is missing/invalid.</FormDescription><FormMessage /></FormItem>)} />
                  
                  <FormField
                    control={form.control}
                    name="categories"
                    render={() => (
                      <FormItem>
                        <FormLabel>Categories</FormLabel>
                        <ScrollArea className="h-40 rounded-md border p-2">
                          {predefinedCategories.map((category) => (
                            <FormField
                              key={category}
                              control={form.control}
                              name="categories"
                              render={({ field }) => {
                                return (
                                  <FormItem key={category} className="flex flex-row items-start space-x-3 space-y-0 py-1.5">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(category)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...(field.value || []), category])
                                            : field.onChange(
                                                (field.value || []).filter(
                                                  (value) => value !== category
                                                )
                                              );
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal text-sm">
                                      {category}
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </ScrollArea>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
