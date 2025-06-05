
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";

export default function AdminCustomizationsPage() {
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
      <h1 className="text-3xl font-headline font-semibold">Customization Options Management</h1>
      <p className="text-muted-foreground mb-6">Define and manage the available customization options for products offered.</p>
      <Card>
        <CardContent className="pt-6">
          <p>This section will allow administrators to configure various customization parameters, such as text engraving options, image upload specifications, color choices, and other personalization features.</p>
        </CardContent>
      </Card>
    </div>
  );
}
