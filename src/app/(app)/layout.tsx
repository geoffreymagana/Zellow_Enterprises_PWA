
"use client";
import { ReactNode, FC, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BottomNav } from '@/components/navigation/BottomNav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader as AdminSidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from '@/components/common/ThemeToggle';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard, Users, Package, ShoppingCart, Layers, DollarSign,
  Truck, Settings as SettingsIcon, UserCircle, LogOutIcon, Menu, Bell,
  FileArchive, ClipboardCheck, MapIcon, Ship, Home, Search as SearchIconLucide, ListChecks,
  Aperture, Coins, Warehouse, PackageSearch, BarChart2, FileText, Wrench
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FeedbackThread } from '@/types';

interface LayoutProps {
  children: ReactNode;
}

const AdminLayout: FC<LayoutProps> = ({ children }) => {
  const { user, role, logout } = useAuth();
  const sidebarContext = useSidebar();
  const pathname = usePathname();

  if (!sidebarContext) {
    return <div className="flex items-center justify-center min-h-screen">Error: Sidebar context not found.</div>;
  }
  const { searchTerm, setSearchTerm, setOpenMobile, isMobile } = sidebarContext;

  const baseAdminNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'FinanceManager', 'DispatchManager', 'ServiceManager', 'InventoryManager'] },
    { href: '/admin/users', label: 'Users', icon: Users, roles: ['Admin'] },
    { href: '/admin/products', label: 'Products', icon: Package, roles: ['Admin'] },
    { href: '/inventory', label: 'Inventory Mgt', icon: Warehouse, roles: ['Admin', 'InventoryManager'] },
    { href: '/inventory/receivership', label: 'Receive Stock', icon: PackageSearch, roles: ['Admin', 'InventoryManager'] },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, roles: ['Admin'] }, 
    { href: '/tasks', label: 'Production Tasks', icon: Wrench, roles: ['Admin', 'ServiceManager'] },
    { href: '/admin/customizations', label: 'Customizations', icon: Layers, roles: ['Admin'] },
    { href: '/admin/payments', label: 'Payments', icon: DollarSign, roles: ['Admin', 'FinanceManager'] },
    { href: '/admin/shipping', label: 'Shipping', icon: Ship, roles: ['Admin'] },
    { href: '/admin/approvals', label: 'General Approvals', icon: ClipboardCheck, roles: ['Admin'] }, 
    { href: '/finance/approvals', label: 'Stock Approvals', icon: Coins, roles: ['Admin', 'FinanceManager'] }, 
    { href: '/finance/financials', label: 'Financials', icon: BarChart2, roles: ['Admin', 'FinanceManager'] },
    { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Admin', 'FinanceManager'] },
    { href: '/admin/notifications', label: 'Notifications', icon: Bell, roles: ['Admin'] },
    { href: '/admin/reports', label: 'System Reports', icon: FileArchive, roles: ['Admin'] },
  ];

  const footerAdminNavItems = [
    { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['Admin', 'FinanceManager', 'DispatchManager', 'ServiceManager', 'InventoryManager'] },
    { href: '/admin/settings', label: 'Settings', icon: SettingsIcon, roles: ['Admin'] },
  ];

  let mainAdminNavItemsFilteredByRole = baseAdminNavItems.filter(item => role && item.roles.includes(role));

  if (role === 'Admin') {
    const hiddenForAdminHrefs = [
      '/inventory',
      '/inventory/receivership',
      '/tasks',
      '/finance/approvals',
      '/finance/financials',
      '/invoices'
    ];
    mainAdminNavItemsFilteredByRole = mainAdminNavItemsFilteredByRole.filter(item => !hiddenForAdminHrefs.includes(item.href));
  }
  
  if (role === 'ServiceManager') {
      mainAdminNavItemsFilteredByRole = mainAdminNavItemsFilteredByRole.filter(item => item.href !== '/admin/orders');
  }


  const mainAdminNavItems = mainAdminNavItemsFilteredByRole
    .map(item => {
      if (!searchTerm) return { ...item, isVisible: true };
      const labelMatches = item.label.toLowerCase().includes(searchTerm.toLowerCase());
      return { ...item, isVisible: labelMatches };
    })
    .filter(item => item.isVisible);

  const filteredFooterAdminNavItems = footerAdminNavItems
    .filter(item => role && item.roles.includes(role))
    .filter(item =>
      !searchTerm || item.label.toLowerCase().includes(searchTerm.toLowerCase())
    );


  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[var(--header-height)]">
        <div className="w-full h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Mobile Sidebar</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[var(--sidebar-width-mobile,280px)] p-0 bg-sidebar text-sidebar-foreground flex flex-col">
                <SheetHeader className="p-4 border-b border-sidebar h-[var(--header-height)] flex items-center">
                   <SheetTitle className="text-lg font-semibold">Admin Menu</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <SidebarMenu className="p-2">
                    {mainAdminNavItems.map((item) => { 
                       const isActive = (() => {
                        if (item.href === '/inventory' && pathname.startsWith('/inventory/receivership')) {
                          return false; 
                        }
                        if (item.href === '/inventory' && pathname.startsWith('/admin/products/edit')) {
                          return false; 
                        }
                        return item.href === pathname || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      })();
                      return (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href!}>
                          <SidebarMenuButton
                            className="w-full justify-start"
                            variant="ghost"
                            onClick={() => setOpenMobile(false)}
                            isActive={isActive}
                           >
                            <item.icon className="mr-2 h-4 w-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    )})}
                  </SidebarMenu>
                </ScrollArea>
                <SidebarFooter className="p-2 border-t border-sidebar">
                  <SidebarMenu className="p-0">
                    {filteredFooterAdminNavItems.map((item) => {
                      const isActive = item.href === pathname || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      return (
                      <SidebarMenuItem key={item.label}>
                        <Link href={item.href}>
                          <SidebarMenuButton
                            className="w-full justify-start"
                            variant="ghost"
                            onClick={() => setOpenMobile(false)}
                            isActive={isActive}
                          >
                            <item.icon className="mr-2 h-4 w-4" />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    )})}
                  </SidebarMenu>
                  <div className="p-2 mt-1"><ThemeToggle /></div>
                  <div className="mt-1 p-2">
                    <Button variant="outline" onClick={() => { logout(); setOpenMobile(false); }} className="w-full justify-start">
                      <LogOutIcon className="mr-2 h-4 w-4" /><span>Logout</span>
                    </Button>
                  </div>
                </SidebarFooter>
              </SheetContent>
            </Sheet>
            <Link href="/dashboard" className="hidden md:flex items-center gap-2" aria-label="Admin Dashboard Home">
               <Aperture className="h-6 w-6 text-primary" /> 
               <h1 className="text-xl font-semibold font-headline">Admin Panel</h1>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative w-full max-w-xs sm:max-w-sm md:w-64 lg:w-96">
               <SearchIconLucide className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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

      <div className="flex flex-1">
        <Sidebar
          side="left"
          className="border-r border-sidebar w-[var(--sidebar-width)] sticky top-[var(--header-height)] hidden md:flex flex-col"
          style={{ height: 'calc(100vh - var(--header-height))' }}
        >
          <AdminSidebarHeader className="h-[calc(var(--header-height) - 1px)] border-b border-sidebar flex-shrink-0" />
          <SidebarContent className="flex-1 overflow-y-auto">
            <ScrollArea className="h-full">
              {mainAdminNavItems.length > 0 ? ( 
                <SidebarMenu className="p-2">
                  {mainAdminNavItems.map((item) => { 
                    const isActive = (() => {
                      if (item.href === '/inventory' && pathname.startsWith('/inventory/receivership')) {
                        return false; 
                      }
                      if (item.href === '/inventory' && pathname.startsWith('/admin/products/edit')) {
                        return false;
                      }
                      return item.href === pathname || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                    })();
                    return (
                    <SidebarMenuItem key={item.label}>
                      <Link href={item.href!}>
                        <SidebarMenuButton
                          tooltip={item.label}
                          className="w-full justify-start"
                          variant="ghost"
                          isActive={isActive}
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              ) : null}
               {searchTerm && mainAdminNavItems.length === 0 && filteredFooterAdminNavItems.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No admin sections found for "{searchTerm}".</p>
              )}
            </ScrollArea>
          </SidebarContent>
          <SidebarFooter className="p-2 border-t border-sidebar flex-shrink-0">
            {filteredFooterAdminNavItems.length > 0 && (
              <SidebarMenu className="p-0">
                {filteredFooterAdminNavItems.map((item) => {
                 const isActive = item.href === pathname || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  return (
                  <SidebarMenuItem key={item.label}>
                    <Link href={item.href}>
                      <SidebarMenuButton
                        tooltip={item.label}
                        className="w-full justify-start"
                        variant="ghost"
                        isActive={isActive}
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                )})}
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

        <main 
          className="flex-1 overflow-y-auto p-4 md:p-6 lg:px-8 lg:py-6"
          style={isMobile ? { paddingBottom: 'calc(var(--bottom-nav-height) + 1rem)' } : {}}
        >
          {children}
        </main>
      </div>
      {isMobile && <BottomNav />}
    </div>
  );
}

const NonAdminLayout: FC<LayoutProps> = ({ children }) => {
  const { user, role, logout } = useAuth();
  const { cartTotalItems } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [localSearchTerm, setLocalSearchTerm] = useState(searchParams.get('q') || '');
  const [unreadCount, setUnreadCount] = useState(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const currentQuerySearch = searchParams.get('q') || '';
    if (currentQuerySearch !== localSearchTerm) {
      setLocalSearchTerm(currentQuerySearch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!db || !user || !role) return;

    let q;
    if (role === 'Customer') {
      q = query(collection(db, 'feedbackThreads'), 
        where('senderId', '==', user.uid),
        where('status', 'in', ['open', 'replied'])
      );
    } else {
      q = query(collection(db, 'feedbackThreads'), 
        where('targetRole', '==', role),
        where('status', 'in', ['open', 'replied'])
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach((doc) => {
        const thread = doc.data() as FeedbackThread;
        // Count as unread if the last replier is not the current user
        if (thread.lastReplierRole !== role) {
          count++;
        }
      });
      setUnreadCount(count);
    });

    return () => unsubscribe();
  }, [db, user, role]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = event.target.value;
    setLocalSearchTerm(newSearchTerm);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (newSearchTerm) {
        params.set('q', newSearchTerm);
      } else {
        params.delete('q');
      }
      // Only push to /products or /gift-boxes page for search
      if (pathname === '/products' || pathname === '/gift-boxes') {
         router.push(`${pathname}?${params.toString()}`);
      } else if (newSearchTerm) { 
        // If on another page and user starts searching, redirect to products page with search
        router.push(`/products?${params.toString()}`);
      }
    }, 500); // 500ms debounce
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[var(--header-height)]">
        <div className="container mx-auto h-full flex items-center justify-between px-4 gap-4">
           <div className="relative flex-1 max-w-md sm:max-w-lg md:max-w-xl">
             <SearchIconLucide className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={role === 'Customer' ? "Search products, gift boxes..." : (role === 'InventoryManager' ? "Search inventory..." : "Search...")}
              className="h-9 w-full pl-10"
              value={localSearchTerm}
              onChange={handleSearchChange}
            />
          </div>

          <div className="flex items-center gap-2">
            <Link href="/feedback" passHref>
                <Button variant="ghost" size="icon" aria-label="Feedback Notifications" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </Link>
            {role !== 'Customer' && <ThemeToggle />}
            {user && role === 'Customer' && (
              <Link href="/orders/cart">
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
                        <SheetHeader className="p-4 border-b h-[var(--header-height)]">
                            <SheetTitle>Menu</SheetTitle>
                        </SheetHeader>
                        <ScrollArea className="flex-1">
                          <nav className="py-4 px-2">
                              <Link href="/dashboard" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname === "/dashboard" ? "bg-muted text-primary font-semibold" : ""}`}><Home className="mr-2 h-4 w-4" />Dashboard</Link>
                              {role === 'Technician' && <Link href="/tasks" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/tasks") ? "bg-muted text-primary font-semibold" : ""}`}><ListChecks className="mr-2 h-4 w-4" />Tasks</Link>}
                              {role === 'ServiceManager' && <Link href="/tasks" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/tasks") ? "bg-muted text-primary font-semibold" : ""}`}><Wrench className="mr-2 h-4 w-4" />Team Tasks</Link>}
                              {role === 'Rider' && <Link href="/deliveries" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/deliveries") ? "bg-muted text-primary font-semibold" : ""}`}><Truck className="mr-2 h-4 w-4" />Deliveries</Link>}
                              {role === 'Supplier' && <Link href="/supplier/stock-requests" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/supplier/stock-requests") ? "bg-muted text-primary font-semibold" : ""}`}><Warehouse className="mr-2 h-4 w-4" />Stock Requests</Link>}
                              {role === 'InventoryManager' && (<>
                                <Link href="/inventory" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname === "/inventory" ? "bg-muted text-primary font-semibold" : ""}`}><Package className="mr-2 h-4 w-4" />Inventory</Link>
                                <Link href="/inventory/receivership" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/inventory/receivership") ? "bg-muted text-primary font-semibold" : ""}`}><PackageSearch className="mr-2 h-4 w-4" />Receive Stock</Link>
                              </>)}
                               {role === 'FinanceManager' && (<>
                                <Link href="/invoices" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/invoices") ? "bg-muted text-primary font-semibold" : ""}`}><FileText className="mr-2 h-4 w-4" />Invoices</Link>
                                <Link href="/finance/financials" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/finance/financials") ? "bg-muted text-primary font-semibold" : ""}`}><BarChart2 className="mr-2 h-4 w-4" />Financials</Link>
                                <Link href="/finance/approvals" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname.startsWith("/finance/approvals") ? "bg-muted text-primary font-semibold" : ""}`}><Coins className="mr-2 h-4 w-4" />Stock Approvals</Link>
                              </>)}
                              <Link href="/profile" className={`flex items-center p-2 rounded-md hover:bg-muted ${pathname === "/profile" ? "bg-muted text-primary font-semibold" : ""}`}><UserCircle className="mr-2 h-4 w-4" />Profile</Link>
                          </nav>
                        </ScrollArea>
                        <div className="p-4 border-t">
                          <Button variant="outline" onClick={logout} className="w-full justify-start"><LogOutIcon className="mr-2 h-4 w-4" />Logout</Button>
                        </div>
                    </SheetContent>
                </Sheet>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6" style={{paddingBottom: user && role !== 'Admin' ? 'calc(var(--bottom-nav-height) + 1rem)' : '1rem'}}>
        {children}
      </main>
      {user && role !== 'Admin' && <BottomNav />}
    </div>
  );
};

export default function AppGroupLayout({ children }: LayoutProps) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter(); 

  useEffect(() => {
    if (!loading) {
      if (!user && !['/login', '/signup', '/track/order/[orderId]'].some(p => pathname.startsWith(p.replace('[orderId]', '')))) {
        router.replace('/login');
      }
      if (user && pathname === '/') {
          router.replace('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);


  if (loading || (!user && !['/login', '/signup', '/track/order/[orderId]'].some(p => pathname.startsWith(p.replace('[orderId]', '')))) || (user && pathname === '/')) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  if (!user && (pathname === '/login' || pathname === '/signup')) {
    return <>{children}</>;
  }

  // Allow public access to order tracking page even if no user
  if (pathname.startsWith('/track/order/')) {
    return <>{children}</>;
  }
  
  if (!user) { 
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Awaiting authentication...</div>;
  }


  const isAdminPanelRole = role && ['Admin', 'FinanceManager', 'DispatchManager', 'ServiceManager', 'InventoryManager'].includes(role);


  if (isAdminPanelRole) {
    return <SidebarProvider><AdminLayout>{children}</AdminLayout></SidebarProvider>;
  }

  return <NonAdminLayout>{children}</NonAdminLayout>;
}
