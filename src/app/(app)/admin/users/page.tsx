
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTrigger, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Eye, EyeOff, UserCheck, UserX, Search, CheckCircle, XCircle, AlertTriangle, UserCog, Filter, RefreshCcw } from 'lucide-react';
import type { User, UserRole, UserStatus } from '@/types';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';

const technicianRoles: UserRole[] = ['Engraving', 'Printing', 'Assembly', 'Quality Check', 'Packaging'];
const otherEmployeeRoles: UserRole[] = ['Rider', 'Supplier', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

const allEmployeeRoles: UserRole[] = [...technicianRoles, ...otherEmployeeRoles];
const allManageableRoles: UserRole[] = [...allEmployeeRoles, 'Admin', 'Customer'];


const createUserFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(allEmployeeRoles as [string, ...string[]], { required_error: "Role is required" }),
});
type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

const editUserFormSchema = z.object({
  role: z.enum(allManageableRoles as [string, ...string[]], { required_error: "Role is required" }), 
  disabled: z.boolean().optional(),
});
type EditUserFormValues = z.infer<typeof editUserFormSchema>;

const getAccountStatusBadgeVariant = (user: User): BadgeProps['variant'] => {
    if (user.status === 'rejected') return 'destructive';
    if (user.status === 'pending') return 'statusYellow';
    if (user.disabled) return 'statusRed';
    return 'statusGreen';
};

const getAccountStatusText = (user: User): string => {
    if (user.status === 'rejected') return 'Rejected';
    if (user.status === 'pending') return 'Pending Approval';
    if (user.disabled) {
        const timeAgo = user.disabledAt ? `since ${formatDistanceToNow(user.disabledAt.toDate(), { addSuffix: true })}` : '';
        return `Inactive ${timeAgo}`.trim();
    }
    return 'Active';
};

