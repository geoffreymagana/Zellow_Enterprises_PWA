
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl md:text-4xl font-headline font-bold text-primary">
            📞 Contact & Support
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground pt-1">
            Need help? We're always here for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section>
            <h2 className="text-2xl font-headline font-semibold mb-3 text-primary/90 flex items-center">
              <Mail className="mr-3 h-6 w-6" /> Email Support
            </h2>
            <div className="space-y-2 pl-2">
              <p><strong>Customer Support:</strong> <a href="mailto:support@zellowenterprises.com" className="text-primary hover:underline">support@zellowenterprises.com</a></p>
              <p><strong>Business Inquiries:</strong> <a href="mailto:hello@zellowenterprises.com" className="text-primary hover:underline">hello@zellowenterprises.com</a></p>
              <p><strong>Technical Support (App or Dashboard):</strong> <a href="mailto:tech@zellowenterprises.com" className="text-primary hover:underline">tech@zellowenterprises.com</a></p>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="text-2xl font-headline font-semibold mb-3 text-primary/90 flex items-center">
              <Phone className="mr-3 h-6 w-6" /> Phone
            </h2>
            <div className="space-y-1 pl-2">
              <p className="text-lg font-medium">0742 663 614</p>
              <p className="text-sm text-muted-foreground">(Monday–Saturday, 9:00 AM – 6:00 PM)</p>
            </div>
          </section>
          
          <Separator />

          <section>
            <h2 className="text-2xl font-headline font-semibold mb-3 text-primary/90 flex items-center">
              <MapPin className="mr-3 h-6 w-6" /> Physical Office
            </h2>
            <div className="space-y-0.5 pl-2">
              <p className="font-medium">Zellow Enterprises HQ</p>
              <p>GTC Office Tower, 5th Floor</p>
              <p>Westlands, Nairobi, Kenya</p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
