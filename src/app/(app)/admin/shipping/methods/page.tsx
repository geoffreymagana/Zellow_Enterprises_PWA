
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { ShippingMethod } from '@/types';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const methodFormSchema = z.object({
  name: z.string().min(1, "Method name is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.string().min(1, "Duration is required (e.g., 24h, 1-2 days)"),
  basePrice: z.coerce.number().min(0, "Base price must be 0 or greater"),
  active: z.boolean(),
});

type MethodFormValues = z.infer<typeof methodFormSchema>;

export default function AdminShippingMethodsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<ShippingMethod | null>(null);
  const [deletingMethod, setDeletingMethod] = useState<ShippingMethod | null>(null);

  const form = useForm<MethodFormValues>({
    resolver: zodResolver(methodFormSchema),
    defaultValues: {
      name: "",
      description: "",
      duration: "",
      basePrice: 0,
      active: true,
    },
  });

  const fetchMethods = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const methodsCollection = collection(db, 'shippingMethods');
      const q = query(methodsCollection, orderBy("name", "asc"));
      const methodsSnapshot = await getDocs(q);
      const methodsList = methodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingMethod));
      setMethods(methodsList);
    } catch (error) {
      console.error("Failed to fetch methods:", error);
      toast({ title: "Error", description: "Failed to fetch shipping methods.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchMethods();
      }
    }
  }, [user, role, authLoading, router, fetchMethods]);
  
  const handleDialogOpen = (method: ShippingMethod | null = null) => {
    setEditingMethod(method);
    if (method) {
      form.reset({
        name: method.name,
        description: method.description,
        duration: method.duration,
        basePrice: method.basePrice,
        active: method.active,
      });
    } else {
      form.reset({ name: "", description: "", duration: "", basePrice: 0, active: true });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: MethodFormValues) => {
    if (!db) return;
    setIsSubmitting(true);
    const dataToSave = { ...values, updatedAt: serverTimestamp() };

    try {
      if (editingMethod) {
        const methodDocRef = doc(db, 'shippingMethods', editingMethod.id);
        await updateDoc(methodDocRef, dataToSave);
        toast({ title: "Method Updated", description: `${values.name} has been updated.` });
      } else {
        await addDoc(collection(db, 'shippingMethods'), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Method Created", description: `${values.name} has been created.` });
      }
      setIsDialogOpen(false);
      setEditingMethod(null);
      fetchMethods();
    } catch (error: any) {
      console.error("Failed to save method:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save method.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteConfirm = async () => {
    if (!db || !deletingMethod) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shippingMethods', deletingMethod.id));
      toast({ title: "Method Deleted", description: `${deletingMethod.name} has been deleted.` });
      setDeletingMethod(null);
      fetchMethods();
    } catch (error: any) {
      console.error("Failed to delete method:", error);
      toast({ title: "Deletion Failed", description: error.message || "Could not delete method.", variant: "destructive" });
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
        <h1 className="text-3xl font-headline font-semibold">Shipping Methods</h1>
        <Button onClick={() => handleDialogOpen()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Method
        </Button>
      </div>
      <p className="text-muted-foreground">Define different shipping options, their costs, and delivery times.</p>

      <Card>
        <CardContent className="p-0">
          {isLoading && methods.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : methods.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No shipping methods found. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Base Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell className="font-medium">{method.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{method.description}</TableCell>
                    <TableCell>{method.duration}</TableCell>
                    <TableCell>${method.basePrice.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={method.active ? "default" : "secondary"}>
                        {method.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                       <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(method)} aria-label="Edit Method">
                        <Edit className="h-4 w-4" />
                      </Button>
                       <AlertDialog
                        open={deletingMethod?.id === method.id}
                        onOpenChange={(isOpen) => {
                          if (!isOpen && deletingMethod?.id === method.id) {
                            setDeletingMethod(null);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setDeletingMethod(method)} aria-label="Delete Method">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will permanently delete the method "{deletingMethod?.name}". This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDeletingMethod(null)}>Cancel</AlertDialogCancel>
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
        {methods.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {methods.length} methods.</p></CardFooter>}
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingMethod(null);
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingMethod ? "Edit" : "Create"} Shipping Method</DialogTitle>
            <DialogDescription>
              {editingMethod ? "Update details for this shipping method." : "Add a new shipping method."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Standard Delivery" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Detailed description of the method" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <FormControl><Input placeholder="e.g., 3-5 business days, 24h" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="basePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Price ($)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g., 5.00" {...field} /></FormControl>
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
                      <DialogDescription className="text-xs">Is this shipping method currently available?</DialogDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingMethod ? "Save Changes" : "Create Method"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
