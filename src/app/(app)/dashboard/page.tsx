"use client";

import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BarChart, DollarSign, Package, ShoppingCart, Truck, Users, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Helper component for dashboard items
const DashboardItem = ({ title, value, icon: Icon, link }: { title: string; value: string | number; icon: React.ElementType; link?: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {link && (
        <Link href={link} passHref>
          <Button variant="link" className="p-0 h-auto text-xs text-muted-foreground">View details</Button>
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
      case 'Customer':
        return (
          <>
            <DashboardItem title="Active Orders" value={3} icon={ShoppingCart} link="/orders" />
            <DashboardItem title="Wishlist Items" value={5} icon={Package} link="/products" />
            <DashboardItem title="Recent Activity" value="Payment successful" icon={DollarSign} />
          </>
        );
      case 'Technician':
        return (
          <>
            <DashboardItem title="Assigned Tasks" value={7} icon={Wrench} link="/tasks" />
            <DashboardItem title="Pending Approvals" value={2} icon={Wrench} />
            <DashboardItem title="Completed Today" value={1} icon={Wrench} />
          </>
        );
       case 'Rider':
        return (
          <>
            <DashboardItem title="Active Deliveries" value={4} icon={Truck} link="/deliveries" />
            <DashboardItem title="Completed Today" value={8} icon={Truck} />
            <DashboardItem title="Next Delivery Area" value="Zone B" icon={Truck} />
          </>
        );
      // Add more cases for other roles
      default:
        return <Alert><AlertTitle>No specific items for your role.</AlertTitle><AlertDescription>Explore available sections via navigation.</AlertDescription></Alert>;
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-semibold">{getRoleSpecificGreeting()}</h1>
      <p className="text-muted-foreground">
        Hello, {user.displayName || user.email}! Your role is: <span className="font-semibold text-primary">{role || 'Not Assigned'}</span>.
      </p>
      
      <Alert>
        <BarChart className="h-4 w-4" />
        <AlertTitle>Real-time Updates</AlertTitle>
        <AlertDescription>
          This dashboard will show real-time data once connected to Firestore.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {getRoleSpecificItems()}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {role === 'Customer' && <Link href="/products"><Button>Browse Products</Button></Link>}
          {role === 'Customer' && <Link href="/orders"><Button variant="outline">My Orders</Button></Link>}
          {(role === 'Technician' || role === 'ServiceManager') && <Link href="/tasks"><Button>View Tasks</Button></Link>}
          {(role === 'Rider' || role === 'DispatchManager') && <Link href="/deliveries"><Button>Manage Deliveries</Button></Link>}
          {/* Add more role-specific quick actions */}
        </CardContent>
      </Card>
    </div>
  );
}
