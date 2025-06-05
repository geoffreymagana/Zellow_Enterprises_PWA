
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, ListChecks, UserCircle, Package, Truck, FileText, DollarSign, Settings, Warehouse, Users, Layers, MapPin } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[]; // Roles that can see this item. `null` can be included for "Not Assigned".
}

const allAppRoles: UserRole[] = ['Customer', 'Technician', 'Rider', 'Supplier', 'SupplyManager', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: [...allAppRoles, null] }, // Accessible to all authenticated users, including those with null/unassigned role
  { href: '/products', label: 'Products', icon: Package, roles: ['Customer'] },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['Customer'] },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: ['Technician', 'ServiceManager'] },
  { href: '/deliveries', label: 'Deliveries', icon: Truck, roles: ['Rider', 'DispatchManager'] },
  { href: '/rider/map', label: 'Route Map', icon: MapPin, roles: ['Rider'] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager', 'SupplyManager'] },
  { href: '/suppliers', label: 'Suppliers', icon: Users, roles: ['SupplyManager'] },
  { href: '/services', label: 'Services', icon: Layers, roles: ['ServiceManager'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: [...allAppRoles, null] }, // Accessible to all authenticated users, including those with null/unassigned role
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();

  if (!user) return null; // Don't show if not logged in

  // Filter items: show item if its `roles` array includes the current user's role.
  // `role` from useAuth() can be a specific role string or `null` if not assigned.
  const filteredNavItems = navItems.filter(item => item.roles.includes(role));
  
  // Ensure a sensible number of items, e.g., max 5. Prioritize common items or implement scrolling / "more" tab.
  // This is a simplified version; a real app might need more sophisticated logic for tab visibility.
  let displayItems = filteredNavItems;
  if (displayItems.length > 5) {
    // Basic prioritization: Home, Profile, and then the first 3 role-specific items
    const homeItem = displayItems.find(item => item.href === '/dashboard');
    const profileItem = displayItems.find(item => item.href === '/profile');
    const otherItems = displayItems.filter(item => item.href !== '/dashboard' && item.href !== '/profile');
    
    const prioritizedItems = [];
    if (homeItem) prioritizedItems.push(homeItem);
    prioritizedItems.push(...otherItems.slice(0, profileItem ? 3 : 4)); // Take 3 others if profile exists, else 4
    if (profileItem && prioritizedItems.length < 5) prioritizedItems.push(profileItem);
    
    displayItems = prioritizedItems.slice(0, 5); // Ensure max 5
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
