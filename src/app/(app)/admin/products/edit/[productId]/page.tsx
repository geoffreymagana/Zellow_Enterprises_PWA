
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Construction } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
// Placeholder for product type if needed for fetching actual data later
// import type { Product } from '@/types'; 

export default function AdminEditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const productId = typeof params.productId === 'string' ? params.productId : null;
  
  const [isLoading, setIsLoading] = useState(true);
  // const [product, setProduct] = useState<Product | null>(null); // For future data fetching

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else if (!productId) {
        router.replace('/admin/products'); // Redirect if no productId
      } else {
        // Future: Fetch product data using productId here
        // For now, just simulate loading completion
        setIsLoading(false);
      }
    }
  }, [user, role, authLoading, router, productId]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading product editor...</p>
      </div>
    );
  }

  if (!productId) {
     return (
      <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">
        <p>No product ID provided. <Link href="/admin/products" className="text-primary hover:underline">Return to products list.</Link></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/admin/products')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl md:text-2xl">Edit Product: {productId}</CardTitle>
          <CardDescription>Product editing functionality is under construction.</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-10">
          <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            This page will allow editing of product details.
            <br />
            For now, you can view the Product ID: <strong>{productId}</strong>.
          </p>
          {/* Placeholder for form or product details */}
        </CardContent>
      </Card>
    </div>
  );
}
