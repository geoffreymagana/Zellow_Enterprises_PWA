
'use server';
/**
 * @fileOverview A Genkit flow to handle sending gift notifications.
 *
 * - sendGiftNotification - Sends a notification to a gift recipient via email or simulates for other methods.
 * - GiftNotificationInput - Input type for the flow.
 * - GiftNotificationOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import nodemailer from 'nodemailer';

const GiftNotificationInputSchema = z.object({
  orderId: z.string().describe('The ID of the gift order.'),
  recipientName: z.string().describe("The recipient's name."),
  recipientContactMethod: z.enum(['email', 'phone', '']).describe("How to contact the recipient ('email', 'phone', or empty if not notifying)."),
  recipientContactValue: z.string().optional().describe("The recipient's email address or phone number."),
  giftMessage: z.string().optional().describe('The gift message from the sender.'),
  senderName: z.string().describe("The sender's name."),
  canViewAndTrack: z.boolean().describe('Whether the recipient can view order details and track the gift.'),
  showPricesToRecipient: z.boolean().describe('Whether to show prices to the recipient in the notification.'),
});
export type GiftNotificationInput = z.infer<typeof GiftNotificationInputSchema>;

const GiftNotificationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().describe('A message indicating the outcome of the notification attempt.'),
  trackingLink: z.string().optional().describe('The generated tracking link for the recipient.'),
});
export type GiftNotificationOutput = z.infer<typeof GiftNotificationOutputSchema>;

export async function sendGiftNotification(input: GiftNotificationInput): Promise<GiftNotificationOutput> {
  return sendGiftNotificationFlow(input);
}

const sendGiftNotificationFlow = ai.defineFlow(
  {
    name: 'sendGiftNotificationFlow',
    inputSchema: GiftNotificationInputSchema,
    outputSchema: GiftNotificationOutputSchema,
  },
  async (input) => {
    console.log('[GiftNotificationFlow] Received input:', JSON.stringify(input, null, 2));

    if (!input.recipientContactMethod || !input.recipientContactValue) {
      console.log('[GiftNotificationFlow] No contact method or value provided. Skipping notification.');
      return {
        success: false,
        message: 'Recipient contact method or value not provided. Notification not sent.',
      };
    }

    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'; 
    const trackingLink = `${siteBaseUrl}/track/order/${input.orderId}`;

    if (input.recipientContactMethod === 'email') {
      // Email sending logic
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      let emailHtmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <p>Hello ${input.recipientName},</p>
          <p>${input.senderName} has sent you a special gift from Zellow Enterprises!</p>
      `;
      if (input.giftMessage) {
        emailHtmlBody += `<p><strong>Their message:</strong></p><p style="border-left: 3px solid #eee; padding-left: 10px; margin-left: 5px; font-style: italic;">${input.giftMessage}</p>`;
      }

      if (input.canViewAndTrack) {
        emailHtmlBody += `<p>You can view your gift details and track its progress here: <a href="${trackingLink}" style="color: #34A7C1; text-decoration: none;">${trackingLink}</a></p>`;
        if (input.showPricesToRecipient) {
          emailHtmlBody += `<p><small>Price information will be visible when you view the order.</small></p>`;
        } else {
          emailHtmlBody += `<p><small>Price information for this gift has been hidden by the sender.</small></p>`;
        }
      } else {
        emailHtmlBody += `<p>Your gift is being processed by Zellow Enterprises and will be on its way soon.</p>`;
      }
      
      emailHtmlBody += `
          <p>Thank you,<br/>The Zellow Enterprises Team</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
          <p style="font-size: 0.8em; color: #777;">This is an automated notification. If you have any questions, please contact Zellow Enterprises support.</p>
        </div>
      `;

      const mailOptions = {
        from: `Zellow Enterprises <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: input.recipientContactValue,
        subject: `A special gift from ${input.senderName} is on its way!`,
        html: emailHtmlBody,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('[GiftNotificationFlow] Email sent successfully to:', input.recipientContactValue);
        return {
          success: true,
          message: `Email notification sent to ${input.recipientContactValue}. Tracking link: ${input.canViewAndTrack ? trackingLink : 'N/A'}`,
          trackingLink: input.canViewAndTrack ? trackingLink : undefined,
        };
      } catch (error: any) {
        console.error('[GiftNotificationFlow] Error sending email:', error);
        return {
          success: false,
          message: `Failed to send email notification: ${error.message}. Order was still placed.`,
          trackingLink: input.canViewAndTrack ? trackingLink : undefined, // Still provide link if applicable
        };
      }

    } else if (input.recipientContactMethod === 'phone') {
      // Simulate SMS
      let smsBody = `Hello ${input.recipientName}, ${input.senderName} sent you a gift from Zellow!`;
      if (input.giftMessage) smsBody += ` Message: "${input.giftMessage.substring(0, 50)}..."`;
      if (input.canViewAndTrack) smsBody += ` Track: ${trackingLink}`;
      
      console.log(`[GiftNotificationFlow] SIMULATING SMS to ${input.recipientContactValue}: ${smsBody}`);
      return {
        success: true,
        message: `Simulated SMS notification sent to ${input.recipientContactValue}. Tracking link: ${input.canViewAndTrack ? trackingLink : 'N/A'}`,
        trackingLink: input.canViewAndTrack ? trackingLink : undefined,
      };
    }

    // Fallback or unhandled contact method
    return {
      success: false,
      message: `Notification method '${input.recipientContactMethod}' not supported or not implemented.`,
    };
  }
);

