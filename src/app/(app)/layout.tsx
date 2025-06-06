
"use client";
import { ReactNode, FC } from 'react'; // Added FC
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader as AdminSidebarHeader, // Renamed to avoid conflict with SheetHeader
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from '@/components/common/ThemeToggle';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Added usePathname
import {
  LayoutDashboard, Users, Package, ShoppingCart, Layers, DollarSign,
  Truck, Settings as SettingsIcon, UserCircle, LogOutIcon, Menu, Bell,
  FileArchive, ClipboardCheck, MapIcon, Ship, Home, Search as SearchIcon, ListChecks, Aperture // Aperture still needed for main header
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

interface LayoutProps {
  children: ReactNode;
}

const AdminLayout: FC<LayoutProps> = ({ children }) => {
  const { logout } = useAuth();
  const sidebarContext = useSidebar();
  const pathname = usePathname(); // Get current pathname

  if (!sidebarContext) {
    return <div className="flex items-center justify-center min-h-screen">Error: Sidebar context not found.</div>;
  }
  const { searchTerm, setSearchTerm } = sidebarContext;

  const mainAdminNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/products', label: 'Products', icon: Package },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/customizations', label: 'Customizations', icon: Layers },
    { href: '/admin/payments', label: 'Payments', icon: DollarSign },
    // { href: '/admin/dispatch', label: 'Dispatch Center', icon: Aperture }, // Removed Dispatch Center
    { href: '/admin/shipping', label: 'Shipping', icon: Ship },
    { href: '/admin/approvals', label: 'Approvals', icon: ClipboardCheck },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell },
    { href: '/admin/reports', label: 'Reports', icon: FileArchive },
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
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Mobile Sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[var(--sidebar-width-mobile,280px)] p-0 bg-sidebar text-sidebar-foreground flex flex-col">
                <SheetHeader className="p-4 border-b border-sidebar h-16 flex items-center">
                   <SheetTitle className="text-lg font-semibold">Admin Menu</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <SidebarMenu className="p-2">
                    {mainAdminNavItems.map((item) => {
                       const directMatch = item.href === pathname;
                       const subItemMatch = (item as any).subItems?.some((sub: any) => sub.href === pathname);
                       const isActive = directMatch || subItemMatch;
                      return (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href} passHref legacyBehavior>
                          <SidebarMenuButton 
                            asChild 
                            className="w-full justify-start" 
                            variant="ghost" 
                            onClick={() => sidebarContext.setOpenMobile(false)}
                            isActive={isActive}
                           >
                            <a><item.icon className="mr-2 h-4 w-4" /><span>{item.label}</span></a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    )})}
                  </SidebarMenu>
                </ScrollArea>
                <SidebarFooter className="p-2 border-t border-sidebar">
                  <SidebarMenu className="p-0">
                    {footerAdminNavItems.map((item) => (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href} passHref legacyBehavior>
                          <SidebarMenuButton 
                            asChild 
                            className="w-full justify-start" 
                            variant="ghost" 
                            onClick={() => sidebarContext.setOpenMobile(false)}
                            isActive={item.href === pathname}
                          >
                            <a><item.icon className="mr-2 h-4 w-4" /><span>{item.label}</span></a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                  <div className="p-2 mt-1"><ThemeToggle /></div>
                  <div className="mt-1 p-2">
                    <Button variant="outline" onClick={() => { logout(); sidebarContext.setOpenMobile(false); }} className="w-full justify-start">
                      <LogOutIcon className="mr-2 h-4 w-4" /><span>Logout</span>
                    </Button>
                  </div>
                </SidebarFooter>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="hidden md:flex items-center gap-2" aria-label="Admin Dashboard Home">
               <Aperture className="text-primary h-6 w-6" />
               <h1 className="text-xl font-semibold font-headline">Admin Panel</h1>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4"> {/* Removed flex-1 from here */}
            <div className="relative w-full max-w-xs sm:max-w-sm md:w-64 lg:w-96"> {/* Removed flex-grow */}
               <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search sections..."
                className="h-9 w-full pl-8"
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
      
      <div className="flex flex-1" style={{ height: 'calc(100vh - var(--header-height))' }}>
        <Sidebar
          side="left"
          className="border-r border-sidebar w-[var(--sidebar-width)] sticky top-[var(--header-height)] hidden md:flex flex-col" 
          style={{ height: 'calc(100vh - var(--header-height))' }}
        >
          <AdminSidebarHeader className="h-16 border-b border-sidebar flex-shrink-0" /> {/* Simplified header */}
          <SidebarContent className="flex-1 overflow-y-auto">
            <ScrollArea className="h-full">
              {filteredMainAdminNavItems.length > 0 ? (
                <SidebarMenu className="p-2">
                  {filteredMainAdminNavItems.map((item) => {
                    const typedItem = item as any; // To access subItems
                    const directMatch = typedItem.href === pathname;
                    const childMatch = typedItem.subItems?.some((sub: any) => sub.href === pathname);
                    const isActive = directMatch || childMatch;

                    return typedItem.subItems && typedItem.subItems.length > 0 ? (
                      <SidebarMenuItem key={typedItem.label}>
                         <SidebarMenuButton
                          isCollapsible={true}
                          className="w-full justify-start"
                          variant="ghost"
                          isActive={isActive} // Apply active state to parent
                        >
                          <typedItem.icon className="mr-2 h-4 w-4" />
                          <span>{typedItem.label}</span>
                        </SidebarMenuButton>
                        <SidebarMenuSub>
                          {typedItem.subItems.map((subItem: any) => (
                             <SidebarMenuSubItem key={subItem.label}>
                              <Link href={subItem.href} passHref legacyBehavior>
                                <SidebarMenuSubButton isActive={subItem.href === pathname}>
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
                          isActive={isActive}
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
                <p className="p-4 text-sm text-muted-foreground">No admin sections found for "{searchTerm}".</p>
              )}
            </ScrollArea>
          </SidebarContent>
          <SidebarFooter className="p-2 border-t border-sidebar flex-shrink-0">
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
                        isActive={item.href === pathname}
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
            <div className="mt-1 p-2">
              <Button variant="outline" onClick={logout} className="w-full justify-start">
                <LogOutIcon className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}

const NonAdminLayout: FC<LayoutProps> = ({ children }) => {
  const { user, role, logout } = useAuth();
  const { cartTotalItems } = useCart();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <Logo iconSize={28} textSize="text-2xl" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && role === 'Customer' && (
              <Link href="/orders/cart" passHref>
                <Button variant="ghost" size="icon" aria-label="Cart" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartTotalItems > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {cartTotalItems}
                    </span>
                  )}
                </Button>
              </Link>
            )}
             {user && role && !['Customer', 'Admin'].includes(role) && (
                 <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
                    <LogOutIcon className="h-5 w-5" />
                 </Button>
            )}
            {user && role && !['Customer', 'Admin'].includes(role) && (
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" /><span className="sr-only">Open menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[280px] p-0 bg-card text-card-foreground flex flex-col">
                        <SheetHeader className="p-4 border-b">
                            <SheetTitle>Menu</SheetTitle>
                        </SheetHeader>
                        <nav className="py-4 px-2 flex-1">
                            <Link href="/dashboard" className="flex items-center p-2 rounded-md hover:bg-muted"><Home className="mr-2 h-4 w-4" />Dashboard</Link>
                            {role === 'Technician' && <Link href="/tasks" className="flex items-center p-2 rounded-md hover:bg-muted"><ListChecks className="mr-2 h-4 w-4" />Tasks</Link>}
                            {role === 'Rider' && <Link href="/deliveries" className="flex items-center p-2 rounded-md hover:bg-muted"><Truck className="mr-2 h-4 w-4" />Deliveries</Link>}
                            <Link href="/profile" className="flex items-center p-2 rounded-md hover:bg-muted"><UserCircle className="mr-2 h-4 w-4" />Profile</Link>
                        </nav>
                        <div className="p-4 border-t">
                          <Button variant="outline" onClick={logout} className="w-full justify-start"><LogOutIcon className="mr-2 h-4 w-4" />Logout</Button>
                        </div>
                    </SheetContent>
                </Sheet>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6" style={{paddingBottom: user && role !== 'Admin' ? 'calc(var(--bottom-nav-height, 4rem) + 1rem)' : '1rem'}}>
        {children}
      </main>
      {user && role !== 'Admin' && <BottomNav />}
    </div>
  );
};

export default function AppGroupLayout({ children }: LayoutProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (role === 'Admin') {
    return <SidebarProvider><AdminLayout>{children}</AdminLayout></SidebarProvider>;
  }
  
  return <NonAdminLayout>{children}</NonAdminLayout>;
}
    
