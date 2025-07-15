
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Edit, Filter, DollarSign, CheckCircle, PackageOpen, AlertTriangle, RefreshCw, CreditCard, Banknote, Truck, ArrowUpRight, ArrowDownLeft, Eye } from 'lucide-react';
import type { Order, Invoice, PaymentStatus } from '@/types';
import { Badge, BadgeProps } from "@/components/ui/badge";
import Link from 'next/link';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

type UnifiedTransaction = (Order | Invoice) & { transactionType: 'revenue' | 'expense' };

const paymentStatuses: (PaymentStatus | "all")[] = ['all', 'pending', 'paid', 'failed', 'refunded'];
const ALL_STATUSES_SENTINEL = "all";

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  return timestamp.toDate ? format(timestamp.toDate(), 'PPp') : 'Invalid Date';
};

const getPaymentStatusBadgeVariant = (status: PaymentStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusAmber';
    case 'paid': return 'statusGreen';
    case 'failed': return 'statusRed';
    case 'refunded': return 'statusGrey';
    default: return 'outline';
  }
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
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    pendingCodPayments: 0,
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
      let pendingCod = 0;
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
          if (paymentDate >= todayStart && paymentDate <= todayEnd) {
            todayTx++;
          }
        } else if (order.paymentStatus === 'pending' && order.paymentMethod === 'cod') {
          pendingCod += order.totalAmount;
        }
      });
      
      invoicesSnapshot.forEach((docSnapshot) => {
        const invoice = { id: docSnapshot.id, ...docSnapshot.data(), transactionType: 'expense' } as UnifiedTransaction;
        fetchedTransactions.push(invoice);
        expenses += invoice.totalAmount;
      });

      // Sort all transactions by date after merging
      fetchedTransactions.sort((a, b) => {
          const dateA = a.updatedAt?.toDate() || a.createdAt?.toDate() || 0;
          const dateB = b.updatedAt?.toDate() || b.createdAt?.toDate() || 0;
          return dateB.valueOf() - dateA.valueOf();
      });
      
      setTransactions(fetchedTransactions);
      setSummaryStats({ totalRevenue: revenue, totalExpenses: expenses, pendingCodPayments: pendingCod, transactionsToday: todayTx });

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
                        invoice.supplierName?.toLowerCase().includes(searchTermLower);
      }
      
      const statusMatch = statusFilter === ALL_STATUSES_SENTINEL || tx.paymentStatus === statusFilter;
      return searchMatch && statusMatch;
    });
  }, [transactions, searchTerm, statusFilter]);
  

  const handleMarkAsPaid = async () => {
    if (!viewingTransaction || viewingTransaction.transactionType !== 'revenue' || !db || !user) return;
    setIsUpdatingPayment(true);
    try {
      const orderRef = doc(db, 'orders', viewingTransaction.id);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Payment Updated", description: `Order ${viewingTransaction.id} marked as paid.` });
      setViewingTransaction(null);
      fetchFinancialData(); 
    } catch (error) {
      console.error("Error updating payment status:", error);
      toast({ title: "Error", description: "Failed to update payment status.", variant: "destructive" });
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || (role !== 'Admin' && role !== 'FinanceManager')) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Access Denied.</div>;
  }

  const canMarkAsPaid = viewingTransaction?.transactionType === 'revenue' && (viewingTransaction as Order).paymentStatus === 'pending' && (viewingTransaction as Order).paymentMethod === 'cod';


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
            <CardTitle className="text-sm font-medium">Pending COD Payments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{formatPrice(summaryStats.pendingCodPayments)}</div>}
            <p className="text-xs text-muted-foreground">From 'Cash on Delivery' orders.</p>
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
                  const partyName = order?.customerName || invoice?.supplierName || 'N/A';
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
                       <Button variant="ghost" size="icon" aria-label="View Details" onClick={() => setViewingTransaction(tx)}>
                         <Eye className="h-4 w-4"/>
                       </Button>
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
                    <p><strong>Supplier:</strong> {(viewingTransaction as Invoice).supplierName}</p>
                    <p><strong>Payment Method:</strong> Bank Transfer</p>
                    <p><strong>Payment Status:</strong> <Badge variant="statusGreen">Paid</Badge></p>
                    <p><strong>Date Paid:</strong> {formatDate((viewingTransaction as Invoice).updatedAt)}</p>
                    <Separator className="my-2"/>
                     <p className="text-lg font-bold text-right">{formatPrice((viewingTransaction as Invoice).totalAmount)}</p>
                  </div>
                )}
            </div>
            <DialogFooter>
                {canMarkAsPaid && (
                  <Button onClick={handleMarkAsPaid} disabled={isUpdatingPayment}>
                    {isUpdatingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Mark as Paid
                  </Button>
                )}
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
