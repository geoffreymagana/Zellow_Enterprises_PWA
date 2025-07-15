
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Product, StockRequest, StockRequestStatus } from "@/types";
import { PlusCircle, Search, Edit, AlertTriangle, RefreshCw, Boxes, ClipboardList, ImageOff, Gavel } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy, where, doc, addDoc, serverTimestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { format } from 'date-fns';
import Image from "next/image";
import { cn } from "@/lib/utils";

const requestStockFormSchema = z.object({
  requestedQuantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});
type RequestStockFormValues = z.infer<typeof requestStockFormSchema>;

const LOW_STOCK_THRESHOLD = 10;

const formatKsh = (amount?: number): string => {
    if (amount === undefined || amount === null) return 'N/A';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
};

const getStockLevelColor = (stock: number): string => {
  if (stock === 0) return 'bg-destructive';
  if (stock < LOW_STOCK_THRESHOLD) return 'bg-orange-500';
  return 'bg-green-500';
};

const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_bids': return 'statusYellow';
    case 'pending_award': return 'statusAmber';
    case 'awarded': return 'statusIndigo';
    case 'awaiting_fulfillment': return 'statusLightBlue';
    case 'received': return 'statusGreen';
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance': return 'statusRed';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

export default function InventoryPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [productToRequest, setProductToRequest] = useState<Product | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const requestForm = useForm<RequestStockFormValues>({
    resolver: zodResolver(requestStockFormSchema),
    defaultValues: { requestedQuantity: 1, notes: "" },
  });

  const fetchProducts = useCallback(async () => {
    if (!db) return;
    setIsLoadingProducts(true);
    try {
      const q = query(collection(db, 'products'), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    } catch (e: any) {
      console.error("Error fetching products:", e);
      toast({ title: "Error", description: "Could not load products.", variant: "destructive" });
    } finally {
      setIsLoadingProducts(false);
    }
  }, [toast]);

  const fetchStockRequests = useCallback(() => {
    if (!db || !user || role !== 'InventoryManager') {
      setIsLoadingRequests(false);
      return () => {};
    }
    setIsLoadingRequests(true);
    const q = query(
      collection(db, 'stockRequests'), 
      where("requesterId", "==", user.uid), 
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setStockRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
      setIsLoadingRequests(false);
    }, (error) => {
      console.error("Error fetching stock requests:", error);
      toast({ title: "Error", description: "Could not load stock requests.", variant: "destructive" });
      setIsLoadingRequests(false);
    });
    return unsubscribe;
  }, [db, user, role, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['InventoryManager', 'Admin'].includes(role || '')) {
      router.replace('/dashboard');
    } else {
      fetchProducts();
      const unsubRequests = fetchStockRequests();
      return () => {
        if (unsubRequests) unsubRequests();
      };
    }
  }, [authLoading, user, role, router, fetchProducts, fetchStockRequests]);

  const filteredAndSortedProducts = useMemo(() => {
    let searchFiltered = products.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categories?.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    searchFiltered.sort((a, b) => {
      if (a.stock === 0 && b.stock !== 0) return -1;
      if (a.stock !== 0 && b.stock === 0) return 1;
      const aIsLowStock = a.stock > 0 && a.stock < LOW_STOCK_THRESHOLD;
      const bIsLowStock = b.stock > 0 && b.stock < LOW_STOCK_THRESHOLD;
      if (aIsLowStock && !bIsLowStock) return -1;
      if (!aIsLowStock && bIsLowStock) return 1;
      if (aIsLowStock && bIsLowStock) {
        if (a.stock !== b.stock) return a.stock - b.stock;
      }
      return a.name.localeCompare(b.name);
    });
    return searchFiltered;
  }, [products, searchTerm]);

  const handleOpenRequestDialog = (product: Product) => {
    setProductToRequest(product);
    requestForm.reset({ requestedQuantity: 1, notes: "" });
    setIsRequestDialogOpen(true);
  };

  const onRequestStockSubmit = async (values: RequestStockFormValues) => {
    if (!db || !user || !productToRequest) return;
    setIsSubmittingRequest(true);
    try {
      const newRequest: Omit<StockRequest, 'id' | 'createdAt' | 'updatedAt' | 'bids'> = {
        productId: productToRequest.id,
        productName: productToRequest.name,
        requestedQuantity: values.requestedQuantity,
        requesterId: user.uid,
        requesterName: user.displayName || user.email || "Unknown User",
        status: 'pending_bids',
        notes: values.notes || "",
      };
      await addDoc(collection(db, 'stockRequests'), {
        ...newRequest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        bids: [], // Initialize with an empty array of bids
      });
      toast({ title: "Stock Request Submitted", description: `Request for ${productToRequest.name} is now open for bidding.` });
      setIsRequestDialogOpen(false);
      setProductToRequest(null);
    } catch (e: any) {
      console.error("Error submitting stock request:", e);
      toast({ title: "Error", description: "Could not submit stock request.", variant: "destructive" });
    } finally {
      setIsSubmittingRequest(false);
    }
  };
  
  const formatDate = (timestamp: any, includeTime: boolean = false) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return includeTime ? format(date, 'PPp') : format(date, 'PP');
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Inventory Management</h1>
        <div className="flex gap-2">
          <Button onClick={fetchProducts} variant="outline" size="sm" disabled={isLoadingProducts}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} /> Refresh Products
          </Button>
          {role === 'InventoryManager' && (
            <Button onClick={fetchStockRequests} variant="outline" size="sm" disabled={isLoadingRequests}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingRequests ? 'animate-spin' : ''}`} /> Refresh Requests
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">
        View product stock levels. 
        {role === 'InventoryManager' && " Initiate requests for bids from suppliers."}
      </p>

      <div className="mb-6">
        <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search products (ID, Name, Category)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full h-10"
            />
        </div>
      </div>

      {isLoadingProducts && products.length === 0 ? (
        <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
      ) : filteredAndSortedProducts.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">{products.length === 0 ? "No products found." : "No products match search."}</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredAndSortedProducts.map((item) => (
            <Card key={item.id} className="flex overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className={cn("w-2 flex-shrink-0", getStockLevelColor(item.stock))}></div>
              <div className="flex-grow p-3 flex flex-col">
                <div className="flex items-start gap-3 mb-2">
                  <div className="relative w-20 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <Image 
                        src={item.imageUrl} 
                        alt={item.name} 
                        fill
                        sizes="80px"
                        className="object-cover"
                        data-ai-hint={item.categories?.[0]?.toLowerCase() || "inventory item"}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageOff className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-sm font-semibold line-clamp-3 mb-1">{item.name}</h3>
                  </div>
                </div>
                
                <div className="mt-auto flex justify-between items-end">
                  <div className="text-left">
                      <p className="text-xs text-muted-foreground">Stock</p>
                      <p className="text-xl font-bold">{item.stock}</p>
                  </div>
                  {role === 'InventoryManager' && (
                    <Button variant="outline" size="sm" onClick={() => handleOpenRequestDialog(item)} disabled={isRequestDialogOpen}>
                      <Gavel className="mr-1 h-3 w-3"/> Request Bids
                    </Button>
                  )}
                  {role === 'Admin' && (
                      <Link href={`/admin/products/edit/${item.id}`} passHref>
                        <Button variant="ghost" size="icon" aria-label="Edit Product Details"><Edit className="h-4 w-4"/></Button>
                      </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {filteredAndSortedProducts.length > 0 && !isLoadingProducts && <p className="text-xs text-muted-foreground mt-4">Showing {filteredAndSortedProducts.length} of {products.length} products.</p>}
      
      {role === 'InventoryManager' && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5"/>My Stock Requests</CardTitle>
                <CardDescription>Track the status of your pending and past stock requests.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingRequests && stockRequests.length === 0 ? (
                    <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
                ) : stockRequests.length === 0 ? (
                    <p className="p-6 text-center text-muted-foreground">You haven't made any stock requests yet.</p>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stockRequests.map(req => (
                        <Card key={req.id} className="shadow-md">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-base font-semibold">{req.productName}</CardTitle>
                                    <Badge variant={getStockRequestStatusVariant(req.status)} className="capitalize text-xs whitespace-nowrap">{req.status.replace(/_/g, ' ')}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-xs space-y-1.5 pt-0 pb-3">
                                <p><strong>Qty Requested:</strong> {req.requestedQuantity}</p>
                                <p><strong>Date:</strong> {formatDate(req.createdAt)}</p>
                                {req.notes && <p className="truncate" title={req.notes}><strong>Your Notes:</strong> {req.notes}</p>}
                                {req.financeNotes && <p className="truncate" title={req.financeNotes}><strong>Finance Notes:</strong> {req.financeNotes}</p>}
                                {req.supplierName && <p className="text-green-600 truncate" title={req.supplierName}><strong>Awarded To:</strong> {req.supplierName}</p>}
                                {req.supplierPrice && <p className="text-green-600"><strong>Price:</strong> {formatKsh(req.supplierPrice)}/unit</p>}
                                {req.receivedQuantity !== undefined && <p><strong>Qty Received:</strong> {req.receivedQuantity}</p>}
                            </CardContent>
                        </Card>
                    ))}
                </div>
                )}
            </CardContent>
            {stockRequests.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {stockRequests.length} requests.</p></CardFooter>}
        </Card>
      )}

      <Dialog open={isRequestDialogOpen} onOpenChange={(open) => { if (!open) setProductToRequest(null); setIsRequestDialogOpen(open);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Bids for: {productToRequest?.name}</DialogTitle>
            <DialogDescription>Specify quantity and any notes. This will be visible to all suppliers.</DialogDescription>
          </DialogHeader>
          <form onSubmit={requestForm.handleSubmit(onRequestStockSubmit)} className="space-y-4 py-2">
            <div>
              <Label htmlFor="requestedQuantity">Quantity to Request</Label>
              <Input id="requestedQuantity" type="number" {...requestForm.register("requestedQuantity")} min="1" />
              {requestForm.formState.errors.requestedQuantity && <p className="text-xs text-destructive mt-1">{requestForm.formState.errors.requestedQuantity.message}</p>}
            </div>
            <div>
              <Label htmlFor="notes">Notes for Suppliers (Optional)</Label>
              <Textarea id="notes" {...requestForm.register("notes")} placeholder="e.g., Specific material requirements, delivery window preferences."/>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmittingRequest}>
                {isSubmittingRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit Request for Bids
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
