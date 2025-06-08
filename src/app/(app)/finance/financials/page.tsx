
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DollarSign, ShoppingCart, TrendingUp, TrendingDown, BarChart2, Coins } from 'lucide-react';
import Image from 'next/image';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, Invoice } from '@/types'; // Added Invoice type

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

export default function FinancialsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0); // New state for expenses
  const [netProfit, setNetProfit] = useState<number>(0); // New state for profit
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const fetchFinancialData = useCallback(async () => {
    if (!db) {
      setIsLoadingStats(false);
      return;
    }
    setIsLoadingStats(true);
    try {
      // Fetch paid orders for revenue and sales
      const paidOrdersQuery = query(collection(db, 'orders'), where("paymentStatus", "==", "paid"));
      const ordersSnapshot = await getDocs(paidOrdersQuery);
      
      let revenue = 0;
      let salesCount = 0;
      ordersSnapshot.forEach((doc) => {
        const order = doc.data() as Order;
        revenue += order.totalAmount;
        salesCount++;
      });
      setTotalRevenue(revenue);
      setTotalSales(salesCount);

      // Fetch paid invoices for expenses
      const paidInvoicesQuery = query(collection(db, 'invoices'), where("status", "==", "paid"));
      const invoicesSnapshot = await getDocs(paidInvoicesQuery);
      let expenses = 0;
      invoicesSnapshot.forEach((doc) => {
        const invoice = doc.data() as Invoice;
        expenses += invoice.totalAmount;
      });
      setTotalExpenses(expenses);

      // Calculate Net Profit
      setNetProfit(revenue - expenses);

    } catch (error) {
      console.error("Error fetching financial data:", error);
      // Optionally, set error state and display to user
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
          Overview of key financial metrics and sales performance.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From all paid orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
            <p className="text-xs text-muted-foreground">Number of paid orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground">From paid supplier invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(netProfit)}</div>
            <p className="text-xs text-muted-foreground">Revenue - Expenses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Revenue Over Time</CardTitle>
            <CardDescription>Monthly revenue trends.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
            <Image src="https://placehold.co/600x300.png?text=Revenue+Chart" alt="Revenue Chart Placeholder" width={600} height={300} className="opacity-50" data-ai-hint="revenue chart" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-lg">Sales by Category/Product</CardTitle>
            <CardDescription>Performance of different product categories or items.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center bg-muted/50 rounded-md">
             <Image src="https://placehold.co/600x300.png?text=Sales+Breakdown+Chart" alt="Sales Breakdown Chart Placeholder" width={600} height={300} className="opacity-50" data-ai-hint="sales chart" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
