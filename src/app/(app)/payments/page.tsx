
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DeprecatedPaymentsPage() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (role === 'FinanceManager' || role === 'Admin') {
        router.replace('/admin/payments');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [role, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading user role...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Page Moved</h1>
        <p className="text-muted-foreground mb-6">
            The payments management section has been moved.
        </p>
        <Link href={role === 'FinanceManager' || role === 'Admin' ? '/admin/payments' : '/dashboard'} passHref>
            <Button variant="default">
                {role === 'FinanceManager' || role === 'Admin' ? 'Go to Payments' : 'Go to Dashboard'}
            </Button>
        </Link>
    </div>
  );
}
    