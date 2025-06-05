
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package as PackageIcon } from 'lucide-react';

export default function AdminProductsPage() {
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
      <h1 className="text-3xl font-headline font-semibold">Product Catalog Management</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <PackageIcon className="h-6 w-6 text-primary" />
            <CardTitle>Manage Product Catalog</CardTitle>
          </div>
          <CardDescription>Administer all products, including categories, pricing, stock levels, and product details.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Product catalog management tools will be available here. This includes adding new products, editing existing ones, managing inventory links, and setting up product variants and categories.</p>
        </CardContent>
      </Card>
    </div>
  );
}
