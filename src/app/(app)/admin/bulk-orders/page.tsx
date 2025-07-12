
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2, PackagePlus, FileWarning } from 'lucide-react';

export default function AdminBulkOrdersPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && (!user || !['Admin', 'FinanceManager'].includes(role || ''))) {
      router.replace('/dashboard');
    }
  }, [user, role, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2">
            <PackagePlus className="h-7 w-7 text-primary"/> Bulk Order Services
        </h1>
        <Button disabled>Create Bulk Order Request</Button>
      </div>
       <p className="text-muted-foreground">
        Manage large or corporate orders, from request and payment approval to fulfillment.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Pending Bulk Order Requests</CardTitle>
          <CardDescription>
            This section will display new bulk order requests awaiting review and payment approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 text-center text-muted-foreground">
            <FileWarning className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50"/>
            <p className="font-semibold">No Pending Requests</p>
            <p className="text-sm">The full feature for managing bulk orders is under construction.</p>
        </CardContent>
      </Card>
    </div>
  );
}
