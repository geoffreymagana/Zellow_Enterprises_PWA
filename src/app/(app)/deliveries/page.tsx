"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Order } from "@/types"; // Assuming deliveries relate to orders
import { MapPin, Navigation, CheckCircle, PackageSearch, UserPlus, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

// Sample data, assuming a delivery might be linked to an order or be a standalone task
interface DeliveryTask extends Order { // Extending Order for simplicity, can be a separate type
  assigneeId?: string; // Rider ID
  deliveryNotes?: string;
}

const sampleDeliveries: DeliveryTask[] = [
  { id: 'DEL001', customerId: 'custXYZ', items: [], totalAmount: 0, status: 'shipped', createdAt: new Date('2023-11-03'), assigneeId: 'rider123', deliveryNotes: 'Gate code: #1234. Leave at front porch.' },
  { id: 'DEL002', customerId: 'custABC', items: [], totalAmount: 0, status: 'pending', createdAt: new Date('2023-11-04'), deliveryNotes: 'Fragile item, handle with care.' }, // Pending assignment
  { id: 'DEL003', customerId: 'custDEF', items: [], totalAmount: 0, status: 'delivered', createdAt: new Date('2023-11-01'), assigneeId: 'rider456', deliveryNotes: 'Customer received directly.' },
  { id: 'DEL004', customerId: 'custGHI', items: [], totalAmount: 0, status: 'shipped', createdAt: new Date('2023-11-04'), assigneeId: 'rider123', deliveryNotes: 'Call upon arrival.' },
];


export default function DeliveriesPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);

  useEffect(() => {
    if (role && !['Rider', 'DispatchManager'].includes(role)) {
      router.replace('/dashboard');
    } else if (user) {
      // Fetch deliveries based on role
      const userDeliveries = (role === 'Rider')
        ? sampleDeliveries.filter(d => d.assigneeId === user.uid && d.status === 'shipped')
        : sampleDeliveries; // DispatchManager sees all/pending
      setDeliveries(userDeliveries);
    }
  }, [user, role, router]);

  if (role && !['Rider', 'DispatchManager'].includes(role)) {
     return <div className="text-center py-10">Access denied. This page is for Riders and Dispatch Managers only.</div>;
  }

  const handleUpdateStatus = (deliveryId: string, newStatus: DeliveryTask['status']) => {
    // Update status in Firestore
    setDeliveries(prev => prev.map(d => d.id === deliveryId ? {...d, status: newStatus} : d));
    console.log(`Delivery ${deliveryId} status updated to ${newStatus}`);
    // Potentially upload proof for 'delivered' status
  };
  
  const getStatusBadgeVariant = (status: DeliveryTask['status']) => {
    switch (status) {
      case 'pending': return 'default'; // Dispatch Manager: Pending assignment
      case 'shipped': return 'secondary'; // Rider: Out for delivery
      case 'delivered': return 'default'; // Consider green
      case 'cancelled': return 'destructive';
      default: return 'outline';
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Rider' ? "My Deliveries" : "Manage Deliveries"}
        </h1>
        <div className="flex gap-2">
            <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
            {role === 'DispatchManager' && <Button size="sm"><PackageSearch className="mr-2 h-4 w-4" /> Create Delivery</Button>}
        </div>
      </div>

      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No deliveries assigned or matching filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {deliveries.map((delivery) => (
            <Card key={delivery.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="font-headline text-lg">Delivery {delivery.id}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(delivery.status)} className="capitalize">{delivery.status}</Badge>
                </div>
                <CardDescription>For: {delivery.customerId} | Due: {delivery.createdAt.toLocaleDateString()}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2">
                <p className="text-sm flex items-center"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /> Destination Address Placeholder</p>
                {delivery.deliveryNotes && <p className="text-sm text-muted-foreground">Notes: {delivery.deliveryNotes}</p>}
                {role === 'DispatchManager' && !delivery.assigneeId && delivery.status === 'pending' && (
                    <Button size="sm" variant="outline" className="w-full"><UserPlus className="mr-2 h-4 w-4"/>Assign to Rider</Button>
                )}
                {role === 'DispatchManager' && delivery.assigneeId && (
                    <p className="text-sm">Assigned to: {delivery.assigneeId}</p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button variant="outline" size="sm"><Navigation className="mr-2 h-4 w-4" /> Navigate</Button>
                {role === 'Rider' && delivery.status === 'shipped' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(delivery.id, 'delivered')}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark Delivered
                  </Button>
                )}
                {/* Add options for DispatchManager like reassign, cancel */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
       {role === 'DispatchManager' && (
         <Card className="mt-6">
            <CardHeader><CardTitle>Delivery Map Overview</CardTitle></CardHeader>
            <CardContent>
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <p className="text-muted-foreground">Map integration placeholder (e.g., Google Maps)</p>
                </div>
            </CardContent>
         </Card>
       )}
    </div>
  );
}
