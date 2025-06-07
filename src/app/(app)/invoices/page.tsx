
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Invoice, InvoiceStatus } from "@/types"; 
import { FileText, PlusCircle, Search, Download, Eye, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const formatKsh = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const getInvoiceStatusBadgeVariant = (status: InvoiceStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'draft': return 'outline';
    case 'sent': return 'statusBlue'; 
    case 'pending_approval': return 'statusYellow'; 
    case 'approved_for_payment': return 'statusAmber'; 
    case 'paid': return 'statusGreen';
    case 'overdue': return 'statusRed';
    case 'cancelled':
    case 'rejected':
      return 'statusRed';
    default: return 'outline';
  }
};

export default function InvoicesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [actionableInvoice, setActionableInvoice] = useState<Invoice | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchInvoices = useCallback(() => {
    if (!db || !user || (role !== 'FinanceManager' && role !== 'Admin' && role !== 'Supplier')) {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    let q;
    if (role === 'Supplier') {
      q = query(collection(db, 'invoices'), where("supplierId", "==", user.uid), orderBy("createdAt", "desc"));
    } else { 
      q = query(collection(db, 'invoices'), where("status", "==", "pending_approval"), orderBy("createdAt", "desc"));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching invoices:", error);
      toast({ title: "Error", description: "Could not load invoices.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [db, user, role, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !['Supplier', 'FinanceManager', 'Admin'].includes(role || '')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchInvoices();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchInvoices]);


  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role !== 'Supplier' && inv.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate ? format(timestamp.toDate(), 'PP') : 'Invalid Date';
  };
  
  const handleOpenActionModal = (invoice: Invoice, type: "approve" | "reject") => {
    setActionableInvoice(invoice);
    setActionType(type);
    setRejectionReason(""); 
    setIsActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!db || !user || !actionableInvoice || !actionType) return;
    setIsSubmittingAction(true);

    const newStatus: InvoiceStatus = actionType === "approve" ? 'approved_for_payment' : 'rejected';
    const updateData: any = {
      status: newStatus,
      updatedAt: serverTimestamp(),
      financeManagerId: user.uid, 
      financeManagerName: user.displayName || user.email,
    };
    if (actionType === "reject") {
      updateData.notes = `Rejected by finance: ${rejectionReason}. Previous notes: ${actionableInvoice.notes || ""}`.trim();
    }

    try {
      const invoiceRef = doc(db, 'invoices', actionableInvoice.id);
      await updateDoc(invoiceRef, updateData);
      toast({ title: `Invoice ${actionType === "approve" ? "Approved" : "Rejected"}`, description: `Invoice ${actionableInvoice.invoiceNumber} has been ${newStatus.replace(/_/g, ' ')}.` });
      setIsActionModalOpen(false);
      setActionableInvoice(null);
    } catch (e: any) {
      console.error(`Error ${actionType}ing invoice:`, e);
      toast({ title: "Error", description: `Could not ${actionType} the invoice.`, variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };


  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Supplier' ? "My Submitted Invoices" : "Manage Supplier Invoices"}
        </h1>
        <div className="flex gap-2">
          {role === 'Supplier' && 
            <Link href="/supplier/invoices/new" passHref>
              <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Create New Invoice</Button>
            </Link>
          }
        </div>
      </div>
      <CardDescription>
        {role === 'Supplier' ? "Track your submitted invoices." : "View, approve, and manage supplier invoices awaiting payment."}
      </CardDescription>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by Invoice # or Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
          ) : filteredInvoices.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">
              {invoices.length === 0 ? (role === 'Supplier' ? "You have not submitted any invoices yet." : "No invoices awaiting approval.") : "No invoices match your search."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  {(role === 'FinanceManager' || role === 'Admin') && <TableHead>Supplier</TableHead>}
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    {(role === 'FinanceManager' || role === 'Admin') && <TableCell className="text-xs">{inv.supplierName || 'N/A'}</TableCell>}
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>{formatDate(inv.dueDate)}</TableCell>
                    <TableCell>{formatKsh(inv.totalAmount)}</TableCell>
                    <TableCell><Badge variant={getInvoiceStatusBadgeVariant(inv.status)} className="capitalize">{inv.status.replace(/_/g, ' ')}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" title="View Details (Not Implemented Yet)"><Eye className="h-4 w-4" /></Button>
                      {(role === 'FinanceManager' || role === 'Admin') && inv.status === 'pending_approval' && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(inv, "approve")} title="Approve Invoice">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(inv, "reject")} title="Reject Invoice">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {(role === 'FinanceManager' || role === 'Admin') && filteredInvoices.length > 0 && (
            <CardFooter className="pt-4 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Showing {filteredInvoices.length} invoices pending approval.</p>
            </CardFooter>
        )}
         {role === 'Supplier' && filteredInvoices.length > 0 && (
            <CardFooter className="pt-4">
                <p className="text-xs text-muted-foreground">Showing {filteredInvoices.length} of your invoices.</p>
            </CardFooter>
        )}
      </Card>

      <Dialog open={isActionModalOpen} onOpenChange={(isOpen) => { if (!isOpen) setActionableInvoice(null); setIsActionModalOpen(isOpen); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} Invoice {actionableInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Supplier: {actionableInvoice?.supplierName}. Amount: {formatKsh(actionableInvoice?.totalAmount || 0)}.
            </DialogDescription>
          </DialogHeader>
          {actionType === "reject" && (
            <div className="py-2 space-y-1">
              <Label htmlFor="rejectionReason">Reason for Rejection (Required)</Label>
              <Textarea 
                id="rejectionReason" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a clear reason for rejection..."
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmAction} 
              disabled={isSubmittingAction || (actionType === "reject" && !rejectionReason.trim())}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Confirm {actionType?.charAt(0).toUpperCase() + (actionType || '').slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
