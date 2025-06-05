
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart as ShoppingCartIcon } from 'lucide-react';

export default function AdminOrdersPage() {
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">Order Management</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShoppingCartIcon className="h-6 w-6 text-primary" />
            <CardTitle>Manage Customer Orders</CardTitle>
          </div>
          <CardDescription>View, process, and track all customer orders from initiation to completion.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Order management dashboard will be implemented here. Admins can view order details, update statuses, manage refunds, and oversee the entire order lifecycle.</p>
        </CardContent>
      </Card>
    </div>
  );
}
