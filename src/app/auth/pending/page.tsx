
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { MailCheck } from "lucide-react";

export default function PendingApprovalPage() {
    const { logout } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
            <div className="mb-8">
                <Logo iconSize={40} textSize="text-4xl" />
            </div>
            <Card className="w-full max-w-md shadow-xl text-center">
                <CardHeader>
                    <MailCheck className="h-16 w-16 text-primary mx-auto mb-4" />
                    <CardTitle className="text-2xl font-headline">
                        Registration Submitted
                    </CardTitle>
                    <CardDescription>
                        Thank you for registering!
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                        Your account is currently awaiting approval from an administrator.
                        You will be notified via email once your account has been approved.
                    </p>
                    <Button onClick={logout} variant="outline" className="w-full">
                        Sign Out
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
