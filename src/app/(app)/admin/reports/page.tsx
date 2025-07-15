
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, BarChart2, Users, ShoppingCart, DollarSign, Package, AlertTriangle, FilterX, CalendarIcon, UserCheck, Activity, UserCog } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderItem as FirestoreOrderItem, OrderStatus, Product, StockRequest, StockRequestStatus, User as AppUser, ShippingAddress, UserRole } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, isSameMonth } from 'date-fns';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from 'next/link';

interface OrderStatusDistribution {
  status: OrderStatus;
  count: number;
  orders: Order[];
}

interface StockLevelData extends Product {}

interface SalesSummaryData {
  totalPaidOrders: number;
  totalRevenue: number;
  detailedPaidOrders: Order[];
}

// Define all manageable roles for filtering
const allManageableRoles: UserRole[] = ['Admin', 'Customer', 'Engraving', 'Printing', 'Assembly', 'Quality Check', 'Packaging', 'Rider', 'Supplier', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

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

const getAccountStatusVariant = (user: AppUser): BadgeProps['variant'] => {
    if (user.disabled) return 'statusRed';
    if (user.status === 'pending') return 'statusYellow';
    if (user.status === 'rejected') return 'statusRed';
    return 'statusGreen';
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

  // State for Audit Trail report
  const [auditTrailData, setAuditTrailData] = useState<StockRequest[]>([]);
  const [isLoadingAuditTrail, setIsLoadingAuditTrail] = useState(true);
  const [suppliers, setSuppliers] = useState<AppUser[]>([]);
  const [auditDateRange, setAuditDateRange] = useState<DateRange | undefined>(undefined);
  const [auditSupplierFilter, setAuditSupplierFilter] = useState<string>("all");
  const [auditStatusFilter, setAuditStatusFilter] = useState<StockRequestStatus | "all">("all");

  // State for User Reports
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userDateRange, setUserDateRange] = useState<DateRange | undefined>(undefined);
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userStatusFilter, setUserStatusFilter] = useState<string>("all"); // 'all', 'active', 'inactive'

  const formatDate = (timestamp: any, includeTime: boolean = false) => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return includeTime ? format(date, 'PPp') : format(date, 'PP');
  };

  const fetchReportData = useCallback(async () => {
    if (!db) { return; }
    
    // Set all loaders to true
    setIsLoadingOrderStatus(true);
    setIsLoadingStockLevel(true);
    setIsLoadingSalesSummary(true);
    setIsLoadingAuditTrail(true);
    setIsLoadingUsers(true);

    try {
      // Parallel fetching
      const [
        ordersSnapshot,
        productsSnapshot,
        stockRequestsSnapshot,
        suppliersSnapshot,
        usersSnapshot,
      ] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(query(collection(db, 'products'), orderBy('name'))),
        getDocs(query(collection(db, 'stockRequests'), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, 'users'), where("role", "==", "Supplier"))),
        getDocs(query(collection(db, 'users'), orderBy("createdAt", "desc"))),
      ]);

      // Process Order Status & Sales Summary
      const ordersByStatus = new Map<OrderStatus, Order[]>();
      let totalRevenue = 0;
      const detailedPaidOrders: Order[] = [];
      ordersSnapshot.forEach(doc => {
        const order = { id: doc.id, ...doc.data() } as Order;
        if (!ordersByStatus.has(order.status)) {
          ordersByStatus.set(order.status, []);
        }
        ordersByStatus.get(order.status)!.push(order);
        if (order.paymentStatus === 'paid') {
            totalRevenue += order.totalAmount;
            detailedPaidOrders.push(order);
        }
      });
      const distribution: OrderStatusDistribution[] = Array.from(ordersByStatus.entries()).map(([status, orders]) => ({ status, count: orders.length, orders })).sort((a,b) => b.count - a.count);
      setOrderStatusData(distribution);
      setSalesSummaryData({ totalPaidOrders: detailedPaidOrders.length, totalRevenue, detailedPaidOrders });
      setIsLoadingOrderStatus(false);
      setIsLoadingSalesSummary(false);

      // Process Stock Level
      setStockLevelData(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockLevelData)));
      setIsLoadingStockLevel(false);

      // Process Audit Trail
      setAuditTrailData(stockRequestsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as StockRequest)));
      setSuppliers(suppliersSnapshot.docs.map(d => ({uid: d.id, ...d.data()} as AppUser)));
      setIsLoadingAuditTrail(false);

      // Process User Reports
      setAllUsers(usersSnapshot.docs.map(d => ({uid: d.id, ...d.data()} as AppUser)));
      setIsLoadingUsers(false);

    } catch (error) {
       console.error("Error fetching report data:", error);
       toast({ title: "Error", description: "Failed to load one or more reports.", variant: "destructive" });
       // Set all loaders to false on error
       setIsLoadingOrderStatus(false);
       setIsLoadingStockLevel(false);
       setIsLoadingSalesSummary(false);
       setIsLoadingAuditTrail(false);
       setIsLoadingUsers(false);
    }
  }, [toast]);


  useEffect(() => {
    if (!authLoading && (!user || role !== 'Admin')) {
      router.replace('/dashboard');
    } else if (user && role === 'Admin') {
      fetchReportData();
    }
  }, [user, role, authLoading, router, fetchReportData]);
  
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

  const filteredUserData = useMemo(() => {
    return allUsers.filter(usr => {
      const joinDate = usr.createdAt?.toDate ? usr.createdAt.toDate() : null;
      const dateMatch = !userDateRange || (
        joinDate &&
        (!userDateRange.from || joinDate >= userDateRange.from) &&
        (!userDateRange.to || joinDate <= userDateRange.to)
      );
      const roleMatch = userRoleFilter === 'all' || usr.role === userRoleFilter;

      let statusMatch = true;
      if (userStatusFilter === 'active') {
          statusMatch = !usr.disabled;
      } else if (userStatusFilter === 'inactive') {
          statusMatch = !!usr.disabled;
      }

      return dateMatch && roleMatch && statusMatch;
    });
  }, [allUsers, userDateRange, userRoleFilter, userStatusFilter]);

  const downloadCSV = (data: any[], filename: string, headers: string[]) => {
    if (!data || data.length === 0) {
      toast({ title: "No Data", description: "No data available to download.", variant: "default" });
      return;
    }

    const formatValueForCSV = (value: any): string => {
        if (value === null || value === undefined) return '';
        if (value instanceof Timestamp) return format(value.toDate(), 'yyyy-MM-dd HH:mm:ss');
        if (value instanceof Date) return format(value, 'yyyy-MM-dd HH:mm:ss');
        if (Array.isArray(value)) {
            // Check if it's an array of order items
            if (value.every(item => typeof item === 'object' && item !== null && 'name' in item && 'quantity' in item)) {
              return `"${value.map(item => `${item.quantity}x ${item.name}`).join('; ')}"`;
            }
            return `"${value.join('; ')}"`;
        }
        if (typeof value === 'object') {
            // Specifically handle ShippingAddress object
            if ('fullName' in value && 'addressLine1' in value) {
              const addr = value as ShippingAddress;
              const addressParts = [addr.addressLine1, addr.addressLine2, addr.city, addr.county].filter(Boolean);
              return `"${addressParts.join(', ').replace(/"/g, '""')}"`;
            }
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        let stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(header => {
        const key = header.toLowerCase().replace(/\s/g, '');
        // Find a key in the row object that matches the header, case-insensitively
        const rowKey = Object.keys(row).find(k => k.toLowerCase() === key);
        const rowValue = rowKey ? row[rowKey] : '';
        return formatValueForCSV(rowValue);
      });
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel
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
  const salesHeaders = ['id', 'customerName', 'customerEmail', 'totalAmount', 'paymentStatus', 'status', 'createdAt', 'items', 'shippingAddress'];
  const orderHeaders = ['id', 'customerName', 'customerEmail', 'totalAmount', 'status', 'createdAt'];
  const userHeaders = ['uid', 'displayName', 'email', 'role', 'status', 'createdAt', 'disabled'];

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
          <div className="flex items-center justify-between"><CardTitle className="font-headline text-xl">Order Status Distribution</CardTitle></div>
          <CardDescription>Current count of orders by their status. Expand to view and download.</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingOrderStatus ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        : orderStatusData.length === 0 ? <p className="text-muted-foreground text-center py-6">No order data available.</p> 
        : (<Accordion type="single" collapsible className="w-full">
            {orderStatusData.map(item => (
              <AccordionItem value={item.status} key={item.status}>
                <AccordionTrigger>
                  <div className="flex justify-between w-full pr-4">
                    <span className="capitalize">{item.status.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary">{item.count} Orders</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="p-2 space-y-3">
                    <Button variant="outline" size="sm" onClick={() => downloadCSV(item.orders, `orders_${item.status}`, orderHeaders)}><Download className="mr-2 h-4 w-4"/> Download List</Button>
                    <Table>
                      <TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {item.orders.map(order => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium text-primary hover:underline"><Link href={`/admin/orders/edit/${order.id}`}>{order.id.substring(0,8)}...</Link></TableCell>
                            <TableCell>{order.customerName}</TableCell>
                            <TableCell className="text-xs">{formatDate(order.createdAt)}</TableCell>
                            <TableCell className="text-right">{formatPrice(order.totalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
           </Accordion>
           )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between"><CardTitle className="font-headline text-xl">Stock Level Overview</CardTitle>
             <Button variant="outline" size="sm" onClick={() => downloadCSV(stockLevelData, 'stock_level_overview', ['id', 'name', 'categories', 'stock', 'price'])} disabled={isLoadingStockLevel || stockLevelData.length === 0}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
          </div><CardDescription>Current stock levels for all products.</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingStockLevel ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : stockLevelData.length === 0 ? <p className="text-muted-foreground text-center py-6">No product data available.</p> : (<Table><TableHeader><TableRow><TableHead>Product Name</TableHead><TableHead>Categories</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader><TableBody>{stockLevelData.map(product => (<TableRow key={product.id}><TableCell>{product.name}</TableCell><TableCell className="text-xs">{product.categories?.join(', ') || 'N/A'}</TableCell><TableCell className="text-right">{product.stock}</TableCell><TableCell className="text-right">{formatPrice(product.price)}</TableCell></TableRow>))}</TableBody></Table>)}</CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between"><CardTitle className="font-headline text-xl">Sales Summary</CardTitle>
                 <Button variant="outline" size="sm" onClick={() => downloadCSV(salesSummaryData?.detailedPaidOrders || [], 'sales_summary_details', salesHeaders)} disabled={isLoadingSalesSummary || !salesSummaryData || salesSummaryData.detailedPaidOrders.length === 0}><Download className="mr-2 h-4 w-4" /> Download Paid Orders CSV</Button>
            </div><CardDescription>Summary of paid orders and revenue.</CardDescription>
        </CardHeader>
        <CardContent>{isLoadingSalesSummary ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : salesSummaryData ? (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="p-4 bg-muted/50 rounded-md"><p className="text-sm text-muted-foreground">Total Paid Orders</p><p className="text-2xl font-bold">{salesSummaryData.totalPaidOrders}</p></div><div className="p-4 bg-muted/50 rounded-md"><p className="text-sm text-muted-foreground">Total Revenue from Paid Orders</p><p className="text-2xl font-bold">{formatPrice(salesSummaryData.totalRevenue)}</p></div></div>) : (<p className="text-muted-foreground text-center py-6">No sales data available.</p>)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="font-headline text-xl flex items-center gap-2"><UserCog /> User Management Report</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(filteredUserData, 'user_report', userHeaders)} disabled={isLoadingUsers || filteredUserData.length === 0}><Download className="mr-2 h-4 w-4" /> Download CSV</Button>
          </div>
          <CardDescription>View and export user data with status and role filters.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex flex-col md:flex-row gap-2 p-4 border rounded-lg bg-muted/50 mb-4 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button id="userDate" variant={"outline"} className={cn("w-full justify-start text-left font-normal md:w-[260px]", !userDateRange && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />
                  {userDateRange?.from ? (userDateRange.to ? <>{format(userDateRange.from, "LLL dd, y")} - {format(userDateRange.to, "LLL dd, y")}</> : format(userDateRange.from, "LLL dd, y")) : <span>Filter by registration date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={userDateRange?.from} selected={userDateRange} onSelect={setUserDateRange} numberOfMonths={2}/></PopoverContent>
            </Popover>
            <Select value={userRoleFilter} onValueChange={setUserRoleFilter}><SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Filter by role..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Roles</SelectItem>{allManageableRoles.map(r => r && <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={userStatusFilter} onValueChange={setUserStatusFilter}><SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Filter by status..." /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Statuses</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
            <Button variant="ghost" onClick={() => {setUserDateRange(undefined); setUserRoleFilter("all"); setUserStatusFilter("all");}} className="w-full md:w-auto"><FilterX className="mr-2 h-4 w-4" /> Clear</Button>
          </div>
          {isLoadingUsers ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          : filteredUserData.length === 0 ? <p className="text-muted-foreground text-center py-6">No users match your filters.</p>
          : (<Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead></TableRow></TableHeader>
                <TableBody>
                    {filteredUserData.map(u => (
                        <TableRow key={u.uid}><TableCell className="font-medium">{u.displayName}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.role}</TableCell>
                        <TableCell>
                            <Badge variant={getAccountStatusVariant(u)} className="capitalize">
                                {u.disabled ? "Inactive" : (u.status === 'pending' ? 'Pending' : 'Active')}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(u.createdAt)}</TableCell></TableRow>
                    ))}
                </TableBody>
            </Table>)}
        </CardContent>
      </Card>
    </div>
  );
}
    
