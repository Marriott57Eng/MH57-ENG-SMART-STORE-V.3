export interface InventoryItem {
  id: string; // ItemID (e.g. A000000166)
  name: string; // ItemName
  category: string; // Category
  unit: string; // Unit
  qty: number; // Qty
  minStock: number; // MinStock
  location: string; // Location
  note: string; // Note
  ordered: string; // Ordered
  orderedDate: string; // OrderedDate
  status: 'normal' | 'low' | 'out';
  outOfStockDate?: string;
}

export interface InventorySummary {
  totalItems: number;
  totalQty: number;
  lowStockCount: number;
  outOfStockCount: number;
  categories: { name: string; count: number; totalQty: number }[];
  locations: { name: string; count: number }[];
  lastUpdated: string;
}

export interface RequisitionRecord {
  id: string;
  type?: 'out' | 'in'; // 'out' = เบิกออก, 'in' = รับเข้า (default 'out')
  itemId: string;
  itemName: string;
  category: string;
  qty: number;
  unit: string;
  requestedBy: string; // ใครทำรายการ (ผู้เบิก / ผู้รับเข้า)
  purpose: string; // งานที่นำไปใช้ / แหล่งที่มารับเข้า
  timestamp: string; // วันที่และเวลา เช่น 13 ส.ค. 2026, 14:30 น.
  isoDate: string; // ISO format for sorting
  note?: string;
}

export interface ReportAction {
  format?: "pdf" | "excel";
  type: 
    | 'inventory_all' 
    | 'requisition_history' 
    | 'individual_requisitions' 
    | 'low_stock' 
    | 'category' 
    | 'purchase_orders' 
    | 'executive_summary';
  title: string;
  subtitle?: string;
  categoryFilter?: string;
  userFilter?: string;
  orderStatusFilter?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

export interface DbActionPayload {
  action: 'requisition' | 'stock_in' | 'update_stock' | 'delete_record' | 'error';
  status: 'success' | 'failed';
  message: string;
  record?: RequisitionRecord;
  item?: InventoryItem;
  previousQty?: number;
  newQty?: number;
  recordId?: string;
  skipVoice?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: 'text' | 'live';
  suggestedItems?: InventoryItem[];
  fileReport?: ReportAction; // Keep for backward compatibility
  fileReports?: ReportAction[];
  pdfReport?: any;
  dbAction?: DbActionPayload;
  isPendingConfirmation?: boolean;
  isCancelled?: boolean;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  nickname?: string;
  role: 'admin' | 'user';
  createdAt?: string;
  sessionToken?: string;
  activeDeviceId?: string;
  lastActiveAt?: number;
}

export interface LineNotificationConfig {
  enabled: boolean;
  channelAccessToken: string;
  destinationId: string; // User ID (U...) or Group ID (C.../R...)
  notifyStockOut: boolean;
  notifyStockIn: boolean;
  notifyLogin: boolean;
  notifyLogout: boolean;
  notifyLowStock?: boolean;
  notifyPurchaseOrder?: boolean;
  // Dedicated Destination & Token for Purchase Orders
  useSeparateOrderDestination?: boolean;
  purchaseOrderDestinationId?: string; // Group ID or User ID specifically for purchase orders
  purchaseOrderChannelAccessToken?: string; // Optional separate Bot Token for purchase orders
  updatedAt?: string;
  updatedBy?: string;
}

export interface PurchaseOrder {
  id: string; // Order Code / PO Code (e.g. PO-2026-001 or editable)
  itemId: string; // Item Code (editable)
  itemName: string; // Item Name (editable)
  category: string;
  qty: number; // Order Quantity (editable)
  unit: string; // Unit (editable)
  currentQty?: number;
  minStock?: number;
  location?: string;
  requestedBy: string; // Requester name
  brand?: string; // ยี่ห้อ
  model?: string; // รุ่น
  supplier?: string;
  note?: string;
  urgency?: 'normal' | 'urgent' | 'critical';
  status: 'pending' | 'confirmed' | 'received' | 'cancelled';
  createdAt: string;
  isoDate: string;
  confirmedAt?: string;
  confirmedBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  confirmationToken?: string | null;
  confirmationTokenUsed?: boolean;
  isLocked?: boolean;
}

export interface LinePurchaseOrderNotifyData {
  order: PurchaseOrder;
  baseUrl?: string;
}

export interface LineStockNotifyData {
  type: 'in' | 'out';
  itemId: string;
  itemName: string;
  category?: string;
  qty: number;
  unit: string;
  location?: string;
  requestedBy: string;
  purpose?: string;
  note?: string;
  timestamp?: string;
  previousQty?: number;
  newQty?: number;
  status?: 'normal' | 'low' | 'out';
}

export interface LineBulkStockNotifyData {
  items: Array<{
    itemId: string;
    itemName: string;
    qty: number;
    unit: string;
    newQty?: number;
  }>;
  requestedBy: string;
  purpose: string;
  note?: string;
  timestamp?: string;
}

export interface LineAuthNotifyData {
  type: 'login' | 'logout';
  userId?: string;
  username: string;
  name: string;
  nickname?: string;
  role: 'admin' | 'user';
  timestamp?: string;
}

export interface WebPushNotificationConfig {
  enabled: boolean;
  notifyLowStock: boolean;
  notifyRequisition?: boolean;
  notifyImportantRequisition?: boolean;
  notifyPurchaseOrder?: boolean;
  importantRequisitionThreshold?: number; // e.g., qty >= 5
  updatedAt?: string;
  updatedBy?: string;
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  type?: 'low_stock' | 'requisition' | 'order' | 'system';
  data?: Record<string, any>;
}

export interface WebPushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userName?: string;
  deviceInfo?: string;
  subscribedAt: string;
}
