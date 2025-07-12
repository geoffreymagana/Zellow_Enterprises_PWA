
"use client";

import React from 'react'; // Added this line to fix the error
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Save, AlertTriangle, Package, User, Settings2, Truck, CreditCard, GiftIcon, PlusCircle, Edit, Users, Image as ImageIconPlaceholder, Palette } from 'lucide-react';
import type { Order, OrderStatus, Task, User as AppUser, DeliveryHistoryEntry, OrderItem as OrderItemType, PaymentStatus, Product, CustomizationGroupDefinition, ProductCustomizationOption } from '@/types';
import { Badge, BadgeProps } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from 'date-fns';

const taskFormSchema = z.object({
  taskType: z.string().min(1, "Task type is required"),
  description: z.string().min(1, "Description is required"),
  assigneeId: z.string().min(1, "Assignee is required"),
});
type TaskFormValues = z.infer<typeof taskFormSchema>;

const orderStatusFormSchema = z.object({
  status: z.string().min(1, "Status is required"),
});
type OrderStatusFormValues = z.infer<typeof orderStatusFormSchema>;

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const predefinedTaskTypes = ["Engraving", "Printing", "Assembly", "Quality Check", "Packaging"];
const allOrderStatuses: OrderStatus[] = ['pending', 'processing', 'awaiting_assignment', 'assigned', 'out_for_delivery', 'shipped', 'delivered', 'delivery_attempted', 'cancelled'];

const getOrderStatusBadgeVariant = (status: OrderStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusYellow';
    case 'processing': return 'statusAmber';
    case 'awaiting_assignment': return 'statusOrange';
    case 'assigned': return 'statusOrderAssigned';
    case 'out_for_delivery': return 'statusBlue';
    case 'shipped': return 'statusIndigo';
    case 'delivered': return 'statusGreen';
    case 'delivery_attempted': return 'statusPurple';
    case 'cancelled': return 'statusRed';
    default: return 'outline';
  }
};

const getPaymentStatusBadgeVariant = (status: PaymentStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusAmber';
    case 'paid': return 'statusGreen';
    case 'failed': return 'statusRed';
    case 'refunded': return 'statusGrey';
    default: return 'outline';
  }
};

interface ResolvedOptionDetails {
  label: string;
  value: string;
  isColor?: boolean;
  colorHex?: string;
  isImage?: boolean;
  imageUrl?: string;
}

function OrderTaskItem({ task }: { task: Task }) {
  const formatDateTaskItem = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    if (timestamp && typeof timestamp.toDate === 'function') {
      return format(timestamp.toDate(), 'PPp');
    }
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, 'PPp');
  };

  return (
    <Card className="mb-3 bg-muted/50">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-semibold">Task: {task.taskType}</CardTitle>
          <Badge variant={task.status === 'completed' ? 'statusGreen' : 'secondary'} className="capitalize text-xs">{task.status.replace(/_/g, ' ')}</Badge>
        </div>
        <CardDescription className="text-xs">Assigned to: {task.assigneeName || 'N/A'}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 text-xs">
        <p className="truncate">{task.description}</p>
        <p className="text-muted-foreground mt-1">Item: {task.itemName}</p>
        <p className="text-muted-foreground">Created: {formatDateTaskItem(task.createdAt)}</p>
      </CardContent>
    </Card>
  );
}


