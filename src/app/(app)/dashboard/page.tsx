
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, DollarSign, Package, ShoppingCart, Truck, Users as UsersIcon, Wrench, UserCog, Settings, FileArchive, ClipboardCheck, AlertTriangle, Layers, Loader2, UsersRound, Route, Component, Ship, Bell, MapIcon, BadgeHelp, MailWarning, Banknote, CheckCircle2, Warehouse, ListChecks, PackageX } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, onSnapshot, Unsubscribe, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, Order, OrderStatus, Product, StockRequest } from '@/types';
import { useRouter } from 'next/navigation'; 

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(price);
};

// Helper component for dashboard items
const DashboardItem = ({ title, value, icon: Icon, link, description, isLoadingValue, isPrice }: { title: string; value?: string | number; icon: React.ElementType; link?: string; description?: string, isLoadingValue?: boolean, isPrice?: boolean }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoadingValue ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : ( value !== undefined && <div className="text-2xl font-bold">{isPrice ? formatPrice(Number(value)) : value}</div>)}
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
  const router = useRouter(); 
  
  // General Admin stats
  const [activeUserCount, setActiveUserCount] = useState<number | string>("...");
  const [isLoadingUserCount, setIsLoadingUserCount] = useState(true);
  
  // Stats for Admin & InventoryManager
  const [allProductsForStats, setAllProductsForStats] = useState<Product[]>([]);
  const [isLoadingAllProductsForStats, setIsLoadingAllProductsForStats] = useState(true);
  const [totalProductCount, setTotalProductCount] = useState<number | string>("...");
  const [lowStockItemsCount, setLowStockItemsCount] = useState<number | string>("...");
  const [outOfStockItemsCount, setOutOfStockItemsCount] = useState<number | string>("...");
  const [totalInventoryValue, setTotalInventoryValue] = useState<number | string>("...");

  const [totalOrderCount, setTotalOrderCount] = useState<number | string>("..."); // Admin only
  const [isLoadingOrderCount, setIsLoadingOrderCount] = useState(true);
  const [activeDeliveriesCountAdmin, setActiveDeliveriesCountAdmin] = useState<number | string>("..."); // Admin only
  const [isLoadingActiveDeliveriesAdmin, setIsLoadingActiveDeliveriesAdmin] = useState(true);
  
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | string>("..."); // Admin only
  const [isLoadingPendingApprovals, setIsLoadingPendingApprovals] = useState(true);
  
  const [paymentsTodayCount, setPaymentsTodayCount] = useState<number | string>("..."); // Admin & Finance Manager
  const [isLoadingPaymentsToday, setIsLoadingPaymentsToday] = useState(true);
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number | string>("..."); // Admin only
  const [isLoadingUnreadNotifications, setIsLoadingUnreadNotifications] = useState(true);

  const [pendingStockRequestsCount, setPendingStockRequestsCount] = useState<number | string>("..."); // Admin & InventoryManager
  const [isLoadingPendingStockRequests, setIsLoadingPendingStockRequests] = useState(true);

  // Dispatch Manager specific state
  const [activeRidersCount, setActiveRidersCount] = useState<number | string>("...");
  const [isLoadingActiveRiders, setIsLoadingActiveRiders] = useState(true);
  const [ordersAwaitingDispatch, setOrdersAwaitingDispatch] = useState<number | string>("...");
  const [isLoadingOrdersAwaiting, setIsLoadingOrdersAwaiting] = useState(true);
  const [ongoingDeliveries, setOngoingDeliveries] = useState<number | string>("...");
  const [isLoadingOngoingDeliveries, setIsLoadingOngoingDeliveries] = useState(true);

  // Rider specific state
  const [riderActiveDeliveriesCount, setRiderActiveDeliveriesCount] = useState<number | string>("...");
  const [isLoadingRiderActiveDeliveries, setIsLoadingRiderActiveDeliveries] = useState(true);
  const [riderCompletedTodayCount, setRiderCompletedTodayCount] = useState<number | string>("...");
  const [isLoadingRiderCompletedToday, setIsLoadingRiderCompletedToday] = useState(true);


  useEffect(() => {
    if (!authLoading && role === 'Customer') {
      router.replace('/products');
      return; 
    }

    let unsubscribers: Unsubscribe[] = [];
    if (!authLoading && db && user && role !== 'Customer') { 
      
      const ordersCol = collection(db, 'orders');
      const productsCol = collection(db, 'products');

      // Fetch all products for Admin and InventoryManager for detailed stats
      if (role === 'Admin' || role === 'InventoryManager') {
        setIsLoadingAllProductsForStats(true);
        const unsubAllProducts = onSnapshot(productsCol, (snapshot) => {
          const fetchedProducts: Product[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          setAllProductsForStats(fetchedProducts);

          setTotalProductCount(fetchedProducts.length);
          setLowStockItemsCount(fetchedProducts.filter(p => p.stock > 0 && p.stock < 10).length);
          setOutOfStockItemsCount(fetchedProducts.filter(p => p.stock === 0).length);
          setTotalInventoryValue(fetchedProducts.reduce((acc, p) => acc + (p.price * p.stock), 0));
          
          setIsLoadingAllProductsForStats(false);
          if (role === 'InventoryManager') setIsLoadingPendingStockRequests(true); // Trigger stock requests fetch next
        }, (error) => {
          console.error("Error fetching all products for stats:", error);
          setTotalProductCount("Error"); setLowStockItemsCount("Error"); setOutOfStockItemsCount("Error"); setTotalInventoryValue("Error");
          setIsLoadingAllProductsForStats(false);
        });
        unsubscribers.push(unsubAllProducts);
      } else {
        setIsLoadingAllProductsForStats(false);
      }
      
      // Fetch pending stock requests for Admin and Inventory Manager
      if (role === 'Admin' || role === 'InventoryManager') {
        setIsLoadingPendingStockRequests(true);
        const stockRequestsCol = collection(db, 'stockRequests');
        // Admins see all pending, InventoryManagers see requests that might need their attention or are from them.
        // For dashboard stat, let's show Inventory Manager ones they initiated that are pending ANY approval, Admins see ALL pending any approval.
        let qPendingStockRequests;
        if (role === 'InventoryManager') {
            qPendingStockRequests = query(stockRequestsCol, 
                where("requesterId", "==", user.uid), 
                where("status", "in", ["pending_finance_approval", "pending_supplier_fulfillment"])
            );
        } else { // Admin
             qPendingStockRequests = query(stockRequestsCol, 
                where("status", "in", ["pending_finance_approval", "pending_supplier_fulfillment"])
            );
        }
        const unsubPendingStockRequests = onSnapshot(qPendingStockRequests, (snapshot) => {
            setPendingStockRequestsCount(snapshot.size);
            setIsLoadingPendingStockRequests(false);
        }, (error) => {
            console.error("Error fetching pending stock requests count:", error); setPendingStockRequestsCount("Error"); setIsLoadingPendingStockRequests(false);
        });
        unsubscribers.push(unsubPendingStockRequests);
      } else {
        setIsLoadingPendingStockRequests(false);
      }


      if (role === 'Admin' || role === 'FinanceManager') {
        setIsLoadingPaymentsToday(true);
        const today = new Date();
        const startOfDay = Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
        const endOfDay = Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999));
        
        const qPaymentsToday = query(ordersCol, 
            where("paymentStatus", "==", "paid"),
            where("updatedAt", ">=", startOfDay),
            where("updatedAt", "<=", endOfDay)
        );
        const unsubPaymentsToday = onSnapshot(qPaymentsToday, (snapshot) => {
            setPaymentsTodayCount(snapshot.size);
            setIsLoadingPaymentsToday(false);
        }, (error) => {
            console.error("Error fetching payments today count:", error); setPaymentsTodayCount("Error"); setIsLoadingPaymentsToday(false);
        });
        unsubscribers.push(unsubPaymentsToday);
      } else {
        setIsLoadingPaymentsToday(false);
      }


      if (role === 'Admin') {
        setIsLoadingUserCount(true);
        setIsLoadingOrderCount(true);
        setIsLoadingActiveDeliveriesAdmin(true);
        setIsLoadingPendingApprovals(true);
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
        
        const unsubOrders = onSnapshot(ordersCol, (snapshot) => { 
            setTotalOrderCount(snapshot.size);
            setIsLoadingOrderCount(false);
        }, (error) => {
            console.error("Error fetching total order count:", error); setTotalOrderCount("Error"); setIsLoadingOrderCount(false);
        });
        unsubscribers.push(unsubOrders);
        
        const activeDeliveryStatusesAdmin: OrderStatus[] = ['assigned', 'out_for_delivery', 'delivery_attempted'];
        const qActiveDeliveriesAdmin = query(ordersCol, where("status", "in", activeDeliveryStatusesAdmin)); 
        const unsubActiveDeliveriesAdmin = onSnapshot(qActiveDeliveriesAdmin, (snapshot) => {
            setActiveDeliveriesCountAdmin(snapshot.size);
            setIsLoadingActiveDeliveriesAdmin(false);
        }, (error) => {
            console.error("Error fetching active deliveries for admin:", error); setActiveDeliveriesCountAdmin("Error"); setIsLoadingActiveDeliveriesAdmin(false);
        });
        unsubscribers.push(unsubActiveDeliveriesAdmin);

        // This is for general approvals, not stock request approvals (which are handled above)
        const approvalsCol = collection(db, 'approvalRequests'); 
        const qPendingApprovals = query(approvalsCol, where("status", "==", "pending"));
        const unsubPendingApprovals = onSnapshot(qPendingApprovals, (snapshot) => {
            setPendingApprovalsCount(snapshot.size);
            setIsLoadingPendingApprovals(false);
        }, (error) => {
            console.error("Error fetching pending approvals count:", error); setPendingApprovalsCount("Error"); setIsLoadingPendingApprovals(false);
        });
        unsubscribers.push(unsubPendingApprovals);
        
        const notificationsCol = collection(db, 'notifications'); 
        const qUnreadNotifications = query(notificationsCol, where("isRead", "==", false));
        const unsubUnreadNotifications = onSnapshot(qUnreadNotifications, (snapshot) => {
            setUnreadNotificationsCount(snapshot.size);
            setIsLoadingUnreadNotifications(false);
        }, (error) => {
            console.error("Error fetching unread notifications count:", error); setUnreadNotificationsCount("Error"); setIsLoadingUnreadNotifications(false);
        });
        unsubscribers.push(unsubUnreadNotifications);

      } else { 
        setIsLoadingUserCount(false); setIsLoadingOrderCount(false); setIsLoadingActiveDeliveriesAdmin(false);
        setIsLoadingPendingApprovals(false); setIsLoadingUnreadNotifications(false);
      }

      if (role === 'DispatchManager' || role === 'Admin') { 
        setIsLoadingActiveRiders(true); setIsLoadingOrdersAwaiting(true); setIsLoadingOngoingDeliveries(true);

        const ridersCol = collection(db, 'users');
        const qRiders = query(ridersCol, where("role", "==", "Rider"), where("disabled", "==", false));
        const unsubRiders = onSnapshot(qRiders, (snapshot) => {
          setActiveRidersCount(snapshot.size); setIsLoadingActiveRiders(false);
        }, (error) => {
          console.error("Error fetching active riders:", error); setActiveRidersCount("Error"); setIsLoadingActiveRiders(false);
        });
        unsubscribers.push(unsubRiders);

        const qAwaiting = query(ordersCol, where("status", "==", "awaiting_assignment")); 
        const unsubAwaiting = onSnapshot(qAwaiting, (snapshot) => {
          setOrdersAwaitingDispatch(snapshot.size); setIsLoadingOrdersAwaiting(false);
        }, (error) => {
          console.error("Error fetching orders awaiting dispatch:", error); setOrdersAwaitingDispatch("Error"); setIsLoadingOrdersAwaiting(false);
        });
        unsubscribers.push(unsubAwaiting);
        
        const qOngoingStatuses: OrderStatus[] = ['assigned', 'out_for_delivery'];
        const qOngoingDeliveries = query(ordersCol, where("status", "in", qOngoingStatuses)); 
        const unsubOngoing = onSnapshot(qOngoingDeliveries, (snapshot) => {
            setOngoingDeliveries(snapshot.size); setIsLoadingOngoingDeliveries(false);
        }, (error) => {
            console.error("Error fetching ongoing deliveries:", error); setOngoingDeliveries("Error"); setIsLoadingOngoingDeliveries(false);
        });
        unsubscribers.push(unsubOngoing);

      } else { 
        setIsLoadingActiveRiders(false); setIsLoadingOrdersAwaiting(false); setIsLoadingOngoingDeliveries(false);
      }

      if (role === 'Rider') {
        setIsLoadingRiderActiveDeliveries(true);
        setIsLoadingRiderCompletedToday(true);

        const riderActiveStatuses: OrderStatus[] = ['assigned', 'out_for_delivery', 'delivery_attempted'];
        const qRiderActive = query(ordersCol, 
          where('riderId', '==', user.uid), 
          where('status', 'in', riderActiveStatuses)
        );
        const unsubRiderActive = onSnapshot(qRiderActive, (snapshot) => {
          setRiderActiveDeliveriesCount(snapshot.size);
          setIsLoadingRiderActiveDeliveries(false);
        }, (error) => {
          console.error("Error fetching rider active deliveries:", error); setRiderActiveDeliveriesCount("Error"); setIsLoadingRiderActiveDeliveries(false);
        });
        unsubscribers.push(unsubRiderActive);

        const today = new Date();
        const startOfDay = Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
        const endOfDay = Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999));
        
        const qRiderCompletedToday = query(ordersCol, 
          where('riderId', '==', user.uid),
          where('status', '==', 'delivered'),
          where('actualDeliveryTime', '>=', startOfDay),
          where('actualDeliveryTime', '<=', endOfDay)
        );
        const unsubRiderCompletedToday = onSnapshot(qRiderCompletedToday, (snapshot) => {
          setRiderCompletedTodayCount(snapshot.size);
          setIsLoadingRiderCompletedToday(false);
        }, (error) => {
          console.error("Error fetching rider completed today:", error); setRiderCompletedTodayCount("Error"); setIsLoadingRiderCompletedToday(false);
        });
        unsubscribers.push(unsubRiderCompletedToday);
      } else {
        setIsLoadingRiderActiveDeliveries(false);
        setIsLoadingRiderCompletedToday(false);
      }
    }
    return () => unsubscribers.forEach(unsub => unsub());
  }, [authLoading, role, db, router, user]);


  if (authLoading || !user || role === 'Customer') { 
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const getRoleSpecificGreeting = () => {
    switch (role) {
      case 'Admin': return "Admin Control Panel";
      case 'Technician': return "Technician Dashboard";
      case 'Rider': return "Rider Dashboard";
      case 'Supplier': return "Supplier Portal";
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
            <DashboardItem title="Total Products" value={totalProductCount} icon={Package} link="/admin/products" description="Products in catalog." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Low Stock Items" value={lowStockItemsCount} icon={AlertTriangle} link="/inventory?filter=lowstock" description="Items with <10 stock." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Out of Stock Items" value={outOfStockItemsCount} icon={PackageX} link="/inventory?filter=outofstock" description="Items with 0 stock." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Inventory Value" value={totalInventoryValue} icon={DollarSign} link="/inventory" description="Total value of stock." isLoadingValue={isLoadingAllProductsForStats} isPrice />
            <DashboardItem title="Pending Stock Requests" value={pendingStockRequestsCount} icon={ListChecks} link="/finance/approvals" description="Stock requests needing action." isLoadingValue={isLoadingPendingStockRequests} />
            <DashboardItem title="Total Orders" value={totalOrderCount} icon={ShoppingCart} link="/admin/orders" description="All customer orders." isLoadingValue={isLoadingOrderCount} />
            <DashboardItem title="Active Deliveries" value={activeDeliveriesCountAdmin} icon={Truck} link="/admin/deliveries" description="Ongoing deliveries." isLoadingValue={isLoadingActiveDeliveriesAdmin} />
            <DashboardItem title="Payments Today" value={paymentsTodayCount} icon={Banknote} link="/admin/payments" description="Orders marked paid today." isLoadingValue={isLoadingPaymentsToday}/>
            <DashboardItem title="General Approvals" value={pendingApprovalsCount} icon={BadgeHelp} link="/admin/approvals" isLoadingValue={isLoadingPendingApprovals}/>
            <DashboardItem title="Unread Notifications" value={unreadNotificationsCount} icon={MailWarning} link="/admin/notifications" isLoadingValue={isLoadingUnreadNotifications}/>
            <DashboardItem title="System Reports" icon={FileArchive} link="/admin/reports" />
            <DashboardItem title="Customization Hub" icon={Layers} link="/admin/customizations" />
            <DashboardItem title="Shipping Config" icon={Ship} link="/admin/shipping" />
            <DashboardItem title="System Settings" icon={Settings} link="/admin/settings" />
          </>
        );
      case 'FinanceManager':
        return (
          <>
            <DashboardItem title="Payments Today" value={paymentsTodayCount} icon={Banknote} link="/admin/payments" description="Orders marked paid today." isLoadingValue={isLoadingPaymentsToday}/>
            <DashboardItem title="All Payments" icon={DollarSign} link="/admin/payments" />
            <DashboardItem title="Invoice Management" icon={FileArchive} link="/invoices" /> 
            <DashboardItem title="Stock Request Approvals" icon={ListChecks} link="/finance/approvals" description="Approve/reject stock requests." isLoadingValue={isLoadingPendingStockRequests} />
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
      case 'InventoryManager':
        return (
          <>
            <DashboardItem title="Total Products" value={totalProductCount} icon={Package} link="/inventory" description="Products in catalog." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Low Stock Items" value={lowStockItemsCount} icon={AlertTriangle} link="/inventory?filter=lowstock" description="Items with <10 stock." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Out of Stock Items" value={outOfStockItemsCount} icon={PackageX} link="/inventory?filter=outofstock" description="Items with 0 stock." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Total Inventory Value" value={totalInventoryValue} icon={DollarSign} link="/inventory" description="Estimated value of current stock." isLoadingValue={isLoadingAllProductsForStats} isPrice />
            <DashboardItem title="My Pending Stock Requests" value={pendingStockRequestsCount} icon={ShoppingCart} link="/inventory#requests" description="Track your requests." isLoadingValue={isLoadingPendingStockRequests} />
            <DashboardItem title="All Inventory" value={"View"} icon={Warehouse} link="/inventory" description="Manage stock levels." />
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
            <DashboardItem title="Active Deliveries" value={riderActiveDeliveriesCount} icon={Truck} link="/deliveries" isLoadingValue={isLoadingRiderActiveDeliveries} description="Your current deliveries."/>
            <DashboardItem title="Completed Today" value={riderCompletedTodayCount} icon={CheckCircle2} isLoadingValue={isLoadingRiderCompletedToday} description="Deliveries made today."/>
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
      
      {role !== 'Admin' && role !== 'DispatchManager' && role !== 'FinanceManager' && role !== 'InventoryManager' && (
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
       {role === 'FinanceManager' && (
        <Alert variant="default" className="border-green-500/50 bg-green-500/5 text-green-700 dark:text-green-300">
          <DollarSign className="h-4 w-4 mr-2 text-green-500" />
          <AlertTitle className="text-green-600 dark:text-green-400">Finance Dashboard</AlertTitle>
          <AlertDescription className="text-green-600/90 dark:text-green-400/90">
            Access payment records, transaction histories, and manage financial data. Metrics are updated in real-time.
          </AlertDescription>
        </Alert>
      )}
      {role === 'InventoryManager' && (
        <Alert variant="default" className="border-orange-500/50 bg-orange-500/5 text-orange-700 dark:text-orange-300">
          <Warehouse className="h-4 w-4 mr-2 text-orange-500" />
          <AlertTitle className="text-orange-600 dark:text-orange-400">Inventory Manager Dashboard</AlertTitle>
          <AlertDescription className="text-orange-600/90 dark:text-orange-400/90">
            Monitor stock levels, request new stock, and manage inventory data. Metrics are updated in real-time.
          </AlertDescription>
        </Alert>
      )}
      {role === 'Rider' && (
        <Alert variant="default" className="border-accent/50 bg-accent/5 text-accent-foreground-muted">
          <Truck className="h-4 w-4 mr-2 text-accent" />
          <AlertTitle className="text-accent">Rider Dashboard</AlertTitle>
          <AlertDescription className="text-accent/90">
            View your assigned deliveries, track routes, and manage your delivery tasks. Metrics are updated in real-time.
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
            {(role === 'Technician' || role === 'ServiceManager') && <Link href="/tasks"><Button>View Tasks</Button></Link>}
            {(role === 'Rider') && <Link href="/deliveries"><Button>Manage Deliveries</Button></Link>}
             {role === 'DispatchManager' && <Link href="/admin/dispatch"><Button><Component className="mr-2 h-4 w-4" />Open Dispatch Center</Button></Link>}
             {role === 'FinanceManager' && <Link href="/admin/payments"><Button><DollarSign className="mr-2 h-4 w-4" />View Payments</Button></Link>}
             {role === 'InventoryManager' && <Link href="/inventory"><Button><Warehouse className="mr-2 h-4 w-4" />Manage Inventory</Button></Link>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
