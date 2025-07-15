
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, PackageSearch, RefreshCw, Edit } from 'lucide-react';
import type { StockRequest, StockRequestStatus, Product } from '@/types';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const getStockRequestStatusVariant = (status: StockRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending_finance_approval': return 'statusYellow';
    case 'pending_supplier_fulfillment': return 'statusAmber';
    case 'awaiting_receipt': return 'statusBlue'; 
    case 'received': return 'statusGreen'; 
    case 'fulfilled': return 'statusGreen'; 
    case 'rejected_finance':
    case 'rejected_supplier':
    case 'cancelled': 
      return 'statusRed';
    default: return 'outline';
  }
};

export default function InventoryReceivershipPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [actionableRequest, setActionableRequest] = useState<StockRequest | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivedQuantity, setReceivedQuantity] = useState<number | string>("");
  const [receiptNotes, setReceiptNotes] = useState("");
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState(false);

  const fetchRequests = useCallback(() => {
    if (!db || !user || !['InventoryManager', 'Admin'].includes(role || '')) {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    const q = query(
        collection(db, 'stockRequests'), 
        where("status", "==", "awaiting_receipt"),
        orderBy("supplierActionTimestamp", "desc") 
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching stock requests for receipt:", error);
      toast({ title: "Error", description: "Could not load stock requests.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [db, user, role, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['InventoryManager', 'Admin'].includes(role || '')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchRequests();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchRequests]);

  const handleOpenReceiveModal = (request: StockRequest) => {
    setActionableRequest(request);
    setReceivedQuantity(request.fulfilledQuantity || request.requestedQuantity); 
    setReceiptNotes("");
    setIsReceiveModalOpen(true);
  };

  const handleConfirmReceipt = async () => {
    if (!db || !user || !actionableRequest || receivedQuantity === "") return;
    
    const numReceivedQuantity = Number(receivedQuantity);
    if (isNaN(numReceivedQuantity) || numReceivedQuantity < 0) { 
      toast({ title: "Invalid Quantity", description: "Received quantity must be a non-negative number.", variant: "destructive" });
      return;
    }

    setIsSubmittingReceipt(true);
    try {
      await runTransaction(db, async (transaction) => {
        const stockRequestRef = doc(db, 'stockRequests', actionableRequest.id);
        const productRef = doc(db, 'products', actionableRequest.productId);

        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) {
          throw new Error("Product not found in inventory.");
        }
        const currentStock = productDoc.data().stock as number;
        const newStock = currentStock + numReceivedQuantity;

        transaction.update(stockRequestRef, {
          status: 'received',
          receivedQuantity: numReceivedQuantity,
          inventoryManagerReceiptNotes: receiptNotes || (numReceivedQuantity < (actionableRequest.fulfilledQuantity || actionableRequest.requestedQuantity) ? "Discrepancy noted." : "Received as expected."),
          receivedById: user.uid,
          receivedByName: user.displayName || user.email,
          receivedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        transaction.update(productRef, {
          stock: newStock,
          updatedAt: serverTimestamp()
        });
      });
      
      toast({ title: "Stock Received", description: `Receipt for ${actionableRequest.productName} confirmed. Stock updated.` });
      setIsReceiveModalOpen(false);
      setActionableRequest(null);
      fetchRequests(); 
    } catch (e: any) {
      console.error("Error confirming receipt:", e);
      toast({ title: "Error", description: e.message || "Could not confirm receipt.", variant: "destructive" });
    } finally {
      setIsSubmittingReceipt(false);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><PackageSearch className="h-7 w-7 text-primary"/>Stock Receivership</h1>
        <Button onClick={fetchRequests} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Review and acknowledge receipt of stock from suppliers.</p>

      <Card>
        <CardContent className="p-0">
          {isLoading && requests.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : requests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No stock items are currently awaiting your receipt.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty Req.</TableHead>
                <TableHead>Qty Sent (Supplier)</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Supplier Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.productName}</TableCell>
                    <TableCell>{req.requestedQuantity}</TableCell>
                    <TableCell>{req.fulfilledQuantity ?? 'N/A'}</TableCell>
                    <TableCell className="text-xs">{req.supplierName || 'N/A'}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{req.supplierNotes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="default" size="sm" onClick={() => handleOpenReceiveModal(req)} title="Acknowledge Receipt">
                        <CheckCircle className="mr-1 h-3 w-3" /> Receive
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {requests.length > 0 && 
          <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {requests.length} items awaiting receipt.</p></CardFooter>}
      </Card>

      <Dialog open={isReceiveModalOpen} onOpenChange={(isOpen) => { if (!isOpen) setActionableRequest(null); setIsReceiveModalOpen(isOpen); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Receipt for {actionableRequest?.productName}</DialogTitle>
            <DialogDescription>
              Supplier reported fulfilling: {actionableRequest?.fulfilledQuantity ?? actionableRequest?.requestedQuantity} units.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
                <Label htmlFor="receivedQuantity">Actual Quantity Received</Label>
                <Input 
                    id="receivedQuantity" 
                    type="number"
                    value={receivedQuantity}
                    onChange={(e) => setReceivedQuantity(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                    min="0"
                />
            </div>
            <div>
                <Label htmlFor="receiptNotes">Receipt Notes (Optional)</Label>
                <Textarea 
                    id="receiptNotes" 
                    value={receiptNotes} 
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    placeholder="e.g., Damaged items, quantity discrepancy..."
                />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmReceipt} 
              disabled={isSubmittingReceipt || receivedQuantity === "" || Number(receivedQuantity) < 0}
            >
              {isSubmittingReceipt && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Confirm Receipt & Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    
