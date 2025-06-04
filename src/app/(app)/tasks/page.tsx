"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import type { Task } from "@/types";
import { Filter, PlusCircle, Edit2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const sampleTasks: Task[] = [
  { id: 'TSK001', assigneeId: 'tech123', type: 'engraving', description: 'Engrave "Happy Birthday" on Mug #MUG789.', orderId: 'ORD001', status: 'pending', createdAt: new Date('2023-11-01'), updatedAt: new Date('2023-11-01') },
  { id: 'TSK002', assigneeId: 'tech123', type: 'printing', description: 'Print design on T-Shirt #TS002, 5 units.', orderId: 'ORD002', status: 'in-progress', createdAt: new Date('2023-11-02'), updatedAt: new Date('2023-11-02') },
  { id: 'TSK003', assigneeId: 'tech456', type: 'engraving', description: 'Engrave logo on 10 Pen #PEN011.', orderId: 'ORD003', status: 'completed', createdAt: new Date('2023-10-30'), updatedAt: new Date('2023-10-31') },
  { id: 'TSK004', assigneeId: 'tech123', type: 'printing', description: 'Urgent: Reprint banner for Event #EVT001', status: 'needs_approval', createdAt: new Date('2023-11-03'), updatedAt: new Date('2023-11-03') },
];

export default function TasksPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (role && !['Technician', 'ServiceManager'].includes(role)) {
      router.replace('/dashboard'); // Redirect if not authorized
    } else if (user) {
      // Fetch tasks based on user role
      // Technicians see their assigned tasks, Service Managers see all/team tasks
      const userTasks = (role === 'Technician') 
        ? sampleTasks.filter(t => t.assigneeId === user.uid && t.status !== 'completed') 
        : sampleTasks; // ServiceManager sees all for now
      setTasks(userTasks);
    }
  }, [user, role, router]);

  if (role && !['Technician', 'ServiceManager'].includes(role)) {
     return <div className="text-center py-10">Access denied. This page is for Technicians and Service Managers only.</div>;
  }
  
  const handleStatusChange = (taskId: string, newStatus: Task['status']) => {
    // In a real app, update task status in Firestore
    setTasks(prevTasks => prevTasks.map(task => task.id === taskId ? {...task, status: newStatus, updatedAt: new Date()} : task));
    console.log(`Task ${taskId} status updated to ${newStatus}`);
  };

  const getStatusBadgeVariant = (status: Task['status']) => {
    switch (status) {
      case 'pending': return 'default';
      case 'in-progress': return 'secondary';
      case 'completed': return 'default'; // Consider green
      case 'needs_approval': return 'destructive'; // Consider yellow/orange
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Technician' ? "My Tasks" : "Manage Tasks"}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
          {role === 'ServiceManager' && <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Task</Button>}
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No tasks assigned or matching filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card key={task.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between bg-muted/30 p-4">
                <div>
                  <CardTitle className="text-lg font-semibold font-headline">{task.description}</CardTitle>
                  <CardDescription className="text-xs">
                    Task ID: {task.id} {task.orderId && `| Order: ${task.orderId}`} | Updated: {task.updatedAt.toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(task.status)} className="capitalize">{task.status.replace('_', ' ')}</Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <p className="text-sm"><strong>Type:</strong> <span className="capitalize">{task.type}</span></p>
                {task.status === 'needs_approval' && (
                     <div className="flex items-center p-2 border border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 rounded-md text-yellow-700 dark:text-yellow-300">
                        <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500 dark:text-yellow-400" />
                        This task requires approval.
                     </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/30 p-4 flex justify-end items-center gap-2">
                {role === 'Technician' && task.status === 'pending' && (
                  <Button size="sm" onClick={() => handleStatusChange(task.id, 'in-progress')}>Start Task</Button>
                )}
                {role === 'Technician' && task.status === 'in-progress' && (
                  <Button size="sm" onClick={() => handleStatusChange(task.id, 'completed')}>Mark as Completed</Button>
                )}
                 {role === 'ServiceManager' && (
                  <Button variant="outline" size="sm"><Edit2 className="mr-2 h-3 w-3" /> Edit</Button>
                )}
                {role === 'ServiceManager' && task.status === 'needs_approval' && (
                  <Button size="sm" onClick={() => handleStatusChange(task.id, 'pending')}>Approve Task</Button>
                )}
                {/* Add photo upload for proof if needed */}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
