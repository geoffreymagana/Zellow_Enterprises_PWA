
"use client";

import * as React from "react"; 
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Invoice, InvoiceStatus } from "@/types"; 
import { FileText, Search, Download, Eye, Loader2, CheckCircle, XCircle, CalendarDays, FileClock, AlertCircle, CheckCircle2 as PaidIcon, Hourglass, FileX, FileDiff, PlusCircle, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Logo } from '@/components/common/Logo';

const formatKsh = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any, includeTime: boolean = false): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return includeTime ? format(date, 'PPp') : format(date, 'PP');
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

// Define filter options for the Select component
const FILTER_OPTIONS: {value: InvoiceStatus | "all" | "overdue" | "approved_unpaid", label: string, icon?: React.ElementType}[] = [
    { value: "all", label: "All Invoices", icon: FileDiff },
    { value: "pending_approval", label: "Pending Approval", icon: Hourglass },
    { value: "approved_unpaid", label: "Approved (Unpaid)", icon: CheckCircle },
    { value: "overdue", label: "Overdue", icon: AlertCircle },
    { value: "paid", label: "Paid", icon: PaidIcon },
    { value: "rejected", label: "Rejected", icon: FileX},
  ];

const supplierFilterOptions = FILTER_OPTIONS.filter(t => !["pending_approval", "approved_unpaid"].includes(t.value));

