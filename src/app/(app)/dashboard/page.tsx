
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart2, DollarSign, Package, ShoppingCart, Truck, Users as UsersIcon, Wrench, UserCog, Settings, FileArchive, ClipboardCheck, AlertTriangle, Layers, Loader2, UsersRound, Route, Component, Ship, Bell, MapIcon, BadgeHelp, MailWarning, Banknote, CheckCircle2, Warehouse, ListChecks, PackageX, PackageSearch, FileText, Coins, Hourglass } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs, query, where, onSnapshot, Unsubscribe, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User, Order, OrderStatus, Product, StockRequest, Invoice, InvoiceStatus, Task } from '@/types';
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
  const [pendingInvoiceApprovalsCount, setPendingInvoiceApprovalsCount] = useState<number | string>("..."); // Finance Manager & Admin
  const [isLoadingPendingInvoiceApprovals, setIsLoadingPendingInvoiceApprovals] = useState(true);
  
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number | string>("..."); // Admin only
  const [isLoadingUnreadNotifications, setIsLoadingUnreadNotifications] = useState(true);

  const [pendingStockRequestsCount, setPendingStockRequestsCount] = useState<number | string>("..."); // Admin & InventoryManager (for FinanceManager this is stock requests they need to approve)
  const [isLoadingPendingStockRequests, setIsLoadingPendingStockRequests] = useState(true);
  
  const [itemsAwaitingReceiptCount, setItemsAwaitingReceiptCount] = useState<number | string>("..."); // Admin & InventoryManager
  const [isLoadingItemsAwaitingReceipt, setIsLoadingItemsAwaitingReceipt] = useState(true);


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

  // Supplier specific state
  const [supplierNewStockRequestsToday, setSupplierNewStockRequestsToday] = useState<number | string>("...");
  const [isLoadingSupplierNewStockRequests, setIsLoadingSupplierNewStockRequests] = useState(true);
  const [supplierFulfilledRequests, setSupplierFulfilledRequests] = useState<number | string>("...");
  const [isLoadingSupplierFulfilled, setIsLoadingSupplierFulfilled] = useState(true);
  const [supplierPendingInvoices, setSupplierPendingInvoices] = useState<number | string>("...");
  const [isLoadingSupplierPendingInvoices, setIsLoadingSupplierPendingInvoices] = useState(true);

  // Technician specific state
  const [technicianActiveTasks, setTechnicianActiveTasks] = useState<number | string>("...");
  const [isLoadingTechnicianActiveTasks, setIsLoadingTechnicianActiveTasks] = useState(true);
  const [technicianCompletedToday, setTechnicianCompletedToday] = useState<number | string>("...");
  const [isLoadingTechnicianCompletedToday, setIsLoadingTechnicianCompletedToday] = useState(true);

  // Service Manager specific state
  const [smTotalActiveTasks, setSmTotalActiveTasks] = useState<number | string>("...");
  const [isLoadingSmTotalActiveTasks, setIsLoadingSmTotalActiveTasks] = useState(true);
  const [smTasksNeedingAction, setSmTasksNeedingAction] = useState<number | string>("...");
  const [isLoadingSmTasksNeedingAction, setIsLoadingSmTasksNeedingAction] = useState(true);
  const [smActiveTechnicians, setSmActiveTechnicians] = useState<number | string>("...");
  const [isLoadingSmActiveTechnicians, setIsLoadingSmActiveTechnicians] = useState(true);


  useEffect(() => {
    if (!authLoading && role === 'Customer') {
      router.replace('/products');
      return; 
    }

    let unsubscribers: Unsubscribe[] = [];
    if (!authLoading && db && user && role !== 'Customer') { 
      
      const ordersCol = collection(db, 'orders');
      const productsCol = collection(db, 'products');
      const stockRequestsCol = collection(db, 'stockRequests');
      const invoicesCol = collection(db, 'invoices');
      const tasksCol = collection(db, 'tasks');
      const usersCol = collection(db, 'users');

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
        }, (error) => {
          console.error("Error fetching all products for stats:", error);
          setTotalProductCount("Error"); setLowStockItemsCount("Error"); setOutOfStockItemsCount("Error"); setTotalInventoryValue("Error");
          setIsLoadingAllProductsForStats(false);
        });
        unsubscribers.push(unsubAllProducts);

        setIsLoadingItemsAwaitingReceipt(true);
        const qItemsAwaitingReceipt = query(stockRequestsCol, where("status", "==", "awaiting_receipt"));
        const unsubItemsAwaitingReceipt = onSnapshot(qItemsAwaitingReceipt, (snapshot) => {
            setItemsAwaitingReceiptCount(snapshot.size);
            setIsLoadingItemsAwaitingReceipt(false);
        }, (error) => {
            console.error("Error fetching items awaiting receipt count:", error); setItemsAwaitingReceiptCount("Error"); setIsLoadingItemsAwaitingReceipt(false);
        });
        unsubscribers.push(unsubItemsAwaitingReceipt);
      } else {
        setIsLoadingAllProductsForStats(false);
        setIsLoadingItemsAwaitingReceipt(false);
      }
      
      if (role === 'Admin' || role === 'InventoryManager' || role === 'FinanceManager') {
        setIsLoadingPendingStockRequests(true);
        let qPendingStockRequests;
        if (role === 'InventoryManager') { 
            qPendingStockRequests = query(stockRequestsCol, 
                where("requesterId", "==", user.uid), 
                where("status", "in", ["pending_finance_approval", "pending_supplier_fulfillment"])
            );
        } else if (role === 'FinanceManager') { 
            qPendingStockRequests = query(stockRequestsCol, where("status", "==", "pending_finance_approval"));
        } else { 
             qPendingStockRequests = query(stockRequestsCol, 
                where("status", "in", ["pending_finance_approval", "pending_supplier_fulfillment", "awaiting_receipt"])
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
        const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0,0,0,0)));
        const todayEnd = Timestamp.fromDate(new Date(new Date().setHours(23,59,59,999)));
        
        const qPaymentsToday = query(ordersCol, 
            where("paymentStatus", "==", "paid"),
            where("updatedAt", ">=", todayStart),
            where("updatedAt", "<=", todayEnd)
        );
        const unsubPaymentsToday = onSnapshot(qPaymentsToday, (snapshot) => {
            setPaymentsTodayCount(snapshot.size);
            setIsLoadingPaymentsToday(false);
        }, (error) => {
            console.error("Error fetching payments today count:", error); setPaymentsTodayCount("Error"); setIsLoadingPaymentsToday(false);
        });
        unsubscribers.push(unsubPaymentsToday);

        setIsLoadingPendingInvoiceApprovals(true);
        const qPendingInvoiceApprovals = query(invoicesCol, where("status", "==", "pending_approval"));
        const unsubPendingInvoiceApprovals = onSnapshot(qPendingInvoiceApprovals, (snapshot) => {
            setPendingInvoiceApprovalsCount(snapshot.size);
            setIsLoadingPendingInvoiceApprovals(false);
        }, (error) => {
            console.error("Error fetching pending invoice approvals count:", error); setPendingInvoiceApprovalsCount("Error"); setIsLoadingPendingInvoiceApprovals(false);
        });
        unsubscribers.push(unsubPendingInvoiceApprovals);

      } else {
        setIsLoadingPaymentsToday(false);
        setIsLoadingPendingInvoiceApprovals(false);
      }


      if (role === 'Admin') {
        setIsLoadingUserCount(true); setIsLoadingOrderCount(true); setIsLoadingActiveDeliveriesAdmin(true);
        setIsLoadingPendingApprovals(true); setIsLoadingUnreadNotifications(true);

        const qAdminUsers = query(usersCol, where("disabled", "==", false));
        const unsubAdminUsers = onSnapshot(qAdminUsers, (snapshot) => {
          setActiveUserCount(snapshot.size); setIsLoadingUserCount(false);
        }, (error) => {
          console.error("Error fetching active user count:", error); setActiveUserCount("Error"); setIsLoadingUserCount(false);
        });
        unsubscribers.push(unsubAdminUsers);
        
        const unsubOrders = onSnapshot(ordersCol, (snapshot) => { 
            setTotalOrderCount(snapshot.size); setIsLoadingOrderCount(false);
        }, (error) => {
            console.error("Error fetching total order count:", error); setTotalOrderCount("Error"); setIsLoadingOrderCount(false);
        });
        unsubscribers.push(unsubOrders);
        
        const activeDeliveryStatusesAdmin: OrderStatus[] = ['assigned', 'out_for_delivery', 'delivery_attempted'];
        const qActiveDeliveriesAdmin = query(ordersCol, where("status", "in", activeDeliveryStatusesAdmin)); 
        const unsubActiveDeliveriesAdmin = onSnapshot(qActiveDeliveriesAdmin, (snapshot) => {
            setActiveDeliveriesCountAdmin(snapshot.size); setIsLoadingActiveDeliveriesAdmin(false);
        }, (error) => {
            console.error("Error fetching active deliveries for admin:", error); setActiveDeliveriesCountAdmin("Error"); setIsLoadingActiveDeliveriesAdmin(false);
        });
        unsubscribers.push(unsubActiveDeliveriesAdmin);

        const approvalsCol = collection(db, 'approvalRequests'); 
        const qPendingApprovals = query(approvalsCol, where("status", "==", "pending"));
        const unsubPendingApprovals = onSnapshot(qPendingApprovals, (snapshot) => {
            setPendingApprovalsCount(snapshot.size); setIsLoadingPendingApprovals(false);
        }, (error) => {
            console.error("Error fetching pending approvals count:", error); setPendingApprovalsCount("Error"); setIsLoadingPendingApprovals(false);
        });
        unsubscribers.push(unsubPendingApprovals);
        
        const notificationsCol = collection(db, 'notifications'); 
        const qUnreadNotifications = query(notificationsCol, where("isRead", "==", false));
        const unsubUnreadNotifications = onSnapshot(qUnreadNotifications, (snapshot) => {
            setUnreadNotificationsCount(snapshot.size); setIsLoadingUnreadNotifications(false);
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

        const qRiders = query(usersCol, where("role", "==", "Rider"), where("disabled", "==", false));
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
        setIsLoadingRiderActiveDeliveries(true); setIsLoadingRiderCompletedToday(true);
        const riderActiveStatuses: OrderStatus[] = ['assigned', 'out_for_delivery', 'delivery_attempted'];
        const qRiderActive = query(ordersCol, where('riderId', '==', user.uid), where('status', 'in', riderActiveStatuses));
        const unsubRiderActive = onSnapshot(qRiderActive, (snapshot) => {
          setRiderActiveDeliveriesCount(snapshot.size); setIsLoadingRiderActiveDeliveries(false);
        }, (error) => {
          console.error("Error fetching rider active deliveries:", error); setRiderActiveDeliveriesCount("Error"); setIsLoadingRiderActiveDeliveries(false);
        });
        unsubscribers.push(unsubRiderActive);

        const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0,0,0,0)));
        const todayEnd = Timestamp.fromDate(new Date(new Date().setHours(23,59,59,999)));
        const qRiderCompletedToday = query(ordersCol, 
          where('riderId', '==', user.uid), where('status', '==', 'delivered'),
          where('actualDeliveryTime', '>=', todayStart), where('actualDeliveryTime', '<=', todayEnd)
        );
        const unsubRiderCompletedToday = onSnapshot(qRiderCompletedToday, (snapshot) => {
          setRiderCompletedTodayCount(snapshot.size); setIsLoadingRiderCompletedToday(false);
        }, (error) => {
          console.error("Error fetching rider completed today:", error); setRiderCompletedTodayCount("Error"); setIsLoadingRiderCompletedToday(false);
        });
        unsubscribers.push(unsubRiderCompletedToday);
      } else {
        setIsLoadingRiderActiveDeliveries(false); setIsLoadingRiderCompletedToday(false);
      }

      if (role === 'Supplier') {
        setIsLoadingSupplierNewStockRequests(true); setIsLoadingSupplierFulfilled(true); setIsLoadingSupplierPendingInvoices(true);
        const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0,0,0,0)));
        const todayEnd = Timestamp.fromDate(new Date(new Date().setHours(23,59,59,999)));
        const qNewStockRequests = query(stockRequestsCol,
          where('status', '==', 'pending_supplier_fulfillment'), where('createdAt', '>=', todayStart), where('createdAt', '<=', todayEnd)
        );
        const unsubNewStockRequests = onSnapshot(qNewStockRequests, (snapshot) => {
          setSupplierNewStockRequestsToday(snapshot.size); setIsLoadingSupplierNewStockRequests(false);
        }, (error) => {
          console.error("Error fetching new stock requests for supplier:", error); setSupplierNewStockRequestsToday("Error"); setIsLoadingSupplierNewStockRequests(false);
        });
        unsubscribers.push(unsubNewStockRequests);

        const qFulfilled = query(stockRequestsCol, where('supplierId', '==', user.uid), where('status', 'in', ['awaiting_receipt', 'received']));
        const unsubFulfilled = onSnapshot(qFulfilled, (snapshot) => {
          setSupplierFulfilledRequests(snapshot.size); setIsLoadingSupplierFulfilled(false);
        }, (error) => {
          console.error("Error fetching fulfilled requests for supplier:", error); setSupplierFulfilledRequests("Error"); setIsLoadingSupplierFulfilled(false);
        });
        unsubscribers.push(unsubFulfilled);

        const qPendingInvoices = query(invoicesCol, where('supplierId', '==', user.uid), where('status', 'in', ['pending_approval', 'approved_for_payment']));
        const unsubPendingInvoices = onSnapshot(qPendingInvoices, (snapshot) => {
          setSupplierPendingInvoices(snapshot.size); setIsLoadingSupplierPendingInvoices(false);
        }, (error) => {
          console.error("Error fetching pending invoices for supplier:", error); setSupplierPendingInvoices("Error"); setIsLoadingSupplierPendingInvoices(false);
        });
        unsubscribers.push(unsubPendingInvoices);
      } else {
        setIsLoadingSupplierNewStockRequests(false); setIsLoadingSupplierFulfilled(false); setIsLoadingSupplierPendingInvoices(false);
      }

      if (role === 'Technician') {
        setIsLoadingTechnicianActiveTasks(true); setIsLoadingTechnicianCompletedToday(true);
        const qTechActive = query(tasksCol, where('assigneeId', '==', user.uid), where('status', 'in', ['pending', 'in-progress']));
        const unsubTechActive = onSnapshot(qTechActive, (snapshot) => {
          setTechnicianActiveTasks(snapshot.size); setIsLoadingTechnicianActiveTasks(false);
        }, (error) => {
          console.error("Error fetching technician active tasks:", error); setTechnicianActiveTasks("Error"); setIsLoadingTechnicianActiveTasks(false);
        });
        unsubscribers.push(unsubTechActive);

        const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0,0,0,0)));
        // const todayEnd = Timestamp.fromDate(new Date(new Date().setHours(23,59,59,999))); No need for end with current logic
        const qTechCompleted = query(tasksCol, 
            where('assigneeId', '==', user.uid), 
            where('status', '==', 'completed'),
            where('updatedAt', '>=', todayStart) // Assuming updatedAt is set when task is completed
        );
        const unsubTechCompleted = onSnapshot(qTechCompleted, (snapshot) => {
          setTechnicianCompletedToday(snapshot.size); setIsLoadingTechnicianCompletedToday(false);
        }, (error) => {
          console.error("Error fetching technician completed tasks:", error); setTechnicianCompletedToday("Error"); setIsLoadingTechnicianCompletedToday(false);
        });
        unsubscribers.push(unsubTechCompleted);
      } else {
        setIsLoadingTechnicianActiveTasks(false); setIsLoadingTechnicianCompletedToday(false);
      }

      if (role === 'ServiceManager' || role === 'Admin') { // Admin also gets these for completeness
        setIsLoadingSmTotalActiveTasks(true); setIsLoadingSmTasksNeedingAction(true); setIsLoadingSmActiveTechnicians(true);
        const qSmActiveTasks = query(tasksCol, where('status', 'in', ['pending', 'in-progress']));
        const unsubSmActiveTasks = onSnapshot(qSmActiveTasks, (snapshot) => {
          setSmTotalActiveTasks(snapshot.size); setIsLoadingSmTotalActiveTasks(false);
        }, (error) => {
          console.error("Error fetching SM total active tasks:", error); setSmTotalActiveTasks("Error"); setIsLoadingSmTotalActiveTasks(false);
        });
        unsubscribers.push(unsubSmActiveTasks);
        
        const qSmNeedingAction = query(tasksCol, where('status', 'in', ['pending', 'needs_approval']));
        const unsubSmNeedingAction = onSnapshot(qSmNeedingAction, (snapshot) => {
          setSmTasksNeedingAction(snapshot.size); setIsLoadingSmTasksNeedingAction(false);
        }, (error) => {
          console.error("Error fetching SM tasks needing action:", error); setSmTasksNeedingAction("Error"); setIsLoadingSmTasksNeedingAction(false);
        });
        unsubscribers.push(unsubSmNeedingAction);

        const qSmTechnicians = query(usersCol, where('role', '==', 'Technician'), where('disabled', '!=', true));
        const unsubSmTechnicians = onSnapshot(qSmTechnicians, (snapshot) => {
          setSmActiveTechnicians(snapshot.size); setIsLoadingSmActiveTechnicians(false);
        }, (error) => {
          console.error("Error fetching SM active technicians:", error); setSmActiveTechnicians("Error"); setIsLoadingSmActiveTechnicians(false);
        });
        unsubscribers.push(unsubSmTechnicians);
      } else {
        setIsLoadingSmTotalActiveTasks(false); setIsLoadingSmTasksNeedingAction(false); setIsLoadingSmActiveTechnicians(false);
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
      case 'ServiceManager': return "Service Management Dashboard";
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
            <DashboardItem title="Items Awaiting Receipt" value={itemsAwaitingReceiptCount} icon={PackageSearch} link="/inventory/receivership" description="Items from suppliers to be confirmed." isLoadingValue={isLoadingItemsAwaitingReceipt} />
            <DashboardItem title="Total Orders" value={totalOrderCount} icon={ShoppingCart} link="/admin/orders" description="All customer orders." isLoadingValue={isLoadingOrderCount} />
            <DashboardItem title="Active Deliveries" value={activeDeliveriesCountAdmin} icon={Truck} link="/admin/deliveries" description="Ongoing deliveries." isLoadingValue={isLoadingActiveDeliveriesAdmin} />
            <DashboardItem title="Payments Today" value={paymentsTodayCount} icon={Banknote} link="/admin/payments" description="Orders marked paid today." isLoadingValue={isLoadingPaymentsToday}/>
            <DashboardItem title="Pending Invoice Approvals" value={pendingInvoiceApprovalsCount} icon={Hourglass} link="/invoices" description="Supplier invoices needing approval." isLoadingValue={isLoadingPendingInvoiceApprovals}/>
            <DashboardItem title="General Approvals" value={pendingApprovalsCount} icon={BadgeHelp} link="/admin/approvals" isLoadingValue={isLoadingPendingApprovals}/>
            <DashboardItem title="Unread Notifications" value={unreadNotificationsCount} icon={MailWarning} link="/admin/notifications" isLoadingValue={isLoadingUnreadNotifications}/>
            <DashboardItem title="Financials" icon={BarChart2} link="/finance/financials" description="View financial summaries."/>
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
            <DashboardItem title="Supplier Invoices" value={pendingInvoiceApprovalsCount} icon={FileText} link="/invoices" description="Manage supplier invoices." isLoadingValue={isLoadingPendingInvoiceApprovals} />
            <DashboardItem title="Stock Request Approvals" value={pendingStockRequestsCount} icon={ListChecks} link="/finance/approvals" description="Approve/reject stock requests." isLoadingValue={isLoadingPendingStockRequests} />
            <DashboardItem title="Financials" icon={BarChart2} link="/finance/financials" description="View financial summaries."/>
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
            <DashboardItem title="Low Stock Items" value={lowStockItemsCount} icon={AlertTriangle} link="/inventory?filter=lowstock" description="Items with &lt;10 stock." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Out of Stock Items" value={outOfStockItemsCount} icon={PackageX} link="/inventory?filter=outofstock" description="Items with 0 stock." isLoadingValue={isLoadingAllProductsForStats} />
            <DashboardItem title="Total Inventory Value" value={totalInventoryValue} icon={DollarSign} link="/inventory" description="Estimated value of current stock." isLoadingValue={isLoadingAllProductsForStats} isPrice />
            <DashboardItem title="My Pending Stock Requests" value={pendingStockRequestsCount} icon={ShoppingCart} link="/inventory#requests" description="Track your requests." isLoadingValue={isLoadingPendingStockRequests} />
            <DashboardItem title="Items Awaiting Receipt" value={itemsAwaitingReceiptCount} icon={PackageSearch} link="/inventory/receivership" description="Items from suppliers to be confirmed." isLoadingValue={isLoadingItemsAwaitingReceipt} />
            <DashboardItem title="All Inventory" value={"View"} icon={Warehouse} link="/inventory" description="Manage stock levels." />
          </>
        );
      case 'Supplier':
        return (
          <>
            <DashboardItem title="New Stock Requests Today" value={supplierNewStockRequestsToday} icon={Warehouse} link="/supplier/stock-requests" description="Requests needing fulfillment action." isLoadingValue={isLoadingSupplierNewStockRequests} />
            <DashboardItem title="Fulfilled/Invoiced Orders" value={supplierFulfilledRequests} icon={CheckCircle2} link="/supplier/stock-requests?filter=fulfilled" description="Requests you have invoiced." isLoadingValue={isLoadingSupplierFulfilled} />
            <DashboardItem title="Pending Invoices" value={supplierPendingInvoices} icon={FileText} link="/invoices?filter=pending" description="Your invoices awaiting payment/approval." isLoadingValue={isLoadingSupplierPendingInvoices} />
            <DashboardItem title="All Stock Requests" icon={ListChecks} link="/supplier/stock-requests" description="View all requests assigned to you." />
          </>
        );
      case 'Technician':
        return (
          <>
            <DashboardItem title="My Active Tasks" value={technicianActiveTasks} icon={Wrench} link="/tasks" isLoadingValue={isLoadingTechnicianActiveTasks} description="Tasks pending or in-progress."/>
            <DashboardItem title="Tasks Completed Today" value={technicianCompletedToday} icon={CheckCircle2} isLoadingValue={isLoadingTechnicianCompletedToday} description="Tasks you finished today."/>
            <DashboardItem title="Awaiting My Review" value={"0"} icon={AlertTriangle} isLoadingValue={false} description="Items needing your approval (Future)."/>
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
      case 'ServiceManager':
        return (
          <>
            <DashboardItem title="Total Active Prod. Tasks" value={smTotalActiveTasks} icon={ListChecks} link="/tasks" isLoadingValue={isLoadingSmTotalActiveTasks} description="All 'pending' or 'in-progress' tasks."/>
            <DashboardItem title="Tasks Needing Action" value={smTasksNeedingAction} icon={AlertTriangle} link="/tasks?filter=action" isLoadingValue={isLoadingSmTasksNeedingAction} description="Tasks 'pending' or 'needs_approval'."/>
            <DashboardItem title="Active Technicians" value={smActiveTechnicians} icon={UsersIcon} link="/admin/users?role=Technician" isLoadingValue={isLoadingSmActiveTechnicians} description="Count of enabled technicians."/>
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
      
      {role !== 'Admin' && role !== 'DispatchManager' && role !== 'FinanceManager' && role !== 'InventoryManager' && role !== 'Supplier' && role !== 'ServiceManager' && role !== 'Technician' && (
        <Alert>
          <BarChart2 className="h-4 w-4 mr-2" />
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
       {role === 'Supplier' && (
        <Alert variant="default" className="border-purple-500/50 bg-purple-500/5 text-purple-700 dark:text-purple-300">
          <PackageSearch className="h-4 w-4 mr-2 text-purple-500" />
          <AlertTitle className="text-purple-600 dark:text-purple-400">Supplier Portal Dashboard</AlertTitle>
          <AlertDescription className="text-purple-600/90 dark:text-purple-400/90">
            View stock requests, manage your fulfillments, and submit invoices. Your key metrics are updated here.
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
      {role === 'ServiceManager' && (
        <Alert variant="default" className="border-teal-500/50 bg-teal-500/5 text-teal-700 dark:text-teal-300">
          <Wrench className="h-4 w-4 mr-2 text-teal-500" />
          <AlertTitle className="text-teal-600 dark:text-teal-400">Service Manager Dashboard</AlertTitle>
          <AlertDescription className="text-teal-600/90 dark:text-teal-400/90">
            Oversee production tasks, manage technician workloads, and ensure quality. Metrics are updated in real-time.
          </AlertDescription>
        </Alert>
      )}
       {role === 'Technician' && (
        <Alert variant="default" className="border-sky-500/50 bg-sky-500/5 text-sky-700 dark:text-sky-300">
          <Wrench className="h-4 w-4 mr-2 text-sky-500" />
          <AlertTitle className="text-sky-600 dark:text-sky-400">Technician Dashboard</AlertTitle>
          <AlertDescription className="text-sky-600/90 dark:text-sky-400/90">
            View your assigned tasks and manage your production workload. Key metrics are displayed below.
          </AlertDescription>
        </Alert>
      )}


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {getRoleSpecificItems()}
      </div>


      {(role !== 'Admin' && role !== 'Supplier') && ( 
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(role === 'Technician' || role === 'ServiceManager') && <Link href="/tasks"><Button>View Tasks</Button></Link>}
            {(role === 'Rider') && <Link href="/deliveries"><Button>Manage Deliveries</Button></Link>}
             {role === 'DispatchManager' && <Link href="/admin/dispatch"><Button><Component className="mr-2 h-4 w-4" />Open Dispatch Center</Button></Link>}
             {role === 'FinanceManager' && (<>
                <Link href="/admin/payments"><Button><DollarSign className="mr-2 h-4 w-4" />View Payments</Button></Link>
                <Link href="/invoices"><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Supplier Invoices</Button></Link>
                <Link href="/finance/financials"><Button variant="outline"><BarChart2 className="mr-2 h-4 w-4" />Financials</Button></Link>
             </>)}
             {role === 'InventoryManager' && <Link href="/inventory"><Button><Warehouse className="mr-2 h-4 w-4" />Manage Inventory</Button></Link>}
          </CardContent>
        </Card>
      )}
      {role === 'Supplier' && (
          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                 <Link href="/supplier/stock-requests"><Button><Warehouse className="mr-2 h-4 w-4" />View Stock Requests</Button></Link>
                 <Link href="/invoices"><Button variant="outline"><FileText className="mr-2 h-4 w-4" />My Submitted Invoices</Button></Link>
            </CardContent>
          </Card>
      )}
    </div>
  );
}

