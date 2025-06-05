
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Filter } from 'lucide-react';
import type { ShippingRate, ShippingRegion, ShippingMethod } from '@/types';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const rateFormSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  methodId: z.string().min(1, "Method is required"),
  customPrice: z.coerce.number().min(0, "Custom price must be 0 or greater"),
  notes: z.string().optional(),
  active: z.boolean(),
});

type RateFormValues = z.infer<typeof rateFormSchema>;

export default function AdminShippingRatesPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [regions, setRegions] = useState<ShippingRegion[]>([]);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [deletingRate, setDeletingRate] = useState<ShippingRate | null>(null);

  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterMethod, setFilterMethod] = useState<string>("");

  const form = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: {
      regionId: "",
      methodId: "",
      customPrice: 0,
      notes: "",
      active: true,
    },
  });

  const fetchData = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [regionsSnapshot, methodsSnapshot, ratesSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'shippingRegions'), orderBy("name", "asc"))),
        getDocs(query(collection(db, 'shippingMethods'), orderBy("name", "asc"))),
        getDocs(query(collection(db, 'shippingRates'), orderBy("createdAt", "desc"))) // Or other relevant order
      ]);

      setRegions(regionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRegion)));
      setMethods(methodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingMethod)));
      setRates(ratesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRate)));

    } catch (error) {
      console.error("Failed to fetch shipping data:", error);
      toast({ title: "Error", description: "Failed to fetch shipping data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchData();
      }
    }
  }, [user, role, authLoading, router, fetchData]);

  const handleDialogOpen = (rate: ShippingRate | null = null) => {
    setEditingRate(rate);
    if (rate) {
      form.reset({
        regionId: rate.regionId,
        methodId: rate.methodId,
        customPrice: rate.customPrice,
        notes: rate.notes || "",
        active: rate.active,
      });
    } else {
      form.reset({ regionId: "", methodId: "", customPrice: 0, notes: "", active: true });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: RateFormValues) => {
    if (!db) return;
    setIsSubmitting(true);
    const dataToSave = { ...values, updatedAt: serverTimestamp() };

    try {
      if (editingRate) {
        const rateDocRef = doc(db, 'shippingRates', editingRate.id);
        await updateDoc(rateDocRef, dataToSave);
        toast({ title: "Rate Updated", description: "Shipping rate has been updated." });
      } else {
        await addDoc(collection(db, 'shippingRates'), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Rate Created", description: "New shipping rate has been created." });
      }
      setIsDialogOpen(false);
      setEditingRate(null);
      fetchData(); // Re-fetch all data
    } catch (error: any) {
      console.error("Failed to save rate:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save rate.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!db || !deletingRate) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shippingRates', deletingRate.id));
      toast({ title: "Rate Deleted", description: `Shipping rate has been deleted.` });
      setDeletingRate(null);
      fetchData(); // Re-fetch all data
    } catch (error: any) {
      console.error("Failed to delete rate:", error);
      toast({ title: "Deletion Failed", description: error.message || "Could not delete rate.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getRegionName = (regionId: string) => regions.find(r => r.id === regionId)?.name || 'N/A';
  const getMethodName = (methodId: string) => methods.find(m => m.id === methodId)?.name || 'N/A';

  const filteredRates = rates.filter(rate => 
    (filterRegion ? rate.regionId === filterRegion : true) &&
    (filterMethod ? rate.methodId === filterMethod : true)
  );

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
   if (role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-screen">Unauthorized access.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Shipping Rates</h1>
        <Button onClick={() => handleDialogOpen()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Rate
        </Button>
      </div>
      <p className="text-muted-foreground">Set specific shipping prices for region-method combinations.</p>

      <Card>
        <CardContent className="p-4 space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
            <p className="font-medium text-sm">Filter Rates:</p>
            <div className="flex flex-col md:flex-row gap-2">
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Filter by Region" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">All Regions</SelectItem>
                        {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={filterMethod} onValueChange={setFilterMethod}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Filter by Method" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">All Methods</SelectItem>
                        {methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                 <Button variant="outline" onClick={() => {setFilterRegion(""); setFilterMethod("");}} size="sm">
                    <Filter className="mr-2 h-3 w-3"/> Clear Filters
                </Button>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading && rates.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredRates.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              {rates.length === 0 ? "No shipping rates found. Create one to get started." : "No rates match your filters."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Custom Price</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{getRegionName(rate.regionId)}</TableCell>
                    <TableCell>{getMethodName(rate.methodId)}</TableCell>
                    <TableCell>${rate.customPrice.toFixed(2)}</TableCell>
                    <TableCell className="max-w-xs truncate">{rate.notes || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={rate.active ? "default" : "secondary"}>
                        {rate.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(rate)} aria-label="Edit Rate">
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog
                        open={deletingRate?.id === rate.id}
                        onOpenChange={(isOpen) => {
                          if (!isOpen && deletingRate?.id === rate.id) {
                            setDeletingRate(null);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingRate(rate)} aria-label="Delete Rate">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete this shipping rate. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingRate(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredRates.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredRates.length} rates.</p></CardFooter>}
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRate(null);
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Edit" : "Create"} Shipping Rate</DialogTitle>
            <DialogDescription>
              {editingRate ? "Update details for this shipping rate." : "Add a new shipping rate."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="regionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Region</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a region" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="methodId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipping Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Price ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="Overrides method base price" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any specific notes for this rate" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <DialogDescription className="text-xs">Is this shipping rate currently available?</DialogDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingRate ? "Save Changes" : "Create Rate"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
