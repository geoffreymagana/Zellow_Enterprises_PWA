
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { Download, FileText, Filter, PlusCircle, Search, Send, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface PaymentTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'incoming' | 'outgoing'; // Incoming from customer, outgoing to supplier
  status: 'pending' | 'completed' | 'failed' | 'requires_approval';
  method?: string; // e.g., 'Stripe', 'Bank Transfer'
  referenceId?: string; // Order ID, Invoice ID
}

const samplePayments: PaymentTransaction[] = [
  { id: 'PAY001', date: new Date('2023-11-01'), description: 'Payment for Order ORD001', amount: 3198.00, type: 'incoming', status: 'completed', method: 'Stripe', referenceId: 'ORD001' },
  { id: 'PAY002', date: new Date('2023-11-02'), description: 'Invoice INV001 to Supplier S001', amount: 50000.00, type: 'outgoing', status: 'pending', method: 'Bank Transfer', referenceId: 'INV001' },
  { id: 'PAY003', date: new Date('2023-11-03'), description: 'Payment for Order ORD002', amount: 2550.00, type: 'incoming', status: 'failed', method: 'Stripe', referenceId: 'ORD002' },
  { id: 'PAY004', date: new Date('2023-11-04'), description: 'Refund for Order ORD000', amount: 1000.00, type: 'outgoing', status: 'requires_approval', method: 'Stripe', referenceId: 'ORD000' },
];

export default function PaymentsPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentTransaction[]>(samplePayments);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (role && role !== 'FinanceManager') {
      router.replace('/dashboard');
    }
    // In a real app, fetch payments from Firestore
  }, [role, router]);

  if (role !== 'FinanceManager') {
    return <div className="text-center py-10">Access denied. This page is for Finance Managers only.</div>;
  }

  const filteredPayments = payments.filter(p =>
    p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.referenceId && p.referenceId.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const getStatusBadgeVariant = (status: PaymentTransaction['status']) => {
    switch (status) {
      case 'pending': return 'secondary'; // Yellowish
      case 'completed': return 'default'; // Greenish
      case 'failed': return 'destructive';
      case 'requires_approval': return 'outline'; // Bluish
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">Financial Transactions</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"><UploadCloud className="mr-2 h-4 w-4" /> Import Statement</Button>
          <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Transaction</Button>
        </div>
      </div>
      <p className="text-muted-foreground">
        Manage incoming and outgoing payments, approve transactions, and generate reports.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Total Revenue (Month)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">Ksh 1,058,050.00</p></CardContent>
        </Card>
         <Card>
          <CardHeader><CardTitle>Total Expenses (Month)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">Ksh 320,000.00</p></CardContent>
        </Card>
         <Card>
          <CardHeader><CardTitle>Pending Approvals</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">2</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
             <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
                />
            </div>
            <div className="flex items-center gap-2">
                <Select defaultValue="all">
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="requires_approval">Requires Approval</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.id}</TableCell>
                  <TableCell>{p.date.toLocaleDateString()}</TableCell>
                  <TableCell>{p.description}</TableCell>
                  <TableCell className={p.type === 'incoming' ? 'text-green-600' : 'text-red-600'}>
                    {p.type === 'incoming' ? '+' : '-'}Ksh {p.amount.toFixed(2)}
                  </TableCell>
                  <TableCell><Badge variant={p.type === 'incoming' ? "default" : "secondary"} className="capitalize">{p.type}</Badge></TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(p.status)} className="capitalize">{p.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    {p.status === 'pending' && p.type === 'outgoing' && (
                      <Button variant="ghost" size="icon" title="Send Payment"><Send className="h-4 w-4" /></Button>
                    )}
                    {p.status === 'requires_approval' && (
                        <Button variant="ghost" size="icon" title="Approve Transaction"><FileText className="h-4 w-4"/></Button>
                    )}
                     <Button variant="ghost" size="icon" title="View Details"><Search className="h-4 w-4"/></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredPayments.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No transactions match your search or filters.</p>
          )}
        </CardContent>
        <CardFooter className="pt-4 flex justify-end">
            <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Export Report</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
