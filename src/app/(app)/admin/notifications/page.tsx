
"use client";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order, FeedbackThread, UserRole } from '@/types';
import { Star, MessageSquare, Package, CalendarDays, UserCircle, Loader2, Info, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FeedbackThreadModal } from '@/components/common/FeedbackThreadModal';
import { Badge, BadgeProps } from "@/components/ui/badge";

const RenderStars = ({ ratingValue }: { ratingValue: number }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-5 w-5 ${
            ratingValue >= star ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground'
          }`}
        />
      ))}
      <span className="ml-2 text-sm font-semibold">{ratingValue}/5</span>
    </div>
  );
};

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, 'PPp');
};

const getStatusVariant = (status: FeedbackThread['status']): BadgeProps['variant'] => {
  switch (status) {
    case 'open': return 'statusYellow';
    case 'replied': return 'statusGreen';
    case 'closed': return 'statusGrey';
    default: return 'outline';
  }
};


export default function AdminNotificationsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [feedbackNotifications, setFeedbackNotifications] = useState<Order[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);

  const [supportThreads, setSupportThreads] = useState<FeedbackThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const fetchFeedbackNotifications = useCallback(() => {
    if (!db) {
      toast({ title: "Database Error", description: "Firestore service is not available.", variant: "destructive" });
      setIsLoadingFeedback(false);
      return () => {};
    }
    setIsLoadingFeedback(true);
    const feedbackQuery = query(
      collection(db, 'orders'),
      where('rating', '!=', null),
      orderBy('rating.ratedAt', 'desc')
    );

    const unsubscribe = onSnapshot(feedbackQuery, (snapshot) => {
      const feedbacks: Order[] = [];
      snapshot.forEach(doc => feedbacks.push({ id: doc.id, ...doc.data() } as Order));
      setFeedbackNotifications(feedbacks);
      setIsLoadingFeedback(false);
    }, (error) => {
      console.error("Error fetching feedback notifications:", error);
      toast({ title: "Error", description: "Could not load customer feedback.", variant: "destructive" });
      setIsLoadingFeedback(false);
    });
    return unsubscribe;
  }, [toast]);

  const fetchSupportThreads = useCallback(() => {
    if (!db || !user || !role || (role !== 'Admin' && role !== 'ServiceManager' && role !== 'FinanceManager' && role !== 'DispatchManager' && role !== 'InventoryManager')) {
      setIsLoadingThreads(false);
      return () => {};
    }
    setIsLoadingThreads(true);

    let threadsQuery;
    // Admin and other managers will only see threads targeted to their specific role.
    threadsQuery = query(
        collection(db, 'feedbackThreads'),
        where('targetRole', '==', role),
        orderBy('updatedAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(threadsQuery, (snapshot) => {
      setSupportThreads(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackThread)));
      setIsLoadingThreads(false);
    }, (error) => {
      console.error("Error fetching support threads:", error);
      toast({ title: "Error", description: "Could not load support threads.", variant: "destructive" });
      setIsLoadingThreads(false);
    });
    return unsubscribe;
  }, [db, user, role, toast]);


  useEffect(() => {
    if (!authLoading) {
      if (!user || (role !== 'Admin' && role !== 'ServiceManager' && role !== 'FinanceManager' && role !== 'DispatchManager' && role !== 'InventoryManager')) {
        router.replace('/dashboard');
      } else {
        const unsubscribeFeedback = fetchFeedbackNotifications();
        const unsubscribeThreads = fetchSupportThreads();
        return () => {
          unsubscribeFeedback();
          unsubscribeThreads();
        };
      }
    }
  }, [user, role, authLoading, router, fetchFeedbackNotifications, fetchSupportThreads]);

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || (role !== 'Admin' && role !== 'ServiceManager' && role !== 'FinanceManager' && role !== 'DispatchManager' && role !== 'InventoryManager')) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading or unauthorized...</div>;
  }

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-headline font-semibold">System Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Review important system alerts, user activities, and feedback.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2"><MessageSquare /> User Feedback Messages</CardTitle>
            <CardDescription>Conversations initiated by users from the support page.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingThreads ? <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : supportThreads.length === 0 ? <p className="text-muted-foreground text-center py-6">No support messages for your department at the moment.</p>
            : <div className="space-y-3">
                {supportThreads.map((thread) => (
                  <button key={thread.id} onClick={() => setSelectedThreadId(thread.id)} className="w-full text-left">
                    <Card className="hover:shadow-md hover:border-primary/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-grow min-w-0">
                            <p className="font-semibold text-primary truncate" title={thread.subject}>{thread.subject}</p>
                            <p className="text-xs text-muted-foreground">From: {thread.senderName} ({thread.senderEmail})</p>
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

        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center gap-2"><Star /> Customer Feedback</CardTitle>
            <CardDescription>Latest ratings and comments submitted by customers for their orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingFeedback ? (
              <div className="flex justify-center items-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : feedbackNotifications.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">No customer feedback has been submitted yet.</p>
            ) : (
              <div className="space-y-4">
                {feedbackNotifications.map((order) => (
                  <Card key={order.id} className="bg-card shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                          <CardTitle className="text-base font-semibold">
                              Feedback for Order: {' '}
                              <Link href={`/admin/orders/edit/${order.id}`} className="text-primary hover:underline">
                                  {order.id.substring(0, 8)}...
                              </Link>
                          </CardTitle>
                          {order.rating && <RenderStars ratingValue={order.rating.value} />}
                      </div>
                      <CardDescription className="text-xs">
                          By: {order.customerName || "N/A"} ({order.customerEmail || 'N/A'})
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {order.rating?.comment ? (
                        <p className="italic text-foreground/80">"{order.rating.comment}"</p>
                      ) : (
                        <p className="text-muted-foreground italic">No comment provided.</p>
                      )}
                    </CardContent>
                    <CardFooter className="text-xs text-muted-foreground pt-3 border-t">
                      <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                      Feedback on: {order.rating?.ratedAt ? formatDate(order.rating.ratedAt) : 'N/A'}
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
