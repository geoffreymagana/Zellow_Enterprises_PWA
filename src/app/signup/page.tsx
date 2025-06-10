
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress"; 
import { cn } from "@/lib/utils";

const formSchema = z.object({
  fullName: z.string().min(3, { message: "Full name must be at least 3 characters." }).max(100),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\+?[0-9\s-()]*$/, "Invalid phone number format."),
  email: z.string().email({ message: "Invalid email address." }),
  county: z.string().min(2, { message: "County is required." }),
  town: z.string().min(2, { message: "Town/City is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], 
});

export default function SignUpPage() {
  const { user, loading: authLoading, /* signup function will be needed here later */ } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [currentPassword, setCurrentPassword] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      county: "",
      town: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const calculateStrength = (password: string) => {
    const length = password.length;
    if (length === 0) return 0;
    if (length < 8) return (length / 8) * 30; // Scale up to 30% for under 8 chars
    
    // From 8 characters onwards
    let strength = 40; // Base for 8 chars
    if (length >= 9) strength += 10; // +10 for 9th char
    if (length >= 10) strength += 20; // +20 for 10th char (total +30 from 8)
    if (length >= 11) strength += 15; // +15 for 11th char (total +45 from 8)
    if (length >= 12) strength += 15; // +15 for 12th char (total +60 from 8, reaching 100%)
    
    return Math.min(strength, 100); // Cap at 100
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = event.target.value;
    setCurrentPassword(newPassword);
    setPasswordStrength(calculateStrength(newPassword));
    form.setValue("password", newPassword, { shouldValidate: true }); 
  };


  if (authLoading || (!authLoading && user)) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    console.log("Form submitted with:", values);
    // TODO: Implement actual signup logic using useAuth().signup or similar
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    alert("Sign Up Submitted (Not Implemented Yet) - Check console for values.");
    setIsLoading(false);
  }

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);
  
  const progressColor = passwordStrength >= 40 ? "bg-green-500" : "bg-primary";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 py-12">
      <div className="mb-8">
        <Logo iconSize={40} textSize="text-4xl" />
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-center">Create Your Account</CardTitle>
          <CardDescription className="text-center">
            Join Zellow Enterprises today!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., 0712345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="county"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>County</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Nairobi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="town"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Town / City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Westlands" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => ( 
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field} 
                          value={currentPassword} 
                          onChange={handlePasswordChange} 
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={togglePasswordVisibility}
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    {currentPassword.length > 0 && (
                      <div className="mt-1.5">
                        <Progress value={passwordStrength} className={cn("h-1.5", progressColor === "bg-primary" ? "[&>div]:bg-primary" : "[&>div]:bg-green-500")} />
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          {passwordStrength < 40 && "Weak"}
                          {passwordStrength >= 40 && passwordStrength < 70 && "Okay"}
                          {passwordStrength >= 70 && passwordStrength < 100 && "Good"}
                          {passwordStrength === 100 && "Strong"}
                        </p>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={toggleConfirmPasswordVisibility}
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
       <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign In</Link>
      </p>
    </div>
  );
}
