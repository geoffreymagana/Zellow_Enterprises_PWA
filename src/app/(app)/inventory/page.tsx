
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
import { PlusCircle, Search, Edit, AlertTriangle, PackageCheck, PackageX, RefreshCw, Archive, ShoppingBasket, ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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

const requestStockFormSchema = z.object({
  requestedQuantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});
type RequestStockFormValues = z.infer<typeof requestStockFormSchema>;

const StockBadge = ({ stock }: { stock: number }) => {
  let variant: BadgeProps['variant'] = "default";
  let icon = <PackageCheck className="h-3 w-3 mr-1" />;
  if (stock === 0) {
    variant = "destructive";
    icon = <PackageX className="h-3 w-3 mr-1" />;
  } else if (stock < 20) { 
    variant = "statusOrange"; // Using one of the custom status colors
    icon = <AlertTriangle className="h-3 w-3 mr-1 text-white" />; // Ensure icon is visible on orange
  }
  return <Badge variant={variant} className="flex items-center text-xs">{icon}{stock} in stock</Badge>;
};

const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_finance_approval': return 'statusYellow';
    case 'pending_supplier_fulfillment': return 'statusAmber';
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance':
    case 'rejected_supplier':
    case 'cancelled': 
      return 'statusRed';
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
    if (!user || !['InventoryManager', 'SupplyManager', 'Admin'].includes(role || '')) {
      router.replace('/dashboard');
    } else {
      fetchProducts();
      const unsubRequests = fetchStockRequests();
      return () => {
        if (unsubRequests) unsubRequests();
      };
    }
  }, [authLoading, user, role, router, fetchProducts, fetchStockRequests]);

  const filteredProducts = products.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categories?.some(cat => cat.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenRequestDialog = (product: Product) => {
    setProductToRequest(product);
    requestForm.reset({ requestedQuantity: 1, notes: "" });
    setIsRequestDialogOpen(true);
  };

  const onRequestStockSubmit = async (values: RequestStockFormValues) => {
    if (!db || !user || !productToRequest) return;
    setIsSubmittingRequest(true);
    try {
      const newRequest: Omit<StockRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        productId: productToRequest.id,
        productName: productToRequest.name,
        requestedQuantity: values.requestedQuantity,
        requesterId: user.uid,
        requesterName: user.displayName || user.email || "Unknown User",
        supplierId: productToRequest.supplier, // Use product's default supplier if available
        status: 'pending_finance_approval',
        notes: values.notes || "",
      };
      await addDoc(collection(db, 'stockRequests'), {
        ...newRequest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Stock Request Submitted", description: `Request for ${productToRequest.name} sent for approval.` });
      setIsRequestDialogOpen(false);
      setProductToRequest(null);
    } catch (e: any) {
      console.error("Error submitting stock request:", e);
      toast({ title: "Error", description: "Could not submit stock request.", variant: "destructive" });
    } finally {
      setIsSubmittingRequest(false);
    }
  };
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate ? format(timestamp.toDate(), 'PPp') : 'Invalid Date';
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
        {role === 'InventoryManager' && " Request new stock from suppliers."}
        {role === 'SupplyManager' && " Approve incoming stock from suppliers."}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Archive className="h-5 w-5" /> Current Stock Levels</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search products (ID, Name, Category)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingProducts && products.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredProducts.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{products.length === 0 ? "No products found." : "No products match search."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Current Stock</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs">{item.categories?.join(', ') || 'N/A'}</TableCell>
                    <TableCell className="text-center"><StockBadge stock={item.stock} /></TableCell>
                    <TableCell className="text-right">
                      {role === 'InventoryManager' && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenRequestDialog(item)} disabled={isRequestDialogOpen}>
                          <ShoppingBasket className="mr-1 h-3 w-3"/> Request Stock
                        </Button>
                      )}
                      {(role === 'Admin' || role === 'SupplyManager') && (
                         <Link href={`/admin/products/edit/${item.id}`} passHref>
                           <Button variant="ghost" size="icon" aria-label="Edit Product Details"><Edit className="h-4 w-4" /></Button>
                         </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredProducts.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredProducts.length} of {products.length} products.</p></CardFooter>}
      </Card>
      
      {role === 'InventoryManager' && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5"/>My Stock Requests</CardTitle>
                <CardDescription>Track the status of your pending and past stock requests.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {isLoadingRequests && stockRequests.length === 0 ? (
                    <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
                ) : stockRequests.length === 0 ? (
                    <p className="p-6 text-center text-muted-foreground">You haven't made any stock requests yet.</p>
                ) : (
                <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Req.</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {stockRequests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell className="font-medium">{req.productName}</TableCell>
                                <TableCell>{req.requestedQuantity}</TableCell>
                                <TableCell><Badge variant={getStockRequestStatusVariant(req.status)} className="capitalize text-xs">{req.status.replace(/_/g, ' ')}</Badge></TableCell>
                                <TableCell className="text-xs">{formatDate(req.createdAt)}</TableCell>
                                <TableCell className="text-xs max-w-xs truncate">{req.notes || '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                )}
            </CardContent>
            {stockRequests.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {stockRequests.length} requests.</p></CardFooter>}
        </Card>
      )}


      <Dialog open={isRequestDialogOpen} onOpenChange={(open) => { if (!open) setProductToRequest(null); setIsRequestDialogOpen(open);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Stock for: {productToRequest?.name}</DialogTitle>
            <DialogDescription>Specify quantity and any notes for this stock request.</DialogDescription>
          </DialogHeader>
          <form onSubmit={requestForm.handleSubmit(onRequestStockSubmit)} className="space-y-4 py-2">
            <div>
              <Label htmlFor="requestedQuantity">Quantity to Request</Label>
              <Input id="requestedQuantity" type="number" {...requestForm.register("requestedQuantity")} min="1" />
              {requestForm.formState.errors.requestedQuantity && <p className="text-xs text-destructive mt-1">{requestForm.formState.errors.requestedQuantity.message}</p>}
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" {...requestForm.register("notes")} placeholder="e.g., Urgent requirement, specific supplier preference."/>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSubmittingRequest}>
                {isSubmittingRequest && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
