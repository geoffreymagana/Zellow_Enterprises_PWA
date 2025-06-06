
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
  const [riderLngLat, setRiderLngLat] = useState<[number, number] | null>(null);
  const routeLayerId = 'route-layer';
  const routeSourceId = 'route-source';


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
      orders.sort((a,b) => (a.createdAt?.toDate?.()?.getTime() || 0) - (b.createdAt?.toDate?.()?.getTime() || 0));
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
        style: 'mapbox://styles/mapbox/streets-v12', // Standard street style
        center: [36.8219, -1.2921], // Default to Nairobi
        zoom: 10,
      });

      mapRef.current.on('load', () => {
        setMapLoading(false);
        mapRef.current?.addControl(new mapboxgl.NavigationControl());
        
        if (navigator.geolocation) {
          navigator.geolocation.watchPosition(
            (position) => {
              const { longitude, latitude } = position.coords;
              setRiderLngLat([longitude, latitude]); // Update rider location state
              if (mapRef.current) {
                if (!riderLocationMarkerRef.current) {
                  const el = document.createElement('div');
                  el.style.width = '24px'; // Slightly larger for rider
                  el.style.height = '24px';
                  el.style.borderRadius = '50%';
                  el.style.backgroundColor = 'hsl(var(--accent))'; // Rider color (e.g., blue)
                  el.style.border = '2px solid hsl(var(--card))';
                  el.style.boxShadow = '0 0 5px hsl(var(--accent))';
                  riderLocationMarkerRef.current = new mapboxgl.Marker({ element: el }) 
                    .setLngLat([longitude, latitude])
                    .addTo(mapRef.current);
                } else {
                  riderLocationMarkerRef.current.setLngLat([longitude, latitude]);
                }
                // Center map on rider if it's the first location update or no specific order is focused
                if (!focusedOrderId && mapRef.current.getZoom() < 12) { 
                    mapRef.current.flyTo({ center: [longitude, latitude], zoom: 13 });
                }
              }
            },
            (geoError) => {
              console.warn("Could not get rider location:", geoError.message);
              if(!mapRef.current?.getSource(routeSourceId)){ // Only toast if not already showing a route/focused
                toast({ title: "Location Info", description: "Could not get your current location. Map will default to city center. Routing will activate when location is found.", variant: "default" });
              }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          toast({ title: "Location Info", description: "Geolocation is not supported by your browser.", variant: "default" });
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
  }, [authLoading, role, toast, focusedOrderId]);


  const clearRoute = useCallback(() => {
    if (mapRef.current) {
      if (mapRef.current.getLayer(routeLayerId)) {
        mapRef.current.removeLayer(routeLayerId);
      }
      if (mapRef.current.getSource(routeSourceId)) {
        mapRef.current.removeSource(routeSourceId);
      }
    }
  }, []);

  const fetchAndDisplayRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!mapRef.current || !MAPBOX_ACCESS_TOKEN) return;
    clearRoute(); // Clear previous route

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}&overview=full`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const routeGeoJSON = data.routes[0].geometry;
        if (mapRef.current.getSource(routeSourceId)) {
          (mapRef.current.getSource(routeSourceId) as mapboxgl.GeoJSONSource).setData(routeGeoJSON);
        } else {
          mapRef.current.addSource(routeSourceId, { type: 'geojson', data: routeGeoJSON });
        }
        if (!mapRef.current.getLayer(routeLayerId)) {
          mapRef.current.addLayer({
            id: routeLayerId,
            type: 'line',
            source: routeSourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': 'hsl(var(--primary))', 'line-width': 5, 'line-opacity': 0.8 }
          });
        }
        // Fit map to route bounds
        const coordinates = routeGeoJSON.coordinates;
        const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
        for (const coord of coordinates) {
          bounds.extend(coord);
        }
        mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 16 }); // Increased padding
      } else {
        console.error("No route found by Mapbox Directions API", data);
        toast({ title: "Routing Error", description: data.message || "Could not calculate route to destination.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      toast({ title: "Routing Error", description: "Failed to fetch route data.", variant: "destructive" });
    }
  }, [clearRoute, toast]);

   // Effect to fetch route when rider location or selected order changes
   useEffect(() => {
    if (riderLngLat && selectedOrder?.deliveryCoordinates) {
      fetchAndDisplayRoute(riderLngLat, [selectedOrder.deliveryCoordinates.lng, selectedOrder.deliveryCoordinates.lat]);
    } else {
      clearRoute(); // Clear route if no order selected or rider location unknown
    }
  }, [riderLngLat, selectedOrder, fetchAndDisplayRoute, clearRoute]);


  // Update map markers when orders change
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || mapLoading) return;

    const map = mapRef.current;
    
    const currentOrderIdsOnMap = new Set(assignedOrders.map(o => o.id));
    const ordersWithMarkers = assignedOrders.filter(o => o.marker);

    ordersWithMarkers.forEach(order => {
        if (!currentOrderIdsOnMap.has(order.id) && order.marker) {
            order.marker.remove();
        }
    });
    
    const updatedOrdersWithMarkers: DisplayOrder[] = assignedOrders.map(order => {
        let currentMarker = order.marker;
        if (order.deliveryCoordinates) {
            const { lng, lat } = order.deliveryCoordinates;
            const markerFillColor = order.color || (order.status === 'delivered' ? 'hsl(120, 60%, 50%)' : 'hsl(var(--primary))'); // Use primary for active non-colored
            
            const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${markerFillColor}" width="32px" height="32px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12-2.5-2.5-2.5z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;

            if (currentMarker) { 
                currentMarker.setLngLat([lng, lat]);
                const el = currentMarker.getElement();
                if (el instanceof HTMLElement) { 
                    el.style.backgroundImage = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgIcon)}')`;
                }
            } else { 
                const el = document.createElement('div');
                el.style.backgroundImage = `url('data:image/svg+xml;utf8,${encodeURIComponent(svgIcon)}')`;
                el.style.width = `32px`;
                el.style.height = `32px`;
                el.style.backgroundSize = '100%';
                el.style.cursor = 'pointer';
                el.title = `Order ${order.id}`;
                
                currentMarker = new mapboxgl.Marker(el)
                    .setLngLat([lng, lat])
                    .addTo(map);
                currentMarker.getElement().addEventListener('click', () => setSelectedOrder(order));
            }
        } else if (currentMarker) { // No coords but marker exists, remove it
            currentMarker.remove();
            currentMarker = undefined;
        }
        return {...order, marker: currentMarker};
    });
    
    setAssignedOrders(updatedOrdersWithMarkers); 

    if (focusedOrderId && !riderLngLat) { // If focusing on an order and rider location not yet known
        const orderToFocus = updatedOrdersWithMarkers.find(o => o.id === focusedOrderId);
        if (orderToFocus?.deliveryCoordinates) {
             map.flyTo({ center: [orderToFocus.deliveryCoordinates.lng, orderToFocus.deliveryCoordinates.lat], zoom: 14 });
        }
    } else if (!riderLngLat && !focusedOrderId && assignedOrders.length > 0) { // If no rider location, no focus, but orders exist
        const bounds = new mapboxgl.LngLatBounds();
        updatedOrdersWithMarkers.forEach(o => {
            if (o.deliveryCoordinates) bounds.extend([o.deliveryCoordinates.lng, o.deliveryCoordinates.lat]);
        });
        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [assignedOrders, mapLoading, mapRef.current?.isStyleLoaded(), focusedOrderId]); 


  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus, notes?: string) => {
    if (!db || !user) return;
    try {
      const orderRef = doc(db, 'orders', orderId);
      const newHistoryEntry = {
        status: newStatus,
        timestamp: Timestamp.now(),
        notes: notes || `Status updated to ${newStatus} by ${role}`,
        actorId: user.uid,
      };
      
      await updateDoc(orderRef, { 
        status: newStatus, 
        updatedAt: serverTimestamp(),
        deliveryHistory: arrayUnion(newHistoryEntry),
        ...(newStatus === 'delivered' && { actualDeliveryTime: serverTimestamp() })
      });
      toast({ title: "Success", description: `Order ${orderId} marked as ${newStatus}.` });
      setSelectedOrder(prev => prev && prev.id === orderId ? {...prev, status: newStatus, deliveryHistory: [...(prev.deliveryHistory || []), {...newHistoryEntry, timestamp: new Date() }] } : prev);
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
    <div className="flex flex-col md:flex-row h-[calc(100vh-var(--header-height,4rem)-2rem)] p-4 gap-4">
      <div className="md:w-1/3 lg:w-1/4 space-y-4 overflow-y-auto pr-2">
        <h1 className="text-2xl font-headline font-semibold">My Route</h1>
        {assignedOrders.length === 0 && !mapLoading && (
            <Card><CardContent className="pt-6 text-muted-foreground">No active deliveries assigned.</CardContent></Card>
        )}
        {assignedOrders.map(order => (
            <Card 
                key={order.id} 
                onClick={() => {
                    setSelectedOrder(order);
                    // Route fetching will be handled by useEffect watching selectedOrder
                    if (order.deliveryCoordinates && mapRef.current && !riderLngLat) { // If no rider location, fly to order
                        mapRef.current.flyTo({ center: [order.deliveryCoordinates.lng, order.deliveryCoordinates.lat], zoom: 15 });
                    }
                }}
                className={`cursor-pointer hover:shadow-lg ${selectedOrder?.id === order.id ? 'border-primary ring-2 ring-primary' : ''}`}
            >
                <CardHeader className="pb-2 pt-4">
                    <CardTitle className="text-base font-medium">Order {order.id.substring(0,8)}...</CardTitle>
                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize w-fit">{order.status.replace(/_/g, ' ')}</Badge>
                </CardHeader>
                <CardContent className="text-xs pb-4">
                    <p className="truncate">{order.shippingAddress?.addressLine1}, {order.shippingAddress?.city}</p>
                    <p>Customer: {order.customerName || 'N/A'}</p>
                </CardContent>
            </Card>
        ))}
      </div>

      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
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
          <Card className="max-h-[calc(100vh-var(--header-height,4rem)-2rem-250px-4rem-env(safe-area-inset-bottom))] md:max-h-[40vh] overflow-y-auto">
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
                disabled={!selectedOrder.deliveryCoordinates}
                onClick={() => {
                  if (selectedOrder.deliveryCoordinates) { 
                    const { lng, lat } = selectedOrder.deliveryCoordinates;
                    // Use riderLngLat if available, otherwise just destination for Google Maps
                    const origin = riderLngLat ? `${riderLngLat[1]},${riderLngLat[0]}` : '';
                    const mapsUrl = origin 
                        ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${lat},${lng}`
                        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    window.open(mapsUrl, '_blank');
                  } else {
                    toast({title: "Error", description: "No coordinates for navigation.", variant: "destructive"});
                  }
                }}
                title={!selectedOrder.deliveryCoordinates ? "Delivery coordinates not available" : "Open in Google Maps"}
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
