
"use client";

import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Task, Order, OrderItem as OrderItemType, Product, ProductCustomizationOption, CustomizationGroupDefinition, User as AppUser, UserRole, DeliveryHistoryEntry, OrderStatus } from "@/types";
import { Filter, Loader2, Wrench, CheckCircle, AlertTriangle, Eye, Image as ImageIconPlaceholder, Palette, UserCog, Upload, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDoc, orderBy, getDocs, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import Image from 'next/image';
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const getStatusBadgeVariant = (status: Task['status']): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusYellow';
    case 'in-progress': return 'statusBlue';
    case 'completed': return 'statusGreen';
    case 'needs_approval':
    case 'blocked':
      return 'statusAmber';
    case 'rejected':
      return 'statusRed';
    default: return 'outline';
  }
};

interface ResolvedOptionDetails {
  label: string;
  value: string;
  isColor?: boolean;
  colorHex?: string;
}

const technicianRoles: UserRole[] = ['Engraving', 'Printing', 'Assembly', 'Quality Check', 'Packaging'];

export default function TasksPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingModalDetails, setIsLoadingModalDetails] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [modalOrderItem, setModalOrderItem] = useState<OrderItemType | null>(null);
  const [modalCustomizationOptions, setModalCustomizationOptions] = useState<ProductCustomizationOption[]>([]);
  
  const [technicians, setTechnicians] = useState<AppUser[]>([]);
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | undefined>(undefined);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [uploadState, setUploadState] = useState<{ progress: number; error?: string; uploading: boolean; url?: string }>({ progress: 0, uploading: false });
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");


  const fetchTechnicians = useCallback(async () => {
    if (!db || (role !== 'ServiceManager' && role !== 'Admin')) {
      setIsLoadingTechnicians(false);
      return;
    }
    setIsLoadingTechnicians(true);
    try {
      const techQuery = query(collection(db, 'users'), where("role", "in", technicianRoles), where("disabled", "!=", true));
      const techSnapshot = await getDocs(techQuery);
      const fetchedTechs: AppUser[] = [];
      techSnapshot.forEach(docUser => fetchedTechs.push({ uid: docUser.id, ...docUser.data() } as AppUser));
      setTechnicians(fetchedTechs);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      toast({ title: "Error", description: "Could not load technicians.", variant: "destructive" });
    } finally {
      setIsLoadingTechnicians(false);
    }
  }, [db, role, toast]);

  useEffect(() => {
    if (role === 'ServiceManager' || role === 'Admin') {
      fetchTechnicians();
    }
  }, [role, fetchTechnicians]);


  const fetchTasks = useCallback(() => {
    if (!user || !db || (role && !technicianRoles.includes(role) && role !== 'ServiceManager' && role !== 'Admin')) {
      setIsLoading(false);
      return () => {}; 
    }
    setIsLoading(true);
    
    let q;
    const baseQueryConstraints = [
      orderBy("createdAt", "desc")
    ];

    let statusFilters: Task['status'][];
    if (filter === 'active') statusFilters = ['pending', 'in-progress', 'needs_approval', 'blocked'];
    else if (filter === 'completed') statusFilters = ['completed', 'rejected'];
    else statusFilters = ['pending', 'in-progress', 'completed', 'needs_approval', 'blocked', 'rejected']; // 'all'

    if (role && technicianRoles.includes(role)) {
      q = query(
        collection(db, 'tasks'), 
        where('assigneeId', '==', user.uid),
        where('status', 'in', statusFilters),
        ...baseQueryConstraints
      );
    } else { // ServiceManager or Admin viewing tasks
        q = query(collection(db, 'tasks'), where('status', 'in', statusFilters), ...baseQueryConstraints);
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedTasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        fetchedTasks.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(fetchedTasks);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching tasks: ", error);
      toast({ title: "Error", description: "Could not fetch tasks.", variant: "destructive" });
    });
    return unsubscribe;
  }, [user, db, role, toast, filter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (role && !technicianRoles.includes(role) && role !== 'ServiceManager' && role !== 'Admin')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchTasks();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchTasks]);
  
  const handleStatusChange = async (taskId: string, newStatus: Task['status'], newOrderStatus?: OrderStatus) => {
    if (!db || !selectedTask || !user) return;
    setIsUpdating(true);
    try {
        const taskRef = doc(db, 'tasks', taskId);
        const orderRef = doc(db, 'orders', selectedTask.orderId!);

        const taskUpdatePayload: any = { status: newStatus, updatedAt: serverTimestamp() };
        await updateDoc(taskRef, taskUpdatePayload);
        
        let orderUpdatePayload: any = {};
        if (newOrderStatus) {
            orderUpdatePayload.status = newOrderStatus;
            const historyNote = `Order status updated to ${newOrderStatus.replace(/_/g, ' ')} as task '${selectedTask.taskType}' moved to '${newStatus}'.`;
            const newHistoryEntry: DeliveryHistoryEntry = {
                status: newOrderStatus,
                timestamp: serverTimestamp(),
                notes: historyNote,
                actorId: user.uid,
            };
            orderUpdatePayload.deliveryHistory = arrayUnion(newHistoryEntry);
            orderUpdatePayload.updatedAt = serverTimestamp();
            await updateDoc(orderRef, orderUpdatePayload);
        }

        // Local state update
        setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
        toast({ title: "Task Updated", description: `Task status changed to ${newStatus.replace(/_/g, ' ')}.` });
        
        // This was causing the modal to stay open if it was a final step
        if (newStatus !== 'in-progress') {
          setIsModalOpen(false);
        }
        
    } catch (error) {
        console.error("Error updating task status: ", error);
        toast({ title: "Error", description: "Could not update task status.", variant: "destructive" });
    } finally {
        setIsUpdating(false);
    }
  };


  const handleAssigneeChange = async () => {
    if (!db || !selectedTask || !selectedAssigneeId) {
        toast({ title: "Error", description: "No task or assignee selected.", variant: "destructive" });
        return;
    }
    const technicianToAssign = technicians.find(t => t.uid === selectedAssigneeId);
    if (!technicianToAssign) {
        toast({ title: "Error", description: "Selected technician not found.", variant: "destructive" });
        return;
    }
    setIsUpdating(true);
    try {
        const taskRef = doc(db, 'tasks', selectedTask.id);
        await updateDoc(taskRef, {
            assigneeId: technicianToAssign.uid,
            assigneeName: technicianToAssign.displayName || technicianToAssign.email,
            updatedAt: serverTimestamp()
        });
        if (selectedTask) {
            setSelectedTask(prev => prev ? { ...prev, assigneeId: technicianToAssign.uid, assigneeName: technicianToAssign.displayName || technicianToAssign.email } : null);
        }
        toast({ title: "Assignee Updated", description: "Task has been reassigned." });
    } catch (error) {
        console.error("Error updating assignee:", error);
    } finally {
        setIsUpdating(false);
    }
  };

  const fetchModalDetails = async (task: Task) => {
    if (!task.orderId || !task.itemName || !db) {
      setModalOrder(null);
      setModalOrderItem(null);
      setModalCustomizationOptions([]);
      setIsLoadingModalDetails(false);
      return;
    }
    setIsLoadingModalDetails(true);
    try {
      const orderDocRef = doc(db, 'orders', task.orderId);
      const orderDoc = await getDoc(orderDocRef);
      if (orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
        setModalOrder(orderData);
        const item = orderData.items.find(i => i.name === task.itemName); 
        setModalOrderItem(item || null);

        if (item && item.customizations && Object.keys(item.customizations).length > 0) {
          const productDocRef = doc(db, 'products', item.productId);
          const productDoc = await getDoc(productDocRef);
          if (productDoc.exists()) {
            const productData = productDoc.data() as Product;
            let optionsToUse: ProductCustomizationOption[] = productData.customizationOptions || [];
            if (productData.customizationGroupId) {
              const groupDocRef = doc(db, 'customizationGroupDefinitions', productData.customizationGroupId);
              const groupDoc = await getDoc(groupDocRef);
              if (groupDoc.exists()) {
                optionsToUse = (groupDoc.data() as CustomizationGroupDefinition).options || [];
              }
            }
            setModalCustomizationOptions(optionsToUse);
          }
        } else {
          setModalCustomizationOptions([]);
        }
      } else {
        setModalOrder(null); setModalOrderItem(null); setModalCustomizationOptions([]);
      }
    } catch (e) {
      console.error("Error fetching modal details:", e);
    } finally {
      setIsLoadingModalDetails(false);
    }
  };

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setSelectedAssigneeId(task.assigneeId || undefined);
    setUploadState({ progress: 0, uploading: false, url: task.proofOfWorkUrl || undefined });
    setIsModalOpen(true);
    fetchModalDetails(task);
  };
  
  const handleProofUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      setUploadState(prev => ({ ...prev, error: "Upload service not configured.", uploading: false }));
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadState({ progress: 0, error: undefined, uploading: true, url: undefined });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
      if (!response.ok) { throw new Error((await response.json()).error?.message || 'Upload failed'); }
      const data = await response.json();
      setUploadState({ progress: 100, uploading: false, url: data.secure_url });
    } catch (err: any) {
      setUploadState({ progress: 0, uploading: false, error: err.message, url: undefined });
    }
  };

  const handleSubmitForApproval = async () => {
    if (!db || !selectedTask || !uploadState.url || !user) {
      return;
    }
    setIsUpdating(true);
    try {
      const taskRef = doc(db, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        status: 'needs_approval',
        proofOfWorkUrl: uploadState.url,
        updatedAt: serverTimestamp(),
      });
      
      const orderRef = doc(db, 'orders', selectedTask.orderId!);
      const historyEntry: DeliveryHistoryEntry = {
          status: 'awaiting_customer_approval',
          timestamp: serverTimestamp(),
          notes: `Proof of work for task '${selectedTask.taskType}' submitted by technician. Awaiting customer review.`,
          actorId: user.uid
      };
      await updateDoc(orderRef, {
          status: 'awaiting_customer_approval',
          deliveryHistory: arrayUnion(historyEntry),
          updatedAt: serverTimestamp(),
      });

      toast({ title: "Submitted for Review", description: "Your work has been submitted for customer and manager approval." });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error submitting for approval:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectionSubmit = async () => {
    if (!db || !selectedTask || !rejectionReason.trim() || !user) {
      return;
    }
    setIsUpdating(true);
    try {
      const taskRef = doc(db, 'tasks', selectedTask.id);
      await updateDoc(taskRef, {
        status: 'rejected',
        serviceManagerNotes: `Rejected by ${user.displayName}: ${rejectionReason}`,
        updatedAt: serverTimestamp(),
      });
      setIsRejectionModalOpen(false);
      setIsModalOpen(false);
      toast({title: "Task Rejected", description: "The task has been marked as rejected."});
    } catch (error) {
      console.error("Error rejecting task:", error);
    } finally {
        setIsUpdating(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'PPp');
  };
  
  const getDisplayableCustomizationValue = (
    optionId: string, 
    selectedValue: any, 
    optionsDefinitions?: ProductCustomizationOption[]
  ): ResolvedOptionDetails => {
    const optionDef = optionsDefinitions?.find(opt => opt.id === optionId);
    if (!optionDef) return { label: optionId, value: String(selectedValue) };
    let displayValue = String(selectedValue);
    let isColor = false;
    let colorHex: string | undefined = undefined;
    switch (optionDef.type) {
      case 'dropdown': displayValue = optionDef.choices?.find(c => c.value === selectedValue)?.label || String(selectedValue); break;
      case 'color_picker': const colorChoice = optionDef.choices?.find(c => c.value === selectedValue); displayValue = colorChoice?.label || String(selectedValue); isColor = true; colorHex = colorChoice?.value; break;
      case 'image_upload': displayValue = selectedValue ? "Uploaded Image" : "No image"; break;
      case 'checkbox': displayValue = selectedValue ? (optionDef.checkboxLabel || 'Selected') : 'Not selected'; break;
      default: displayValue = String(selectedValue);
    }
    return { label: optionDef.label, value: displayValue, isColor, colorHex };
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (role && !technicianRoles.includes(role) && role !== 'ServiceManager' && role !== 'Admin') {
     return <div className="text-center py-10">Access denied.</div>;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h1 className="text-3xl font-headline font-semibold">
            {role && technicianRoles.includes(role) ? "My Tasks" : (role === 'ServiceManager' ? "Manage Production Tasks" : "All Production Tasks (Admin)")}
          </h1>
           <div className="flex gap-2">
              <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
                  <SelectTrigger className="w-[180px] h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Filter status" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="active">Active Tasks</SelectItem>
                      <SelectItem value="completed">Completed & Rejected</SelectItem>
                      <SelectItem value="all">All Tasks</SelectItem>
                  </SelectContent>
              </Select>
          </div>
        </div>

        {tasks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No tasks found for the current filter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => (
              <Card key={task.id} className="flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2 pt-4">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-md sm:text-lg font-semibold font-headline capitalize line-clamp-2">{task.taskType}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(task.status)} className="capitalize text-xs whitespace-nowrap">{task.status.replace(/_/g, ' ')}</Badge>
                  </div>
                   <CardDescription className="text-xs pt-0.5 line-clamp-1">
                      For Item: {task.itemName || 'N/A'}
                  </CardDescription>
                  <CardDescription className="text-xs pt-0 line-clamp-1">
                      Order: {task.orderId ? task.orderId.substring(0,8)+'...' : 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-1.5 text-sm py-2">
                  {(role === 'ServiceManager' || role === 'Admin') && <p className="text-xs text-muted-foreground">Assigned: {task.assigneeName || 'Unassigned'}</p>}
                  <p className="text-xs text-muted-foreground">Created: {formatDate(task.createdAt)}</p>
                </CardContent>
                <CardFooter className="pt-2 pb-3 border-t flex justify-end items-center gap-2">
                   <Button variant="outline" size="sm" onClick={() => openTaskModal(task)}>
                      <Eye className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> Details
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={(open) => { if(!open) setSelectedTask(null); setIsModalOpen(open); }}>
        <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl">{selectedTask?.taskType || "Task Details"}</DialogTitle>
            <DialogDescription>Item: {selectedTask?.itemName || "N/A"} (Qty: {modalOrderItem?.quantity || '...'}) | Order: {selectedTask?.orderId ? selectedTask.orderId.substring(0,10)+'...' : 'N/A'}</DialogDescription>
          </DialogHeader>
          {isLoadingModalDetails ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div> : (
          <ScrollArea className="max-h-[calc(100vh-22rem)] md:max-h-[calc(70vh-10rem)] pr-3"><div className="space-y-4 py-2">
              <div><p className="text-sm font-medium">Status:</p> <Badge variant={getStatusBadgeVariant(selectedTask?.status || 'pending')} className="capitalize">{selectedTask?.status.replace(/_/g, ' ')}</Badge></div>
              <div><p className="text-sm font-medium">Created:</p><p className="text-sm text-muted-foreground">{formatDate(selectedTask?.createdAt)}</p></div>
              {(role === 'ServiceManager' || role === 'Admin') && (<div className="pt-2 space-y-2">
                  <Label htmlFor="assigneeSelect">Assigned Technician:</Label>
                  {selectedTask && (selectedTask.status === 'completed' || selectedTask.status === 'rejected') ? <Input value={selectedTask.assigneeName || "N/A"} disabled className="h-9 text-sm" /> : (<div className="flex gap-2 items-center">
                      <Select value={selectedAssigneeId || ""} onValueChange={setSelectedAssigneeId} disabled={isLoadingTechnicians || isUpdating}><SelectTrigger id="assigneeSelect" className="flex-grow h-9 text-xs sm:text-sm"><SelectValue placeholder="Select Technician" /></SelectTrigger><SelectContent>{isLoadingTechnicians && <SelectItem value="loading" disabled>Loading...</SelectItem>}{technicians.length === 0 && !isLoadingTechnicians && <SelectItem value="no-techs" disabled>No technicians available</SelectItem>}{technicians.map(tech => <SelectItem key={tech.uid} value={tech.uid}>{tech.displayName || tech.email}</SelectItem>)}</SelectContent></Select>
                      <Button size="sm" onClick={handleAssigneeChange} disabled={isLoadingTechnicians || isUpdating || !selectedAssigneeId || selectedAssigneeId === selectedTask?.assigneeId} className="h-9">{isUpdating && <Loader2 className="mr-1 h-4 w-4 animate-spin"/>} Update</Button>
                  </div>)}
              </div>)}
              {role && technicianRoles.includes(role) && selectedTask?.assigneeName && <div><p className="text-sm font-medium">Assigned To:</p><p className="text-sm text-muted-foreground">{selectedTask.assigneeName}</p></div>}
              {selectedTask?.proofOfWorkUrl && (<div className="pt-3"><h4 className="text-md font-semibold mb-2 border-t pt-3">Proof of Work:</h4><div className="relative w-full aspect-video bg-muted rounded-md overflow-hidden"><Image src={selectedTask.proofOfWorkUrl} alt="Proof of work" layout="fill" objectFit="contain" /></div></div>)}
              {selectedTask?.serviceManagerNotes && (<div className="pt-3"><h4 className="text-md font-semibold mb-1 border-t pt-3 text-destructive">Rejection Reason:</h4><p className="text-sm text-muted-foreground whitespace-pre-line">{selectedTask.serviceManagerNotes}</p></div>)}
              {modalOrderItem && modalOrderItem.customizations && Object.keys(modalOrderItem.customizations).length > 0 && (<div className="pt-3"><h4 className="text-md font-semibold mb-2 border-t pt-3">Customization Details:</h4><div className="space-y-1.5 text-sm">{Object.entries(modalOrderItem.customizations).map(([optionId, selectedValue]) => { const details = getDisplayableCustomizationValue(optionId, selectedValue, modalCustomizationOptions); return (<div key={optionId} className="flex flex-col sm:flex-row sm:items-start sm:gap-2 border-b pb-1.5 last:border-b-0">
                  <span className="font-medium sm:w-1/3 shrink-0">{details.label}:</span><div className="flex items-center gap-1.5 mt-0.5 sm:mt-0 flex-wrap break-words min-w-0">{details.isColor && details.colorHex && (<span style={{ backgroundColor: details.colorHex }} className="inline-block w-4 h-4 rounded-sm border border-muted-foreground mr-1.5 shrink-0"></span>)}{optionId.toLowerCase().includes('image') || (typeof selectedValue === 'string' && selectedValue.includes('res.cloudinary.com')) ? (<div className="mt-1 sm:mt-0">{selectedValue && typeof selectedValue === 'string' ? (<a href={selectedValue} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs"><Image src={selectedValue} alt="Customized image" width={150} height={150} className="rounded-md border max-w-full h-auto max-h-40 object-contain bg-muted" data-ai-hint="customization image"/></a>) : <span className="text-muted-foreground italic text-xs">No image provided.</span> }</div>) : (<span className="text-muted-foreground">{details.value}</span>)}</div></div>); })}</div></div>)}
               {modalOrder?.customerNotes && (<div className="pt-3"><h4 className="text-md font-semibold mb-1 border-t pt-3">General Order Notes from Customer:</h4><p className="text-sm text-muted-foreground whitespace-pre-line break-words">{modalOrder.customerNotes}</p></div>)}
          </div></ScrollArea>)}
          <DialogFooter className="pt-4 border-t flex-col sm:flex-row sm:justify-between gap-2">
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Close</Button></DialogClose>
             <div className="flex flex-wrap gap-2 justify-end">
                {selectedTask && role && technicianRoles.includes(role) && selectedTask.status === 'pending' && (<Button size="sm" onClick={() => handleStatusChange(selectedTask.id, 'in-progress', 'in_production')} disabled={isUpdating}><Wrench className="mr-2 h-4 w-4" /> Start Task</Button>)}
                {selectedTask && role && technicianRoles.includes(role) && selectedTask.status === 'in-progress' && (<div className="w-full space-y-2">
                    <Separator/>
                    <Label htmlFor="proofUpload">Upload Proof & Submit for Approval</Label>
                    <Input id="proofUpload" type="file" onChange={handleProofUpload} disabled={uploadState.uploading || isUpdating}/>
                    {uploadState.error && <p className="text-xs text-destructive">{uploadState.error}</p>}
                    <Button size="sm" onClick={handleSubmitForApproval} disabled={!uploadState.url || uploadState.uploading || isUpdating} className="w-full">{uploadState.uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Uploading...</> : <><CheckCircle className="mr-2 h-4 w-4"/> Submit for Approval</>}
                    </Button>
                </div>)}
                {selectedTask && (role === 'ServiceManager' || role === 'Admin') && selectedTask.status === 'needs_approval' && (<>
                    <Button size="sm" variant="destructive" onClick={() => setIsRejectionModalOpen(true)} disabled={isUpdating}><XCircle className="mr-2 h-4 w-4"/> Reject</Button>
                    <Button size="sm" onClick={() => handleStatusChange(selectedTask.id, 'completed', 'awaiting_quality_check')} disabled={isUpdating}><CheckCircle className="mr-2 h-4 w-4"/> Approve</Button>
                </>)}
             </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isRejectionModalOpen} onOpenChange={setIsRejectionModalOpen}>
        <DialogContent><DialogHeader><DialogTitle>Reject Task</DialogTitle><DialogDescription>Provide a reason for rejecting the proof of work. This will be visible to the technician.</DialogDescription></DialogHeader>
          <div className="py-2"><Textarea placeholder="e.g., Image is blurry, customization is incorrect..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /></div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="button" variant="destructive" onClick={handleRejectionSubmit} disabled={!rejectionReason.trim() || isUpdating}>Confirm Rejection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
