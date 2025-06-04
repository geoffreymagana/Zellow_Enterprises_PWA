"use client";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/common/Logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);
  
  if (loading || (!loading && user)) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-pulse">Loading...</div></div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
      <div className="mb-8">
        <Logo iconSize={40} textSize="text-4xl" />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your ZellowLive account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
       <p className="mt-6 text-center text-sm text-muted-foreground">
        New to ZellowLive? <a href="#" className="font-medium text-primary hover:underline">Sign up</a>
      </p>
    </div>
  );
}
