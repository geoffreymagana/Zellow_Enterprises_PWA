
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, AlertTriangle, Navigation, UserCircle, Phone, Info, CheckCircle, XCircle, Truck, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Order, OrderStatus } from '@/types';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp, Unsubscribe, collection, query, where, Timestamp } from 'firebase/firestore';
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
    if (!user || !db || (role !== 'Rider' && role !== 'Admin')) return () => {};

    const ordersQuery = query(collection(db, 'orders'), 
      where('riderId', '==', user.uid),
      where('status', 'in', ['assigned', 'out_for_delivery', 'delivery_attempted'])
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const orders: DisplayOrder[] = [];
      snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() } as DisplayOrder));
      orders.sort((a,b) => (a.createdAt?.toDate?.()?.getTime() || 0) - (b.createdAt?.toDate?.()?.getTime() || 0)); // Example sort
      console.log('[RiderMapPage] Fetched orders for rider:', user?.uid, orders); // DEBUG LOG
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
                  const el = document.createElement('div');
                  el.style.width = '20px';
                  el.style.height = '20px';
                  el.style.borderRadius = '50%';
                  el.style.backgroundColor = 'hsl(var(--primary))'; // Rider color
                  el.style.border = '2px solid hsl(var(--card))';
                  riderLocationMarkerRef.current = new mapboxgl.Marker({ element: el }) 
                    .setLngLat([longitude, latitude])
                    .addTo(mapRef.current);
                } else {
                  riderLocationMarkerRef.current.setLngLat([longitude, latitude]);
                }
                 // Center map on rider if it's the first location update
                if (mapRef.current.getZoom() === 10 && mapRef.current.getCenter().lng.toFixed(4) === '36.8219' && mapRef.current.getCenter().lat.toFixed(4) === '-1.2921') { // if still at default
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
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || mapLoading) return;

    const map = mapRef.current;
    
    // Manage existing markers: remove markers for orders no longer in assignedOrders
    const currentOrderIds = new Set(assignedOrders.map(o => o.id));
    const ordersWithMarkers = assignedOrders.filter(o => o.marker);

    ordersWithMarkers.forEach(order => {
        if (!currentOrderIds.has(order.id) && order.marker) {
            order.marker.remove();
            // Remove from state too (or handle in main order fetching effect)
            setAssignedOrders(prev => prev.map(o => o.id === order.id ? {...o, marker: undefined} : o));
        }
    });
    
    const updatedOrdersWithMarkers: DisplayOrder[] = [...assignedOrders]; // Start with current orders

    const bounds = new mapboxgl.LngLatBounds();

    assignedOrders.forEach((order, index) => {
      let existingOrderState = updatedOrdersWithMarkers[index];
      if (order.deliveryCoordinates) {
        const { lng, lat } = order.deliveryCoordinates;
        const markerFillColor = order.color || (order.status === 'delivered' ? 'hsl(120, 60%, 50%)' : 'hsl(var(--primary))');

        if (existingOrderState.marker) { // Marker exists, update position and potentially color
          existingOrderState.marker.setLngLat([lng, lat]);
          const el = existingOrderState.marker.getElement();
          if (el instanceof HTMLElement) { // Check if getElement() returns an HTMLElement
            el.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${markerFillColor}" width="32px" height="32px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12-2.5-2.5-2.5z"/><circle cx="12" cy="9.5" r="2.5"/></svg>')`;
          }
        } else { // No marker, create new one
          const el = document.createElement('div');
          el.style.backgroundImage = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${markerFillColor}" width="32px" height="32px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12-2.5-2.5-2.5z"/><circle cx="12" cy="9.5" r="2.5"/></svg>')`;
          el.style.width = `32px`;
          el.style.height = `32px`;
          el.style.backgroundSize = '100%';
          el.style.cursor = 'pointer';
          el.title = `Order ${order.id}`;
          
          const newMarker = new mapboxgl.Marker(el)
            .setLngLat([lng, lat])
            .addTo(map);
          newMarker.getElement().addEventListener('click', () => setSelectedOrder(order));
          updatedOrdersWithMarkers[index] = {...existingOrderState, marker: newMarker};
        }
        bounds.extend([lng, lat]);
      } else if (existingOrderState.marker) { // No coords but marker exists, remove it
        existingOrderState.marker.remove();
        updatedOrdersWithMarkers[index] = {...existingOrderState, marker: undefined};
      }
    });
    // Only update state if markers actually changed to avoid loop if objects are new but logically same
    if (JSON.stringify(updatedOrdersWithMarkers.map(o=>({id:o.id, hasMarker: !!o.marker, color: o.color, status: o.status}))) !== JSON.stringify(assignedOrders.map(o=>({id:o.id, hasMarker: !!o.marker, color: o.color, status: o.status})))) {
       setAssignedOrders(updatedOrdersWithMarkers); 
    }


    if (focusedOrderId) {
        const orderToFocus = updatedOrdersWithMarkers.find(o => o.id === focusedOrderId);
        if (orderToFocus?.deliveryCoordinates) {
             map.flyTo({ center: [orderToFocus.deliveryCoordinates.lng, orderToFocus.deliveryCoordinates.lat], zoom: 14 });
        }
    } else if (!bounds.isEmpty() && !riderLocationMarkerRef.current) { 
         map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [assignedOrders, mapLoading, mapRef.current?.isStyleLoaded(), focusedOrderId]); 


  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes?: string) => {
    if (!db || !user) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const newHistoryEntry = {
        status: newStatus,
        timestamp: Timestamp.now(), // Use client-side timestamp for arrayUnion
        notes: notes || `Status updated to ${newStatus} by ${role}`,
        actorId: user.uid,
      };
      
      await updateDoc(orderRef, { 
        status: newStatus, 
        updatedAt: serverTimestamp(), // Top-level serverTimestamp is fine for the document
        deliveryHistory: arrayUnion(newHistoryEntry),
        ...(newStatus === 'delivered' && { actualDeliveryTime: serverTimestamp() })
      });
      toast({ title: "Success", description: `Order ${orderId} marked as ${newStatus}.` });
      // Optimistically update selectedOrder if it's the one being changed
      setSelectedOrder(prev => prev && prev.id === orderId ? {...prev, status: newStatus, deliveryHistory: [...(prev.deliveryHistory || []), {...newHistoryEntry, timestamp: new Date() }] } : prev);
      // No need to call setAssignedOrders here, onSnapshot will update it from Firestore changes
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-var(--header-height,4rem)-2rem)] p-4 gap-4"> {/* Adjusted for p-4 */}
      <div className="md:w-1/3 lg:w-1/4 space-y-4 overflow-y-auto pr-2"> {/* Added pr-2 for scrollbar */}
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
                <CardHeader className="pb-2 pt-4"> {/* Adjusted padding */}
                    <CardTitle className="text-base font-medium">Order {order.id.substring(0,8)}...</CardTitle>
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize w-fit">{order.status.replace(/_/g, ' ')}</Badge>
                </CardHeader>
                <CardContent className="text-xs pb-4"> {/* Adjusted padding */}
                    <p className="truncate">{order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}</p>
                    <p>Customer: {order.customerName || 'N/A'}</p>
                </CardContent>
            </Card>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden"> {/* Added overflow-hidden */}
        <Card className="flex-grow min-h-[250px] md:min-h-0"> 
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
          <Card className="max-h-[calc(100vh-var(--header-height,4rem)-2rem-250px-4rem-env(safe-area-inset-bottom))] md:max-h-[40vh] overflow-y-auto"> {/* Details card with scroll */}
            <CardHeader>
              <CardTitle className="font-headline">Order Details: {selectedOrder.id.substring(0,12)}...</CardTitle>
              <CardDescription>Status: <Badge variant={selectedOrder.status === 'delivered' ? 'default' : 'secondary'} className="capitalize">{selectedOrder.status.replace(/_/g, ' ')}</Badge></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="flex items-center text-sm"><UserCircle className="h-4 w-4 mr-2 text-muted-foreground" /> Customer: {selectedOrder.customerName || 'N/A'}</p>
              <p className="flex items-center text-sm"><MapPin className="h-4 w-4 mr-2 text-muted-foreground" /> Address: {selectedOrder.shippingAddress?.addressLine1}, {selectedOrder.shippingAddress?.city}</p>
              {selectedOrder.customerPhone && <p className="flex items-center text-sm"><Phone className="h-4 w-4 mr-2 text-muted-foreground" /> Phone: <a href={`tel:${selectedOrder.customerPhone}`} className="text-primary hover:underline">{selectedOrder.customerPhone}</a></p>}
              {selectedOrder.deliveryNotes && <p className="flex items-center text-sm"><Info className="h-4 w-4 mr-2 text-muted-foreground" /> Notes: {selectedOrder.deliveryNotes}</p>}
            </CardContent>
            <CardFooter className="flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
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
                <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}>
                  <Truck className="mr-2 h-4 w-4" /> Start Delivery
                </Button>
              )}
              {selectedOrder.status === 'out_for_delivery' && (
                <>
                  <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark Delivered
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedOrder.id, 'delivery_attempted')}>
                    <AlertTriangle className="mr-2 h-4 w-4" /> Attempt Failed
                  </Button>
                </>
              )}
              {selectedOrder.status === 'delivery_attempted' && (
                 <Button size="sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'out_for_delivery')}>
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
    mapboxgl?: typeof mapboxgl; 
  }
}

