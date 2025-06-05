
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck as ClipboardCheckIcon } from 'lucide-react';

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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ClipboardCheckIcon className="h-6 w-6 text-primary" />
            <CardTitle>Review Pending Approvals</CardTitle>
          </div>
          <CardDescription>Manage and process pending approval requests from various parts of the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>The approval management interface will be built here. Admins can review items requiring approval (e.g., new user registrations, content submissions, high-value orders) and approve or reject them.</p>
        </CardContent>
      </Card>
    </div>
  );
}
