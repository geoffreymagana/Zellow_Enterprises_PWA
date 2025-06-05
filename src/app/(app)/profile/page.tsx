
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle2, Edit3, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState, useEffect } from "react";

const profileFormSchema = z.object({
  displayName: z.string().min(1, { message: "Display name cannot be empty." }).max(50, { message: "Display name cannot exceed 50 characters." }),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { user, role, logout, updateUserProfile, loading: authLoading } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user?.displayName || "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({ displayName: user.displayName || "" });
    }
  }, [user, form]);

  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const getInitials = (name?: string | null) => {
    if (!name) return <UserCircle2 />;
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  async function onSubmit(data: ProfileFormValues) {
    setIsUpdating(true);
    try {
      await updateUserProfile(data.displayName);
    } catch (error) {
      // Error is handled by toast in AuthContext
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">My Profile</h1>
      
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-start p-6">
          <Avatar className="h-24 w-24 text-3xl mb-4 sm:mb-0 sm:mr-6">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || 'User'} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-2xl font-headline mb-1">{user.displayName || "User Name Not Set"}</CardTitle>
            <CardDescription className="text-base">{user.email}</CardDescription>
            <RoleBadge role={role} />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="displayName">Display Name</FormLabel>
                    <FormControl>
                      <Input id="displayName" placeholder="Your Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={user.email || ""} disabled className="mt-1" />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={isUpdating || authLoading}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </form>
          </Form>

          <Separator className="my-6" />

          <h3 className="text-lg font-semibold mb-3 font-headline">Account Settings</h3>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <ShieldCheck className="mr-2 h-4 w-4" /> Change Password
            </Button>
             <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
              <p className="text-sm font-medium">Dark Mode</p>
              <ThemeToggle />
            </div>
            <Button variant="destructive" className="w-full justify-start" onClick={logout} disabled={authLoading}>
              {authLoading && logout === undefined ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
               Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  let colorClasses = "bg-muted text-muted-foreground";
  if (role === 'Admin') colorClasses = "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200";
  if (role === 'Customer') colorClasses = "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200";
  if (role === 'Technician') colorClasses = "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200";
  if (role === 'Rider') colorClasses = "bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200";
  // Add more role colors for Supplier, SupplyManager, FinanceManager, ServiceManager, InventoryManager, DispatchManager
  if (role === 'Supplier') colorClasses = "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200";
  if (role === 'SupplyManager') colorClasses = "bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200";
  if (role === 'FinanceManager') colorClasses = "bg-pink-100 text-pink-700 dark:bg-pink-800 dark:text-pink-200";
  if (role === 'ServiceManager') colorClasses = "bg-teal-100 text-teal-700 dark:bg-teal-800 dark:text-teal-200";
  if (role === 'InventoryManager') colorClasses = "bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200";
  if (role === 'DispatchManager') colorClasses = "bg-cyan-100 text-cyan-700 dark:bg-cyan-800 dark:text-cyan-200";


  return (
    <span className={`mt-2 inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClasses}`}>
      {role}
    </span>
  );
}
