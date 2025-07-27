
"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Search, Filter, ExternalLink, ImageOff } from 'lucide-react';
import type { Product as ProductType } from '@/types';
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';

import { collection, getDocs, doc, deleteDoc, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';


const predefinedCategories = [
  "Drinkware (Mugs, Tumblers, Flasks)", "Apparel (T-shirts, Hoodies, Caps)", "Stationery (Pens, Notebooks, Journals)",
  "Keepsakes (Keychains, Photo Frames, Ornaments)", "Home & Office Decor (Plaques, Coasters, Desk Accessories)",
  "Jewelry & Accessories (Bracelets, Necklaces, Bags, Wallets)", "Tech Gadgets (Power Banks, Earbuds, Phone Stands)",
  "Gourmet & Edibles (Gift Baskets, Chocolates)", "Experiences (Voucher base items)", "Gift Boxes",
  "Seasonal & Holiday Specials", "For Him", "For Her", "For Kids", "For Pets", "Corporate Gifts", "Eco-Friendly"
];

const ALL_CATEGORIES_SENTINEL = "__ALL_CATEGORIES__";

export default function AdminProductsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productToDelete, setProductToDelete] = useState<ProductType | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES_SENTINEL);


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
        <Link href="/admin/products/new" passHref>
           <Button><PlusCircle className="mr-2 h-4 w-4" /> Create Product</Button>
        </Link>
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
                      {/* TODO: Add Edit Product Page Link here -> /admin/products/edit/[productId] */}
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/products/edit/${product.id}`)}><Edit className="h-4 w-4" /></Button>
                      <AlertDialog open={productToDelete?.id === product.id} onOpenChange={(isOpen) => { if (!isOpen) setProductToDelete(null);}}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setProductToDelete(product)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
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
    </div>
  );
}
