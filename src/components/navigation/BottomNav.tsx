
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, UserCircle, Package, Truck, FileText, DollarSign, Warehouse, SlidersHorizontal, Gift, ShoppingCart, PackageSearch } from 'lucide-react';
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

const allAppRoles: UserRole[] = ['Customer', 'Technician', 'Rider', 'Supplier', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: [...allAppRoles, 'Admin', null] }, 
  { href: '/gift-boxes', label: 'Gift Boxes', icon: Gift, roles: ['Customer'] },
  { href: '/orders', label: 'My Orders', icon: ShoppingCart, roles: ['Customer'] },
  { href: '/orders/cart', label: 'Cart', icon: ShoppingCart, roles: ['Customer'], showCartCount: true },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: ['Technician', 'ServiceManager'] },
  { href: '/deliveries', label: 'My Deliveries', icon: Truck, roles: ['Rider'] },
  { href: '/admin/dispatch', label: 'Dispatch', icon: SlidersHorizontal, roles: ['DispatchManager', 'Admin'] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/admin/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager', 'Admin'] }, 
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager'] },
  { href: '/inventory/receivership', label: 'Receive Stock', icon: PackageSearch, roles: ['InventoryManager'] },
  { href: '/supplier/stock-requests', label: 'Stock Requests', icon: Warehouse, roles: ['Supplier'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: [...allAppRoles, 'Admin', null] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const { cartTotalItems } = useCart();

  // Do not render BottomNav for Admins using AdminLayout, as they have sidebar + sheet.
  // This condition is now primarily handled by where BottomNav is included in AppGroupLayout.
  // However, adding a direct check here is a safeguard.
  if (!user || role === 'Admin') return null;

  let displayItems: NavItem[] = [];

  if (role === 'Customer') {
    const customerNavMap: Record<string, NavItem | undefined> = {
      '/products': { href: '/products', label: 'Home', icon: Home, roles: ['Customer'] }, 
      '/gift-boxes': navItems.find(item => item.href === '/gift-boxes'),
      '/orders/cart': navItems.find(item => item.href === '/orders/cart'),
      '/profile': navItems.find(item => item.href === '/profile'),
    };
    displayItems = [
        customerNavMap['/products'], 
        customerNavMap['/gift-boxes'],
        customerNavMap['/orders/cart'], 
        customerNavMap['/profile']
    ].filter(Boolean) as NavItem[];
    
  } else {
    displayItems = navItems.filter(item => item.roles.includes(role));
    if (displayItems.length > 5) {
      // Simple priority for managers, ensuring dashboard and profile are likely shown
      const priorityHrefs = ['/dashboard', '/profile'];
      let prioritizedItems = displayItems.filter(item => priorityHrefs.includes(item.href));
      let otherItems = displayItems.filter(item => !priorityHrefs.includes(item.href));
      displayItems = [...prioritizedItems, ...otherItems].slice(0, 5);
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg md:hidden">
      <div className="flex justify-around max-w-md mx-auto">
        {displayItems.map((item) => {
          const isActivePath = (currentPath: string, targetHref: string) => {
            if (targetHref === '/dashboard' || targetHref === '/products') {
              return currentPath === targetHref || (currentPath === '/dashboard' && targetHref === '/products' && role === 'Customer') || (currentPath === '/products' && targetHref === '/dashboard' && role !== 'Customer');
            }
            return currentPath.startsWith(targetHref);
          };
          const isActive = isActivePath(pathname, item.href);

          return (
            <Link key={item.label} href={item.href} legacyBehavior>
              <a className={cn(
                "flex flex-col items-center justify-center p-3 text-muted-foreground hover:text-primary transition-colors w-full relative",
                isActive && "text-primary"
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
