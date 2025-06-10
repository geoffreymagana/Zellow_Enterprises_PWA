
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
  label?: string;
  priceAdjustment?: number;
}

export interface ProductCustomizationOption {
  id: string;
  label: string;
  type: 'dropdown' | 'text' | 'checkbox' | 'image_upload' | 'color_picker';
  required?: boolean;
  showToCustomerByDefault?: boolean;
  choices?: CustomizationChoiceOption[];
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string | boolean;
  checkboxLabel?: string;
  priceAdjustmentIfChecked?: number;
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
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
  customizationGroupId?: string | null;
  dataAiHint?: string;
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
  email?: string;
  selectedShippingRegionId?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
  customizations?: Record<string, any> | null;
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
  value: number;
  comment?: string;
  ratedAt: any;
  userId: string;
}

export interface Order {
  senderName: string | undefined;
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  subTotal: number;
  shippingCost: number;
  status: OrderStatus;
  createdAt: any;
  updatedAt?: any;
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
  // giftTrackingToken?: string; // Removed this line
}

export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  currentPrice: number;
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
  label?: string; 
  priceAdjustment?: number;
}

export interface CustomizationGroupOptionDefinition {
  id: string;
  label: string;
  type: 'dropdown' | 'text' | 'checkbox' | 'image_upload' | 'color_picker';
  required?: boolean;
  showToCustomerByDefault?: boolean;
  choices?: CustomizationGroupChoiceDefinition[];
  placeholder?: string;
  maxLength?: number;
  checkboxLabel?: string;
  priceAdjustmentIfChecked?: number;
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
  defaultValue?: string | boolean; // Ensure this exists for completeness
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
