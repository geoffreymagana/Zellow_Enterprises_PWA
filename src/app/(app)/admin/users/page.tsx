
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Eye, EyeOff, UserCheck, UserX } from 'lucide-react';
import type { User, UserRole } from '@/types';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";

import { createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const employeeRoles: Exclude<UserRole, 'Admin' | 'Customer' | null>[] = [
  'Technician', 'Rider', 'Supplier', 'SupplyManager', 
  'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'
];

const createUserFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(employeeRoles, { required_error: "Role is required" }),
});
type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

const editUserFormSchema = z.object({
  role: z.enum([...employeeRoles, 'Admin', 'Customer'] as [string, ...string[]], { required_error: "Role is required" }), 
  disabled: z.boolean().optional(),
});
type EditUserFormValues = z.infer<typeof editUserFormSchema>;


export default function AdminUsersPage() {
  const { user: adminUser, role: adminRole, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  

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
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
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

  const checkEmailExists = async (email: string): Promise<boolean> => {
    if (!db) return true; 
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  const handleCreateUser = async (values: CreateUserFormValues) => {
    if (!auth || !db) {
      toast({ title: "Error", description: "Firebase services not available.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const { firstName, lastName, role } = values;
    let email = `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}@admin.com`;
    let emailIsTaken = await checkEmailExists(email);

    if (emailIsTaken) {
      email = `${lastName.toLowerCase().replace(/\s+/g, '')}.${firstName.toLowerCase().replace(/\s+/g, '')}@admin.com`;
      emailIsTaken = await checkEmailExists(email);
      if (emailIsTaken) {
        let attempt = 1;
        const baseEmailPartOne = `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}`;
        do {
            email = `${baseEmailPartOne}${attempt}@admin.com`;
            emailIsTaken = await checkEmailExists(email);
            attempt++;
        } while (emailIsTaken && attempt < 10); 

        if (emailIsTaken) {
            toast({ title: "Error", description: "Could not generate a unique email. Please try different names or manual creation via Firebase console.", variant: "destructive", duration: 7000 });
            setIsLoading(false);
            return;
        }
      }
    }


    const defaultPassword = "12345678"; 
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, defaultPassword);
      const newUser = userCredential.user;
      const displayName = `${firstName} ${lastName}`;

      await updateAuthProfile(newUser, { displayName });

      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        email,
        firstName,
        lastName,
        displayName,
        role,
        createdAt: serverTimestamp(),
        disabled: false, 
      });

      toast({ title: "User Created", description: `${displayName} (${email}) created. Default password: ${defaultPassword}`, duration: 7000 });
      setIsCreateUserOpen(false);
      createUserForm.reset();
      fetchUsers(); 

    } catch (error: any) {
      console.error("Failed to create user:", error);
      toast({ title: "Creation Failed", description: error.message || "Could not create user.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const openEditModal = (user: User) => {
    setUserToEdit(user);
    editUserForm.reset({ role: user.role || undefined, disabled: user.disabled || false }); 
    setIsEditUserOpen(true);
  };

  const handleEditUser = async (values: EditUserFormValues) => {
    if (!db || !userToEdit) return;
    setIsLoading(true);
    try {
      const userDocRef = doc(db, 'users', userToEdit.uid);
      await updateDoc(userDocRef, { 
        role: values.role,
        disabled: values.disabled,
      });
      toast({ title: "User Updated", description: `${userToEdit.displayName || userToEdit.email}'s details updated.` });
      setIsEditUserOpen(false);
      setUserToEdit(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to update user:", error);
      toast({ title: "Update Failed", description: error.message || "Could not update user.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleUserDisabledStatus = async (user: User) => {
    if (!db || !user || !adminUser) return;
    if (user.uid === adminUser.uid) {
        toast({ title: "Action Denied", description: "You cannot disable your own account.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const newDisabledStatus = !user.disabled;
        await updateDoc(userDocRef, { disabled: newDisabledStatus });
        toast({ 
            title: `User ${newDisabledStatus ? 'Disabled' : 'Enabled'}`, 
            description: `${user.displayName || user.email} has been ${newDisabledStatus ? 'disabled' : 'enabled'}.` 
        });
        fetchUsers(); 
    } catch (error: any) {
        console.error("Failed to toggle user disabled status:", error);
        toast({ title: "Update Failed", description: error.message || "Could not update user status.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };


  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
  };
  
  const handleDeleteUser = async () => {
    if (!db || !userToDelete || !adminUser) return;
    if (userToDelete.uid === adminUser.uid) {
      toast({ title: "Action Denied", description: "You cannot delete your own account.", variant: "destructive" });
      setUserToDelete(null);
      return;
    }
    setIsLoading(true);
    try {
      const userDocRef = doc(db, 'users', userToDelete.uid);
      await deleteDoc(userDocRef);
      toast({ title: "User Record Deleted", description: `User ${userToDelete.displayName || userToDelete.email}'s record removed from Firestore. Their auth account still exists.` });
      setUserToDelete(null); 
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user record:", error);
      toast({ title: "Deletion Failed", description: error.message || "Could not delete user record.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDisplayName = (user: User) => {
    const name = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || '-';
  };


  if (authLoading || (!adminUser && !authLoading)) { 
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!adminUser || adminRole !== 'Admin') { 
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Unauthorized or session changed.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">User Management</h1>
        <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateUserOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Employee</DialogTitle>
              <DialogDescription>
                Fill in the details to create a new employee account. Email will be auto-generated.
                Default password: 
                <Button variant="ghost" size="sm" onClick={() => setShowDefaultPassword(!showDefaultPassword)} className="ml-1 p-1 h-auto align-middle">
                  {showDefaultPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                {showDefaultPassword && <span className="text-xs font-mono"> (12345678)</span>}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="space-y-4 py-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...createUserForm.register("firstName")} />
                {createUserForm.formState.errors.firstName && <p className="text-sm text-destructive mt-1">{createUserForm.formState.errors.firstName.message}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...createUserForm.register("lastName")} />
                {createUserForm.formState.errors.lastName && <p className="text-sm text-destructive mt-1">{createUserForm.formState.errors.lastName.message}</p>}
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Controller
                  control={createUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeeRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {createUserForm.formState.errors.role && <p className="text-sm text-destructive mt-1">{createUserForm.formState.errors.role.message}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-muted-foreground">View, add, edit, and manage user accounts and their roles within the system.</p>

      <Card>
        <CardContent className="p-0">
          {isLoading && users.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : users.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No users found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.uid} className={user.disabled ? "opacity-60" : ""}>
                    <TableCell className={`font-medium ${user.disabled ? 'line-through' : ''}`}>{formatDisplayName(user)}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.role || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.disabled ? "destructive" : "default"}>
                        {user.disabled ? "Disabled" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => toggleUserDisabledStatus(user)} 
                        disabled={user.uid === adminUser?.uid || isLoading}
                        aria-label={user.disabled ? "Enable User" : "Disable User"}
                        title={user.disabled ? "Enable User" : "Disable User"}
                      >
                        {user.disabled ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-orange-600" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditModal(user)} aria-label="Edit User" title="Edit User Role & Status">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog
                        open={userToDelete?.uid === user.uid}
                        onOpenChange={(isOpen) => {
                          if (!isOpen && userToDelete?.uid === user.uid) {
                            setUserToDelete(null);
                          }
                        }}
                      >
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(user)} disabled={user.uid === adminUser?.uid || isLoading} aria-label="Delete User Record" title="Delete User Record">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will remove user '{formatDisplayName(userToDelete || {} as User)}' from the Firestore database.
                              Their Firebase Authentication account will NOT be deleted. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteUser} disabled={isLoading} className="bg-destructive hover:bg-destructive/90">
                              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete User Record
                            </AlertDialogAction>
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
        {users.length > 0 && <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {users.length} users.</p></CardFooter>}
      </Card>

      <Dialog open={isEditUserOpen} onOpenChange={(isOpen) => {
        setIsEditUserOpen(isOpen);
        if (!isOpen) setUserToEdit(null);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Change details for {userToEdit?.displayName || userToEdit?.email || '-'}.
            </DialogDescription>
          </DialogHeader>
          {userToEdit && (
            <form onSubmit={editUserForm.handleSubmit(handleEditUser)} className="space-y-4 py-4">
               <div>
                <Label>User</Label>
                <Input disabled value={formatDisplayName(userToEdit)} />
              </div>
              <div>
                <Label htmlFor="edit-role">Role</Label>
                <Controller
                  control={editUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value as string | undefined}>
                      <SelectTrigger id="edit-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {([...employeeRoles, 'Admin', 'Customer'] as UserRole[]).filter(r => r !== null).map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
                {editUserForm.formState.errors.role && <p className="text-sm text-destructive mt-1">{editUserForm.formState.errors.role.message}</p>}
              </div>
              <div>
                <Controller
                    control={editUserForm.control}
                    name="disabled"
                    render={({ field }) => (
                        <div className="flex items-center space-x-2 mt-2">
                            <input
                                type="checkbox"
                                id="edit-disabled"
                                checked={field.value || false}
                                onChange={(e) => field.onChange(e.target.checked)}
                                className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                            />
                            <Label htmlFor="edit-disabled" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Account Disabled
                            </Label>
                        </div>
                    )}
                />
                {editUserForm.formState.errors.disabled && <p className="text-sm text-destructive mt-1">{editUserForm.formState.errors.disabled.message}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsEditUserOpen(false); setUserToEdit(null); }}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
