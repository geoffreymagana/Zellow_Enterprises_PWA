
"use client";

import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from "zod";
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { ShippingAddress, ShippingRegion, User as AppUser } from '@/types';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Gift, Edit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const shippingFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  addressLine1: z.string().min(5, "Address line 1 must be at least 5 characters."),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "Please select your city/town."),
  county: z.string().min(1, "County is derived from city/town."),
  postalCode: z.string().optional(),
  phone: z.string().min(10, "Phone number must be at least 10 digits.").regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format."),
  email: z.string().email("Invalid email address."),
  selectedTownRegion: z.string().min(1, "Please select your city/town to determine region."),
  
  // Gift fields - conditionally validated
  isGift: z.boolean().optional(),
  giftRecipientName: z.string().optional(),
  giftRecipientContactMethod: z.enum(['', 'email', 'phone']).optional(),
  giftRecipientContactValue: z.string().optional(),
  giftMessage: z.string().max(300, "Gift message cannot exceed 300 characters.").optional(),
  notifyRecipient: z.boolean().optional(),
  showPricesToRecipient: z.boolean().optional(),
  recipientCanViewAndTrack: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.isGift) {
    if (!data.giftRecipientName || data.giftRecipientName.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recipient's full name is required for gifts.", path: ["giftRecipientName"] });
    }
    if (data.notifyRecipient) {
      if (!data.giftRecipientContactMethod) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recipient contact method is required if notifying.", path: ["giftRecipientContactMethod"] });
      }
      if (!data.giftRecipientContactValue) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recipient contact detail is required if notifying.", path: ["giftRecipientContactValue"] });
      } else if (data.giftRecipientContactMethod === 'email' && !z.string().email().safeParse(data.giftRecipientContactValue).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid recipient email address.", path: ["giftRecipientContactValue"] });
      } else if (data.giftRecipientContactMethod === 'phone' && !/^\+?[0-9\s-()]{10,}$/.test(data.giftRecipientContactValue)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid recipient phone number (min 10 digits).", path: ["giftRecipientContactValue"] });
      }
    }
  }
});

type ShippingFormValues = z.infer<typeof shippingFormSchema>;

interface TownOption {
  value: string; // "townName|regionId|countyName"
  label: string; // "Town Name (County Name)"
}

