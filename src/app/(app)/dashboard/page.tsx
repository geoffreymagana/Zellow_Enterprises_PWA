
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, DollarSign, Package, ShoppingCart, Truck, Users as UsersIcon, Wrench, UserCog, Settings, FileArchive, ClipboardCheck, AlertTriangle, Layers, Loader2, UsersRound, Route, Component, Ship, Bell, MapIcon, BadgeHelp, MailWarning, Banknote } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, onSnapshot, Unsubscribe, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, Order, OrderStatus } from '@/types';

// Helper component for dashboard items
const DashboardItem = ({ title, value, icon: Icon, link, description, isLoadingValue }: { title: string; value?: string | number; icon: React.ElementType; link?: string; description?: string, isLoadingValue?: boolean }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoadingValue ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : ( value !== undefined && <div className="text-2xl font-bold">{value}</div>)}
      {description && !isLoadingValue && value !== undefined && <p className="text-xs text-muted-foreground">{description}</p>}
      {link && !isLoadingValue && (
        <Link href={link} passHref>
          <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground mt-1 hover:text-primary">
            {value === undefined ? `Go to ${title.toLowerCase()}` : "View details"}
          </Button>
        </Link>
      )}
    </CardContent>
  </Card>
);


export default function DashboardPage() {
  const { user, role, loading: authLoading } = useAuth();
  
  // General Admin stats
  const [activeUserCount, setActiveUserCount] = useState<number | string>("...");
  const [isLoadingUserCount, setIsLoadingUserCount] = useState(true);
  const [totalProductCount, setTotalProductCount] = useState<number | string>("...");
  const [isLoadingProductCount, setIsLoadingProductCount] = useState(true);
  const [totalOrderCount, setTotalOrderCount] = useState<number | string>("...");
  const [isLoadingOrderCount, setIsLoadingOrderCount] = useState(true);
  const [activeDeliveriesCountAdmin, setActiveDeliveriesCountAdmin] = useState<number | string>("...");
  const [isLoadingActiveDeliveriesAdmin, setIsLoadingActiveDeliveriesAdmin] = useState(true);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | string>("...");
  const [isLoadingPendingApprovals, setIsLoadingPendingApprovals] = useState(true);
  const [paymentsTodayCount, setPaymentsTodayCount] = useState<number | string>("...");
  const [isLoadingPaymentsToday, setIsLoadingPaymentsToday] = useState(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number | string>("...");
  const [isLoadingUnreadNotifications, setIsLoadingUnreadNotifications] = useState(true);


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
        setIsLoadingProductCount(true);
        setIsLoadingOrderCount(true);
        setIsLoadingActiveDeliveriesAdmin(true);
        setIsLoadingPendingApprovals(true);
        setIsLoadingPaymentsToday(true);
        setIsLoadingUnreadNotifications(true);

        const usersCol = collection(db, 'users');
        const qAdminUsers = query(usersCol, where("disabled", "==", false));
        const unsubAdminUsers = onSnapshot(qAdminUsers, (snapshot) => {
          setActiveUserCount(snapshot.size);
          setIsLoadingUserCount(false);
        }, (error) => {
          console.error("Error fetching active user count:", error); setActiveUserCount("Error"); setIsLoadingUserCount(false);
        });
        unsubscribers.push(unsubAdminUsers);

        const productsCol = collection(db, 'products');
        const unsubProducts = onSnapshot(productsCol, (snapshot) => {
            setTotalProductCount(snapshot.size);
            setIsLoadingProductCount(false);
        }, (error) => {
            console.error("Error fetching product count:", error); setTotalProductCount("Error"); setIsLoadingProductCount(false);
        });
        unsubscribers.push(unsubProducts);

        const ordersColAdmin = collection(db, 'orders');
        const unsubOrders = onSnapshot(ordersColAdmin, (snapshot) => {
            setTotalOrderCount(snapshot.size);
            setIsLoadingOrderCount(false);
        }, (error) => {
            console.error("Error fetching total order count:", error); setTotalOrderCount("Error"); setIsLoadingOrderCount(false);
        });
        unsubscribers.push(unsubOrders);
        
        const activeDeliveryStatusesAdmin: OrderStatus[] = ['assigned', 'out_for_delivery', 'delivery_attempted'];
        const qActiveDeliveriesAdmin = query(ordersColAdmin, where("status", "in", activeDeliveryStatusesAdmin));
        const unsubActiveDeliveriesAdmin = onSnapshot(qActiveDeliveriesAdmin, (snapshot) => {
            setActiveDeliveriesCountAdmin(snapshot.size);
            setIsLoadingActiveDeliveriesAdmin(false);
        }, (error) => {
            console.error("Error fetching active deliveries for admin:", error); setActiveDeliveriesCountAdmin("Error"); setIsLoadingActiveDeliveriesAdmin(false);
        });
        unsubscribers.push(unsubActiveDeliveriesAdmin);

        const approvalsCol = collection(db, 'approvalRequests'); // Assuming 'approvalRequests' collection
        const qPendingApprovals = query(approvalsCol, where("status", "==", "pending"));
        const unsubPendingApprovals = onSnapshot(qPendingApprovals, (snapshot) => {
            setPendingApprovalsCount(snapshot.size);
            setIsLoadingPendingApprovals(false);
        }, (error) => {
            console.error("Error fetching pending approvals count:", error); setPendingApprovalsCount("Error"); setIsLoadingPendingApprovals(false);
        });
        unsubscribers.push(unsubPendingApprovals);

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        const paymentsCol = collection(db, 'payments'); // Assuming 'payments' collection
        const qPaymentsToday = query(paymentsCol, where("createdAt", ">=", Timestamp.fromDate(startOfDay)), where("createdAt", "<=", Timestamp.fromDate(endOfDay)));
        const unsubPaymentsToday = onSnapshot(qPaymentsToday, (snapshot) => {
            setPaymentsTodayCount(snapshot.size);
            setIsLoadingPaymentsToday(false);
        }, (error) => {
            console.error("Error fetching payments today count:", error); setPaymentsTodayCount("Error"); setIsLoadingPaymentsToday(false);
        });
        unsubscribers.push(unsubPaymentsToday);
        
        const notificationsCol = collection(db, 'notifications'); // Assuming 'notifications' collection
        const qUnreadNotifications = query(notificationsCol, where("isRead", "==", false));
        const unsubUnreadNotifications = onSnapshot(qUnreadNotifications, (snapshot) => {
            setUnreadNotificationsCount(snapshot.size);
            setIsLoadingUnreadNotifications(false);
        }, (error) => {
            console.error("Error fetching unread notifications count:", error); setUnreadNotificationsCount("Error"); setIsLoadingUnreadNotifications(false);
        });
        unsubscribers.push(unsubUnreadNotifications);


      } else {
        setIsLoadingUserCount(false); setIsLoadingProductCount(false); setIsLoadingOrderCount(false); setIsLoadingActiveDeliveriesAdmin(false);
        setIsLoadingPendingApprovals(false); setIsLoadingPaymentsToday(false); setIsLoadingUnreadNotifications(false);
      }

      if (role === 'DispatchManager' || role === 'Admin') { // Admin can also see dispatch manager stats
        setIsLoadingActiveRiders(true); setIsLoadingOrdersAwaiting(true); setIsLoadingOngoingDeliveries(true);

        const ridersCol = collection(db, 'users');
        const qRiders = query(ridersCol, where("role", "==", "Rider"), where("disabled", "==", false));
        const unsubRiders = onSnapshot(qRiders, (snapshot) => {
          setActiveRidersCount(snapshot.size); setIsLoadingActiveRiders(false);
        }, (error) => {
          console.error("Error fetching active riders:", error); setActiveRidersCount("Error"); setIsLoadingActiveRiders(false);
        });
        unsubscribers.push(unsubRiders);

        const ordersColDispatch = collection(db, 'orders');
        const qAwaiting = query(ordersColDispatch, where("status", "==", "awaiting_assignment"));
        const unsubAwaiting = onSnapshot(qAwaiting, (snapshot) => {
          setOrdersAwaitingDispatch(snapshot.size); setIsLoadingOrdersAwaiting(false);
        }, (error) => {
          console.error("Error fetching orders awaiting dispatch:", error); setOrdersAwaitingDispatch("Error"); setIsLoadingOrdersAwaiting(false);
        });
        unsubscribers.push(unsubAwaiting);
        
        const qOngoingStatuses: OrderStatus[] = ['assigned', 'out_for_delivery'];
        const qOngoingDeliveries = query(ordersColDispatch, where("status", "in", qOngoingStatuses));
        const unsubOngoing = onSnapshot(qOngoingDeliveries, (snapshot) => {
            setOngoingDeliveries(snapshot.size); setIsLoadingOngoingDeliveries(false);
        }, (error) => {
            console.error("Error fetching ongoing deliveries:", error); setOngoingDeliveries("Error"); setIsLoadingOngoingDeliveries(false);
        });
        unsubscribers.push(unsubOngoing);

      } else {
        setIsLoadingActiveRiders(false); setIsLoadingOrdersAwaiting(false); setIsLoadingOngoingDeliveries(false);
      }
    }
    return () => unsubscribers.forEach(unsub => unsub());
  }, [authLoading, role, db]);


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
            <DashboardItem title="Active Users" value={activeUserCount} icon={UserCog} link="/admin/users" description="Total active users." isLoadingValue={isLoadingUserCount} />
            <DashboardItem title="Total Products" value={totalProductCount} icon={Package} link="/admin/products" description="Products in catalog." isLoadingValue={isLoadingProductCount} />
            <DashboardItem title="Total Orders" value={totalOrderCount} icon={ShoppingCart} link="/admin/orders" description="All customer orders." isLoadingValue={isLoadingOrderCount} />
            <DashboardItem title="Active Deliveries" value={activeDeliveriesCountAdmin} icon={Truck} link="/admin/deliveries" description="Ongoing deliveries." isLoadingValue={isLoadingActiveDeliveriesAdmin} />
            <DashboardItem title="Payments Today" value={paymentsTodayCount} icon={Banknote} link="/admin/payments" isLoadingValue={isLoadingPaymentsToday}/>
            <DashboardItem title="Pending Approvals" value={pendingApprovalsCount} icon={BadgeHelp} link="/admin/approvals" isLoadingValue={isLoadingPendingApprovals}/>
            <DashboardItem title="Unread Notifications" value={unreadNotificationsCount} icon={MailWarning} link="/admin/notifications" isLoadingValue={isLoadingUnreadNotifications}/>
            <DashboardItem title="System Reports" icon={FileArchive} link="/admin/reports" />
            <DashboardItem title="Customization Hub" icon={Layers} link="/admin/customizations" />
            <DashboardItem title="Shipping Config" icon={Ship} link="/admin/shipping" />
            <DashboardItem title="System Settings" icon={Settings} link="/admin/settings" />
          </>
        );
      case 'DispatchManager':
        return (
          <>
            <DashboardItem title="Active Riders" value={activeRidersCount} icon={UsersRound} link="/admin/users?role=Rider" description="Available for dispatch." isLoadingValue={isLoadingActiveRiders} />
            <DashboardItem title="Awaiting Dispatch" value={ordersAwaitingDispatch} icon={Package} link="/admin/dispatch" description="Orders ready for assignment." isLoadingValue={isLoadingOrdersAwaiting} />
            <DashboardItem title="Ongoing Deliveries" value={ongoingDeliveries} icon={Route} link="/admin/dispatch" description="Deliveries in progress." isLoadingValue={isLoadingOngoingDeliveries} />
            <DashboardItem title="Full Dispatch Center" value={"Open"} icon={Component} link="/admin/dispatch" description="Access all dispatch tools." />
          </>
        );
      case 'Customer':
        return (
          <>
            <DashboardItem title="Active Orders" value={0} icon={ShoppingCart} link="/orders" isLoadingValue={false} description="Your current orders." />
            <DashboardItem title="Wishlist Items" value={0} icon={Package} link="/products" isLoadingValue={false} description="Items you love."/>
            <DashboardItem title="Browse Services" value={"Explore"} icon={Layers} link="/services" description="Discover our services."/>
            <DashboardItem title="Gift Customizations" value={"Create"} icon={UsersIcon} link="/customizations/gift" description="Personalize a gift."/>
          </>
        );
      case 'Technician':
        return (
          <>
            <DashboardItem title="Assigned Tasks" value={0} icon={Wrench} link="/tasks" isLoadingValue={false} description="Your current workload."/>
            <DashboardItem title="Pending Approvals" value={0} icon={AlertTriangle} isLoadingValue={false} description="Items needing review."/>
            <DashboardItem title="Completed Today" value={0} icon={Wrench} isLoadingValue={false} description="Tasks finished today."/>
          </>
        );
       case 'Rider':
        return (
          <>
            <DashboardItem title="Active Deliveries" value={0} icon={Truck} link="/deliveries" isLoadingValue={false} description="Your current deliveries."/>
            <DashboardItem title="Completed Today" value={0} icon={Truck} isLoadingValue={false} description="Deliveries made today."/>
            <DashboardItem title="View Route Map" value={"Open"} icon={MapIcon} link="/rider/map" description="See your route."/>
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
          <AlertTitle>Data Overview</AlertTitle>
          <AlertDescription>
            This dashboard provides key metrics and quick access to your tasks. Data may be placeholder for some items.
          </AlertDescription>
        </Alert>
      )}
       {role === 'Admin' && (
        <Alert variant="default" className="border-primary/50 bg-primary/5 text-primary-foreground-muted">
          <AlertTriangle className="h-4 w-4 mr-2 text-primary" />
          <AlertTitle className="text-primary">Admin Panel Active</AlertTitle>
          <AlertDescription className="text-primary/90">
            You have administrative privileges. Manage system data and operations from here. Key metrics are updated in real-time.
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
            Browse products, manage your orders, and customize items. Some data is placeholder.
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
