
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl md:text-4xl font-headline font-bold text-primary">
            About Us – Zellow Enterprises
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-foreground/90 leading-relaxed">
          <p className="text-lg text-center">
            <strong>Zellow Enterprises</strong> is your one-stop destination for all things gifting. 
            We specialize in <strong>customized gift solutions</strong> that make every occasion more personal, 
            more thoughtful, and more unforgettable. Whether you’re looking to celebrate a birthday, wedding, 
            anniversary, or a spontaneous moment of gratitude — <strong>Zellow helps you say it beautifully.</strong>
          </p>
          
          <p className="text-center text-lg">But we’re more than just a gift shop.</p>

          <Separator />

          <div>
            <h2 className="text-2xl font-headline font-semibold mb-3 text-center text-primary/90">Our Mission</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-xl font-headline">For Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Deliver a smooth, creative, and highly customizable gifting experience.</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-xl font-headline">For Businesses & Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Provide a powerful platform to manage gift production, order tracking, deliveries, and customer interactions — all from one centralized system.</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-2xl font-headline font-semibold mb-4 text-center text-primary/90">With the Zellow App, You Can:</h2>
            <ul className="space-y-3">
              {[
                "Browse a curated collection of gift boxes, hampers, and personalized items",
                "Customize your order with messages, engraving, colors, and more",
                "Schedule and track deliveries to yourself or your giftee",
                "Hide or show prices depending on the surprise you want to deliver",
                "Upload images or instructions for custom designs",
                "Receive notifications when your gift is received or delivered"
              ].map((item, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <Separator />

          <div>
            <h2 className="text-2xl font-headline font-semibold mb-3 text-center text-primary/90">Behind the Scenes</h2>
            <p className="text-center">
              Our admin dashboard helps our internal team manage:
            </p>
            <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-center">
              {[
                "Inventory workflows", "Production workflows", "Order assignments", 
                "Delivery assignments", "Supplier coordination", "Engraving tasks", 
                "Printing tasks", "Payment tracking", "Financial tracking"
              ].map((item, index) => (
                <li key={index} className="p-2 bg-muted/30 rounded-md">{item}</li>
              ))}
            </ul>
          </div>

          <Separator />
          
          <p className="text-lg font-semibold text-center mt-6">
            Whether you’re sending love or managing logistics, <strong>Zellow is built to make gifting seamless, heartfelt, and efficient.</strong>
          </p>
          
          <p className="text-xl font-bold text-primary text-center mt-4">
            Zellow Enterprises – Thoughtfully Gifted. Expertly Managed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
