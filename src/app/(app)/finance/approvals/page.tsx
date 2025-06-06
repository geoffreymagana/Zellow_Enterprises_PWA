
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge, BadgeProps } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Eye, Filter, RefreshCw, Coins } from 'lucide-react';
import type { StockRequest, StockRequestStatus } from '@/types';
import { collection, query, where, orderBy, onSnapshot, Unsubscribe, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const getStockRequestStatusVariant = (status?: StockRequestStatus | null): BadgeProps['variant'] => {
  if (!status) return 'outline';
  switch (status) {
    case 'pending_finance_approval': return 'statusYellow';
    case 'pending_supplier_fulfillment': return 'statusAmber';
    case 'fulfilled': return 'statusGreen';
    case 'rejected_finance':
    case 'rejected_supplier':
    case 'cancelled': 
      return 'statusRed';
    default: return 'outline';
  }
};

export default function FinanceApprovalsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StockRequestStatus | "all">("pending_finance_approval");

  const [actionableRequest, setActionableRequest] = useState<StockRequest | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    try {
      // Check if it's a Firestore Timestamp-like object with a toDate method
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return format(timestamp.toDate(), 'PPp');
      }
      // Check if it's already a Date object
      if (timestamp instanceof Date) {
        const date = new Date(timestamp); // Create new Date instance to be safe
         if (isNaN(date.getTime())) { 
          return 'Invalid Date Instance';
        }
        return format(date, 'PPp');
      }
      // Try to parse it (e.g., if it's a string or number)
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid Date Input';
      }
      return format(date, 'PPp');
    } catch (error) {
      // console.error('Error formatting date:', timestamp, error);
      return 'Date Format Error';
    }
  };

  const fetchRequests = useCallback(() => {
    if (!db || !user || (role !== 'Admin' && role !== 'FinanceManager')) {
      setIsLoading(false);
      return () => {};
    }
    setIsLoading(true);
    let q;
    if (filterStatus === "all") {
      q = query(collection(db, 'stockRequests'), orderBy("createdAt", "desc"));
    } else {
      q = query(collection(db, 'stockRequests'), where("status", "==", filterStatus), orderBy("createdAt", "desc"));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StockRequest)));
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching stock requests:", error);
      toast({ title: "Error", description: "Could not load stock requests for approval.", variant: "destructive" });
      setIsLoading(false);
    });
    return unsubscribe;
  }, [db, user, role, toast, filterStatus]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || (role !== 'Admin' && role !== 'FinanceManager')) {
      router.replace('/dashboard');
      return;
    }
    const unsubscribe = fetchRequests();
    return () => unsubscribe();
  }, [authLoading, user, role, router, fetchRequests]);

  const handleOpenActionModal = (request: StockRequest, type: "approve" | "reject") => {
    setActionableRequest(request);
    setActionType(type);
    setRejectionReason("");
    setIsActionModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!db || !user || !actionableRequest || !actionType) return;
    setIsSubmittingAction(true);

    const newStatus = actionType === "approve" ? 'pending_supplier_fulfillment' : 'rejected_finance';
    const financeNotes = actionType === "reject" ? rejectionReason : "Approved for procurement.";

    try {
      const requestRef = doc(db, 'stockRequests', actionableRequest.id);
      await updateDoc(requestRef, {
        status: newStatus,
        financeManagerId: user.uid,
        financeManagerName: user.displayName || user.email,
        financeActionTimestamp: serverTimestamp(),
        financeNotes: financeNotes,
        updatedAt: serverTimestamp(),
      });
      toast({ title: `Request ${actionType === "approve" ? "Approved" : "Rejected"}`, description: `Stock request for ${actionableRequest.productName || 'N/A'} has been ${newStatus.replace(/_/g, ' ')}.` });
      setIsActionModalOpen(false);
      setActionableRequest(null);
    } catch (e: any) {
      console.error(`Error ${actionType}ing request:`, e);
      toast({ title: "Error", description: `Could not ${actionType} the request.`, variant: "destructive" });
    } finally {
      setIsSubmittingAction(false);
    }
  };
  

  if (authLoading || (!user && !authLoading)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const pendingFinanceApprovalRequests = requests.filter(r => r.status === 'pending_finance_approval');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold flex items-center gap-2"><Coins className="h-7 w-7 text-primary"/>Stock Request Approvals</h1>
        <Button onClick={fetchRequests} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>
      <p className="text-muted-foreground">Review and process pending stock procurement requests.</p>

      <Card>
        <CardHeader>
          {/* TODO: Add filter by status if needed */}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && pendingFinanceApprovalRequests.length === 0 ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>
          ) : pendingFinanceApprovalRequests.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">No stock requests awaiting finance approval.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty Req.</TableHead><TableHead>Requester</TableHead><TableHead>Date Req.</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {pendingFinanceApprovalRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.productName || ''}</TableCell>
                    <TableCell>{req.requestedQuantity}</TableCell>
                    <TableCell className="text-xs">{req.requesterName || ''}</TableCell>
                    <TableCell className="text-xs">{formatDate(req.createdAt)}</TableCell>
                    <TableCell>
                        <Badge variant={getStockRequestStatusVariant(req.status)} className="capitalize text-xs">
                            {typeof req.status === 'string' ? req.status.replace(/_/g, ' ') : 'N/A'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(req, "approve")} title="Approve Request">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenActionModal(req, "reject")} title="Reject Request">
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {pendingFinanceApprovalRequests.length > 0 && 
          <CardFooter className="pt-4"><p className="text-xs text-muted-foreground">Showing {pendingFinanceApprovalRequests.length} requests awaiting approval.</p></CardFooter>}
      </Card>

      <Dialog open={isActionModalOpen} onOpenChange={setIsActionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionType} Stock Request for {actionableRequest?.productName || 'N/A'}</DialogTitle>
            <DialogDescription>
              Requested Qty: {actionableRequest?.requestedQuantity || 'N/A'}. Requested by: {actionableRequest?.requesterName || 'N/A'} on {formatDate(actionableRequest?.createdAt)}.
            </DialogDescription>
          </DialogHeader>
          {actionType === "reject" && (
            <div className="py-2 space-y-1">
              <Label htmlFor="rejectionReason">Reason for Rejection (Required)</Label>
              <Textarea 
                id="rejectionReason" 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Provide a clear reason..."
              />
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button 
              type="button" 
              onClick={handleConfirmAction} 
              disabled={isSubmittingAction || (actionType === "reject" && !rejectionReason.trim())}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {isSubmittingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
              Confirm {actionType?.charAt(0).toUpperCase() + (actionType || '').slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

