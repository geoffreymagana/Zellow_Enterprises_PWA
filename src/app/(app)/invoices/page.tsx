
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Invoice, InvoiceStatus } from "@/types"; 
import { FileText, Search, Download, Eye, Loader2, CheckCircle, XCircle, CalendarDays, FileClock, AlertCircle, CheckCircle2 as PaidIcon, Hourglass, FileX, FileDiff, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const isInvoiceOverdue = (invoice: Invoice): boolean => {
  if (!invoice.dueDate || ['paid', 'cancelled', 'rejected'].includes(invoice.status)) {
    return false;
  }
  const dueDate = invoice.dueDate.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
  return isPast(dueDate) && !isToday(dueDate);
};


export default function InvoicesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<InvoiceStatus | "all" | "overdue" | "approved_unpaid">("pending_approval");
  
  const [summaryCounts, setSummaryCounts] = useState({
    today: 0,
    pendingApproval: 0,
    approvedUnpaid: 0,
    overdue: 0,
  });

  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [actionableInvoice, setActionableInvoice] = useState<Invoice | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false); 
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const formatDate = (timestamp: any, includeTime: boolean = false): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return includeTime ? format(date, 'PPp') : format(date, 'PP');
  };

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
      q = query(collection(db, 'invoices'), orderBy("createdAt", "desc")); 
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllInvoices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
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

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    const counts = {
      today: allInvoices.filter(inv => inv.invoiceDate.toDate ? inv.invoiceDate.toDate() >= todayStart : new Date(inv.invoiceDate) >= todayStart).length,
      pendingApproval: allInvoices.filter(inv => inv.status === 'pending_approval').length,
      approvedUnpaid: allInvoices.filter(inv => inv.status === 'approved_for_payment').length,
      overdue: allInvoices.filter(inv => isInvoiceOverdue(inv)).length,
    };
    setSummaryCounts(counts);
  }, [allInvoices]);

  const filteredInvoices = useMemo(() => {
    let invoicesToFilter = allInvoices;
    if (activeTab === 'overdue') {
      invoicesToFilter = allInvoices.filter(inv => isInvoiceOverdue(inv));
    } else if (activeTab === 'approved_unpaid') {
      invoicesToFilter = allInvoices.filter(inv => inv.status === 'approved_for_payment');
    } else if (activeTab !== 'all') {
      invoicesToFilter = allInvoices.filter(inv => inv.status === activeTab);
    }
    
    return invoicesToFilter.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role !== 'Supplier' && inv.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allInvoices, activeTab, searchTerm, role]);
  
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
      setViewingInvoice(prev => prev && prev.id === actionableInvoice.id ? { ...prev, ...updateData, status: newStatus } : prev);
    } catch (e: any) {
      console.error(`Error ${actionType}ing invoice:`, e);
      toast({ title: "Error", description: `Could not ${actionType} the invoice.`, variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };
  
  const handleMarkAsPaid = async () => {
    if (!db || !user || !viewingInvoice) return;
    setIsMarkingPaid(true);
    try {
      const invoiceRef = doc(db, 'invoices', viewingInvoice.id);
      const paymentData = {
        method: "Internal Transfer", 
        paidAt: serverTimestamp(),
        transactionId: `ZE-PAY-${Date.now()}` 
      };
      await updateDoc(invoiceRef, {
        status: 'paid',
        paymentDetails: paymentData,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Invoice Paid", description: `Invoice ${viewingInvoice.invoiceNumber} marked as paid.` });
      setViewingInvoice(prev => prev ? { ...prev, status: 'paid', paymentDetails: paymentData } : null);
    } catch (e: any) {
      console.error("Error marking invoice as paid:", e);
      toast({ title: "Error", description: "Could not mark invoice as paid.", variant: "destructive" });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const TABS_CONFIG: {value: InvoiceStatus | "all" | "overdue" | "approved_unpaid", label: string, icon?: React.ElementType}[] = [
    { value: "all", label: "All Invoices", icon: FileDiff },
    { value: "pending_approval", label: "Pending Approval", icon: Hourglass },
    { value: "approved_unpaid", label: "Approved (Unpaid)", icon: CheckCircle },
    { value: "overdue", label: "Overdue", icon: AlertCircle },
    { value: "paid", label: "Paid", icon: PaidIcon },
    { value: "rejected", label: "Rejected", icon: FileX},
  ];
  const supplierTabsConfig = TABS_CONFIG.filter(t => !["pending_approval", "approved_unpaid"].includes(t.value));


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Supplier' ? "My Submitted Invoices" : "Supplier Invoices"}
        </h1>
        {role === 'Supplier' && 
          <Link href="/supplier/invoices/new" passHref>
            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Create New Invoice</Button>
          </Link>
        }
      </div>
       {(role === 'FinanceManager' || role === 'Admin') && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Today's Invoices</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : summaryCounts.today}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending Approval</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : summaryCounts.pendingApproval}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Approved (Unpaid)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : summaryCounts.approvedUnpaid}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Overdue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : summaryCounts.overdue}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader className="p-4 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-auto sm:flex-grow sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by Invoice # or Supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full sm:w-auto">
             <ScrollArea orientation="horizontal" className="w-full pb-2.5">
                <TabsList className="inline-flex h-auto whitespace-nowrap">
                    {(role === 'Supplier' ? supplierTabsConfig : TABS_CONFIG).map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value} className="text-xs px-2.5 py-1.5 h-auto sm:flex-grow-0">
                        {tab.icon && <tab.icon className="mr-1.5 h-3.5 w-3.5 hidden sm:inline-block"/>} {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
              </ScrollArea>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredInvoices.length === 0 ? (
            <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
          ) : filteredInvoices.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground text-lg">
              {allInvoices.length === 0 ? (role === 'Supplier' ? "No invoices submitted yet." : "No supplier invoices found.") : "No invoices match your current filter."}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredInvoices.map((inv) => {
                  const isOverdueFlag = isInvoiceOverdue(inv);
                  return (
                    <Card key={inv.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-md font-semibold">{inv.invoiceNumber}</CardTitle>
                                <Badge variant={getInvoiceStatusBadgeVariant(inv.status)} className="capitalize text-xs whitespace-nowrap">{inv.status.replace(/_/g, ' ')}</Badge>
                            </div>
                            <CardDescription className="text-xs">{role !== 'Supplier' ? (inv.supplierName || 'N/A') : "To: Zellow Enterprises"}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1 flex-grow">
                            <p className={isOverdueFlag ? "text-destructive font-medium" : ""}>Due: {formatDate(inv.dueDate)} {isOverdueFlag && "(Overdue)"}</p>
                            <p className="text-lg font-bold">{formatKsh(inv.totalAmount)}</p>
                        </CardContent>
                        <CardFooter className="pt-3 border-t">
                             <Button variant="outline" size="sm" className="w-full" onClick={() => setViewingInvoice(inv)}>
                                <Eye className="mr-2 h-4 w-4"/>View Details
                            </Button>
                        </CardFooter>
                    </Card>
                  );
                })}
            </div>
          )}
        </CardContent>
        {filteredInvoices.length > 0 && (
            <CardFooter className="pt-4 text-xs text-muted-foreground">
                Showing {filteredInvoices.length} of {allInvoices.length} total invoices {activeTab !== 'all' && `(filtered by ${activeTab.replace(/_/g, ' ')})`}.
            </CardFooter>
        )}
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(isOpen) => { if (!isOpen) setViewingInvoice(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice Details: {viewingInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Supplier: {viewingInvoice?.supplierName || 'N/A'} | Status: <Badge variant={getInvoiceStatusBadgeVariant(viewingInvoice?.status || 'draft')} className="capitalize text-xs">{viewingInvoice?.status.replace(/_/g, ' ')}</Badge>
            </DialogDescription>
          </DialogHeader>
          {viewingInvoice && (
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p><strong>Invoice Date:</strong> {formatDate(viewingInvoice.invoiceDate)}</p>
                <p><strong>Due Date:</strong> {formatDate(viewingInvoice.dueDate)}</p>
                <p><strong>Client:</strong> {viewingInvoice.clientName}</p>
                {viewingInvoice.stockRequestId && <p><strong>Ref Stock Req:</strong> {viewingInvoice.stockRequestId.substring(0,8)}...</p>}
              </div>
              <Separator />
              <h4 className="font-medium">Items:</h4>
              <div className="border rounded-md">
                {viewingInvoice.items.map((item, index) => (
                  <div key={index} className={`p-2 text-xs ${index < viewingInvoice.items.length -1 ? 'border-b' : ''}`}>
                    <p className="font-medium">{item.description}</p>
                    <p>Qty: {item.quantity} x {formatKsh(item.unitPrice)} = {formatKsh(item.totalPrice)}</p>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1 text-sm text-right">
                  <p><strong>Subtotal:</strong> {formatKsh(viewingInvoice.subTotal)}</p>
                  <p><strong>Tax ({viewingInvoice.taxRate || 0}%):</strong> {formatKsh(viewingInvoice.taxAmount || 0)}</p>
                  <p className="text-lg font-bold"><strong>Total:</strong> {formatKsh(viewingInvoice.totalAmount)}</p>
              </div>
              {viewingInvoice.notes && <p className="text-xs text-muted-foreground"><strong>Notes:</strong> {viewingInvoice.notes}</p>}
              {viewingInvoice.paymentDetails?.paidAt && <p className="text-xs text-green-600"><strong>Paid on:</strong> {formatDate(viewingInvoice.paymentDetails.paidAt)}</p>}
            </div>
          )}
          <DialogFooter className="sm:justify-between gap-2">
            <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
            <div className="flex gap-2">
              {(role === 'FinanceManager' || role === 'Admin') && viewingInvoice?.status === 'pending_approval' && (
                <>
                  <Button variant="destructive" size="sm" onClick={() => { if(viewingInvoice) {handleOpenActionModal(viewingInvoice, "reject"); setViewingInvoice(null);}}} disabled={isSubmittingAction}>Reject</Button>
                  <Button variant="default" size="sm" onClick={() => { if(viewingInvoice) {handleOpenActionModal(viewingInvoice, "approve"); setViewingInvoice(null);}}} disabled={isSubmittingAction}>Approve</Button>
                </>
              )}
              {(role === 'FinanceManager' || role === 'Admin') && viewingInvoice?.status === 'approved_for_payment' && (
                 <Button variant="default" size="sm" onClick={handleMarkAsPaid} disabled={isMarkingPaid}>
                    {isMarkingPaid && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Mark as Paid
                 </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Dialog for Approve/Reject */}
      {actionableInvoice && isActionModalOpen && (
          <Dialog open={isActionModalOpen} onOpenChange={(isOpen) => { if (!isOpen) setActionableInvoice(null); setIsActionModalOpen(isOpen); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="capitalize">{actionType} Invoice {actionableInvoice.invoiceNumber}</DialogTitle>
              <DialogDescription>
                Supplier: {actionableInvoice.supplierName}. Amount: {formatKsh(actionableInvoice.totalAmount || 0)}.
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
      )}

    </div>
  );
}
