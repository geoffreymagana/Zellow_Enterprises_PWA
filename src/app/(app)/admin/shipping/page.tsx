
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Filter } from 'lucide-react';
import type { ShippingRegion, ShippingMethod, ShippingRate } from '@/types';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Schemas
const regionFormSchema = z.object({
  name: z.string().min(1, "Region name is required"),
  county: z.string().min(1, "County is required"),
  towns: z.string().min(1, "Enter at least one town, comma-separated"),
  active: z.boolean(),
});
type RegionFormValues = z.infer<typeof regionFormSchema>;

const methodFormSchema = z.object({
  name: z.string().min(1, "Method name is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.string().min(1, "Duration is required (e.g., 24h, 1-2 days)"),
  basePrice: z.coerce.number().min(0, "Base price must be 0 or greater"),
  active: z.boolean(),
});
type MethodFormValues = z.infer<typeof methodFormSchema>;

const rateFormSchema = z.object({
  regionId: z.string().min(1, "Region is required"),
  methodId: z.string().min(1, "Method is required"),
  customPrice: z.coerce.number().min(0, "Custom price must be 0 or greater"),
  notes: z.string().optional(),
  active: z.boolean(),
});
type RateFormValues = z.infer<typeof rateFormSchema>;

const ALL_REGIONS_SENTINEL = "ALL_REGIONS_FILTER_VALUE";
const ALL_METHODS_SENTINEL = "ALL_METHODS_FILTER_VALUE";

export default function AdminShippingPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Regions State
  const [regions, setRegions] = useState<ShippingRegion[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [isRegionSubmitting, setIsRegionSubmitting] = useState(false);
  const [isRegionDialogOpen, setIsRegionDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<ShippingRegion | null>(null);
  const [deletingRegion, setDeletingRegion] = useState<ShippingRegion | null>(null);
  const regionForm = useForm<RegionFormValues>({
    resolver: zodResolver(regionFormSchema),
    defaultValues: { name: "", county: "", towns: "", active: true },
  });

  // Methods State
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [isMethodSubmitting, setIsMethodSubmitting] = useState(false);
  const [isMethodDialogOpen, setIsMethodDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<ShippingMethod | null>(null);
  const methodForm = useForm<MethodFormValues>({
    resolver: zodResolver(methodFormSchema),
    defaultValues: { name: "", description: "", duration: "", basePrice: 0, active: true },
  });

  // Rates State
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [isRateSubmitting, setIsRateSubmitting] = useState(false);
  const [isRateDialogOpen, setIsRateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<ShippingRate | null>(null);
  const [deletingRate, setDeletingRate] = useState<ShippingRate | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [filterMethod, setFilterMethod] = useState<string>("");
  const rateForm = useForm<RateFormValues>({
    resolver: zodResolver(rateFormSchema),
    defaultValues: { regionId: "", methodId: "", customPrice: 0, notes: "", active: true },
  });

  // Fetching data
  const fetchRegions = useCallback(async () => {
    if (!db) { toast({ title: "Error", description: "Firestore unavailable.", variant: "destructive" }); setIsLoadingRegions(false); return; }
    setIsLoadingRegions(true);
    try {
      const q = query(collection(db, 'shippingRegions'), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      setRegions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRegion)));
    } catch (e) { console.error(e); toast({ title: "Error fetching regions", variant: "destructive" }); }
    finally { setIsLoadingRegions(false); }
  }, [toast]);

  const fetchMethods = useCallback(async () => {
    if (!db) { toast({ title: "Error", description: "Firestore unavailable.", variant: "destructive" }); setIsLoadingMethods(false); return; }
    setIsLoadingMethods(true);
    try {
      const q = query(collection(db, 'shippingMethods'), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      setMethods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingMethod)));
    } catch (e) { console.error(e); toast({ title: "Error fetching methods", variant: "destructive" }); }
    finally { setIsLoadingMethods(false); }
  }, [toast]);
  
  const fetchRates = useCallback(async () => {
    if (!db) { toast({ title: "Error", description: "Firestore unavailable.", variant: "destructive" }); setIsLoadingRates(false); return; }
    setIsLoadingRates(true);
    try {
      const q = query(collection(db, 'shippingRates'), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setRates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRate)));
    } catch (e) { console.error(e); toast({ title: "Error fetching rates", variant: "destructive" }); }
    finally { setIsLoadingRates(false); }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !['Admin', 'DispatchManager'].includes(role || '')) {
        router.replace('/dashboard');
      } else {
        fetchRegions();
        fetchMethods();
        fetchRates();
      }
    }
  }, [user, role, authLoading, router, fetchRegions, fetchMethods, fetchRates]);

  // Regions CRUD
  const handleRegionDialogOpen = (region: ShippingRegion | null = null) => {
    setEditingRegion(region);
    regionForm.reset(region ? { ...region, towns: region.towns.join(', ') } : { name: "", county: "", towns: "", active: true });
    setIsRegionDialogOpen(true);
  };
  const onRegionSubmit = async (values: RegionFormValues) => {
    if (!db) return; setIsRegionSubmitting(true);
    const townsArray = values.towns.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (townsArray.length === 0) { regionForm.setError("towns", { type: "manual", message: "Please enter at least one valid town."}); setIsRegionSubmitting(false); return; }
    const dataToSave = { ...values, towns: townsArray, updatedAt: serverTimestamp() };
    try {
      if (editingRegion) {
        await updateDoc(doc(db, 'shippingRegions', editingRegion.id), dataToSave);
        toast({ title: "Region Updated" });
      } else {
        await addDoc(collection(db, 'shippingRegions'), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Region Created" });
      }
      setIsRegionDialogOpen(false); setEditingRegion(null); fetchRegions();
    } catch (e: any) { console.error(e); toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    finally { setIsRegionSubmitting(false); }
  };
  const handleRegionDeleteConfirm = async () => {
    if (!db || !deletingRegion) return; setIsRegionSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shippingRegions', deletingRegion.id));
      toast({ title: "Region Deleted" });
      setDeletingRegion(null); fetchRegions();
    } catch (e: any) { console.error(e); toast({ title: "Deletion Failed", description: e.message, variant: "destructive" }); }
    finally { setIsRegionSubmitting(false); }
  };

  // Methods CRUD
  const handleMethodDialogOpen = (method: ShippingMethod | null = null) => {
    setEditingMethod(method);
    methodForm.reset(method ? method : { name: "", description: "", duration: "", basePrice: 0, active: true });
    setIsMethodDialogOpen(true);
  };
  const onMethodSubmit = async (values: MethodFormValues) => {
    if (!db) return; setIsMethodSubmitting(true);
    const dataToSave = { ...values, updatedAt: serverTimestamp() };
    try {
      if (editingMethod) {
        await updateDoc(doc(db, 'shippingMethods', editingMethod.id), dataToSave);
        toast({ title: "Method Updated" });
      } else {
        await addDoc(collection(db, 'shippingMethods'), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Method Created" });
      }
      setIsMethodDialogOpen(false); setEditingMethod(null); fetchMethods();
    } catch (e: any) { console.error(e); toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    finally { setIsMethodSubmitting(false); }
  };
  const handleMethodDeleteConfirm = async () => {
    if (!db || !deletingMethod) return; setIsMethodSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shippingMethods', deletingMethod.id));
      toast({ title: "Method Deleted" });
      setDeletingMethod(null); fetchMethods();
    } catch (e: any) { console.error(e); toast({ title: "Deletion Failed", description: e.message, variant: "destructive" }); }
    finally { setIsMethodSubmitting(false); }
  };

  // Rates CRUD
  const handleRateDialogOpen = (rate: ShippingRate | null = null) => {
    setEditingRate(rate);
    rateForm.reset(rate ? rate : { regionId: "", methodId: "", customPrice: 0, notes: "", active: true });
    setIsRateDialogOpen(true);
  };
  const onRateSubmit = async (values: RateFormValues) => {
    if (!db) return; setIsRateSubmitting(true);
    const dataToSave = { ...values, updatedAt: serverTimestamp() };
    try {
      if (editingRate) {
        await updateDoc(doc(db, 'shippingRates', editingRate.id), dataToSave);
        toast({ title: "Rate Updated" });
      } else {
        await addDoc(collection(db, 'shippingRates'), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Rate Created" });
      }
      setIsRateDialogOpen(false); setEditingRate(null); fetchRates();
    } catch (e: any) { console.error(e); toast({ title: "Save Failed", description: e.message, variant: "destructive" }); }
    finally { setIsRateSubmitting(false); }
  };
  const handleRateDeleteConfirm = async () => {
    if (!db || !deletingRate) return; setIsRateSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shippingRates', deletingRate.id));
      toast({ title: "Rate Deleted" });
      setDeletingRate(null); fetchRates();
    } catch (e: any) { console.error(e); toast({ title: "Deletion Failed", description: e.message, variant: "destructive" }); }
    finally { setIsRateSubmitting(false); }
  };

  const getRegionName = (regionId: string) => regions.find(r => r.id === regionId)?.name || 'N/A';
  const getMethodName = (methodId: string) => methods.find(m => m.id === methodId)?.name || 'N/A';

  const filteredRates = rates.filter(rate => 
    (filterRegion ? rate.regionId === filterRegion : true) &&
    (filterMethod ? rate.methodId === filterMethod : true)
  );

  if (authLoading || (!user && !authLoading) || (role && !['Admin', 'DispatchManager'].includes(role) && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">Shipping Management</h1>
      <p className="text-muted-foreground">Configure shipping regions, methods, and their corresponding rates.</p>
      
      <Tabs defaultValue="regions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="regions">Regions</TabsTrigger>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="rates">Rates</TabsTrigger>
        </TabsList>

        {/* Regions Tab */}
        <TabsContent value="regions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Manage Shipping Regions</CardTitle>
                <Button onClick={() => handleRegionDialogOpen()}><PlusCircle className="mr-2 h-4 w-4" /> Create Region</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingRegions && regions.length === 0 ? (
                <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
              ) : regions.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">No shipping regions found.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>County</TableHead><TableHead>Towns</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {regions.map((region) => (
                      <TableRow key={region.id}>
                        <TableCell className="font-medium">{region.name}</TableCell>
                        <TableCell>{region.county}</TableCell>
                        <TableCell>{region.towns.join(', ') || '-'}</TableCell>
                        <TableCell><Badge variant={region.active ? "default" : "secondary"}>{region.active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleRegionDialogOpen(region)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={deletingRegion?.id === region.id} onOpenChange={(isOpen) => { if (!isOpen) setDeletingRegion(null);}}>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setDeletingRegion(region)}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Region?</AlertDialogTitle><AlertDialogDescription>Delete "{deletingRegion?.name}"?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingRegion(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRegionDeleteConfirm} disabled={isRegionSubmitting}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {regions.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {regions.length} regions.</p></CardFooter>}
          </Card>
        </TabsContent>

        {/* Methods Tab */}
        <TabsContent value="methods" className="space-y-4">
           <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Manage Shipping Methods</CardTitle>
                <Button onClick={() => handleMethodDialogOpen()}><PlusCircle className="mr-2 h-4 w-4" /> Create Method</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingMethods && methods.length === 0 ? (
                <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
              ) : methods.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">No shipping methods found.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Duration</TableHead><TableHead>Base Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {methods.map((method) => (
                      <TableRow key={method.id}>
                        <TableCell className="font-medium">{method.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{method.description}</TableCell>
                        <TableCell>{method.duration}</TableCell>
                        <TableCell>Ksh {method.basePrice.toFixed(2)}</TableCell>
                        <TableCell><Badge variant={method.active ? "default" : "secondary"}>{method.active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleMethodDialogOpen(method)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={deletingMethod?.id === method.id} onOpenChange={(isOpen) => { if (!isOpen) setDeletingMethod(null);}}>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setDeletingMethod(method)}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Method?</AlertDialogTitle><AlertDialogDescription>Delete "{deletingMethod?.name}"?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingMethod(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleMethodDeleteConfirm} disabled={isMethodSubmitting}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {methods.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {methods.length} methods.</p></CardFooter>}
          </Card>
        </TabsContent>

        {/* Rates Tab */}
        <TabsContent value="rates" className="space-y-4">
          <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Manage Shipping Rates</CardTitle>
                    <Button onClick={() => handleRateDialogOpen()}><PlusCircle className="mr-2 h-4 w-4" /> Create Rate</Button>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="flex flex-col md:flex-row gap-2 items-center">
                    <p className="font-medium text-sm whitespace-nowrap">Filter Rates:</p>
                    <Select value={filterRegion === "" ? ALL_REGIONS_SENTINEL : filterRegion} onValueChange={(value) => setFilterRegion(value === ALL_REGIONS_SENTINEL ? "" : value)}>
                        <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="By Region" /></SelectTrigger>
                        <SelectContent><SelectItem value={ALL_REGIONS_SENTINEL}>All Regions</SelectItem>{regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={filterMethod === "" ? ALL_METHODS_SENTINEL : filterMethod} onValueChange={(value) => setFilterMethod(value === ALL_METHODS_SENTINEL ? "" : value)}>
                        <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="By Method" /></SelectTrigger>
                        <SelectContent><SelectItem value={ALL_METHODS_SENTINEL}>All Methods</SelectItem>{methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => {setFilterRegion(""); setFilterMethod("");}} size="sm"><Filter className="mr-2 h-3 w-3"/> Clear</Button>
                </div>
            </CardContent>
            <CardContent className="p-0">
              {isLoadingRates && rates.length === 0 ? (
                <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
              ) : filteredRates.length === 0 ? (
                <p className="p-6 text-center text-muted-foreground">{rates.length === 0 ? "No shipping rates found." : "No rates match filters."}</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Region</TableHead><TableHead>Method</TableHead><TableHead>Custom Price</TableHead><TableHead>Notes</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredRates.map((rate) => (
                      <TableRow key={rate.id}>
                        <TableCell className="font-medium">{getRegionName(rate.regionId)}</TableCell>
                        <TableCell>{getMethodName(rate.methodId)}</TableCell>
                        <TableCell>Ksh {rate.customPrice.toFixed(2)}</TableCell>
                        <TableCell className="max-w-xs truncate">{rate.notes || '-'}</TableCell>
                        <TableCell><Badge variant={rate.active ? "default" : "secondary"}>{rate.active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleRateDialogOpen(rate)}><Edit className="h-4 w-4" /></Button>
                           <AlertDialog open={deletingRate?.id === rate.id} onOpenChange={(isOpen) => { if (!isOpen) setDeletingRate(null);}}>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setDeletingRate(rate)}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete Rate?</AlertDialogTitle><AlertDialogDescription>Permanently delete this shipping rate?</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingRate(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRateDeleteConfirm} disabled={isRateSubmitting}>Delete</AlertDialogAction></AlertDialogFooter>
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
        </TabsContent>
      </Tabs>

      {/* Region Dialog */}
      <Dialog open={isRegionDialogOpen} onOpenChange={(open) => { setIsRegionDialogOpen(open); if (!open) setEditingRegion(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRegion ? "Edit" : "Create"} Region</DialogTitle></DialogHeader>
          <Form {...regionForm}>
            <form onSubmit={regionForm.handleSubmit(onRegionSubmit)} className="space-y-4 py-4">
              <FormField control={regionForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Region Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={regionForm.control} name="county" render={({ field }) => (<FormItem><FormLabel>County</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={regionForm.control} name="towns" render={({ field }) => (<FormItem><FormLabel>Towns (comma-separated)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={regionForm.control} name="active" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>Active</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isRegionSubmitting}>{isRegionSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingRegion ? "Save" : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Method Dialog */}
      <Dialog open={isMethodDialogOpen} onOpenChange={(open) => { setIsMethodDialogOpen(open); if (!open) setEditingMethod(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMethod ? "Edit" : "Create"} Method</DialogTitle></DialogHeader>
          <Form {...methodForm}>
            <form onSubmit={methodForm.handleSubmit(onMethodSubmit)} className="space-y-4 py-4">
              <FormField control={methodForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Method Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={methodForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={methodForm.control} name="duration" render={({ field }) => (<FormItem><FormLabel>Duration</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={methodForm.control} name="basePrice" render={({ field }) => (<FormItem><FormLabel>Base Price (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={methodForm.control} name="active" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>Active</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isMethodSubmitting}>{isMethodSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingMethod ? "Save" : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Rate Dialog */}
      <Dialog open={isRateDialogOpen} onOpenChange={(open) => { setIsRateDialogOpen(open); if (!open) setEditingRate(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRate ? "Edit" : "Create"} Rate</DialogTitle></DialogHeader>
          <Form {...rateForm}>
            <form onSubmit={rateForm.handleSubmit(onRateSubmit)} className="space-y-4 py-4">
              <FormField control={rateForm.control} name="regionId" render={({ field }) => (<FormItem><FormLabel>Region</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger></FormControl><SelectContent>{regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={rateForm.control} name="methodId" render={({ field }) => (<FormItem><FormLabel>Method</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl><SelectContent>{methods.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={rateForm.control} name="customPrice" render={({ field }) => (<FormItem><FormLabel>Custom Price (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={rateForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={rateForm.control} name="active" render={({ field }) => (<FormItem className="flex items-center justify-between rounded-lg border p-3"><FormLabel>Active</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={isRateSubmitting}>{isRateSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingRate ? "Save" : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
