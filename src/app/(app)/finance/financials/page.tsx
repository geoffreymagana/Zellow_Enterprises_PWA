
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DollarSign, ShoppingCart, TrendingUp, Coins, PackageIcon } from 'lucide-react'; // BarChart2Icon was used before, keeping for consistency if it was intended for a different use
import Image from 'next/image';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Invoice, OrderItem } from '@/types';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { MonthlyRevenueExpensesChart, type MonthlyDataPoint } from '@/components/charts/MonthlyRevenueExpensesChart';
import { TopSellingProductsChart, type ProductSalesData } from '@/components/charts/TopSellingProductsChart';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function FinancialsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [monthlyData, setMonthlyData] = useState<MonthlyDataPoint[]>([]);
  const [topProductsData, setTopProductsData] = useState<ProductSalesData[]>([]);

  const [totalRevenueAllTime, setTotalRevenueAllTime] = useState<number>(0);
  const [totalSalesAllTime, setTotalSalesAllTime] = useState<number>(0);
  const [totalExpensesAllTime, setTotalExpensesAllTime] = useState<number>(0);
  const [netProfitAllTime, setNetProfitAllTime] = useState<number>(0);

  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const fetchFinancialData = useCallback(async () => {
    if (!db) {
      setIsLoadingStats(false);
      return;
    }
    setIsLoadingStats(true);
    try {
      const paidOrdersQuery = query(collection(db, 'orders'), where("paymentStatus", "==", "paid"));
      const paidInvoicesQuery = query(collection(db, 'invoices'), where("status", "==", "paid"));

      const [ordersSnapshot, invoicesSnapshot] = await Promise.all([
        getDocs(paidOrdersQuery),
        getDocs(paidInvoicesQuery)
      ]);

      let revenueByMonth: Record<string, number> = {};
      let productSales: Record<string, { name: string; totalRevenue: number; totalQuantity: number }> = {};
      let salesCount = 0;
      let allTimeRevenue = 0;
      let firstTransactionDate = new Date();
      let lastTransactionDate = new Date(1970, 0, 1);


      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        allTimeRevenue += order.totalAmount;
        salesCount++;
        
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        if (orderDate < firstTransactionDate) firstTransactionDate = orderDate;
        if (orderDate > lastTransactionDate) lastTransactionDate = orderDate;

        const monthYear = format(orderDate, 'MMM yyyy');
        revenueByMonth[monthYear] = (revenueByMonth[monthYear] || 0) + order.totalAmount;

        order.items.forEach((item: OrderItem) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = { name: item.name, totalRevenue: 0, totalQuantity: 0 };
          }
          // Assuming item.price is the final price per unit for this order item
          productSales[item.productId].totalRevenue += (item.price); 
          productSales[item.productId].totalQuantity += item.quantity;
        });
      });

      let expensesByMonth: Record<string, number> = {};
      let allTimeExpenses = 0;
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        allTimeExpenses += invoice.totalAmount;

        const invoiceDate = invoice.invoiceDate?.toDate ? invoice.invoiceDate.toDate() : new Date();
        if (invoiceDate < firstTransactionDate) firstTransactionDate = invoiceDate;
        if (invoiceDate > lastTransactionDate) lastTransactionDate = invoiceDate;

        const monthYear = format(invoiceDate, 'MMM yyyy');
        expensesByMonth[monthYear] = (expensesByMonth[monthYear] || 0) + invoice.totalAmount;
      });

      setTotalRevenueAllTime(allTimeRevenue);
      setTotalSalesAllTime(salesCount);
      setTotalExpensesAllTime(allTimeExpenses);
      setNetProfitAllTime(allTimeRevenue - allTimeExpenses);

      // Determine the range of months to display, e.g., last 12 months or all available
      const dateRangeMonths = (firstTransactionDate.getFullYear() === new Date(1970,0,1).getFullYear() && lastTransactionDate.getFullYear() === new Date(1970,0,1).getFullYear())
        ? eachMonthOfInterval({ start: subMonths(new Date(), 11), end: new Date()})
        : eachMonthOfInterval({ start: startOfMonth(firstTransactionDate), end: endOfMonth(lastTransactionDate) });
      
      let cumulativeProfit = 0;
      const chartData: MonthlyDataPoint[] = dateRangeMonths.map(monthStart => {
        const monthKey = format(monthStart, 'MMM yyyy');
        const revenue = revenueByMonth[monthKey] || 0;
        const expenses = expensesByMonth[monthKey] || 0;
        const netProfit = revenue - expenses;
        cumulativeProfit += netProfit;
        return { month: format(monthStart, 'MMM'), revenue, expenses, netProfit, cumulativeNetProfit: cumulativeProfit };
      });
      setMonthlyData(chartData);

      const topProductsArray = Object.values(productSales)
        .sort((a,b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 7); 
      setTopProductsData(topProductsArray);

    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !['FinanceManager', 'Admin'].includes(role || '')) {
        router.replace('/dashboard');
      } else {
        fetchFinancialData();
      }
    }
  }, [user, role, authLoading, router, fetchFinancialData]);

  if (authLoading || isLoadingStats) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-semibold">Financials</h1>
        <p className="text-muted-foreground mt-1">
          Overview of key financial metrics and performance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenueAllTime)}</div>
            <p className="text-xs text-muted-foreground">From all paid orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSalesAllTime}</div>
            <p className="text-xs text-muted-foreground">Number of paid orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalExpensesAllTime)}</div>
            <p className="text-xs text-muted-foreground">From paid supplier invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(netProfitAllTime)}</div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses (All Time)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Monthly Revenue vs Expenses</CardTitle>
            <CardDescription>Financial health trend with monthly revenue and expenses.</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] sm:h-[450px] pb-0">
           {monthlyData.length > 0 ? (
              <MonthlyRevenueExpensesChart data={monthlyData} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No monthly data available to display chart.
              </div>
            )}
          </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Top Selling Products (by Revenue)</CardTitle>
            <CardDescription>Performance of best-selling items based on revenue from paid orders.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] sm:h-[400px] pb-0">
             {topProductsData.length > 0 ? (
                <TopSellingProductsChart data={topProductsData} />
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    No sales data available for top products.
                </div>
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Revenue Breakdown by Source</CardTitle>
            <CardDescription>Contribution of different revenue streams. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] sm:h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <Image src="https://placehold.co/600x300.png?text=Revenue+Sources+Chart" alt="Revenue Sources Chart Placeholder" width={600} height={300} className="opacity-50" data-ai-hint="revenue sources chart" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
