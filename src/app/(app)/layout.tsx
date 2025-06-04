
"use client";

import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2, Users, Package, ShoppingCart, DollarSign, Truck, ClipboardCheck, FileArchive, Settings as SettingsIcon, LayoutDashboard, UserCircle, Layers, LogOutIcon, Search, Aperture } from 'lucide-react';
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
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

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

  // Navigation items for Admin
  const mainAdminNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/customizations', label: 'Customizations', icon: Layers },
    { href: '/admin/payments', label: 'Payments', icon: DollarSign },
    { href: '/admin/deliveries', label: 'Deliveries', icon: Truck },
    { href: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
    { href: '/admin/reports', label: 'Reports', icon: FileArchive },
  ];

  const footerAdminNavItems = [
    { href: '/profile', label: 'Profile', icon: UserCircle },
    { href: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ];

  if (isAdmin) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen bg-background">
          <Sidebar 
            side="left" 
            className="border-r hidden md:flex bg-card text-card-foreground"
            collapsible="icon" // Enables icon-only collapsed state
          >
            <SidebarHeader className="p-4 border-b flex justify-between items-center h-16">
              {/* Show full logo when expanded, icon only when collapsed */}
              <div className="group-data-[state=expanded]:block hidden">
                <Logo textSize="text-xl" />
              </div>
              <div className="group-data-[state=collapsed]:block hidden text-center w-full">
                <Aperture className="text-primary mx-auto" size={28} />
              </div>
              {/* Desktop Sidebar Toggle - visible in header when sidebar is expanded */}
              <div className="group-data-[state=expanded]:block hidden">
                <SidebarTrigger />
              </div>
            </SidebarHeader>
            <SidebarContent className="flex flex-col"> {/* Ensures content can grow and push footer */}
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search..." className="pl-8 h-9 w-full" />
                </div>
              </div>
              <ScrollArea className="flex-grow">
                <SidebarMenu className="p-2">
                  {mainAdminNavItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                      <Link href={item.href} passHref legacyBehavior>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.label} // Tooltip for collapsed state
                          className="w-full justify-start"
                          variant="ghost"
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
              </ScrollArea>
            </SidebarContent>
            <SidebarFooter className="p-2 border-t mt-auto"> {/* mt-auto pushes to bottom */}
              <SidebarMenu className="p-0"> {/* Remove padding if items have their own */}
                {footerAdminNavItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                     <Link href={item.href} passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        tooltip={item.label}
                        className="w-full justify-start"
                        variant="ghost"
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
              <div className="mt-2 p-2"> {/* Add margin top for separation and padding for button */}
                <Button variant="outline" onClick={logout} className="w-full">
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  <span className="group-data-[state=expanded]:inline hidden">Logout</span>
                </Button>
              </div>
            </SidebarFooter>
          </Sidebar>

          <div className="flex flex-col flex-grow">
            <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
              <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Mobile Sidebar Toggle */}
                <div className="md:hidden">
                   <SidebarTrigger />
                </div>
                {/* Desktop: Show trigger to expand if sidebar is collapsed to icon mode */}
                <div className="hidden md:block">
                  <div className="group-data-[state=collapsed]:block hidden">
                     <SidebarTrigger />
                  </div>
                </div>
                
                <div className="flex-1 text-center md:text-left pl-0 md:pl-2"> {/* Adjust padding */}
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
            </Header>
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
