
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { BarChart2, Users, ShoppingCart, DollarSign, Package, Download } from 'lucide-react';

export default function AdminReportsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || role !== 'Admin')) {
      router.replace('/dashboard');
    }
  }, [user, role, loading, router]);

  if (loading || !user || role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading or unauthorized...</div>;
  }

  const reportSections = [
    {
      title: "Sales & Revenue Reports",
      icon: DollarSign,
      description: "Analyze sales trends, revenue by product, payment methods, and customer spending habits.",
      reports: [
        { name: "Overall Sales Summary", soon: true },
        { name: "Product Performance", soon: true },
        { name: "Revenue by Payment Method", soon: true },
      ]
    },
    {
      title: "Customer & User Reports",
      icon: Users,
      description: "Understand user demographics, registration trends, and engagement metrics.",
      reports: [
        { name: "New User Registrations", soon: true },
        { name: "User Activity Logs (High-Level)", soon: true },
      ]
    },
    {
      title: "Order & Fulfillment Reports",
      icon: ShoppingCart,
      description: "Track order statuses, fulfillment times, and delivery performance.",
      reports: [
        { name: "Order Status Distribution", soon: true },
        { name: "Fulfillment Efficiency", soon: true },
      ]
    },
    {
      title: "Inventory & Product Reports",
      icon: Package,
      description: "Monitor stock levels, product popularity, and inventory turnover.",
      reports: [
        { name: "Stock Level Overview", soon: true },
        { name: "Low Stock Alerts Report", soon: true },
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-semibold">System Reports</h1>
        <p className="text-muted-foreground mt-1">
          Access and generate various system-wide reports for analytics and operational insights.
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
          Note: Actual data fetching, chart generation, and report downloads are not yet implemented. This page outlines planned reporting capabilities.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {reportSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <section.icon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="font-headline text-xl">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Available Reports (Coming Soon):</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {section.reports.map(report => (
                  <li key={report.name}>
                    {report.name}
                    {report.soon && <span className="ml-2 text-xs text-primary/80">(Future Feature)</span>}
                  </li>
                ))}
              </ul>
              <div className="pt-2">
                 <Button variant="outline" size="sm" disabled>
                    <Download className="mr-2 h-4 w-4" /> Generate & Download (Disabled)
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline">Custom Report Generation</CardTitle>
            <CardDescription>
                Advanced reporting tools for creating custom queries and visualizations will be available here.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="p-6 bg-muted/50 rounded-md text-center">
                <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                    The interface for building custom reports and selecting date ranges or specific filters will be implemented in a future update.
                </p>
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
