

export type UserRole =
  | 'Admin'
  | 'Customer'
  | 'Technician'
  | 'Rider'
  | 'Supplier'
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
  price: number; // This is the BASE unit price of the product
  imageUrl?: string;
  stock: number;
  categories?: string[];
  supplier?: string; // Optional: default supplier ID
  createdAt?: any; // Firestore Timestamp or Date
  updatedAt?: any; // Firestore Timestamp or Date
  customizationOptions?: ProductCustomizationOption[]; // Kept for products that might have inline customizations
  customizationGroupId?: string | null; // ID of the assigned CustomizationGroupDefinition
  dataAiHint?: string;
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
  price: number; // Price per item AT TIME OF PURCHASE (this unit price INCLUDES customization adjustments if any were applied during cart addition)
  quantity: number;
  imageUrl?: string | null;
  customizations?: Record<string, any> | null; // { optionId: selectedValue, ... }
}

export interface GiftDetails {
  recipientName: string;
  recipientContactMethod: 'email' | 'phone' | '';
  recipientContactValue: string;
  giftMessage?: string;
  notifyRecipient: boolean;
  showPricesToRecipient: boolean;
  recipientCanViewAndTrack: boolean; 
}

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface OrderRating {
  value: number; // e.g., 1-5
  comment?: string;
  ratedAt: any; // Firestore Timestamp
  userId: string;
}

export interface Order {
  id: string; // Firestore document ID
  customerId: string | null; // Null if guest checkout
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number; // Overall total including shipping
  subTotal: number; // Total of items (items prices * quantity)
  shippingCost: number;
  status: OrderStatus;
  createdAt: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
  shippingAddress: ShippingAddress;
  shippingMethodId?: string | null;
  shippingMethodName?: string | null;
  deliveryId?: string | null; 
  riderId?: string | null;
  riderName?: string | null; 
  deliveryCoordinates?: { lat: number; lng: number } | null;
  deliveryNotes?: string | null; 
  color?: string | null; 
  estimatedDeliveryTime?: any | null; 
  actualDeliveryTime?: any | null; 
  deliveryHistory?: DeliveryHistoryEntry[];
  paymentMethod?: string | null; 
  paymentStatus: PaymentStatus;
  transactionId?: string | null; 
  isGift?: boolean;
  giftDetails?: GiftDetails | null;
  rating?: OrderRating | null; 
}

export interface CartItem {
  productId: string; 
  name: string;
  unitPrice: number; // Base unit price of the product (from Product.price)
  currentPrice: number; // Price for one unit INCLUDING customizations (calculated at time of adding to cart or customization)
  imageUrl?: string;
  quantity: number;
  stock: number;
  customizations?: Record<string, any>;
  cartItemId: string; 
}


export interface Task {
  id: string;
  orderId?: string; 
  itemName?: string; 
  taskType: string; 
  description: string; 
  assigneeId?: string; 
  assigneeName?: string; 
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval' | 'blocked' | 'rejected';
  relatedDocId?: string; 
  createdAt: any; 
  updatedAt: any; 
  dueDate?: any; 
  notes?: string;
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

export interface CustomizationGroupChoiceDefinition {
  value: string;
  label: string;
  priceAdjustment?: number;
}

export interface CustomizationGroupOptionDefinition {
  id: string; 
  label: string; 
  type: 'select' | 'text' | 'checkbox' | 'image_upload';
  required?: boolean;
  showToCustomerByDefault?: boolean;
  choices?: CustomizationGroupChoiceDefinition[];
  placeholder?: string;
  maxLength?: number;
  checkboxLabel?: string; 
  priceAdjustmentIfChecked?: number; 
  acceptedFileTypes?: string; 
  maxFileSizeMB?: number;
}

export interface CustomizationGroupDefinition {
  id: string; 
  name: string;
  options: CustomizationGroupOptionDefinition[];
  createdAt?: any; 
  updatedAt?: any; 
}

export type StockRequestStatus = 
  | 'pending_finance_approval'
  | 'pending_supplier_fulfillment'
  | 'awaiting_receipt' 
  | 'received' 
  | 'fulfilled' 
  | 'rejected_finance'
  | 'rejected_supplier'
  | 'cancelled';

export interface StockRequest {
  id: string; 
  productId: string;
  productName: string; 
  requestedQuantity: number;
  requesterId: string; 
  requesterName: string; 
  supplierId?: string; 
  supplierName?: string; 
  status: StockRequestStatus;
  financeManagerId?: string | null; 
  financeManagerName?: string | null; 
  financeActionTimestamp?: any; 
  financeNotes?: string; 
  supplierNotes?: string; 
  fulfilledQuantity?: number; 
  supplierActionTimestamp?: any; 
  inventoryManagerReceiptNotes?: string;
  receivedQuantity?: number; 
  receivedById?: string; 
  receivedByName?: string; 
  receivedAt?: any; 
  invoiceId?: string; 
  createdAt: any; 
  updatedAt: any; 
  notes?: string; 
}

export interface InvoiceItem {
  id?: string; 
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number; 
}

export type InvoiceStatus =
  | 'draft'
  | 'sent' 
  | 'pending_approval' 
  | 'approved_for_payment' 
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'rejected'; 

export interface Invoice {
  id: string; 
  invoiceNumber: string; 
  supplierId?: string; 
  supplierName?: string; 
  clientId?: string; 
  clientName: string; 
  invoiceDate: any; 
  dueDate: any; 
  items: InvoiceItem[];
  subTotal: number; 
  taxRate?: number; 
  taxAmount?: number; 
  totalAmount: number; 
  status: InvoiceStatus;
  notes?: string; 
  stockRequestId?: string; 
  createdAt: any; 
  updatedAt: any; 
  paymentDetails?: { 
    method?: string;
    transactionId?: string;
    paidAt?: any; 
  };
  financeManagerId?: string; 
  financeManagerName?: string; 
}

