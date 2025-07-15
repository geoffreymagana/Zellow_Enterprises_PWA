
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addDays, format } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Product, BulkOrderRequest } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, PackagePlus, PlusCircle, Trash2, Send, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const bulkOrderItemSchema = z.object({
  productId: z.string().min(1, "Please select a product."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  notes: z.string().optional(),
});

const bulkOrderRequestSchema = z.object({
  companyName: z.string().optional(),
  requesterName: z.string().min(2, "Contact name is required."),
  requesterEmail: z.string().email("Invalid email address."),
  requesterPhone: z.string().min(10, "A valid phone number is required."),
  desiredDeliveryDate: z.date({ required_error: "Please select a delivery date."}),
  items: z.array(bulkOrderItemSchema).min(1, "Please add at least one item to the request."),
});

type BulkOrderRequestFormValues = z.infer<typeof bulkOrderRequestSchema>;

export default function BulkOrderRequestPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BulkOrderRequestFormValues>({
    resolver: zodResolver(bulkOrderRequestSchema),
    defaultValues: {
      requesterName: user?.displayName || "",
      requesterEmail: user?.email || "",
      requesterPhone: "",
      companyName: "",
      desiredDeliveryDate: addDays(new Date(), 14),
      items: [{ productId: "", quantity: 1, notes: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  useEffect(() => {
    if (user) {
        form.setValue('requesterName', user.displayName || '');
        form.setValue('requesterEmail', user.email || '');
    }
  }, [user, form]);

  const fetchProducts = useCallback(async () => {
    if (!db) return;
    setIsLoadingProducts(true);
    try {
      const q = query(collection(db, 'products'), where("published", "==", true), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    } catch (e: any) {
      toast({ title: "Error", description: "Could not load product list.", variant: "destructive" });
    } finally {
      setIsLoadingProducts(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);
  
  const onSubmit = async (values: BulkOrderRequestFormValues) => {
    if (!db || !user) return;
    setIsSubmitting(true);
    
    const requestData: Omit<BulkOrderRequest, 'id' | 'createdAt' | 'updatedAt'> = {
        ...values,
        requesterId: user.uid,
        status: 'pending_review',
        items: values.items.map(item => {
            const product = products.find(p => p.id === item.productId);
            return { ...item, name: product?.name || 'Unknown Product' };
        })
    };
    
    try {
        await addDoc(collection(db, 'bulkOrderRequests'), {
            ...requestData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Request Submitted", description: "Your bulk order request has been sent for review." });
        router.push('/dashboard');
    } catch (e: any) {
        toast({ title: "Submission Failed", description: "There was an error submitting your request.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center gap-2">
            <PackagePlus /> Request a Bulk Order
          </CardTitle>
          <CardDescription>
            Planning a large order for a corporate event, party, or special occasion? Fill out the form below and our team will get back to you with a confirmation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="requesterName" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="requesterEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="requesterPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={form.control} name="desiredDeliveryDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Desired Delivery Date</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl>
                            <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} initialFocus/>
                        </PopoverContent></Popover><FormMessage/>
                    </FormItem>
                 )}/>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-t pt-4">Requested Items</h3>
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg space-y-3 relative bg-muted/50">
                    <FormField control={form.control} name={`items.${index}.productId`} render={({ field }) => (
                      <FormItem><FormLabel>Product</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger disabled={isLoadingProducts}>
                                <SelectValue placeholder={isLoadingProducts ? "Loading products..." : "Select a product"}/>
                            </SelectTrigger></FormControl>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select><FormMessage/>
                      </FormItem>
                    )}/>
                     <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} min="1"/></FormControl><FormMessage/></FormItem>)}/>
                     <FormField control={form.control} name={`items.${index}.notes`} render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Any specific instructions for this item..." rows={2}/></FormControl><FormMessage/></FormItem>)}/>
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-3 -right-3 h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                  </div>
                ))}
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, notes: ""})}><PlusCircle className="mr-2 h-4 w-4"/>Add Another Item</Button>
              </div>

              <CardFooter className="p-0 pt-6">
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                  Submit Request
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
