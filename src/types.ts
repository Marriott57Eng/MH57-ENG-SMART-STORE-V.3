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
  type: 'inventory_all' | 'requisition_history' | 'low_stock' | 'category';
  title: string;
  categoryFilter?: string;
  userFilter?: string;
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
  updatedAt?: string;
  updatedBy?: string;
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

export interface LineAuthNotifyData {
  type: 'login' | 'logout';
  userId?: string;
  username: string;
  name: string;
  nickname?: string;
  role: 'admin' | 'user';
  timestamp?: string;
}