const InvoiceTemplate = React.forwardRef<HTMLDivElement, { invoice: Invoice, type: 'invoice' | 'receipt' }>(({ invoice, type }, ref) => {
  const isReceipt = type === 'receipt';
  return (
    <div ref={ref} className="p-8 bg-white text-black font-sans text-sm">
      <header className="flex justify-between items-start mb-10">
        <div>
          <Logo iconSize={32} textSize="text-2xl" />
          <p className="text-xs text-gray-600 mt-1">GTC Office Tower, Nairobi</p>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-bold uppercase tracking-wider text-gray-800">{isReceipt ? 'Receipt' : 'Invoice'}</h1>
          <p><strong>{isReceipt ? 'Receipt' : 'Invoice'} #:</strong> {invoice.invoiceNumber}</p>
          <p><strong>Date:</strong> {formatDate(invoice.invoiceDate, false)}</p>
          {!isReceipt && <p><strong>Due:</strong> {formatDate(invoice.dueDate, false)}</p>}
          {isReceipt && invoice.paymentDetails?.paidAt && <p><strong>Paid On:</strong> {formatDate(invoice.paymentDetails.paidAt, false)}</p>}
        </div>
      </header>
      <section className="mb-10">
        <h2 className="font-semibold mb-1">Bill To:</h2>
        <p>{invoice.clientName}</p>
        <p>Finance Department</p>
      </section>
      <section>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left font-semibold">Description</th>
              <th className="p-2 text-center font-semibold">Qty</th>
              <th className="p-2 text-right font-semibold">Unit Price</th>
              <th className="p-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index} className="border-b">
                <td className="p-2">{item.description}</td>
                <td className="p-2 text-center">{item.quantity}</td>
                <td className="p-2 text-right">{formatKsh(item.unitPrice)}</td>
                <td className="p-2 text-right">{formatKsh(item.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="flex justify-end mt-6">
        <div className="w-64 space-y-2">
          <div className="flex justify-between"><span>Subtotal:</span><span>{formatKsh(invoice.subTotal)}</span></div>
          <div className="flex justify-between"><span>Tax ({invoice.taxRate ?? 0}%):</span><span>{formatKsh(invoice.taxAmount ?? 0)}</span></div>
          <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span>Total Amount:</span><span>{formatKsh(invoice.totalAmount)}</span></div>
        </div>
      </section>
      {isReceipt && (
        <section className="mt-8 text-center">
            <p className="text-2xl font-bold text-green-600">PAID</p>
            <p className="text-xs">Transaction ID: {invoice.paymentDetails?.transactionId || 'N/A'}</p>
        </section>
      )}
      <footer className="mt-12 pt-4 border-t text-center text-xs text-gray-500">
        <p>Thank you for your business!</p>
      </footer>
    </div>
  );
});
InvoiceTemplate.displayName = 'InvoiceTemplate';

export default function InvoicesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<InvoiceStatus | "all" | "overdue" | "approved_unpaid">("pending_approval");
  
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);


  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const fetchInvoices = useCallback(() => {
    if (!db || !user || (role !== 'FinanceManager' && role !== 'Admin' && role !== 'Supplier' && role !== 'InventoryManager')) {
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
    if (!user || !['Supplier', 'FinanceManager', 'Admin', 'InventoryManager'].includes(role || '')) {
      router.replace('/dashboard');
      return;
    }
    // Set initial filter based on role
    if (role === 'Supplier') {
        setActiveFilter('all'); 
    } else {
        setActiveFilter('pending_approval');
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
    if (activeFilter === 'overdue') {
      invoicesToFilter = allInvoices.filter(inv => isInvoiceOverdue(inv));
    } else if (activeFilter === 'approved_unpaid') {
      invoicesToFilter = allInvoices.filter(inv => inv.status === 'approved_for_payment');
    } else if (activeFilter !== 'all') {
      invoicesToFilter = allInvoices.filter(inv => inv.status === activeFilter);
    }
    
    return invoicesToFilter.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (role !== 'Supplier' && inv.supplierName?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allInvoices, activeFilter, searchTerm, role]);
  
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

  const handleDownloadPdf = async (type: 'invoice' | 'receipt') => {
    if (!pdfRef.current || !viewingInvoice) return;
    setIsGeneratingPdf(true);
    toast({ title: `Generating ${type}...`, description: "Please wait." });
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Zellow-${type}-${viewingInvoice.invoiceNumber}.pdf`);
    } catch (err) {
      console.error(`Error generating ${type} PDF:`, err);
      toast({ title: "PDF Generation Failed", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const currentFilterOptions = role === 'Supplier' ? supplierFilterOptions : FILTER_OPTIONS;

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
            <Select 
              value={activeFilter} 
              onValueChange={(value) => setActiveFilter(value as any)}
            >
              <SelectTrigger className="w-full sm:w-auto sm:min-w-[200px] h-9">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {currentFilterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon && <option.icon className="h-4 w-4 text-muted-foreground" />}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredInvoices.length === 0 ? (
            <div className="p-10 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
          ) : filteredInvoices.length === 0 ? (
            <p className="p-10 text-center text-lg text-muted-foreground">
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
                Showing {filteredInvoices.length} of {allInvoices.length} total invoices {activeFilter !== 'all' && `(filtered by ${activeFilter.replace(/_/g, ' ')})`}.
            </CardFooter>
        )}
      </Card>

      {/* Invoice Details Dialog */}
      {viewingInvoice && (
      <Dialog open={!!viewingInvoice} onOpenChange={(isOpen) => { if (!isOpen) setViewingInvoice(null); }}>
        <DialogContent className="sm:max-w-2xl">
          {/* Hidden printable/PDF element */}
          <div className="absolute -left-[9999px] top-0 w-[210mm]">
            <InvoiceTemplate ref={pdfRef} invoice={viewingInvoice} type={viewingInvoice.status === 'paid' ? 'receipt' : 'invoice'} />
          </div>
          <DialogHeader>
            <DialogTitle>Invoice Details: {viewingInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Supplier: {viewingInvoice?.supplierName || 'N/A'} | Status: <Badge variant={getInvoiceStatusBadgeVariant(viewingInvoice?.status || 'draft')} className="capitalize text-xs">{viewingInvoice?.status.replace(/_/g, ' ')}</Badge>
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
            <div>
              {viewingInvoice.status === 'paid' ? (
                <Button variant="secondary" size="sm" onClick={() => handleDownloadPdf('receipt')} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>} Download Receipt
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => handleDownloadPdf('invoice')} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>} Download Invoice
                </Button>
              )}
            </div>
            <div className="flex gap-2 justify-end">
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
               <DialogClose asChild><Button type="button" variant="outline" size="sm">Close</Button></DialogClose>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

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
