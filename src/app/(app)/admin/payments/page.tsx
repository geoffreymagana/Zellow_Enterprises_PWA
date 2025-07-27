

"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Filter, DollarSign, CheckCircle, PackageOpen, AlertTriangle, RefreshCw, CreditCard, Banknote, Truck, ArrowUpRight, ArrowDownLeft, Eye, XCircle, Undo2, FileText } from 'lucide-react';
import type { Order, Invoice, PaymentStatus, OrderStatus, DeliveryHistoryEntry } from '@/types';
import { Badge, BadgeProps } from "@/components/ui/badge";
import Link from 'next/link';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, serverTimestamp, Timestamp, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sendOrderReceipt } from '@/ai/flows/send-receipt-flow';


type UnifiedTransaction = (Order | Invoice) & { transactionType: 'revenue' | 'expense' };
type PaymentAction = 'confirm' | 'reject' | 'refund';

const paymentStatuses: (PaymentStatus | "all")[] = ['all', 'pending', 'paid', 'failed', 'refunded', 'refund_requested'];
const ALL_STATUSES_SENTINEL = "all";

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, 'PPp');
};

const getPaymentStatusBadgeVariant = (status: PaymentStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusAmber';
    case 'paid': return 'statusGreen';
    case 'failed': return 'statusRed';
    case 'refund_requested': return 'statusOrange';
    case 'refunded': return 'statusGrey';
    default: return 'outline';
  }
};

// Helper to convert Firestore Timestamps to JS Dates for serialization
const convertTimestampsToDates = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Timestamp) {
        return obj.toDate();
    }
    if (Array.isArray(obj)) {
        return obj.map(convertTimestampsToDates);
    }
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
        newObj[key] = convertTimestampsToDates(obj[key]);
    }
    return newObj;
};


