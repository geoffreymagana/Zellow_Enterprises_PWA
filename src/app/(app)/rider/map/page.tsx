
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, AlertTriangle, Navigation, UserCircle, Phone, Info, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Order, OrderStatus } from '@/types';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

// Ensure this is in a .env.local file as NEXT_PUBLIC_MAPBOX_TOKEN
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1Ijoib2RpbnN3b3JkIiwiYSI6ImNtYmphdTZoaTBldG8ybHFuZDdiZjN3bTMifQ.LdbfK1YplSmP0-tc46cblA';

interface DisplayOrder extends Order {
  marker?: mapboxgl.Marker;
}

export default function RiderMapPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const [assignedOrders, setAssignedOrders] = useState<DisplayOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<DisplayOrder | null>(null);
  const riderLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const focusedOrderId = searchParams.get('orderId');

  // Fetch assigned orders
  useEffect(() => {
    if (!user || !db || role !== 'Rider' && role !== 'Admin') return;

    const ordersQuery = query(collection(db, 'orders'), 
      where('riderId', '==', user.uid),
      where('status', 'in', ['assigned', 'out_for_delivery', 'delivery_attempted'])
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const orders: DisplayOrder[] = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() } as DisplayOrder));
      orders.sort((a,b) => (a.createdAt?.toDate?.()?.getTime() || 0) - (b.createdAt?.toDate?.()?.getTime() || 0)); // Example sort
      setAssignedOrders(orders);
      if(focusedOrderId && !selectedOrder){
        const orderToFocus = orders.find(o => o.id === focusedOrderId);
        if(orderToFocus) setSelectedOrder(orderToFocus);
      }
    }, (error) => {
      console.error("Error fetching rider orders:", error);
      toast({ title: "Error", description: "Could not fetch assigned orders.", variant: "destructive" });
    });
    return () => unsubscribe();
  }, [user, db, role, toast, focusedOrderId, selectedOrder]);


  // Initialize map
  useEffect(() => {
    if (authLoading || (role !== 'Rider' && role !== 'Admin')) return;

    if (!MAPBOX_ACCESS_TOKEN) {
      setMapError("Mapbox access token is not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN.");
      setMapLoading(false);
      return;
    }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    if (mapRef.current || !mapContainerRef.current) return;

    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [36.8219, -1.2921], // Default to Nairobi
        zoom: 10,
      });

      mapRef.current.on('load', () => {
        setMapLoading(false);
        // Add controls like zoom and rotation
        mapRef.current?.addControl(new mapboxgl.NavigationControl());
        // Try to get rider's current location
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (position) => {
              const { longitude, latitude } = position.coords;
              if (mapRef.current) {
                if (!riderLocationMarkerRef.current) {
                  riderLocationMarkerRef.current = new mapboxgl.Marker({ color: '#007cbf' }) // Blue for rider
                    .setLngLat([longitude, latitude])
                    .addTo(mapRef.current);
                } else {
                  riderLocationMarkerRef.current.setLngLat([longitude, latitude]);
                }
                 // Center map on rider if it's the first location update
                if (mapRef.current.getZoom() === 10 && mapRef.current.getCenter().lng === 36.8219) { // if still at default
                    mapRef.current.flyTo({ center: [longitude, latitude], zoom: 13 });
                }
                // TODO: Persist rider location to Firestore (user.currentLocation)
              }
            },
            (geoError) => {
              console.warn("Could not get rider location:", geoError.message);
              toast({ title: "Location Info", description: "Could not get your current location. Map will default to city center.", variant: "default" });
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        }
      });

      mapRef.current.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError(e.error?.message || 'An unexpected error occurred with the map.');
        setMapLoading(false);
      });

    } catch (error: any) {
      console.error("Error initializing Mapbox map:", error);
      setMapError(error.message || "Failed to initialize map.");
      setMapLoading(false);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (riderLocationMarkerRef.current) {
        riderLocationMarkerRef.current.remove();
        riderLocationMarkerRef.current = null;
      }
    };
  }, [authLoading, role, toast]);

  // Update map markers when orders change
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || assignedOrders.length === 0) return;

    const map = mapRef.current;
    
    // Clear existing order markers (simple way, could be more efficient)
    assignedOrders.forEach(order => order.marker?.remove());
    const updatedOrdersWithMarkers: DisplayOrder[] = [];

    const bounds = new mapboxgl.LngLatBounds();

    assignedOrders.forEach(order => {
      let newMarker;
      if (order.deliveryCoordinates) {
        const { lng, lat } = order.deliveryCoordinates;
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${order.status === 'delivered' ? 'green' : (order.color || 'red')}" width="36px" height="36px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12-2.5-2.5-2.5z"/><circle cx="12" cy="9.5" r="2.5"/></svg>')`;
        el.style.width = `36px`;
        el.style.height = `36px`;
        el.style.backgroundSize = '100%';
        el.style.cursor = 'pointer';
        
        newMarker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .addTo(map);
        newMarker.getElement().addEventListener('click', () => setSelectedOrder(order));
        bounds.extend([lng, lat]);
      }
      updatedOrdersWithMarkers.push({...order, marker: newMarker});
    });
    setAssignedOrders(prev => updatedOrdersWithMarkers); // Update state with marker instances

    if (focusedOrderId) {
        const orderToFocus = updatedOrdersWithMarkers.find(o => o.id === focusedOrderId);
        if (orderToFocus?.deliveryCoordinates) {
             map.flyTo({ center: [orderToFocus.deliveryCoordinates.lng, orderToFocus.deliveryCoordinates.lat], zoom: 14 });
        }
    } else if (!bounds.isEmpty() && riderLocationMarkerRef.current == null) { // Only fit to bounds if no rider location yet, or if specified.
         map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }

  }, [assignedOrders, mapRef.current?.isStyleLoaded(), focusedOrderId]); // Rerun when orders change or map loads


  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes?: string) => {
    if (!db || !user) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const currentOrder = assignedOrders.find(o => o.id === orderId);
      const newHistoryEntry = {
        status: newStatus,
        timestamp: serverTimestamp(),
        notes: notes || `Status: ${newStatus}`,
        actorId: user.uid,
      };
      const updatedHistory = arrayUnion(newHistoryEntry);

      await updateDoc(orderRef, { 
        status: newStatus, 
        updatedAt: serverTimestamp(),
        deliveryHistory: updatedHistory,
        ...(newStatus === 'delivered' && { actualDeliveryTime: serverTimestamp() })
      });
      toast({ title: "Success", description: `Order ${orderId} marked as ${newStatus}.` });
      setSelectedOrder(prev => prev && prev.id === orderId ? {...prev, status: newStatus} : prev);
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({ title: "Error", description: "Failed to update order status.", variant: "destructive" });
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (role !== 'Rider' && role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Access Denied. This page is for Riders.</div>;
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-var(--header-height,4rem))] gap-4 p-4"> {/* Adjust header height var if needed */}
      <div className="md:w-1/3 lg:w-1/4 space-y-4 overflow-y-auto">
        <h1 className="text-2xl font-headline font-semibold">My Route</h1>
        {assignedOrders.length === 0 && !mapLoading && (
            <Card><CardContent className="pt-6 text-muted-foreground">No active deliveries assigned.</CardContent></Card>
        )}
        {assignedOrders.map(order => (
            <Card 
                key={order.id} 
                onClick={() => {
                    setSelectedOrder(order);
                    if (order.deliveryCoordinates && mapRef.current) {
                        mapRef.current.flyTo({ center: [order.deliveryCoordinates.lng, order.deliveryCoordinates.lat], zoom: 15 });
                    }
                }}
                className={`cursor-pointer hover:shadow-lg ${selectedOrder?.id === order.id ? 'border-primary ring-2 ring-primary' : ''}`}
            >
                <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium">Order {order.id}</CardTitle>
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize w-fit">{order.status.replace(/_/g, ' ')}</Badge>
                </CardHeader>
                <CardContent className="text-xs">
                    <p>{order.deliveryAddress}</p>
                    <p>Customer: {order.customerName || 'N/A'}</p>
                </CardContent>
            </Card>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-4">
        <Card className="flex-grow min-h-[300px] md:min-h-0"> {/* Ensure map card can grow */}
          <CardContent className="p-0 h-full relative">
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
                <Alert variant="destructive" className="max-w-md"><AlertTriangle className="h-4 w-4" /><AlertTitle>Map Error</AlertTitle><AlertDescription>{mapError}</AlertDescription></Alert>
              </div>
            )}
            {mapLoading && !mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="ml-2">Loading map...</p></div>
            )}
            <div ref={mapContainerRef} className="w-full h-full rounded-md" />
          </CardContent>
        </Card>
        
        {selectedOrder && (
          <Card className="max-h-[40vh] overflow-y-auto"> {/* Details card with scroll */}
            <CardHeader>
              <CardTitle className="font-headline">Order Details: {selectedOrder.id}</CardTitle>
              <CardDescription>Status: <Badge variant={selectedOrder.status === 'delivered' ? 'default' : 'secondary'} className="capitalize">{selectedOrder.status.replace(/_/g, ' ')}</Badge></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="flex items-center"><UserCircle className="h-4 w-4 mr-2 text-muted-foreground" /> Customer: {selectedOrder.customerName || 'N/A'}</p>
              <p className="flex items-center"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /> Address: {selectedOrder.deliveryAddress}</p>
              {selectedOrder.customerPhone && <p className="flex items-center"><Phone className="h-4 w-4 mr-2 text-muted-foreground" /> Phone: <a href={`tel:${selectedOrder.customerPhone}`} className="text-primary hover:underline">{selectedOrder.customerPhone}</a></p>}
              {selectedOrder.deliveryNotes && <p className="flex items-center"><Info className="h-4 w-4 mr-2 text-muted-foreground" /> Notes: {selectedOrder.deliveryNotes}</p>}
            </CardContent>
            <CardFooter className="flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  if (selectedOrder.deliveryCoordinates) {
                    const { lng, lat } = selectedOrder.deliveryCoordinates;
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                  } else {
                    toast({title: "Error", description: "No coordinates for navigation.", variant: "destructive"});
                  }
                }}
              >
                <Navigation className="mr-2 h-4 w-4" /> Navigate
              </Button>
              {selectedOrder.status === 'assigned' && (
                <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}>
                  <Truck className="mr-2 h-4 w-4" /> Start Delivery
                </Button>
              )}
              {selectedOrder.status === 'out_for_delivery' && (
                <>
                  <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark Delivered
                  </Button>
                  <Button variant="outline" onClick={() => handleUpdateStatus(selectedOrder.id, 'delivery_attempted')}>
                    <AlertTriangle className="mr-2 h-4 w-4" /> Attempt Failed
                  </Button>
                </>
              )}
              {selectedOrder.status === 'delivery_attempted' && (
                 <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}>
                    <Truck className="mr-2 h-4 w-4" /> Re-attempt Delivery
                  </Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    mapboxgl?: typeof mapboxgl; // For direct use if needed, though react-map-gl handles this
  }
}

function query(arg0: any, arg1: any, arg2: any, arg3: any): import("firebase/firestore").Query<import("@firebase/firestore").DocumentData> | PromiseLike<import("firebase/firestore").Query<import("@firebase/firestore").DocumentData>> {
    throw new Error('Function not implemented.');
}
