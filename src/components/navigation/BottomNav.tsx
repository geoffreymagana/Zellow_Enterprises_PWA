
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, UserCircle, Package, Truck, FileText, DollarSign, Warehouse, SlidersHorizontal, Gift, ShoppingCart, PackageSearch, BarChart2 } from 'lucide-react';
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

const technicianRoles: UserRole[] = ['Engraving', 'Printing', 'Assembly', 'Quality Check', 'Packaging'];
const allAppRoles: UserRole[] = ['Customer', ...technicianRoles, 'Rider', 'Supplier', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: [...allAppRoles, 'Admin', null] }, 
  { href: '/gift-boxes', label: 'Gift Boxes', icon: Gift, roles: ['Customer'] },
  { href: '/orders', label: 'My Orders', icon: ShoppingCart, roles: ['Customer'] },
  { href: '/orders/cart', label: 'Cart', icon: ShoppingCart, roles: ['Customer'], showCartCount: true },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: [...technicianRoles, 'ServiceManager'] },
  { href: '/deliveries', label: 'My Deliveries', icon: Truck, roles: ['Rider'] },
  { href: '/admin/dispatch', label: 'Dispatch', icon: SlidersHorizontal, roles: ['DispatchManager', 'Admin'] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/admin/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager', 'Admin'] }, 
  { href: '/finance/financials', label: 'Financials', icon: BarChart2, roles: ['FinanceManager'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager'] },
  { href: '/inventory/receivership', label: 'Receive Stock', icon: PackageSearch, roles: ['InventoryManager'] },
  { href: '/supplier/stock-requests', label: 'Stock Requests', icon: Warehouse, roles: ['Supplier'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: [...allAppRoles, 'Admin', null] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const { cartTotalItems } = useCart();

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
      const priorityHrefs = ['/dashboard', '/profile'];
      let prioritizedItems = displayItems.filter(item => priorityHrefs.includes(item.href));
      let otherItems = displayItems.filter(item => !priorityHrefs.includes(item.href));
      // Special handling for FinanceManager to ensure Financials is included if space
      if (role === 'FinanceManager') {
        const financialsItem = navItems.find(item => item.href === '/finance/financials');
        if (financialsItem && !prioritizedItems.some(p => p.href === financialsItem.href) && !otherItems.some(o => o.href === financialsItem.href)) {
           otherItems.unshift(financialsItem); // Add to beginning of other items
        }
      }
      displayItems = [...prioritizedItems, ...otherItems].slice(0, 5);
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg md:hidden">
      <div className="flex justify-around max-w-md mx-auto">
        {displayItems.map((item) => {
          const isActive = (() => {
            const currentPath = pathname;
            const targetHref = item.href;
          
            if (targetHref === '/inventory') {
              if (currentPath === '/inventory') return true;
              if (role === 'InventoryManager' && currentPath === '/dashboard' && !pathname.startsWith('/inventory/receivership')) return true;
              return false;
            }
            if (targetHref === '/inventory/receivership') {
              return currentPath.startsWith('/inventory/receivership');
            }
             if (targetHref === '/finance/financials') {
              return currentPath.startsWith('/finance/financials');
            }
          
            if (role === 'Customer') {
              if ((targetHref === '/products' || targetHref === '/dashboard') && (currentPath === '/products' || currentPath === '/dashboard' || currentPath.startsWith('/products/'))) {
                return true;
              }
            }
            
            if (role !== 'Customer' && targetHref === '/dashboard') {
              if (role === 'InventoryManager' && currentPath.startsWith('/inventory')) return false;
              if (role === 'FinanceManager' && (currentPath.startsWith('/invoices') || currentPath.startsWith('/finance/financials'))) return false;
              return currentPath === '/dashboard';
            }
            
            if (targetHref !== '/dashboard' && targetHref !== '/products' && targetHref !== '/inventory' && targetHref !== '/inventory/receivership' && targetHref !== '/finance/financials') {
              if (currentPath === targetHref || currentPath.startsWith(targetHref + '/')) {
                 const moreSpecificActiveItem = displayItems.find(other => 
                    other.href !== targetHref &&
                    currentPath.startsWith(other.href) &&
                    other.href.length > targetHref.length
                 );
                 if (moreSpecificActiveItem) return false;
                 return true;
              }
            }
            
            return currentPath === targetHref; 
          })();

          return (
            <Link 
              key={item.label} 
              href={item.href} 
              className={cn(
                "flex flex-col items-center justify-center p-3 text-muted-foreground hover:text-primary transition-colors w-full relative",
                isActive && "text-primary"
              )}
            >
              <item.icon className="h-6 w-6 mb-1" />
              <span className="text-xs">{item.label}</span>
              {item.showCartCount && cartTotalItems > 0 && (
                 <span className="absolute top-1 right-1/2 translate-x-[120%] sm:translate-x-[150%] flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {cartTotalItems}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
