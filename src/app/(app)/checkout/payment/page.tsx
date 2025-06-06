
"use client";

import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Banknote, CreditCard, Truck, Loader2, Package } from 'lucide-react';
import type { ShippingMethod, ShippingRate } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const paymentFormSchema = z.object({
  shippingMethodId: z.string({ required_error: "Please select a shipping method."}),
  paymentMethod: z.enum(["cod", "mpesa", "card"], {
    required_error: "You need to select a payment method.",
  }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface CalculatedShippingMethod extends ShippingMethod {
  calculatedPrice: number;
}

export default function ShippingAndPaymentPage() {
  const { 
    shippingAddress, 
    paymentMethod, 
    setPaymentMethod, 
    selectedShippingRegionId,
    selectedShippingMethodInfo,
    setSelectedShippingMethodInfo,
    cartSubtotal
  } = useCart();
  const router = useRouter();
  const { toast } = useToast();

  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [isLoadingShipping, setIsLoadingShipping] = useState(true);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      shippingMethodId: selectedShippingMethodInfo?.id || undefined,
      paymentMethod: paymentMethod || "cod",
    },
  });

  useEffect(() => {
    if (!shippingAddress || !selectedShippingRegionId) {
      toast({ title: "Missing Details", description: "Please complete shipping address first.", variant: "destructive"});
      router.replace('/checkout/shipping');
    }
  }, [shippingAddress, selectedShippingRegionId, router, toast]);

  const fetchShippingOptions = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Database service unavailable.", variant: "destructive" });
      setIsLoadingShipping(false);
      return;
    }
    setIsLoadingShipping(true);
    try {
      const methodsQuery = query(collection(db, 'shippingMethods'), where("active", "==", true));
      const ratesQuery = query(collection(db, 'shippingRates'), where("active", "==", true));

      const [methodsSnapshot, ratesSnapshot] = await Promise.all([
        getDocs(methodsQuery),
        getDocs(ratesQuery)
      ]);

      const fetchedMethods: ShippingMethod[] = methodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingMethod));
      const fetchedRates: ShippingRate[] = ratesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRate));
      
      setShippingMethods(fetchedMethods);
      setShippingRates(fetchedRates);

    } catch (e: any) {
      console.error("Error fetching shipping options:", e);
      toast({ title: "Error", description: "Could not load shipping options.", variant: "destructive" });
    } finally {
      setIsLoadingShipping(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedShippingRegionId) { // Only fetch if region is selected
        fetchShippingOptions();
    }
  }, [selectedShippingRegionId, fetchShippingOptions]);

  const calculatedShippingMethods = useMemo((): CalculatedShippingMethod[] => {
    if (!selectedShippingRegionId) return [];
    return shippingMethods.map(method => {
      const regionRate = shippingRates.find(rate => rate.regionId === selectedShippingRegionId && rate.methodId === method.id);
      return {
        ...method,
        calculatedPrice: regionRate ? regionRate.customPrice : method.basePrice,
      };
    }).sort((a,b) => a.calculatedPrice - b.calculatedPrice); // Sort by price
  }, [shippingMethods, shippingRates, selectedShippingRegionId]);

  const onSubmit = (values: PaymentFormValues) => {
    const chosenShippingMethod = calculatedShippingMethods.find(m => m.id === values.shippingMethodId);
    if (!chosenShippingMethod) {
        toast({title: "Error", description: "Selected shipping method not found.", variant: "destructive"});
        return;
    }
    setSelectedShippingMethodInfo({
        id: chosenShippingMethod.id,
        name: chosenShippingMethod.name,
        cost: chosenShippingMethod.calculatedPrice,
        duration: chosenShippingMethod.duration,
    });
    setPaymentMethod(values.paymentMethod);
    router.push('/checkout/review');
  };
  
  // Watch selected shipping method to update context immediately if needed for summary, or on submit
  const watchedShippingMethodId = form.watch("shippingMethodId");
  const currentShippingCost = useMemo(() => {
    if (!watchedShippingMethodId) return 0;
    const method = calculatedShippingMethods.find(m => m.id === watchedShippingMethodId);
    return method ? method.calculatedPrice : 0;
  }, [watchedShippingMethodId, calculatedShippingMethods]);
  const orderTotal = cartSubtotal + currentShippingCost;


  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Shipping & Payment</CardTitle>
          <CardDescription>Choose your preferred shipping and payment methods.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Shipping Method Section */}
              <section className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center"><Package className="mr-2 h-5 w-5 text-primary"/>Shipping Method</h3>
                {isLoadingShipping ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="ml-2 text-muted-foreground">Loading shipping options...</p>
                  </div>
                ) : calculatedShippingMethods.length === 0 ? (
                    <p className="text-muted-foreground py-4">No shipping methods available for your selected region. Please check your address or contact support.</p>
                ) : (
                  <FormField
                    control={form.control}
                    name="shippingMethodId"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                                field.onChange(value);
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            {calculatedShippingMethods.map((method) => (
                              <FormItem key={method.id} className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary transition-all">
                                <FormControl><RadioGroupItem value={method.id} /></FormControl>
                                <FormLabel className="font-normal text-sm sm:text-base flex-grow cursor-pointer">
                                  <div className="flex justify-between items-center w-full">
                                    <div>
                                      <span className="block font-medium">{method.name}</span>
                                      <span className="block text-xs text-muted-foreground">{method.duration}</span>
                                    </div>
                                    <span className="font-semibold">{formatPrice(method.calculatedPrice)}</span>
                                  </div>
                                </FormLabel>
                              </FormItem>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </section>

              <Separator />

              {/* Payment Method Section */}
              <section className="space-y-4">
                 <h3 className="text-lg font-semibold flex items-center"><CreditCard className="mr-2 h-5 w-5 text-primary"/>Payment Method</h3>
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-3"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary transition-all">
                            <FormControl><RadioGroupItem value="cod" /></FormControl>
                            <FormLabel className="font-normal text-base flex items-center cursor-pointer flex-grow">
                              <Truck className="mr-3 h-6 w-6 text-primary" /> Pay on Delivery
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary transition-all">
                            <FormControl><RadioGroupItem value="mpesa" /></FormControl>
                            <FormLabel className="font-normal text-base flex items-center cursor-pointer flex-grow">
                              <Banknote className="mr-3 h-6 w-6 text-green-600" /> M-Pesa (Paybill/Till)
                            </FormLabel>
                          </FormItem>
                          <FormDescription className="text-xs px-1">For M-Pesa, details will be shown on the next screen.</FormDescription>
                          <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary transition-all">
                            <FormControl><RadioGroupItem value="card" /></FormControl>
                            <FormLabel className="font-normal text-base flex items-center cursor-pointer flex-grow">
                              <CreditCard className="mr-3 h-6 w-6 text-blue-600" /> Credit/Debit Card
                            </FormLabel>
                          </FormItem>
                           <FormDescription className="text-xs px-1">Secure card payment.</FormDescription>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
              
              <Separator />

              {/* Order Summary Preview */}
               {cartSubtotal > 0 && (
                <section className="space-y-2 py-4">
                    <h3 className="text-md font-semibold">Order Total Preview</h3>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatPrice(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span>{formatPrice(currentShippingCost)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-1 border-t mt-1">
                        <span>Total</span>
                        <span>{formatPrice(orderTotal)}</span>
                    </div>
                </section>
               )}


              <Button type="submit" size="lg" className="w-full" disabled={isLoadingShipping || calculatedShippingMethods.length === 0}>
                Continue to Review
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