export default function ShippingPage() {
  const { user } = useAuth();
  const { 
    shippingAddress, setShippingAddress, 
    selectedShippingRegionId, setSelectedShippingRegionId,
    isGiftOrder, setIsGiftOrder,
    giftRecipientName, setGiftRecipientName,
    giftRecipientContactMethod, setGiftRecipientContactMethod,
    giftRecipientContactValue, setGiftRecipientContactValue,
    giftMessage, setGiftMessage,
    notifyRecipient, setNotifyRecipient,
    showPricesToRecipient, setShowPricesToRecipient,
    giftRecipientCanViewAndTrack, setGiftRecipientCanViewAndTrack
  } = useCart();
  const router = useRouter();
  const { toast } = useToast();

  const [regions, setRegions] = useState<ShippingRegion[]>([]);
  const [townOptions, setTownOptions] = useState<TownOption[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isContactInfoEditable, setIsContactInfoEditable] = useState(false);

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: {
      fullName: shippingAddress?.fullName || user?.displayName || '',
      addressLine1: shippingAddress?.addressLine1 || '',
      addressLine2: shippingAddress?.addressLine2 || '',
      city: shippingAddress?.city || '',
      county: shippingAddress?.county || '',
      postalCode: shippingAddress?.postalCode || '',
      phone: shippingAddress?.phone || appUser?.phone || '',
      email: shippingAddress?.email || user?.email || '',
      selectedTownRegion: shippingAddress?.city && selectedShippingRegionId && shippingAddress.county
        ? `${shippingAddress.city}|${selectedShippingRegionId}|${shippingAddress.county}`
        : "",
      isGift: isGiftOrder || false,
      giftRecipientName: giftRecipientName || '',
      giftRecipientContactMethod: giftRecipientContactMethod || '',
      giftRecipientContactValue: giftRecipientContactValue || '',
      giftMessage: giftMessage || '',
      notifyRecipient: notifyRecipient || false,
      showPricesToRecipient: showPricesToRecipient || false,
      recipientCanViewAndTrack: giftRecipientCanViewAndTrack === undefined ? true : giftRecipientCanViewAndTrack, // Default to true
    },
  });

  const isGiftCurrent = form.watch("isGift");
  const notifyRecipientCurrent = form.watch("notifyRecipient");

  const fetchUserData = useCallback(async () => {
    if (!user || !db) return;
    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const userData = docSnap.data() as AppUser;
      setAppUser(userData);
      // Pre-fill form if not already filled by localStorage
      if (!form.getValues('phone') && userData.phone) form.setValue('phone', userData.phone);
    }
  }, [user, form]);

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
    fetchUserData();
  }, [fetchRegions, fetchUserData]);
  
  useEffect(() => {
    if (user) {
      if (!form.getValues('email') && user.email) form.setValue('email', user.email);
      if (!form.getValues('fullName') && user.displayName && !shippingAddress?.fullName) form.setValue('fullName', user.displayName);
    }
    // Sync form with context on initial load or if context changes from elsewhere
    form.reset({
      fullName: shippingAddress?.fullName || user?.displayName || '',
      addressLine1: shippingAddress?.addressLine1 || '',
      addressLine2: shippingAddress?.addressLine2 || '',
      city: shippingAddress?.city || '',
      county: shippingAddress?.county || '',
      postalCode: shippingAddress?.postalCode || '',
      phone: shippingAddress?.phone || appUser?.phone || '',
      email: shippingAddress?.email || user?.email || '',
      selectedTownRegion: shippingAddress?.city && selectedShippingRegionId && shippingAddress.county
        ? `${shippingAddress.city}|${selectedShippingRegionId}|${shippingAddress.county}`
        : "",
      isGift: isGiftOrder,
      giftRecipientName: giftRecipientName,
      giftRecipientContactMethod: giftRecipientContactMethod,
      giftRecipientContactValue: giftRecipientContactValue,
      giftMessage: giftMessage,
      notifyRecipient: notifyRecipient,
      showPricesToRecipient: showPricesToRecipient,
      recipientCanViewAndTrack: giftRecipientCanViewAndTrack === undefined ? true : giftRecipientCanViewAndTrack,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, shippingAddress, isGiftOrder, giftRecipientName, giftRecipientContactMethod, giftRecipientContactValue, giftMessage, notifyRecipient, showPricesToRecipient, giftRecipientCanViewAndTrack, selectedShippingRegionId, appUser]);


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
      selectedShippingRegionId: regionId,
    };
    setShippingAddress(finalShippingAddress);
    setSelectedShippingRegionId(regionId);
    
    // Update gift details in context
    setIsGiftOrder(values.isGift || false);
    if (values.isGift) {
      setGiftRecipientName(values.giftRecipientName || '');
      setGiftRecipientContactMethod(values.giftRecipientContactMethod || '');
      setGiftRecipientContactValue(values.giftRecipientContactValue || '');
      setGiftMessage(values.giftMessage || '');
      setNotifyRecipient(values.notifyRecipient || false);
      if (values.notifyRecipient) {
        setShowPricesToRecipient(values.showPricesToRecipient || false);
        setGiftRecipientCanViewAndTrack(values.recipientCanViewAndTrack === undefined ? true : values.recipientCanViewAndTrack);
      } else {
        setShowPricesToRecipient(false); // Reset if not notifying
        setGiftRecipientCanViewAndTrack(true); // Reset to default
      }
    } else {
      // Clear gift details if not a gift
      setGiftRecipientName('');
      setGiftRecipientContactMethod('');
      setGiftRecipientContactValue('');
      setGiftMessage('');
      setNotifyRecipient(false);
      setShowPricesToRecipient(false);
      setGiftRecipientCanViewAndTrack(true);
    }
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
                <section>
                  <h3 className="text-lg font-medium mb-3">Recipient's Shipping Address</h3>
                  <div className="space-y-4 rounded-md border p-4 bg-muted/20">
                    <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Jane Doe" readOnly={!isContactInfoEditable} className={!isContactInfoEditable ? 'bg-muted/50 border-dashed' : ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} placeholder="you@example.com" readOnly={!isContactInfoEditable} className={!isContactInfoEditable ? 'bg-muted/50 border-dashed' : ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" {...field} placeholder="e.g., 0712 345 678" readOnly={!isContactInfoEditable} className={!isContactInfoEditable ? 'bg-muted/50 border-dashed' : ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="text-right mt-2 mb-4">
                      <Button type="button" variant="link" className="text-sm h-auto p-0" onClick={() => setIsContactInfoEditable(!isContactInfoEditable)}>
                          <Edit className="mr-1 h-3 w-3" /> {isContactInfoEditable ? 'Lock Details' : 'Change Details'}
                      </Button>
                  </div>
                  
                  <FormField control={form.control} name="addressLine1" render={({ field }) => (
                    <FormItem className="mb-4"><FormLabel>Address Line 1</FormLabel><FormControl><Input {...field} placeholder="Street address, P.O. box, Estate, House No." /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="addressLine2" render={({ field }) => (
                    <FormItem className="mb-4"><FormLabel>Address Line 2 (Optional)</FormLabel><FormControl><Input {...field} placeholder="Apartment, suite, unit, building, floor, etc." /></FormControl><FormMessage /></FormItem>
                  )} />
                  
                  <FormField
                    control={form.control} name="selectedTownRegion"
                    render={({ field }) => (
                      <FormItem className="mb-4"> <FormLabel>City / Town</FormLabel>
                        <Select onValueChange={(value) => { field.onChange(value); handleTownChange(value); }} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select your city/town" /></SelectTrigger></FormControl>
                          <SelectContent>{townOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="county" render={({ field }) => ( <FormItem  className="mb-4"><FormLabel>County</FormLabel><FormControl><Input {...field} placeholder="Derived from city/town" readOnly disabled /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="city" render={({ field }) => (<FormItem className="hidden"><FormControl><Input {...field} readOnly /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="postalCode" render={({ field }) => ( <FormItem className="mb-4"><FormLabel>Postal Code (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., 00100" /></FormControl><FormMessage /></FormItem> )} />
                </section>

                <Separator />

                <section>
                  <FormField
                    control={form.control} name="isGift"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-3 border rounded-md hover:border-primary transition-colors">
                        <FormControl><Checkbox id="isGift" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        <FormLabel htmlFor="isGift" className="text-base font-medium cursor-pointer flex items-center"><Gift className="mr-2 h-5 w-5 text-primary"/>This order is a gift</FormLabel>
                      </FormItem>
                    )}
                  />
                  {isGiftCurrent && (
                    <div className="mt-4 space-y-4 p-4 border rounded-md bg-muted/50">
                      <h4 className="text-md font-medium">Gift Recipient Details</h4>
                      <FormField control={form.control} name="giftRecipientName" render={({ field }) => (
                        <FormItem><FormLabel>Recipient's Full Name</FormLabel><FormControl><Input {...field} placeholder="Recipient's Name" /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="notifyRecipient" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                            <FormControl><Checkbox id="notifyRecipient" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel htmlFor="notifyRecipient" className="font-normal cursor-pointer">Notify recipient about this gift?</FormLabel>
                          </FormItem>
                        )}
                      />
                      {notifyRecipientCurrent && (
                        <div className="pl-4 space-y-4 pt-2">
                          <FormField control={form.control} name="giftRecipientContactMethod" render={({ field }) => (
                              <FormItem><FormLabel>Recipient Contact Method</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || ''}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Select contact method" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                  </SelectContent>
                                </Select><FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField control={form.control} name="giftRecipientContactValue" render={({ field }) => (
                              <FormItem><FormLabel>Recipient's Email or Phone Number</FormLabel><FormControl><Input {...field} placeholder="Enter contact detail" /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField control={form.control} name="giftMessage" render={({ field }) => (
                              <FormItem><FormLabel>Special Message for Occasion (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="e.g., Happy Birthday!" rows={3} /></FormControl><FormMessage /></FormItem>
                            )}
                          />
                          <FormField control={form.control} name="showPricesToRecipient" render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                                <FormControl><Checkbox id="showPricesToRecipient" checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel htmlFor="showPricesToRecipient" className="font-normal cursor-pointer">Include prices in recipient's notification?</FormLabel>
                              </FormItem>
                            )}
                          />
                          <FormField control={form.control} name="recipientCanViewAndTrack" render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-2">
                                <FormControl><Checkbox id="recipientCanViewAndTrack" checked={field.value === undefined ? true : field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel htmlFor="recipientCanViewAndTrack" className="font-normal cursor-pointer">Allow recipient to view order details & track gift?</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <Button type="submit" size="lg" className="w-full">Continue to Shipping & Payment</Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
