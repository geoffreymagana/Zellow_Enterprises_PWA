
'use server';
/**
 * @fileOverview A Genkit flow to handle sending gift notifications (simulated).
 *
 * - sendGiftNotification - Simulates sending a notification to a gift recipient.
 * - GiftNotificationInput - Input type for the flow.
 * - GiftNotificationOutput - Output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

    const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9002'; // Fallback for local dev
    const trackingLink = `${siteBaseUrl}/track/order/${input.orderId}`;

    let notificationMessage = `Hello ${input.recipientName},\n\n`;
    notificationMessage += `${input.senderName} has sent you a gift!`;
    if (input.giftMessage) {
      notificationMessage += `\n\nTheir message: "${input.giftMessage}"`;
    }

    if (input.canViewAndTrack) {
      notificationMessage += `\n\nYou can view details and track your gift here: ${trackingLink}`;
    } else {
      notificationMessage += `\n\nYour gift is being processed.`;
    }
    
    // Price information note (not directly in message unless showPricesToRecipient is true and implemented)
    // For now, this flow doesn't construct a message showing prices.
    if (input.showPricesToRecipient) {
        console.log('[GiftNotificationFlow] Prices WOULD be included in the notification if a full template was used.');
    }


    console.log(`[GiftNotificationFlow] SIMULATING NOTIFICATION:`);
    console.log(`--------------------------------------------------`);
    console.log(`To: ${input.recipientContactValue} (via ${input.recipientContactMethod})`);
    console.log(`From: Zellow Enterprises (on behalf of ${input.senderName})`);
    console.log(`Subject: A special gift is on its way!`);
    console.log(`Body:\n${notificationMessage}`);
    console.log(`--------------------------------------------------`);

    // Here you would integrate with an actual email/SMS service
    // For example:
    // if (input.recipientContactMethod === 'email') {
    //   // await sendEmail(input.recipientContactValue, subject, emailBody);
    // } else if (input.recipientContactMethod === 'phone') {
    //   // await sendSms(input.recipientContactValue, smsBody);
    // }

    return {
      success: true,
      message: `Simulated ${input.recipientContactMethod} notification sent to ${input.recipientContactValue}. Tracking link: ${input.canViewAndTrack ? trackingLink : 'N/A'}`,
      trackingLink: input.canViewAndTrack ? trackingLink : undefined,
    };
  }
);
