export type UserRole = 
  | 'Admin' // Should not use PWA, but defined for completeness
  | 'Customer'
  | 'Technician'
  | 'Rider'
  | 'Supplier'
  | 'SupplyManager'
  | 'FinanceManager'
  | 'ServiceManager'
  | 'InventoryManager'
  | 'DispatchManager'
  | null; // For unauthenticated or role not set

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role: UserRole;
}

// Add other types as needed, for example:
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string; // URL from Google Drive
  stock: number;
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
  assigneeId: string; // Technician or Rider ID
  type: 'engraving' | 'printing' | 'delivery';
  description: string;
  orderId?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval';
  createdAt: Date;
  updatedAt: Date;
}
