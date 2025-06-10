
"use client";

// This page is DEPRECATED as of [Date of change or relevant commit].
// The order success confirmation is now handled by a modal
// in src/app/(app)/checkout/review/page.tsx via the OrderSuccessModal component.
// This file can be safely deleted in a future cleanup.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedOrderSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the products page or dashboard as a fallback
    // if someone lands here directly.
    router.replace('/products');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <p className="text-lg text-muted-foreground">Redirecting...</p>
    </div>
  );
}