export default function AdminPaymentsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_SENTINEL);
  const [viewingTransaction, setViewingTransaction] = useState<UnifiedTransaction | null>(null);
  
  const [actionableOrder, setActionableOrder] = useState<Order | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<PaymentAction | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [isSendingReceipt, setIsSendingReceipt] = useState(false);

  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    pendingPayments: 0,
    transactionsToday: 0,
  });

  const fetchFinancialData = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      const ordersQuery = query(collection(db, 'orders'), orderBy("createdAt", "desc"));
      const paidInvoicesQuery = query(collection(db, 'invoices'), where("status", "==", "paid"), orderBy("updatedAt", "desc"));
      
      const [ordersSnapshot, invoicesSnapshot] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(paidInvoicesQuery)
      ]);

      let revenue = 0;
      let expenses = 0;
      let pending = 0;
      let todayTx = 0;
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
      
      const fetchedTransactions: UnifiedTransaction[] = [];

      ordersSnapshot.forEach((docSnapshot) => {
        const order = { id: docSnapshot.id, ...docSnapshot.data(), transactionType: 'revenue' } as UnifiedTransaction;
        fetchedTransactions.push(order);

        if (order.paymentStatus === 'paid') {
          revenue += order.totalAmount;
          const paymentDate = order.updatedAt?.toDate() || order.createdAt?.toDate();
          if (paymentDate && paymentDate >= todayStart && paymentDate <= todayEnd) {
            todayTx++;
          }
        } else if (order.paymentStatus === 'pending') {
          pending += order.totalAmount;
        }
      });
      
      invoicesSnapshot.forEach((docSnapshot) => {
        const invoice = { id: docSnapshot.id, ...docSnapshot.data(), transactionType: 'expense' } as UnifiedTransaction;
        fetchedTransactions.push(invoice);
        expenses += invoice.totalAmount;
      });

      fetchedTransactions.sort((a, b) => {
          const dateA = a.updatedAt?.toDate() || a.createdAt?.toDate() || new Date(0);
          const dateB = b.updatedAt?.toDate() || b.createdAt?.toDate() || new Date(0);
          return dateB.valueOf() - dateA.valueOf();
      });
      
      setTransactions(fetchedTransactions);
      setSummaryStats({ totalRevenue: revenue, totalExpenses: expenses, pendingPayments: pending, transactionsToday: todayTx });

    } catch (error) {
      console.error("Failed to fetch financial data:", error);
      toast({ title: "Error", description: "Failed to fetch financial data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (role !== 'Admin' && role !== 'FinanceManager')) {
        router.replace('/dashboard');
      } else {
        fetchFinancialData();
      }
    }
  }, [user, role, authLoading, router, fetchFinancialData]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const searchTermLower = searchTerm.toLowerCase();
      let searchMatch = false;
      if (tx.transactionType === 'revenue') {
          const order = tx as Order;
          searchMatch = order.id.toLowerCase().includes(searchTermLower) ||
                        order.customerName?.toLowerCase().includes(searchTermLower) ||
                        order.customerEmail?.toLowerCase().includes(searchTermLower);
      } else {
          const invoice = tx as Invoice;
          searchMatch = invoice.invoiceNumber.toLowerCase().includes(searchTermLower) ||
                        (invoice as any).supplierName?.toLowerCase().includes(searchTermLower);
      }
      
      const statusMatch = statusFilter === ALL_STATUSES_SENTINEL || tx.paymentStatus === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [transactions, searchTerm, statusFilter]);
  
  const handleOpenActionModal = (order: Order, type: PaymentAction) => {
    setActionableOrder(order);
    setActionType(type);
    setActionReason("");
    setIsActionModalOpen(true);
  };
  
  const handleConfirmAction = async () => {
    if (!user || !db || !actionableOrder || !actionType) return;

    if ((actionType === 'reject' || actionType === 'refund') && !actionReason.trim()) {
      toast({ title: "Reason Required", description: `Please provide a reason for ${actionType}ing.`, variant: "destructive" });
      return;
    }
    
    setIsSubmittingAction(true);
    const orderRef = doc(db, 'orders', actionableOrder.id);
    const updatePayload: any = { updatedAt: serverTimestamp() };
    let newOrderStatus: OrderStatus | null = null;
    let newPaymentStatus: PaymentStatus | null = null;
    let historyNotes = "";

    switch (actionType) {
      case 'confirm':
        newPaymentStatus = 'paid';
        newOrderStatus = 'processing';
        historyNotes = `Payment confirmed by ${user.displayName || user.email}. Order is now processing.`;
        updatePayload.paymentStatus = newPaymentStatus;
        updatePayload.status = newOrderStatus;
        break;
      case 'reject':
        newPaymentStatus = 'failed';
        newOrderStatus = 'cancelled';
        historyNotes = `Payment rejected by ${user.displayName || user.email}. Reason: ${actionReason}`;
        updatePayload.paymentStatus = newPaymentStatus;
        updatePayload.status = newOrderStatus;
        break;
      case 'refund':
        newPaymentStatus = 'refunded';
        historyNotes = `Refund processed by ${user.displayName || user.email}. Reason: ${actionReason}`;
        updatePayload.paymentStatus = newPaymentStatus;
        if (actionableOrder.status !== 'cancelled') {
            newOrderStatus = 'cancelled';
            updatePayload.status = newOrderStatus;
        }
        break;
    }

    const newHistoryEntry: DeliveryHistoryEntry = {
      status: newOrderStatus || actionableOrder.status,
      timestamp: Timestamp.now(),
      notes: historyNotes,
      actorId: user.uid,
    };
    updatePayload.deliveryHistory = arrayUnion(newHistoryEntry);
    
    try {
      await updateDoc(orderRef, updatePayload);
      
      if (newPaymentStatus === 'paid' || newPaymentStatus === 'refunded') {
        const fullOrderData = { ...actionableOrder, ...updatePayload, deliveryHistory: [...(actionableOrder.deliveryHistory || []), newHistoryEntry] };
        const serializableOrder = convertTimestampsToDates(fullOrderData);
        await sendOrderReceipt({ order: serializableOrder });
      }

      toast({ title: `Action Successful`, description: `Order payment has been ${newPaymentStatus || 'updated'}.` });
      fetchFinancialData(); // Refresh data after action
      setIsActionModalOpen(false);
      setActionableOrder(null);
    } catch (e: any) {
      toast({ title: "Action Failed", description: `Could not update order: ${e.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleGenerateReceipt = async (order: Order) => {
    setIsSendingReceipt(true);
    try {
        const serializableOrder = convertTimestampsToDates(order);
        const result = await sendOrderReceipt({ order: serializableOrder, emailSubject: `Receipt for your Zellow Order #${order.id.substring(0,8)}` });
        if (result.success) {
            toast({ title: "Receipt Sent", description: `An updated receipt has been sent to ${order.customerEmail}.` });
        } else {
            throw new Error(result.message);
        }
    } catch (e: any) {
        toast({ title: "Failed to Send Receipt", description: e.message, variant: "destructive" });
    } finally {
        setIsSendingReceipt(false);
    }
  };


  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || (role !== 'Admin' && role !== 'FinanceManager')) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Access Denied.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Payment Records & Administration</h1>
          <p className="text-muted-foreground">View all incoming and outgoing transactions.</p>
        </div>
        <Button onClick={fetchFinancialData} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (Paid)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{formatPrice(summaryStats.totalRevenue)}</div>}
            <p className="text-xs text-muted-foreground">From successfully paid customer orders.</p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid to Suppliers</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{formatPrice(summaryStats.totalExpenses)}</div>}
            <p className="text-xs text-muted-foreground">From paid supplier invoices.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{formatPrice(summaryStats.pendingPayments)}</div>}
            <p className="text-xs text-muted-foreground">From orders awaiting payment confirmation.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions Today (Paid)</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">+{summaryStats.transactionsToday}</div>}
            <p className="text-xs text-muted-foreground">Customer orders marked as paid today.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, Customer/Supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by payment status" />
              </SelectTrigger>
              <SelectContent>
                {paymentStatuses.map(status => (
                  <SelectItem key={status} value={status} className="capitalize">
                    {status.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || statusFilter !== ALL_STATUSES_SENTINEL) && (
                <Button variant="outline" size="sm" onClick={() => {setSearchTerm(""); setStatusFilter(ALL_STATUSES_SENTINEL);}}>
                    <Filter className="mr-2 h-3 w-3"/>Clear Filters
                </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredTransactions.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-10 text-center">
              <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {transactions.length === 0 ? "No payment records found." : "No records match your current search/filter."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => {
                  const isRevenue = tx.transactionType === 'revenue';
                  const order = isRevenue ? tx as Order : null;
                  const invoice = !isRevenue ? tx as Invoice : null;
                  const referenceId = order?.id || invoice?.invoiceNumber || 'N/A';
                  const partyName = order?.customerName || (invoice as any)?.supplierName || 'N/A';
                  const date = order?.createdAt || invoice?.createdAt;
                  const paymentMethod = order?.paymentMethod || 'Bank Transfer';
                  const paymentStatus = order?.paymentStatus || invoice?.status;
                  const amount = order?.totalAmount || invoice?.totalAmount;
                  
                  return (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                        <button onClick={() => setViewingTransaction(tx)} className="text-primary hover:underline">
                            {referenceId.substring(0,8)}...
                        </button>
                    </TableCell>
                    <TableCell>
                        <Badge variant={isRevenue ? 'statusGreen' : 'statusRed'} className="capitalize">
                          {isRevenue ? <ArrowUpRight className="mr-1 h-3 w-3"/> : <ArrowDownLeft className="mr-1 h-3 w-3"/>}
                          {tx.transactionType}
                        </Badge>
                    </TableCell>
                    <TableCell>{partyName}</TableCell>
                    <TableCell>{formatDate(date)}</TableCell>
                    <TableCell className="capitalize">
                      {paymentMethod === 'cod' && <Truck className="inline h-4 w-4 mr-1 text-muted-foreground" />}
                      {paymentMethod === 'mpesa' && <Banknote className="inline h-4 w-4 mr-1 text-green-600" />}
                      {paymentMethod === 'card' && <CreditCard className="inline h-4 w-4 mr-1 text-blue-600" />}
                      {paymentMethod.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPaymentStatusBadgeVariant(paymentStatus as PaymentStatus)} className="capitalize">
                        {paymentStatus?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatPrice(amount)}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end items-center gap-1">
                          {isRevenue && paymentStatus === 'pending' && (
                            <>
                              <Button size="sm" variant="destructive" onClick={() => handleOpenActionModal(order!, 'reject')} disabled={isSubmittingAction}><XCircle className="h-4 w-4"/></Button>
                              <Button size="sm" onClick={() => handleOpenActionModal(order!, 'confirm')} disabled={isSubmittingAction}><CheckCircle className="h-4 w-4"/></Button>
                            </>
                          )}
                           {isRevenue && paymentStatus === 'refund_requested' && (
                            <Button size="sm" variant="destructive" onClick={() => handleOpenActionModal(order!, 'refund')} disabled={isSubmittingAction}><Undo2 className="h-4 w-4 mr-1"/> Process Refund</Button>
                          )}
                          {isRevenue && ['paid', 'refunded', 'cancelled'].includes(paymentStatus as string) && (
                            <Button size="sm" variant="outline" onClick={() => handleGenerateReceipt(order!)} disabled={isSendingReceipt || isSubmittingAction}>
                                {isSendingReceipt ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4"/>}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" aria-label="View Details" onClick={() => setViewingTransaction(tx)}>
                            <Eye className="h-4 w-4"/>
                          </Button>
                       </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredTransactions.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredTransactions.length} of {transactions.length} records.</p></CardFooter>}
      </Card>

       <Dialog open={!!viewingTransaction} onOpenChange={() => setViewingTransaction(null)}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Transaction Details</DialogTitle>
                <DialogDescription>
                    {viewingTransaction && (viewingTransaction.transactionType === 'revenue' ? `Order ID: ${(viewingTransaction as Order).id}` : `Invoice #: ${(viewingTransaction as Invoice).invoiceNumber}`)}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-2">
                {viewingTransaction && viewingTransaction.transactionType === 'revenue' && (
                  <div className="space-y-2 text-sm">
                    <p><strong>Type:</strong> Customer Payment (Revenue)</p>
                    <p><strong>Customer:</strong> {(viewingTransaction as Order).customerName}</p>
                    <p><strong>Email:</strong> {(viewingTransaction as Order).customerEmail}</p>
                    <p><strong>Payment Method:</strong> <span className="capitalize">{(viewingTransaction as Order).paymentMethod?.replace(/_/g, ' ')}</span></p>
                    <p><strong>Payment Status:</strong> <Badge variant={getPaymentStatusBadgeVariant((viewingTransaction as Order).paymentStatus)} className="capitalize">{(viewingTransaction as Order).paymentStatus}</Badge></p>
                    <p><strong>Date:</strong> {formatDate((viewingTransaction as Order).createdAt)}</p>
                    <Separator className="my-2"/>
                    <p className="text-lg font-bold text-right">{formatPrice((viewingTransaction as Order).totalAmount)}</p>
                  </div>
                )}
                 {viewingTransaction && viewingTransaction.transactionType === 'expense' && (
                  <div className="space-y-2 text-sm">
                    <p><strong>Type:</strong> Supplier Payment (Expense)</p>
                    <p><strong>Supplier:</strong> {(viewingTransaction as any).supplierName}</p>
                    <p><strong>Payment Method:</strong> Bank Transfer</p>
                    <p><strong>Payment Status:</strong> <Badge variant="statusGreen">Paid</Badge></p>
                    <p><strong>Date Paid:</strong> {formatDate((viewingTransaction as Invoice).updatedAt)}</p>
                    <Separator className="my-2"/>
                     <p className="text-lg font-bold text-right">{formatPrice((viewingTransaction as Invoice).totalAmount)}</p>
                  </div>
                )}
            </div>
            <DialogFooter>
                {viewingTransaction?.transactionType === 'revenue' && (viewingTransaction as Order).paymentStatus === 'pending' && (
                  <Button onClick={() => handleOpenActionModal(viewingTransaction as Order, 'confirm')} disabled={isSubmittingAction}>
                    {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Payment
                  </Button>
                )}
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Universal Action Modal */}
       <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} Payment</DialogTitle>
            <DialogDescription>
              Order: {actionableOrder?.id.substring(0, 8)}... <br/>
              Amount: {formatPrice(actionableOrder?.totalAmount || 0)}
            </DialogDescription>
          </DialogHeader>
          {(actionType === 'reject' || actionType === 'refund') && (
            <div className="py-2 space-y-2">
              <Label htmlFor="action-reason">Reason for {actionType}</Label>
              <Textarea id="action-reason" value={actionReason} onChange={(e) => setActionReason(e.target.value)} placeholder={`Provide a brief reason for ${actionType}ing...`} />
            </div>
          )}
          {actionType === 'confirm' && (
            <div className="py-2 text-sm">
              <p>You are about to confirm that payment has been received for this order. This will move the order to the 'Processing' stage.</p>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
                type="button" 
                onClick={handleConfirmAction} 
                disabled={isSubmittingAction || ((actionType === 'reject' || actionType === 'refund') && !actionReason.trim())}
                variant={actionType === 'reject' || actionType === 'refund' ? 'destructive' : 'default'}
            >
                {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
