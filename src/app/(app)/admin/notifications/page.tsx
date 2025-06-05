
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function AdminNotificationsPage() {
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
      <h1 className="text-3xl font-headline font-semibold">Notifications</h1>
      <p className="text-muted-foreground mb-6">View and manage system notifications for administrative actions or alerts.</p>
      <Card>
        <CardContent className="pt-6">
          <p>This section will display important system notifications. Admins can review alerts, system messages, or notifications that require their attention.</p>
        </CardContent>
      </Card>
    </div>
  );
}
