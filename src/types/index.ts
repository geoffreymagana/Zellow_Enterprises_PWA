
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
  currentLocation?: { lat: number; lng: number; timestamp: any } | null; // For riders
  currentRouteId?: string | null; // For riders
  assignedOrdersCount?: number; // Denormalized count for quick display
}

export interface CustomizationChoiceOption {
  value: string;
  label: string;
  priceAdjustment?: number; // Optional price change for this choice
}

export interface ProductCustomizationOption {
  id: string; // Unique ID for this option (e.g., 'color', 'engraving_text')
  label: string; // User-friendly label (e.g., "Choose Color", "Engraving Text")
  type: 'select' | 'text' | 'checkbox'; // Type of customization
  required?: boolean;
  choices?: CustomizationChoiceOption[]; // For 'select' type
  maxLength?: number; // For 'text' type
  placeholder?: string; // For 'text' type
  defaultValue?: string | boolean; // For 'text' or 'checkbox'
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  stock: number;
  categories?: string[];
  supplier?: string;
  createdAt?: any;
  updatedAt?: any;
  customizationOptions?: ProductCustomizationOption[];
  // dataAiHint has been removed as per user request
}

export type OrderStatus =
  | 'pending' // Customer placed, awaiting admin/dispatch action
  | 'processing' // Actively being worked on (customization, etc.)
  | 'awaiting_assignment' // Ready for a rider, but not yet assigned
  | 'assigned' // Rider assigned, awaiting pickup
  | 'out_for_delivery' // Rider has picked up and is en route
  | 'delivered' // Successfully delivered to customer
  | 'delivery_attempted' // Rider attempted delivery, but failed
  | 'cancelled' // Order cancelled by customer or admin
  | 'shipped'; // General shipped status, can be refined by above


export interface DeliveryHistoryEntry {
  status: OrderStatus | string; // More specific status or note
  timestamp: any; // Firestore serverTimestamp or Date
  notes?: string;
  actorId?: string; // UID of user who made the change (rider, dispatcher)
  location?: { lat: number; lng: number }; // Optional location at status change
}

export interface Order {
  id: string;
  customerId: string;
  customerName?: string; // Denormalize for easier display
  customerPhone?: string; // Denormalize
  items: Array<{
    productId: string;
    quantity: number;
    customization?: Record<string, any>; // Stores selected customization values
    name?: string;
    price?: number; // Price per item, potentially including customization adjustments
  }>;
  totalAmount: number;
  status: OrderStatus;
  createdAt: any; // Firestore serverTimestamp or Date
  updatedAt?: any; // Firestore serverTimestamp or Date
  deliveryId?: string; // Could be same as order ID or a separate tracking ID
  riderId?: string | null;
  riderName?: string | null; // Denormalized
  deliveryAddress: string;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  deliveryNotes?: string;
  color?: string | null; // For map color-coding
  estimatedDeliveryTime?: any | null; // Timestamp or ISO string
  actualDeliveryTime?: any | null; // Timestamp or ISO string
  deliveryHistory?: DeliveryHistoryEntry[];
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
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
