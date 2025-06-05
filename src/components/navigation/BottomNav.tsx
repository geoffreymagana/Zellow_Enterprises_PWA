
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, ListChecks, UserCircle, Package, Truck, FileText, DollarSign, Settings, Warehouse, Users, Layers, MapPin, SlidersHorizontal, Gift } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const allAppRoles: UserRole[] = ['Customer', 'Technician', 'Rider', 'Supplier', 'SupplyManager', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

// Define all possible navigation items
const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: [...allAppRoles, 'Admin', null] },
  // The general '/products' link is NOT included for 'Customer' role here.
  { href: '/gift-boxes', label: 'Gift Boxes', icon: Gift, roles: ['Customer'] },
  { href: '/orders', label: 'My Orders', icon: ShoppingCart, roles: ['Customer'] },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: ['Technician', 'ServiceManager'] },
  { href: '/deliveries', label: 'My Deliveries', icon: Truck, roles: ['Rider'] },
  { href: '/admin/dispatch', label: 'Dispatch', icon: SlidersHorizontal, roles: ['DispatchManager', 'Admin'] },
  { href: '/rider/map', label: 'Route Map', icon: MapPin, roles: ['Rider'] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager', 'SupplyManager'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: [...allAppRoles, 'Admin', null] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();

  if (!user || role === 'Admin') return null;

  // Filter items based on the current user's role
  const roleSpecificNavItems = navItems.filter(item => item.roles.includes(role));

  // Define the desired order and specific items for customers
  const customerDesiredOrder: NavItem[] = [];
  if (role === 'Customer') {
    const home = roleSpecificNavItems.find(item => item.href === '/dashboard'); // Home links to dashboard
    const giftBoxes = roleSpecificNavItems.find(item => item.href === '/gift-boxes');
    const orders = roleSpecificNavItems.find(item => item.href === '/orders');
    const profile = roleSpecificNavItems.find(item => item.href === '/profile');

    if (home) customerDesiredOrder.push(home);
    if (giftBoxes) customerDesiredOrder.push(giftBoxes);
    if (orders) customerDesiredOrder.push(orders);
    if (profile) customerDesiredOrder.push(profile);
  }

  let displayItems = role === 'Customer' ? customerDesiredOrder : roleSpecificNavItems;

  // Limit to a maximum of 5 items for the bottom bar for non-customer roles if they exceed it
  if (role !== 'Customer' && displayItems.length > 5) {
    // Basic truncation for other roles if too many items.
    // A more sophisticated approach might define priority items per role.
    displayItems = displayItems.slice(0, 5);
  }


  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg md:hidden">
      <div className="flex justify-around max-w-md mx-auto">
        {displayItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/');
          return (
            <Link key={item.label} href={item.href} legacyBehavior>
              <a className={cn(
                "flex flex-col items-center justify-center p-3 text-muted-foreground hover:text-primary transition-colors w-full",
                isActive && "text-primary"
              )}>
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-xs">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
