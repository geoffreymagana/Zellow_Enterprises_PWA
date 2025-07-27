
"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings2 } from 'lucide-react';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const settingsFormSchema = z.object({
  siteName: z.string().min(1, "Site name is required").max(50, "Site name must be 50 characters or less."),
  enableEmailNotifications: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

interface SiteSettings extends SettingsFormValues {}

const SETTINGS_DOC_PATH = "settings/siteConfiguration";

export default function AdminSettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      siteName: "",
      enableEmailNotifications: true,
    },
  });

  const fetchSettings = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoadingSettings(false);
      return;
    }
    setIsLoadingSettings(true);
    try {
      const settingsDocRef = doc(db, SETTINGS_DOC_PATH);
      const settingsDoc = await getDoc(settingsDocRef);
      if (settingsDoc.exists()) {
        const data = settingsDoc.data() as SiteSettings;
        form.reset(data);
      } else {
        // Initialize with default values if no settings doc exists
        form.reset({ siteName: "Zellow Enterprises", enableEmailNotifications: true });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast({ title: "Error", description: "Failed to load site settings.", variant: "destructive" });
    } finally {
      setIsLoadingSettings(false);
    }
  }, [toast, form]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchSettings();
      }
    }
  }, [user, role, authLoading, router, fetchSettings]);

  const onSubmit = async (values: SettingsFormValues) => {
    if (!db) {
      toast({ title: "Save Error", description: "Firestore is not available.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const settingsDocRef = doc(db, SETTINGS_DOC_PATH);
      // Use setDoc with merge:true to create or update the document
      await setDoc(settingsDocRef, values, { merge: true }); 
      toast({ title: "Settings Saved", description: "Site settings have been updated." });
    } catch (error: any) {
      console.error("Failed to save settings:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save settings.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading or unauthorized...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">System Settings</h1>
      <p className="text-muted-foreground mb-6">Manage global application settings, integrations, and operational parameters.</p>
      
      {isLoadingSettings ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Site Branding</CardTitle>
                <CardDescription>Customize the name of your application.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="siteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Zellow Enterprises" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Notifications</CardTitle>
                <CardDescription>Configure system-wide email notification preferences.</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="enableEmailNotifications"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Email Notifications</FormLabel>
                        <CardDescription>
                          Toggle on/off all automated email notifications sent by the system.
                        </CardDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-headline">API Key Management</CardTitle>
                <CardDescription>Manage API keys for third-party service integrations.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-6 bg-muted/50 rounded-md text-center">
                  <Settings2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">API key management interface will be available here in a future update. This section would allow administrators to securely add, view, and revoke API keys for services like payment gateways, mapping services, etc.</p>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving || isLoadingSettings}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Settings
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
