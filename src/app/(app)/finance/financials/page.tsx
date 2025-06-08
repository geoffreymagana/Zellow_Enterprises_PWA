
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DollarSign, ShoppingCart, TrendingUp, Coins, PackageIcon } from 'lucide-react';
import Image from 'next/image';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Invoice, OrderItem as FirestoreOrderItem } from '@/types'; // Renamed OrderItem to avoid conflict
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, isAfter, subMonths } from 'date-fns';
import { MonthlyRevenueExpensesChart, type DailyDataPoint } from '@/components/charts/MonthlyRevenueExpensesChart';
import { TopSellingProductsChart, type ProductSalesData } from '@/components/charts/TopSellingProductsChart';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function FinancialsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [dailyChartData, setDailyChartData] = useState<DailyDataPoint[]>([]);
  const [latestMonthLabel, setLatestMonthLabel] = useState<string>("");
  const [overallCumulativeNetProfit, setOverallCumulativeNetProfit] = useState<number>(0);
  const [latestMonthNetChange, setLatestMonthNetChange] = useState<number>(0);

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

      let allTimeRevenueCalc = 0;
      let allTimeExpensesCalc = 0;
      let salesCount = 0;
      const productSalesAgg: Record<string, { name: string; totalRevenue: number; totalQuantity: number }> = {};
      
      let firstTransactionDate = new Date(); // Initialize to a very future date
      let lastTransactionDate = new Date(1970, 0, 1); // Initialize to a very past date
      
      const monthlyRevenueMap: Record<string, number> = {};
      const monthlyExpensesMap: Record<string, number> = {};

      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        allTimeRevenueCalc += order.totalAmount;
        salesCount++;
        
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        if (isBefore(orderDate, firstTransactionDate)) firstTransactionDate = orderDate;
        if (isAfter(orderDate, lastTransactionDate)) lastTransactionDate = orderDate;

        const monthYearKey = format(orderDate, 'yyyy-MM');
        monthlyRevenueMap[monthYearKey] = (monthlyRevenueMap[monthYearKey] || 0) + order.totalAmount;

        order.items.forEach((item: FirestoreOrderItem) => {
          if (!productSalesAgg[item.productId]) {
            productSalesAgg[item.productId] = { name: item.name, totalRevenue: 0, totalQuantity: 0 };
          }
          productSalesAgg[item.productId].totalRevenue += item.price;
          productSalesAgg[item.productId].totalQuantity += item.quantity;
        });
      });

      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        allTimeExpensesCalc += invoice.totalAmount;
        
        const invoiceDate = invoice.invoiceDate?.toDate ? invoice.invoiceDate.toDate() : new Date();
         if (isBefore(invoiceDate, firstTransactionDate)) firstTransactionDate = invoiceDate;
        if (isAfter(invoiceDate, lastTransactionDate)) lastTransactionDate = invoiceDate;

        const monthYearKey = format(invoiceDate, 'yyyy-MM');
        monthlyExpensesMap[monthYearKey] = (monthlyExpensesMap[monthYearKey] || 0) + invoice.totalAmount;
      });

      setTotalRevenueAllTime(allTimeRevenueCalc);
      setTotalSalesAllTime(salesCount);
      setTotalExpensesAllTime(allTimeExpensesCalc);
      const allTimeNetProfit = allTimeRevenueCalc - allTimeExpensesCalc;
      setNetProfitAllTime(allTimeNetProfit);
      setOverallCumulativeNetProfit(allTimeNetProfit); // This is for the "Total Balance" display


      // Determine target month for daily chart (most recent month with activity)
      let targetMonthDate = lastTransactionDate;
      if (lastTransactionDate.getFullYear() === 1970) { // No transactions found
        targetMonthDate = new Date(); // Default to current month if no data
      }
      
      setLatestMonthLabel(format(targetMonthDate, 'MMMM yyyy'));
      const daysInTargetMonth = eachDayOfInterval({
        start: startOfMonth(targetMonthDate),
        end: (isSameMonth(targetMonthDate, new Date())) ? new Date() : endOfMonth(targetMonthDate)
      });

      const dailyDataForChart: DailyDataPoint[] = daysInTargetMonth.map(day => ({
        day: format(day, 'MMM dd'),
        revenue: 0,
        expenses: 0,
      }));

      let currentMonthNetChange = 0;

      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        if (isSameMonth(orderDate, targetMonthDate)) {
          const dayKey = format(orderDate, 'MMM dd');
          const dayEntry = dailyDataForChart.find(d => d.day === dayKey);
          if (dayEntry) {
            dayEntry.revenue += order.totalAmount;
            currentMonthNetChange += order.totalAmount;
          }
        }
      });

      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        const invoiceDate = invoice.invoiceDate?.toDate ? invoice.invoiceDate.toDate() : new Date();
         if (isSameMonth(invoiceDate, targetMonthDate)) {
          const dayKey = format(invoiceDate, 'MMM dd');
          const dayEntry = dailyDataForChart.find(d => d.day === dayKey);
          if (dayEntry) {
            dayEntry.expenses += invoice.totalAmount;
            currentMonthNetChange -= invoice.totalAmount;
          }
        }
      });
      
      setDailyChartData(dailyDataForChart);
      setLatestMonthNetChange(currentMonthNetChange);

      const topProductsArray = Object.values(productSalesAgg)
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
            <CardTitle className="text-sm font-medium">Net Profit (All Time)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(netProfitAllTime)}</div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Monthly Revenue vs Expenses</CardTitle>
            <CardDescription>Daily trend for the latest active month. (Overall Balance: {formatPrice(overallCumulativeNetProfit)})</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] sm:h-[450px] pb-0">
           {dailyChartData.length > 0 ? (
              <MonthlyRevenueExpensesChart 
                dailyData={dailyChartData} 
                overallCumulativeNetProfit={overallCumulativeNetProfit}
                latestMonthNetChange={latestMonthNetChange}
                latestMonthLabel={latestMonthLabel}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available for the selected month.
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

    