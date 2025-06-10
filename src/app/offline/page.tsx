
"use client";

import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
// import Image from 'next/image'; // Uncomment if using your custom SVG

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true); // Assume online initially

  useEffect(() => {
    // Set initial online state
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      // Optionally, try to redirect or refresh
      // router.replace(localStorage.getItem('lastVisitedPage') || '/');
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const handleRetryConnection = () => {
    if (typeof navigator !== "undefined" && navigator.onLine) {
      router.replace(localStorage.getItem('lastVisitedPage') || '/dashboard');
    } else {
      // Maybe show a toast or alert that connection is still off
      alert("Still offline. Please check your internet connection.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <main className="flex-grow flex flex-col items-center justify-center text-center p-8">
        {/* 
          To use your custom SVG (offline-cell-tower.svg), 
          1. Place the SVG file in your /public directory.
          2. Uncomment the Image import at the top of this file.
          3. Replace the WifiOff component below with:
            <Image
              src="/offline-cell-tower.svg"
              alt="Offline Illustration"
              width={300} 
              height={150} 
              className="max-w-[300px] mx-auto my-4"
              data-ai-hint="offline illustration"
            />
        */}
        <WifiOff className="w-24 h-24 text-primary mb-6" />
        
        <h1 className="text-3xl font-bold font-headline mb-4">You’re Offline</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          Looks like you lost your connection. Don’t worry—your data is safe. Try again when you’re back online!
        </p>
        <Button onClick={handleRetryConnection} size="lg" className="bg-primary hover:bg-primary/90">
          <RefreshCw className="mr-2 h-5 w-5" /> Retry Connection
        </Button>
      </main>
      <div className="sticky bottom-0 w-full">
        <BottomNav />
      </div>
    </div>
  );
}
