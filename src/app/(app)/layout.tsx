
"use client";

import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2, Users, Package, ShoppingCart, DollarSign, Truck, ClipboardCheck, FileArchive, Settings as SettingsIcon, LayoutDashboard, UserCircle, Layers, LogOutIcon } from 'lucide-react'; // Renamed Settings to SettingsIcon
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarTrigger, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarInset, 
  SidebarFooter 
} from '@/components/ui/sidebar'; // Assuming sidebar components are in ui

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; 
  }

  const isAdmin = role === 'Admin';

  const adminNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/customizations', label: 'Customizations', icon: Layers },
    { href: '/admin/payments', label: 'Payments', icon: DollarSign },
    { href: '/admin/deliveries', label: 'Deliveries', icon: Truck },
    { href: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
    { href: '/admin/reports', label: 'Reports', icon: FileArchive },
    { href: '/admin/settings', label: 'Settings', icon: SettingsIcon }, // Used aliased SettingsIcon
    { href: '/profile', label: 'Profile', icon: UserCircle },
  ];

  if (isAdmin) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen bg-background">
          <Sidebar side="left" className="border-r hidden md:flex bg-card text-card-foreground">
            <SidebarHeader className="p-4 border-b">
              <Logo textSize="text-xl" />
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton 
                        asChild 
                        tooltip={item.label} 
                        className="w-full justify-start"
                        variant="ghost" // Use ghost for sidebar items for better UX
                      >
                        <a> 
                          <item.icon className="mr-2" />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-4 border-t">
              <Button variant="outline" onClick={logout} className="w-full">
                <LogOutIcon className="mr-2 h-4 w-4" /> Logout
              </Button>
            </SidebarFooter>
          </Sidebar>

          <div className="flex flex-col flex-grow">
            <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
              <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="md:hidden">
                   <SidebarTrigger />
                </div>
                {/* Invisible placeholder to keep title centered if trigger is not shown on md+ */}
                <div className="hidden md:w-8"></div> 
                
                <div className="flex-1 text-center md:text-left">
                  <span className="font-headline text-xl font-bold text-foreground">
                    Zellow Enterprises - Admin
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Button variant="ghost" size="icon" onClick={logout} className="md:hidden">
                     <LogOutIcon className="h-5 w-5" />
                     <span className="sr-only">Logout</span>
                  </Button>
                </div>
              </div>
            </header>
            <SidebarInset>
              <main className="flex-grow p-4 md:p-6 lg:p-8">
                {children}
              </main>
            </SidebarInset>
          </div>
        </div>
        <div className="md:hidden"> {/* BottomNav only for mobile admin */}
          <BottomNav />
        </div>
      </SidebarProvider>
    );
  }

  // Original layout for non-admin users
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo className="hidden md:flex" />
          <span className="md:hidden font-headline text-xl font-bold text-foreground">Zellow Enterprises</span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>
      <main className="flex-grow container mx-auto px-4 py-8 pb-20 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
