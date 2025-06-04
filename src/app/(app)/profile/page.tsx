"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle2, Edit3, ShieldCheck, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/common/ThemeToggle"; // Re-import ThemeToggle

export default function ProfilePage() {
  const { user, role, logout } = useAuth();

  if (!user) {
    return <div>Loading profile...</div>;
  }

  const getInitials = (name?: string | null) => {
    if (!name) return <UserCircle2 />;
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

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
            <Badge className="mt-2 text-sm" role={role} />
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input id="displayName" defaultValue={user.displayName || ""} placeholder="Your Name"/>
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={user.email || ""} disabled />
              </div>
            </div>
            {/* Add more fields like phone number, address based on role if needed */}
            <Button type="submit" className="w-full sm:w-auto">
              <Edit3 className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </form>

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
            <Button variant="destructive" className="w-full justify-start" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for role badge - can be moved to a shared location
function Badge({ role }: { role: string | null }) {
  if (!role) return null;
  let colorClasses = "bg-muted text-muted-foreground";
  if (role === 'Customer') colorClasses = "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200";
  if (role === 'Technician') colorClasses = "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200";
  if (role === 'Rider') colorClasses = "bg-purple-100 text-purple-700 dark:bg-purple-800 dark:text-purple-200";
  // Add more role colors

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colorClasses}`}>
      {role}
    </span>
  );
}

