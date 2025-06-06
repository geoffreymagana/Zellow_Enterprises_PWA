
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, MessageCircleQuestion } from "lucide-react"; // Changed here
import Link from "next/link";

const faqs = [
  {
    question: "1. How do I customize a gift?",
    answer: "On any gift product page, click “Customize” to enter:\n\n- Personal message\n- Engraving text (if applicable)\n- Color preferences\n- Upload any reference images",
  },
  {
    question: "2. Can I hide the price from my giftee?",
    answer: "Yes — during checkout, toggle the “Hide price from giftee” option.",
  },
  {
    question: "3. How do I track my order?",
    answer: "Once your order is placed, go to the Orders section in the app. You’ll see real-time delivery updates and rider status.",
  },
  {
    question: "4. My gift arrived damaged. What should I do?",
    answer: "Please contact us immediately with your order number and a photo of the issue. We'll arrange for a replacement or refund.",
  },
  {
    question: "5. How do I contact the delivery rider?",
    answer: "If your order is out for delivery, the app will show the rider's contact info and location on the tracking screen.",
  },
  {
    question: "6. Can I reschedule delivery?",
    answer: "Yes! Tap “Manage Delivery” in your order summary and choose a new delivery date (subject to availability).",
  },
  {
    question: "7. What payment methods are accepted?",
    answer: "- M-Pesa\n- Credit/Debit Cards\n- Direct Bank Transfer (for approved B2B accounts)",
  },
];

export default function HelpPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <HelpCircle className="h-12 w-12 text-primary mx-auto mb-3" />
          <CardTitle className="text-3xl md:text-4xl font-headline font-bold text-primary">
            Help Center
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-1">
            Welcome to the Zellow Help Center — your go-to space for quick answers and user guidance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h2 className="text-2xl font-headline font-semibold mb-6 text-center text-primary/90">
            💡 Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem 
                value={`item-${index + 1}`} 
                key={index}
                className="border border-border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow data-[state=open]:shadow-lg"
              >
                <AccordionTrigger className="text-left hover:text-primary text-base md:text-lg px-4 py-3 font-medium">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-foreground/80 whitespace-pre-line leading-relaxed px-4 pb-4 pt-0">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-10 text-center">
            <p className="mb-3 text-muted-foreground">Can't find what you're looking for?</p>
            <Link href="/support" passHref>
              <Button size="lg" variant="default" className="rounded-md"> {/* Ensure rounded-md for "rounded square" */}
                <MessageCircleQuestion className="mr-2 h-5 w-5" /> {/* Changed here */}
                Contact Support
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
