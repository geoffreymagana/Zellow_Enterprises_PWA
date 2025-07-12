
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, MailCheck, UserPlus } from 'lucide-react';
import type { ApprovalRequest, ApprovalRequestStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const getApprovalStatusVariant = (status: ApprovalRequestStatus): BadgeProps['variant'] => {
  switch (status) {
    case 'pending': return 'statusYellow';
    case 'approved': return 'statusGreen';
    case 'rejected': return 'statusRed';
    default: return 'outline';
  }
};

export default function AdminApprovalsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [actionableRequest, setActionableRequest] = useState<ApprovalRequest | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const fetchApprovalRequests = useCallback(() => {
    if (!db) return () => {};
    setIsLoading(true);
    const q = query(
      collection(db, "approvalRequests"),
      where("status", "==", "pending"),
      orderBy("requestedAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests: ApprovalRequest[] = [];
      snapshot.forEach(doc => fetchedRequests.push({ id: doc.id, ...doc.data() } as ApprovalRequest));
      setRequests(fetchedRequests);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching approval requests:", error);
      toast({ title: "Error", description: "Could not load approval requests.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [toast]);

  useEffect(() => {
    if (!loading && (!user || role !== 'Admin')) {
      router.replace('/dashboard');
    } else if(user && role === 'Admin') {
      const unsubscribe = fetchApprovalRequests();
      return () => unsubscribe();
    }
  }, [user, role, loading, router, fetchApprovalRequests]);
  
  const handleOpenActionModal = (request: ApprovalRequest, type: 'approve' | 'reject') => {
    setActionableRequest(request);
    setActionType(type);
    setRejectionReason("");
    setIsActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!db || !user || !actionableRequest || !actionType) return;
    if (actionType === 'reject' && !rejectionReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    setIsSubmittingAction(true);
    
    const newStatus: ApprovalRequestStatus = actionType === 'approve' ? 'approved' : 'rejected';
    const requestRef = doc(db, 'approvalRequests', actionableRequest.id);
    const userRef = doc(db, 'users', actionableRequest.details.userId);

    const batch = writeBatch(db);

    // Update approval request
    batch.update(requestRef, {
      status: newStatus,
      resolvedBy: user.uid,
      resolvedAt: new Date(),
      resolutionNotes: actionType === 'reject' ? rejectionReason : `Approved by ${user.displayName || user.email}`,
    });
    
    // Update user status
    batch.update(userRef, {
      status: newStatus,
      rejectionReason: actionType === 'reject' ? rejectionReason : null,
    });
    
    try {
      await batch.commit();
      toast({ title: `User ${newStatus}`, description: `User ${actionableRequest.requestedByName} has been ${newStatus}.` });
      setIsActionModalOpen(false);
      setActionableRequest(null);
    } catch (e: any) {
      toast({ title: "Action Failed", description: `Could not ${actionType} user.`, variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };


  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,8rem))]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const userRegistrationRequests = requests.filter(r => r.type === 'user_registration');

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">Approval Management</h1>
      <p className="text-muted-foreground mb-6">Manage and process pending approval requests from various parts of the system.</p>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <UserPlus /> User Registrations ({userRegistrationRequests.length})
          </CardTitle>
          <CardDescription>New customer accounts awaiting approval.</CardDescription>
        </CardHeader>
        <CardContent>
          {userRegistrationRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MailCheck className="mx-auto h-12 w-12 mb-4" />
              <p>No new user registrations to approve.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userRegistrationRequests.map(req => (
                <Card key={req.id} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-semibold">{req.requestedByName}</p>
                    <p className="text-sm text-muted-foreground">{req.requestedByEmail}</p>
                    <p className="text-xs text-muted-foreground">Requested: {req.requestedAt ? format(req.requestedAt.toDate(), 'PPp') : 'N/A'}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive" onClick={() => handleOpenActionModal(req, 'reject')}>
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => handleOpenActionModal(req, 'approve')}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
        {userRegistrationRequests.length > 0 && 
            <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {userRegistrationRequests.length} pending registrations.</p></CardFooter>}
      </Card>

      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="capitalize">{actionType} User Registration</DialogTitle><DialogDescription>You are about to {actionType} the user: {actionableRequest?.requestedByName}</DialogDescription></DialogHeader>
          {actionType === 'reject' && (
            <div className="py-2 space-y-2">
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea id="rejection-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Provide a brief reason for rejection..." />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="button" onClick={handleConfirmAction} disabled={isSubmittingAction || (actionType === 'reject' && !rejectionReason.trim())} variant={actionType === 'reject' ? 'destructive' : 'default'}>
                {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Confirm {actionType}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
