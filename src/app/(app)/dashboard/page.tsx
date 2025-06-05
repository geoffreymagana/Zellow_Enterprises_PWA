
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, DollarSign, Package, ShoppingCart, Truck, Users as UsersIcon, Wrench, UserCog, Settings, FileArchive, ClipboardCheck, AlertTriangle, Layers, Loader2, UsersRound, Route, Component, Ship, Bell, MapIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, onSnapshot, Unsubscribe,getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, Order, OrderStatus } from '@/types';

// Helper component for dashboard items
const DashboardItem = ({ title, value, icon: Icon, link, description, isLoadingValue }: { title: string; value: string | number; icon: React.ElementType; link?: string; description?: string, isLoadingValue?: boolean }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoadingValue ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <div className="text-2xl font-bold">{value}</div>}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {link && (
        <Link href={link} passHref>
          <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground mt-1 hover:text-primary">View details</Button>
        </Link>
      )}
    </CardContent>
  </Card>
);


export default function DashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  const [activeUserCount, setActiveUserCount] = useState<number | string>("...");
  const [isLoadingUserCount, setIsLoadingUserCount] = useState(true);

  // Dispatch Manager specific state
  const [activeRidersCount, setActiveRidersCount] = useState<number | string>("...");
  const [isLoadingActiveRiders, setIsLoadingActiveRiders] = useState(true);
  const [ordersAwaitingDispatch, setOrdersAwaitingDispatch] = useState<number | string>("...");
  const [isLoadingOrdersAwaiting, setIsLoadingOrdersAwaiting] = useState(true);
  const [ongoingDeliveries, setOngoingDeliveries] = useState<number | string>("...");
  const [isLoadingOngoingDeliveries, setIsLoadingOngoingDeliveries] = useState(true);


  useEffect(() => {
    let unsubscribers: Unsubscribe[] = [];
    if (!authLoading && db) {
      if (role === 'Admin') {
        setIsLoadingUserCount(true);
        const usersCol = collection(db, 'users');
        const qAdminUsers = query(usersCol, where("disabled", "==", false));
        const unsubAdminUsers = onSnapshot(qAdminUsers, (snapshot) => {
          setActiveUserCount(snapshot.size);
          setIsLoadingUserCount(false);
        }, (error) => {
          console.error("Error fetching active user count:", error);
          setActiveUserCount("Error");
          setIsLoadingUserCount(false);
        });
        unsubscribers.push(unsubAdminUsers);
      } else {
        setIsLoadingUserCount(false);
      }

      if (role === 'DispatchManager' || role === 'Admin') { // Admin might also want to see these stats for their own dashboard, Dispatch Manager for theirs
        setIsLoadingActiveRiders(true);
        setIsLoadingOrdersAwaiting(true);
        setIsLoadingOngoingDeliveries(true);

        const ridersCol = collection(db, 'users');
        const qRiders = query(ridersCol, where("role", "==", "Rider"), where("disabled", "==", false));
        const unsubRiders = onSnapshot(qRiders, (snapshot) => {
          setActiveRidersCount(snapshot.size);
          setIsLoadingActiveRiders(false);
        }, (error) => {
          console.error("Error fetching active riders:", error);
          setActiveRidersCount("Error");
          setIsLoadingActiveRiders(false);
        });
        unsubscribers.push(unsubRiders);

        const ordersCol = collection(db, 'orders');
        const qAwaiting = query(ordersCol, where("status", "==", "awaiting_assignment"));
        const unsubAwaiting = onSnapshot(qAwaiting, (snapshot) => {
          setOrdersAwaitingDispatch(snapshot.size);
          setIsLoadingOrdersAwaiting(false);
        }, (error) => {
          console.error("Error fetching orders awaiting dispatch:", error);
          setOrdersAwaitingDispatch("Error");
          setIsLoadingOrdersAwaiting(false);
        });
        unsubscribers.push(unsubAwaiting);
        
        const qOngoingStatuses: OrderStatus[] = ['assigned', 'out_for_delivery'];
        const qOngoingDeliveries = query(ordersCol, where("status", "in", qOngoingStatuses));
        const unsubOngoing = onSnapshot(qOngoingDeliveries, (snapshot) => {
            setOngoingDeliveries(snapshot.size);
            setIsLoadingOngoingDeliveries(false);
        }, (error) => {
            console.error("Error fetching ongoing deliveries:", error);
            setOngoingDeliveries("Error");
            setIsLoadingOngoingDeliveries(false);
        });
        unsubscribers.push(unsubOngoing);

      } else {
        setIsLoadingActiveRiders(false);
        setIsLoadingOrdersAwaiting(false);
        setIsLoadingOngoingDeliveries(false);
      }
    }
    return () => unsubscribers.forEach(unsub => unsub());
  }, [authLoading, role]);


  if (authLoading || !user) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const getRoleSpecificGreeting = () => {
    switch (role) {
      case 'Admin': return "Admin Control Panel";
      case 'Customer': return "Welcome, valued Customer!";
      case 'Technician': return "Technician Dashboard";
      case 'Rider': return "Rider Dashboard";
      case 'Supplier': return "Supplier Portal";
      case 'SupplyManager': return "Supply Management";
      case 'FinanceManager': return "Finance Overview";
      case 'ServiceManager': return "Service Management";
      case 'InventoryManager': return "Inventory Control";
      case 'DispatchManager': return "Dispatch Center Overview";
      default: return "Welcome to Zellow Enterprises";
    }
  };
  
  const getRoleSpecificItems = () => {
    switch (role) {
      case 'Admin':
        return (
          <>
            <DashboardItem title="Active Users" value={activeUserCount} icon={UserCog} link="/admin/users" description="Manage active users and roles." isLoadingValue={isLoadingUserCount} />
            <DashboardItem title="Product Catalog" value={"View"} icon={Package} link="/admin/products" description="Manage all products." />
            <DashboardItem title="Order Processing" value={"View"} icon={ShoppingCart} link="/admin/orders" description="Oversee all customer orders." />
            <DashboardItem title="Payment Records" value={"View"} icon={DollarSign} link="/admin/payments" description="View financial transactions." />
            <DashboardItem title="Delivery Logistics" value={"View"} icon={Truck} link="/admin/deliveries" description="Track and manage deliveries." />
            <DashboardItem title="Service Approvals" value={"View"} icon={ClipboardCheck} link="/admin/approvals" description="Review pending requests." />
            <DashboardItem title="System Reports" value={"View"} icon={FileArchive} link="/admin/reports" description="Generate and view reports." />
            <DashboardItem title="Customization Hub" value={"View"} icon={Layers} link="/admin/customizations" description="Manage customization options." />
             <DashboardItem title="Shipping Config" value={"Manage"} icon={Ship} link="/admin/shipping" description="Configure shipping options." />
            <DashboardItem title="Notifications" value={"Check"} icon={Bell} link="/admin/notifications" description="View system notifications." />
            <DashboardItem title="System Settings" value={"Configure"} icon={Settings} link="/admin/settings" description="Configure application settings." />
          </>
        );
      case 'DispatchManager':
        return (
          <>
            <DashboardItem title="Active Riders" value={activeRidersCount} icon={UsersRound} link="/admin/users?role=Rider" description="View available riders." isLoadingValue={isLoadingActiveRiders} />
            <DashboardItem title="Awaiting Dispatch" value={ordersAwaitingDispatch} icon={Package} link="/admin/dispatch" description="Orders ready for assignment." isLoadingValue={isLoadingOrdersAwaiting} />
            <DashboardItem title="Ongoing Deliveries" value={ongoingDeliveries} icon={Route} link="/admin/dispatch" description="Track deliveries in progress." isLoadingValue={isLoadingOngoingDeliveries} />
            <DashboardItem title="Full Dispatch Center" value={"Open"} icon={Component} link="/admin/dispatch" description="Access all dispatch tools." />
          </>
        );
      case 'Customer':
        return (
          <>
            <DashboardItem title="Active Orders" value={3} icon={ShoppingCart} link="/orders" />
            <DashboardItem title="Wishlist Items" value={12} icon={Package} link="/products" />
            <DashboardItem title="Browse Services" value={5} icon={Layers} link="/services" />
            <DashboardItem title="Gift Customizations" value={2} icon={UsersIcon} link="/customizations/gift" />
          </>
        );
      case 'Technician':
        return (
          <>
            <DashboardItem title="Assigned Tasks" value={7} icon={Wrench} link="/tasks" />
            <DashboardItem title="Pending Approvals" value={2} icon={AlertTriangle} />
            <DashboardItem title="Completed Today" value={4} icon={Wrench} />
          </>
        );
       case 'Rider':
        return (
          <>
            <DashboardItem title="Active Deliveries" value={5} icon={Truck} link="/deliveries" />
            <DashboardItem title="Completed Today" value={11} icon={Truck} />
            <DashboardItem title="View Route Map" value={"Open"} icon={MapIcon} link="/rider/map" />
          </>
        );
      default:
        return <div className="col-span-full"><Alert><AlertTitle>No specific items for your role.</AlertTitle><AlertDescription>Explore available sections via navigation or contact support if your role is unassigned. Your current role is: {role || 'Not Assigned'}</AlertDescription></Alert></div>;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">{getRoleSpecificGreeting()}</h1>
      <p className="text-muted-foreground">
        Hello, {user.displayName || user.email}! Your role is: <span className="font-semibold text-primary">{role || 'Not Assigned'}</span>.
      </p>
      
      {role !== 'Admin' && role !== 'Customer' && role !== 'DispatchManager' && (
        <Alert>
          <BarChart className="h-4 w-4 mr-2" />
          <AlertTitle>Real-time Updates</AlertTitle>
          <AlertDescription>
            This dashboard will show real-time data once connected to Firestore. Placeholder values are shown for some items.
          </AlertDescription>
        </Alert>
      )}
       {role === 'Admin' && (
        <Alert variant="default" className="border-primary/50 bg-primary/5 text-primary-foreground-muted">
          <AlertTriangle className="h-4 w-4 mr-2 text-primary" />
          <AlertTitle className="text-primary">Admin Panel Active</AlertTitle>
          <AlertDescription className="text-primary/90">
            You have administrative privileges. Manage system data and operations from here. Some data is live, some is placeholder.
          </AlertDescription>
        </Alert>
      )}
      {role === 'DispatchManager' && (
        <Alert variant="default" className="border-blue-500/50 bg-blue-500/5 text-blue-700 dark:text-blue-300">
          <Component className="h-4 w-4 mr-2 text-blue-500" />
          <AlertTitle className="text-blue-600 dark:text-blue-400">Dispatch Manager Dashboard</AlertTitle>
          <AlertDescription className="text-blue-600/90 dark:text-blue-400/90">
            Oversee delivery operations, assign riders, and track progress from the Dispatch Center. Key metrics are updated in real-time.
          </AlertDescription>
        </Alert>
      )}
      {role === 'Customer' && (
         <Alert variant="default">
          <ShoppingCart className="h-4 w-4 mr-2" />
          <AlertTitle>Welcome to Zellow Enterprises!</AlertTitle>
          <AlertDescription>
            Browse products, manage your orders, and customize items. Placeholder values are currently shown.
          </AlertDescription>
        </Alert>
      )}


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {getRoleSpecificItems()}
      </div>


      {role !== 'Admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {role === 'Customer' && <Link href="/products"><Button><Package className="mr-2 h-4 w-4" />Browse Products</Button></Link>}
            {role === 'Customer' && <Link href="/orders"><Button variant="outline"><ShoppingCart className="mr-2 h-4 w-4" />My Orders</Button></Link>}
            {role === 'Customer' && <Link href="/customizations/gift"><Button variant="outline"><UsersIcon className="mr-2 h-4 w-4" />Customize Gift</Button></Link>}
            {(role === 'Technician' || role === 'ServiceManager') && <Link href="/tasks"><Button>View Tasks</Button></Link>}
            {(role === 'Rider') && <Link href="/deliveries"><Button>Manage Deliveries</Button></Link>}
             {role === 'DispatchManager' && <Link href="/admin/dispatch"><Button><Component className="mr-2 h-4 w-4" />Open Dispatch Center</Button></Link>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


    