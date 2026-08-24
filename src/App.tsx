import { db } from './firebase';
import { collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import React, { useState, useEffect } from 'react';
import { InventoryItem, InventorySummary, ChatMessage, RequisitionRecord, DbActionPayload } from './types';
import { ItemCard } from './components/ItemCard';
import { ItemDetailModal } from './components/ItemDetailModal';
import { MobileNavbar, AppTab } from './components/MobileNavbar';
import { VoiceAssistantView } from './components/VoiceAssistantView';
import { StatsDashboard } from './components/StatsDashboard';
import { CategoryView } from './components/CategoryView';
import { Toast, ToastMessage } from './components/Toast';
import { RequisitionView } from './components/RequisitionView';
import { RequisitionModal } from './components/RequisitionModal';
import { EditItemModal } from './components/EditItemModal';
import { EditRequisitionModal } from './components/EditRequisitionModal';
import { LoginView } from './components/LoginView';
import { UserManagementView } from './components/UserManagementView';
import { ThemeToggle } from './components/ThemeToggle';
import { EngLogo } from './components/EngLogo';
import { 
  Package, Search, RefreshCw, Filter, ClipboardList, Plus,
  AlertTriangle, CheckCircle2, XCircle, Bot, X, FileDown, Loader2, LogOut, User as UserIcon
} from 'lucide-react';
import { generateAndDownloadPdf } from './utils/pdfGenerator';
import { User } from './types';

// Helper function to strip undefined values so Firestore never errors on setDoc
function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

// Realistic initial sample records for requisition / stock logs
const INITIAL_REQUISITION_LOGS: RequisitionRecord[] = [
  {
    id: '1001',
    type: 'out',
    itemId: 'A000000166',
    itemName: 'ทินเนอร์',
    category: 'เคมี',
    qty: 2,
    unit: 'ถัง',
    requestedBy: 'ช่างสมชาย ใจดี',
    purpose: 'ผสมสีและล้างแปรงทาสี บานประตูชั้น 5',
    timestamp: '13 ส.ค. 2569, 10:15 น.',
    isoDate: '2026-08-13T10:15:00',
    note: 'งานปรับปรุงสีประจำสัปดาห์',
  },
  {
    id: '1002',
    type: 'in',
    itemId: 'A000000001',
    itemName: 'สาย THW 1x1.5 สีแดง',
    category: 'ไฟฟ้า',
    qty: 10,
    unit: 'ม้วน',
    requestedBy: 'ฝ่ายจัดซื้อ / วิชัย',
    purpose: 'รับของตามใบสั่งซื้อ PO-2026-088',
    timestamp: '13 ส.ค. 2569, 09:30 น.',
    isoDate: '2026-08-13T09:30:00',
    note: 'ตรวจรับเรียบร้อย สินค้าสมบูรณ์',
  },
  {
    id: '1003',
    type: 'out',
    itemId: 'A000000035',
    itemName: 'สาย LAN',
    category: 'เน็ต+โทรศัพท์',
    qty: 1,
    unit: 'ม้วน',
    requestedBy: 'ช่างเอกชัย พัฒนา',
    purpose: 'เดินสายสัญญาณอินเทอร์เน็ต ออฟฟิศ ชั้น 6',
    timestamp: '12 ส.ค. 2569, 15:40 น.',
    isoDate: '2026-08-12T15:40:00',
    note: 'ติดตั้งจุดทำงานใหม่',
  },
  {
    id: '1004',
    type: 'out',
    itemId: 'A000000136',
    itemName: 'RINSING SPRAY (สายฉีดชำระ)',
    category: 'สุขภัณฑ์',
    qty: 1,
    unit: 'ชุด',
    requestedBy: 'ช่างมนัส สุริยะ',
    purpose: 'เปลี่ยนแทนของเดิมที่รั่วซึม ห้องน้ำชาย ชั้น 2',
    timestamp: '12 ส.ค. 2569, 11:20 น.',
    isoDate: '2026-08-12T11:20:00',
    note: 'ใบแจ้งซ่อม WO-4402',
  },
];

// Initial state helpers for instant 0ms load time
const getInitialInventory = (): InventoryItem[] => {
  try {
    const cached = localStorage.getItem('warehouse_inventory');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [];
};

const getInitialSummary = (): InventorySummary | null => {
  try {
    const cached = localStorage.getItem('warehouse_summary');
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  return null;
};

const getInitialRequisitions = (): RequisitionRecord[] => {
  try {
    const saved = localStorage.getItem('warehouse_requisitions');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: RequisitionRecord) => ({
          ...r,
          id: (r.id || '').replace(/^REQ-?/i, '')
        }));
      }
    }
  } catch (_) {}
  return INITIAL_REQUISITION_LOGS;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [items, setItems] = useState<InventoryItem[]>(getInitialInventory);
  const [summary, setSummary] = useState<InventorySummary | null>(getInitialSummary);
  const [loading, setLoading] = useState(() => getInitialInventory().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<AppTab>('inventory');

  const [dbErrorAlert, setDbErrorAlert] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [{ ...toast, id: Date.now().toString() + Math.random() }, ...prev]);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));
  // Alert state
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [hasShownAlert, setHasShownAlert] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'low_or_out'>('all');

  // Requisition history state with localStorage
  const [requisitions, setRequisitions] = useState<RequisitionRecord[]>(getInitialRequisitions);

  // Modals state
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
  const [itemForRequisition, setItemForRequisition] = useState<InventoryItem | null>(null);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [requisitionToEdit, setRequisitionToEdit] = useState<RequisitionRecord | null>(null);
  const [isEditRequisitionModalOpen, setIsEditRequisitionModalOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // AI Chat State (Text only)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingQuery, setPendingQuery] = useState('');
  const [isLiveActive, setIsLiveActive] = useState(false);

  // Recalculate summary stats helper
  const recalculateSummary = (itemsList: InventoryItem[]): InventorySummary => {
    const categoryMap = new Map();
    itemsList.forEach((item) => {
      const cat = item.category || 'ทั่วไป';
      const current = categoryMap.get(cat) || { count: 0, totalQty: 0 };
      current.count += 1;
      current.totalQty += Number(item.qty) || 0;
      categoryMap.set(cat, current);
    });

    const newSummary: InventorySummary = {
      totalItems: itemsList.length,
      totalQty: itemsList.reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
      lowStockCount: itemsList.filter((i) => i.status === 'low').length,
      outOfStockCount: itemsList.filter((i) => i.status === 'out').length,
      categories: Array.from(categoryMap.entries()).map(([name, stats]) => ({
        name,
        ...stats,
      })),
      locations: [],
      lastUpdated: new Date().toISOString(),
    };

    setSummary(newSummary);
    try {
      localStorage.setItem('warehouse_summary', JSON.stringify(newSummary));
    } catch (_) {}
    return newSummary;
  };

  // Persist requisitions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('warehouse_requisitions', JSON.stringify(requisitions));
    } catch (e) {
      console.warn('Failed to save requisitions to localStorage:', e);
    }
  }, [requisitions]);

  // Fetch Requisitions Data from Firestore
  const fetchRequisitions = async () => {
    try {
      const q = query(collection(db, 'requisitions'), orderBy('isoDate', 'desc'), limit(500));
      const querySnapshot = await getDocs(q);

      if (querySnapshot && !querySnapshot.empty) {
        const data = querySnapshot.docs.map(d => {
          const req = d.data() as RequisitionRecord;
          return {
            ...req,
            id: (req.id || d.id).replace(/^REQ-?/i, ''),
          };
        });
        if (data.length > 0) {
          setRequisitions(data);
          try {
            localStorage.setItem('warehouse_requisitions', JSON.stringify(data));
          } catch (_) {}
          return;
        }
      }
    } catch (err) {
      console.warn('Error fetching requisitions from Firestore, loading local fallback:', err);
    }
  };

  // Fetch Inventory Data from Firestore / backend
  const fetchInventory = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true);
      setError('');

      let inventoryData: InventoryItem[] = [];

      // 1. Fetch from Firestore (Source of Truth)
      try {
        const snapshot = await getDocs(collection(db, 'inventory'));
        if (snapshot && !snapshot.empty) {
          inventoryData = snapshot.docs.map((docSnap) => {
            const data = docSnap.data() as InventoryItem;
            const qty = Number(data.qty) || 0;
            const minStock = Number(data.minStock) || 1;
            let status: 'normal' | 'low' | 'out' = data.status || 'normal';
            if (qty <= 0) status = 'out';
            else if (qty <= minStock) status = 'low';

            return {
              ...data,
              qty,
              minStock,
              status,
              outOfStockDate: data.outOfStockDate || (qty <= 0 ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : '')
            };
          });
        }
      } catch (firestoreErr) {
        console.warn('Firestore fetch error:', firestoreErr);
      }

      // 2. If Firestore is completely empty (initial setup only), fetch from server
      if (inventoryData.length === 0) {
        try {
          const res = await fetch(`/api/inventory`);
          if (res.ok) {
            const data = await res.json();
            inventoryData = data.items || [];
          }
        } catch (apiErr) {
          console.warn('API inventory fetch failed:', apiErr);
        }
      }

      if (inventoryData.length > 0) {
        const calculatedSummary = recalculateSummary(inventoryData);
        setItems(inventoryData);
        
        try {
          localStorage.setItem('warehouse_inventory', JSON.stringify(inventoryData));
        } catch (_) {}
        
        // Trigger low stock alert if needed
        if (calculatedSummary && (calculatedSummary.lowStockCount > 0 || calculatedSummary.outOfStockCount > 0)) {
          if (!hasShownAlert) {
            setShowLowStockAlert(true);
            setHasShownAlert(true);
          }
        }
      } else {
        // Fallback to local cache if offline
        const cached = getInitialInventory();
        if (cached.length > 0) {
          setItems(cached);
          const cachedSum = getInitialSummary() || recalculateSummary(cached);
          setSummary(cachedSum);
        }
      }
      
      fetchRequisitions().catch(console.warn);
    } catch (err: any) {
      console.error('Error fetching inventory:', err);
      if (items.length === 0) {
        setError(err.message || 'ไม่สามารถโหลดข้อมูลจาก Store Data ได้ กรุณาลองใหม่อีกครั้ง');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Check for saved user session
    const savedUser = localStorage.getItem('warehouse_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {}
    }
    fetchInventory();

    // Real-time Firestore Inventory Listener
    const unsubInventory = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      if (!snapshot.empty) {
        const realTimeItems: InventoryItem[] = snapshot.docs.map(docSnap => {
          const data = docSnap.data() as InventoryItem;
          const qty = Number(data.qty) || 0;
          const minStock = Number(data.minStock) || 1;
          let status: 'normal' | 'low' | 'out' = data.status || 'normal';
          if (qty <= 0) status = 'out';
          else if (qty <= minStock) status = 'low';

          return {
            ...data,
            qty,
            minStock,
            status,
            outOfStockDate: data.outOfStockDate || (qty <= 0 ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : '')
          };
        });

        if (realTimeItems.length > 0) {
          setItems(realTimeItems);
          recalculateSummary(realTimeItems);
          try {
            localStorage.setItem('warehouse_inventory', JSON.stringify(realTimeItems));
          } catch (_) {}
          setLoading(false);
        }
      }
    }, (err) => {
      console.warn('Real-time inventory snapshot warning:', err);
    });

    // Real-time Firestore Requisitions Listener
    const qReqs = query(collection(db, 'requisitions'), orderBy('isoDate', 'desc'), limit(500));
    const unsubReqs = onSnapshot(qReqs, (snapshot) => {
      if (!snapshot.empty) {
        const realTimeReqs = snapshot.docs.map(d => {
          const req = d.data() as RequisitionRecord;
          return {
            ...req,
            id: (req.id || d.id).replace(/^REQ-?/i, '')
          };
        });
        setRequisitions(realTimeReqs);
        try {
          localStorage.setItem('warehouse_requisitions', JSON.stringify(realTimeReqs));
        } catch (_) {}
      }
    }, (err) => {
      console.warn('Real-time requisitions snapshot warning:', err);
    });

    return () => {
      unsubInventory();
      unsubReqs();
    };
  }, []);

  // Real-time listener for device lock and role changes
  useEffect(() => {
    if (!currentUser) return;

    const deviceId = localStorage.getItem('device_id');
    const userRef = doc(db, 'users', currentUser.id);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as User;
          
          // 1. Check if device lock changed to another device (Skip for Admininmad and admins)
          if (currentUser.role !== 'admin' && userData.activeDeviceId && deviceId && userData.activeDeviceId !== deviceId) {
            alert('บัญชีนี้ถูกเข้าสู่ระบบจากเครื่องอื่น หรือผู้ดูแลระบบได้ปลดล็อกบัญชีของคุณ');
            localStorage.removeItem('warehouse_user');
            setCurrentUser(null);
            return;
          }

          // 2. Check Role changes
          if (userData.role !== currentUser.role) {
            const updatedUser = { ...currentUser, role: userData.role };
            setCurrentUser(updatedUser);
            localStorage.setItem('warehouse_user', JSON.stringify(updatedUser));
          }
        }
      },
      (error) => {
        console.warn('Firestore user snapshot listener warning:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.id, currentUser?.sessionToken, currentUser?.role]);

  const handleUpdateCurrentUser = (updated: User) => {
    setCurrentUser(updated);
    try {
      localStorage.setItem('warehouse_user', JSON.stringify(updated));
    } catch (_) {}
  };

  // Handle New Requisition / Stock In submission (0ms Optimistic Update)
  const handleAddRequisition = async (recordData: Omit<RequisitionRecord, 'id'>) => {
    const newRecord: RequisitionRecord = cleanForFirestore({
      ...recordData,
      id: `${Date.now().toString().slice(-6)}`,
      isoDate: recordData.isoDate || new Date().toISOString(),
    });

    try {
      // 1. Instantly update requisition logs in memory (0ms)
      setRequisitions((prev) => {
        const updated = [newRecord, ...prev];
        try {
          localStorage.setItem('warehouse_requisitions', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });

      // 2. Find target item and immediately update inventory in memory (0ms)
      const currentItem = items.find((item) => item.id === recordData.itemId);
      if (currentItem) {
        const isStockIn = recordData.type === 'in';
        const newQty = isStockIn 
          ? Number(currentItem.qty) + Number(recordData.qty) 
          : Math.max(0, Number(currentItem.qty) - Number(recordData.qty));

        let newStatus: 'normal' | 'low' | 'out' = 'normal';
        if (newQty <= 0) newStatus = 'out';
        else if (newQty <= currentItem.minStock) newStatus = 'low';

        const updatedItem: InventoryItem = cleanForFirestore({
          ...currentItem,
          qty: newQty,
          status: newStatus,
          ...(newStatus === 'out' 
            ? { outOfStockDate: currentItem.outOfStockDate || new Date().toISOString() } 
            : {})
        });

        // Instant UI & state update
        const updatedList = items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
        setItems(updatedList);
        recalculateSummary(updatedList);

        try {
          localStorage.setItem('warehouse_inventory', JSON.stringify(updatedList));
        } catch (_) {}

        if (selectedItem?.id === updatedItem.id) {
          setSelectedItem(updatedItem);
        }

        addToast({
          type: 'success',
          title: isStockIn ? 'รับเข้าสินค้าสำเร็จ' : 'เบิกสินค้าสำเร็จ',
          message: `${isStockIn ? 'รับเข้า' : 'เบิก'} ${updatedItem.name} จำนวน ${recordData.qty} ${updatedItem.unit} (คงเหลือ: ${newQty} ${updatedItem.unit})`,
        });

        // 3. Persist to Firestore asynchronously in background (Non-blocking)
        Promise.all([
          setDoc(doc(db, 'requisitions', newRecord.id), newRecord),
          setDoc(doc(db, 'inventory', updatedItem.id), updatedItem)
        ]).catch(err => console.error("Background Firestore sync error:", err));
      } else {
        setDoc(doc(db, 'requisitions', newRecord.id), newRecord).catch(console.error);
      }
    } catch (err) {
      console.error("Failed to add requisition:", err);
      addToast({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  // Admin Item editing & deletion handlers
  const handleSaveEditedItem = async (updatedItem: InventoryItem, oldId?: string) => {
    if (currentUser?.role !== 'admin') {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขข้อมูลสินค้าได้');
      return;
    }

    try {
      const cleanItem = cleanForFirestore(updatedItem);
      if (oldId && oldId !== cleanItem.id) {
        await deleteDoc(doc(db, 'inventory', oldId));
      }
      await setDoc(doc(db, 'inventory', cleanItem.id), cleanItem);

      setItems((prev) => {
        const targetId = oldId || cleanItem.id;
        const exists = prev.some((i) => i.id === targetId);
        const newList = exists 
          ? prev.map((i) => (i.id === targetId ? cleanItem : i))
          : [cleanItem, ...prev];
        recalculateSummary(newList);
        try {
          localStorage.setItem('warehouse_inventory', JSON.stringify(newList));
        } catch (_) {}
        return newList;
      });

      if (selectedItem && (selectedItem.id === oldId || selectedItem.id === cleanItem.id)) {
        setSelectedItem(cleanItem);
      }

      addToast({
        type: 'success',
        title: 'บันทึกสำเร็จ',
        message: `แก้ไขข้อมูลสินค้า ${cleanItem.name} (${cleanItem.id}) เรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error('Error updating item:', err);
      throw err;
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (currentUser?.role !== 'admin') {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบสินค้าได้');
      return;
    }

    try {
      await deleteDoc(doc(db, 'inventory', itemId));
      setItems((prev) => {
        const newList = prev.filter((i) => i.id !== itemId);
        recalculateSummary(newList);
        try {
          localStorage.setItem('warehouse_inventory', JSON.stringify(newList));
        } catch (_) {}
        return newList;
      });
      if (selectedItem?.id === itemId) {
        setSelectedItem(null);
      }
      addToast({
        type: 'success',
        title: 'ลบสินค้าสำเร็จ',
        message: `ลบสินค้า ${itemId} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error('Error deleting item:', err);
      throw err;
    }
  };

  // Admin Requisition editing & deletion handlers
  const handleSaveEditedRequisition = async (updatedRecord: RequisitionRecord) => {
    if (currentUser?.role !== 'admin') {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขประวัติได้');
      return;
    }

    try {
      const cleanRecord = cleanForFirestore(updatedRecord);
      await setDoc(doc(db, 'requisitions', cleanRecord.id), cleanRecord);
      setRequisitions((prev) => prev.map((r) => (r.id === cleanRecord.id ? cleanRecord : r)));
      addToast({
        type: 'success',
        title: 'แก้ไขประวัติสำเร็จ',
        message: `บันทึกการแก้ไขรายการ ${cleanRecord.id} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error('Error updating requisition:', err);
      throw err;
    }
  };

  // Delete a requisition log record (ADMIN ONLY)
  const handleDeleteRequisition = async (id: string) => {
    if (currentUser?.role !== 'admin') {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบประวัติการเบิกได้');
      return;
    }

    try {
      await deleteDoc(doc(db, 'requisitions', id));
      setRequisitions((prev) => prev.filter((r) => r.id !== id));
      addToast({
        type: 'success',
        title: 'ลบประวัติสำเร็จ',
        message: `ลบประวัติรายการ ${id} เรียบร้อยแล้ว`,
      });
    } catch (err) {
      console.error("Failed to delete requisition", err);
      alert('เกิดข้อผิดพลาดในการลบประวัติรายการ');
    }
  };

  // Handle database modifications executed by AI (0ms Optimistic Update)
  const handleExecuteDbAction = async (action: DbActionPayload) => {
    if (action.action === 'error') {
      addToast({ type: 'error', title: 'ไม่สามารถทำรายการได้', message: action.message || 'เกิดข้อผิดพลาด' });
      setDbErrorAlert(action.message || 'เกิดข้อผิดพลาดในการทำรายการ');
      return;
    }

    if (action.action === 'update_stock' && currentUser?.role !== 'admin') {
      addToast({ type: 'error', title: 'ไม่มีสิทธิ์ดำเนินการ', message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถแก้ไขสต็อกหรือชื่ออะไหล่ได้' });
      return;
    }
    
    // Popup Success
    if (action.action === 'requisition') {
      addToast({ type: 'success', title: 'เบิกสินค้าสำเร็จ', message: `เบิก ${action.item?.name || 'สินค้า'} จำนวน ${action.record?.qty || 0}` });
    } else if (action.action === 'stock_in') {
      addToast({ type: 'success', title: 'รับเข้าสินค้าสำเร็จ', message: `รับเข้า ${action.item?.name || 'สินค้า'} จำนวน ${action.record?.qty || 0}` });
    } else if (action.action === 'update_stock') {
      addToast({ type: 'success', title: 'อัปเดตสต็อกสำเร็จ', message: `อัปเดต ${action.item?.name || 'สินค้า'} เรียบร้อย` });
    }

    if (action.action === 'requisition' || action.action === 'stock_in') {
      if (action.record) {
        const cleanRecord = cleanForFirestore(action.record);
        setRequisitions((prev) => {
          const updated = [cleanRecord, ...prev];
          try {
            localStorage.setItem('warehouse_requisitions', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });
        setDoc(doc(db, 'requisitions', cleanRecord.id), cleanRecord).catch(err => console.error("Failed to save requisition", err));
      }
      if (action.item) {
        const oldItem = items.find(i => i.id === action.item?.id);
        const cleanItem = cleanForFirestore({
          ...action.item,
          ...(action.item.status === 'out' 
            ? { outOfStockDate: oldItem?.outOfStockDate || new Date().toISOString() } 
            : {})
        });

        // Instant optimistic update (0ms)
        setItems((prev) => {
          const updated = prev.map((i) => (i.id === cleanItem.id ? cleanItem : i));
          recalculateSummary(updated);
          try {
            localStorage.setItem('warehouse_inventory', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });

        if (selectedItem?.id === cleanItem.id) {
          setSelectedItem(cleanItem);
        }

        setDoc(doc(db, 'inventory', cleanItem.id), cleanItem).catch(err => console.error("Failed to update inventory", err));
      }
    } else if (action.action === 'update_stock') {
      if (action.item) {
        const oldItem = items.find(i => i.id === action.item?.id);
        const cleanItem = cleanForFirestore({
          ...action.item,
          ...(action.item.status === 'out' 
            ? { outOfStockDate: oldItem?.outOfStockDate || new Date().toISOString() } 
            : {})
        });

        // Instant optimistic update (0ms)
        setItems((prev) => {
          const updated = prev.map((i) => (i.id === cleanItem.id ? cleanItem : i));
          recalculateSummary(updated);
          try {
            localStorage.setItem('warehouse_inventory', JSON.stringify(updated));
          } catch (_) {}
          return updated;
        });

        if (selectedItem?.id === cleanItem.id) {
          setSelectedItem(cleanItem);
        }

        setDoc(doc(db, 'inventory', cleanItem.id), cleanItem).catch(err => console.error("Failed to update inventory", err));
      }
    } else if (action.action === 'delete_record' && action.recordId) {
      setRequisitions((prev) => {
        const updated = prev.filter((r) => r.id !== action.recordId);
        try {
          localStorage.setItem('warehouse_requisitions', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
      deleteDoc(doc(db, 'requisitions', action.recordId)).catch(err => console.error("Failed to delete requisition", err));
    }

    // Popup Warning for low stock after requisition
    if (action.action === 'requisition' && action.item) {
      const it = action.item;
      if (it.qty <= 0) {
        addToast({ 
          type: 'error', 
          title: '⚠️ สินค้าหมดสต็อก!', 
          message: `${it.name} หมดสต็อกแล้ว (คงเหลือ 0 ${it.unit})`,
          actionText: 'ดูสินค้า',
          onClick: () => {
            setSelectedItem(it);
            setActiveTab('inventory');
          }
        });
      } else if (it.qty <= it.minStock) {
        addToast({ 
          type: 'warning', 
          title: '⚠️ สินค้าใกล้หมด', 
          message: `${it.name} เหลือเพียง ${it.qty} ${it.unit}`,
          actionText: 'ดูสินค้า',
          onClick: () => {
            setSelectedItem(it);
            setActiveTab('inventory');
          }
        });
      }
    }
  };

  // Filter Items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'low' && item.status === 'low') ||
      (statusFilter === 'out' && item.status === 'out') ||
      (statusFilter === 'low_or_out' && (item.status === 'low' || item.status === 'out' || Number(item.qty) <= Number(item.minStock)));

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Unique categories list
  const categoryList = summary?.categories.map((c) => c.name) || [
    'เคมี', 'ท่อ', 'ไฟฟ้า', 'Lighting', 'แอร์', 'สุขภัณฑ์', 'สี+Grouting', 'Fire Alarm', 'ประตู', 'เน็ต+โทรศัพท์'
  ];

  const [isExportingInventoryPdf, setIsExportingInventoryPdf] = useState(false);

  const handleExportInventoryPdf = async () => {
    try {
      setIsExportingInventoryPdf(true);
      await generateAndDownloadPdf({
        type: 'inventory_all',
        title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)',
        items: filteredItems.length > 0 ? filteredItems : items,
        requisitions,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
    } finally {
      setIsExportingInventoryPdf(false);
    }
  };

  // Ask AI about specific item or query
  const handleAskAIAboutItem = (item: InventoryItem) => {
    const prompt = `ขอทราบข้อมูลและสถานะของสินค้า ${item.name} (รหัส: ${item.id}) ที่เก็บ: ${item.location} หน่อย`;
    setPendingQuery(prompt);
    setActiveTab('voice');
  };

  const handleAskAIQuery = (prompt: string) => {
    setPendingQuery(prompt);
    setActiveTab('voice');
  };

  // Handle logout with device session cleanup
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (currentUser?.id) {
        await updateDoc(doc(db, 'users', currentUser.id), {
          sessionToken: '',
          activeDeviceId: ''
        });
      }
    } catch (err) {
      console.warn('Logout session clear error:', err);
    } finally {
      localStorage.removeItem('warehouse_user');
      setCurrentUser(null);
      setShowLogoutConfirm(false);
      setIsLoggingOut(false);
    }
  };

  if (!currentUser) {
    return <LoginView onLogin={setCurrentUser} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 flex justify-center selection:bg-blue-500 selection:text-white">
      {/* Mobile-First Shell */}
      <div 
        className={`w-full max-w-2xl bg-[#F8FAFC] dark:bg-slate-950 flex flex-col shadow-2xl relative font-sans border-x border-slate-200 dark:border-slate-800 transition-colors duration-200 ${
          activeTab === 'voice' 
            ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' 
            : 'min-h-screen min-h-[100dvh]'
        }`}
      >
        
        {/* TAB 1: Inventory List */}
        {activeTab === 'inventory' && (
          <div className="flex-1 flex flex-col pb-28 sm:pb-24">
            {/* Sticky Mobile Topbar */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 sticky top-0 z-30 px-4 pt-safe-header pb-2.5 shadow-xs transition-colors duration-200">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                {/* Brand Logo & User Info Badge (Left) */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* 3D Official App Logo */}
                  <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700 bg-slate-950 flex items-center justify-center p-0.5">
                    <EngLogo alt="ENG Smart Store Logo" className="w-full h-full object-contain" />
                  </div>

                  {/* User Info Badge */}
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 px-2 py-1 rounded-xl shadow-2xs min-w-0">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0 shadow-xs">
                      <UserIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[110px] sm:max-w-[150px]" title={currentUser.name}>
                        {currentUser.name}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                        {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons (Right) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Dark Mode Toggle */}
                  <ThemeToggle />

                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 active:scale-95 transition-all flex items-center border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer shadow-2xs"
                    title="ออกจากระบบ"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => fetchInventory(true)}
                    disabled={refreshing}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 active:scale-95 transition-all text-lg flex items-center gap-1 border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer shadow-2xs"
                    title="ซิงค์ข้อมูลล่าสุด"
                  >
                    <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
                  </button>

                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => {
                        setItemToEdit({
                          id: `A${Date.now().toString().slice(-9)}`,
                          name: '',
                          category: categoryList[0] || 'เคมี',
                          unit: 'ชิ้น',
                          qty: 0,
                          minStock: 5,
                          location: 'Store FL.6',
                          note: '',
                          ordered: '',
                          orderedDate: '',
                          status: 'out',
                        });
                        setIsEditItemModalOpen(true);
                      }}
                      className="p-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      title="เพิ่มสินค้าใหม่ (Admin)"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">เพิ่มสินค้า</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setItemForRequisition(null);
                      setIsRequisitionModalOpen(true);
                    }}
                    className="p-2 px-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>เบิกของ</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative mb-2">
                <Search className="w-6 h-6 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อสินค้า, รหัส, หมวดหมู่, ตำแหน่ง..."
                  className="w-full bg-slate-100/90 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-lg">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1 rounded-full font-medium shrink-0 transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  ทั้งหมด ({items.length})
                </button>
                <button
                  onClick={() => setStatusFilter('low')}
                  className={`px-3 py-1 rounded-full font-medium shrink-0 flex items-center gap-1 transition-colors ${
                    statusFilter === 'low'
                      ? 'bg-amber-500 text-white font-semibold'
                      : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6" />
                  ใกล้หมด ({summary?.lowStockCount || 0})
                </button>
                <button
                  onClick={() => setStatusFilter('out')}
                  className={`px-3 py-1 rounded-full font-medium shrink-0 flex items-center gap-1 transition-colors ${
                    statusFilter === 'out'
                      ? 'bg-red-600 text-white font-semibold'
                      : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-800/80 hover:bg-red-100 dark:hover:bg-red-900/50'
                  }`}
                >
                  <XCircle className="w-6 h-6" />
                  หมดสต็อก ({summary?.outOfStockCount || 0})
                </button>
              </div>

              {/* Category Horizontal Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5 text-sm">
                <button
                  onClick={() => setSelectedCategory('ทั้งหมด')}
                  className={`px-2.5 py-0.5 rounded-lg shrink-0 transition-colors ${
                    selectedCategory === 'ทั้งหมด'
                      ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-700'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  ทุกหมวด
                </button>
                {categoryList.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-0.5 rounded-lg shrink-0 transition-colors ${
                      selectedCategory === cat
                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-700'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </header>

            {/* Inventory List Body */}
            <main className="p-3 space-y-2.5 flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
                  <RefreshCw className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
                  <p className="text-lg font-medium text-slate-600 dark:text-slate-300">กำลังโหลดข้อมูลจาก Store Data...</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 p-4 rounded-xl text-lg space-y-2">
                  <p className="font-bold">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                  <p>{error}</p>
                  <button
                    onClick={() => fetchInventory(true)}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold text-lg hover:bg-red-700 transition-colors cursor-pointer"
                  >
                    ลองใหม่อีกครั้ง
                  </button>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                  <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-lg font-semibold text-slate-600 dark:text-slate-300">ไม่พบรายการสินค้าที่ค้นหา</p>
                  <p className="text-lg text-slate-400 dark:text-slate-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองหมวดหมู่</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ทั้งหมด');
                      setStatusFilter('all');
                    }}
                    className="mt-3 text-lg text-blue-600 dark:text-blue-400 font-semibold underline cursor-pointer"
                  >
                    ล้างการค้นหาทั้งหมด
                  </button>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ))
              )}
            </main>
          </div>
        )}

        {/* TAB 2: Requisition History (หน้าประวัติการเบิกของ) */}
        {activeTab === 'history' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <RequisitionView
              records={requisitions}
              items={items}
              isAdmin={currentUser?.role === 'admin'}
              onOpenNewRequisition={() => {
                setItemForRequisition(null);
                setIsRequisitionModalOpen(true);
              }}
              onDeleteRecord={handleDeleteRequisition}
              onEditRecord={(record) => {
                setRequisitionToEdit(record);
                setIsEditRequisitionModalOpen(true);
              }}
            />
          </div>
        )}

        {/* Floating indicator when Live speech is active in background */}
        {isLiveActive && activeTab !== 'voice' && (
          <div 
            onClick={() => setActiveTab('voice')}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-purple-600/95 hover:bg-purple-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer backdrop-blur-xs transition-all ring-2 ring-purple-300 dark:ring-purple-900 animate-pulse"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            <span>🎙️ กำลังคุยสดกับ AI (แตะเพื่อกลับไปหน้าถาม AI / ปิด)</span>
          </div>
        )}

        {/* TAB 3: AI Assistant View (Kept mounted to maintain Live audio stream across tabs) */}
        <div className={activeTab === 'voice' ? "flex-1 flex flex-col min-h-0 h-full overflow-hidden" : "hidden"}>
          <VoiceAssistantView
            items={items}
            requisitions={requisitions}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            onSelectItem={(item) => setSelectedItem(item)}
            onExecuteDbAction={handleExecuteDbAction}
            onOpenHistory={() => setActiveTab('history')}
            pendingQuery={pendingQuery}
            clearPendingQuery={() => setPendingQuery('')}
            currentUser={currentUser!}
            onLiveStateChange={setIsLiveActive}
          />
        </div>

        {/* TAB 4: Dashboard Stats */}
        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto pb-28 sm:pb-24">
            <StatsDashboard
              summary={summary}
              items={items}
              requisitions={requisitions}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                setActiveTab('inventory');
              }}
              onFilterLowStock={() => {
                setStatusFilter('low_or_out');
                setActiveTab('inventory');
              }}
              onSelectItem={(item) => setSelectedItem(item)}
              onAskAI={(prompt) => handleAskAIQuery(prompt)}
              onRefresh={() => fetchInventory(true)}
              loading={refreshing}
            />
          </div>
        )}

        {/* TAB 5: Categories View */}
        {activeTab === 'categories' && (
          <div className="flex-1 overflow-y-auto pb-28 sm:pb-24">
            <CategoryView
              summary={summary}
              items={items}
              onSelectCategory={(cat) => {
                setSelectedCategory(cat);
                setActiveTab('inventory');
              }}
              onExportPdf={handleExportInventoryPdf}
              isExporting={isExportingInventoryPdf}
            />
          </div>
        )}

        {/* TAB 6: Users Management */}
        {activeTab === 'users' && currentUser?.role === 'admin' && (
          <div className="flex-1 overflow-y-auto pb-28 sm:pb-24">
            <UserManagementView 
              currentUser={currentUser} 
              onUpdateCurrentUser={handleUpdateCurrentUser}
            />
          </div>
        )}

        {/* Item Detail Modal */}
        <ItemDetailModal
          item={selectedItem}
          isAdmin={currentUser?.role === 'admin'}
          onClose={() => setSelectedItem(null)}
          onAskAI={handleAskAIAboutItem}
          onStartRequisition={(item) => {
            setItemForRequisition(item);
            setIsRequisitionModalOpen(true);
          }}
          onEditItem={(item) => {
            setItemToEdit(item);
            setIsEditItemModalOpen(true);
          }}
        />

        {/* Requisition Modal (บันทึกการเบิกของ) */}
        <RequisitionModal
          isOpen={isRequisitionModalOpen}
          preselectedItem={itemForRequisition}
          items={items}
          currentUser={currentUser}
          onClose={() => {
            setIsRequisitionModalOpen(false);
            setItemForRequisition(null);
          }}
          onSubmit={handleAddRequisition}
        />

        {/* Edit Item Modal (สำหรับ Admin แก้ไขข้อมูลสินค้า) */}
        <EditItemModal
          isOpen={isEditItemModalOpen}
          item={itemToEdit}
          categories={categoryList}
          onClose={() => {
            setIsEditItemModalOpen(false);
            setItemToEdit(null);
          }}
          onSave={handleSaveEditedItem}
          onDelete={handleDeleteItem}
        />

        {/* Edit Requisition Modal (สำหรับ Admin แก้ไขประวัติการเบิก/รับเข้า) */}
        <EditRequisitionModal
          isOpen={isEditRequisitionModalOpen}
          record={requisitionToEdit}
          items={items}
          onClose={() => {
            setIsEditRequisitionModalOpen(false);
            setRequisitionToEdit(null);
          }}
          onSave={handleSaveEditedRequisition}
          onDelete={handleDeleteRequisition}
        />

        {dbErrorAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
               <div className="bg-red-600 p-4 text-white flex items-center gap-3">
                 <XCircle className="w-6 h-6" />
                 <h2 className="font-bold text-lg">รายการไม่สำเร็จ</h2>
               </div>
               <div className="p-5">
                 <p className="text-lg text-slate-600 dark:text-slate-300 mb-4 font-medium">
                   {dbErrorAlert}
                 </p>
                 <div className="flex justify-end mt-4">
                   <button 
                     onClick={() => setDbErrorAlert(null)}
                     className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                   >
                     ปิดหน้าต่าง
                   </button>
                 </div>
               </div>
             </div>
          </div>
        )}

        {showLowStockAlert && summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
               <div className="bg-amber-500 p-4 text-white flex items-center gap-3">
                 <AlertTriangle className="w-6 h-6" />
                 <h2 className="font-bold text-lg">แจ้งเตือนสินค้าสต็อกต่ำ!</h2>
               </div>
               <div className="p-5">
                 <p className="text-lg text-slate-600 dark:text-slate-300 mb-4">
                   พบว่ามีสินค้า <b className="text-amber-600 dark:text-amber-400">{summary.lowStockCount || 0}</b> รายการใกล้หมด และ <b className="text-red-600 dark:text-red-400">{summary.outOfStockCount || 0}</b> รายการหมดสต็อกแล้ว<br/><br/>
                   <span className="text-red-600 dark:text-red-400 font-semibold">กรุณาตรวจสอบและดำเนินการเขียนใบสั่งซื้อ (PR) เพื่อเติมสต็อกโดยด่วน</span>
                 </p>
                 <div className="flex justify-end gap-2 mt-4">
                   <button 
                     onClick={() => setShowLowStockAlert(false)}
                     className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                   >
                     ปิดหน้าต่าง
                   </button>
                   <button 
                     onClick={() => {
                       setShowLowStockAlert(false);
                       setStatusFilter('low');
                       setActiveTab('inventory');
                     }}
                     className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold text-lg hover:bg-amber-600 transition-colors cursor-pointer"
                   >
                     ดูรายการสินค้า
                   </button>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Logout Confirmation Popup */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4 shadow-xs">
                  <LogOut className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">ยืนยันการออกจากระบบ</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                  คุณต้องการออกจากระบบบัญชี <span className="font-bold text-slate-900 dark:text-white">{currentUser.name}</span> ใช่หรือไม่?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={isLoggingOut}
                    onClick={handleConfirmLogout}
                    className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-red-600/20 active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isLoggingOut ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>กำลังออก...</span>
                      </>
                    ) : (
                      <span>ออกจากระบบ</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <MobileNavbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          lowStockCount={summary?.lowStockCount || 0}
          requisitionCount={requisitions.length}
          isAdmin={currentUser?.role === 'admin'}
          isLiveActive={isLiveActive}
        />

        {/* Toast Notifications Container */}
        {toasts.length > 0 && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-full max-w-sm px-4 pointer-events-none">
            <div className="pointer-events-auto space-y-2">
              {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} onClose={removeToast} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
