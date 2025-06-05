
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users as UsersIcon } from 'lucide-react';

export default function AdminUsersPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || role !== 'Admin')) {
      router.replace('/dashboard');
    }
  }, [user, role, loading, router]);

  if (loading || !user || role !== 'Admin') {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading or unauthorized...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">User Management</h1>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UsersIcon className="h-6 w-6 text-primary" />
            <CardTitle>Manage Users</CardTitle>
          </div>
          <CardDescription>View, add, edit, and manage user accounts and their roles within the system.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>User management interface will be built here. This includes features like listing users, editing user details, assigning roles, and managing user status (active/disabled).</p>
        </CardContent>
      </Card>
    </div>
  );
}
