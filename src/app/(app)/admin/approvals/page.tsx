
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function AdminApprovalsPage() {
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
      <h1 className="text-3xl font-headline font-semibold">Approval Management</h1>
      <p className="text-muted-foreground mb-6">Manage and process pending approval requests from various parts of the system.</p>
      <Card>
        <CardContent className="pt-6">
          <p>The approval management interface will be built here. Admins can review items requiring approval (e.g., new user registrations, content submissions, high-value orders) and approve or reject them.</p>
        </CardContent>
      </Card>
    </div>
  );
}
