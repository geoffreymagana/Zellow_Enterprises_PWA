
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useParams } from 'next/navigation';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, ShippingAddress, ShippingMethod, ShippingRate, DeliveryHistoryEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, PackageCheck, Truck, CreditCard, Banknote, Edit, Package, MapPin } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const confirmationFormSchema = z.object({
  // Shipping Address
  fullName: z.string().min(2, "Full name is required."),
  addressLine1: z.string().min(5, "Address line 1 is required."),
  city: z.string().min(1, "Please select your city/town."),
  county: z.string().min(1, "County is derived from city/town."),
  phone: z.string().min(10, "Phone number is required."),
  email: z.string().email(),
  selectedTownRegion: z.string().min(1, "Please select your city/town."),
  // Methods
  shippingMethodId: z.string({ required_error: "Please select a shipping method."}),
  paymentMethod: z.enum(["cod", "mpesa", "card"], { required_error: "Please select a payment method."}),
});

type ConfirmationFormValues = z.infer<typeof confirmationFormSchema>;

interface CalculatedShippingMethod extends ShippingMethod {
  calculatedPrice: number;
}

interface TownOption {
  value: string; // "townName|regionId|countyName"
  label: string; // "Town Name (County Name)"
}

export default function ConfirmBulkOrderPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [townOptions, setTownOptions] = useState<TownOption[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isLoadingShipping, setIsLoadingShipping] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ConfirmationFormValues>({
    resolver: zodResolver(confirmationFormSchema),
  });

  const fetchOrder = useCallback(async () => {
    if (!orderId || !user) return;
    setIsLoading(true);
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    if (orderDoc.exists() && orderDoc.data().customerId === user.uid) {
      const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
      setOrder(orderData);
      form.reset({
        fullName: orderData.customerName,
        email: orderData.customerEmail,
        phone: orderData.customerPhone,
        city: '', county: '', addressLine1: '', selectedTownRegion: '',
        shippingMethodId: undefined, paymentMethod: undefined,
      });
    } else {
      toast({ title: "Error", description: "Order not found or you do not have permission to view it.", variant: "destructive" });
      router.replace('/orders');
    }
    setIsLoading(false);
  }, [orderId, user, toast, router, form]);

  const fetchShippingData = useCallback(async () => {
    setIsLoadingShipping(true);
    try {
        const methodsQuery = query(collection(db, 'shippingMethods'), where("active", "==", true));
        const ratesQuery = query(collection(db, 'shippingRates'), where("active", "==", true));
        const regionsQuery = query(collection(db, 'shippingRegions'), where("active", "==", true));

        const [methodsSnap, ratesSnap, regionsSnap] = await Promise.all([
            getDocs(methodsQuery), getDocs(ratesQuery), getDocs(regionsQuery)
        ]);

        setShippingMethods(methodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ShippingMethod)));
        setShippingRates(ratesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ShippingRate)));

        const options: TownOption[] = [];
        regionsSnap.forEach(regionDoc => {
            const region = regionDoc.data() as Omit<ShippingRate, 'id'>;
            region.towns.forEach(town => {
                options.push({ value: `${town}|${regionDoc.id}|${region.county}`, label: `${town} (${region.county})` });
            });
        });
        options.sort((a,b) => a.label.localeCompare(b.label));
        setTownOptions(options);
    } catch (e: any) {
        toast({ title: "Error", description: "Could not load shipping options.", variant: "destructive" });
    } finally {
        setIsLoadingShipping(false);
    }
  }, [toast]);

  useEffect(() => { fetchOrder(); fetchShippingData(); }, [fetchOrder, fetchShippingData]);

  const handleTownChange = (value: string) => {
    if (!value) { form.setValue('city', ''); form.setValue('county', ''); setSelectedRegionId(null); return; }
    const [townName, regionId, countyName] = value.split('|');
    form.setValue('city', townName, { shouldValidate: true });
    form.setValue('county', countyName, { shouldValidate: true });
    setSelectedRegionId(regionId);
  };

  const calculatedShippingMethods = useMemo((): CalculatedShippingMethod[] => {
    if (!selectedRegionId) return [];
    return shippingMethods.map(method => ({
      ...method,
      calculatedPrice: shippingRates.find(rate => rate.regionId === selectedRegionId && rate.methodId === method.id)?.customPrice ?? method.basePrice,
    })).sort((a, b) => a.calculatedPrice - b.calculatedPrice);
  }, [shippingMethods, shippingRates, selectedRegionId]);

  const watchedShippingMethodId = form.watch("shippingMethodId");
  const currentShippingCost = useMemo(() => {
    if (!watchedShippingMethodId) return 0;
    return calculatedShippingMethods.find(m => m.id === watchedShippingMethodId)?.calculatedPrice ?? 0;
  }, [watchedShippingMethodId, calculatedShippingMethods]);
  
  const finalTotal = (order?.subTotal || 0) + currentShippingCost;

  const onSubmit = async (values: ConfirmationFormValues) => {
    if (!orderId || !db || !user) return;
    const chosenShippingMethod = calculatedShippingMethods.find(m => m.id === values.shippingMethodId);
    if (!chosenShippingMethod) return;

    setIsSubmitting(true);
    try {
        const orderRef = doc(db, 'orders', orderId);
        const finalShippingAddress: ShippingAddress = {
            fullName: values.fullName,
            addressLine1: values.addressLine1,
            city: values.city,
            county: values.county,
            phone: values.phone,
            email: values.email,
        };
        const historyEntry: DeliveryHistoryEntry = {
            status: 'pending_finance_approval',
            timestamp: Timestamp.now(), 
            notes: 'Customer confirmed details and placed order. Awaiting finance approval.',
            actorId: user.uid,
        };
        await updateDoc(orderRef, {
            shippingAddress: finalShippingAddress,
            shippingMethodId: chosenShippingMethod.id,
            shippingMethodName: chosenShippingMethod.name,
            shippingCost: chosenShippingMethod.calculatedPrice,
            totalAmount: finalTotal,
            paymentMethod: values.paymentMethod,
            paymentStatus: (values.paymentMethod === 'mpesa' || values.paymentMethod === 'card') ? 'paid' : 'pending',
            status: 'pending_finance_approval',
            deliveryHistory: arrayUnion(historyEntry),
            updatedAt: serverTimestamp(),
        });
        toast({ title: "Order Confirmed!", description: "Your bulk order has been sent for final approval." });
        router.push(`/orders`);
    } catch (e: any) {
        toast({ title: "Error", description: `Could not confirm order: ${e.message}`, variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!order) {
    return <div className="text-center py-10"><AlertTriangle className="mx-auto h-12 w-12 text-destructive"/>Order not found.</div>
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="text-2xl font-headline">Confirm Your Bulk Order</CardTitle>
                <CardDescription>Please provide the final details for Order #{order.id.substring(0,8)}... to place your order.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* Items Section */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package/>Order Items</h3>
                            <div className="border rounded-md divide-y">
                                {order.items.map(item => (
                                    <div key={item.productId} className="flex justify-between items-center p-3 text-sm">
                                        <span>{item.name} <span className="text-muted-foreground">x {item.quantity}</span></span>
                                        <span className="font-semibold">{formatPrice(item.price * item.quantity)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center p-3 font-bold bg-muted/50">
                                    <span>Subtotal</span>
                                    <span>{formatPrice(order.subTotal)}</span>
                                </div>
                            </div>
                        </section>
                        {/* Shipping Address Section */}
                        <section>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><MapPin/>Shipping Address</h3>
                            <div className="p-4 border rounded-md space-y-4">
                                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="addressLine1" render={({ field }) => (<FormItem><FormLabel>Address (Street, Estate, etc.)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="selectedTownRegion" render={({ field }) => (<FormItem> <FormLabel>City / Town</FormLabel>
                                        <Select onValueChange={(value) => { field.onChange(value); handleTownChange(value); }} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select town" /></SelectTrigger></FormControl>
                                        <SelectContent>{townOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>)}/>
                                    <FormField control={form.control} name="county" render={({ field }) => ( <FormItem><FormLabel>County</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl><FormMessage /></FormItem> )}/>
                                    <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                                </div>
                            </div>
                        </section>
                        {/* Shipping & Payment Method Section */}
                        {selectedRegionId && (
                        <section>
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Truck/>Shipping & Payment</h3>
                            <div className="p-4 border rounded-md space-y-6">
                                <FormField control={form.control} name="shippingMethodId" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Shipping Method</FormLabel>
                                    <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2">
                                    {calculatedShippingMethods.map((method) => (
                                        <FormItem key={method.id} className="flex items-center space-x-3 space-y-0 p-3 border rounded-md has-[:checked]:border-primary transition-all">
                                            <FormControl><RadioGroupItem value={method.id} /></FormControl>
                                            <FormLabel className="font-normal flex-grow cursor-pointer"><div className="flex justify-between items-center w-full"><div><span className="block font-medium">{method.name}</span><span className="block text-xs text-muted-foreground">{method.duration}</span></div><span className="font-semibold">{formatPrice(method.calculatedPrice)}</span></div></FormLabel>
                                        </FormItem>
                                    ))}
                                    </RadioGroup></FormControl><FormMessage />
                                </FormItem>)}/>
                                 <Separator />
                                <FormField control={form.control} name="paymentMethod" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Payment Method</FormLabel>
                                    <FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2">
                                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md has-[:checked]:border-primary transition-all"><FormControl><RadioGroupItem value="cod" /></FormControl><FormLabel className="font-normal flex items-center cursor-pointer flex-grow"><Truck className="mr-3 h-5 w-5 text-primary" /> Pay on Delivery</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md has-[:checked]:border-primary transition-all"><FormControl><RadioGroupItem value="mpesa" /></FormControl><FormLabel className="font-normal flex items-center cursor-pointer flex-grow"><Banknote className="mr-3 h-5 w-5 text-green-600" /> M-Pesa</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0 p-3 border rounded-md has-[:checked]:border-primary transition-all"><FormControl><RadioGroupItem value="card" /></FormControl><FormLabel className="font-normal flex items-center cursor-pointer flex-grow"><CreditCard className="mr-3 h-5 w-5 text-blue-600" /> Credit/Debit Card</FormLabel></FormItem>
                                    </RadioGroup></FormControl><FormMessage />
                                </FormItem>)}/>
                            </div>
                        </section>)}
                        {/* Total Section */}
                        <div className="p-4 border rounded-md bg-muted space-y-2">
                            <div className="flex justify-between text-lg"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatPrice(order.subTotal)}</span></div>
                            <div className="flex justify-between text-lg"><span className="text-muted-foreground">Shipping</span><span className="font-medium">{formatPrice(currentShippingCost)}</span></div>
                            <Separator />
                            <div className="flex justify-between text-2xl font-bold"><span >Total</span><span>{formatPrice(finalTotal)}</span></div>
                        </div>
                        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PackageCheck className="mr-2 h-4 w-4"/>}
                            Confirm & Place Order
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    </div>
  );
}
