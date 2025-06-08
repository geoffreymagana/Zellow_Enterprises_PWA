
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DollarSign, ShoppingCart, TrendingUp, Coins, PackageIcon, PieChartIcon } from 'lucide-react';
import Image from 'next/image';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Invoice, Product, OrderItem as FirestoreOrderItem } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, isAfter } from 'date-fns';
import { MonthlyRevenueExpensesChart, type DailyDataPoint } from '@/components/charts/MonthlyRevenueExpensesChart';
import { TopSellingProductsChart, type ProductSalesData } from '@/components/charts/TopSellingProductsChart';
import { RevenueBreakdownChart, type RevenueSourceData } from '@/components/charts/RevenueBreakdownChart';

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
  const [revenueBreakdownData, setRevenueBreakdownData] = useState<RevenueSourceData[]>([]);

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
      const productsQuery = query(collection(db, 'products'));
      const paidOrdersQuery = query(collection(db, 'orders'), where("paymentStatus", "==", "paid"));
      const paidInvoicesQuery = query(collection(db, 'invoices'), where("status", "==", "paid"));

      const [productsSnapshot, ordersSnapshot, invoicesSnapshot] = await Promise.all([
        getDocs(productsQuery),
        getDocs(paidOrdersQuery),
        getDocs(paidInvoicesQuery)
      ]);

      const productsMap = new Map<string, Product>();
      productsSnapshot.forEach(doc => productsMap.set(doc.id, { id: doc.id, ...doc.data() } as Product));

      let allTimeRevenueCalc = 0;
      let allTimeExpensesCalc = 0;
      let salesCount = 0;
      const productSalesAgg: Record<string, { name: string; totalRevenue: number; totalQuantity: number }> = {};
      
      let revenueFromProductSales = 0;
      let revenueFromCustomizations = 0;
      let revenueFromDeliveryFees = 0;

      let firstTransactionDate = new Date(); 
      let lastTransactionDate = new Date(1970, 0, 1); 
      
      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        allTimeRevenueCalc += order.totalAmount;
        salesCount++;
        revenueFromDeliveryFees += order.shippingCost || 0;
        
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        if (isBefore(orderDate, firstTransactionDate)) firstTransactionDate = orderDate;
        if (isAfter(orderDate, lastTransactionDate)) lastTransactionDate = orderDate;

        order.items.forEach((item: FirestoreOrderItem) => {
          const product = productsMap.get(item.productId);
          // Use the product's base price from the 'products' collection if available, 
          // otherwise fallback to the item's stored price (which might include old pricing or errors).
          // For customization calculation, item.price (at time of sale) is compared to product base price.
          const baseProductPrice = product ? product.price : item.unitPrice || item.price; // item.unitPrice should be base, item.price might be total for item


          // For "Product Sales" revenue, use the base price.
          revenueFromProductSales += baseProductPrice * item.quantity;

          // For "Customizations" revenue, calculate the difference.
          // item.price here should be the price of the item including customizations from the order.
          const itemTotalCustomizedPrice = item.price; // This is total price for the line item in the order (qty * (base + cust))
          const itemUnitCustomizedPrice = item.price / item.quantity; // Price per unit including customization

          const customizationRevenueForItem = (itemUnitCustomizedPrice - baseProductPrice) * item.quantity;
          if (customizationRevenueForItem > 0) {
            revenueFromCustomizations += customizationRevenueForItem;
          }
          
          if (!productSalesAgg[item.productId]) {
            productSalesAgg[item.productId] = { name: item.name, totalRevenue: 0, totalQuantity: 0 };
          }
          // For top selling products, use the item's total price as it reflects total customer payment for that item
          productSalesAgg[item.productId].totalRevenue += itemTotalCustomizedPrice; 
          productSalesAgg[item.productId].totalQuantity += item.quantity;
        });
      });

      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        allTimeExpensesCalc += invoice.totalAmount;
        
        const invoiceDate = invoice.invoiceDate?.toDate ? invoice.invoiceDate.toDate() : new Date();
         if (isBefore(invoiceDate, firstTransactionDate)) firstTransactionDate = invoiceDate;
        if (isAfter(invoiceDate, lastTransactionDate)) lastTransactionDate = invoiceDate;
      });

      setTotalRevenueAllTime(allTimeRevenueCalc);
      setTotalSalesAllTime(salesCount);
      setTotalExpensesAllTime(allTimeExpensesCalc);
      const allTimeNetProfit = allTimeRevenueCalc - allTimeExpensesCalc;
      setNetProfitAllTime(allTimeNetProfit);
      setOverallCumulativeNetProfit(allTimeNetProfit);

      setRevenueBreakdownData([
        { name: "Product Sales", value: revenueFromProductSales, color: "hsl(var(--chart-1))" },
        { name: "Customizations", value: revenueFromCustomizations, color: "hsl(var(--chart-2))" },
        { name: "Delivery Fees", value: revenueFromDeliveryFees, color: "hsl(var(--chart-3))" },
      ].filter(source => source.value > 0));


      let targetMonthDate = lastTransactionDate;
      if (lastTransactionDate.getFullYear() === 1970 && firstTransactionDate.getFullYear() !== new Date().getFullYear() + 50) { 
         targetMonthDate = firstTransactionDate; 
      }
      if (targetMonthDate.getFullYear() === 1970) { 
        targetMonthDate = new Date(); 
      }
      
      setLatestMonthLabel(format(targetMonthDate, 'MMMM yyyy'));
      const daysInTargetMonth = eachDayOfInterval({
        start: startOfMonth(targetMonthDate),
        end: (isSameMonth(targetMonthDate, new Date())) ? new Date() : endOfMonth(targetMonthDate)
      });

      const dailyDataForMonthChart: DailyDataPoint[] = daysInTargetMonth.map(day => ({
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
          const dayEntry = dailyDataForMonthChart.find(d => d.day === dayKey);
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
          const dayEntry = dailyDataForMonthChart.find(d => d.day === dayKey);
          if (dayEntry) {
            dayEntry.expenses += invoice.totalAmount;
            currentMonthNetChange -= invoice.totalAmount;
          }
        }
      });
      
      setDailyChartData(dailyDataForMonthChart);
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
            <CardDescription>Daily trend for the latest active month.</CardDescription>
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
            <CardTitle className="font-headline text-lg">Revenue Breakdown by Source</CardTitle>
            <CardDescription>Contribution of different revenue streams.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] sm:h-[400px] pb-0">
             {revenueBreakdownData.length > 0 ? (
                <RevenueBreakdownChart data={revenueBreakdownData} />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                    <PieChartIcon className="h-10 w-10 mb-2 text-muted-foreground/70" />
                    No revenue breakdown data available.
                </div>
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Top Selling Products (by Revenue)</CardTitle>
            <CardDescription>Performance of best-selling items based on revenue from paid orders.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px] sm:min-h-[350px] w-full h-full pb-0">
             {topProductsData.length > 0 ? (
                <TopSellingProductsChart data={topProductsData} />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                    <PackageIcon className="h-10 w-10 mb-2 text-muted-foreground/70"/>
                    No sales data available for top products.
                </div>
             )}
          </CardContent>
        </Card>
      </div>
      
       <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Expense Breakdown by Category</CardTitle>
            <CardDescription>Spending across different operational categories. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] sm:h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <Image src="https://placehold.co/600x300.png?text=Expense+Categories+Chart" alt="Expense Categories Chart Placeholder" width={600} height={300} className="opacity-50" data-ai-hint="expense categories chart"/>
          </CardContent>
        </Card>
    </div>
  );
}

    
