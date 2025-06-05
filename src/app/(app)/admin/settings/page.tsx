
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function AdminSettingsPage() {
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
      <h1 className="text-3xl font-headline font-semibold">System Settings</h1>
      <p className="text-muted-foreground mb-6">Manage global application settings, integrations, and operational parameters.</p>
      <Card>
        <CardContent className="pt-6">
          <p>The system settings page will allow administrators to configure various aspects of the application, such as site branding, email notifications, API keys for third-party services, and other global configurations.</p>
        </CardContent>
      </Card>
    </div>
  );
}
