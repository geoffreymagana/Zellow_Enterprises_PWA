
"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, addDoc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Loader2, Send } from 'lucide-react';
import type { FeedbackMessage, FeedbackThread, User, UserRole } from '@/types';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface FeedbackThreadModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  currentUser: User;
  currentUserRole: UserRole;
}

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, 'PPp');
};

export function FeedbackThreadModal({ isOpen, onOpenChange, threadId, currentUser, currentUserRole }: FeedbackThreadModalProps) {
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [thread, setThread] = useState<FeedbackThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !threadId) {
      setMessages([]);
      setThread(null);
      return;
    }
    setIsLoading(true);

    const threadRef = doc(db, 'feedbackThreads', threadId);
    const messagesRef = collection(threadRef, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubThread = onSnapshot(threadRef, (doc) => {
      if (doc.exists()) {
        setThread({ id: doc.id, ...doc.data() } as FeedbackThread);
      }
    });

    const unsubMessages = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FeedbackMessage)));
      setIsLoading(false);
      // Scroll to bottom after messages load
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }, (error) => {
      console.error("Error fetching messages:", error);
      toast({ title: "Error", description: "Could not load conversation.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => {
      unsubThread();
      unsubMessages();
    };
  }, [isOpen, threadId, toast]);

  const handleReply = async () => {
    if (!replyMessage.trim() || !threadId || !currentUserRole) return;
    setIsReplying(true);
    
    const threadRef = doc(db, 'feedbackThreads', threadId);
    const messagesRef = collection(threadRef, 'messages');

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Add the new message
        transaction.set(doc(messagesRef), {
          threadId: threadId,
          senderId: currentUser.uid,
          senderName: currentUser.displayName || "Support Team",
          senderRole: currentUserRole,
          message: replyMessage,
          createdAt: serverTimestamp(),
        });
        
        // 2. Update the parent thread
        transaction.update(threadRef, {
          status: 'replied',
          lastMessageSnippet: replyMessage.substring(0, 50),
          lastReplierRole: currentUserRole,
          updatedAt: serverTimestamp(),
        });
      });
      setReplyMessage("");
    } catch (e: any) {
      console.error("Error sending reply:", e);
      toast({ title: "Error", description: "Could not send reply.", variant: "destructive" });
    } finally {
      setIsReplying(false);
    }
  };

  const handleCloseThread = async () => {
    if (!db || !threadId) return;
    setIsReplying(true);
    try {
        const threadRef = doc(db, 'feedbackThreads', threadId);
        await updateDoc(threadRef, { status: 'closed', updatedAt: serverTimestamp() });
        toast({ title: "Thread Closed", description: "This conversation has been marked as closed."});
        onOpenChange(false);
    } catch (e: any) {
        console.error("Error closing thread:", e);
        toast({ title: "Error", description: `Could not close thread: ${e.message}`, variant: "destructive" });
    } finally {
        setIsReplying(false);
    }
  }

  let lastDate: Date | null = null;
  const canCloseThread = thread && thread.status !== 'closed' && (thread.targetRole !== 'Customer Broadcast' || currentUserRole === 'Admin');

  const recipientDisplay = thread?.targetUserName 
    ? `${thread.targetUserName} (${thread.targetRole})`
    : typeof thread?.targetRole === 'string' ? thread.targetRole.replace('Manager', ' Manager').replace('Customer Broadcast', 'All Customers') : 'N/A';


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col h-[calc(100vh-4rem)] sm:h-[90vh] max-h-[800px]">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{thread?.subject || "Conversation"}</DialogTitle>
          <DialogDescription>
            From: {thread?.senderName || "..."} | To: {recipientDisplay}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow pr-4 -mr-4" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {isLoading ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
            : messages.map((msg, index) => {
                const isCurrentUser = msg.senderId === currentUser.uid;
                const messageDate = msg.createdAt?.toDate();
                const showDateSeparator = messageDate && (lastDate === null || !isSameDay(messageDate, lastDate));
                if (messageDate) {
                  lastDate = messageDate;
                }
                const senderRoleDisplay = msg.senderRole ? `(${msg.senderRole.replace('Manager', ' Mngr.')})` : '';

                return (
                  <div key={msg.id || index}>
                     {showDateSeparator && (
                        <div className="relative text-center my-4">
                            <hr className="absolute top-1/2 left-0 w-full border-border" />
                            <span className="relative bg-background px-2 text-xs text-muted-foreground">{format(messageDate, 'PPP')}</span>
                        </div>
                     )}
                    <div className={cn("flex items-end gap-2", isCurrentUser ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "p-3 rounded-lg max-w-sm md:max-w-md", 
                        isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        <p className="text-xs font-semibold mb-1">{isCurrentUser ? "You" : `${msg.senderName} ${senderRoleDisplay}`}</p>
                        <p className="text-sm whitespace-pre-line break-words">{msg.message}</p>
                        <p className="text-xs text-right mt-2 opacity-70">{messageDate ? format(messageDate, 'p') : ''}</p>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        </ScrollArea>
        
        {thread && thread.status !== 'closed' && (
          <div className="pt-4 border-t">
            <div className="space-y-2">
              <Textarea 
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                rows={3}
                disabled={isReplying}
              />
              <div className="flex justify-between items-center">
                <Button onClick={handleReply} disabled={isReplying || !replyMessage.trim()} size="sm">
                  {isReplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                  Send Reply
                </Button>
                {canCloseThread && (
                  <Button onClick={handleCloseThread} variant="outline" size="sm" disabled={isReplying}>Close Thread</Button>
                )}
              </div>
            </div>
          </div>
        )}
         {thread && thread.status === 'closed' && (
            <div className="pt-4 border-t text-center">
                 <Badge variant="outline">This conversation is closed.</Badge>
            </div>
         )}
      </DialogContent>
    </Dialog>
  );
}
