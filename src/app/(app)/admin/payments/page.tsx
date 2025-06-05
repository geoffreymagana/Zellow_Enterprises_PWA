
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign as DollarSignIcon } from 'lucide-react';

export default function AdminPaymentsPage() {
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
      <h1 className="text-3xl font-headline font-semibold">Payment Records & Administration</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <DollarSignIcon className="h-6 w-6 text-primary" />
            <CardTitle>Oversee Financial Transactions</CardTitle>
          </div>
          <CardDescription>Administer payment gateways, view transaction histories, and manage financial reporting.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Administrative tools for payment management will be located here. This includes configuring payment providers, viewing detailed transaction logs, handling disputes, and generating financial summaries.</p>
        </CardContent>
      </Card>
    </div>
  );
}
