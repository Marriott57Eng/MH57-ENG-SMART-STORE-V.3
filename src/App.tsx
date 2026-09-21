import { db } from './firebase';
import { collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import React, { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
import { BulkRequisitionModal, BulkRequisitionSubmitData } from './components/BulkRequisitionModal';
import { EditItemModal } from './components/EditItemModal';
import { EditRequisitionModal } from './components/EditRequisitionModal';
import { LoginView } from './components/LoginView';
import { UserManagementView } from './components/UserManagementView';
import { ThemeToggle } from './components/ThemeToggle';
import { EngLogo } from './components/EngLogo';
import { TopNavTabs } from './components/TopNavTabs';
import { ModalPortal } from './components/ModalPortal';
import { GlobalProgressBar } from './components/GlobalProgressBar';
import { InventorySkeleton } from './components/InventorySkeleton';
import { 
  Package, Search, RefreshCw, Filter, ClipboardList, Plus,
  AlertTriangle, CheckCircle2, XCircle, Bot, X, FileDown, Loader2, LogOut, User as UserIcon, Bell,
  BarChart3, Layers, Users, CheckSquare, Zap, Check, ChevronDown
} from 'lucide-react';
import { generateAndDownloadPdf } from './utils/pdfGenerator';
import { useGeolocationAuth } from './hooks/useGeolocationAuth';
import { GeoRestrictionModal } from './components/GeoRestrictionModal';
import { TransactionSuccessModal, TransactionSuccessData } from './components/TransactionSuccessModal';
import { playSuccessSoundAndSpeak } from './utils/audioUtils';
import { notifyStockTransaction, notifyBulkStockTransaction, notifyAuthEvent } from './utils/lineNotify';
import { triggerLowStockPush, triggerImportantRequisitionPush } from './utils/webPush';
import { LineSettingsModal } from './components/LineSettingsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { User } from './types';
import { useDeviceDetector } from './hooks/useDeviceDetector';
import { useScrollLock } from './hooks/useScrollLock';

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

const getInitialUser = (): User | null => {
  try {
    const saved = localStorage.getItem('warehouse_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.id) return parsed;
    }
  } catch (_) {}
  return null;
};

export default function App() {
  const deviceInfo = useDeviceDetector();
  const [currentUser, setCurrentUser] = useState<User | null>(getInitialUser);
  const {
    verifyLocation,
    isCheckingGeo,
    checkInitialLocation,
    geoModalState,
    closeGeoModal,
    recheckLocation,
  } = useGeolocationAuth(currentUser);
  
  // Check location on initial login/load
  useEffect(() => {
    if (currentUser) {
      checkInitialLocation();
    }
  }, [currentUser, checkInitialLocation]);
  
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
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ทั้งหมด');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'low_or_out'>('all');

  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isBulkRequisitionModalOpen, setIsBulkRequisitionModalOpen] = useState(false);

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
  const [isLineSettingsModalOpen, setIsLineSettingsModalOpen] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState<TransactionSuccessData | null>(null);
  
  const [isRequisitionMenuOpen, setIsRequisitionMenuOpen] = useState(false);
  const requisitionMenuRef = useRef<HTMLDivElement>(null);

  // Close requisition menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (requisitionMenuRef.current && !requisitionMenuRef.current.contains(event.target as Node)) {
        setIsRequisitionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenRequisitionModal = async (item?: InventoryItem | null) => {
    const isAllowed = await verifyLocation();
    if (isAllowed) {
      setItemForRequisition(item || null);
      setIsRequisitionModalOpen(true);
    }
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useScrollLock(Boolean(dbErrorAlert || showLowStockAlert || showLogoutConfirm || isBulkRequisitionModalOpen));

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
            addToast({
              type: 'error',
              title: 'แจ้งเตือนระบบ',
              message: 'บัญชีนี้ถูกเข้าสู่ระบบจากเครื่องอื่น หรือผู้ดูแลระบบได้ปลดล็อกบัญชีของคุณ',
            });
            localStorage.removeItem('warehouse_user');
            setChatHistory([]);
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

        // Show Transaction Success Pop Up Modal
        setTransactionSuccess({
          type: recordData.type,
          itemId: updatedItem.id,
          itemName: updatedItem.name,
          category: updatedItem.category,
          qty: recordData.qty,
          unit: updatedItem.unit,
          requestedBy: recordData.requestedBy,
          purpose: recordData.purpose,
          timestamp: newRecord.timestamp,
          previousQty: currentItem.qty,
          newQty: newQty,
        });

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

        // 4. Send Real-time LINE Notification (Non-blocking background trigger)
        notifyStockTransaction({
          type: recordData.type,
          itemId: updatedItem.id,
          itemName: updatedItem.name,
          category: updatedItem.category,
          qty: recordData.qty,
          unit: updatedItem.unit,
          location: updatedItem.location,
          requestedBy: recordData.requestedBy,
          purpose: recordData.purpose,
          note: recordData.note,
          previousQty: currentItem.qty,
          newQty: newQty,
          status: newStatus,
          timestamp: newRecord.timestamp,
        }).catch(err => console.warn("LINE stock notification notice:", err));

        // 5. Send Web Push Notifications (Low stock alert or Important Requisition alert)
        if (newQty <= (updatedItem.minStock || 5) || newStatus === 'low' || newStatus === 'out') {
          triggerLowStockPush(updatedItem, newQty).catch(err => console.warn("Web Push low stock warning:", err));
        }
        if (recordData.type === 'out') {
          const isImportant = recordData.qty >= 5 || (recordData.purpose && (
            recordData.purpose.includes('ด่วน') || 
            recordData.purpose.includes('สำคัญ') || 
            recordData.purpose.includes('ฉุกเฉิน') || 
            recordData.purpose.includes('เครื่อง') || 
            recordData.purpose.includes('ระบบ')
          ));
          triggerImportantRequisitionPush({
            itemId: updatedItem.id,
            itemName: updatedItem.name,
            qty: recordData.qty,
            unit: updatedItem.unit,
            requestedBy: recordData.requestedBy,
            purpose: recordData.purpose,
            newQty,
            isImportant: Boolean(isImportant),
          }).catch(err => console.warn("Web Push requisition warning:", err));
        }
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

    if ((action.action === 'update_stock' || (action.action as any) === 'edit_item') && currentUser?.role !== 'admin') {
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
      const isStockIn = action.action === 'stock_in';
      const itemName = action.item?.name || 'สินค้า';
      const qty = action.record?.qty || 0;
      const unit = action.item?.unit || 'ชิ้น';

      // Play chime and speak if not suppressed (e.g. when handled by Live Speech)
      if (!action.skipVoice) {
        playSuccessSoundAndSpeak(
          isStockIn
            ? `บันทึกรับเข้า ${itemName} จำนวน ${qty} ${unit} เรียบร้อยแล้วค่ะ`
            : `บันทึกการเบิก ${itemName} จำนวน ${qty} ${unit} เรียบร้อยแล้วค่ะ`
        );
      }

      if (action.item && action.record) {
        setTransactionSuccess({
          type: isStockIn ? 'in' : 'out',
          itemId: action.item.id,
          itemName: action.item.name,
          category: action.item.category,
          qty: action.record.qty,
          unit: action.item.unit,
          requestedBy: action.record.requestedBy,
          purpose: action.record.purpose,
          timestamp: action.record.timestamp,
          newQty: action.item.qty,
        });
      }

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

        // Send LINE notification for AI-assisted stock actions
        if (action.record) {
          notifyStockTransaction({
            type: isStockIn ? 'in' : 'out',
            itemId: cleanItem.id,
            itemName: cleanItem.name,
            category: cleanItem.category,
            qty: action.record.qty,
            unit: cleanItem.unit,
            location: cleanItem.location,
            requestedBy: action.record.requestedBy,
            purpose: action.record.purpose,
            previousQty: oldItem?.qty,
            newQty: cleanItem.qty,
            status: cleanItem.status,
            timestamp: action.record.timestamp,
          }).catch(err => console.warn("LINE notification error from AI action:", err));

          // Web Push notification for AI-assisted stock actions
          if (action.record.type === 'out') {
            triggerImportantRequisitionPush({
              itemId: cleanItem.id,
              itemName: cleanItem.name,
              qty: action.record.qty,
              unit: cleanItem.unit,
              requestedBy: action.record.requestedBy,
              purpose: action.record.purpose,
              newQty: cleanItem.qty,
            }).catch(err => console.warn("Web Push AI requisition notice:", err));
          }
          if (cleanItem.qty <= (cleanItem.minStock || 5) || cleanItem.status === 'low' || cleanItem.status === 'out') {
            triggerLowStockPush(cleanItem, cleanItem.qty).catch(err => console.warn("Web Push AI low stock notice:", err));
          }
        }
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

        // Trigger low stock push if direct update makes item low or out
        if (cleanItem.qty <= (cleanItem.minStock || 5) || cleanItem.status === 'low' || cleanItem.status === 'out') {
          triggerLowStockPush(cleanItem, cleanItem.qty).catch(err => console.warn("Web Push stock update notice:", err));
        }

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

  // Filter Items with deferredSearchQuery for silky smooth typing
  const filteredItems = useMemo(() => {
    const queryStr = deferredSearchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        queryStr === '' ||
        item.name.toLowerCase().includes(queryStr) ||
        item.id.toLowerCase().includes(queryStr) ||
        item.category.toLowerCase().includes(queryStr) ||
        item.location.toLowerCase().includes(queryStr);

      const matchesCategory =
        selectedCategory === 'ทั้งหมด' || item.category === selectedCategory;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'low' && item.status === 'low') ||
        (statusFilter === 'out' && item.status === 'out') ||
        (statusFilter === 'low_or_out' && (item.status === 'low' || item.status === 'out' || Number(item.qty) <= Number(item.minStock)));

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, deferredSearchQuery, selectedCategory, statusFilter]);

  // Memoized handlers for ItemCard to avoid unnecessary re-renders
  const handleCardClick = useCallback((item: InventoryItem) => {
    setSelectedItem(item);
  }, []);

  const handleToggleSelectItem = useCallback((item: InventoryItem) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  }, [filteredItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  const handleToggleMultiSelectMode = useCallback(() => {
    setIsMultiSelectMode((prev) => {
      if (prev) {
        setSelectedItemIds(new Set());
      }
      return !prev;
    });
  }, []);

  const handleStartMultiSelect = useCallback(async (preselectedItem?: InventoryItem | null) => {
    const isAllowed = await verifyLocation();
    if (!isAllowed) return;

    setIsRequisitionMenuOpen(false);
    setIsRequisitionModalOpen(false);
    setActiveTab('inventory');
    setIsMultiSelectMode(true);
    if (preselectedItem) {
      setSelectedItemIds(new Set([preselectedItem.id]));
    }
    addToast({
      type: 'info',
      title: 'เข้าสู่โหมดเลือกหลายชิ้น',
      message: 'ติ๊กเลือกรายการสินค้าที่ต้องการเบิก แล้วกดปุ่ม "เบิกพร้อมกัน"',
    });
  }, [verifyLocation, addToast]);

  const selectedItemsForBulk = useMemo(() => {
    return items.filter((item) => selectedItemIds.has(item.id));
  }, [items, selectedItemIds]);

  const handleOpenBulkModal = async () => {
    if (selectedItemIds.size === 0) {
      addToast({
        type: 'warning',
        title: 'ยังไม่ได้เลือกรายการ',
        message: 'กรุณาเลือกรายการสินค้าอย่างน้อย 1 รายการเพื่อทำการเบิก',
      });
      return;
    }
    const isAllowed = await verifyLocation();
    if (isAllowed) {
      setIsBulkRequisitionModalOpen(true);
    }
  };

  const handleBulkRequisitionSubmit = async (data: BulkRequisitionSubmitData) => {
    const isAllowed = await verifyLocation();
    if (!isAllowed) return;

    const now = new Date();
    const timestampStr = `${now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    const isoDateStr = data.dateStr && data.timeStr 
      ? new Date(`${data.dateStr}T${data.timeStr}:00`).toISOString() 
      : now.toISOString();

    const newRecords: RequisitionRecord[] = [];
    const updatedItemsMap = new Map<string, InventoryItem>();
    const bulkItemsForSuccess: Array<{
      id: string;
      name: string;
      category?: string;
      qty: number;
      unit: string;
      newQty?: number;
    }> = [];

    data.items.forEach(({ item, qty }, idx) => {
      const recId = `${Date.now().toString().slice(-6)}${idx}`;
      const newRecord: RequisitionRecord = cleanForFirestore({
        id: recId,
        type: 'out',
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        qty,
        unit: item.unit,
        requestedBy: data.requestedBy,
        purpose: data.purpose,
        timestamp: timestampStr,
        isoDate: isoDateStr,
        note: data.note,
      });
      newRecords.push(newRecord);

      const currentQty = Number(item.qty);
      const newQty = Math.max(0, currentQty - Number(qty));
      let newStatus: 'normal' | 'low' | 'out' = 'normal';
      if (newQty <= 0) newStatus = 'out';
      else if (newQty <= (item.minStock || 0)) newStatus = 'low';

      const updatedItem: InventoryItem = cleanForFirestore({
        ...item,
        qty: newQty,
        status: newStatus,
        ...(newStatus === 'out' ? { outOfStockDate: item.outOfStockDate || now.toISOString() } : {})
      });
      updatedItemsMap.set(item.id, updatedItem);

      bulkItemsForSuccess.push({
        id: item.id,
        name: item.name,
        category: item.category,
        qty,
        unit: item.unit,
        newQty,
      });
    });

    // Instant local state update (0ms UI feedback)
    setRequisitions((prev) => {
      const updated = [...newRecords, ...prev];
      try {
        localStorage.setItem('warehouse_requisitions', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    setItems((prevItems) => {
      const nextItems = prevItems.map((item) => updatedItemsMap.get(item.id) || item);
      recalculateSummary(nextItems);
      try {
        localStorage.setItem('warehouse_inventory', JSON.stringify(nextItems));
      } catch (_) {}
      return nextItems;
    });

    // Reset selection & close modal
    setSelectedItemIds(new Set());
    setIsMultiSelectMode(false);
    setIsBulkRequisitionModalOpen(false);

    // Show success modal with audio/voice
    setTransactionSuccess({
      type: 'out',
      requestedBy: data.requestedBy,
      purpose: data.purpose,
      timestamp: timestampStr,
      isBulk: true,
      bulkItems: bulkItemsForSuccess,
    });

    addToast({
      type: 'success',
      title: 'เบิกสินค้าพร้อมกันสำเร็จ',
      message: `เบิกสำเร็จ ${bulkItemsForSuccess.length} รายการ (${bulkItemsForSuccess.reduce((sum, i) => sum + i.qty, 0)} ชิ้น)`,
    });

    // Persist to Firestore asynchronously
    const firestorePromises: Promise<any>[] = [];
    try {
      const batch = writeBatch(db);
      newRecords.forEach((rec) => {
        batch.set(doc(db, 'requisitions', rec.id), rec);
      });
      updatedItemsMap.forEach((uItem) => {
        batch.set(doc(db, 'inventory', uItem.id), uItem);
      });
      firestorePromises.push(batch.commit());
    } catch (err) {
      console.warn("Batch write fallback:", err);
      newRecords.forEach((rec) => firestorePromises.push(setDoc(doc(db, 'requisitions', rec.id), rec)));
      updatedItemsMap.forEach((uItem) => firestorePromises.push(setDoc(doc(db, 'inventory', uItem.id), uItem)));
    }
    Promise.all(firestorePromises).catch((err) => console.error("Firestore sync error:", err));

    // Send LINE Notification asynchronously
    notifyBulkStockTransaction({
      items: bulkItemsForSuccess.map(i => ({
        itemId: i.id,
        itemName: i.name,
        qty: i.qty,
        unit: i.unit,
        newQty: i.newQty,
      })),
      requestedBy: data.requestedBy,
      purpose: data.purpose,
      note: data.note,
      timestamp: timestampStr,
    }).catch((err) => console.warn("LINE bulk notification notice:", err));

    // Web Push alerts for low stock items
    updatedItemsMap.forEach((uItem) => {
      if (uItem.status === 'low' || uItem.status === 'out') {
        triggerLowStockPush(uItem, uItem.qty).catch((err) => console.warn("Web push alert:", err));
      }
    });
  };

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
    const loggedOutUser = currentUser;
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
      if (loggedOutUser) {
        notifyAuthEvent({
          type: 'logout',
          userId: loggedOutUser.id,
          username: loggedOutUser.username,
          name: loggedOutUser.name,
          nickname: loggedOutUser.nickname,
          role: loggedOutUser.role,
        }).catch(err => console.warn("LINE logout notification notice:", err));
      }

      localStorage.removeItem('warehouse_user');
      setChatHistory([]);
      setCurrentUser(null);
      setShowLogoutConfirm(false);
      setIsLoggingOut(false);
    }
  };

  if (!currentUser) {
    const handleLogin = (user: User) => {
      setChatHistory([]);
      setCurrentUser(user);
      // Send real-time LINE login notification
      notifyAuthEvent({
        type: 'login',
        userId: user.id,
        username: user.username,
        name: user.name,
        nickname: user.nickname,
        role: user.role,
      }).catch(err => console.warn("LINE login notification notice:", err));
    };
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-slate-900 flex justify-center pl-safe pr-safe selection:bg-blue-500 selection:text-white relative overflow-x-hidden">
      {/* iOS 27 Ambient Light Glows for Liquid Glass depth */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-[130px] pointer-events-none -z-0" />
      <div className="fixed top-1/3 right-1/4 w-[450px] h-[450px] bg-indigo-500/10 dark:bg-indigo-600/12 rounded-full blur-[140px] pointer-events-none -z-0" />
      <div className="fixed bottom-10 left-1/3 w-[400px] h-[400px] bg-teal-500/8 dark:bg-teal-600/10 rounded-full blur-[120px] pointer-events-none -z-0" />

      {/* Global sleek loading progress bar */}
      <GlobalProgressBar isLoading={refreshing || loading} triggerKey={activeTab} />

      {/* Auto-scaling Responsive Shell: Phone, Tablet, PC */}
      <div 
        className={`w-full max-w-full lg:max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1600px] bg-[#F8FAFC] dark:bg-slate-950 flex flex-col shadow-2xl relative font-sans md:border-x border-white/40 dark:border-slate-800/80 ${
          activeTab === 'voice' 
            ? 'h-[100dvh] max-h-[100dvh] overflow-hidden' 
            : 'min-h-screen min-h-[100dvh]'
        }`}
      >
        
        {/* Universal Sticky Top Header with Auto-Adaptive Navigation */}
        <header className="liquid-glass sticky top-0 z-30 px-3 sm:px-5 md:px-6 pt-safe-header pb-2.5 shadow-[0_6px_28px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.5)] border-b border-white/60 dark:border-white/10 transition-colors duration-200">
          {/* Specular top rim shine */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {/* Brand Logo & User Info Badge (Left) */}
              <div className="flex items-center gap-2 min-w-0">
                {/* 3D Official App Logo */}
                <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-2xl overflow-hidden shadow-xs border border-white/60 dark:border-white/10 bg-slate-950 flex items-center justify-center p-0.5">
                  <EngLogo alt="ENG Smart Store Logo" className="w-full h-full object-contain" />
                </div>

                {/* User Info Badge */}
                <div className="flex items-center gap-1.5 liquid-glass-pill px-2.5 sm:px-3 py-1 rounded-2xl shadow-2xs min-w-0 border border-white/70 dark:border-white/10">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 dark:bg-blue-400/20 border border-blue-400/30 flex items-center justify-center shrink-0 shadow-xs">
                    <UserIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[90px] sm:max-w-[150px] md:max-w-none" title={currentUser.name}>
                      {currentUser.name}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate leading-tight">
                      {currentUser.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Automatic Mode Tabs: Shown at top on large screens (xl), hidden on mobile/tablet/preview */}
              <TopNavTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                requisitionCount={requisitions.length}
                lowStockCount={summary?.lowStockCount || 0}
                isAdmin={currentUser.role === 'admin'}
                isLiveActive={isLiveActive}
                className="hidden xl:flex"
              />

              {/* Header Action Buttons (Right) */}
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Dark Mode Toggle */}
                <ThemeToggle />

                {/* PWA In-App Install Prompt */}
                <PWAInstallButton />

                {/* Logout Button */}
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-2 sm:p-2.5 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all flex items-center liquid-glass-pill cursor-pointer shadow-2xs border border-white/60 dark:border-white/10"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>

                {/* Refresh / Sync Button */}
                <button
                  onClick={() => fetchInventory(true)}
                  disabled={refreshing}
                  className="p-2 sm:p-2.5 rounded-2xl text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1 liquid-glass-pill cursor-pointer shadow-2xs border border-white/60 dark:border-white/10"
                  title="ซิงค์ข้อมูลล่าสุด"
                >
                  <RefreshCw className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${refreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
                </button>

                {/* Notification Settings (Web Push for all, LINE Bot for Admin) */}
                <button
                  onClick={() => setIsLineSettingsModalOpen(true)}
                  className="p-2 sm:p-2.5 rounded-2xl text-blue-700 dark:text-blue-300 hover:bg-blue-500/15 active:scale-95 transition-all flex items-center border border-blue-400/30 bg-blue-500/10 dark:bg-blue-400/10 cursor-pointer shadow-2xs backdrop-blur-md"
                  title={currentUser.role === 'admin' ? "การแจ้งเตือน (Web Push & LINE)" : "การแจ้งเตือน Web Push"}
                >
                  <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-blue-600 dark:text-blue-400" />
                </button>

                {/* Add Item (Admin) */}
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
                    className="p-2 sm:p-2.5 px-2.5 sm:px-3 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 dark:from-slate-700 dark:to-slate-850 text-white active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center gap-1 border border-white/15 shadow-sm cursor-pointer relative overflow-hidden"
                    title="เพิ่มสินค้าใหม่ (Admin)"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">เพิ่มสินค้า</span>
                  </button>
                )}

                {/* Requisition Button with Dropdown (โหมดเบิกของ) */}
                <div className="relative flex items-center shadow-md shadow-blue-500/25 rounded-2xl" ref={requisitionMenuRef}>
                  <button
                    onClick={() => {
                      setIsRequisitionMenuOpen(false);
                      handleOpenRequisitionModal();
                    }}
                    className="p-2 sm:p-2.5 px-3 sm:px-3.5 rounded-l-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center gap-1.5 border-t border-b border-l border-blue-400/40 cursor-pointer relative overflow-hidden"
                    title="บันทึกการเบิกของ"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                    <ClipboardList className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">เบิกของ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRequisitionMenuOpen((prev) => !prev)}
                    className="p-2 sm:p-2.5 px-2 rounded-r-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white active:scale-95 transition-all border-t border-b border-r border-blue-400/40 border-l border-l-blue-400/30 cursor-pointer relative"
                    title="ตัวเลือกโหมดเบิกของ (เบิก 1 ชิ้น หรือ เลือกหลายชิ้น)"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isRequisitionMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Options for Requisition Mode */}
                  {isRequisitionMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/90 dark:border-slate-800 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRequisitionMenuOpen(false);
                          handleOpenRequisitionModal();
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">เบิกทั่วไป (1 รายการ)</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">เปิดหน้าต่างบันทึกการเบิก</div>
                        </div>
                      </button>

                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsRequisitionMenuOpen(false);
                          handleStartMultiSelect();
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-blue-600 dark:text-blue-400">เลือกหลายชิ้น (เบิกเป็นชุด)</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">ติ๊กเลือกหลายรายการเพื่อตัดยอดพร้อมกัน</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          {/* TAB 1: Inventory List */}
          {activeTab === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col pb-28 sm:pb-32"
            >
              {/* Search & Filter Bar */}
              <div className="liquid-glass border-b border-white/60 dark:border-white/10 sticky top-[53px] sm:top-[57px] z-20 px-3.5 sm:px-5 md:px-6 py-2.5 shadow-[0_6px_20px_rgba(15,23,42,0.03)] transition-all duration-200">
                <div className="max-w-7xl mx-auto w-full">
                  {/* Search Bar */}
                  <div className="relative mb-2.5">
                    <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 dark:text-slate-400 absolute left-3.5 top-2.5 sm:top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ค้นหาชื่อสินค้า, รหัส, หมวดหมู่, ตำแหน่ง..."
                      className="w-full liquid-glass-input rounded-2xl pl-10 pr-10 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-inner"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-2.5 sm:top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs sm:text-sm">
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-3 sm:px-3.5 py-1.5 rounded-full font-bold shrink-0 transition-all shadow-2xs cursor-pointer ${
                        statusFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-400/40'
                          : 'liquid-glass-pill text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    >
                      ทั้งหมด ({items.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter('low')}
                      className={`px-3 sm:px-3.5 py-1.5 rounded-full font-bold shrink-0 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                        statusFilter === 'low'
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 border border-amber-300/40'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/30 hover:bg-amber-500/25 backdrop-blur-md'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      ใกล้หมด ({summary?.lowStockCount || 0})
                    </button>
                    <button
                      onClick={() => setStatusFilter('out')}
                      className={`px-3 sm:px-3.5 py-1.5 rounded-full font-bold shrink-0 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
                        statusFilter === 'out'
                          ? 'bg-red-600 text-white shadow-md shadow-red-500/25 border border-red-400/40'
                          : 'bg-red-500/15 text-red-800 dark:text-red-300 border border-red-400/30 hover:bg-red-500/25 backdrop-blur-md'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                      หมดสต็อก ({summary?.outOfStockCount || 0})
                    </button>
                  </div>

                  {/* Category Horizontal Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5 text-xs sm:text-sm">
                    <button
                      onClick={() => setSelectedCategory('ทั้งหมด')}
                      className={`px-3 sm:px-3.5 py-1 rounded-full shrink-0 transition-all shadow-2xs cursor-pointer font-medium ${
                        selectedCategory === 'ทั้งหมด'
                          ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 border border-blue-400/40'
                          : 'liquid-glass-pill text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    >
                      ทุกหมวด
                    </button>
                    {categoryList.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 sm:px-3.5 py-1 rounded-full shrink-0 transition-all shadow-2xs cursor-pointer font-medium ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/25 border border-blue-400/40'
                            : 'liquid-glass-pill text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}

                    {/* Performance / Smooth Mode Indicator & Toggle */}
                    <button
                      type="button"
                      onClick={() => deviceInfo.setPerfMode(deviceInfo.isLowSpec ? 'high' : 'smooth')}
                      title={deviceInfo.isLowSpec ? 'เปิดโหมดลื่นไหลพิเศษอยู่ (ลดแอนิเมชันเพื่อความเร็วสูงสุด)' : 'เปิดโหมดกราฟิกเต็มรูปแบบ คลิกเพื่อสลับเป็นโหมดลื่นไหล'}
                      className={`px-3 py-1 rounded-full shrink-0 transition-all shadow-2xs cursor-pointer font-bold text-xs sm:text-sm flex items-center gap-1.5 ml-auto ${
                        deviceInfo.isLowSpec
                          ? 'bg-emerald-600 text-white border border-emerald-400/50 shadow-xs'
                          : 'liquid-glass-pill text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>{deviceInfo.isLowSpec ? '⚡ โหมดลื่นไหล 60fps' : 'โหมดปกติ'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Select Active Action Bar */}
              {isMultiSelectMode && (
                <div className="sticky top-[108px] sm:top-[112px] z-25 px-3.5 sm:px-5 md:px-6 py-2 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white shadow-lg border-b border-blue-400/30">
                  <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-black text-sm text-white">
                        {selectedItemIds.size}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black leading-tight">
                          เลือก {selectedItemIds.size} จาก {filteredItems.length} รายการ
                        </div>
                        <div className="text-[11px] text-blue-100 font-medium hidden sm:block">
                          กดที่กล่องติ๊กเพื่อเลือกหลายรายการ แล้วกดปุ่มเบิกพร้อมกัน
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        เลือกทั้งหมด ({filteredItems.length})
                      </button>

                      {selectedItemIds.size > 0 && (
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer"
                        >
                          ล้างที่เลือก
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleMultiSelectMode}
                        className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer"
                      >
                        ปิดโหมดเลือก
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenBulkModal}
                        disabled={selectedItemIds.size === 0}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-md ${
                          selectedItemIds.size > 0
                            ? 'bg-white text-blue-700 hover:bg-blue-50 active:scale-95 cursor-pointer shadow-blue-900/30'
                            : 'bg-white/30 text-white/60 cursor-not-allowed'
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>เบิกพร้อมกัน ({selectedItemIds.size})</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Inventory List Body */}
              <main className="p-3 sm:p-4.5 md:p-6 space-y-4 flex-1 max-w-7xl mx-auto w-full">
                {loading ? (
                  <InventorySkeleton count={6} />
                ) : error ? (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-300 p-4 rounded-xl text-sm sm:text-base space-y-2">
                    <p className="font-bold">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                    <p>{error}</p>
                    <button
                      onClick={() => fetchInventory(true)}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 transition-colors cursor-pointer"
                    >
                      ลองใหม่อีกครั้ง
                    </button>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-base font-semibold text-slate-600 dark:text-slate-300">ไม่พบรายการสินค้าที่ค้นหา</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองหมวดหมู่</p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('ทั้งหมด');
                        setStatusFilter('all');
                      }}
                      className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-semibold underline cursor-pointer"
                    >
                      ล้างการค้นหาทั้งหมด
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 inventory-grid">
                    {filteredItems.map((item, index) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        index={index}
                        onClick={handleCardClick}
                        isMultiSelectMode={isMultiSelectMode}
                        isSelected={selectedItemIds.has(item.id)}
                        onToggleSelect={handleToggleSelectItem}
                        isLowSpec={deviceInfo.isLowSpec}
                      />
                    ))}
                  </div>
                )}
              </main>
            </motion.div>
          )}

          {/* TAB 2: Requisition History (หน้าประวัติการเบิกของ) */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col pb-28 sm:pb-32"
            >
              <RequisitionView
                records={requisitions}
                items={items}
                isAdmin={currentUser?.role === 'admin'}
                onOpenNewRequisition={() => handleOpenRequisitionModal()}
                onStartMultiSelect={() => handleStartMultiSelect()}
                onDeleteRecord={handleDeleteRequisition}
                onEditRecord={(record) => {
                  setRequisitionToEdit(record);
                  setIsEditRequisitionModalOpen(true);
                }}
              />
            </motion.div>
          )}

          {/* TAB 4: Dashboard Stats */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col pb-28 sm:pb-32"
            >
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
            </motion.div>
          )}

          {/* TAB 5: Categories View */}
          {activeTab === 'categories' && (
            <motion.div
              key="categories"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col pb-28 sm:pb-32"
            >
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
            </motion.div>
          )}

          {/* TAB 6: Users Management */}
          {activeTab === 'users' && currentUser?.role === 'admin' && (
            <motion.div
              key="users"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col pb-28 sm:pb-32"
            >
              <UserManagementView 
                currentUser={currentUser} 
                onUpdateCurrentUser={handleUpdateCurrentUser}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating indicator when Live speech is active in background */}
        {isLiveActive && activeTab !== 'voice' && (
          <div 
            onClick={() => setActiveTab('voice')}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600/95 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg shadow-red-600/30 flex items-center gap-2 cursor-pointer backdrop-blur-xs transition-all ring-2 ring-red-300 dark:ring-red-900 animate-pulse"
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

        {/* Item Detail Modal */}
        <AnimatePresence>
          {selectedItem && (
            <ItemDetailModal
              key={`item-detail-${selectedItem.id}`}
              item={selectedItem}
              isAdmin={currentUser?.role === 'admin'}
              onClose={() => setSelectedItem(null)}
              onAskAI={handleAskAIAboutItem}
              onStartRequisition={(item) => handleOpenRequisitionModal(item)}
              onEditItem={(item) => {
                setItemToEdit(item);
                setIsEditItemModalOpen(true);
              }}
            />
          )}
        </AnimatePresence>

        {/* Requisition Modal (บันทึกการเบิกของ) */}
        <AnimatePresence>
          {isRequisitionModalOpen && (
            <RequisitionModal
              key="requisition-modal"
              isOpen={isRequisitionModalOpen}
              preselectedItem={itemForRequisition}
              items={items}
              currentUser={currentUser}
              onClose={() => {
                setIsRequisitionModalOpen(false);
                setItemForRequisition(null);
              }}
              onSubmit={handleAddRequisition}
              onStartMultiSelect={(item) => handleStartMultiSelect(item)}
            />
          )}
        </AnimatePresence>

        {/* Bulk Requisition Modal (เบิกสินค้าพร้อมกันหลายรายการ) */}
        <AnimatePresence>
          {isBulkRequisitionModalOpen && (
            <BulkRequisitionModal
              key="bulk-requisition-modal"
              isOpen={isBulkRequisitionModalOpen}
              selectedItems={selectedItemsForBulk}
              currentUser={currentUser}
              onClose={() => setIsBulkRequisitionModalOpen(false)}
              onRemoveItem={(itemId) => {
                setSelectedItemIds((prev) => {
                  const next = new Set(prev);
                  next.delete(itemId);
                  return next;
                });
              }}
              onSubmit={handleBulkRequisitionSubmit}
            />
          )}
        </AnimatePresence>

        {/* Edit Item Modal (สำหรับ Admin แก้ไขข้อมูลสินค้า) */}
        <AnimatePresence>
          {isEditItemModalOpen && itemToEdit && (
            <EditItemModal
              key={`edit-item-${itemToEdit.id}`}
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
          )}
        </AnimatePresence>

        {/* Edit Requisition Modal (สำหรับ Admin แก้ไขประวัติการเบิก/รับเข้า) */}
        <AnimatePresence>
          {isEditRequisitionModalOpen && requisitionToEdit && (
            <EditRequisitionModal
              key={`edit-req-${requisitionToEdit.id}`}
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
          )}
        </AnimatePresence>

        {/* Geo-location Restriction Modal */}
        <GeoRestrictionModal
          state={geoModalState}
          onClose={closeGeoModal}
          onRetry={recheckLocation}
          isChecking={isCheckingGeo}
        />

        {/* Transaction Success Modal with Voice Announcement */}
        <TransactionSuccessModal
          isOpen={!!transactionSuccess}
          data={transactionSuccess}
          onClose={() => setTransactionSuccess(null)}
        />

        {/* Error Alert Modal */}
        <AnimatePresence>
          {dbErrorAlert && (
            <ModalPortal>
              <div 
                className="fixed inset-0 z-[120] flex items-center justify-center p-4 overscroll-contain"
                onTouchMove={(e) => {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDbErrorAlert(null)}
                  style={{ willChange: 'opacity' }}
                  className="fixed inset-0 bg-slate-950/80 transform-gpu touch-none"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: 'transform, opacity' }}
                  className="relative z-10 bg-white dark:bg-slate-900 rounded-[30px] sm:rounded-[34px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 transform-gpu"
                >
                  <div className="bg-gradient-to-r from-red-600 to-rose-600 p-4.5 text-white flex items-center gap-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                    <h2 className="font-bold text-base sm:text-lg relative z-10">รายการไม่สำเร็จ</h2>
                  </div>
                  <div className="p-5 sm:p-6">
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-5 font-medium leading-relaxed">
                      {dbErrorAlert}
                    </p>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => setDbErrorAlert(null)}
                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        ปิดหน้าต่าง
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </ModalPortal>
          )}
        </AnimatePresence>

        {/* Low Stock Alert Modal */}
        <AnimatePresence>
          {showLowStockAlert && summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (
            <ModalPortal>
              <div 
                className="fixed inset-0 z-[120] flex items-center justify-center p-4 overscroll-contain"
                onTouchMove={(e) => {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowLowStockAlert(false)}
                  style={{ willChange: 'opacity' }}
                  className="fixed inset-0 bg-slate-950/80 transform-gpu touch-none"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: 'transform, opacity' }}
                  className="relative z-10 bg-white dark:bg-slate-900 rounded-[30px] sm:rounded-[34px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 transform-gpu"
                >
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4.5 text-white flex items-center gap-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 relative z-10" />
                    <h2 className="font-bold text-base sm:text-lg relative z-10">แจ้งเตือนสินค้าสต็อกต่ำ!</h2>
                  </div>
                  <div className="p-5 sm:p-6">
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                      พบว่ามีสินค้า <b className="text-amber-600 dark:text-amber-400 font-bold">{summary.lowStockCount || 0}</b> รายการใกล้หมด และ <b className="text-red-600 dark:text-red-400 font-bold">{summary.outOfStockCount || 0}</b> รายการหมดสต็อกแล้ว<br/><br/>
                      <span className="text-red-600 dark:text-red-400 font-semibold">กรุณาตรวจสอบและดำเนินการเขียนใบสั่งซื้อ (PR) เพื่อเติมสต็อกโดยด่วน</span>
                    </p>
                    <div className="flex justify-end gap-2.5">
                      <button 
                        onClick={() => setShowLowStockAlert(false)}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-xs sm:text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        ปิดหน้าต่าง
                      </button>
                      <button 
                        onClick={() => {
                          setShowLowStockAlert(false);
                          setStatusFilter('low');
                          setActiveTab('inventory');
                        }}
                        className="px-4.5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold text-xs sm:text-sm hover:from-amber-400 hover:to-orange-400 transition-all cursor-pointer shadow-md shadow-amber-500/25 border border-amber-300/40"
                      >
                        ดูรายการสินค้า
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            </ModalPortal>
          )}
        </AnimatePresence>

        {/* Logout Confirmation Popup */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <ModalPortal>
              <div 
                className="fixed inset-0 z-[120] flex items-center justify-center p-4 overscroll-contain"
                onTouchMove={(e) => {
                  if (e.target === e.currentTarget) {
                    e.preventDefault();
                  }
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ willChange: 'opacity' }}
                  className="fixed inset-0 bg-slate-950/80 transform-gpu touch-none"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  style={{ willChange: 'transform, opacity' }}
                  className="relative z-10 bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[36px] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 transform-gpu"
                >
                  <div className="p-6 sm:p-7 text-center">
                    <div className="w-16 h-16 rounded-[24px] bg-red-500/15 dark:bg-red-500/20 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4 shadow-inner border border-red-400/20">
                      <LogOut className="w-8 h-8" />
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
                        className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="button"
                        disabled={isLoggingOut}
                        onClick={handleConfirmLogout}
                        className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl font-bold text-sm transition-all shadow-md shadow-red-600/30 active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer border border-red-400/40"
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
                </motion.div>
              </div>
            </ModalPortal>
          )}
        </AnimatePresence>

        {/* Mobile Bottom Navigation Bar: always visible on preview, mobile, and tablet devices */}
        <div>
          <MobileNavbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            lowStockCount={summary?.lowStockCount || 0}
            requisitionCount={requisitions.length}
            isAdmin={currentUser?.role === 'admin'}
            isLiveActive={isLiveActive}
          />
        </div>

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

        {/* Offline Status & Connectivity Indicator */}
        <OfflineIndicator />

        {/* LINE Notification Settings Modal */}
        <LineSettingsModal
          isOpen={isLineSettingsModalOpen}
          onClose={() => setIsLineSettingsModalOpen(false)}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
