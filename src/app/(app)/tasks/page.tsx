
"use client";

import { Badge, BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import type { Task } from "@/types";
import { Filter, Loader2, Wrench, CheckCircle, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

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

export default function TasksPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');

  const fetchTasks = useCallback(() => {
    if (!user || !db || (role !== 'Technician' && role !== 'ServiceManager')) {
      setIsLoading(false);
      return () => {}; 
    }
    setIsLoading(true);
    
    let q;
    const baseQueryConstraints = [
      orderBy("createdAt", "desc")
    ];

    if (role === 'Technician') {
      let statusFilters: Task['status'][];
      if (filter === 'active') statusFilters = ['pending', 'in-progress', 'needs_approval', 'blocked'];
      else if (filter === 'completed') statusFilters = ['completed', 'rejected'];
      else statusFilters = ['pending', 'in-progress', 'completed', 'needs_approval', 'blocked', 'rejected'];
      
      q = query(
        collection(db, 'tasks'), 
        where('assigneeId', '==', user.uid),
        where('status', 'in', statusFilters),
        ...baseQueryConstraints
      );
    } else { // ServiceManager sees all tasks, can filter client-side if needed or add DB filters
        let statusFilters: Task['status'][] | undefined = undefined;
        if (filter === 'active') statusFilters = ['pending', 'in-progress', 'needs_approval', 'blocked'];
        else if (filter === 'completed') statusFilters = ['completed', 'rejected'];

        q = statusFilters 
            ? query(collection(db, 'tasks'), where('status', 'in', statusFilters), ...baseQueryConstraints)
            : query(collection(db, 'tasks'), ...baseQueryConstraints);
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
      setIsLoading(false);
    });
    return unsubscribe;
  }, [user, db, role, toast, filter]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (role !== 'Technician' && role !== 'ServiceManager')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchTasks();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchTasks]);
  
  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    if (!db) return;
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Task Updated", description: `Task status changed to ${newStatus.replace('_', ' ')}.` });
    } catch (error) {
      console.error("Error updating task status: ", error);
      toast({ title: "Error", description: "Could not update task status.", variant: "destructive" });
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'PPp');
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (role !== 'Technician' && role !== 'ServiceManager') {
     return <div className="text-center py-10">Access denied.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Technician' ? "My Tasks" : "Manage Production Tasks"}
        </h1>
        {/* <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
        </div> */}
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No tasks found matching the current filter.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold font-headline capitalize">{task.taskType}</CardTitle>
                  <Badge variant={getStatusBadgeVariant(task.status)} className="capitalize text-xs">{task.status.replace(/_/g, ' ')}</Badge>
                </div>
                 <CardDescription className="text-xs pt-1">
                    For Item: {task.itemName || 'N/A'} (Order: {task.orderId ? task.orderId.substring(0,8)+'...' : 'N/A'})
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-2 text-sm">
                <p className="line-clamp-3">{task.description}</p>
                {role === 'ServiceManager' && <p className="text-xs text-muted-foreground">Assigned to: {task.assigneeName || 'Unassigned'}</p>}
                <p className="text-xs text-muted-foreground">Created: {formatDate(task.createdAt)}</p>
              </CardContent>
              <CardFooter className="pt-3 border-t flex justify-end items-center gap-2">
                {role === 'Technician' && task.status === 'pending' && (
                  <Button size="sm" onClick={() => handleStatusChange(task.id, 'in-progress')}>
                    <Wrench className="mr-2 h-4 w-4" /> Start Task
                  </Button>
                )}
                {role === 'Technician' && task.status === 'in-progress' && (
                  <Button size="sm" onClick={() => handleStatusChange(task.id, 'completed')}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Mark Completed
                  </Button>
                )}
                 {role === 'ServiceManager' && task.status === 'needs_approval' && (
                  <Button size="sm" onClick={() => handleStatusChange(task.id, 'pending')}>
                     Approve Task
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
