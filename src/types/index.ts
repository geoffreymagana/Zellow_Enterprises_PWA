
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
  currentLocation?: { lat: number; lng: number; timestamp: any } | null;
  currentRouteId?: string | null;
  assignedOrdersCount?: number;
}

export interface CustomizationChoiceOption {
  value: string;
  label: string;
  priceAdjustment?: number;
}

export interface ProductCustomizationOption {
  id: string;
  label: string;
  type: 'select' | 'text' | 'checkbox';
  required?: boolean;
  choices?: CustomizationChoiceOption[];
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string | boolean;
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
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_assignment'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_attempted'
  | 'cancelled'
  | 'shipped';

export interface DeliveryHistoryEntry {
  status: OrderStatus | string;
  timestamp: any;
  notes?: string;
  actorId?: string;
  location?: { lat: number; lng: number };
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county: string;
  postalCode?: string;
  phone: string;
  email?: string; // Include email in shipping address for guest checkouts or confirmation
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number; // Price per item AT TIME OF PURCHASE (incl. customization adjustments)
  quantity: number;
  imageUrl?: string;
  customizations?: Record<string, any>; // { optionId: selectedValue, ... }
}

export interface Order {
  id: string; // Firestore document ID
  customerId: string | null; // Null if guest checkout
  customerName: string; // From shipping details
  customerEmail: string; // From shipping details or user account
  customerPhone: string; // From shipping details
  items: OrderItem[];
  totalAmount: number;
  subTotal: number;
  shippingCost: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt?: any;
  shippingAddress: ShippingAddress;
  deliveryId?: string;
  riderId?: string | null;
  riderName?: string | null;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  deliveryNotes?: string;
  color?: string | null;
  estimatedDeliveryTime?: any | null;
  actualDeliveryTime?: any | null;
  deliveryHistory?: DeliveryHistoryEntry[];
  paymentMethod?: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'; // Default to 'pending'
  transactionId?: string;
}

export interface CartItem {
  productId: string; // Product ID
  name: string;
  unitPrice: number; // Base price of the product
  currentPrice: number; // Price for one unit INCLUDING customizations
  imageUrl?: string;
  quantity: number;
  stock: number;
  customizations?: Record<string, any>;
  cartItemId: string; // Unique ID for this specific cart entry (productId + sorted customization signature)
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
  id: string;
  name: string;
  county: string;
  towns: string[];
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  duration: string;
  basePrice: number;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ShippingRate {
  id: string;
  regionId: string;
  methodId: string;
  customPrice: number;
  notes?: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}
