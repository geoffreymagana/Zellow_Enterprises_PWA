
'use client'; // This can be a client component for interactivity if needed

import { Button } from '@/components/ui/button';
import { Home, Search } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground text-center p-4">
      <h1 className="text-6xl md:text-8xl font-bold font-headline text-primary mb-2">404</h1>
      <h2 className="text-xl md:text-2xl font-semibold mb-4">Page Not Found</h2>
      <p className="max-w-md text-muted-foreground mb-8">
        Oops! The page you are looking for does not exist. It might have been moved or deleted.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/dashboard" passHref>
          <Button size="lg">
            <Home className="mr-2 h-5 w-5" />
            Go to Homepage
          </Button>
        </Link>
        <Link href="/products" passHref>
          <Button size="lg" variant="outline">
            <Search className="mr-2 h-5 w-5" />
            Browse Products
          </Button>
        </Link>
      </div>
    </div>
  );
}
