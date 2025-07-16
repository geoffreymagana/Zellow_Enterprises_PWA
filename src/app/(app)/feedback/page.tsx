
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History, MessageSquarePlus, Send, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackThread, UserRole, User as AppUser } from "@/types";
import { collection, addDoc, serverTimestamp, runTransaction, doc, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { FeedbackThreadModal } from '@/components/common/FeedbackThreadModal';
import { Badge, BadgeProps } from "@/components/ui/badge";

const feedbackFormSchema = z.object({
  targetRole: z.string().min(1, "Please select a recipient."), // This will now store the recipient's UID
  subject: z.string().min(5, "Subject must be at least 5 characters long.").max(100, "Subject is too long."),
  message: z.string().min(10, "Message must be at least 10 characters long.").max(1000, "Message is too long."),
});
type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

const getStatusVariant = (status: FeedbackThread['status']): BadgeProps['variant'] => {
  switch (status) {
    case 'open': return 'statusYellow';
    case 'replied': return 'statusGreen';
    case 'closed': return 'statusGrey';
    default: return 'outline';
  }
};


export default function FeedbackPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [sentThreads, setSentThreads] = useState<FeedbackThread[]>([]);
  const [receivedThreads, setReceivedThreads] = useState<FeedbackThread[]>([]);
  const [broadcastThreads, setBroadcastThreads] = useState<FeedbackThread[]>([]); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);

  const history = useMemo(() => {
    const allThreads = new Map<string, FeedbackThread>();
    [...sentThreads, ...receivedThreads, ...broadcastThreads].forEach(thread => {
      if (thread?.id) {
        allThreads.set(thread.id, thread);
      }
    });
    const combined = Array.from(allThreads.values());
    combined.sort((a, b) => (b.updatedAt?.toDate() ?? 0) - (a.updatedAt?.toDate() ?? 0));
    return combined;
  }, [sentThreads, receivedThreads, broadcastThreads]);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { targetRole: "", subject: "", message: "" },
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    if (!user || !db || !role) {
      toast({ title: "Error", description: "You must be logged in to send a message.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    
    // The 'targetRole' from the form is now the recipient's UID.
    const recipientId = values.targetRole;
    const recipient = employees.find(e => e.uid === recipientId);
    
    // We still need the role for the thread document for querying purposes.
    const recipientRole = recipient ? recipient.role : null;

    if (!recipientRole) {
        toast({ title: "Error", description: "Could not find the recipient's role.", variant: "destructive" });
        setIsSubmitting(false);
        return;
    }

    try {
      const threadCollection = collection(db, 'feedbackThreads');
      const newThreadRef = doc(threadCollection); 
      const messagesCollection = collection(newThreadRef, 'messages');

      await runTransaction(db, async (transaction) => {
        transaction.set(newThreadRef, {
          subject: values.subject,
          senderId: user.uid,
          senderName: user.displayName || "N/A",
          senderEmail: user.email || "N/A",
          targetRole: recipientRole, // Store the ROLE for querying
          targetUserId: recipientId, // Store the specific user ID
          status: 'open',
          lastMessageSnippet: values.message.substring(0, 50),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastReplierRole: role,
        });
        
        transaction.set(doc(messagesCollection), {
          threadId: newThreadRef.id,
          senderId: user.uid,
          senderName: user.displayName || "Support Team",
          senderRole: role,
          message: values.message,
          createdAt: serverTimestamp(),
        });
      });

      toast({ title: "Message Sent!", description: "Thank you, we've received your message and will get back to you soon." });
      form.reset();
    } catch (e: any) {
      console.error("Error sending message:", e);
      toast({ title: "Submission Failed", description: "Could not send your message. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const fetchEmployees = useCallback(async () => {
    if (!db) return;
    setIsLoadingEmployees(true);
    const employeeRoles: UserRole[] = ['Admin', 'ServiceManager', 'FinanceManager', 'DispatchManager', 'InventoryManager'];
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', 'in', employeeRoles), where('disabled', '!=', true), orderBy('displayName', 'asc'));
    try {
        const snapshot = await getDocs(q);
        setEmployees(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser)));
    } catch (error) {
        toast({ title: "Error", description: "Could not fetch employee list.", variant: "destructive" });
    } finally {
        setIsLoadingEmployees(false);
    }
  }, [toast]);


  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);


  useEffect(() => {
    if (loading || !user || !db || !role) {
      if (!loading) setIsLoadingHistory(false);
      return;
    }
  
    setIsLoadingHistory(true);
    const unsubscribers: (() => void)[] = [];
  
    // Listener 1: Threads SENT BY the current user (for everyone).
    const sentQuery = query(collection(db, 'feedbackThreads'), where("senderId", "==", user.uid), orderBy('updatedAt', 'desc'));
    const unsubSent = onSnapshot(sentQuery, (snapshot) => {
        setSentThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackThread)));
    }, (error) => {
        console.error("Error fetching sent threads:", error);
        toast({ title: "Error", description: "Could not load your sent messages.", variant: "destructive" });
    });
    unsubscribers.push(unsubSent);
  
    // Listener 2: Threads RECEIVED BY the current user's specific role (managers/admins).
    if (role && role !== 'Customer') {
        const receivedQuery = query(collection(db, 'feedbackThreads'), where("targetRole", "==", role), orderBy('updatedAt', 'desc'));
        const unsubReceived = onSnapshot(receivedQuery, (snapshot) => {
            setReceivedThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackThread)));
        }, (error) => {
            console.error("Error fetching received threads:", error);
            toast({ title: "Error", description: "Could not load messages for your role.", variant: "destructive" });
        });
        unsubscribers.push(unsubReceived);
    } else {
        setReceivedThreads([]);
    }
      
    // Listener 3: BROADCASTS visible to Customers.
    if (role === 'Customer') {
        const broadcastQuery = query(collection(db, 'feedbackThreads'), where("targetRole", "==", "Customer Broadcast"), orderBy('updatedAt', 'desc'));
        const unsubBroadcast = onSnapshot(broadcastQuery, (snapshot) => {
            setBroadcastThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackThread)));
        }, (error) => {
            console.error("Error fetching broadcast threads:", error);
            toast({ title: "Error", description: "Could not load broadcast messages.", variant: "destructive" });
        });
        unsubscribers.push(unsubBroadcast);
    } else {
        setBroadcastThreads([]);
    }

    // Set loading to false once initial listeners are setup. They will manage their own state.
    setIsLoadingHistory(false);
  
    return () => {
        unsubscribers.forEach(unsub => unsub());
    };
  }, [loading, user, db, role, toast]);


  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="submit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="submit"><MessageSquarePlus className="mr-2 h-4 w-4" /> Send a Message</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> My Message History</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-headline font-bold text-primary">Submit a Message or Ask a Question</CardTitle>
                <CardDescription>We value your input. Let us know how we can help.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField control={form.control} name="targetRole" render={({ field }) => (
                      <FormItem>
                        <FormLabel>To</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingEmployees}>
                          <FormControl><SelectTrigger>
                            <SelectValue placeholder={isLoadingEmployees ? "Loading employees..." : "Select a person or department..."} />
                          </SelectTrigger></FormControl>
                          <SelectContent>
                            {role === 'Admin' && <SelectItem value="Customer Broadcast">All Customers (Broadcast)</SelectItem>}
                            {employees.map(e => e.displayName && e.role && (
                                <SelectItem key={e.uid} value={e.uid}>
                                    {e.displayName} - {e.role.replace('Manager', ' Mngr')}
                                </SelectItem>
                            ))}
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} placeholder="e.g., Question about my order" /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="message" render={({ field }) => (
                      <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea {...field} placeholder="Please provide as much detail as possible..." rows={6} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Message
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-headline font-bold text-primary">My Message History</CardTitle>
                <CardDescription>View your past conversations with our team.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                : history.length === 0 ? <p className="text-center text-muted-foreground py-6">You have no message history yet.</p>
                : <div className="space-y-3">
                    {history.map(thread => (
                        <button key={thread.id} onClick={() => setSelectedThreadId(thread.id)} className="w-full text-left">
                            <Card className="hover:shadow-md hover:border-primary/50 transition-all">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow min-w-0">
                                            <p className="font-semibold text-primary truncate" title={thread.subject}>{thread.subject}</p>
                                            <p className="text-xs text-muted-foreground truncate">To: {typeof thread.targetRole === 'string' ? thread.targetRole.replace('Manager', ' Manager').replace('Customer Broadcast', 'All Customers') : 'N/A'}</p>
                                        </div>
                                        <Badge variant={getStatusVariant(thread.status)}>{thread.status}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2 italic truncate">"{thread.lastMessageSnippet}"</p>
                                    <p className="text-xs text-right text-muted-foreground mt-2">Last update: {thread.updatedAt ? format(thread.updatedAt.toDate(), 'PP') : 'N/A'}</p>
                                </CardContent>
                            </Card>
                        </button>
                    ))}
                </div>
                }
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {user && selectedThreadId && (
          <FeedbackThreadModal 
              isOpen={!!selectedThreadId} 
              onOpenChange={(open) => { if(!open) setSelectedThreadId(null); }}
              threadId={selectedThreadId}
              currentUser={user}
              currentUserRole={role}
          />
      )}
    </>
  );
}
