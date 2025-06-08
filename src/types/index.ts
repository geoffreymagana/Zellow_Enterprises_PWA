
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
  price: number;
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
  price: number; // Price per item AT TIME OF PURCHASE (incl. customization adjustments)
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
  recipientCanViewAndTrack: boolean; // New field
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
  paymentStatus: PaymentStatus;
  transactionId?: string | null; // ID from payment gateway
  isGift?: boolean;
  giftDetails?: GiftDetails | null;
  rating?: OrderRating | null; // New field for order rating
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
  id: string;
  orderId?: string; // Can be null if it's a general task not tied to an order
  itemName?: string; // Denormalized product name if related to order item
  taskType: string; // e.g., Engraving, Printing, Stocking, Approval
  description: string; // Specific instructions for the task
  assigneeId?: string; // UID of the technician, manager etc.
  assigneeName?: string; // Denormalized assignee name
  status: 'pending' | 'in-progress' | 'completed' | 'needs_approval' | 'blocked' | 'rejected';
  relatedDocId?: string; // e.g. orderId for order tasks, stockRequestId for stock tasks
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  dueDate?: any; // Optional Firestore Timestamp
  notes?: string;
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

// Customization Group Definitions
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

  // For 'select'
  choices?: CustomizationGroupChoiceDefinition[];

  // For 'text'
  placeholder?: string;
  maxLength?: number;

  // For 'checkbox'
  checkboxLabel?: string; // Label for the checkbox itself
  priceAdjustmentIfChecked?: number; // Price adjustment if this checkbox is checked

  // For 'image_upload'
  acceptedFileTypes?: string; // e.g., ".png, .jpg, .jpeg"
  maxFileSizeMB?: number;
}

export interface CustomizationGroupDefinition {
  id: string; // Firestore document ID
  name: string;
  options: CustomizationGroupOptionDefinition[];
  createdAt?: any; // Firestore Timestamp
  updatedAt?: any; // Firestore Timestamp
}

export type StockRequestStatus = 
  | 'pending_finance_approval'
  | 'pending_supplier_fulfillment'
  | 'awaiting_receipt' // Supplier has fulfilled, waiting for IM to receive
  | 'received' // IM has confirmed receipt and updated stock
  | 'fulfilled' // Kept for backward compatibility or if direct fulfillment without IM check is needed
  | 'rejected_finance'
  | 'rejected_supplier'
  | 'cancelled';

export interface StockRequest {
  id: string; // Firestore document ID
  productId: string;
  productName: string; // Denormalized
  requestedQuantity: number;
  requesterId: string; // Inventory Manager UID
  requesterName: string; // Inventory Manager Name
  supplierId?: string; // Optional: Specific supplier targeted (can be product's default supplier)
  supplierName?: string; // Denormalized
  status: StockRequestStatus;
  financeManagerId?: string | null; // UID of Finance Manager who actioned
  financeManagerName?: string | null; // Name of Finance Manager
  financeActionTimestamp?: any; // Firestore Timestamp
  financeNotes?: string; // Notes from finance, e.g., rejection reason
  supplierNotes?: string; // Notes from supplier, e.g., partial fulfillment
  fulfilledQuantity?: number; // Quantity actually fulfilled by supplier
  supplierActionTimestamp?: any; // Firestore Timestamp
  
  inventoryManagerReceiptNotes?: string;
  receivedQuantity?: number; // Actual quantity received by IM
  receivedById?: string; // IM UID
  receivedByName?: string; // IM Name
  receivedAt?: any; // Firestore Timestamp
  
  invoiceId?: string; // ID of the invoice generated by the supplier for this request

  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  notes?: string; // General notes by requester
}

// Invoice Management
export interface InvoiceItem {
  id?: string; // for useFieldArray key
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number; // Calculated: quantity * unitPrice
}

export type InvoiceStatus =
  | 'draft'
  | 'sent' // Sent to Zellow by Supplier (awaiting approval) - OR sent by Zellow to external client
  | 'pending_approval' // Specifically for supplier invoices awaiting finance manager approval
  | 'approved_for_payment' // Finance manager approved, awaiting payment processing
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'rejected'; // If finance manager rejects

export interface Invoice {
  id: string; // Firestore document ID
  invoiceNumber: string; // Auto-generated or manual
  supplierId?: string; // UID of the supplier who created it (if applicable)
  supplierName?: string; // Denormalized
  clientId?: string; // For Zellow, this would be our internal ID or a fixed value
  clientName: string; // e.g., "Zellow Enterprises"
  invoiceDate: any; // Firestore Timestamp
  dueDate: any; // Firestore Timestamp
  items: InvoiceItem[];
  subTotal: number; // Sum of all item.totalPrice
  taxRate?: number; // e.g., 0.05 for 5%. Optional.
  taxAmount?: number; // Calculated: subTotal * taxRate. Optional.
  totalAmount: number; // subTotal + taxAmount (if applicable)
  status: InvoiceStatus;
  notes?: string; // General notes for the invoice
  stockRequestId?: string; // Link to the stock request if this invoice is for one
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  paymentDetails?: { // Optional details about payment
    method?: string;
    transactionId?: string;
    paidAt?: any; // Firestore Timestamp
  };
  financeManagerId?: string; // UID of Finance Manager who actioned
  financeManagerName?: string; // Name of Finance Manager
}
