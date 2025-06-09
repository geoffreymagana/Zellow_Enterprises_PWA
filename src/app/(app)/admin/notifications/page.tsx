
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { Star, MessageSquare, Package, CalendarDays, UserCircle, Loader2, Info, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

export default function AdminNotificationsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [feedbackNotifications, setFeedbackNotifications] = useState<Order[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(true);

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

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') { // Can be expanded to ServiceManager later if needed
        router.replace('/dashboard');
      } else {
        const unsubscribeFeedback = fetchFeedbackNotifications();
        return () => {
          unsubscribeFeedback();
        };
      }
    }
  }, [user, role, authLoading, router, fetchFeedbackNotifications]);

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user || role !== 'Admin') { // Can be expanded to ServiceManager later
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]">Loading or unauthorized...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-semibold">System Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Review important system alerts, user activities, and feedback.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">General Notifications</CardTitle>
          <CardDescription>This section will display general system notifications or alerts that require administrative attention.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="p-6 bg-muted/50 rounded-md text-center">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                  No general system notifications at the moment.
              </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Customer Feedback</CardTitle>
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
  );
}
