
'use server';
/**
 * @fileOverview A Genkit flow to handle sending order receipts and notifications.
 *
 * - sendOrderReceipt - Sends a receipt notification to a customer and optionally a gift recipient.
 * - ReceiptFlowInput - Input type for the flow.
 * - ReceiptFlowOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import type { Order, PaymentStatus } from '@/types';
import { format } from 'date-fns';

const ReceiptFlowInputSchema = z.object({
  order: z.any().describe('The full order object, matching the Order type from src/types.'),
  emailSubject: z.string().optional().describe('Optional custom subject for the email.'),
});
export type ReceiptFlowInput = z.infer<typeof ReceiptFlowInputSchema>;

const ReceiptFlowOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().describe('A message indicating the outcome of the notification attempt.'),
});
export type ReceiptFlowOutput = z.infer<typeof ReceiptFlowOutputSchema>;

export async function sendOrderReceipt(input: ReceiptFlowInput): Promise<ReceiptFlowOutput> {
  return sendReceiptFlow(input);
}

const generateReceiptPdf = (order: Order): string => {
  const doc = new jsPDF();
  const formatPrice = (price: number): string => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
  
  // Simplified formatDate since it will receive a proper Date object
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? 'Invalid Date' : format(date, 'PP');
  };
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Zellow Enterprises - Order Receipt', 14, 22);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Order ID: ${order.id}`, 14, 32);
  doc.text(`Date Placed: ${formatDate(order.createdAt)}`, 14, 38);

  doc.text(`Billed To:`, 14, 50);
  doc.text(order.customerName, 14, 56);
  if (order.shippingAddress?.addressLine1) doc.text(order.shippingAddress.addressLine1, 14, 62);
  if (order.shippingAddress?.city && order.shippingAddress?.county) doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.county}`, 14, 68);

  let yPos = 80;
  doc.setFont('helvetica', 'bold');
  doc.text('Item', 14, yPos);
  doc.text('Qty', 110, yPos);
  doc.text('Price', 140, yPos);
  doc.text('Total', 170, yPos);
  doc.line(14, yPos + 2, 196, yPos + 2);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  order.items.forEach(item => {
    const itemTotalPrice = item.price * item.quantity;
    doc.text(item.name, 14, yPos);
    doc.text(item.quantity.toString(), 110, yPos);
    doc.text(formatPrice(item.price), 140, yPos);
    doc.text(formatPrice(itemTotalPrice), 170, yPos);
    yPos += 7;
  });

  doc.line(14, yPos, 196, yPos);
  yPos += 8;
  
  doc.text('Subtotal:', 140, yPos);
  doc.text(formatPrice(order.subTotal), 170, yPos);
  yPos += 7;
  
  doc.text('Shipping:', 140, yPos);
  doc.text(formatPrice(order.shippingCost), 170, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 140, yPos);
  doc.text(formatPrice(order.totalAmount), 170, yPos);
  yPos += 10;
  
  if (order.paymentStatus === 'refunded') {
    doc.setFontSize(14);
    doc.setTextColor(220, 53, 69); // Red color for refunded status
    doc.text('REFUNDED', 14, yPos);
    doc.setTextColor(0, 0, 0); // Reset color
    
    // Attempt to find the refund history entry
    const refundHistory = (order.deliveryHistory || []).find(h => 
        (h.status === 'cancelled' || h.status === 'refunded') && 
        h.notes?.toLowerCase().includes('refund')
    );
    if (refundHistory && refundHistory.timestamp) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Refund processed on: ${formatDate(refundHistory.timestamp)}`, 14, yPos + 6);
    }
  }

  return doc.output('datauristring');
};

const sendReceiptFlow = ai.defineFlow(
  {
    name: 'sendReceiptFlow',
    inputSchema: ReceiptFlowInputSchema,
    outputSchema: ReceiptFlowOutputSchema,
  },
  async ({ order, emailSubject }: { order: Order, emailSubject?: string }) => {
    console.log('[ReceiptFlow] Received order for receipt:', order.id);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const receiptPdfDataUri = generateReceiptPdf(order);
    const receiptBase64 = receiptPdfDataUri.substring('data:application/pdf;filename=generated.pdf;base64,'.length);
    
    const emailRecipients: { name: string; email: string }[] = [];
    if (order.customerEmail) {
      emailRecipients.push({ name: order.customerName, email: order.customerEmail });
    }
    // Conditionally add giftee if order is a gift and has been delivered
    if (order.status === 'delivered' && order.isGift && order.giftDetails?.recipientContactMethod === 'email' && order.giftDetails.recipientContactValue) {
      if (!emailRecipients.some(r => r.email === order.giftDetails!.recipientContactValue)) {
        emailRecipients.push({ name: order.giftDetails.recipientName, email: order.giftDetails.recipientContactValue });
      }
    }

    if (emailRecipients.length === 0) {
      return { success: false, message: 'No valid email recipients found for this order.' };
    }

    const fromName = process.env.SMTP_FROM_NAME || "Zellow Enterprises";
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    // Determine email subject and body based on order status or provided subject
    let finalSubject = emailSubject;
    let emailHtmlBody = "";

    if (!finalSubject) {
        switch (order.paymentStatus) {
            case 'paid':
                if (order.status === 'delivered') {
                    finalSubject = `Your Zellow Order #${order.id.substring(0,8)} Has Been Delivered`;
                    emailHtmlBody = `<p>Your order from Zellow Enterprises has been successfully delivered! We've attached a receipt for your records.</p>`;
                } else {
                    finalSubject = `Receipt for Your Zellow Order #${order.id.substring(0,8)}`;
                    emailHtmlBody = `<p>Thank you for your order with Zellow Enterprises. Your payment has been confirmed. We've attached a receipt for your records.</p>`;
                }
                break;
            case 'refunded':
                finalSubject = `Refund Confirmation for Zellow Order #${order.id.substring(0,8)}`;
                emailHtmlBody = `<p>This is a confirmation that your order has been cancelled and your payment has been refunded. A receipt is attached for your records.</p>`;
                break;
            default: // Other statuses, e.g., cancelled with no payment
                finalSubject = `Update on Your Zellow Order #${order.id.substring(0,8)}`;
                emailHtmlBody = `<p>Please find an updated receipt for your order attached. If you have any questions, please contact our support team.</p>`;
                break;
        }
    } else {
        // Use a generic body if a custom subject is provided
        emailHtmlBody = `<p>Please find your order receipt attached. If you have any questions, please contact our support team.</p>`;
    }


    const emailPromises = emailRecipients.map(recipient => {
      const fullHtml = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4CAF50; text-align: center;">Order Update from Zellow!</h2>
            <p>Hello ${recipient.name},</p>
            ${emailHtmlBody}
            <p style="margin-top: 25px;">Thank you for choosing Zellow Enterprises,<br/>The Zellow Team</p>
          </div>
        </div>
      `;

      return transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient.email,
        subject: finalSubject!,
        html: fullHtml,
        attachments: [{
          filename: `Zellow-Receipt-${order.id}.pdf`,
          content: receiptBase64,
          encoding: 'base64',
          contentType: 'application/pdf',
        }],
      });
    });

    try {
      await Promise.all(emailPromises);
      console.log(`[ReceiptFlow] Emails sent successfully for order ${order.id}.`);
      return {
        success: true,
        message: `Receipt sent to ${emailRecipients.map(r => r.email).join(', ')}.`,
      };
    } catch (error: any) {
      console.error(`[ReceiptFlow] Error sending emails for order ${order.id}:`, error);
      return {
        success: false,
        message: `Failed to send email notifications: ${error.message}.`,
      };
    }
  }
);
