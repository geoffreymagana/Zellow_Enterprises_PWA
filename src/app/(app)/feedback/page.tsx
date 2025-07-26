
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History, MessageSquarePlus, Send, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackThread, UserRole, User as AppUser } from "@/types";
import { collection, addDoc, serverTimestamp, runTransaction, doc, query, where, onSnapshot, orderBy, getDocs, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { FeedbackThreadModal } from '@/components/common/FeedbackThreadModal';
import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const feedbackFormSchema = z.object({
  targetRole: z.string().min(1, "Please select a recipient."),
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


export default function MessagesPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [sentThreads, setSentThreads] = useState<FeedbackThread[]>([]);
  const [receivedThreads, setReceivedThreads] = useState<FeedbackThread[]>([]);
  const [broadcastThreads, setBroadcastThreads] = useState<FeedbackThread[]>([]); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  
  const [recipients, setRecipients] = useState<AppUser[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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
    
    const recipientId = values.targetRole;
    const isBroadcast = recipientId === "Customer Broadcast";
    const recipient = !isBroadcast ? recipients.find(e => e.uid === recipientId) : null;
    const recipientRole = isBroadcast ? "Customer Broadcast" : recipient?.role;
    const recipientName = isBroadcast ? "All Customers" : recipient?.displayName;

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
          targetRole: recipientRole, 
          targetUserId: isBroadcast ? null : recipientId,
          targetUserName: recipientName || null,
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
  
  const fetchRecipients = useCallback(async () => {
    if (!db || !user) return;
    setIsLoadingRecipients(true);
    
    const managerRoles: UserRole[] = ['Admin', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];
    
    const usersRef = collection(db, 'users');
    const q = query(
        usersRef, 
        where('role', 'in', managerRoles),
        where('disabled', '!=', true), 
        orderBy('displayName', 'asc')
    );

    try {
        const snapshot = await getDocs(q);
        const managerUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as AppUser));
        
        const filteredRecipients = managerUsers.filter(u => u.uid !== user.uid);
        
        setRecipients(filteredRecipients);
    } catch (error) {
        console.error("Error fetching recipients:", error);
        toast({ title: "Error", description: "Could not fetch recipient list.", variant: "destructive" });
    } finally {
        setIsLoadingRecipients(false);
    }
  }, [toast, user]);


  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);


  useEffect(() => {
    if (loading || !user || !db || !role) {
      if (!loading) setIsLoadingHistory(false);
      return;
    }
  
    setIsLoadingHistory(true);
    const unsubscribers: (() => void)[] = [];
  
    const sentQuery = query(collection(db, 'feedbackThreads'), where("senderId", "==", user.uid), orderBy('updatedAt', 'desc'));
    unsubscribers.push(onSnapshot(sentQuery, (snapshot) => {
        setSentThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackThread)));
    }));
  
    if (role && role !== 'Customer') {
        const receivedQuery = query(
            collection(db, 'feedbackThreads'), 
            or(
                where("targetRole", "==", role),
                where("targetUserId", "==", user.uid)
            ),
            orderBy('updatedAt', 'desc')
        );
        unsubscribers.push(onSnapshot(receivedQuery, (snapshot) => {
            setReceivedThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackThread)));
        }));
    } else {
        setReceivedThreads([]);
    }
      
    if (role === 'Customer') {
        const broadcastQuery = query(collection(db, 'feedbackThreads'), where("targetRole", "==", "Customer Broadcast"), orderBy('updatedAt', 'desc'));
        unsubscribers.push(onSnapshot(broadcastQuery, (snapshot) => {
            setBroadcastThreads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedbackThread)));
        }));
    } else {
        setBroadcastThreads([]);
    }

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
                      <FormItem className="flex flex-col">
                        <FormLabel>To</FormLabel>
                        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {isLoadingRecipients ? "Loading..." : (
                                  field.value
                                    ? (field.value === "Customer Broadcast" ? "All Customers (Broadcast)" : recipients.find(e => e.uid === field.value)?.displayName)
                                    : "Select a recipient..."
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput placeholder="Search recipients by name or role..." />
                              <CommandList>
                                <CommandEmpty>No recipient found.</CommandEmpty>
                                <CommandGroup>
                                  {role !== 'Customer' && (
                                     <CommandItem
                                      value="All Customers (Broadcast)"
                                      onSelect={() => {
                                        form.setValue("targetRole", "Customer Broadcast");
                                        setIsPopoverOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === "Customer Broadcast" ? "opacity-100" : "opacity-0")}/>
                                      All Customers (Broadcast)
                                    </CommandItem>
                                  )}
                                  {recipients.map(e => (
                                    <CommandItem
                                      value={`${e.displayName || e.email} - ${e.role}`}
                                      key={e.uid}
                                      onSelect={() => {
                                        form.setValue("targetRole", e.uid);
                                        setIsPopoverOpen(false);
                                      }}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", field.value === e.uid ? "opacity-100" : "opacity-0")}/>
                                      {e.displayName} - {e.role}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
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
                    {history.map(thread => {
                        const isSentByCurrentUser = thread.senderId === user?.uid;
                        const lastReplyByCurrentUser = thread.lastReplierRole === role;

                        let conversationPartner, direction;
                        if (isSentByCurrentUser) { // Thread I started
                          direction = lastReplyByCurrentUser ? 'To: ' : 'From: ';
                          conversationPartner = thread.targetUserName || (thread.targetRole === 'Customer Broadcast' ? 'All Customers' : thread.targetRole);
                        } else { // Thread I received
                          direction = lastReplyByCurrentUser ? 'To: ' : 'From: ';
                          conversationPartner = thread.senderName;
                        }

                        return (
                            <button key={thread.id} onClick={() => setSelectedThreadId(thread.id)} className="w-full text-left">
                                <Card className="hover:shadow-md hover:border-primary/50 transition-all">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow min-w-0">
                                                <p className="font-semibold text-primary truncate" title={thread.subject}>{thread.subject}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {direction}
                                                    {conversationPartner}
                                                </p>
                                            </div>
                                            <Badge variant={getStatusVariant(thread.status)}>{thread.status}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-2 italic truncate">"{thread.lastMessageSnippet}"</p>
                                        <p className="text-xs text-right text-muted-foreground mt-2">Last update: {thread.updatedAt ? format(thread.updatedAt.toDate(), 'PP') : 'N/A'}</p>
                                    </CardContent>
                                </Card>
                            </button>
                        )
                    })}
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