export default function AdminUsersPage() {
  const { user: adminUser, role: adminRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");


  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { firstName: "", lastName: "", role: undefined },
  });

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
  });

  const fetchUsers = useCallback(async () => {
    if (!db) {
      toast({ title: "Error", description: "Firestore is not available.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(query(usersCollection));
      const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      
      usersList.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
      
      setUsers(usersList);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({ title: "Error", description: "Failed to fetch users.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!adminUser || adminRole !== 'Admin') {
        router.replace('/dashboard');
      } else {
        fetchUsers();
      }
    }
  }, [adminUser, adminRole, authLoading, router, fetchUsers]);
  
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        const searchMatch = !searchTerm ||
            (user.displayName?.toLowerCase().includes(searchLower)) ||
            (user.email?.toLowerCase().includes(searchLower)) ||
            (user.firstName?.toLowerCase().includes(searchLower)) ||
            (user.lastName?.toLowerCase().includes(searchLower));

        const roleMatch = roleFilter === 'all' || user.role === roleFilter;

        let statusMatch = true;
        if (statusFilter !== 'all') {
            switch(statusFilter) {
                case 'active': statusMatch = !user.disabled && user.status === 'approved'; break;
                case 'inactive': statusMatch = !!user.disabled && user.status !== 'rejected'; break;
                case 'pending': statusMatch = user.status === 'pending'; break;
                case 'rejected': statusMatch = user.status === 'rejected'; break;
            }
        }
        
        return searchMatch && roleMatch && statusMatch;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const checkEmailExists = async (email: string): Promise<boolean> => {
    if (!db) return true; 
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const handleCreateUser = async (values: CreateUserFormValues) => {
    if (!auth || !db) return;
    setIsSubmitting(true);
    const { firstName, lastName, role } = values;
    let email = `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}@admin.com`;
    let emailIsTaken = await checkEmailExists(email);

    if (emailIsTaken) {
      email = `${lastName.toLowerCase().replace(/\s+/g, '')}.${firstName.toLowerCase().replace(/\s+/g, '')}@admin.com`;
      emailIsTaken = await checkEmailExists(email);
      if (emailIsTaken) {
        toast({ title: "Error", description: "Could not generate a unique email. Please try different names.", variant: "destructive" });
        setIsSubmitting(false); return;
      }
    }

    const defaultPassword = "12345678"; 
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, defaultPassword);
      const newUser = userCredential.user;
      const displayName = `${firstName} ${lastName}`;
      await updateAuthProfile(newUser, { displayName });
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid, email, firstName, lastName, displayName, role,
        createdAt: serverTimestamp(),
        status: 'approved',
        disabled: false, 
      });
      toast({ title: "User Created", description: `${displayName} (${email}) created and approved. Default password: ${defaultPassword}`, duration: 7000 });
      setIsCreateUserOpen(false); createUserForm.reset(); fetchUsers(); 
    } catch (error: any) {
      toast({ title: "Creation Failed", description: error.message || "Could not create user.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openEditModal = (user: User) => {
    setUserToEdit(user);
    editUserForm.reset({ role: user.role || undefined, disabled: user.disabled || false }); 
    setIsEditUserOpen(true);
  };

  const handleEditUser = async (values: EditUserFormValues) => {
    if (!db || !userToEdit) return;
    setIsSubmitting(true);
    try {
      const wasDisabled = userToEdit.disabled;
      const willBeDisabled = values.disabled;
      
      const updateData: any = { 
        role: values.role,
        disabled: values.disabled,
      };

      if (!wasDisabled && willBeDisabled) {
        updateData.disabledAt = serverTimestamp();
      } else if (wasDisabled && !willBeDisabled) {
        updateData.disabledAt = null;
      }

      await updateDoc(doc(db, 'users', userToEdit.uid), updateData);
      toast({ title: "User Updated", description: `${userToEdit.displayName || userToEdit.email}'s details updated.` });
      setIsEditUserOpen(false); setUserToEdit(null); fetchUsers();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message || "Could not update user.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReinstateUser = async () => {
    if (!db || !userToEdit) return;
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', userToEdit.uid);
      await updateDoc(userRef, {
        status: 'approved',
        disabled: false,
        disabledAt: null,
        rejectionReason: null,
      });
      toast({ title: "User Reinstated", description: `${userToEdit.displayName || userToEdit.email} has been approved and enabled.` });
      setIsEditUserOpen(false); setUserToEdit(null); fetchUsers();
    } catch (error: any) {
      toast({ title: "Update Failed", description: "Could not reinstate user.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const openDeleteDialog = (user: User) => setUserToDelete(user);
  
  const handleDeleteUser = async () => {
    if (!db || !userToDelete || !adminUser) return;
    if (userToDelete.uid === adminUser.uid) {
      toast({ title: "Action Denied", description: "You cannot delete your own account.", variant: "destructive" });
      setUserToDelete(null); return;
    }
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      toast({ title: "User Record Deleted", description: `User ${userToDelete.displayName || userToDelete.email}'s record removed.` });
      setUserToDelete(null); fetchUsers();
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message || "Could not delete user record.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const formatDisplayName = (user: User) => {
    const name = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || '-';
  };

  if (authLoading || (!adminUser && !authLoading)) { 
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-semibold">User Management</h1>
          <p className="text-muted-foreground mt-1">View, add, edit, and manage user accounts.</p>
        </div>
        <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
          <DialogTrigger asChild><Button onClick={() => setIsCreateUserOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Create Staff</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Employee</DialogTitle>
              <DialogDescription>Email will be auto-generated. Default password: <Button variant="ghost" size="sm" onClick={() => setShowDefaultPassword(!showDefaultPassword)} className="ml-1 p-1 h-auto align-middle">{showDefaultPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>{showDefaultPassword && <span className="text-xs font-mono"> (12345678)</span>}</DialogDescription>
            </DialogHeader>
            <Form {...createUserForm}>
              <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="space-y-4 py-4">
                <FormField control={createUserForm.control} name="firstName" render={({ field }) => (<FormItem><Label>First Name</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={createUserForm.control} name="lastName" render={({ field }) => (<FormItem><Label>Last Name</Label><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={createUserForm.control} name="role" render={({ field }) => (<FormItem><Label>Role</Label><Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{allEmployeeRoles.map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader className="p-4 border-b">
           <div className="flex flex-col sm:flex-row gap-2 items-center">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search users (Name, Email)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {allManageableRoles.map(r => r && <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
               <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                    <Filter className="mr-2 h-3 w-3" /> Clear
                </Button>
              )}
           </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredUsers.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredUsers.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{users.length === 0 ? "No users found." : "No users match your filters."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>User ID</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Account Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.uid} className={user.disabled ? "bg-muted/50 opacity-70" : ""}>
                    <TableCell className="font-medium">
                      <div className={user.disabled ? 'line-through' : ''}>{formatDisplayName(user)}</div>
                      <div className="text-xs text-muted-foreground">{user.town && user.county ? `${user.town}, ${user.county}` : (user.county || user.town || '')}</div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted p-1 rounded">{user.uid}</code>
                    </TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.role || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={getAccountStatusBadgeVariant(user)} className="capitalize">
                         {getAccountStatusText(user)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(user)} title="Edit Role & Status"><UserCog className="h-4 w-4" /></Button>
                      <AlertDialog open={userToDelete?.uid === user.uid} onOpenChange={(isOpen) => { if (!isOpen) setUserToDelete(null);}}>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => openDeleteDialog(user)} disabled={user.uid === adminUser?.uid || isSubmitting} title="Delete User"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete User?</AlertDialogTitle><AlertDialogDescription>This will delete the user's Firestore record. Their auth account must be deleted separately from the Firebase Console. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteUser} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredUsers.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {filteredUsers.length} of {users.length} users.</p></CardFooter>}
      </Card>

      <Dialog open={isEditUserOpen} onOpenChange={(isOpen) => { setIsEditUserOpen(isOpen); if (!isOpen) setUserToEdit(null);}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Edit User</DialogTitle><DialogDescription>Change details for {userToEdit?.displayName || userToEdit?.email || '-'}.</DialogDescription></DialogHeader>
          {userToEdit && (
            <Form {...editUserForm}>
              <form onSubmit={editUserForm.handleSubmit(handleEditUser)} className="space-y-4 py-4">
                  <FormField control={editUserForm.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value as string | undefined}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{allManageableRoles.filter(r => r !== null).map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  {userToEdit.status !== 'rejected' && (
                     <FormField control={editUserForm.control} name="disabled" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5"><FormLabel>Account Disabled</FormLabel><p className="text-xs text-muted-foreground">Disabling the account will prevent the user from logging in.</p></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>)} />
                  )}
                  {userToEdit.status === 'rejected' && (
                     <Card className="bg-amber-50 border-amber-200 p-3 text-amber-800">
                        <p className="text-sm font-semibold">This user was rejected.</p>
                        <p className="text-xs">Rejection Reason: {userToEdit.rejectionReason || 'N/A'}</p>
                        <Button type="button" size="sm" onClick={handleReinstateUser} className="mt-2 w-full" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Approve & Enable User
                        </Button>
                    </Card>
                  )}
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsEditUserOpen(false); setUserToEdit(null); }}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting || userToEdit.status === 'rejected'}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                  </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
