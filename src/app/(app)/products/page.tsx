
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { PlusCircle, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link"; // Import Link
import { useRouter } from "next/navigation"; // Import useRouter
import { useEffect } from "react";

const sampleProducts: Product[] = [
  { id: '1', name: 'Custom Mug', description: 'Personalize with your text and images.', price: 1599.00, imageUrl: 'https://placehold.co/600x400.png', stock: 100, dataAiHint: "custom mug" },
  { id: '2', name: 'Engraved Pen', description: 'Elegant pen with custom engraving.', price: 2550.00, imageUrl: 'https://placehold.co/600x400.png', stock: 50, dataAiHint: "engraved pen" },
  { id: '3', name: 'Printed T-Shirt', description: 'High-quality custom printed t-shirt.', price: 2000.00, imageUrl: 'https://placehold.co/600x400.png', stock: 200, dataAiHint: "printed t-shirt" },
  { id: '4', name: 'Custom Keychain', description: 'A unique keychain with your design.', price: 999.00, imageUrl: 'https://placehold.co/600x400.png', stock: 150, dataAiHint: "custom keychain" },
];

export default function ProductsPage() {
  const { role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (role && role !== 'Customer') {
      router.replace('/dashboard'); // Redirect non-customers
    }
  }, [role, router]);

  if (role !== 'Customer') {
    return <div className="text-center py-10">Access denied. This page is for customers only.</div>;
  }
  
  // In a real app, fetch products from Firestore
  // const [products, setProducts] = useState<Product[]>([]);
  // useEffect(() => { /* Fetch products logic */ setProducts(sampleProducts); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Our Products</h1>
        <Link href="/orders/cart" passHref>
           <Button variant="outline">
            <ShoppingCart className="mr-2 h-4 w-4" /> View Cart
          </Button>
        </Link>
      </div>
      
      <p className="text-muted-foreground">Browse our collection and customize your items.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sampleProducts.map((product) => (
          <Card key={product.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="p-0">
              <div className="aspect-video relative w-full">
                <Image 
                  src={product.imageUrl!} 
                  alt={product.name} 
                  layout="fill" 
                  objectFit="cover"
                  data-ai-hint={product.dataAiHint}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-4 flex-grow">
              <CardTitle className="text-lg font-semibold mb-1 font-headline">{product.name}</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mb-2">{product.description}</CardDescription>
              <p className="text-xl font-bold text-primary">Ksh {product.price.toFixed(2)}</p>
            </CardContent>
            <CardFooter className="flex justify-between items-center p-4">
              <Button size="sm" variant="outline">
                <PlusCircle className="mr-2 h-4 w-4" /> Customize
              </Button>
              <Button size="sm">
                Add to Cart
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
