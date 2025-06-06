
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
import { Loader2, Search, Edit, Filter, DollarSign, CheckCircle, PackageOpen, AlertTriangle, RefreshCw, CreditCard, Banknote, Truck } from 'lucide-react';
import type { Order, OrderStatus, PaymentStatus } from '@/types';
import { Badge, BadgeProps } from "@/components/ui/badge";
import Link from 'next/link';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const paymentStatuses: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];
const ALL_STATUSES_SENTINEL = "__ALL_PAYMENT_STATUSES__";

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

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_SENTINEL);
  const [orderToUpdatePayment, setOrderToUpdatePayment] = useState<Order | null>(null);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);

  const [summaryStats, setSummaryStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    transactionsToday: 0,
  });

  const fetchOrdersAndStats = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false); return;
    }
    setIsLoading(true);
    try {
      let q = query(collection(db, 'orders'), orderBy("createdAt", "desc"));
      
      const querySnapshot = await getDocs(q);
      const fetchedOrders: Order[] = [];
      let revenue = 0;
      let pending = 0;
      let todayTx = 0;
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

      querySnapshot.forEach((docSnapshot) => {
        const order = { id: docSnapshot.id, ...docSnapshot.data() } as Order;
        fetchedOrders.push(order);
        if (order.paymentStatus === 'paid') {
          revenue += order.totalAmount;
          const paymentDate = order.updatedAt?.toDate() || order.createdAt?.toDate();
          if (paymentDate >= todayStart && paymentDate <= todayEnd) {
            todayTx++;
          }
        } else if (order.paymentStatus === 'pending' && order.paymentMethod === 'cod') {
          pending += order.totalAmount;
        }
      });
      setOrders(fetchedOrders);
      setSummaryStats({ totalRevenue: revenue, pendingPayments: pending, transactionsToday: todayTx });
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      toast({ title: "Error", description: "Failed to fetch payment data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (role !== 'Admin' && role !== 'FinanceManager')) {
        router.replace('/dashboard');
      } else {
        fetchOrdersAndStats();
      }
    }
  }, [user, role, authLoading, router, fetchOrdersAndStats]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchTermLower = searchTerm.toLowerCase();
      const idMatch = order.id.toLowerCase().includes(searchTermLower);
      const nameMatch = order.customerName?.toLowerCase().includes(searchTermLower);
      const emailMatch = order.customerEmail?.toLowerCase().includes(searchTermLower);
      const statusMatch = statusFilter === ALL_STATUSES_SENTINEL || order.paymentStatus === statusFilter;
      return (idMatch || nameMatch || emailMatch) && statusMatch;
    });
  }, [orders, searchTerm, statusFilter]);
  

  const handleMarkAsPaid = async () => {
    if (!orderToUpdatePayment || !db || !user) return;
    setIsUpdatingPayment(true);
    try {
      const orderRef = doc(db, 'orders', orderToUpdatePayment.id);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        updatedAt: serverTimestamp(),
        // Optionally, add a specific payment confirmation timestamp or details
      });
      toast({ title: "Payment Updated", description: `Order ${orderToUpdatePayment.id} marked as paid.` });
      setOrderToUpdatePayment(null);
      fetchOrdersAndStats(); // Re-fetch to update summaries and list
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">Payment Records & Administration</h1>
          <p className="text-muted-foreground">View transaction histories and manage financial data.</p>
        </div>
        <Button onClick={fetchOrdersAndStats} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (Paid)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{formatPrice(summaryStats.totalRevenue)}</div>}
            <p className="text-xs text-muted-foreground">From all successfully paid orders.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending COD Payments</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{formatPrice(summaryStats.pendingPayments)}</div>}
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
            <p className="text-xs text-muted-foreground">Orders marked as paid today.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Order ID, Customer..."
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
                <SelectItem value={ALL_STATUSES_SENTINEL}>All Payment Statuses</SelectItem>
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
          {isLoading && filteredOrders.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-10 text-center">
              <PackageOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {orders.length === 0 ? "No payment records found." : "No records match your current search/filter."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      <Link href={`/admin/orders/edit/${order.id}`} className="text-primary hover:underline">
                        {order.id.substring(0,8)}...
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customerName || "N/A"}</div>
                      <div className="text-xs text-muted-foreground">{order.customerEmail || "N/A"}</div>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell className="capitalize">
                      {order.paymentMethod === 'cod' && <Truck className="inline h-4 w-4 mr-1 text-muted-foreground" />}
                      {order.paymentMethod === 'mpesa' && <Banknote className="inline h-4 w-4 mr-1 text-green-600" />}
                      {order.paymentMethod === 'card' && <CreditCard className="inline h-4 w-4 mr-1 text-blue-600" />}
                      {order.paymentMethod?.replace(/_/g, " ") || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPaymentStatusBadgeVariant(order.paymentStatus)} className="capitalize">
                        {order.paymentStatus.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(order.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      {order.paymentStatus === 'pending' && order.paymentMethod === 'cod' && (
                        <AlertDialog open={orderToUpdatePayment?.id === order.id} onOpenChange={(isOpen) => { if (!isOpen) setOrderToUpdatePayment(null); }}>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="xs" onClick={() => setOrderToUpdatePayment(order)}>Mark Paid</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Payment Received</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Mark order {orderToUpdatePayment?.id.substring(0,8)}... ({formatPrice(orderToUpdatePayment?.totalAmount || 0)}) as paid? This action cannot be easily undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setOrderToUpdatePayment(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleMarkAsPaid} disabled={isUpdatingPayment}>
                                        {isUpdatingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Confirm Paid
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      )}
                       <Link href={`/admin/orders/edit/${order.id}#payment`} passHref>
                         <Button variant="ghost" size="icon" aria-label="View Order Payment Details"><Edit className="h-4 w-4"/></Button>
                       </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredOrders.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredOrders.length} of {orders.length} records.</p></CardFooter>}
      </Card>
    </div>
  );
}

    
