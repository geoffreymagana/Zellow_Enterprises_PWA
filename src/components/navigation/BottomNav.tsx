
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

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home, roles: [...allAppRoles, 'Admin', null] }, 
  { href: '/products', label: 'Products', icon: Package, roles: ['Customer'] },
  { href: '/gift-boxes', label: 'Gift Boxes', icon: Gift, roles: ['Customer'] },
  { href: '/orders', label: 'My Orders', icon: ShoppingCart, roles: ['Customer'] }, // Changed label for clarity
  { href: '/tasks', label: 'Tasks', icon: ListChecks, roles: ['Technician', 'ServiceManager'] },
  { href: '/deliveries', label: 'My Deliveries', icon: Truck, roles: ['Rider'] }, 
  { href: '/admin/dispatch', label: 'Dispatch', icon: SlidersHorizontal, roles: ['DispatchManager', 'Admin'] }, 
  { href: '/rider/map', label: 'Route Map', icon: MapPin, roles: ['Rider'] },
  { href: '/invoices', label: 'Invoices', icon: FileText, roles: ['Supplier', 'FinanceManager'] },
  { href: '/payments', label: 'Payments', icon: DollarSign, roles: ['FinanceManager'] },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, roles: ['InventoryManager', 'SupplyManager'] },
  // { href: '/suppliers', label: 'Suppliers', icon: Users, roles: ['SupplyManager'] }, // Consider if needed or part of Admin
  // { href: '/services', label: 'Services', icon: Layers, roles: ['ServiceManager'] }, // Consider if needed or part of Admin
  { href: '/profile', label: 'Profile', icon: UserCircle, roles: [...allAppRoles, 'Admin', null] }, 
];

export function BottomNav() {
  const pathname = usePathname();
  const { role, user } = useAuth();

  if (!user || role === 'Admin') return null; 

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));
  
  let displayItems = filteredNavItems;
  // Prioritize specific items if the list is too long for the bottom bar (max 5)
  if (displayItems.length > 5) {
    const homeItem = displayItems.find(item => item.href === '/dashboard');
    const productsItem = displayItems.find(item => item.label === 'Products');
    const giftBoxesItem = displayItems.find(item => item.label === 'Gift Boxes');
    const ordersItem = displayItems.find(item => item.label === 'My Orders');
    const profileItem = displayItems.find(item => item.href === '/profile');
    
    const priorityOrder: NavItem[] = [];
    if (homeItem) priorityOrder.push(homeItem);
    if (productsItem) priorityOrder.push(productsItem);
    if (giftBoxesItem) priorityOrder.push(giftBoxesItem);
    if (ordersItem) priorityOrder.push(ordersItem);
    if (profileItem) priorityOrder.push(profileItem);

    // Fill remaining spots if any of the prioritized items were not found or if more space
    const remainingSpots = 5 - priorityOrder.length;
    if (remainingSpots > 0) {
        const otherItems = displayItems.filter(
            item => !priorityOrder.some(pItem => pItem.href === item.href)
        );
        priorityOrder.push(...otherItems.slice(0, remainingSpots));
    }
    displayItems = priorityOrder.slice(0, 5);
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