export default function AdminOrderDetailPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  const orderId = typeof params.orderId === 'string' ? params.orderId : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [orderTasks, setOrderTasks] = useState<Task[]>([]);
  const [technicians, setTechnicians] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [currentItemForTask, setCurrentItemForTask] = useState<OrderItemType | null>(null);
  const [imageToView, setImageToView] = useState<string | null>(null);
  
  const [resolvedOrderItemOptionsMap, setResolvedOrderItemOptionsMap] = useState<Map<string, ProductCustomizationOption[]>>(new Map());
  const [isLoadingItemOptions, setIsLoadingItemOptions] = useState(false);
  
  const taskForm = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema) });
  const statusForm = useForm<OrderStatusFormValues>({ resolver: zodResolver(orderStatusFormSchema) });

  const formatDate = (timestamp: any, includeTime: boolean = true) => {
    if (!timestamp) return 'N/A';
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return includeTime ? format(date, 'PPp') : format(date, 'PP');
  };

  const fetchOrderAndTasks = useCallback(async () => {
    if (!db || !orderId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderDocRef);

      if (orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() } as Order;
        setOrder(orderData);
        statusForm.reset({ status: orderData.status });

        const tasksQuery = query(collection(db, 'tasks'), where("orderId", "==", orderId));
        const tasksSnapshot = await getDocs(tasksQuery);
        const fetchedTasks: Task[] = [];
        tasksSnapshot.forEach(taskDoc => fetchedTasks.push({ id: taskDoc.id, ...taskDoc.data() } as Task));
        setOrderTasks(fetchedTasks);
      } else {
        toast({ title: "Error", description: "Order not found.", variant: "destructive" });
        router.push('/admin/orders');
      }
    } catch (error) {
      console.error("Failed to fetch order details:", error);
      toast({ title: "Error", description: "Failed to load order details.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, toast, router, statusForm]);

  const fetchTechnicians = useCallback(async () => {
    if (!db) return;
    try {
      const techQuery = query(collection(db, 'users'), where("role", "==", "Technician"), where("disabled", "!=", true));
      const techSnapshot = await getDocs(techQuery);
      const fetchedTechs: AppUser[] = [];
      techSnapshot.forEach(docUser => fetchedTechs.push({ uid: docUser.id, ...docUser.data() } as AppUser));
      setTechnicians(fetchedTechs);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      toast({ title: "Error", description: "Could not load technicians.", variant: "destructive" });
    }
  }, [toast]);

  const fetchAndResolveOrderItemOptions = useCallback(async () => {
    if (!db || !order || order.items.length === 0) {
      setResolvedOrderItemOptionsMap(new Map());
      return;
    }
    setIsLoadingItemOptions(true);
    const newMap = new Map<string, ProductCustomizationOption[]>();
    const promises = order.items.map(async (item, index) => {
      if (item.customizations && Object.keys(item.customizations).length > 0) {
        try {
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
            newMap.set(`${item.productId}_${index}`, optionsToUse);
          }
        } catch (error) {
          console.error(`Failed to fetch options for product ${item.productId} in order:`, error);
        }
      }
    });
    await Promise.all(promises);
    setResolvedOrderItemOptionsMap(newMap);
    setIsLoadingItemOptions(false);
  }, [order, db]);

  useEffect(() => {
    if (order && order.items.length > 0) {
      fetchAndResolveOrderItemOptions();
    }
  }, [order, fetchAndResolveOrderItemOptions]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || (role !== 'Admin' && role !== 'ServiceManager')) {
        router.replace('/dashboard');
      } else {
        if (orderId) {
          fetchOrderAndTasks();
          fetchTechnicians();
        } else {
          router.push('/admin/orders');
        }
      }
    }
  }, [user, role, authLoading, router, orderId, fetchOrderAndTasks, fetchTechnicians]);

  const handleStatusUpdate = async (data: OrderStatusFormValues) => {
    if (!db || !orderId || !order || !user ) return;
    setIsUpdatingStatus(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      const newHistoryEntry: DeliveryHistoryEntry = {
        status: data.status as OrderStatus,
        timestamp: Timestamp.now(), 
        notes: `Status updated to ${data.status} by ${user.displayName || user.email}`,
        actorId: user.uid,
      };
      await updateDoc(orderRef, { 
        status: data.status, 
        updatedAt: serverTimestamp(), 
        deliveryHistory: arrayUnion(newHistoryEntry) 
      });
      
      setOrder(prev => prev ? { 
          ...prev, 
          status: data.status as OrderStatus, 
          deliveryHistory: [...(prev.deliveryHistory || []), {...newHistoryEntry, timestamp: new Date() }] 
      } : null);
      statusForm.reset({ status: data.status as OrderStatus }); 
      toast({ title: "Order Status Updated", description: `Order marked as ${data.status}.` });
    } catch (error) {
      console.error("Error updating order status:", error);
      toast({ title: "Error", description: "Failed to update order status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const openTaskDialog = (item: OrderItemType) => {
    setCurrentItemForTask(item);
    taskForm.reset({
      taskType: "",
      description: `Work on: ${item.name}`,
      assigneeId: ""
    });
    setIsTaskDialogOpen(true);
  };

  const handleTaskSubmit = async (data: TaskFormValues) => {
    if (!db || !orderId || !currentItemForTask || !user) return;
    const selectedTechnician = technicians.find(t => t.uid === data.assigneeId);
    if (!selectedTechnician) {
      toast({ title: "Error", description: "Selected technician not found.", variant: "destructive" });
      return;
    }

    const newTaskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any; updatedAt: any } = { 
      orderId: orderId,
      itemName: currentItemForTask.name,
      taskType: data.taskType,
      description: data.description,
      assigneeId: data.assigneeId,
      assigneeName: selectedTechnician.displayName || selectedTechnician.email || 'N/A',
      status: 'pending',
      customizations: currentItemForTask.customizations || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const docRef = await addDoc(collection(db, 'tasks'), newTaskData);
      const createdTask: Task = { 
        ...newTaskData, 
        id: docRef.id, 
        createdAt: new Date(), 
        updatedAt: new Date()
      };
      setOrderTasks(prev => [...prev, createdTask]);
      toast({ title: "Task Created", description: `Task for ${currentItemForTask.name} assigned to ${selectedTechnician.displayName || selectedTechnician.email}.` });
      setIsTaskDialogOpen(false);
      setCurrentItemForTask(null);
      taskForm.reset();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    }
  };
  
  const itemHasExistingTask = (itemName: string) => {
    return orderTasks.some(task => task.itemName === itemName && task.orderId === orderId);
  };

  const getDisplayableCustomizationValueAdmin = (
    optionId: string, 
    selectedValue: any, 
    optionsDefinitions?: ProductCustomizationOption[]
  ): ResolvedOptionDetails => {
    const optionDef = optionsDefinitions?.find(opt => opt.id === optionId);
    if (!optionDef) return { label: optionId, value: String(selectedValue) };

    let displayValue = String(selectedValue);
    let isColor = false, isImage = false;
    let colorHex: string | undefined = undefined;
    let imageUrl: string | undefined = undefined;

    switch (optionDef.type) {
      case 'dropdown':
        displayValue = optionDef.choices?.find(c => c.value === selectedValue)?.label || String(selectedValue);
        break;
      case 'color_picker':
        const colorChoice = optionDef.choices?.find(c => c.value === selectedValue);
        displayValue = colorChoice?.label || String(selectedValue);
        isColor = true;
        colorHex = colorChoice?.value;
        break;
      case 'image_upload':
        isImage = true;
        imageUrl = typeof selectedValue === 'string' ? selectedValue : undefined;
        displayValue = imageUrl ? "Image Provided" : "No Image";
        break;
      case 'checkbox':
        displayValue = selectedValue ? (optionDef.checkboxLabel || 'Selected') : 'Not selected';
        break;
      default: // text
        displayValue = String(selectedValue);
    }
    return { label: optionDef.label, value: displayValue, isColor, colorHex, isImage, imageUrl };
  };


  if (isLoading || authLoading || isLoadingItemOptions) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (!order) {
    return <div className="flex items-center justify-center min-h-screen"><AlertTriangle className="h-10 w-10 text-destructive mr-2" /> Order not found.</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/admin/orders')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="font-headline text-xl md:text-2xl">Order ID: {order.id}</CardTitle>
                  <CardDescription>Placed on: {formatDate(order.createdAt)} | Last Updated: {formatDate(order.updatedAt)}</CardDescription>
                </div>
                <Badge variant={getOrderStatusBadgeVariant(order.status)} className="text-sm capitalize">
                  {order.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={statusForm.handleSubmit(handleStatusUpdate)} className="flex items-end gap-2">
                    <div className="flex-grow">
                    <Label htmlFor="orderStatus">Update Order Status</Label>
                    <Controller
                        name="status"
                        control={statusForm.control}
                        render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger id="orderStatus"><SelectValue placeholder="Select new status" /></SelectTrigger>
                            <SelectContent>
                            {allOrderStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        )}
                    />
                    {statusForm.formState.errors.status && <p className="text-xs text-destructive mt-1">{statusForm.formState.errors.status.message}</p>}
                    </div>
                    <Button type="submit" disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Status
                    </Button>
                </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-headline text-lg flex items-center"><Package className="mr-2 h-5 w-5"/>Order Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {order.items.map((item, index) => {
                    const itemKey = `${item.productId}_${index}`;
                    const itemOptionDefinitions = resolvedOrderItemOptionsMap.get(itemKey);
                    return (
                      <React.Fragment key={itemKey}>
                        <TableRow>
                          <TableCell>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">Qty: {item.quantity} @ {formatPrice(item.price / item.quantity)}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatPrice(item.price)}</TableCell>
                          <TableCell className="text-right">
                            {item.customizations && Object.keys(item.customizations).length > 0 && !itemHasExistingTask(item.name) && (role === 'Admin' || role === 'ServiceManager') && (
                              <Button variant="outline" size="sm" onClick={() => openTaskDialog(item)}>
                                <Settings2 className="mr-1 h-3 w-3"/> Create Task
                              </Button>
                            )}
                            {itemHasExistingTask(item.name) && (
                                <Badge variant="outline" className="text-xs">ASSIGNED</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                        {item.customizations && Object.keys(item.customizations).length > 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="p-0">
                              <div className="bg-muted/50 p-3 text-xs space-y-2">
                                <h4 className="font-semibold text-foreground/80">Customizations:</h4>
                                {Object.entries(item.customizations).map(([optionId, selectedValue]) => {
                                  const details = getDisplayableCustomizationValueAdmin(optionId, selectedValue, itemOptionDefinitions);
                                  return (
                                    <div key={optionId} className="grid grid-cols-3 gap-2 border-b pb-1 last:border-b-0">
                                      <div className="col-span-1 font-medium">{details.label}:</div>
                                      <div className="col-span-2 flex items-center gap-2">
                                          {details.isImage && details.imageUrl ? (
                                            <button onClick={() => setImageToView(details.imageUrl!)} className="relative w-12 h-12 bg-muted rounded border overflow-hidden hover:opacity-80 transition-opacity">
                                                <Image src={details.imageUrl} alt={details.label} layout="fill" objectFit="cover" data-ai-hint="product image" />
                                            </button>
                                          ) : details.isColor && details.colorHex ? (
                                            <span style={{ backgroundColor: details.colorHex }} className="inline-block w-4 h-4 rounded-full border border-muted-foreground mr-1"></span>
                                          ) : null}
                                          <span className="break-all">{details.value}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="justify-end font-bold text-lg border-t pt-4">
              Order Total: {formatPrice(order.totalAmount)}
            </CardFooter>
          </Card>

           <Card>
            <CardHeader><CardTitle className="font-headline text-lg">Delivery History</CardTitle></CardHeader>
            <CardContent>
              {order.deliveryHistory && order.deliveryHistory.length > 0 ? (
                <ul className="space-y-3">
                  {order.deliveryHistory.slice().reverse().map((entry, index) => (
                    <li key={index} className="text-sm border-b pb-2 last:border-b-0">
                      <p><span className="font-semibold capitalize">{entry.status.replace(/_/g, ' ')}</span> - {formatDate(entry.timestamp)}</p>
                      {entry.notes && <p className="text-xs text-muted-foreground pl-2">- {entry.notes}</p>}
                      {entry.actorId && <p className="text-xs text-muted-foreground pl-2">By: {entry.actorId.substring(0,8)}...</p>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-muted-foreground text-sm">No delivery history yet.</p>}
            </CardContent>
          </Card>

        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle className="font-headline text-lg flex items-center"><User className="mr-2 h-5 w-5"/>Customer & Shipping</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>Name:</strong> {order.customerName}</p>
              <p><strong>Email:</strong> {order.customerEmail}</p>
              <p><strong>Phone:</strong> {order.customerPhone}</p>
              <Separator className="my-2"/>
              <p className="font-medium">Shipping Address:</p>
              <p>{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.addressLine1}</p>
              {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
              <p>{order.shippingAddress.city}, {order.shippingAddress.county} {order.shippingAddress.postalCode}</p>
              <p>Phone: {order.shippingAddress.phone}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-headline text-lg flex items-center"><CreditCard className="mr-2 h-5 w-5"/>Payment & Method</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><strong>Payment Method:</strong> <span className="capitalize">{order.paymentMethod?.replace(/_/g, ' ') || 'N/A'}</span></div>
              <div className="flex items-center">
                <strong className="mr-2">Payment Status:</strong> 
                <Badge variant={getPaymentStatusBadgeVariant(order.paymentStatus)} className="capitalize">{order.paymentStatus?.replace(/_/g, ' ') || 'N/A'}</Badge>
              </div>
              {order.transactionId && <div><strong>Transaction ID:</strong> {order.transactionId}</div>}
              <Separator className="my-2"/>
              <div><strong>Shipping Method:</strong> {order.shippingMethodName || 'N/A'}</div>
              <div><strong>Shipping Cost:</strong> {formatPrice(order.shippingCost)}</div>
            </CardContent>
          </Card>
          
          {order.isGift && order.giftDetails && (
            <Card>
                <CardHeader><CardTitle className="font-headline text-lg flex items-center"><GiftIcon className="mr-2 h-5 w-5"/>Gift Details</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                    <p><strong>Recipient:</strong> {order.giftDetails.recipientName}</p>
                    <p><strong>Message:</strong> {order.giftDetails.giftMessage || "N/A"}</p>
                    <p><strong>Notify Recipient:</strong> {order.giftDetails.notifyRecipient ? "Yes" : "No"}</p>
                    {order.giftDetails.notifyRecipient && <p><strong>Show Prices:</strong> {order.giftDetails.showPricesToRecipient ? "Yes" : "No"}</p>}
                </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="font-headline text-lg flex items-center"><Settings2 className="mr-2 h-5 w-5"/>Linked Tasks ({orderTasks.length})</CardTitle></CardHeader>
            <CardContent className="max-h-80 overflow-y-auto pr-1">
              {orderTasks.length > 0 ? orderTasks.map(task => <OrderTaskItem key={task.id} task={task} />)
                : <p className="text-muted-foreground text-sm">No tasks created for this order yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isTaskDialogOpen} onOpenChange={(open) => { if (!open) setCurrentItemForTask(null); setIsTaskDialogOpen(open);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task for: {currentItemForTask?.name}</DialogTitle>
            <DialogDescription>Fill in the details for the new production task. This can only be done by a Service Manager or Admin.</DialogDescription>
          </DialogHeader>
          <form onSubmit={taskForm.handleSubmit(handleTaskSubmit)} className="space-y-4 py-2">
            <div>
              <Label htmlFor="taskType">Task Type</Label>
              <Controller
                name="taskType" control={taskForm.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value || undefined}>
                    <SelectTrigger id="taskType"><SelectValue placeholder="Select task type" /></SelectTrigger>
                    <SelectContent>{predefinedTaskTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              />
              {taskForm.formState.errors.taskType && <p className="text-xs text-destructive mt-1">{taskForm.formState.errors.taskType.message}</p>}
            </div>
             {currentItemForTask?.customizations && (
              <div>
                <Label>Customization Details</Label>
                <Card className="p-3 bg-muted/50 max-h-40 overflow-y-auto text-xs space-y-2">
                  {Object.entries(currentItemForTask.customizations).map(([optionId, selectedValue]) => {
                     const itemOptionDefinitions = resolvedOrderItemOptionsMap.get(`${currentItemForTask.productId}_${order?.items.findIndex(i => i.name === currentItemForTask.name)}`);
                     const details = getDisplayableCustomizationValueAdmin(optionId, selectedValue, itemOptionDefinitions);
                     return (
                      <div key={optionId} className="flex flex-col items-start gap-0.5 border-b last:border-b-0 pb-1.5">
                        <span className="font-semibold text-foreground/90">{details.label}:</span>
                         {details.isImage && details.imageUrl ? (
                            <button type="button" onClick={() => setImageToView(details.imageUrl!)} className="relative w-16 h-16 bg-muted rounded border overflow-hidden hover:opacity-80 transition-opacity">
                                <Image src={details.imageUrl} alt={details.label} layout="fill" objectFit="cover" data-ai-hint="customization image"/>
                            </button>
                         ) : (
                            <div className="flex items-center gap-1 text-muted-foreground break-all">
                                {details.isColor && details.colorHex && (
                                    <span style={{ backgroundColor: details.colorHex }} className="inline-block w-3 h-3 rounded-full border border-muted-foreground mr-1"></span>
                                )}
                                <span>{details.value}</span>
                            </div>
                         )}
                      </div>
                     );
                  })}
                </Card>
              </div>
            )}
            <div>
              <Label htmlFor="description">Task Description / Instructions</Label>
              <Input id="description" {...taskForm.register("description")} />
              {taskForm.formState.errors.description && <p className="text-xs text-destructive mt-1">{taskForm.formState.errors.description.message}</p>}
            </div>
            <div>
              <Label htmlFor="assigneeId">Assign to Technician</Label>
              <Controller
                name="assigneeId" control={taskForm.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value || undefined}>
                    <SelectTrigger id="assigneeId"><SelectValue placeholder="Select technician" /></SelectTrigger>
                    <SelectContent>
                      {technicians.length === 0 && <SelectItem value="NO_TECHNICIANS_AVAILABLE_SENTINEL" disabled>No technicians found</SelectItem>}
                      {technicians.map(tech => <SelectItem key={tech.uid} value={tech.uid}>{tech.displayName || tech.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {taskForm.formState.errors.assigneeId && <p className="text-xs text-destructive mt-1">{taskForm.formState.errors.assigneeId.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={taskForm.formState.isSubmitting}>
                {taskForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!imageToView} onOpenChange={(open) => { if (!open) setImageToView(null) }}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Customization Image Preview</DialogTitle>
                <DialogDescription>A larger view of the user-provided image.</DialogDescription>
            </DialogHeader>
            <div className="relative w-full aspect-square">
                {imageToView && <Image src={imageToView} alt="Customization Image Preview" layout="fill" objectFit="contain" />}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
    
