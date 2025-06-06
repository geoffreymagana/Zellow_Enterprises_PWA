
"use client";

import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import type { Order, OrderStatus } from "@/types";
import { Eye, RefreshCw, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation"; // Import useRouter
import { useEffect, useState } from "react";

const sampleOrders: Order[] = [
  { id: 'ORD001', customerId: 'cust123', items: [{productId: '1', name: 'Item 1', price: 1599, quantity: 2}], totalAmount: 3198.00, status: 'shipped', createdAt: new Date('2023-10-26'), shippingAddress:{fullName:'User', addressLine1:'123 Street', city:'Nairobi', county:'Nairobi', phone:'0712345678'}, paymentStatus: 'paid', subTotal: 3198, shippingCost: 0, customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '0712345678' },
  { id: 'ORD002', customerId: 'cust123', items: [{productId: '2', name: 'Item 2', price: 2550, quantity: 1}], totalAmount: 2550.00, status: 'processing', createdAt: new Date('2023-10-28'), shippingAddress:{fullName:'User', addressLine1:'123 Street', city:'Nairobi', county:'Nairobi', phone:'0712345678'}, paymentStatus: 'paid', subTotal: 2550, shippingCost: 0, customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '0712345678' },
  { id: 'ORD003', customerId: 'cust123', items: [{productId: '3', name: 'Item 3', price: 2000, quantity: 1}], totalAmount: 2000.00, status: 'pending', createdAt: new Date('2023-11-01'), shippingAddress:{fullName:'User', addressLine1:'123 Street', city:'Nairobi', county:'Nairobi', phone:'0712345678'}, paymentStatus: 'pending', subTotal: 2000, shippingCost: 0, customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '0712345678' },
  { id: 'ORD004', customerId: 'cust123', items: [{productId: '1', name: 'Item 1', price: 1599, quantity: 1}, {productId: '4', name: 'Item 4', price: 999, quantity: 3}], totalAmount: 4596.00, status: 'delivered', createdAt: new Date('2023-09-15'), shippingAddress:{fullName:'User', addressLine1:'123 Street', city:'Nairobi', county:'Nairobi', phone:'0712345678'}, paymentStatus: 'paid', subTotal: 4596, shippingCost: 0, customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '0712345678' },
];


const getOrderStatusBadgeVariant = (status: OrderStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusYellow';
    case 'processing': return 'statusAmber';
    case 'awaiting_assignment': return 'statusOrange';
    case 'assigned': return 'statusOrderAssigned';
    case 'out_for_delivery': return 'statusBlue';
    case 'shipped': return 'statusIndigo';
    case 'delivered': return 'statusGreen';
    case 'delivery_attempted': return 'statusPurple';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

export default function OrdersPage() {
  const { user, role } = useAuth(); // Get user and role
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    // This page could be for Customers or Staff (e.g., Service Manager viewing all orders)
    // For now, let's assume it's primarily for Customers.
    // Add more complex role-based data fetching if needed.
    if (user) {
      // In a real app, fetch orders for the current user or based on role
      // For example, if (role === 'Customer'), fetch user.uid's orders
      // If (role === 'ServiceManager'), fetch all orders or relevant ones
      setOrders(sampleOrders.filter(o => o.customerId === user.uid || role !== 'Customer')); // Simplified example
    } else if (!user && role === null) { // If not logged in, redirect
        router.replace('/login');
    }
  }, [user, role, router]);
  

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">My Orders</h1>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh Orders
        </Button>
      </div>
      
      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">You have no orders yet.</p>
            <div className="text-center mt-4">
              <Link href="/products" passHref>
                <Button>Start Shopping</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.createdAt.toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={getOrderStatusBadgeVariant(order.status)} className="capitalize">{order.status.replace(/_/g," ")}</Badge>
                    </TableCell>
                    <TableCell>Ksh {order.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/track/order/${order.id}`} passHref>
                        <Button variant="ghost" size="icon" aria-label="Track Order">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="icon" aria-label="View Invoice (Not implemented)">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
           <CardFooter className="pt-4">
             <p className="text-xs text-muted-foreground">Showing {orders.length} orders.</p>
           </CardFooter>
        </Card>
      )}
    </div>
  );
}
