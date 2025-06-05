
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";

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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">System Reports</h1>
      <p className="text-muted-foreground mb-6">Access and generate various system-wide reports for analytics and operational insights.</p>
      <Card>
        <CardContent className="pt-6">
          <p>This section will provide tools for generating and viewing reports on sales, user activity, inventory, financial performance, and other key metrics. Customizable report generation and export options will be available.</p>
        </CardContent>
      </Card>
    </div>
  );
}
