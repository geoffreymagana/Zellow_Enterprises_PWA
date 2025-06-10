
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, ShoppingCart, TrendingUp, Coins, PackageIcon, PieChartIcon, CalendarIcon, FilterX } from 'lucide-react';
import Image from 'next/image';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Invoice, Product, OrderItem as FirestoreOrderItem } from '@/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, isAfter, isValid, parseISO, subMonths, addDays } from 'date-fns';
import { MonthlyRevenueExpensesChart, type DailyDataPoint } from '@/components/charts/MonthlyRevenueExpensesChart';
import { TopSellingProductsChart, type ProductSalesData } from '@/components/charts/TopSellingProductsChart';
import { RevenueBreakdownChart, type RevenueSourceData } from '@/components/charts/RevenueBreakdownChart';
import { DateRangePicker } from '@/components/common/DateRangePicker'; // Assuming you might create this
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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
  const [targetMonthDateForChart, setTargetMonthDateForChart] = useState<Date>(new Date());

  const [topProductsData, setTopProductsData] = useState<ProductSalesData[]>([]);
  const [revenueBreakdownData, setRevenueBreakdownData] = useState<RevenueSourceData[]>([]);

  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [netProfit, setNetProfit] = useState<number>(0);

  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const fetchFinancialData = useCallback(async (filterRange?: { start?: Date, end?: Date }) => {
    if (!db) {
      setIsLoadingStats(false);
      return;
    }
    setIsLoadingStats(true);
    try {
      const productsQuery = query(collection(db, 'products'));
      
      let ordersBaseQuery = query(collection(db, 'orders'), where("paymentStatus", "==", "paid"));
      let invoicesBaseQuery = query(collection(db, 'invoices'), where("status", "==", "paid"));

      if (filterRange?.start) {
        ordersBaseQuery = query(ordersBaseQuery, where("createdAt", ">=", Timestamp.fromDate(filterRange.start)));
        invoicesBaseQuery = query(invoicesBaseQuery, where("invoiceDate", ">=", Timestamp.fromDate(filterRange.start)));
      }
      if (filterRange?.end) {
        const exclusiveEndDate = addDays(filterRange.end, 1);
        ordersBaseQuery = query(ordersBaseQuery, where("createdAt", "<", Timestamp.fromDate(exclusiveEndDate)));
        invoicesBaseQuery = query(invoicesBaseQuery, where("invoiceDate", "<", Timestamp.fromDate(exclusiveEndDate)));
      }
      
      const [productsSnapshot, ordersSnapshot, invoicesSnapshot] = await Promise.all([
        getDocs(productsQuery),
        getDocs(ordersBaseQuery),
        getDocs(invoicesBaseQuery)
      ]);

      const productsMap = new Map<string, Product>();
      productsSnapshot.forEach(doc => productsMap.set(doc.id, { id: doc.id, ...doc.data() } as Product));
      
      let revenueFromProductSales = 0;
      let revenueFromCustomizations = 0;
      let revenueFromDeliveryFees = 0;
      
      const monthlyRevenue: Record<string, number> = {};
      const monthlyExpenses: Record<string, number> = {};
      
      let firstTransactionDate = filterRange?.start || new Date(2999, 0, 1); 
      let lastTransactionDate = filterRange?.end || new Date(1970, 0, 1); 

      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        if (!order.createdAt?.toDate || !isValid(order.createdAt.toDate())) {
            console.warn(`Skipping order ${order.id} due to invalid createdAt date.`);
            return; // Skip this order if createdAt is invalid
        }
        const orderDate = order.createdAt.toDate();
        const monthKey = format(orderDate, 'yyyy-MM');

        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + order.totalAmount;
        revenueFromDeliveryFees += order.shippingCost || 0;
        
        if (!filterRange?.start && isBefore(orderDate, firstTransactionDate)) firstTransactionDate = orderDate;
        if (!filterRange?.end && isAfter(orderDate, lastTransactionDate)) lastTransactionDate = orderDate;

        order.items.forEach((item: FirestoreOrderItem) => {
          const product = productsMap.get(item.productId);
          const baseProductPrice = product ? product.price : (item.price / item.quantity);
          revenueFromProductSales += baseProductPrice * item.quantity;
          const customizationRevenueForItem = (item.price - baseProductPrice) * item.quantity;
          if (customizationRevenueForItem > 0) revenueFromCustomizations += customizationRevenueForItem;
        });
      });

      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        if (!invoice.invoiceDate?.toDate || !isValid(invoice.invoiceDate.toDate())) {
            console.warn(`Skipping invoice ${invoice.id} due to invalid invoiceDate.`);
            return; // Skip this invoice if invoiceDate is invalid
        }
        const invoiceDate = invoice.invoiceDate.toDate();
        const monthKey = format(invoiceDate, 'yyyy-MM');
        monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + invoice.totalAmount;

        if (!filterRange?.start && isBefore(invoiceDate, firstTransactionDate)) firstTransactionDate = invoiceDate;
        if (!filterRange?.end && isAfter(invoiceDate, lastTransactionDate)) lastTransactionDate = invoiceDate;
      });

      const currentRangeRevenue = Object.values(monthlyRevenue).reduce((sum, val) => sum + val, 0);
      const currentRangeExpenses = Object.values(monthlyExpenses).reduce((sum, val) => sum + val, 0);
      const currentNetProfit = currentRangeRevenue - currentRangeExpenses;

      setTotalRevenue(currentRangeRevenue);
      setTotalSales(ordersSnapshot.size);
      setTotalExpenses(currentRangeExpenses);
      setNetProfit(currentNetProfit); // This updates the summary card Net Profit
      
      setRevenueBreakdownData([
        { name: "Product Sales", value: revenueFromProductSales, color: "hsl(var(--chart-1))" },
        { name: "Customizations", value: revenueFromCustomizations, color: "hsl(var(--chart-2))" },
        { name: "Delivery Fees", value: revenueFromDeliveryFees, color: "hsl(var(--chart-3))" },
      ].filter(source => source.value > 0));

      let targetMonthForDailyChart = filterRange?.end ? filterRange.end : (isValid(lastTransactionDate) && lastTransactionDate.getFullYear() !== 1970 ? lastTransactionDate : new Date());
      setTargetMonthDateForChart(targetMonthForDailyChart);
      setLatestMonthLabel(format(targetMonthForDailyChart, 'MMMM yyyy'));
      
      const daysInTargetMonth = eachDayOfInterval({
        start: startOfMonth(targetMonthForDailyChart),
        end: (isSameMonth(targetMonthForDailyChart, new Date()) && (!filterRange || !filterRange.end || isSameMonth(filterRange.end, new Date()))) ? new Date() : endOfMonth(targetMonthForDailyChart)
      });

      const dailyDataForMonthChart: DailyDataPoint[] = daysInTargetMonth.map(day => ({
        day: format(day, 'MMM dd'), dateObject: day, revenue: 0, expenses: 0,
      }));

      let currentMonthRevenue = 0;
      let currentMonthExpenses = 0;

      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
         if (!order.createdAt?.toDate || !isValid(order.createdAt.toDate())) return;
        const orderDate = order.createdAt.toDate();
        if (isSameMonth(orderDate, targetMonthForDailyChart)) {
          const dayKey = format(orderDate, 'MMM dd');
          const dayEntry = dailyDataForMonthChart.find(d => d.day === dayKey);
          if (dayEntry) { dayEntry.revenue += order.totalAmount; currentMonthRevenue += order.totalAmount; }
        }
      });

      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        if (!invoice.invoiceDate?.toDate || !isValid(invoice.invoiceDate.toDate())) return;
        const invoiceDate = invoice.invoiceDate.toDate();
         if (isSameMonth(invoiceDate, targetMonthForDailyChart)) {
          const dayKey = format(invoiceDate, 'MMM dd');
          const dayEntry = dailyDataForMonthChart.find(d => d.day === dayKey);
          if (dayEntry) { dayEntry.expenses += invoice.totalAmount; currentMonthExpenses += invoice.totalAmount;}
        }
      });
      
      setDailyChartData(dailyDataForMonthChart);
      setLatestMonthNetChange(currentMonthRevenue - currentMonthExpenses);
      // This is the value passed to the chart for "Total Balance"
      setOverallCumulativeNetProfit(currentNetProfit); 

      const productSalesAgg: Record<string, { name: string; totalRevenue: number; totalQuantity: number }> = {};
      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        order.items.forEach((item: FirestoreOrderItem) => {
          if (!productSalesAgg[item.productId]) {
            productSalesAgg[item.productId] = { name: item.name, totalRevenue: 0, totalQuantity: 0 };
          }
          productSalesAgg[item.productId].totalRevenue += item.price * item.quantity;
          productSalesAgg[item.productId].totalQuantity += item.quantity;
        });
      });
      const topProductsArray = Object.values(productSalesAgg)
        .sort((a,b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);
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
        fetchFinancialData({ start: startDate, end: endDate });
      }
    }
  }, [user, role, authLoading, router, fetchFinancialData, startDate, endDate]);
  
  const handleDateFilterApply = () => {
     fetchFinancialData({ start: startDate, end: endDate });
  };

  const handleClearFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };


  if (authLoading || isLoadingStats) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const filterActive = startDate || endDate;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-headline font-semibold">Financials</h1>
            <p className="text-muted-foreground mt-1">
            {filterActive 
                ? `Showing data from ${startDate ? format(startDate, 'PP') : 'start'} to ${endDate ? format(endDate, 'PP') : 'today'}.` 
                : "Overview of key financial metrics and performance (All Time)."
            }
            </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
             <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="dateStart"
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-[180px] justify-start text-left font-normal h-9",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "LLL dd, y") : <span>Start date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    disabled={(date) => (endDate ? date > endDate : false) || date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            <Popover>
            <PopoverTrigger asChild>
                <Button
                id="dateEnd"
                variant={"outline"}
                className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal h-9",
                    !endDate && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "LLL dd, y") : <span>End date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
                disabled={(date) => (startDate ? date < startDate : false) || date > new Date()}
                />
            </PopoverContent>
            </Popover>
             {filterActive && (
                <Button onClick={handleClearFilter} variant="ghost" size="icon" className="h-9 w-9">
                    <FilterX className="h-4 w-4" /> <span className="sr-only">Clear Filter</span>
                </Button>
            )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue {filterActive && "(Filtered)"}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From paid orders {filterActive ? "in range" : "all time"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales {filterActive && "(Filtered)"}</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">Number of paid orders {filterActive ? "in range" : "all time"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses {filterActive && "(Filtered)"}</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">From paid supplier invoices {filterActive ? "in range" : "all time"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit {filterActive ? "(Selected Range)" : "(All Time)"}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(netProfit)}</div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Monthly Revenue vs Expenses</CardTitle>
            <CardDescription>Daily trend for {filterActive ? format(targetMonthDateForChart, 'MMMM yyyy') : "latest active month"}.</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px] sm:h-[420px] md:h-[480px] lg:h-[520px] pb-0">
           {dailyChartData.length > 0 ? (
              <MonthlyRevenueExpensesChart 
                dailyData={dailyChartData} 
                overallCumulativeNetProfit={overallCumulativeNetProfit}
                latestMonthNetChange={latestMonthNetChange}
                latestMonthLabel={latestMonthLabel}
                targetMonthDate={targetMonthDateForChart}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No data available for the selected month/range.
              </div>
            )}
          </CardContent>
        </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Revenue Breakdown by Source {filterActive && "(Filtered)"}</CardTitle>
            <CardDescription>Contribution of different revenue streams.</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px] sm:h-[420px] md:h-[480px] lg:h-[520px] w-full pb-0">
             {revenueBreakdownData.length > 0 ? (
                <RevenueBreakdownChart data={revenueBreakdownData} />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                    <PieChartIcon className="h-10 w-10 mb-2 text-muted-foreground/70" />
                    No revenue breakdown data available {filterActive && "for this range"}.
                </div>
             )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Top Selling Products (Revenue) {filterActive && "(Filtered)"}</CardTitle>
            <CardDescription>Performance of best-selling items based on revenue from paid orders.</CardDescription>
          </CardHeader>
          <CardContent className="h-[360px] sm:h-[420px] md:h-[480px] lg:h-[520px] w-full pb-0">
             {topProductsData.length > 0 ? (
                <TopSellingProductsChart data={topProductsData} />
             ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                    <PackageIcon className="h-10 w-10 mb-2 text-muted-foreground/70"/>
                    No sales data available for top products {filterActive && "in this range"}.
                </div>
             )}
          </CardContent>
        </Card>
      </div>
      
       <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Expense Breakdown by Category {filterActive && "(Filtered)"}</CardTitle>
            <CardDescription>Spending across different operational categories. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] sm:h-[400px] flex items-center justify-center bg-muted/50 rounded-md">
            <Image src="https://placehold.co/600x300.png?text=Expense+Categories+Chart" alt="Expense Categories Chart Placeholder" width={600} height={300} className="opacity-50" data-ai-hint="expense categories chart"/>
          </CardContent>
        </Card>
    </div>
  );
}
