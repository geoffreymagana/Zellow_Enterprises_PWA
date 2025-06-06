
"use client";

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { ShippingAddress, ShippingRegion } from '@/types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const shippingFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  addressLine1: z.string().min(5, "Address line 1 must be at least 5 characters."),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "Please select your city/town."), // Will be set by dropdown
  county: z.string().min(1, "County is derived from city/town."), // Will be set by dropdown
  postalCode: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits.").regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format."),
  email: z.string().email("Invalid email address."),
  // This field is for the dropdown value, not directly part of ShippingAddress
  selectedTownRegion: z.string().min(1, "Please select your city/town to determine region."),
});

type ShippingFormValues = z.infer<typeof shippingFormSchema>;

interface TownOption {
  value: string; // "townName|regionId|countyName"
  label: string; // "Town Name (County Name)"
}

export default function ShippingPage() {
  const { user } = useAuth();
  const { shippingAddress, setShippingAddress, setSelectedShippingRegionId, selectedShippingRegionId } = useCart();
  const router = useRouter();
  const { toast } = useToast();

  const [regions, setRegions] = useState<ShippingRegion[]>([]);
  const [townOptions, setTownOptions] = useState<TownOption[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: {
      fullName: shippingAddress?.fullName || user?.displayName || '',
      addressLine1: shippingAddress?.addressLine1 || '',
      addressLine2: shippingAddress?.addressLine2 || '',
      city: shippingAddress?.city || '',
      county: shippingAddress?.county || '',
      postalCode: shippingAddress?.postalCode || '',
      phone: shippingAddress?.phone || '',
      email: shippingAddress?.email || user?.email || '',
      selectedTownRegion: shippingAddress?.city && selectedShippingRegionId && shippingAddress.county
        ? `${shippingAddress.city}|${selectedShippingRegionId}|${shippingAddress.county}`
        : "",
    },
  });

  const fetchRegions = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Database service unavailable.", variant: "destructive" });
      setIsLoadingRegions(false);
      return;
    }
    setIsLoadingRegions(true);
    try {
      const q = query(collection(db, 'shippingRegions'), where("active", "==", true));
      const snapshot = await getDocs(q);
      const fetchedRegions: ShippingRegion[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippingRegion));
      setRegions(fetchedRegions);

      const options: TownOption[] = [];
      fetchedRegions.forEach(region => {
        region.towns.forEach(town => {
          options.push({
            value: `${town}|${region.id}|${region.county}`,
            label: `${town} (${region.county})`,
          });
        });
      });
      // Sort options alphabetically by label
      options.sort((a, b) => a.label.localeCompare(b.label));
      setTownOptions(options);

    } catch (e: any) {
      console.error("Error fetching shipping regions:", e);
      toast({ title: "Error", description: "Could not load shipping regions.", variant: "destructive" });
    } finally {
      setIsLoadingRegions(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);
  
  useEffect(() => {
    // Pre-fill form if user data changes and fields aren't already set by shippingAddress context
    if (user) {
      if (!form.getValues('email') && user.email) form.setValue('email', user.email);
      if (!form.getValues('fullName') && user.displayName) form.setValue('fullName', user.displayName);
    }
  }, [user, form, shippingAddress]);


  const handleTownChange = (value: string) => {
    if (!value) {
      form.setValue('city', '');
      form.setValue('county', '');
      setSelectedShippingRegionId(null);
      return;
    }
    const [townName, regionId, countyName] = value.split('|');
    form.setValue('city', townName, { shouldValidate: true });
    form.setValue('county', countyName, { shouldValidate: true });
    setSelectedShippingRegionId(regionId);
  };

  const onSubmit = (values: ShippingFormValues) => {
    const [townName, regionId, countyName] = values.selectedTownRegion.split('|');
    
    const finalShippingAddress: ShippingAddress = {
      fullName: values.fullName,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2,
      city: townName,
      county: countyName,
      postalCode: values.postalCode,
      phone: values.phone,
      email: values.email,
      selectedShippingRegionId: regionId, // Store regionId with address
    };
    setShippingAddress(finalShippingAddress);
    setSelectedShippingRegionId(regionId); // Ensure context is updated
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
          {isLoadingRegions ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading regions...</p>
            </div>
          ) : townOptions.length === 0 ? (
             <p className="text-destructive text-center py-4">No shipping regions configured or available. Please contact support.</p>
          ) : (
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
                  <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} placeholder="Street address, P.O. box, Estate, House No." /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="addressLine2" render={({ field }) => (
                  <FormItem><FormLabel>Address Line 2 (Optional)</FormLabel><FormControl><Input {...field} placeholder="Apartment, suite, unit, building, floor, etc." /></FormControl><FormMessage /></FormItem>
                )} />
                
                <FormField
                  control={form.control}
                  name="selectedTownRegion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City / Town</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value); // Update RHF
                          handleTownChange(value); // Custom handler
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your city/town" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {townOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField control={form.control} name="county" render={({ field }) => (
                    <FormItem><FormLabel>County</FormLabel><FormControl><Input {...field} placeholder="Derived from city/town" readOnly disabled /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (<FormItem className="hidden"><FormControl><Input {...field} readOnly /></FormControl></FormItem>)} />


                <FormField control={form.control} name="postalCode" render={({ field }) => (
                  <FormItem><FormLabel>Postal Code (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., 00100" /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" size="lg" className="w-full">Continue to Shipping & Payment</Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
