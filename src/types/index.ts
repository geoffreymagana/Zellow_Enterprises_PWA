
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
  firstName?: string | null; 
  lastName?: string | null;  
  photoURL?: string | null;
  role: UserRole;
  disabled?: boolean; // Added for account status
  createdAt?: any; // Keep serverTimestamp type flexible for Firestore
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
  id:string;
  assigneeId: string; 
  type: 'engraving' | 'printing' | 'delivery' | string; 
  description: string;
  orderId?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval';
  createdAt: Date;
  updatedAt: Date;
}
