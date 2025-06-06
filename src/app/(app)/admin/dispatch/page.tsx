
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, AlertTriangle, Package, UsersRound, Route, Palette, XCircle, CheckCircle, Edit2, MapPin, Phone, Info, SlidersHorizontal, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from '@/components/ui/badge';
import type { Order, User as AppUser, OrderStatus, DeliveryHistoryEntry } from '@/types';
import { collection, query as firestoreQuery, where, onSnapshot, doc, updateDoc, serverTimestamp, arrayUnion, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1Ijoib2RpbnN3b3JkIiwiYSI6ImNtYmphdTZoaTBldG8ybHFuZDdiZjN3bTMifQ.LdbfK1YplSmP0-tc46cblA';

const defaultOrderColors = ['#FF6347', '#4682B4', '#32CD32', '#FFD700', '#DA70D6', '#6A5ACD', '#FFA500', '#8A2BE2'];


export default function DispatchCenterPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<AppUser[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderForAssignment, setSelectedRiderForAssignment] = useState<string | null>(null);
  const [orderColorToEdit, setOrderColorToEdit] = useState<{orderId: string, currentColor: string | null} | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  
  const [orderFilterStatus, setOrderFilterStatus] = useState<OrderStatus | "all">("awaiting_assignment");

  const orderMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const riderMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());


  // Fetch Data (Orders and Riders)
  useEffect(() => {
    if (!db || (role !== 'DispatchManager' && role !== 'Admin')) return;

    const ordersUnsubscribe = onSnapshot(
      firestoreQuery(collection(db, 'orders')), (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach(doc => fetchedOrders.push({ id: doc.id, ...doc.data() } as Order));
        setAllOrders(fetchedOrders);
      }, (error) => {
        console.error("Error fetching orders:", error);
        toast({ title: "Error", description: "Could not fetch orders.", variant: "destructive" });
      });

    const ridersUnsubscribe = onSnapshot(
      firestoreQuery(collection(db, 'users'), where('role', '==', 'Rider'), where('disabled', '!=', true)), (snapshot) => {
        const fetchedRiders: AppUser[] = [];
        snapshot.forEach(doc => fetchedRiders.push({ uid: doc.id, ...doc.data() } as AppUser));
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
      setFilteredOrders(allOrders.filter(order => order.status !== 'delivered' && order.status !== 'cancelled'));
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
        style: 'mapbox://styles/mapbox/standard', 
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
     // Cleanup map instance and markers on component unmount
    return () => { 
        mapRef.current?.remove(); 
        mapRef.current = null; 
        orderMarkersRef.current.forEach(marker => marker.remove());
        orderMarkersRef.current.clear();
        riderMarkersRef.current.forEach(marker => marker.remove());
        riderMarkersRef.current.clear();
    };
  }, [authLoading, role]); // Only depends on authLoading and role for initial setup

  // Update Map Markers (Orders & Riders)
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || mapLoading) return;
    const map = mapRef.current;

    // Manage Order Markers
    const currentOrderIdsOnMap = new Set(allOrders.map(o => o.id));
    
    allOrders.forEach(order => {
      if (order.deliveryCoordinates) {
        const existingMarker = orderMarkersRef.current.get(order.id);
        const markerColor = order.color || 
                            (order.status === 'delivered' ? 'hsl(120, 60%, 50%)' : // green
                            (order.status === 'cancelled' ? 'hsl(0, 0%, 50%)' : // grey
                            'hsl(var(--primary))')); // blue/theme primary
        
        if (existingMarker) {
          existingMarker.setLngLat([order.deliveryCoordinates.lng, order.deliveryCoordinates.lat]);
          const el = existingMarker.getElement();
          if (el instanceof HTMLElement) { // Type guard
            el.style.backgroundColor = markerColor;
          }
        } else {
          const el = document.createElement('div');
          el.style.width = '20px';
          el.style.height = '20px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = markerColor;
          el.style.border = '2px solid hsl(var(--card))';
          el.style.boxShadow = '0 0 0 1px hsl(var(--border))';
          el.style.cursor = 'pointer';
          el.title = `Order ${order.id} - ${order.status}`;

          const newMarker = new mapboxgl.Marker(el)
            .setLngLat([order.deliveryCoordinates.lng, order.deliveryCoordinates.lat])
            .addTo(map);
          newMarker.getElement().addEventListener('click', (e) => {
            e.stopPropagation();
            setSelectedOrder(order);
            if(order.deliveryCoordinates) map.flyTo({center: [order.deliveryCoordinates.lng, order.deliveryCoordinates.lat], zoom: 14});
          });
          orderMarkersRef.current.set(order.id, newMarker);
        }
      } else { // If order has no coordinates, remove its marker if it exists
        const existingMarker = orderMarkersRef.current.get(order.id);
        if (existingMarker) {
            existingMarker.remove();
            orderMarkersRef.current.delete(order.id);
        }
      }
    });

    // Remove markers for orders that are no longer in `allOrders`
    orderMarkersRef.current.forEach((marker, orderId) => {
      if (!currentOrderIdsOnMap.has(orderId)) {
        marker.remove();
        orderMarkersRef.current.delete(orderId);
      }
    });

    // Manage Rider Markers
    const currentRiderUidsOnMap = new Set(riders.map(r => r.uid));

    riders.forEach(rider => {
      if (rider.currentLocation) {
        const existingMarker = riderMarkersRef.current.get(rider.uid);
        if (existingMarker) {
          existingMarker.setLngLat([rider.currentLocation.lng, rider.currentLocation.lat]);
        } else {
          const el = document.createElement('div');
          el.style.width = '28px';
          el.style.height = '28px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = 'hsl(var(--accent))'; 
          el.style.border = '2px solid hsl(var(--card))';
          el.style.display = 'flex';
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
          el.style.color = 'hsl(var(--accent-foreground))';
          el.style.fontSize = '12px';
          el.style.fontWeight = 'bold';
          el.innerHTML = rider.displayName ? rider.displayName.substring(0,1).toUpperCase() : 'R';
          el.style.cursor = 'pointer';
          el.title = rider.displayName || rider.email || "Rider";

          const newMarker = new mapboxgl.Marker(el)
            .setLngLat([rider.currentLocation.lng, rider.currentLocation.lat])
            .addTo(map);
          // newMarker.getElement().addEventListener('click', () => { /* Show rider details */ });
          riderMarkersRef.current.set(rider.uid, newMarker);
        }
      } else { // If rider has no location, remove their marker
         const existingMarker = riderMarkersRef.current.get(rider.uid);
        if (existingMarker) {
            existingMarker.remove();
            riderMarkersRef.current.delete(rider.uid);
        }
      }
    });

    riderMarkersRef.current.forEach((marker, riderUid) => {
      if (!currentRiderUidsOnMap.has(riderUid)) {
        marker.remove();
        riderMarkersRef.current.delete(riderUid);
      }
    });

  }, [allOrders, riders, mapLoading, mapRef.current?.isStyleLoaded()]);


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
        timestamp: Timestamp.now(), // Use client-side timestamp
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
      // Manually update local state for immediate reflection on map if needed, or rely on onSnapshot
      setAllOrders(prevOrders => prevOrders.map(o => o.id === orderColorToEdit.orderId ? {...o, color: color} : o));
      if(selectedOrder && selectedOrder.id === orderColorToEdit.orderId) {
        setSelectedOrder(prev => prev ? {...prev, color: color} : null);
      }
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
        timestamp: Timestamp.now(), // Use client-side timestamp
        notes: `Order cancelled by dispatcher ${user.displayName || user.email}`,
        actorId: user.uid,
      };
      await updateDoc(orderRef, {
        status: 'cancelled',
        riderId: null, 
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
    <div className="flex flex-col h-[calc(100vh-var(--header-height,4rem)-2rem)] p-4 gap-4">
      <div className="flex justify-between items-center">
         <h1 className="text-3xl font-headline font-semibold">Dispatch Center</h1>
         {/* Add any header controls for Dispatch Center here, if needed */}
      </div>
      
      <div className="flex flex-col md:flex-row flex-grow gap-4 overflow-hidden">
        <div className="md:w-1/3 lg:w-1/4 flex flex-col gap-4 overflow-y-auto pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Orders</CardTitle>
              <Select value={orderFilterStatus} onValueChange={(value) => setOrderFilterStatus(value as OrderStatus | "all")}>
                <SelectTrigger><SelectValue placeholder="Filter by status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Active (Non-Delivered/Cancelled)</SelectItem>
                  <SelectItem value="awaiting_assignment">Awaiting Assignment</SelectItem>
                  <SelectItem value="pending">Pending Confirmation</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivery_attempted">Delivery Attempted</SelectItem>
                  <SelectItem value="delivered">Delivered (View Only)</SelectItem>
                  <SelectItem value="cancelled">Cancelled (View Only)</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[calc(50vh-100px)] overflow-y-auto"> {/* Adjusted max height */}
              {filteredOrders.length === 0 && <p className="text-muted-foreground text-sm">No orders match filter.</p>}
              {filteredOrders.map(order => (
                <div key={order.id} 
                     className={`p-2 rounded-md border cursor-pointer hover:bg-muted ${selectedOrder?.id === order.id ? 'ring-2 ring-primary bg-muted' : ''}`}
                     onClick={() => {
                        setSelectedOrder(order);
                        if(order.deliveryCoordinates && mapRef.current) mapRef.current.flyTo({center: [order.deliveryCoordinates.lng, order.deliveryCoordinates.lat], zoom: 14});
                     }}>
                  <p className="font-semibold text-sm">ID: {order.id.substring(0,8)}...</p>
                  <p className="text-xs text-muted-foreground truncate" title={order.deliveryAddress}>{order.deliveryAddress}</p>
                  <Badge variant={order.status === 'delivered' ? 'default' : (order.status === 'cancelled' ? 'destructive' : 'secondary')} className="capitalize text-xs mt-1">{order.status.replace(/_/g, " ")}</Badge>
                  {order.riderName && <p className="text-xs mt-1">Rider: {order.riderName}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Riders ({riders.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[calc(40vh-100px)] overflow-y-auto"> {/* Adjusted max height */}
              {riders.length === 0 && <p className="text-muted-foreground text-sm">No active riders.</p>}
              {riders.map(rider => (
                <div key={rider.uid} className="p-2 rounded-md border">
                  <p className="font-semibold text-sm">{rider.displayName || rider.email}</p>
                  <p className="text-xs text-muted-foreground">Orders: {allOrders.filter(o => o.riderId === rider.uid && (o.status === 'assigned' || o.status === 'out_for_delivery')).length}</p> 
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex-grow flex flex-col gap-4 overflow-hidden">
          <Card className="flex-grow-[2] relative min-h-[300px]"> 
            <CardContent className="p-0 h-full">
              {mapError && <Alert variant="destructive" className="m-4"><AlertTriangle className="h-4 w-4" /><AlertTitle>Map Error</AlertTitle><AlertDescription>{mapError}</AlertDescription></Alert>}
              {mapLoading && !mapError && <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-2">Loading map...</p></div>}
              <div ref={mapContainerRef} className="w-full h-full rounded-md" />
            </CardContent>
          </Card>

          {selectedOrder && (
            <Card className="flex-grow-[1] max-h-[calc(100vh-var(--header-height,4rem)-2rem-300px-4rem-2rem)] overflow-y-auto"> {/* Adjust max-height */}
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="font-headline">Order: {selectedOrder.id.substring(0,12)}...</CardTitle>
                    <CardDescription>Status: <Badge variant={selectedOrder.status === 'delivered' ? 'default' : (selectedOrder.status === 'cancelled' ? 'destructive' : 'secondary')} className="capitalize">{selectedOrder.status.replace(/_/g, ' ')}</Badge></CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setOrderColorToEdit({orderId: selectedOrder.id, currentColor: selectedOrder.color || null})} aria-label="Set order color"><Palette className="h-4 w-4" /></Button>
                    {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                        <Button variant="ghost" size="icon" onClick={() => setOrderToCancel(selectedOrder)} aria-label="Cancel order"><XCircle className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center text-sm"><User className="h-4 w-4 mr-2 text-muted-foreground" /> Cust: {selectedOrder.customerName || selectedOrder.customerId}</p>
                <p className="flex items-center text-sm"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /> Addr: {selectedOrder.deliveryAddress}</p>
                {selectedOrder.customerPhone && <p className="flex items-center text-sm"><Phone className="h-4 w-4 mr-2 text-muted-foreground" /> Phone: <a href={`tel:${selectedOrder.customerPhone}`} className="text-primary hover:underline">{selectedOrder.customerPhone}</a></p>}
                {selectedOrder.deliveryNotes && <p className="flex items-center text-sm"><Info className="h-4 w-4 mr-2 text-muted-foreground" /> Notes: {selectedOrder.deliveryNotes}</p>}
                
                {(selectedOrder.status === 'awaiting_assignment' || selectedOrder.status === 'pending') && (
                  <div className="pt-2 border-t mt-2">
                    <p className="font-medium text-sm mb-1">Assign Rider:</p>
                    <div className="flex gap-2 items-center">
                      <Select onValueChange={setSelectedRiderForAssignment} value={selectedRiderForAssignment || undefined}>
                        <SelectTrigger className="flex-grow"><SelectValue placeholder="Select Rider" /></SelectTrigger>
                        <SelectContent>
                          {riders.length === 0 && <SelectItem value="no-riders" disabled>No riders available</SelectItem>}
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

      {orderColorToEdit && (
        <Dialog open={!!orderColorToEdit} onOpenChange={() => setOrderColorToEdit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Order Color for {orderColorToEdit.orderId.substring(0,12)}...</DialogTitle>
              <DialogDescription>Choose a color to represent this order on the map.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 py-4">
              {defaultOrderColors.map(color => (
                <Button key={color} style={{ backgroundColor: color, border: orderColorToEdit.currentColor === color ? '3px solid hsl(var(--foreground))' : '3px solid transparent' }} className="h-10 w-10 rounded-full" onClick={() => handleSetOrderColor(color)} aria-label={`Set color to ${color}`} />
              ))}
              <Input type="color" defaultValue={orderColorToEdit.currentColor || '#CCCCCC'} onChange={(e) => handleSetOrderColor(e.target.value)} className="h-10 w-16" aria-label="Custom color picker"/>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleSetOrderColor(orderColorToEdit.currentColor || 'hsl(var(--primary))')}>Reset to Default</Button>
              <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {orderToCancel && (
        <AlertDialog open={!!orderToCancel} onOpenChange={() => setOrderToCancel(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Order {orderToCancel.id.substring(0,12)}...?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action will mark the order as cancelled and unassign any rider. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Keep Order</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Cancel</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}


    

    

    