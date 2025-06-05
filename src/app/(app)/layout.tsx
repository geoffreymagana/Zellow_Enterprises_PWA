
"use client";

import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2, Users, Package, ShoppingCart, DollarSign, Truck, ClipboardCheck, FileArchive, Settings as SettingsIcon, LayoutDashboard, UserCircle, Layers, LogOutIcon, Search as SearchIcon, Aperture, PanelLeft } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarTrigger, // This will be used for mobile
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarInset, 
  SidebarFooter,
  useSidebar
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const sidebar = useSidebar(); // Get sidebar context for mobile sheet trigger

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar - Always Expanded */}
      <Sidebar 
        side="left" 
        className="border-r hidden md:flex bg-card text-card-foreground w-[var(--sidebar-width)]" // Fixed width for desktop
        // collapsible="none" // Effectively non-collapsible by not providing triggers or width changes
      >
        <SidebarHeader className="p-4 border-b flex justify-start items-center h-16">
          <Logo textSize="text-xl" />
          {/* No desktop collapse trigger here */}
        </SidebarHeader>
        <SidebarContent className="flex flex-col">
          <ScrollArea className="flex-grow">
            <SidebarMenu className="p-2">
              {mainAdminNavItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <Link href={item.href} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label} // Tooltip useful if text might get truncated or for consistency
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
        <SidebarFooter className="p-2 border-t mt-auto">
          <SidebarMenu className="p-0">
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
          {/* ThemeToggle for mobile admin sidebar (Sheet) */}
          {sidebar?.isMobile && (
            <div className="p-2 mt-1">
              <ThemeToggle />
            </div>
          )}
          <div className="mt-2 p-2">
            <Button variant="outline" onClick={logout} className="w-full">
              <LogOutIcon className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <div className="flex flex-col flex-grow">
        <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              {/* Mobile Sidebar Toggle - only for mobile */}
              <div className="md:hidden">
                <SidebarTrigger>
                  <PanelLeft />
                </SidebarTrigger>
              </div>
              {/* No desktop expand trigger here as sidebar is always open */}
              <div className="text-left">
                <span className="font-headline text-xl font-bold text-foreground">
                  Zellow Enterprises - Admin
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Desktop Search Input for Admin */}
              <div className="relative hidden md:block">
                <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-8 h-9 w-[200px] lg:w-[250px] bg-background" />
              </div>
              {/* Mobile Search Icon Button for Admin */}
              {sidebar?.isMobile && (
                <Button variant="ghost" size="icon" aria-label="Search">
                  <SearchIcon className="h-5 w-5" />
                </Button>
              )}
              {/* ThemeToggle: visible on desktop admin */}
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        {/* SidebarInset handles the margin for the always-open desktop sidebar */}
        <SidebarInset> 
          <main className="flex-grow p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </div>
  );
}

function NonAdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
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


export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, role } = useAuth();
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

  if (isAdmin) {
    // For Admin, ensure defaultOpen is true for the provider.
    // The AdminLayout itself will manage how the sidebar is displayed (always open on desktop).
    return (
      <SidebarProvider defaultOpen={true}> 
        <AdminLayout>{children}</AdminLayout>
      </SidebarProvider>
    );
  }

  return <NonAdminLayout>{children}</NonAdminLayout>;
}
    
