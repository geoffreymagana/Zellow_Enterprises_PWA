
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { FileWarning, PackagePlus } from 'lucide-react';
import type { Order } from '@/types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

export function BulkOrdersList() {
    const { user, role } = useAuth();
    const { toast } = useToast();
    const [bulkOrders, setBulkOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchBulkOrders = useCallback(() => {
        if (!db) {
            setIsLoading(false);
            return () => {};
        }
        setIsLoading(true);
        const q = query(collection(db, 'orders'), where("isBulkOrder", "==", true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBulkOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching bulk orders:", error);
            toast({ title: "Error", description: "Could not load bulk orders.", variant: "destructive" });
            setIsLoading(false);
        });
        return unsubscribe;
    }, [toast]);

    useEffect(() => {
        const unsubscribe = fetchBulkOrders();
        return () => unsubscribe();
    }, [fetchBulkOrders]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2"><PackagePlus /> Bulk Order Services</CardTitle>
                <CardDescription>
                    Manage large or corporate orders, from request and payment approval to fulfillment.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 text-center text-muted-foreground">
                {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> : (
                    <>
                        <FileWarning className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50"/>
                        <p className="font-semibold">No Pending Requests</p>
                        <p className="text-sm">The full feature for managing bulk orders is under construction.</p>
                    </>
                )}
            </CardContent>
            {/* You can add a footer with a count if needed later */}
            {/* {bulkOrders.length > 0 && <CardFooter>{...}</CardFooter>} */}
        </Card>
    );
}

