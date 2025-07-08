
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, BarChart2, Users, ShoppingCart, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, OrderStatus, Product } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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

export default function AdminReportsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orderStatusData, setOrderStatusData] = useState<OrderStatusDistribution[]>([]);
  const [isLoadingOrderStatus, setIsLoadingOrderStatus] = useState(true);

  const [stockLevelData, setStockLevelData] = useState<StockLevelData[]>([]);
  const [isLoadingStockLevel, setIsLoadingStockLevel] = useState(true);

  const [salesSummaryData, setSalesSummaryData] = useState<SalesSummaryData | null>(null);
  const [isLoadingSalesSummary, setIsLoadingSalesSummary] = useState(true);

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
      })).filter(item => item.count > 0); // Only show statuses with counts
      setOrderStatusData(distribution);
    } catch (error) {
      console.error("Error fetching order status distribution:", error);
      toast({ title: "Error", description: "Failed to load order status report.", variant: "destructive" });
    }
    setIsLoadingOrderStatus(false);
  }, [toast]);

  const fetchStockLevelOverview = useCallback(async () => {
    if (!db) { setIsLoadingStockLevel(false); return; }
    setIsLoadingStockLevel(true);
    try {
      const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('name')));
      setStockLevelData(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockLevelData)));
    } catch (error) {
      console.error("Error fetching stock levels:", error);
      toast({ title: "Error", description: "Failed to load stock level report.", variant: "destructive" });
    }
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
      setSalesSummaryData({ totalPaidOrders: paidOrdersSnapshot.size, totalRevenue, detailedPaidOrders: detailedOrders });
    } catch (error) {
      console.error("Error fetching sales summary:", error);
      toast({ title: "Error", description: "Failed to load sales summary.", variant: "destructive" });
    }
    setIsLoadingSalesSummary(false);
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (!user || role !== 'Admin')) {
      router.replace('/dashboard');
    } else if (user && role === 'Admin') {
      fetchOrderStatusDistribution();
      fetchStockLevelOverview();
      fetchSalesSummary();
    }
  }, [user, role, authLoading, router, fetchOrderStatusDistribution, fetchStockLevelOverview, fetchSalesSummary]);

  const downloadCSV = (data: any[], filename: string, headers: string[]) => {
    if (data.length === 0) {
        toast({ title: "No Data", description: "No data available to download.", variant: "default" });
        return;
    }
    const csvRows = [];
    csvRows.push(headers.join(',')); // Add header row

    data.forEach(row => {
        const values = headers.map(header => {
            const key = header.toLowerCase().replace(/\s+/g, '_'); // Simplistic key generation
            let value = row[key] ?? row[header as keyof typeof row] ?? ''; // Try different key formats or direct header
            
            if (key === 'categories' && Array.isArray(value)) {
                value = value.join('; ');
            } else if (typeof value === 'object' && value !== null && value.toDate) { // Handle Firestore Timestamps
                value = format(value.toDate(), 'yyyy-MM-dd HH:mm:ss');
            } else if (key === 'items' && Array.isArray(value)) {
                value = value.map(item => `${item.name} (Qty:${item.quantity}, Price:${item.price})`).join(' | ');
            } else if (key === 'shippingaddress' && typeof value === 'object' && value !== null) {
                value = `${value.fullName}, ${value.addressLine1}, ${value.city}, ${value.phone}`;
            }

            const escaped = ('' + value).replace(/"/g, '""'); // Escape double quotes
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${formatDateForFilename()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    toast({ title: "Download Started", description: `${filename}.csv is being downloaded.`});
  };


  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Unauthorized or redirecting...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-semibold">System Reports</h1>
        <p className="text-muted-foreground mt-1">
          Access and generate system-wide reports for analytics and operational insights.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-headline text-xl">Order Status Distribution</CardTitle>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(orderStatusData, 'order_status_distribution', ['Status', 'Count'])} disabled={isLoadingOrderStatus || orderStatusData.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
          </div>
          <CardDescription>Current count of orders by their status.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingOrderStatus ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : orderStatusData.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No order data available.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Status</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader>
              <TableBody>
                {orderStatusData.map(item => (
                  <TableRow key={item.status}>
                    <TableCell className="capitalize">{item.status.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-right">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-headline text-xl">Stock Level Overview</CardTitle>
             <Button variant="outline" size="sm" onClick={() => downloadCSV(stockLevelData, 'stock_level_overview', ['ID', 'Name', 'Categories', 'Stock', 'Price'])} disabled={isLoadingStockLevel || stockLevelData.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Download CSV
            </Button>
          </div>
          <CardDescription>Current stock levels for all products.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStockLevel ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : stockLevelData.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No product data available.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product Name</TableHead><TableHead>Categories</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
              <TableBody>
                {stockLevelData.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell className="text-xs">{product.categories?.join(', ') || 'N/A'}</TableCell>
                    <TableCell className="text-right">{product.stock}</TableCell>
                    <TableCell className="text-right">{formatPrice(product.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle className="font-headline text-xl">Sales Summary</CardTitle>
                 <Button variant="outline" size="sm" onClick={() => downloadCSV(salesSummaryData?.detailedPaidOrders || [], 'sales_summary_details', ['ID', 'CustomerName', 'CustomerEmail', 'TotalAmount', 'PaymentStatus', 'Status', 'CreatedAt', 'Items', 'ShippingAddress'])} disabled={isLoadingSalesSummary || !salesSummaryData || salesSummaryData.detailedPaidOrders.length === 0}>
                    <Download className="mr-2 h-4 w-4" /> Download Paid Orders CSV
                </Button>
            </div>
            <CardDescription>Summary of paid orders and revenue.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoadingSalesSummary ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : salesSummaryData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-md">
                        <p className="text-sm text-muted-foreground">Total Paid Orders</p>
                        <p className="text-2xl font-bold">{salesSummaryData.totalPaidOrders}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-md">
                        <p className="text-sm text-muted-foreground">Total Revenue from Paid Orders</p>
                        <p className="text-2xl font-bold">{formatPrice(salesSummaryData.totalRevenue)}</p>
                    </div>
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-6">No sales data available.</p>
            )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="font-headline text-xl">Other Reports</CardTitle>
            <CardDescription>
                These sections will be implemented in future updates.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {[
                { title: "Customer & User Reports", icon: Users, reports: ["New User Registrations", "User Activity Logs"] },
                { title: "Order Fulfillment Reports", icon: ShoppingCart, reports: ["Fulfillment Efficiency", "Delivery Performance"] },
            ].map(section => (
                 <Card key={section.title} className="bg-muted/30">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <section.icon className="h-6 w-6 text-muted-foreground" />
                            <CardTitle className="font-headline text-lg">{section.title}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pl-8">
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {section.reports.map(report => <li key={report}>{report}</li>)}
                        </ul>
                         <Button variant="outline" size="sm" disabled className="mt-2">
                            <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </CardContent>
      </Card>

    </div>
  );
}
