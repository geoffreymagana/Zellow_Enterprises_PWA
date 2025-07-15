
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, BarChart2, Users, ShoppingCart, DollarSign, Package, AlertTriangle, FilterX, CalendarIcon } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderStatus, Product, StockRequest, StockRequestStatus, User as AppUser } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, isSameMonth } from 'date-fns';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface OrderStatusDistribution {
  status: OrderStatus;
  count: number;
}

interface StockLevelData extends Product {}

interface SalesSummaryData {
  totalPaidOrders: number;
  totalRevenue: number;
  detailedPaidOrders: Order[];
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDateForFilename = (date: Date = new Date()): string => {
    return format(date, 'yyyyMMdd_HHmmss');
};

const stockRequestStatuses: StockRequestStatus[] = [
  'pending_bids', 'pending_award', 'awarded', 'awaiting_fulfillment',
  'awaiting_receipt', 'received', 'rejected_finance', 'cancelled'
];

const getStockRequestStatusVariant = (status?: StockRequestStatus | null): BadgeProps['variant'] => {
  if (!status) return 'outline';
  switch (status) {
    case 'pending_bids': return 'statusYellow';
    case 'pending_award': return 'statusAmber';
    case 'awarded': return 'statusIndigo';
    case 'awaiting_fulfillment': return 'statusLightBlue';
    case 'awaiting_receipt': return 'statusBlue';
    case 'received': return 'statusGreen';
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance': return 'statusRed';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

export default function AdminReportsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // State for existing reports
  const [orderStatusData, setOrderStatusData] = useState<OrderStatusDistribution[]>([]);
  const [isLoadingOrderStatus, setIsLoadingOrderStatus] = useState(true);
  const [stockLevelData, setStockLevelData] = useState<StockLevelData[]>([]);
  const [isLoadingStockLevel, setIsLoadingStockLevel] = useState(true);
  const [salesSummaryData, setSalesSummaryData] = useState<SalesSummaryData | null>(null);
  const [isLoadingSalesSummary, setIsLoadingSalesSummary] = useState(true);

  // State for new Audit Trail report
  const [auditTrailData, setAuditTrailData] = useState<StockRequest[]>([]);
  const [isLoadingAuditTrail, setIsLoadingAuditTrail] = useState(true);
  const [suppliers, setSuppliers] = useState<AppUser[]>([]);
  const [auditDateRange, setAuditDateRange] = useState<DateRange | undefined>(undefined);
  const [auditSupplierFilter, setAuditSupplierFilter] = useState<string>("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState<StockRequestStatus | "all">("all");

  const formatDate = (timestamp: any, includeTime: boolean = false) => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return includeTime ? format(date, 'PPp') : format(date, 'PP');
  };

  const fetchOrderStatusDistribution = useCallback(async () => {
    if (!db) { setIsLoadingOrderStatus(false); return; }
    setIsLoadingOrderStatus(true);
    try {
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const counts: Record<OrderStatus, number> = {
        pending: 0, processing: 0, awaiting_assignment: 0, assigned: 0,
        out_for_delivery: 0, delivered: 0, delivery_attempted: 0, cancelled: 0, shipped: 0,
      };
      ordersSnapshot.forEach(doc => {
        const order = doc.data() as Order;
        if (counts[order.status] !== undefined) {
          counts[order.status]++;
        }
      });
      const distribution = (Object.keys(counts) as OrderStatus[]).map(status => ({
        status,
        count: counts[status]
      })).filter(item => item.count > 0);
      setOrderStatusData(distribution);
    } catch (error) { toast({ title: "Error", description: "Failed to load order status report.", variant: "destructive" }); }
    setIsLoadingOrderStatus(false);
  }, [toast]);

  const fetchStockLevelOverview = useCallback(async () => {
    if (!db) { setIsLoadingStockLevel(false); return; }
    setIsLoadingStockLevel(true);
    try {
      const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('name')));
      setStockLevelData(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockLevelData)));
    } catch (error) { toast({ title: "Error", description: "Failed to load stock level report.", variant: "destructive" }); }
    setIsLoadingStockLevel(false);
  }, [toast]);

  const fetchSalesSummary = useCallback(async () => {
    if (!db) { setIsLoadingSalesSummary(false); return; }
    setIsLoadingSalesSummary(true);
    try {
      const paidOrdersQuery = query(collection(db, 'orders'), where('paymentStatus', '==', 'paid'));
      const paidOrdersSnapshot = await getDocs(paidOrdersQuery);
      let totalRevenue = 0;
      const detailedOrders: Order[] = [];
      paidOrdersSnapshot.forEach(doc => {
        const order = { id: doc.id, ...doc.data() } as Order;
        totalRevenue += order.totalAmount;
        detailedOrders.push(order);
      });
      setSalesSummaryData({ totalPaidOrders: paidOrdersSnapshot.size, totalRevenue, detailedOrders: detailedOrders });
    } catch (error) { toast({ title: "Error", description: "Failed to load sales summary.", variant: "destructive" }); }
    setIsLoadingSalesSummary(false);
  }, [toast]);
  
  const fetchAuditTrailData = useCallback(async () => {
    if (!db) { setIsLoadingAuditTrail(false); return; }
    setIsLoadingAuditTrail(true);
    try {
        const [requestsSnapshot, suppliersSnapshot] = await Promise.all([
            getDocs(query(collection(db, 'stockRequests'), orderBy("createdAt", "desc"))),
            getDocs(query(collection(db, 'users'), where("role", "==", "Supplier")))
        ]);
        setAuditTrailData(requestsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as StockRequest)));
        setSuppliers(suppliersSnapshot.docs.map(d => ({uid: d.id, ...d.data()} as AppUser)));
    } catch (error) {
        toast({ title: "Error", description: "Failed to load audit trail data.", variant: "destructive" });
    } finally {
        setIsLoadingAuditTrail(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'Admin')) {
      router.replace('/dashboard');
    } else if (user && role === 'Admin') {
      fetchOrderStatusDistribution();
      fetchStockLevelOverview();
      fetchSalesSummary();
      fetchAuditTrailData();
    }
  }, [user, role, authLoading, router, fetchOrderStatusDistribution, fetchStockLevelOverview, fetchSalesSummary, fetchAuditTrailData]);
  
  const filteredAuditData = useMemo(() => {
    return auditTrailData.filter(req => {
        const reqDate = req.createdAt?.toDate ? req.createdAt.toDate() : new Date(0);
        const dateMatch = !auditDateRange || (
            (!auditDateRange.from || reqDate >= auditDateRange.from) &&
            (!auditDateRange.to || reqDate <= auditDateRange.to)
        );
        const supplierMatch = auditSupplierFilter === 'all' || req.supplierId === auditSupplierFilter;
        const statusMatch = auditStatusFilter === 'all' || req.status === auditStatusFilter;
        return dateMatch && supplierMatch && statusMatch;
    });
  }, [auditTrailData, auditDateRange, auditSupplierFilter, auditStatusFilter]);

  const downloadCSV = (data: any[], filename: string, headers: string[]) => {
    if (data.length === 0) { toast({ title: "No Data", description: "No data available to download.", variant: "default" }); return; }
    
    const formatValueForCSV = (value: any, key: string) => {
      if (value === null || value === undefined) return '';
      if (key.toLowerCase().includes('date') || key.toLowerCase().includes('timestamp')) {
        return formatDate(value);
      }
      if (Array.isArray(value)) {
          return value.map(item => typeof item === 'object' ? JSON.stringify(item) : item).join('; ');
      }
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value).replace(/"/g, '""');
    };

    const csvRows = [headers.join(',')];
    data.forEach(row => {
        const values = headers.map(header => {
            const key = Object.keys(row).find(k => k.toLowerCase() === header.toLowerCase().replace(/\s/g, ''));
            const value = key ? row[key as keyof typeof row] : '';
            return `"${formatValueForCSV(value, key || '')}"`;
        });
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${formatDateForFilename()}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Download Started", description: `${filename}.csv is being downloaded.`});
  };

  const auditHeaders = ["ID", "ProductName", "RequestedQuantity", "RequesterName", "Status", "SupplierName", "SupplierPrice", "ReceivedQuantity", "CreatedAt", "FinanceActionTimestamp", "ReceivedAt"];

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-screen">Unauthorized or redirecting...</div>;
  }

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-headline font-semibold">System Reports</h1><p className="text-muted-foreground mt-1">Access and generate system-wide reports for analytics and operational insights.</p></div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="font-headline text-xl">Stock Request Audit Trail</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(filteredAuditData, 'stock_request_audit', auditHeaders)} disabled={isLoadingAuditTrail || filteredAuditData.length === 0}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
          </div>
          <CardDescription>A complete history of all stock requests and their lifecycle stages.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-2 p-4 border rounded-lg bg-muted/50 mb-4 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal md:w-[260px]", !auditDateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />
                  {auditDateRange?.from ? (auditDateRange.to ? <>{format(auditDateRange.from, "LLL dd, y")} - {format(auditDateRange.to, "LLL dd, y")}</> : format(auditDateRange.from, "LLL dd, y")) : <span>Pick a date range</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={auditDateRange?.from} selected={auditDateRange} onSelect={setAuditDateRange} numberOfMonths={2}/></PopoverContent>
            </Popover>
            <Select value={auditSupplierFilter} onValueChange={setAuditSupplierFilter}><SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filter by supplier..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Suppliers</SelectItem>{suppliers.map(s => <SelectItem key={s.uid} value={s.uid}>{s.displayName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={auditStatusFilter} onValueChange={(v) => setAuditStatusFilter(v as any)}><SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filter by status..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Statuses</SelectItem>{stockRequestStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => {setAuditDateRange(undefined); setAuditSupplierFilter("all"); setAuditStatusFilter("all");}} className="w-full md:w-auto"><FilterX className="mr-2 h-4 w-4" /> Clear</Button>
          </div>
          {isLoadingAuditTrail ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          : filteredAuditData.length === 0 ? <p className="text-muted-foreground text-center py-6">No audit records match your filters.</p>
          : (<Table>
                <TableHeader><TableRow>
                    <TableHead>Product</TableHead><TableHead>Requester</TableHead><TableHead>Supplier</TableHead><TableHead>Qty Req.</TableHead>
                    <TableHead>Awarded Price</TableHead><TableHead>Status</TableHead><TableHead>Date Created</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {filteredAuditData.map(req => (
                        <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.productName}</TableCell>
                            <TableCell className="text-xs">{req.requesterName}</TableCell>
                            <TableCell className="text-xs">{req.supplierName || 'N/A'}</TableCell>
                            <TableCell>{req.requestedQuantity}</TableCell>
                            <TableCell>{req.supplierPrice ? formatPrice(req.supplierPrice) : 'N/A'}</TableCell>
                            <TableCell><Badge variant={getStockRequestStatusVariant(req.status)} className="capitalize">{req.status.replace(/_/g, ' ')}</Badge></TableCell>
                            <TableCell className="text-xs">{formatDate(req.createdAt)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>)}
        </CardContent>
        {filteredAuditData.length > 0 && <CardFooter><p className="text-xs text-muted-foreground">Showing {filteredAuditData.length} of {auditTrailData.length} records.</p></CardFooter>}
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between"><CardTitle className="font-headline text-xl">Order Status Distribution</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(orderStatusData, 'order_status_distribution', ['Status', 'Count'])} disabled={isLoadingOrderStatus || orderStatusData.length === 0}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
          </div><CardDescription>Current count of orders by their status.</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingOrderStatus ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : orderStatusData.length === 0 ? <p className="text-muted-foreground text-center py-6">No order data available.</p> : (<Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{orderStatusData.map(item => (<TableRow key={item.status}><TableCell className="capitalize">{item.status.replace(/_/g, ' ')}</TableCell><TableCell className="text-right">{item.count}</TableCell></TableRow>))}</TableBody></Table>)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between"><CardTitle className="font-headline text-xl">Stock Level Overview</CardTitle>
             <Button variant="outline" size="sm" onClick={() => downloadCSV(stockLevelData, 'stock_level_overview', ['ID', 'Name', 'Categories', 'Stock', 'Price'])} disabled={isLoadingStockLevel || stockLevelData.length === 0}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
          </div><CardDescription>Current stock levels for all products.</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingStockLevel ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : stockLevelData.length === 0 ? <p className="text-muted-foreground text-center py-6">No product data available.</p> : (<Table><TableHeader><TableRow><TableHead>Product Name</TableHead><TableHead>Categories</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader><TableBody>{stockLevelData.map(product => (<TableRow key={product.id}><TableCell>{product.name}</TableCell><TableCell className="text-xs">{product.categories?.join(', ') || 'N/A'}</TableCell><TableCell className="text-right">{product.stock}</TableCell><TableCell className="text-right">{formatPrice(product.price)}</TableCell></TableRow>))}</TableBody></Table>)}</CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between"><CardTitle className="font-headline text-xl">Sales Summary</CardTitle>
                 <Button variant="outline" size="sm" onClick={() => downloadCSV(salesSummaryData?.detailedPaidOrders || [], 'sales_summary_details', ['ID', 'CustomerName', 'CustomerEmail', 'TotalAmount', 'PaymentStatus', 'Status', 'CreatedAt', 'Items', 'ShippingAddress'])} disabled={isLoadingSalesSummary || !salesSummaryData || salesSummaryData.detailedPaidOrders.length === 0}><Download className="mr-2 h-4 w-4" /> Download Paid Orders CSV</Button>
            </div><CardDescription>Summary of paid orders and revenue.</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingSalesSummary ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : salesSummaryData ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="p-4 bg-muted/50 rounded-md"><p className="text-sm text-muted-foreground">Total Paid Orders</p><p className="text-2xl font-bold">{salesSummaryData.totalPaidOrders}</p></div><div className="p-4 bg-muted/50 rounded-md"><p className="text-sm text-muted-foreground">Total Revenue from Paid Orders</p><p className="text-2xl font-bold">{formatPrice(salesSummaryData.totalRevenue)}</p></div></div>) : (<p className="text-muted-foreground text-center py-6">No sales data available.</p>)}</CardContent>
      </Card>
    </div>
  );
}

