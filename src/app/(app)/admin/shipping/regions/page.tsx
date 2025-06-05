
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, AlertTriangle } from 'lucide-react';
import type { ShippingRegion } from '@/types';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { collection, getDocs, doc, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const regionFormSchema = z.object({
  name: z.string().min(1, "Region name is required"),
  county: z.string().min(1, "County is required"),
  towns: z.string().min(1, "Enter at least one town, comma-separated"), // Will be split into array
  active: z.boolean(),
});

type RegionFormValues = z.infer<typeof regionFormSchema>;

export default function AdminShippingRegionsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [regions, setRegions] = useState<ShippingRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<ShippingRegion | null>(null);
  const [deletingRegion, setDeletingRegion] = useState<ShippingRegion | null>(null);

  const form = useForm<RegionFormValues>({
    resolver: zodResolver(regionFormSchema),
    defaultValues: {
      name: "",
      county: "",
      towns: "",
      active: true,
    },
  });

  const fetchRegions = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const regionsCollection = collection(db, 'shippingRegions');
      const q = query(regionsCollection, orderBy("name", "asc"));
      const regionsSnapshot = await getDocs(q);
      const regionsList = regionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRegion));
      setRegions(regionsList);
    } catch (error) {
      console.error("Failed to fetch regions:", error);
      toast({ title: "Error", description: "Failed to fetch shipping regions.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchRegions();
      }
    }
  }, [user, role, authLoading, router, fetchRegions]);

  const handleDialogOpen = (region: ShippingRegion | null = null) => {
    setEditingRegion(region);
    if (region) {
      form.reset({
        name: region.name,
        county: region.county,
        towns: region.towns.join(', '),
        active: region.active,
      });
    } else {
      form.reset({ name: "", county: "", towns: "", active: true });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: RegionFormValues) => {
    if (!db) return;
    setIsSubmitting(true);
    const townsArray = values.towns.split(',').map(t => t.trim()).filter(t => t.length > 0);
    if (townsArray.length === 0) {
      form.setError("towns", { type: "manual", message: "Please enter at least one valid town."});
      setIsSubmitting(false);
      return;
    }

    const dataToSave = {
      ...values,
      towns: townsArray,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingRegion) {
        const regionDocRef = doc(db, 'shippingRegions', editingRegion.id);
        await updateDoc(regionDocRef, dataToSave);
        toast({ title: "Region Updated", description: `${values.name} has been updated.` });
      } else {
        await addDoc(collection(db, 'shippingRegions'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Region Created", description: `${values.name} has been created.` });
      }
      setIsDialogOpen(false);
      setEditingRegion(null);
      fetchRegions();
    } catch (error: any) {
      console.error("Failed to save region:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save region.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!db || !deletingRegion) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shippingRegions', deletingRegion.id));
      toast({ title: "Region Deleted", description: `${deletingRegion.name} has been deleted.` });
      setDeletingRegion(null);
      fetchRegions();
    } catch (error: any) {
      console.error("Failed to delete region:", error);
      toast({ title: "Deletion Failed", description: error.message || "Could not delete region.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
   if (role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-screen">Unauthorized access.</div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Shipping Regions</h1>
        <Button onClick={() => handleDialogOpen()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Region
        </Button>
      </div>
      <p className="text-muted-foreground">Manage countries, counties, and towns where you offer shipping.</p>

      <Card>
        <CardContent className="p-0">
          {isLoading && regions.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : regions.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No shipping regions found. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead>Towns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regions.map((region) => (
                  <TableRow key={region.id}>
                    <TableCell className="font-medium">{region.name}</TableCell>
                    <TableCell>{region.county}</TableCell>
                    <TableCell>{region.towns.join(', ') || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={region.active ? "default" : "secondary"}>
                        {region.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(region)} aria-label="Edit Region">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog
                        open={deletingRegion?.id === region.id}
                        onOpenChange={(isOpen) => {
                          if (!isOpen && deletingRegion?.id === region.id) {
                            setDeletingRegion(null);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingRegion(region)} aria-label="Delete Region">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete the region "{deletingRegion?.name}". This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingRegion(null)}>Cancel</AlertDialogCancel>
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
        {regions.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {regions.length} regions.</p></CardFooter>}
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRegion(null);
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingRegion ? "Edit" : "Create"} Shipping Region</DialogTitle>
            <DialogDescription>
              {editingRegion ? "Update the details of this shipping region." : "Add a new shipping region to your system."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Nairobi Metro" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="county"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>County</FormLabel>
                    <FormControl><Input placeholder="e.g., Nairobi County" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="towns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Towns/Sub-regions (comma-separated)</FormLabel>
                    <FormControl><Input placeholder="e.g., Westlands, Karen, CBD" {...field} /></FormControl>
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
                      <DialogDescription className="text-xs">Is this shipping region currently available?</DialogDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingRegion ? "Save Changes" : "Create Region"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
