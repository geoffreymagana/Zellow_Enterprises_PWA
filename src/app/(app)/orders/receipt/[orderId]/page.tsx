
"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/common/Logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

const formatDate = (timestamp: any) => {
  if (!timestamp) return 'N/A';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return format(date, 'PP');
};

export default function OrderReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
        router.replace('/login');
        return;
    }

    if (!orderId || !db) {
      setError(orderId ? "Database service unavailable." : "No order ID provided.");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);
      const orderDocRef = doc(db, 'orders', orderId);
      const docSnapshot = await getDoc(orderDocRef);

      if (docSnapshot.exists()) {
        const orderData = { id: docSnapshot.id, ...docSnapshot.data() } as Order;
        // Adjusted permissions to allow relevant managers to view receipts
        if (user && (orderData.customerId === user.uid || ['Admin', 'FinanceManager', 'InventoryManager'].includes(role || ''))) {
          setOrder(orderData);
          setError(null);
        } else {
          setError("You do not have permission to view this receipt.");
          setOrder(null);
        }
      } else {
        setError("Order not found.");
        setOrder(null);
      }
      setLoading(false);
    };
    
    fetchOrder();

  }, [orderId, user, role, authLoading, router]);
  
  const handleGeneratePdf = async () => {
    if (!receiptRef.current || !order) return;
    setIsGeneratingPdf(true);
    toast({ title: "Generating PDF...", description: "Please wait while your receipt is being prepared." });

    const receiptElement = receiptRef.current;
    
    // Temporarily apply a 'printing' class to hide buttons before capture
    receiptElement.classList.add('is-printing');
    
    try {
      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: null, // Use transparent background for canvas
        onclone: (document) => {
           // Ensure the background is white in the cloned document for PDF
           document.body.style.backgroundColor = 'white';
        }
      });

      // Remove the class after capture
      receiptElement.classList.remove('is-printing');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      const ratio = Math.min(pdfWidth / canvasWidth, pdfHeight / canvasHeight);
      const finalImgWidth = canvasWidth * ratio;
      const finalImgHeight = canvasHeight * ratio;

      const xOffset = (pdfWidth - finalImgWidth) / 2;
      const yOffset = 10; // Add some margin from top
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalImgWidth, finalImgHeight);
      return pdf;

    } catch (err: any) {
        receiptElement.classList.remove('is-printing');
        console.error("Error generating PDF:", err);
        toast({ title: "PDF Generation Failed", description: "An error occurred while creating the receipt.", variant: "destructive"});
        return null;
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handlePrint = async () => {
    const pdf = await handleGeneratePdf();
    pdf?.autoPrint();
    window.open(pdf?.output('bloburl'), '_blank');
  };
  
  const handleDownload = async () => {
    const pdf = await handleGeneratePdf();
    pdf?.save(`Zellow-Receipt-${order?.id}.pdf`);
  };


  if (loading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading receipt...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/orders')} variant="outline">
          Back to My Orders
        </Button>
      </div>
    );
  }
  
  if (!order) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-6">Order data could not be loaded.</p>
        <Button onClick={() => router.push('/orders')} variant="outline">Back to My Orders</Button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-container, .receipt-container * { visibility: visible; }
          .receipt-container { position: absolute; left: 0; top: 0; width: 100%; }
          .receipt-actions { display: none !important; }
        }
        .is-printing .receipt-actions {
            display: none !important;
        }
      `}</style>
      <div className="bg-muted/40 min-h-screen p-4 sm:p-8">
          <div ref={receiptRef} className="max-w-3xl mx-auto bg-background p-6 sm:p-8 rounded-lg shadow-lg receipt-container">
              <header className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                  <div>
                      <Logo iconSize={24} textSize="text-xl"/>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">GTC Office Tower, 5th Floor, Westlands, Nairobi</p>
                  </div>
                  <div className="text-left sm:text-right w-full sm:w-auto pt-4 sm:pt-0">
                      <h1 className="text-xl font-bold font-headline text-primary uppercase tracking-wider">Receipt</h1>
                      <p className="text-sm break-all">Order #{order.id}</p>
                      <p className="text-sm text-muted-foreground">Date: {formatDate(order.createdAt)}</p>
                  </div>
              </header>
              
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mb-8">
                  <div>
                      <h2 className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">Billed To</h2>
                      <div className="text-sm space-y-0.5">
                          <p className="font-medium">{order.shippingAddress.fullName}</p>
                          <p>{order.shippingAddress.addressLine1}</p>
                          <p>{order.shippingAddress.city}, {order.shippingAddress.county}</p>
                          <p>{order.customerEmail}</p>
                          <p>{order.shippingAddress.phone}</p>
                      </div>
                  </div>
                  <div className="sm:text-right">
                      <h2 className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">Payment Details</h2>
                      <div className="text-sm space-y-0.5">
                          <p>Method: <span className="capitalize font-medium">{order.paymentMethod?.replace(/_/g, " ")}</span></p>
                          <p>Status: <span className="font-medium text-green-600 capitalize">{order.paymentStatus}</span></p>
                          {order.transactionId && <p className="text-xs">Ref: {order.transactionId}</p>}
                      </div>
                  </div>
              </section>
              
              <section className="mb-8">
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead className="text-left">Item</TableHead>
                              <TableHead className="text-center">Qty</TableHead>
                              <TableHead className="text-right">Unit Price</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {order.items.map((item, index) => (
                              <TableRow key={index}>
                                  <TableCell className="font-medium">{item.name}</TableCell>
                                  <TableCell className="text-center">{item.quantity}</TableCell>
                                  <TableCell className="text-right">{formatPrice(item.price)}</TableCell>
                                  <TableCell className="text-right">{formatPrice(item.price * item.quantity)}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </section>

              <section className="flex justify-end mb-8">
                  <div className="w-full max-w-xs space-y-2 text-sm">
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">{formatPrice(order.subTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Shipping:</span>
                          <span className="font-medium">{formatPrice(order.shippingCost)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                          <span>Grand Total:</span>
                          <span>{formatPrice(order.totalAmount)}</span>
                      </div>
                  </div>
              </section>
              
              <Separator className="my-8"/>

              <footer className="text-center">
                  <p className="text-lg font-semibold mb-2">Thank you for your business!</p>
                  <p className="text-xs text-muted-foreground">If you have any questions, please contact support@zellowenterprises.com</p>
              </footer>

          </div>
          <div className="max-w-3xl mx-auto mt-6 flex flex-col sm:flex-row justify-end items-center gap-2 receipt-actions">
              <Button onClick={handlePrint} disabled={isGeneratingPdf} variant="outline">
                  <Printer className="mr-2 h-4 w-4"/> Print
              </Button>
              <Button onClick={handleDownload} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                  Download PDF
              </Button>
          </div>
      </div>
    </>
  );
}
