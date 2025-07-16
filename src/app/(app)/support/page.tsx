
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline font-bold text-primary">Contact Us</CardTitle>
          <CardDescription>Ways to get in touch with Zellow Enterprises.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
           <section><h2 className="text-xl font-headline font-semibold mb-2 flex items-center"><Mail className="mr-3 h-5 w-5" />Email</h2>
              <div className="space-y-1 pl-2 text-sm">
                <p><strong>Customer Support:</strong> <a href="mailto:support@zellowenterprises.com" className="text-primary hover:underline">support@zellowenterprises.com</a></p>
                <p><strong>Technical Support:</strong> <a href="mailto:tech@zellowenterprises.com" className="text-primary hover:underline">tech@zellowenterprises.com</a></p>
              </div>
          </section>
          <Separator />
          <section><h2 className="text-xl font-headline font-semibold mb-2 flex items-center"><Phone className="mr-3 h-5 w-5" />Phone</h2>
              <div className="space-y-1 pl-2"><p className="text-md font-medium">0742 663 614</p><p className="text-xs text-muted-foreground">(Mon–Sat, 9 AM – 6 PM)</p></div>
          </section>
          <Separator />
          <section><h2 className="text-xl font-headline font-semibold mb-2 flex items-center"><MapPin className="mr-3 h-5 w-5" />Office</h2>
              <div className="space-y-0.5 pl-2 text-sm"><p className="font-medium">Zellow Enterprises HQ</p><p>GTC Office Tower, 5th Floor</p><p>Westlands, Nairobi, Kenya</p></div>
          </section>
          <Separator />
          <div className="text-center pt-4">
              <p className="mb-3 text-muted-foreground">Have a specific question or want to track your messages?</p>
              <Button asChild>
                <Link href="/feedback">Go to Messages</Link>
              </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
