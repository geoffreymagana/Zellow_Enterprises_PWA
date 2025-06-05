
"use client";

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ShippingAddress } from '@/types';

const shippingFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  addressLine1: z.string().min(5, "Address line 1 must be at least 5 characters."),
  addressLine2: z.string().optional(),
  city: z.string().min(2, "City must be at least 2 characters."),
  county: z.string().min(2, "County must be at least 2 characters."),
  postalCode: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits.").regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format."),
  email: z.string().email("Invalid email address."),
});

type ShippingFormValues = z.infer<typeof shippingFormSchema>;

export default function ShippingPage() {
  const { user } = useAuth();
  const { shippingAddress, setShippingAddress } = useCart();
  const router = useRouter();

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: shippingAddress || {
      fullName: user?.displayName || '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      county: '',
      postalCode: '',
      phone: '', // Consider pre-filling if user has phone in profile
      email: user?.email || '',
    },
  });

  useEffect(() => {
    // If user changes, reset email if not already set by shippingAddress
    if (user && !shippingAddress?.email) {
      form.reset({ ...form.getValues(), email: user.email || '' });
    }
     if (user && !shippingAddress?.fullName && user.displayName) {
      form.reset({ ...form.getValues(), fullName: user.displayName });
    }
  }, [user, form, shippingAddress]);

  const onSubmit = (values: ShippingFormValues) => {
    setShippingAddress(values);
    router.push('/checkout/payment');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Shipping Details</CardTitle>
          <CardDescription>Where should we send your order?</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField control={form.control} name="fullName" render={({ field }) => (
                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Jane Doe" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} placeholder="you@example.com" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} placeholder="e.g., 0712 345 678" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="addressLine1" render={({ field }) => (
                <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} placeholder="Street address, P.O. box" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="addressLine2" render={({ field }) => (
                <FormItem><FormLabel>Address Line 2 (Optional)</FormLabel><FormControl><Input {...field} placeholder="Apartment, suite, unit, building, floor, etc." /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City / Town</FormLabel><FormControl><Input {...field} placeholder="e.g., Nairobi" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="county" render={({ field }) => (
                  <FormItem><FormLabel>County</FormLabel><FormControl><Input {...field} placeholder="e.g., Nairobi County" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="postalCode" render={({ field }) => (
                <FormItem><FormLabel>Postal Code (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., 00100" /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" size="lg" className="w-full">Continue to Payment</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
