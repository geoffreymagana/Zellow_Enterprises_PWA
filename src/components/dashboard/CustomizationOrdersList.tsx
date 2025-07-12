
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Edit, Filter, Layers } from 'lucide-react';
import type { Order, OrderStatus } from '@/types';
import { Badge, BadgeProps } from "@/components/ui/badge";
import Link from 'next/link';
import { collection, onSnapshot, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

const orderStatuses: OrderStatus[] = [
  'pending', 'processing', 'awaiting_assignment', 'assigned', 
  'out_for_delivery', 'delivered', 'delivery_attempted', 'cancelled', 'shipped'
];

const ALL_STATUSES_SENTINEL = "__ALL_STATUSES__";

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

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

export function CustomizationOrdersList() {
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_SENTINEL);

  const fetchOrders = useCallback(() => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false); return () => {};
    }
    setIsLoading(true);
    
    // Fetch all orders and filter client-side for customizations.
    // Firestore doesn't support querying for the existence of a map field within an array.
    const q = query(collection(db, 'orders'), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let fetchedOrders: Order[] = [];
      querySnapshot.forEach((docSnapshot) => {
        fetchedOrders.push({ id: docSnapshot.id, ...docSnapshot.data() } as Order);
      });
      
      const customizationOrders = fetchedOrders.filter(order => 
        order.items.some(item => item.customizations && Object.keys(item.customizations).length > 0)
      );

      setOrders(customizationOrders);
      setIsLoading(false);
    }, (error) => {
        console.error("Failed to fetch orders:", error);
        toast({ title: "Error", description: "Failed to fetch orders.", variant: "destructive" });
        setIsLoading(false);
    });

    return unsubscribe;
  }, [toast]); 

  useEffect(() => {
    const unsubscribe = fetchOrders();
    return () => unsubscribe();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const searchTermLower = searchTerm.toLowerCase();
      const searchMatch = !searchTerm ||
        order.id.toLowerCase().includes(searchTermLower) ||
        order.customerName?.toLowerCase().includes(searchTermLower) ||
        order.customerEmail?.toLowerCase().includes(searchTermLower);
      
      const statusMatch = statusFilter === ALL_STATUSES_SENTINEL || order.status === statusFilter;
      
      return searchMatch && statusMatch;
    });
  }, [orders, searchTerm, statusFilter]);
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate ? format(timestamp.toDate(), 'PPp') : 'Invalid Date';
  };

  return (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2"><Layers /> Orders with Customizations</CardTitle>
            <CardDescription>View orders that require production tasks like engraving, printing, etc.</CardDescription>
             <div className="flex flex-col sm:flex-row gap-4 items-center pt-4">
                <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by Order ID, Customer Name/Email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full"
                />
                </div>
                <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value)}
                >
                <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ALL_STATUSES_SENTINEL}>All Statuses</SelectItem>
                    {orderStatuses.map(status => (
                    <SelectItem key={status} value={status} className="capitalize">
                        {status.replace(/_/g, ' ')}
                    </SelectItem>
                    ))}
                </SelectContent>
                </Select>
                {(searchTerm || statusFilter !== ALL_STATUSES_SENTINEL) && (
                    <Button variant="outline" size="sm" onClick={() => {setSearchTerm(""); setStatusFilter(ALL_STATUSES_SENTINEL);}}>
                        <Filter className="mr-2 h-3 w-3"/>Clear Filters
                    </Button>
                )}
            </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-muted-foreground">
                {orders.length === 0 ? "No orders with customizations found." : "No orders match your current filters."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium whitespace-nowrap">{order.id.substring(0,8)}...</TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customerName || "N/A"}</div>
                      <div className="text-xs text-muted-foreground">{order.customerEmail || "N/A"}</div>
                    </TableCell>
                    <TableCell>{formatDate(order.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={getOrderStatusBadgeVariant(order.status)} className="capitalize">
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(order.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/orders/edit/${order.id}`} passHref>
                        <Button variant="ghost" size="sm">
                           <Edit className="mr-0 sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Details</span>
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredOrders.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredOrders.length} of {orders.length} customization orders.</p></CardFooter>}
    </Card>
  );
}
