
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, Eye, EyeOff, UserCheck, UserX, Search, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { User, UserRole, UserStatus } from '@/types';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

import { createUserWithEmailAndPassword, updateProfile as updateAuthProfile } from 'firebase/auth';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const employeeRoles: Exclude<UserRole, 'Admin' | 'Customer' | null>[] = [
  'Technician', 'Rider', 'Supplier', 
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

const getStatusBadgeVariant = (status?: UserStatus): BadgeProps['variant'] => {
    switch (status) {
      case 'approved': return 'statusGreen';
      case 'pending': return 'statusYellow';
      case 'rejected': return 'statusRed';
      default: return 'outline';
    }
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
  const [userToAction, setUserToAction] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDefaultPassword, setShowDefaultPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
      setUsers(usersList.sort((a,b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0)));
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
    if (!searchTerm) return users;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return users.filter(user =>
      (user.displayName?.toLowerCase() || "").includes(lowerSearchTerm) ||
      (user.email?.toLowerCase() || "").includes(lowerSearchTerm) ||
      (user.firstName?.toLowerCase() || "").includes(lowerSearchTerm) ||
      (user.lastName?.toLowerCase() || "").includes(lowerSearchTerm) ||
      (user.role?.toLowerCase() || "").includes(lowerSearchTerm)
    );
  }, [users, searchTerm]);

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
        status: 'approved', // Staff created by admin are auto-approved
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
      await updateDoc(doc(db, 'users', userToEdit.uid), { 
        role: values.role,
        disabled: values.disabled,
      });
      toast({ title: "User Updated", description: `${userToEdit.displayName || userToEdit.email}'s details updated.` });
      setIsEditUserOpen(false); setUserToEdit(null); fetchUsers();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message || "Could not update user.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenActionModal = (user: User, type: 'approve' | 'reject') => {
    setUserToAction(user);
    setActionType(type);
    setIsActionModalOpen(true);
    setRejectionReason("");
  };

  const handleConfirmAction = async () => {
    if (!db || !userToAction || !actionType) return;
    if (actionType === 'reject' && !rejectionReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const newStatus: UserStatus = actionType === 'approve' ? 'approved' : 'rejected';
    try {
      await updateDoc(doc(db, 'users', userToAction.uid), {
        status: newStatus,
        rejectionReason: actionType === 'reject' ? rejectionReason : null,
      });
      toast({ title: `User ${newStatus}`, description: `User ${userToAction.displayName || userToAction.email} has been ${newStatus}.` });
      setIsActionModalOpen(false); setUserToAction(null); fetchUsers();
    } catch (e: any) {
      toast({ title: "Action Failed", description: `Could not ${actionType} user.`, variant: "destructive" });
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
                <FormField control={createUserForm.control} name="role" render={({ field }) => (<FormItem><Label>Role</Label><Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{employeeRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
           <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users (Name, Email, Role)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredUsers.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : filteredUsers.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{users.length === 0 ? "No users found." : "No users match your search criteria."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.uid} className={user.disabled ? "opacity-60" : ""}>
                    <TableCell className={`font-medium ${user.disabled ? 'line-through' : ''}`}>{formatDisplayName(user)}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.role || '-'}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(user.status)} className="capitalize">{user.status || 'N/A'}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      {user.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="icon" title="Approve" onClick={() => handleOpenActionModal(user, 'approve')}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                          <Button variant="ghost" size="icon" title="Reject" onClick={() => handleOpenActionModal(user, 'reject')}><XCircle className="h-4 w-4 text-red-600" /></Button>
                        </>
                      )}
                      {user.status !== 'pending' && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(user)} title="Edit Role & Status"><Edit className="h-4 w-4" /></Button>
                          <AlertDialog open={userToDelete?.uid === user.uid} onOpenChange={(isOpen) => { if (!isOpen) setUserToDelete(null);}}>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => openDeleteDialog(user)} disabled={user.uid === adminUser?.uid || isSubmitting} title="Delete User"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete User?</AlertDialogTitle><AlertDialogDescription>This will delete the user's Firestore record. Their auth account will remain. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteUser} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
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
                  <FormField control={editUserForm.control} name="role" render={({ field }) => (<FormItem><Label>Role</Label><Select onValueChange={field.onChange} defaultValue={field.value as string | undefined}><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger><SelectContent>{([...employeeRoles, 'Admin', 'Customer'] as UserRole[]).filter(r => r !== null).map(r => <SelectItem key={r} value={r!}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={editUserForm.control} name="disabled" render={({ field }) => (<div className="flex items-center space-x-2 pt-2"><FormControl><Input type="checkbox" id="edit-disabled" checked={field.value || false} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4"/></FormControl><Label htmlFor="edit-disabled" className="font-normal">Account Disabled</Label></div>)} />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsEditUserOpen(false); setUserToEdit(null); }}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                  </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="capitalize">{actionType} User</DialogTitle><DialogDescription>You are about to {actionType} the user: {userToAction?.displayName}</DialogDescription></DialogHeader>
          {actionType === 'reject' && (
            <div className="py-2 space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea id="rejection-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Provide a brief reason for rejection..." />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="button" onClick={handleConfirmAction} disabled={isSubmitting} variant={actionType === 'reject' ? 'destructive' : 'default'}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Confirm {actionType}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
