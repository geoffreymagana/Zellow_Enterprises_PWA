
'use server';
/**
 * @fileOverview A Genkit flow to handle sending delivery confirmation emails with PDF receipts.
 *
 * - sendDeliveryConfirmation - Sends a notification with receipt to a customer and optionally a gift recipient.
 * - DeliveryConfirmationInput - Input type for the flow.
 * - DeliveryConfirmationOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';
import { jsPDF } from 'jspdf';
import type { Order } from '@/types';
import { format } from 'date-fns';

const DeliveryConfirmationInputSchema = z.object({
  order: z.any().describe('The full order object, matching the Order type from src/types.'),
});
export type DeliveryConfirmationInput = z.infer<typeof DeliveryConfirmationInputSchema>;

const DeliveryConfirmationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().describe('A message indicating the outcome of the notification attempt.'),
});
export type DeliveryConfirmationOutput = z.infer<typeof DeliveryConfirmationOutputSchema>;

export async function sendDeliveryConfirmation(input: DeliveryConfirmationInput): Promise<DeliveryConfirmationOutput> {
  return sendDeliveryConfirmationFlow(input);
}

const generateReceiptPdf = (order: Order): string => {
  const doc = new jsPDF();
  const formatPrice = (price: number): string => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
  const formatDate = (timestamp: any) => timestamp?.toDate ? format(timestamp.toDate(), 'PP') : 'N/A';
  
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Zellow Enterprises - Order Receipt', 14, 22);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Order ID: ${order.id}`, 14, 32);
  doc.text(`Date: ${formatDate(order.createdAt)}`, 14, 38);

  doc.text(`Billed To:`, 14, 50);
  doc.text(order.customerName, 14, 56);
  doc.text(order.shippingAddress.addressLine1, 14, 62);
  doc.text(`${order.shippingAddress.city}, ${order.shippingAddress.county}`, 14, 68);

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
    doc.text(item.name, 14, yPos);
    doc.text(item.quantity.toString(), 110, yPos);
    doc.text(formatPrice(item.price), 140, yPos);
    doc.text(formatPrice(item.price * item.quantity), 170, yPos);
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
  
  return doc.output('datauristring');
};

const sendDeliveryConfirmationFlow = ai.defineFlow(
  {
    name: 'sendDeliveryConfirmationFlow',
    inputSchema: DeliveryConfirmationInputSchema,
    outputSchema: DeliveryConfirmationOutputSchema,
  },
  async ({ order }: { order: Order }) => {
    console.log('[DeliveryConfirmationFlow] Received order:', order.id);

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
    if (order.isGift && order.giftDetails?.recipientContactMethod === 'email' && order.giftDetails.recipientContactValue) {
      // Avoid duplicate emails if customer is also recipient
      if (!emailRecipients.some(r => r.email === order.giftDetails!.recipientContactValue)) {
        emailRecipients.push({ name: order.giftDetails.recipientName, email: order.giftDetails.recipientContactValue });
      }
    }

    if (emailRecipients.length === 0) {
      return { success: false, message: 'No valid email recipients found for this order.' };
    }

    const fromName = process.env.SMTP_FROM_NAME || "Zellow Enterprises";
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

    const emailPromises = emailRecipients.map(recipient => {
      const isGifter = recipient.email === order.customerEmail;
      
      let emailHtmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4CAF50; text-align: center;">Delivery Completed!</h2>
            <p>Hello ${recipient.name},</p>
            <p>${isGifter ? 'Your order' : 'A gift sent to you'} from Zellow Enterprises has been successfully delivered!</p>
            ${isGifter ? `<p>We hope you (and your recipient) love it! We've attached a receipt for your records.</p>` : `<p>We hope you enjoy your special gift! A receipt is attached for your reference.</p>`}
            <p style="margin-top: 25px;">Thank you for choosing Zellow Enterprises,<br/>The Zellow Team</p>
          </div>
        </div>
      `;

      return transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: recipient.email,
        subject: `Your Zellow Order #${order.id.substring(0,8)} Has Been Delivered`,
        html: emailHtmlBody,
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
      console.log(`[DeliveryConfirmationFlow] Emails sent successfully for order ${order.id}.`);
      return {
        success: true,
        message: `Delivery confirmation sent to ${emailRecipients.map(r => r.email).join(', ')}.`,
      };
    } catch (error: any) {
      console.error(`[DeliveryConfirmationFlow] Error sending emails for order ${order.id}:`, error);
      return {
        success: false,
        message: `Failed to send email notifications: ${error.message}.`,
      };
    }
  }
);
