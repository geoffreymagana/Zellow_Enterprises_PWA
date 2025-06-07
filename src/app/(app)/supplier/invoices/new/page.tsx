
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { addDays, format } from 'date-fns';
import { ArrowLeft, Send, CalendarIcon, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import type { Invoice, InvoiceItem, StockRequest } from '@/types';
import { collection, addDoc, serverTimestamp, doc, updateDoc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

const formatKsh = (amount: number) => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
};

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Item description is required."),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0, "Unit price must be 0 or greater."),
});

const invoiceFormSchema = z.object({
  invoiceDate: z.date({ required_error: "Invoice date is required."}),
  dueDate: z.date({ required_error: "Due date is required."}),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required."),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0), // Percentage
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export default function NewInvoicePage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const stockRequestId = searchParams.get('stockRequestId');
  const productName = searchParams.get('productName');
  const fulfilledQty = searchParams.get('fulfilledQty');
  const supplierNotesDialog = searchParams.get('supplierNotesDialog');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceDate: new Date(),
      dueDate: addDays(new Date(), 30),
      items: [{ description: productName || "", quantity: Number(fulfilledQty) || 1, unitPrice: 0 }],
      notes: supplierNotesDialog || "",
      taxRate: 5, // Default 5% tax
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const watchedTaxRate = form.watch("taxRate");

  const subTotal = watchedItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const taxAmount = subTotal * (watchedTaxRate / 100);
  const totalAmount = subTotal + taxAmount;

  useEffect(() => {
    if (authLoading) return;
    if (!user || role !== 'Supplier') {
      router.replace('/dashboard');
    }
  }, [user, role, authLoading, router]);
  
  useEffect(() => {
     // Update due date if invoice date changes
    const subscription = form.watch((value, { name }) => {
      if (name === "invoiceDate" && value.invoiceDate) {
        form.setValue("dueDate", addDays(value.invoiceDate, 30));
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);


  const onSubmit = async (values: InvoiceFormValues) => {
    if (!user || !db) return;
    setIsSubmitting(true);

    const invoiceItems: InvoiceItem[] = values.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice,
    }));

    const newInvoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
      invoiceNumber,
      supplierId: user.uid,
      supplierName: user.displayName || user.email || "Unknown Supplier",
      clientName: "Zellow Enterprises", // Hardcoded client
      invoiceDate: values.invoiceDate,
      dueDate: values.dueDate,
      items: invoiceItems,
      subTotal: subTotal,
      taxRate: values.taxRate,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      status: 'pending_approval',
      notes: values.notes,
      stockRequestId: stockRequestId || undefined,
    };

    try {
      await runTransaction(db, async (transaction) => {
        const invoiceRef = await addDoc(collection(db, 'invoices'), {
          ...newInvoiceData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (stockRequestId) {
          const stockRequestRef = doc(db, 'stockRequests', stockRequestId);
          transaction.update(stockRequestRef, {
            status: 'awaiting_receipt',
            fulfilledQuantity: Number(fulfilledQty) || 0, // Quantity already confirmed by supplier
            supplierNotes: values.notes, // Use notes from invoice
            supplierId: user.uid,
            supplierName: user.displayName || user.email,
            supplierActionTimestamp: serverTimestamp(),
            invoiceId: invoiceRef.id,
            updatedAt: serverTimestamp(),
          });
        }
      });

      toast({ title: "Invoice Sent", description: `Invoice ${invoiceNumber} sent for approval.` });
      router.push('/supplier/stock-requests');
    } catch (e: any) {
      console.error("Error creating invoice or updating stock request:", e);
      toast({ title: "Error", description: "Could not create invoice.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-muted flex flex-col items-center py-6 sm:py-12 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="bg-card p-4 border-b">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-grow">
              <CardTitle className="text-lg font-headline text-center">New Invoice</CardTitle>
              <CardDescription className="text-center text-xs">#{invoiceNumber}</CardDescription>
            </div>
            <div className="w-8"></div> {/* Spacer for balance */}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Invoice Date</FormLabel>
                    <Popover><PopoverTrigger asChild>
                      <FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel>
                    <Popover><PopoverTrigger asChild>
                      <FormControl><Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>} <CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                    </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div>
                <Label>Client</Label>
                <Input value="Zellow Enterprises" disabled className="bg-muted/50" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Items</Label>
                {fields.map((item, index) => (
                  <div key={item.id} className="p-3 border rounded-md space-y-2 bg-muted/30 relative">
                    <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">Description</FormLabel><FormControl><Input {...field} placeholder="Item description" className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>
                    )} />
                    <div className="grid grid-cols-3 gap-2">
                      <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Qty</FormLabel><FormControl><Input type="number" {...field} placeholder="0" className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>
                      )} />
                      <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (
                        <FormItem><FormLabel className="text-xs">Unit Price (Ksh)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00" className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>
                      )} />
                       <div>
                        <Label className="text-xs">Total (Ksh)</Label>
                        <Input value={formatKsh(watchedItems[index]?.quantity * watchedItems[index]?.unitPrice || 0)} disabled className="h-8 text-sm bg-muted/20" />
                      </div>
                    </div>
                    {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(index)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
              
              <div className="space-y-2 pt-3 border-t">
                 <FormField control={form.control} name="taxRate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Tax Rate (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} placeholder="e.g. 5 for 5%" className="h-8 text-sm" /></FormControl><FormMessage className="text-xs"/></FormItem>
                )} />
                <div className="flex justify-between items-center text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatKsh(subTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Taxes ({watchedTaxRate || 0}%)</span>
                  <span className="font-medium">{formatKsh(taxAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-1">
                  <span>Total Amount</span>
                  <span>{formatKsh(totalAmount)}</span>
                </div>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="Any additional notes for Zellow..." rows={2} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <div className="space-y-2 pt-4">
                <Button type="submit" className="w-full bg-foreground hover:bg-foreground/90 text-background" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />} Send Invoice Now
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => onSubmit(form.getValues())} disabled={isSubmitting}> {/* Placeholder for now */}
                  Schedule Delivery
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

