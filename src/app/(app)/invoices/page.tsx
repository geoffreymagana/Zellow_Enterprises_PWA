"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { FileText, PlusCircle, Search, UploadCloud, Download, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  supplierId?: string; // For FinanceManager to see who it's from
  customerId?: string; // For Customer invoices (if this page is extended)
  invoiceNumber: string;
  date: Date;
  dueDate: Date;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'pending_approval'; // pending_approval for suppliers uploading
}

const sampleInvoices: Invoice[] = [
  { id: 'INV001', supplierId: 'sup123', invoiceNumber: 'SUP-2023-10-001', date: new Date('2023-10-15'), dueDate: new Date('2023-11-15'), amount: 1250.75, status: 'paid' },
  { id: 'INV002', supplierId: 'sup456', invoiceNumber: 'SUP-2023-10-002', date: new Date('2023-10-20'), dueDate: new Date('2023-11-20'), amount: 800.00, status: 'sent' },
  { id: 'INV003', supplierId: 'sup123', invoiceNumber: 'SUP-2023-11-001', date: new Date('2023-11-01'), dueDate: new Date('2023-12-01'), amount: 2100.50, status: 'pending_approval' },
  { id: 'INV004', supplierId: 'sup789', invoiceNumber: 'SUP-2023-09-005', date: new Date('2023-09-10'), dueDate: new Date('2023-10-10'), amount: 550.00, status: 'overdue' },
];

export default function InvoicesPage() {
  const { user, role } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (role && !['Supplier', 'FinanceManager'].includes(role)) {
      router.replace('/dashboard');
    } else if (user) {
      // Fetch invoices based on role
      const userInvoices = (role === 'Supplier')
        ? sampleInvoices.filter(inv => inv.supplierId === user.uid) // Simplified: suppliers see their invoices
        : sampleInvoices; // FinanceManager sees all
      setInvoices(userInvoices);
    }
  }, [user, role, router]);

  if (role && !['Supplier', 'FinanceManager'].includes(role)) {
    return <div className="text-center py-10">Access denied. This page is for Suppliers and Finance Managers only.</div>;
  }

  const filteredInvoices = invoices.filter(inv =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeVariant = (status: Invoice['status']) => {
    switch (status) {
      case 'draft': return 'outline';
      case 'sent': return 'secondary'; // Blueish
      case 'paid': return 'default'; // Greenish
      case 'overdue': return 'destructive';
      case 'pending_approval': return 'default'; // Yellowish/Orangish
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-headline font-semibold">
          {role === 'Supplier' ? "My Invoices" : "Manage Invoices"}
        </h1>
        <div className="flex gap-2">
          {role === 'Supplier' && <Button size="sm"><UploadCloud className="mr-2 h-4 w-4" /> Upload Invoice</Button>}
          {role === 'FinanceManager' && <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Create Invoice</Button>}
        </div>
      </div>
      <CardDescription>
        {role === 'Supplier' ? "Upload and track your invoices." : "View, approve, and manage all company invoices."}
      </CardDescription>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by Invoice # or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                {role === 'FinanceManager' && <TableHead>Supplier ID</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.date.toLocaleDateString()}</TableCell>
                  <TableCell>{inv.dueDate.toLocaleDateString()}</TableCell>
                  <TableCell>${inv.amount.toFixed(2)}</TableCell>
                  <TableCell><Badge variant={getStatusBadgeVariant(inv.status)} className="capitalize">{inv.status.replace('_', ' ')}</Badge></TableCell>
                  {role === 'FinanceManager' && <TableCell>{inv.supplierId || 'N/A'}</TableCell>}
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" title="View Details"><Eye className="h-4 w-4" /></Button>
                    {role === 'FinanceManager' && inv.status === 'pending_approval' && (
                        <Button variant="outline" size="sm">Approve</Button>
                    )}
                    <Button variant="ghost" size="icon" title="Download PDF"><Download className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredInvoices.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No invoices match your search or none available.</p>
          )}
        </CardContent>
        {role === 'FinanceManager' && (
            <CardFooter className="pt-4 flex justify-end">
                <Button variant="outline"><Download className="mr-2 h-4 w-4"/>Export All</Button>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
