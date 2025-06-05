
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, AlertTriangle, Package, UsersRound, Route, Palette, XCircle, CheckCircle, Edit2, MapPin, Phone, Info, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import type { Order, User, OrderStatus, DeliveryHistoryEntry } from '@/types';
import { collection, query as firestoreQuery, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1Ijoib2RpbnN3b3JkIiwiYSI6ImNtYmphdTZoaTBldG8ybHFuZDdiZjN3bTMifQ.LdbfK1YplSmP0-tc46cblA';

interface DisplayOrder extends Order {
  marker?: mapboxgl.Marker;
}
interface DisplayRider extends User {
  marker?: mapboxgl.Marker;
}

const defaultOrderColors = ['#FF6347', '#4682B4', '#32CD32', '#FFD700', '#DA70D6', '#6A5ACD'];

export default function DispatchCenterPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const [allOrders, setAllOrders] = useState<DisplayOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<DisplayOrder[]>([]);
  const [riders, setRiders] = useState<DisplayRider[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<DisplayOrder | null>(null);
  const [selectedRiderForAssignment, setSelectedRiderForAssignment] = useState<string | null>(null);
  const [orderColorToEdit, setOrderColorToEdit] = useState<{orderId: string, currentColor: string | null} | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<DisplayOrder | null>(null);
  
  const [orderFilterStatus, setOrderFilterStatus] = useState<OrderStatus | "all">("awaiting_assignment");


  // Fetch Data (Orders and Riders)
  useEffect(() => {
    if (!db || (role !== 'DispatchManager' && role !== 'Admin')) return;

    const ordersUnsubscribe = onSnapshot(
      firestoreQuery(collection(db, 'orders')), (snapshot) => {
        const fetchedOrders: DisplayOrder[] = [];
        snapshot.forEach(doc => fetchedOrders.push({ id: doc.id, ...doc.data() } as DisplayOrder));
        setAllOrders(fetchedOrders);
      }, (error) => {
        console.error("Error fetching orders:", error);
        toast({ title: "Error", description: "Could not fetch orders.", variant: "destructive" });
      });

    const ridersUnsubscribe = onSnapshot(
      firestoreQuery(collection(db, 'users'), where('role', '==', 'Rider'), where('disabled', '!=', true)), (snapshot) => {
        const fetchedRiders: DisplayRider[] = [];
        snapshot.forEach(doc => fetchedRiders.push({ uid: doc.id, ...doc.data() } as DisplayRider));
        setRiders(fetchedRiders);
      }, (error) => {
        console.error("Error fetching riders:", error);
        toast({ title: "Error", description: "Could not fetch riders.", variant: "destructive" });
      });
    
    return () => {
      ordersUnsubscribe();
      ridersUnsubscribe();
    };
  }, [db, role, toast]);

  // Filter orders based on status
  useEffect(() => {
    if (orderFilterStatus === "all") {
      setFilteredOrders(allOrders);
    } else {
      setFilteredOrders(allOrders.filter(order => order.status === orderFilterStatus));
    }
  }, [allOrders, orderFilterStatus]);


  // Initialize Map
  useEffect(() => {
    if (authLoading || (role !== 'DispatchManager' && role !== 'Admin')) return;
    if (!MAPBOX_ACCESS_TOKEN) {
      setMapError("Mapbox access token is not configured.");
      setMapLoading(false); return;
    }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    if (mapRef.current || !mapContainerRef.current) return;

    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/standard', // Using a standard style
        center: [36.8219, -1.2921], // Nairobi
        zoom: 10,
      });
      mapRef.current.on('load', () => {
        setMapLoading(false);
        mapRef.current?.addControl(new mapboxgl.NavigationControl());
      });
      mapRef.current.on('error', (e) => {
        setMapError(e.error?.message || 'Map error.');
        setMapLoading(false);
      });
    } catch (error: any) {
      setMapError(error.message || "Failed to init map.");
      setMapLoading(false);
    }
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, [authLoading, role]);

  // Update Map Markers (Orders & Riders)
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || mapLoading) return;
    const map = mapRef.current;

    // Clear existing markers and update internal state
    allOrders.forEach(o => o.marker?.remove());
    riders.forEach(r => r.marker?.remove());

    const updatedOrdersWithMarkers = allOrders.map(order => {
      let newMarker;
      if (order.deliveryCoordinates) {
        const el = document.createElement('div');
        el.style.width = '24px'; el.style.height = '24px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = order.color || (order.status === 'delivered' ? 'green' : (order.status === 'cancelled' ? 'grey' : 'blue'));
        el.style.border = '2px solid white';
        el.style.cursor = 'pointer';
        el.title = `Order ${order.id}`;
        newMarker = new mapboxgl.Marker(el).setLngLat([order.deliveryCoordinates.lng, order.deliveryCoordinates.lat]).addTo(map);
        newMarker.getElement().addEventListener('click', () => setSelectedOrder(order));
      }
      return { ...order, marker: newMarker };
    });
    // This direct state mutation for markers isn't ideal for React, but common for map libraries.
    // A more React-idiomatic way involves <Marker> components if using react-map-gl.
    setAllOrders(prev => prev.map(o => updatedOrdersWithMarkers.find(uo => uo.id === o.id) || o));


    const updatedRidersWithMarkers = riders.map(rider => {
      let newMarker;
      if (rider.currentLocation) {
        const el = document.createElement('div');
        el.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="purple" width="30px" height="30px"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>')`;
        el.style.width = '30px'; el.style.height = '30px';
        el.style.backgroundSize = 'cover';
        el.style.cursor = 'pointer';
        el.title = rider.displayName || rider.email || "Rider";
        newMarker = new mapboxgl.Marker(el).setLngLat([rider.currentLocation.lng, rider.currentLocation.lat]).addTo(map);
        // newMarker.getElement().addEventListener('click', () => {/* Show rider details */});
      }
      return { ...rider, marker: newMarker };
    });
    setRiders(prev => prev.map(r => updatedRidersWithMarkers.find(ur => ur.uid === r.uid) || r));


  }, [mapLoading, mapRef.current?.isStyleLoaded(), allOrders, riders]);


  const handleAssignRider = async () => {
    if (!selectedOrder || !selectedRiderForAssignment || !db || !user) {
      toast({ title: "Error", description: "Please select an order and a rider.", variant: "destructive" });
      return;
    }
    const riderToAssign = riders.find(r => r.uid === selectedRiderForAssignment);
    if (!riderToAssign) {
      toast({ title: "Error", description: "Selected rider not found.", variant: "destructive" });
      return;
    }

    try {
      const orderRef = doc(db, 'orders', selectedOrder.id);
      const historyEntry: DeliveryHistoryEntry = {
        status: 'assigned',
        timestamp: serverTimestamp(),
        notes: `Assigned to ${riderToAssign.displayName || riderToAssign.email} by dispatcher ${user.displayName || user.email}`,
        actorId: user.uid,
      };
      await updateDoc(orderRef, {
        riderId: selectedRiderForAssignment,
        riderName: riderToAssign.displayName || riderToAssign.email,
        status: 'assigned',
        deliveryHistory: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Success", description: `Order ${selectedOrder.id} assigned to ${riderToAssign.displayName || riderToAssign.email}.` });
      setSelectedOrder(null);
      setSelectedRiderForAssignment(null);
    } catch (error) {
      console.error("Error assigning rider:", error);
      toast({ title: "Error", description: "Failed to assign rider.", variant: "destructive" });
    }
  };

  const handleSetOrderColor = async (color: string) => {
    if (!orderColorToEdit || !db) return;
    try {
      const orderRef = doc(db, 'orders', orderColorToEdit.orderId);
      await updateDoc(orderRef, { color: color, updatedAt: serverTimestamp() });
      toast({ title: "Success", description: `Order color updated for ${orderColorToEdit.orderId}.` });
      setOrderColorToEdit(null);
    } catch (error) {
      console.error("Error setting order color:", error);
      toast({ title: "Error", description: "Failed to set order color.", variant: "destructive" });
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel || !db || !user) return;
    try {
      const orderRef = doc(db, 'orders', orderToCancel.id);
      const historyEntry: DeliveryHistoryEntry = {
        status: 'cancelled',
        timestamp: serverTimestamp(),
        notes: `Order cancelled by dispatcher ${user.displayName || user.email}`,
        actorId: user.uid,
      };
      await updateDoc(orderRef, {
        status: 'cancelled',
        riderId: null, // Unassign rider if any
        riderName: null,
        deliveryHistory: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Success", description: `Order ${orderToCancel.id} cancelled.` });
      setOrderToCancel(null);
      setSelectedOrder(prev => prev?.id === orderToCancel.id ? null : prev);
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({ title: "Error", description: "Failed to cancel order.", variant: "destructive" });
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (role !== 'DispatchManager' && role !== 'Admin') {
    router.replace('/dashboard');
    return <div className="flex items-center justify-center min-h-screen">Access Denied. Redirecting...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,4rem)-2rem)] p-4 gap-4"> {/* Adjust for header and page padding */}
      <h1 className="text-3xl font-headline font-semibold">Dispatch Center</h1>
      
      <div className="flex flex-col md:flex-row flex-grow gap-4 overflow-hidden">
        {/* Left Panel: Orders & Riders */}
        <div className="md:w-1/3 lg:w-1/4 flex flex-col gap-4 overflow-y-auto pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Orders</CardTitle>
              <Select value={orderFilterStatus} onValueChange={(value) => setOrderFilterStatus(value as OrderStatus | "all")}>
                <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active</SelectItem>
                  <SelectItem value="awaiting_assignment">Awaiting Assignment</SelectItem>
                  <SelectItem value="pending">Pending Confirmation</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivery_attempted">Delivery Attempted</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filteredOrders.length === 0 && <p className="text-muted-foreground text-sm">No orders match filter.</p>}
              {filteredOrders.map(order => (
                <div key={order.id} 
                     className={`p-2 rounded-md border cursor-pointer hover:bg-muted ${selectedOrder?.id === order.id ? 'ring-2 ring-primary bg-muted' : ''}`}
                     onClick={() => {
                        setSelectedOrder(order);
                        if(order.deliveryCoordinates && mapRef.current) mapRef.current.flyTo({center: [order.deliveryCoordinates.lng, order.deliveryCoordinates.lat], zoom: 14});
                     }}>
                  <p className="font-semibold text-sm">ID: {order.id}</p>
                  <p className="text-xs text-muted-foreground">{order.deliveryAddress}</p>
                  <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize text-xs mt-1">{order.status.replace(/_/g, " ")}</Badge>
                  {order.riderName && <p className="text-xs mt-1">Rider: {order.riderName}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Riders ({riders.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[30vh] overflow-y-auto">
              {riders.length === 0 && <p className="text-muted-foreground text-sm">No active riders.</p>}
              {riders.map(rider => (
                <div key={rider.uid} className="p-2 rounded-md border">
                  <p className="font-semibold text-sm">{rider.displayName || rider.email}</p>
                  {/* Placeholder for rider status/current task */}
                  <p className="text-xs text-muted-foreground">Orders: {rider.assignedOrdersCount || 0}</p> 
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Map & Selected Order Details */}
        <div className="flex-grow flex flex-col gap-4 overflow-hidden">
          <Card className="flex-grow-[2] relative min-h-[300px]"> {/* Map takes more space */}
            <CardContent className="p-0 h-full">
              {mapError && <Alert variant="destructive" className="m-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Map Error</AlertTitle><AlertDescription>{mapError}</AlertDescription></Alert>}
              {mapLoading && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-2">Loading map...</p></div>}
              <div ref={mapContainerRef} className="w-full h-full rounded-md" />
            </CardContent>
          </Card>

          {selectedOrder && (
            <Card className="flex-grow-[1] max-h-[45vh] overflow-y-auto"> {/* Details card scroll */}
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-headline">Order: {selectedOrder.id}</CardTitle>
                    <CardDescription>Status: <Badge variant={selectedOrder.status === 'delivered' ? 'default' : 'secondary'} className="capitalize">{selectedOrder.status.replace(/_/g, ' ')}</Badge></CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setOrderColorToEdit({orderId: selectedOrder.id, currentColor: selectedOrder.color || null})}><Palette className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setOrderToCancel(selectedOrder)}><XCircle className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center text-sm"><UserCircle className="h-4 w-4 mr-2 text-muted-foreground" /> Cust: {selectedOrder.customerName || selectedOrder.customerId}</p>
                <p className="flex items-center text-sm"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /> Addr: {selectedOrder.deliveryAddress}</p>
                {selectedOrder.customerPhone && <p className="flex items-center text-sm"><Phone className="h-4 w-4 mr-2 text-muted-foreground" /> Phone: <a href={`tel:${selectedOrder.customerPhone}`} className="text-primary hover:underline">{selectedOrder.customerPhone}</a></p>}
                {selectedOrder.deliveryNotes && <p className="flex items-center text-sm"><Info className="h-4 w-4 mr-2 text-muted-foreground" /> Notes: {selectedOrder.deliveryNotes}</p>}
                
                {selectedOrder.status === 'awaiting_assignment' && (
                  <div className="pt-2 border-t mt-2">
                    <p className="font-medium text-sm mb-1">Assign Rider:</p>
                    <div className="flex gap-2 items-center">
                      <Select onValueChange={setSelectedRiderForAssignment} value={selectedRiderForAssignment || undefined}>
                        <SelectTrigger className="flex-grow"><SelectValue placeholder="Select Rider" /></SelectTrigger>
                        <SelectContent>
                          {riders.map(r => <SelectItem key={r.uid} value={r.uid}>{r.displayName || r.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAssignRider} disabled={!selectedRiderForAssignment}>Assign</Button>
                    </div>
                  </div>
                )}
                {selectedOrder.riderName && <p className="text-sm pt-2 border-t mt-2">Assigned Rider: <span className="font-semibold">{selectedOrder.riderName}</span></p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Color Popover */}
      {orderColorToEdit && (
        <Dialog open={!!orderColorToEdit} onOpenChange={() => setOrderColorToEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Order Color for {orderColorToEdit.orderId}</DialogTitle>
              <DialogDescription>Choose a color to represent this order on the map.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-4">
              {defaultOrderColors.map(color => (
                <Button key={color} style={{ backgroundColor: color, border: orderColorToEdit.currentColor === color ? '3px solid black' : '3px solid transparent' }} className="h-10 w-10 rounded-full" onClick={() => handleSetOrderColor(color)} />
              ))}
              <Input type="color" defaultValue={orderColorToEdit.currentColor || '#CCCCCC'} onChange={(e) => handleSetOrderColor(e.target.value)} className="h-10 w-16" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOrderColorToEdit(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Cancel Order Dialog */}
      {orderToCancel && (
        <AlertDialog open={!!orderToCancel} onOpenChange={() => setOrderToCancel(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order {orderToCancel.id}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will mark the order as cancelled and unassign any rider. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90">Confirm Cancel</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

// Helper to simulate Firestore query for this component context.
// Replace with actual firestoreQuery from 'firebase/firestore' in real imports.
const query = (collectionRef: any, ...constraints: any[]) => firestoreQuery(collectionRef, ...constraints);
