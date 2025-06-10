
"use client";

import { BottomNav } from "@/components/navigation/BottomNav";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true); // Assume online initially

  useEffect(() => {
    // Set initial online state
    setIsOnline(navigator.onLine);

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
    // Check if online, if so, navigate to home or last page
    if (navigator.onLine) {
      router.replace(localStorage.getItem('lastVisitedPage') || '/dashboard');
    } else {
      // Maybe show a toast or alert that connection is still off
      alert("Still offline. Please check your internet connection.");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-amber-500">
      <main className="flex-grow flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 sm:p-10 md:p-12 rounded-xl shadow-2xl w-full max-w-md">
          <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 mb-6">
            {/* Concentric rings effect */}
            <div className="absolute inset-0 rounded-full bg-amber-100 opacity-50 animate-ping-slow"></div>
            <div className="absolute inset-2 rounded-full bg-amber-200 opacity-60 animate-ping-medium"></div>
            <div className="absolute inset-4 rounded-full bg-amber-300 opacity-70 flex items-center justify-center">
              <WifiOff className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-amber-600" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-amber-700 mb-2">
            No Internet!
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mb-8">
            Please check your internet connection and try again.
          </p>
          <Button
            onClick={handleRetryConnection}
            size="lg"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            disabled={isOnline}
          >
            <RefreshCw className="mr-2 h-5 w-5" /> Retry Connection
          </Button>
          {isOnline && (
             <p className="text-xs text-green-600 mt-3">You appear to be back online! Retrying might work.</p>
          )}
        </div>
      </main>
      <div className="sticky bottom-0 w-full">
         {/* Render BottomNav only if it's appropriate for an offline page (e.g., doesn't rely on network for its links) */}
         {/* Assuming BottomNav is designed to be somewhat functional or at least displayable offline */}
        <BottomNav />
      </div>
      <style jsx global>{`
        @keyframes ping-slow {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
        @keyframes ping-medium {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 0.4; }
        }
        .animate-ping-slow { animation: ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite; }
        .animate-ping-medium { animation: ping-medium 2.5s cubic-bezier(0, 0, 0.2, 1) infinite; }
      `}</style>
    </div>
  );
}
