
export type UserRole = 
  | 'Admin'
  | 'Customer'
  | 'Technician'
  | 'Rider'
  | 'Supplier'
  | 'SupplyManager'
  | 'FinanceManager'
  | 'ServiceManager'
  | 'InventoryManager'
  | 'DispatchManager'
  | null; 

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  firstName?: string | null; // Added for more structured name data
  lastName?: string | null;  // Added for more structured name data
  photoURL?: string | null;
  role: UserRole;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string; 
  stock: number;
  dataAiHint?: string;
}

export interface Order {
  id: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; customization?: any }>;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  deliveryId?: string;
}

export interface Task {
  id: string;
  assigneeId: string; 
  type: 'engraving' | 'printing' | 'delivery' | string; // string for flexibility
  description: string;
  orderId?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval';
  createdAt: Date;
  updatedAt: Date;
}
