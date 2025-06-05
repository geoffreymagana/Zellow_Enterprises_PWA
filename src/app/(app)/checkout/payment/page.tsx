
"use client";

import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Banknote, CreditCard, Truck } from 'lucide-react';

const paymentFormSchema = z.object({
  paymentMethod: z.enum(["cod", "mpesa", "card"], {
    required_error: "You need to select a payment method.",
  }),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export default function PaymentPage() {
  const { shippingAddress, paymentMethod, setPaymentMethod } = useCart();
  const router = useRouter();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paymentMethod: paymentMethod || "cod", // Default to COD or previously selected
    },
  });

  useEffect(() => {
    if (!shippingAddress) {
      router.replace('/checkout/shipping'); // Redirect if no shipping address
    }
  }, [shippingAddress, router]);

  const onSubmit = (values: PaymentFormValues) => {
    setPaymentMethod(values.paymentMethod);
    router.push('/checkout/review');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Payment Method</CardTitle>
          <CardDescription>Choose how you'd like to pay for your order.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                             <Banknote className="mr-3 h-6 w-6 text-green-600" /> M-Pesa (Paybill/Till - Mock)
                          </FormLabel>
                        </FormItem>
                         <FormDescription className="text-xs px-1">For M-Pesa, details will be shown on the next screen.</FormDescription>
                        <FormItem className="flex items-center space-x-3 space-y-0 p-4 border rounded-md has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary transition-all">
                          <FormControl><RadioGroupItem value="card" /></FormControl>
                           <FormLabel className="font-normal text-base flex items-center cursor-pointer flex-grow">
                            <CreditCard className="mr-3 h-6 w-6 text-blue-600" /> Credit/Debit Card (Mock)
                          </FormLabel>
                        </FormItem>
                        <FormDescription className="text-xs px-1">Secure card payment (this is a mock interface).</FormDescription>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="w-full">Continue to Review</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
