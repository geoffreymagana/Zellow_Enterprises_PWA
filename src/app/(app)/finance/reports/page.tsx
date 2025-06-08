
"use client";

// This file is deprecated and its content has been moved to /src/app/(app)/finance/financials/page.tsx
// You can safely delete this file.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function DeprecatedFinanceReportsPage() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace('/finance/financials');
    }
  }, [role, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="ml-2">Redirecting to Financials...</p>
    </div>
  );
}
