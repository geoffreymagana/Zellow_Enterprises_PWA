
"use client";

import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2, Users, Package, ShoppingCart, DollarSign, Truck, ClipboardCheck, FileArchive, Settings as SettingsIcon, LayoutDashboard, UserCircle, Layers, LogOutIcon, Search as SearchIcon, PanelLeft } from 'lucide-react';
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
  SidebarFooter,
  useSidebar 
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  // No need to call useSidebar() here if sidebar is always expanded on desktop and not changing state via this component directly.
  // The Sidebar component itself and SidebarTrigger will use the context if needed for mobile.

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
      {/* Desktop Sidebar - Always Expanded and Sticky */}
      <Sidebar
        side="left"
        className="border-r hidden md:flex flex-col bg-card text-card-foreground w-[var(--sidebar-width)] h-screen sticky top-0"
      >
        <SidebarHeader className="p-4 border-b flex justify-start items-center h-16">
          {/* Logo for expanded sidebar */}
          <Logo textSize="text-xl" iconSize={24} />
        </SidebarHeader>
        <SidebarContent> {/* Base component is flex-col, flex-1, overflow-auto */}
          <div className="p-2"> {/* Search input wrapper */}
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search sidebar..." className="pl-8 h-9 bg-background focus-visible:ring-sidebar-ring" />
            </div>
          </div>
          <ScrollArea className="h-full"> {/* h-full makes ScrollArea fill SidebarContent */}
            <SidebarMenu className="p-2">
              {mainAdminNavItems.map((item) => (
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
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="p-2 border-t mt-auto"> {/* mt-auto pushes footer to bottom */}
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
          <div className="p-2 mt-1 md:hidden"> {/* ThemeToggle for mobile sidebar (sheet) */}
            <ThemeToggle />
          </div>
          <div className="mt-2 p-2">
            <Button variant="outline" onClick={logout} className="w-full justify-start">
              <LogOutIcon className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* This div wraps the main header and main content area, taking remaining width */}
      <div className="flex flex-col flex-grow">
        <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8"> {/* Ensures header content uses full width of this column */}
            <div className="flex items-center gap-2">
              {/* Mobile Sidebar Toggle - only for mobile */}
              <div className="md:hidden">
                <SidebarTrigger>
                  <PanelLeft />
                </SidebarTrigger>
              </div>
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
                <Input placeholder="Search app..." className="pl-8 h-9 w-[200px] lg:w-[250px] bg-background" />
              </div>
              {/* Mobile Search Icon Button for Admin */}
              <div className="md:hidden">
                <Button variant="ghost" size="icon" aria-label="Search">
                  <SearchIcon className="h-5 w-5" />
                </Button>
              </div>
              <div className="hidden md:block"> {/* ThemeToggle for desktop header */}
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        <main className="flex flex-col flex-grow items-center p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="w-full max-w-7xl"> 
            {children}
          </div>
        </main>
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
  const sidebar = useSidebar(); // Get sidebar context for AppLayout

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
    return (
      // SidebarProvider should wrap any component that uses useSidebar or renders Sidebar/SidebarTrigger
      <SidebarProvider defaultOpen={!sidebar?.isMobile}> 
        <AdminLayout>{children}</AdminLayout>
      </SidebarProvider>
    );
  }

  return <NonAdminLayout>{children}</NonAdminLayout>;
}
    
