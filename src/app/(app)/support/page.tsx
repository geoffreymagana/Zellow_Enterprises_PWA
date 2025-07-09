
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, History, MessageSquarePlus, Send, MessageCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackThread, UserRole } from "@/types";
import { collection, addDoc, serverTimestamp, runTransaction, doc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { FeedbackThreadModal } from '@/components/common/FeedbackThreadModal';
import { Badge, BadgeProps } from "@/components/ui/badge";

const feedbackFormSchema = z.object({
  targetRole: z.string().min(1, "Please select a department to contact."),
  subject: z.string().min(5, "Subject must be at least 5 characters long.").max(100, "Subject is too long."),
  message: z.string().min(10, "Message must be at least 10 characters long.").max(1000, "Message is too long."),
});
type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;

const contactableRoles: UserRole[] = ['Admin', 'ServiceManager', 'FinanceManager', 'DispatchManager', 'InventoryManager'];

const getStatusVariant = (status: FeedbackThread['status']): BadgeProps['variant'] => {
  switch (status) {
    case 'open': return 'statusYellow';
    case 'replied': return 'statusGreen';
    case 'closed': return 'statusGrey';
    default: return 'outline';
  }
};


export default function SupportPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<FeedbackThread[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { targetRole: "", subject: "", message: "" },
  });

  const onSubmit = async (values: FeedbackFormValues) => {
    if (!user || !db) {
      toast({ title: "Error", description: "You must be logged in to send feedback.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const threadCollection = collection(db, 'feedbackThreads');
      const newThreadRef = doc(threadCollection); // Create a reference with a new ID
      const messagesCollection = collection(newThreadRef, 'messages');

      await runTransaction(db, async (transaction) => {
        // 1. Create the main thread document
        transaction.set(newThreadRef, {
          subject: values.subject,
          senderId: user.uid,
          senderName: user.displayName || "N/A",
          senderEmail: user.email || "N/A",
          targetRole: values.targetRole,
          status: 'open',
          lastMessageSnippet: values.message.substring(0, 50),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastReplierRole: role,
        });
        
        // 2. Create the first message in the subcollection
        transaction.set(doc(messagesCollection), {
          threadId: newThreadRef.id,
          senderId: user.uid,
          senderName: user.displayName || "N/A",
          senderRole: role,
          message: values.message,
          createdAt: serverTimestamp(),
        });
      });

      toast({ title: "Feedback Sent!", description: "Thank you, we've received your message and will get back to you soon." });
      form.reset();
    } catch (e: any) {
      console.error("Error sending feedback:", e);
      toast({ title: "Submission Failed", description: "Could not send your message. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchHistory = useCallback(() => {
    if (!db || !user) {
      setIsLoadingHistory(false);
      return () => {};
    }
    setIsLoadingHistory(true);
    const q = query(
      collection(db, 'feedbackThreads'), 
      where("senderId", "==", user.uid), 
      orderBy("updatedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackThread)));
      setIsLoadingHistory(false);
    }, (error) => {
      console.error("Error fetching feedback history:", error);
      toast({ title: "Error", description: "Could not load your feedback history.", variant: "destructive" });
      setIsLoadingHistory(false);
    });
    return unsubscribe;
  }, [db, user, toast]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    const unsubscribe = fetchHistory();
    return () => unsubscribe();
  }, [loading, user, router, fetchHistory]);

  return (
    <>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Tabs defaultValue="submit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="submit"><MessageSquarePlus className="mr-2 h-4 w-4" /> Submit Feedback</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> My History</TabsTrigger>
            <TabsTrigger value="contact"><Phone className="mr-2 h-4 w-4" /> Contact Info</TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-headline font-bold text-primary">Submit Feedback or Ask a Question</CardTitle>
                <CardDescription>We value your input. Let us know how we can help or improve.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField control={form.control} name="targetRole" render={({ field }) => (
                      <FormItem>
                        <FormLabel>To (Department)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a department..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {contactableRoles.map(r => r && <SelectItem key={r} value={r}>{r.replace('Manager', ' Manager')}</SelectItem>)}
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
                <CardTitle className="text-2xl font-headline font-bold text-primary">My Feedback History</CardTitle>
                <CardDescription>View your past conversations with our team.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
                : history.length === 0 ? <p className="text-center text-muted-foreground py-6">You have not submitted any feedback yet.</p>
                : <div className="space-y-3">
                    {history.map(thread => (
                        <button key={thread.id} onClick={() => setSelectedThreadId(thread.id)} className="w-full text-left">
                            <Card className="hover:shadow-md hover:border-primary/50 transition-all">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow">
                                            <p className="font-semibold text-primary">{thread.subject}</p>
                                            <p className="text-xs text-muted-foreground truncate">To: {thread.targetRole}</p>
                                        </div>
                                        <Badge variant={getStatusVariant(thread.status)}>{thread.status}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2 italic truncate">"{thread.lastMessageSnippet}"</p>
                                    <p className="text-xs text-right text-muted-foreground mt-2">Last update: {format(thread.updatedAt.toDate(), 'PP')}</p>
                                </CardContent>
                            </Card>
                        </button>
                    ))}
                </div>
                }
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-headline font-bold text-primary">Contact Information</CardTitle>
                <CardDescription>Other ways to get in touch.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <section><h2 className="text-xl font-headline font-semibold mb-2 flex items-center"><Mail className="mr-3 h-5 w-5" />Email</h2>
                    <div className="space-y-1 pl-2 text-sm">
                      <p><strong>Customer Support:</strong> <a href="mailto:support@zellowenterprises.com" className="text-primary hover:underline">support@zellowenterprises.com</a></p>
                      <p><strong>Technical Support:</strong> <a href="mailto:tech@zellowenterprises.com" className="text-primary hover:underline">tech@zellowenterprises.com</a></p>
                    </div>
                </section>
                <Separator />
                <section><h2 className="text-xl font-headline font-semibold mb-2 flex items-center"><Phone className="mr-3 h-5 w-5" />Phone</h2>
                    <div className="space-y-1 pl-2"><p className="text-md font-medium">0742 663 614</p><p className="text-xs text-muted-foreground">(Mon–Sat, 9 AM – 6 PM)</p></div>
                </section>
                <Separator />
                <section><h2 className="text-xl font-headline font-semibold mb-2 flex items-center"><MapPin className="mr-3 h-5 w-5" />Office</h2>
                    <div className="space-y-0.5 pl-2 text-sm"><p className="font-medium">Zellow Enterprises HQ</p><p>GTC Office Tower, 5th Floor</p><p>Westlands, Nairobi, Kenya</p></div>
                </section>
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
