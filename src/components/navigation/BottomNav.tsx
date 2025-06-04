"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingCart, ListChecks, UserCircle, Package, Truck, FileText, DollarSign, Settings, Warehouse, Users, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[]; // Roles that can see this item, or 'all' for any authenticated user
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: ['Customer', 'Technician', 'Rider', 'Supplier', 'SupplyManager', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'] },
  { href: '/products', label: 'Products', icon: Package, roles: ['Customer'] },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, roles: ['Customer'] },
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: ['Technician', 'ServiceManager'] },
  { href: '/deliveries', label: 'Deliveries', icon: Truck, roles: ['Rider', 'DispatchManager'] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager', 'SupplyManager'] },
  { href: '/suppliers', label: 'Suppliers', icon: Users, roles: ['SupplyManager'] },
  { href: '/services', label: 'Services', icon: Layers, roles: ['ServiceManager'] },
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: ['Customer', 'Technician', 'Rider', 'Supplier', 'SupplyManager', 'FinanceManager', 'ServiceManager', 'InventoryManager', 'DispatchManager'] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();

  if (!user) return null; // Don't show if not logged in

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(role) || item.roles.includes(user.role) // Ensure role from auth context is used
  );
  
  // Ensure a sensible number of items, e.g., max 5. Prioritize common items or implement scrolling / "more" tab.
  // This is a simplified version; a real app might need more sophisticated logic for tab visibility.
  const displayItems = filteredNavItems.slice(0, 5);


  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg md:hidden">
      <div className="flex justify-around max-w-md mx-auto">
        {displayItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
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
