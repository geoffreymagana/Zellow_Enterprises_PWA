

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
  createdAt?: any; // Firestore Timestamp or Date
  currentLocation?: { lat: number; lng: number; timestamp: any } | null; // Firestore Timestamp or Date for timestamp
  currentRouteId?: string | null;
  assignedOrdersCount?: number;
}

export interface CustomizationChoiceOption {
  value: string;
  label: string;
  priceAdjustment?: number;
}

export interface ProductCustomizationOption {
  id: string; // e.g., "engraving_text", "color_option"
  label: string; // e.g., "Engraving Text", "Select Color"
  type: 'select' | 'text' | 'checkbox';
  required?: boolean;
  choices?: CustomizationChoiceOption[]; // For 'select' or 'radio' types
  maxLength?: number; // For 'text' type
  placeholder?: string; // For 'text' or 'checkbox' (as label text)
  defaultValue?: string | boolean; // Default value for the option
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
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
  customizationOptions?: ProductCustomizationOption[];
}

export type OrderStatus =
  | 'pending' // Customer placed order, awaiting payment/processing
  | 'processing' // Payment confirmed, order being prepared
  | 'awaiting_assignment' // Ready for dispatch, needs rider
  | 'assigned' // Rider assigned to order
  | 'out_for_delivery' // Rider has picked up and is en route
  | 'delivered' // Customer received order
  | 'delivery_attempted' // Rider attempted delivery but failed
  | 'cancelled' // Order cancelled by customer or admin
  | 'shipped'; // Alternative to out_for_delivery for non-local courier

export interface DeliveryHistoryEntry {
  status: OrderStatus | string; // Could be custom status string
  timestamp: any; // Firestore Timestamp or Date
  notes?: string;
  actorId?: string; // UID of user who made the change (admin, rider, system)
  location?: { lat: number; lng: number }; // Optional location for status update
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string; // This will be the selected Town
  county: string; // Derived from selected Town/Region
  postalCode?: string;
  phone: string;
  email?: string;
  selectedShippingRegionId?: string; // Store the ID of the selected region
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number; // Price per item AT TIME OF PURCHASE (incl. customization adjustments)
  quantity: number;
  imageUrl?: string | null;
  customizations?: Record<string, any> | null; // { optionId: selectedValue, ... }
}

export interface Order {
  id: string; // Firestore document ID
  customerId: string | null; // Null if guest checkout
  customerName: string; 
  customerEmail: string; 
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  subTotal: number;
  shippingCost: number;
  status: OrderStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  shippingAddress: ShippingAddress;
  shippingMethodId?: string | null;
  shippingMethodName?: string | null;
  deliveryId?: string | null; // Link to a potential separate delivery document/task
  riderId?: string | null;
  riderName?: string | null; // Denormalized for quick display
  deliveryCoordinates?: { lat: number; lng: number } | null;
  deliveryNotes?: string | null; // Notes specifically for the delivery driver
  color?: string | null; // For map marker differentiation, set by admin/dispatcher
  estimatedDeliveryTime?: any | null; // Firestore Timestamp or Date
  actualDeliveryTime?: any | null; // Firestore Timestamp or Date
  deliveryHistory?: DeliveryHistoryEntry[];
  paymentMethod?: string | null; // e.g., 'cod', 'mpesa', 'card'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  transactionId?: string | null; // ID from payment gateway
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
  assigneeId: string; // UID of the staff member
  type: 'engraving' | 'printing' | 'assembly' | 'quality_check' | string; // Task category
  description: string;
  orderId?: string; // Associated order, if any
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval' | 'blocked';
  createdAt: any; // Firestore Timestamp or Date
  updatedAt: any; // Firestore Timestamp or Date
  dueDate?: any; // Firestore Timestamp or Date
  notes?: string;
  attachments?: { name: string; url: string }[]; // e.g., proof of work images
}

export interface ShippingRegion {
  id: string;
  name: string; // e.g., "Nairobi CBD & Westlands", "Mombasa Island"
  county: string; // e.g., "Nairobi", "Mombasa"
  towns: string[]; // List of towns/areas covered by this region
  active: boolean;
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
}

export interface ShippingMethod {
  id: string;
  name: string; // e.g., "Standard Delivery", "Express Delivery"
  description: string;
  duration: string; // e.g., "1-2 business days", "Same-day (within 3 hours)"
  basePrice: number; // Default price if no specific region rate
  active: boolean;
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
}

// This defines a specific rate for a method in a particular region
export interface ShippingRate {
  id: string;
  regionId: string; // Foreign key to ShippingRegion
  methodId: string; // Foreign key to ShippingMethod
  customPrice: number; // The price for this method in this region
  notes?: string; // Optional notes for this specific rate
  active: boolean;
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
}

