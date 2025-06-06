
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, UserCircle, Package, Truck, FileText, DollarSign, Warehouse, SlidersHorizontal, Gift, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { useCart } from '@/contexts/CartContext';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
  showCartCount?: boolean;
}

const allAppRoles: UserRole[] = ['Customer', 'Technician', 'Rider', 'Supplier', 'SupplyManager', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: [...allAppRoles, 'Admin', null] }, // Home for staff, /products for customer below
  { href: '/gift-boxes', label: 'Gift Boxes', icon: Gift, roles: ['Customer'] },
  { href: '/orders', label: 'My Orders', icon: ShoppingCart, roles: ['Customer'] },
  { href: '/orders/cart', label: 'Cart', icon: ShoppingCart, roles: ['Customer'], showCartCount: true },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: ['Technician', 'ServiceManager'] },
  { href: '/deliveries', label: 'My Deliveries', icon: Truck, roles: ['Rider'] },
  { href: '/admin/dispatch', label: 'Dispatch', icon: SlidersHorizontal, roles: ['DispatchManager', 'Admin'] },
  // { href: '/rider/map', label: 'Route Map', icon: MapPin, roles: ['Rider'] }, // Rider map might be better accessed from delivery details
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/admin/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager', 'Admin'] }, // Updated for FinanceManager & Admin
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager', 'SupplyManager'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: [...allAppRoles, 'Admin', null] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const { cartTotalItems } = useCart();

  if (!user || role === 'Admin') return null;

  let displayItems: NavItem[] = [];

  if (role === 'Customer') {
    // Specific order and items for Customer
    const customerNavMap: Record<string, NavItem | undefined> = {
      '/products': { href: '/products', label: 'Home', icon: Home, roles: ['Customer'] }, // 'Home' now links to /products
      '/gift-boxes': navItems.find(item => item.href === '/gift-boxes'),
      '/orders/cart': navItems.find(item => item.href === '/orders/cart'),
      '/orders': navItems.find(item => item.href === '/orders'),
      '/profile': navItems.find(item => item.href === '/profile'),
    };
    displayItems = [
        customerNavMap['/products'], 
        customerNavMap['/gift-boxes'],
        customerNavMap['/orders/cart'], 
        // customerNavMap['/orders'], // My Orders might be less frequently used than cart
        customerNavMap['/profile']
    ].filter(Boolean) as NavItem[];
    
     // Ensure max 4-5 items for customer for good spacing
    if (displayItems.length > 4) { // Example: Keep it to 4 for customers
        // Prioritize essential customer views
        const priority = ['/products', '/gift-boxes', '/orders/cart', '/profile'];
        displayItems = priority.map(href => displayItems.find(item => item.href === href)).filter(Boolean) as NavItem[];
    }


  } else {
    // Filter items based on the current user's role for non-customers
    displayItems = navItems.filter(item => item.roles.includes(role));
    // Limit to a maximum of 5 items for other roles if they exceed it
    if (displayItems.length > 5) {
      // Basic truncation or role-specific priority can be added here
      displayItems = displayItems.slice(0, 5);
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg md:hidden">
      <div className="flex justify-around max-w-md mx-auto">
        {displayItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/products' && pathname.startsWith(item.href) && item.href !== '/');
          const isProductsActiveForCustomerHome = role === 'Customer' && item.href === '/products' && (pathname === '/products' || pathname === '/dashboard');

          return (
            <Link key={item.label} href={item.href} legacyBehavior>
              <a className={cn(
                "flex flex-col items-center justify-center p-3 text-muted-foreground hover:text-primary transition-colors w-full relative",
                (isActive || isProductsActiveForCustomerHome) && "text-primary"
              )}>
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-xs">{item.label}</span>
                {item.showCartCount && cartTotalItems > 0 && (
                   <span className="absolute top-1 right-1/2 translate-x-[120%] sm:translate-x-[150%] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {cartTotalItems}
                  </span>
                )}
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

    