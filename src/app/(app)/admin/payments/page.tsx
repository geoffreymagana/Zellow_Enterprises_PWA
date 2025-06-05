
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";

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
      <p className="text-muted-foreground mb-6">Administer payment gateways, view transaction histories, and manage financial reporting.</p>
      <Card>
        <CardContent className="pt-6">
          <p>Administrative tools for payment management will be located here. This includes configuring payment providers, viewing detailed transaction logs, handling disputes, and generating financial summaries.</p>
        </CardContent>
      </Card>
    </div>
  );
}
