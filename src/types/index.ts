

export type UserRole =
  | 'Admin'
  | 'Customer'
  | 'Engraving'
  | 'Printing'
  | 'Assembly'
  | 'Quality Check'
  | 'Packaging'
  | 'Rider'
  | 'Supplier'
  | 'FinanceManager'
  | 'ServiceManager'
  | 'InventoryManager'
  | 'DispatchManager'
  | null;
  
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  county?: string | null;
  town?: string | null;
  photoURL?: string | null;
  role: UserRole;
  status?: UserStatus;
  rejectionReason?: string;
  disabled?: boolean;
  disabledAt?: any; // Firestore Timestamp
  createdAt?: any; // Firestore Timestamp
  currentLocation?: { lat: number; lng: number; timestamp: any } | null;
  currentRouteId?: string | null;
  assignedOrdersCount?: number;
}

export type ApprovalRequestType = 'user_registration' | 'other_request_type';
export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  id: string;
  type: ApprovalRequestType;
  status: ApprovalRequestStatus;
  requestedBy: string; // User ID
  requestedByName: string;
  requestedByEmail: string;
  requestedAt: any; // Firestore Timestamp
  details: Record<string, any>; // e.g., { userId: '...', userName: '...' }
  resolvedBy?: string; // Admin User ID
  resolvedAt?: any; // Firestore Timestamp
  resolutionNotes?: string;
}


export interface CustomizationChoiceOption {
  value: string;
  label?: string;
  priceAdjustment?: number;
}

export interface ProductCustomizationOption {
  id: string;
  label: string;
  type: 'dropdown' | 'text' | 'checkbox' | 'image_upload' | 'color_picker' | 'checkbox_group';
  required?: boolean;
  showToCustomerByDefault?: boolean;
  choices?: CustomizationChoiceOption[];
  maxLength?: number;
  placeholder?: string;
  defaultValue?: string | boolean | string[];
  checkboxLabel?: string;
  priceAdjustmentIfChecked?: number;
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // This is now the SELLING PRICE (product_price)
  supplierPrice?: number | null; // This is the COST PRICE from the supplier
  published?: boolean;
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
  | 'pending_finance_approval'
  | 'processing' // Order approved, ready for production tasks to be created
  | 'in_production' // A task has been started by a technician
  | 'awaiting_quality_check' // A technician has submitted work for approval
  | 'production_complete' // All tasks are done, ready for dispatch assignment
  | 'awaiting_assignment' // Alias for production_complete, for dispatch view
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_attempted'
  | 'cancelled'
  | 'shipped'
  | 'awaiting_customer_confirmation';

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
  price: number; // The price at which the item was sold
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
  customerNotes?: string | null; 
  isBulkOrder?: boolean;
  bulkOrderRequestId?: string;
}

export type BulkOrderStatus = 'pending_review' | 'approved' | 'rejected' | 'fulfilled';

export interface BulkOrderItem {
  productId: string;
  name: string;
  quantity: number;
  notes?: string;
  customizations?: Record<string, any>;
}

export interface BulkOrderRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  companyName?: string;
  desiredDeliveryDate: any; // Timestamp
  items: BulkOrderItem[];
  status: BulkOrderStatus;
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
  adminNotes?: string;
  convertedOrderId?: string;
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
  taskType: "Engraving" | "Printing" | "Assembly" | "Quality Check" | "Packaging" | string;
  description: string;
  assigneeId?: string;
  assigneeName?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval' | 'blocked' | 'rejected';
  customizations?: Record<string, any> | null;
  proofOfWorkUrl?: string | null;
  serviceManagerNotes?: string | null;
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
  type: 'dropdown' | 'text' | 'checkbox' | 'image_upload' | 'color_picker' | 'checkbox_group';
  required?: boolean;
  showToCustomerByDefault?: boolean;
  choices?: CustomizationGroupChoiceDefinition[];
  placeholder?: string;
  maxLength?: number;
  checkboxLabel?: string;
  priceAdjustmentIfChecked?: number;
  acceptedFileTypes?: string;
  maxFileSizeMB?: number;
  defaultValue?: string | boolean | string[];
}

export interface CustomizationGroupDefinition {
  id: string;
  name: string;
  options: CustomizationGroupOptionDefinition[];
  createdAt?: any;
  updatedAt?: any;
}

export type StockRequestStatus =
  | 'pending_bids'
  | 'pending_award'
  | 'awarded'
  | 'awaiting_fulfillment'
  | 'awaiting_receipt'
  | 'received'
  | 'rejected_finance'
  | 'rejected_supplier'
  | 'cancelled'
  | 'fulfilled'; // Legacy, prefer 'received'

export interface Bid {
  id: string;
  supplierId: string;
  supplierName: string;
  pricePerUnit: number;
  taxRate?: number;
  notes?: string;
  createdAt: any; // Firestore Timestamp or Date
}

export interface StockRequest {
  id: string;
  productId: string;
  productName: string;
  requestedQuantity: number;
  requesterId: string;
  requesterName: string;
  status: StockRequestStatus;
  notes?: string; // Inventory Manager's initial notes
  createdAt: any;
  updatedAt: any;
  
  // Bidding and Awarding
  bids?: Bid[];
  winningBidId?: string;
  supplierPrice?: number; // The winning price per unit
  supplierId?: string;
  supplierName?: string;

  // Finance
  financeManagerId?: string | null;
  financeManagerName?: string | null;
  financeActionTimestamp?: any;
  financeNotes?: string;
  
  // Fulfillment and Receipt
  supplierNotes?: string;
  fulfilledQuantity?: number;
  supplierActionTimestamp?: any;
  inventoryManagerReceiptNotes?: string;
  receivedQuantity?: number;
  receivedById?: string;
  receivedByName?: string;
  receivedAt?: any;
  invoiceId?: string;
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
  | 'rejected'
  | 'reconciled'; 

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId?: string;
  supplierName?: string;
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

export interface FeedbackThread {
  id: string;
  subject: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  targetRole: UserRole | 'Customer Broadcast';
  targetUserId?: string;
  targetUserName?: string | null;
  status: 'open' | 'replied' | 'closed';
  lastMessageSnippet: string;
  createdAt: any;
  updatedAt: any;
  lastReplierRole?: UserRole;
}

export interface FeedbackMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  message: string;
  createdAt: any;
}
