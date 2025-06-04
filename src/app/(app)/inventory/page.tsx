"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Product } from "@/types";
import { PlusCircle, Search, Edit, AlertTriangle, PackageCheck, PackageX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const sampleInventory: Product[] = [
  { id: 'P001', name: 'Standard Mug Blank', description: 'White ceramic mug for customization.', price: 3.50, stock: 250, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: "blank mug" },
  { id: 'P002', name: 'Premium Ballpoint Pen', description: 'Metal pen for engraving.', price: 7.20, stock: 85, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: "blank pen" },
  { id: 'P003', name: 'Cotton T-Shirt (M, White)', description: 'Medium size, white cotton t-shirt.', price: 5.00, stock: 15, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: "blank t-shirt" },
  { id: 'P004', name: 'Acrylic Keychain Blank', description: 'Clear acrylic blank for keychains.', price: 1.10, stock: 500, imageUrl: 'https://placehold.co/100x100.png', dataAiHint: "blank keychain" },
];

export default function InventoryPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [inventory, setInventory] = useState<Product[]>(sampleInventory);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (role && !['InventoryManager', 'SupplyManager'].includes(role)) {
      router.replace('/dashboard');
    }
    // In a real app, fetch inventory from Firestore
  }, [role, router]);

  if (role && !['InventoryManager', 'SupplyManager'].includes(role)) {
    return <div className="text-center py-10">Access denied. This page is for Inventory or Supply Managers only.</div>;
  }

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const StockBadge = ({ stock }: { stock: number }) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    let icon = <PackageCheck className="h-3 w-3 mr-1" />;
    if (stock === 0) {
      variant = "destructive";
      icon = <PackageX className="h-3 w-3 mr-1" />;
    } else if (stock < 20) { // Low stock threshold
      variant = "secondary"; // Consider an orange/yellow variant
      icon = <AlertTriangle className="h-3 w-3 mr-1 text-orange-500" />;
    }
    return <Badge variant={variant} className="flex items-center">{icon}{stock} in stock</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Inventory Management</h1>
        {role === 'InventoryManager' && (
          <Link href="/inventory/new-item" passHref>
            <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add New Item</Button>
          </Link>
        )}
      </div>
      <CardDescription>
        View and manage product stock levels.
        {role === 'SupplyManager' && " You can also approve incoming stock from suppliers."}
      </CardDescription>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search inventory (ID, Name)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell><StockBadge stock={item.stock} /></TableCell>
                  <TableCell>${item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {role === 'InventoryManager' && (
                      <Link href={`/inventory/edit/${item.id}`} passHref>
                        <Button variant="ghost" size="icon" aria-label="Edit Item">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                     {role === 'SupplyManager' && (
                        <Button variant="outline" size="sm">Approve Stock</Button>
                     )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {filteredInventory.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No items match your search or no items in inventory.</p>
          )}
        </CardContent>
      </Card>

      {role === 'SupplyManager' && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier Deliveries Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">List of incoming stock from suppliers awaiting approval will appear here.</p>
            {/* Placeholder for supplier delivery approval list */}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
