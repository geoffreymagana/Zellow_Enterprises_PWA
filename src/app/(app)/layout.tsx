
import { ReactNode, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AppLayoutClientBoundary } from '@/components/layout/AppLayoutClientBoundary';

// This is now a Server Component by default.
export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    // The Suspense boundary wraps the client component that uses hooks.
    // This allows the server to render the fallback first.
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <AppLayoutClientBoundary>{children}</AppLayoutClientBoundary>
    </Suspense>
  );
}
