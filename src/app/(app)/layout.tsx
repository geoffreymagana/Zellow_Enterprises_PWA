
"use client";

import { BottomNav } from '@/components/navigation/BottomNav';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, ReactNode } from 'react';
import { Loader2, Users, Package, ShoppingCart, DollarSign, Truck, ClipboardCheck, FileArchive, Settings as SettingsIcon, LayoutDashboard, UserCircle, Layers, LogOutIcon, Aperture, Bell, Ship, MapIcon, ChevronLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  useSidebar,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';


function AdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const { searchTerm, setSearchTerm } = useSidebar()!; 

  const mainAdminNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/customizations', label: 'Customizations', icon: Layers },
    { href: '/admin/payments', label: 'Payments', icon: DollarSign },
    { href: '/admin/deliveries', label: 'Deliveries', icon: Truck },
    { href: '/admin/dispatch', label: 'Dispatch Center', icon: Aperture },
    { href: '/admin/shipping', label: 'Shipping', icon: Ship },
    { href: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    { href: '/admin/reports', label: 'Reports', icon: FileArchive },
    { href: '/rider/map', label: 'Rider Map', icon: MapIcon },
  ];

  const footerAdminNavItems = [
    { href: '/profile', label: 'Profile', icon: UserCircle },
    { href: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ];

  const filteredMainAdminNavItems = mainAdminNavItems
    .map(item => {
      if (!searchTerm) return { ...item, isVisible: true }; 

      const labelMatches = item.label.toLowerCase().includes(searchTerm.toLowerCase());
      
      const subItems = (item as any).subItems; 
      if (subItems && subItems.length > 0) {
        const filteredSubItems = subItems.filter((subItem: any) =>
          subItem.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const isVisible = labelMatches || filteredSubItems.length > 0;
        return { ...item, subItems: isVisible ? (labelMatches ? subItems : filteredSubItems) : [], isVisible };
      }
      return { ...item, isVisible: labelMatches };
    })
    .filter(item => item.isVisible);


  const filteredFooterAdminNavItems = footerAdminNavItems.filter(item =>
    !searchTerm || item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        side="left"
        className="border-r border-sidebar w-[var(--sidebar-width)] h-screen sticky top-0"
      >
        <SidebarHeader className="p-4 border-b border-sidebar flex justify-start items-center h-16">
          <Link href="/" aria-label="Zellow Enterprises Home">
            <Aperture className="text-primary" size={24} />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="h-full">
            {filteredMainAdminNavItems.length > 0 ? (
              <SidebarMenu className="p-2">
                {filteredMainAdminNavItems.map((item) => {
                  const typedItem = item as any; 
                  return typedItem.subItems && typedItem.subItems.length > 0 ? (
                    <SidebarMenuItem key={typedItem.label}>
                       <SidebarMenuButton
                        isCollapsible={true}
                        className="w-full justify-start"
                        variant="ghost"
                      >
                        <typedItem.icon className="mr-2 h-4 w-4" />
                        <span>{typedItem.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuSub>
                        {typedItem.subItems.map((subItem: any) => (
                           <SidebarMenuSubItem key={subItem.label}>
                            <Link href={subItem.href} passHref legacyBehavior>
                              <SidebarMenuSubButton>
                                {subItem.icon && <subItem.icon className="mr-2 h-4 w-4" />}
                                <span>{subItem.label}</span>
                              </SidebarMenuSubButton>
                            </Link>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  ) : (
                  <SidebarMenuItem key={typedItem.label}>
                    <Link href={typedItem.href!} passHref legacyBehavior>
                      <SidebarMenuButton
                        asChild
                        tooltip={typedItem.label}
                        className="w-full justify-start"
                        variant="ghost"
                      >
                        <a>
                          <typedItem.icon className="mr-2 h-4 w-4" />
                          <span>{typedItem.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            ) : null}
             {searchTerm && filteredMainAdminNavItems.length === 0 && filteredFooterAdminNavItems.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No admin sections found.</p>
            )}
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="p-2 border-t border-sidebar mt-auto">
          {filteredFooterAdminNavItems.length > 0 && (
            <SidebarMenu className="p-0">
              {filteredFooterAdminNavItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <Link href={item.href} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.label}
                      className="w-full justify-start"
                      variant="ghost"
                    >
                      <a>
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}
          <div className="p-2 mt-1 md:hidden"> 
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
      
      <div className="flex flex-col flex-1 min-w-0"> 
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" /> 
              <Link href="/dashboard" className="hidden md:flex items-center gap-2" aria-label="Admin Dashboard Home">
                 <Aperture className="text-primary h-6 w-6" />
                 <h1 className="text-xl font-semibold font-headline">Admin Panel</h1>
              </Link>
            </div>
            <div className="flex flex-1 md:flex-none items-center gap-2 sm:gap-4 justify-end">
              <div className="flex-grow max-w-xs sm:max-w-sm md:w-64 lg:w-96">
                <Input
                  type="search"
                  placeholder="Search sections..."
                  className="h-9 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:px-8 lg:py-6">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}

function NonAdminLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 sm:gap-2"> 
            {!isMobile && pathname !== '/dashboard' && !pathname.startsWith('/products') && !pathname.startsWith('/gift-boxes') && ( 
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-1 sm:mr-2">
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
              </Button>
            )}
            <Link href="/dashboard" className="flex items-center gap-2"> 
               <Aperture className="text-primary h-6 w-6 md:h-7 md:w-7" />
               <span className="font-headline text-xl md:text-2xl font-bold text-foreground">
                  <span className="md:hidden">Zellow</span>
                  <span className="hidden md:inline">Zellow Enterprises</span>
               </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>
      <main className="flex-grow w-full mx-auto px-4 py-8 pb-20 md:pb-8">
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
    return (
      <SidebarProvider defaultOpen={true}>
        <AdminLayout>{children}</AdminLayout>
      </SidebarProvider>
    );
  }
  return <NonAdminLayout>{children}</NonAdminLayout>;
}
