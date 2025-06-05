
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck as TruckIcon } from 'lucide-react';

export default function AdminDeliveriesPage() {
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
      <h1 className="text-3xl font-headline font-semibold">Delivery Logistics & Tracking</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <TruckIcon className="h-6 w-6 text-primary" />
            <CardTitle>Manage Deliveries</CardTitle>
          </div>
          <CardDescription>Oversee all delivery operations, track shipments, and manage dispatch logistics.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>This page will provide a comprehensive overview of all delivery activities. Admins can monitor delivery statuses, manage rider assignments (if applicable), and view delivery performance metrics.</p>
        </CardContent>
      </Card>
    </div>
  );
}
