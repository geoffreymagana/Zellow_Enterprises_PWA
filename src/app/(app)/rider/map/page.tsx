
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// IMPORTANT: Move this to a .env.local file as NEXT_PUBLIC_MAPBOX_TOKEN
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoib2RpbnN3b3JkIiwiYSI6ImNtYmphdTZoaTBldG8ybHFuZDdiZjN3bTMifQ.LdbfK1YplSmP0-tc46cblA';

export default function RiderMapPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Rider') {
        // Also allow Admin to view this page for testing/oversight
        if (role !== 'Admin') {
            router.replace('/dashboard');
            return;
        }
      }
    }
  }, [user, role, authLoading, router]);

  useEffect(() => {
    if (authLoading || (role !== 'Rider' && role !== 'Admin')) return; // Don't initialize map if not authorized or still loading auth

    if (!MAPBOX_ACCESS_TOKEN) {
      setMapError("Mapbox access token is not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN.");
      setMapLoading(false);
      return;
    }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    if (mapRef.current || !mapContainerRef.current) return; // Initialize map only once and if container exists

    try {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12', // Standard street map
        center: [36.8219, -1.2921], // Default to Nairobi
        zoom: 10,
      });

      mapRef.current.on('load', () => {
        setMapLoading(false);
        // TODO: Fetch rider-specific routes and display them
        // Example: Add a marker for the rider's current location (if available)
        // new mapboxgl.Marker().setLngLat([36.8219, -1.2921]).addTo(mapRef.current!);
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
    };
  }, [authLoading, role]);

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (role !== 'Rider' && role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Access Denied. This page is for Riders.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">My Delivery Route</h1>
      <p className="text-muted-foreground">
        View your assigned deliveries and navigate your route. {role === 'Admin' && '(Admin View)'}
      </p>

      <Card className="h-[60vh] md:h-[70vh]">
        <CardContent className="p-0 h-full relative">
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center z-10 p-4">
              <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Map Error</AlertTitle>
                <AlertDescription>{mapError}</AlertDescription>
              </Alert>
            </div>
          )}
          {mapLoading && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="ml-2">Loading map...</p>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full rounded-md" />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Delivery Details</CardTitle></CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Delivery information will appear here when a stop is selected on the map.</p>
            {/* Placeholder for delivery details */}
        </CardContent>
      </Card>
    </div>
  );
}
