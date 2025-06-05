
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
  disabled?: boolean;
  createdAt?: any; 
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

export interface ShippingRegion {
  id: string; // Firestore document ID
  name: string;
  county: string;
  towns: string[]; // Array of town names
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShippingMethod {
  id: string; // Firestore document ID
  name: string;
  description: string;
  duration: string; // e.g., "24h", "3-5 days"
  basePrice: number;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShippingRate {
  id: string; // Firestore document ID
  regionId: string; // Reference to ShippingRegions document ID
  methodId: string; // Reference to ShippingMethods document ID
  customPrice: number;
  notes?: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}
