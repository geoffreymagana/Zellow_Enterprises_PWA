
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
  giftTrackingToken: z.string().optional().describe('The unique token for public gift tracking if recipientCanViewAndTrack is true.'),
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

    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zellow-enterprises.vercel.app';
    let trackingLink = "";

    if (input.canViewAndTrack) {
      if (input.giftTrackingToken) {
        // This link should point to your new gift-tracking mini-site
        trackingLink = `${siteBaseUrl}/gift-tracking?token=${input.giftTrackingToken}`;
      } else {
        // Fallback or internal tracking if token is not available, but ideally it should be
        // This link points to the main app's authenticated tracking.
        trackingLink = `${siteBaseUrl}/track/order/${input.orderId}?ctx=gift_recipient`;
        console.warn(`[GiftNotificationFlow] giftTrackingToken not provided for order ${input.orderId}, but recipient can view/track. Falling back to authenticated link.`);
      }
    }


    if (input.recipientContactMethod === 'email') {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      let emailHtmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #34A7C1; text-align: center;">A Special Gift For You!</h2>
            <p>Hello ${input.recipientName},</p>
            <p>${input.senderName} has sent you a special gift from Zellow Enterprises!</p>
      `;
      if (input.giftMessage) {
        emailHtmlBody += `<p style="margin-top: 15px;"><strong>Their message:</strong></p><p style="border-left: 3px solid #eee; padding-left: 10px; margin-left: 5px; font-style: italic;">${input.giftMessage}</p>`;
      }

      if (input.canViewAndTrack && trackingLink) {
        emailHtmlBody += `
          <p style="margin-top: 20px; text-align: center;">
            <a href="${trackingLink}" style="display: inline-block; background-color: #34A7C1; color: white; padding: 12px 25px; text-align: center; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold;">
              View & Track Your Gift
            </a>
          </p>
        `;
        // Price visibility note is only relevant if they can track and the system would show prices.
        // The new mini-site probably won't show prices by default.
        // if (input.showPricesToRecipient) {
        //   emailHtmlBody += `<p style="font-size: 0.9em; color: #555; text-align: center; margin-top: 5px;"><small>Price information may be visible when you view the order.</small></p>`;
        // } else {
        //   emailHtmlBody += `<p style="font-size: 0.9em; color: #555; text-align: center; margin-top: 5px;"><small>Price information for this gift has been hidden by the sender.</small></p>`;
        // }
      } else {
        emailHtmlBody += `<p style="margin-top: 20px;">Your gift is being processed by Zellow Enterprises and will be on its way soon.</p>`;
      }
      
      emailHtmlBody += `
            <p style="margin-top: 25px;">Thank you,<br/>The Zellow Enterprises Team</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
            <p style="font-size: 0.8em; color: #777; text-align: center;">This is an automated notification. If you have any questions, please contact Zellow Enterprises support.</p>
          </div>
        </div>
      `;
      
      const fromName = process.env.SMTP_FROM_NAME || "Zellow Enterprises";
      const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: input.recipientContactValue,
        subject: `A special gift from ${input.senderName} is on its way!`,
        html: emailHtmlBody,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log('[GiftNotificationFlow] Email sent successfully to:', input.recipientContactValue);
        return {
          success: true,
          message: `Email notification sent to ${input.recipientContactValue}. Tracking link: ${trackingLink || 'N/A'}`,
          trackingLink: trackingLink || undefined,
        };
      } catch (error: any) {
        console.error('[GiftNotificationFlow] Error sending email:', error);
        return {
          success: false,
          message: `Failed to send email notification: ${error.message}. Order was still placed.`,
          trackingLink: trackingLink || undefined, 
        };
      }

    } else if (input.recipientContactMethod === 'phone') {
      let smsBody = `Hello ${input.recipientName}, ${input.senderName} sent you a gift from Zellow!`;
      if (input.giftMessage) smsBody += ` Message: "${input.giftMessage.substring(0, 50)}..."`;
      if (input.canViewAndTrack && trackingLink) smsBody += ` Track: ${trackingLink}`;
      
      console.log(`[GiftNotificationFlow] SIMULATING SMS to ${input.recipientContactValue}: ${smsBody}`);
      return {
        success: true,
        message: `Simulated SMS notification sent to ${input.recipientContactValue}. Tracking link: ${trackingLink || 'N/A'}`,
        trackingLink: trackingLink || undefined,
      };
    }

    return {
      success: false,
      message: `Notification method '${input.recipientContactMethod}' not supported or not implemented.`,
    };
  }
);
