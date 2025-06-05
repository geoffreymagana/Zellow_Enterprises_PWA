
"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, DollarSign, Package, ShoppingCart, Truck, Users as UsersIcon, Wrench, UserCog, Settings, FileArchive, ClipboardCheck, AlertTriangle, Layers } from 'lucide-react'; // Renamed Users to UsersIcon to avoid conflict
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Helper component for dashboard items
const DashboardItem = ({ title, value, icon: Icon, link, description }: { title: string; value: string | number; icon: React.ElementType; link?: string; description?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
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
  const { user, role } = useAuth();

  if (!user) {
    return <div>Loading user data...</div>;
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
      case 'DispatchManager': return "Dispatch Operations";
      default: return "Welcome to Zellow Enterprises";
    }
  };
  
  const getRoleSpecificItems = () => {
    // Placeholder data - in a real app, this would come from Firestore
    switch (role) {
      case 'Admin':
        return (
          <>
            <DashboardItem title="User Management" value={124} icon={UserCog} link="/admin/users" description="Add, edit, delete users and roles." />
            <DashboardItem title="Product Catalog" value={87} icon={Package} link="/admin/products" description="Manage all products." />
            <DashboardItem title="Order Processing" value={256} icon={ShoppingCart} link="/admin/orders" description="Oversee all customer orders." />
            <DashboardItem title="Payment Records" value={103} icon={DollarSign} link="/admin/payments" description="View financial transactions." />
            <DashboardItem title="Delivery Logistics" value={42} icon={Truck} link="/admin/deliveries" description="Track and manage deliveries." />
            <DashboardItem title="Service Approvals" value={12} icon={ClipboardCheck} link="/admin/approvals" description="Review pending requests." />
            <DashboardItem title="System Reports" value={35} icon={FileArchive} link="/admin/reports" description="Generate and view reports." />
            <DashboardItem title="Customization Hub" value={8} icon={Layers} link="/admin/customizations" description="Manage customization options." />
            <DashboardItem title="System Settings" value={"Online"} icon={Settings} link="/admin/settings" description="Configure application settings." />
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
            <DashboardItem title="Next Delivery Area" value={"North Zone"} icon={Truck} />
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
      
      {role !== 'Admin' && role !== 'Customer' && (
        <Alert>
          <BarChart className="h-4 w-4 mr-2" />
          <AlertTitle>Real-time Updates</AlertTitle>
          <AlertDescription>
            This dashboard will show real-time data once connected to Firestore. Placeholder values are shown.
          </AlertDescription>
        </Alert>
      )}
       {role === 'Admin' && (
        <Alert variant="default" className="border-primary/50 bg-primary/5 text-primary-foreground-muted">
          <AlertTriangle className="h-4 w-4 mr-2 text-primary" />
          <AlertTitle className="text-primary">Admin Panel Active</AlertTitle>
          <AlertDescription className="text-primary/90">
            You have administrative privileges. Manage system data and operations from here. Data displayed is currently placeholder.
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

      {/* Admin Quick Actions Card removed */}

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
            {(role === 'Rider' || role === 'DispatchManager') && <Link href="/deliveries"><Button>Manage Deliveries</Button></Link>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

