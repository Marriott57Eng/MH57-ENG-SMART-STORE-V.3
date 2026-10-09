import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileDown, 
  X, 
  Calendar, 
  Clock, 
  User as UserIcon, 
  Package, 
  AlertTriangle, 
  ShoppingCart, 
  ClipboardList, 
  BarChart3, 
  CheckCircle2, 
  Loader2, 
  Sparkles,
  Filter,
  Users,
  Search,
  ChevronDown,
  Check,
  Shield,
  Layers,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import { InventoryItem, RequisitionRecord, PurchaseOrder, User } from '../types';
import { generateAndDownloadPdf, parseRecordDateTime, isWithinDateTimeRange } from '../utils/pdfGenerator';
import { SYSTEM_EMPLOYEES, findEmployeeInSystem } from '../utils/employeeDirectory';

export interface AdminReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  items: InventoryItem[];
  requisitions: RequisitionRecord[];
  orders?: PurchaseOrder[];
  initialType?: 
    | 'inventory_all' 
    | 'requisition_history' 
    | 'individual_requisitions' 
    | 'low_stock' 
    | 'category' 
    | 'purchase_orders' 
    | 'executive_summary';
  initialUser?: string;
}

export const AdminReportModal: React.FC<AdminReportModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  items,
  requisitions,
  orders = [],
  initialType = 'individual_requisitions',
  initialUser = '',
}) => {
  useScrollLock(isOpen);

  // Report Type State
  const [reportType, setReportType] = useState<
    'individual_requisitions' | 'requisition_history' | 'inventory_all' | 'low_stock' | 'purchase_orders' | 'executive_summary'
  >(initialType === 'category' ? 'inventory_all' : initialType);

  // User Filter State (Strictly limited to 32 designated Store FL.6 employees)
  const [selectedUser, setSelectedUser] = useState<string>(initialUser);

  // Date & Time Range State
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'month' | 'all'>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');

  // Filter State
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Custom Dropdown Open States
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const userSearchInputRef = useRef<HTMLInputElement>(null);

  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [isOrderStatusDropdownOpen, setIsOrderStatusDropdownOpen] = useState(false);
  const orderStatusDropdownRef = useRef<HTMLDivElement>(null);

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Helper to format ISO date to YYYY-MM-DD
  const formatYmd = (d: Date) => d.toISOString().slice(0, 10);

  // Apply preset dates
  const applyDatePreset = (preset: 'today' | '7days' | '30days' | 'month' | 'all') => {
    setDatePreset(preset);
    const now = new Date();
    
    if (preset === 'today') {
      const todayStr = formatYmd(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      setStartTime('00:00');
      setEndTime('23:59');
    } else if (preset === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      setStartDate(formatYmd(past7));
      setEndDate(formatYmd(now));
      setStartTime('00:00');
      setEndTime('23:59');
    } else if (preset === '30days') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      setStartDate(formatYmd(past30));
      setEndDate(formatYmd(now));
      setStartTime('00:00');
      setEndTime('23:59');
    } else if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYmd(firstDay));
      setEndDate(formatYmd(now));
      setStartTime('00:00');
      setEndTime('23:59');
    } else {
      // all
      setStartDate('');
      setEndDate('');
      setStartTime('00:00');
      setEndTime('23:59');
    }
  };

  // Initialize date preset on mount
  useEffect(() => {
    applyDatePreset('month');
  }, []);

  // Sync initial type or user when opened
  useEffect(() => {
    if (isOpen) {
      if (initialType === 'category') {
        setReportType('inventory_all');
      } else if (initialType) {
        setReportType(initialType);
      }
      if (initialUser) {
        setSelectedUser(initialUser);
      }
      setIsSuccess(false);
      setIsUserDropdownOpen(false);
      setIsCategoryDropdownOpen(false);
      setIsOrderStatusDropdownOpen(false);
    }
  }, [isOpen, initialType, initialUser]);

  // Click outside listener for all custom dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
      if (orderStatusDropdownRef.current && !orderStatusDropdownRef.current.contains(event.target as Node)) {
        setIsOrderStatusDropdownOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when user dropdown opens
  useEffect(() => {
    if (isUserDropdownOpen) {
      setTimeout(() => {
        userSearchInputRef.current?.focus();
      }, 50);
    } else {
      setUserSearchQuery('');
    }
  }, [isUserDropdownOpen]);

  // เฉพาะพนักงาน 32 คนที่กำหนดของระบบ Store FL.6 เท่านั้น (ตัดฝ่ายจัดซื้อ หรือหน่วยงาน/บุคคลภายนอกออก 100%)
  const allUserOptions = useMemo(() => {
    return SYSTEM_EMPLOYEES.map(emp => {
      const aliases = [
        emp.name.toLowerCase(),
        emp.id.toLowerCase(),
        emp.nickname.toLowerCase(),
        emp.thaiName.toLowerCase(),
        emp.thaiNickname.toLowerCase(),
        ...(emp.aliases || []).map(a => a.toLowerCase())
      ];

      const count = requisitions.filter(r => {
        if (!r.requestedBy) return false;
        const rLower = r.requestedBy.trim().toLowerCase();
        return aliases.some(alias => rLower === alias || rLower.includes(alias) || alias.includes(rLower));
      }).length;

      return {
        id: emp.id,
        name: emp.name,
        username: emp.id,
        nickname: emp.nickname,
        thaiName: emp.thaiName,
        thaiNickname: emp.thaiNickname,
        role: emp.role || 'user',
        count
      };
    }).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return Number(a.id || 9999) - Number(b.id || 9999);
    });
  }, [requisitions]);

  // ค้นหารายชื่อพนักงานใน 32 คนที่กำหนด (ค้นหาได้ทั้งรหัส, ชื่ออังกฤษ, ชื่อเล่น, ชื่อไทย)
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return allUserOptions;
    const q = userSearchQuery.toLowerCase().trim();
    return allUserOptions.filter(u => 
      u.id.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) || 
      u.nickname.toLowerCase().includes(q) ||
      u.thaiName.toLowerCase().includes(q) ||
      u.thaiNickname.toLowerCase().includes(q) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [allUserOptions, userSearchQuery]);

  // ค้นหาข้อมูลพนักงานที่เลือกอยู่ในระบบ
  const selectedUserInfo = useMemo(() => {
    if (!selectedUser) return null;
    const matched = findEmployeeInSystem(selectedUser);
    if (matched) {
      return allUserOptions.find(u => u.id === matched.id) || null;
    }
    return allUserOptions.find(u => u.name.toLowerCase() === selectedUser.toLowerCase() || u.id === selectedUser) || null;
  }, [allUserOptions, selectedUser]);

  // Categories list
  const categoriesList = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      const cat = i.category || 'ทั่วไป';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categoriesList;
    const q = categorySearchQuery.toLowerCase().trim();
    return categoriesList.filter(c => c.name.toLowerCase().includes(q));
  }, [categoriesList, categorySearchQuery]);

  // Calculate live count preview
  const livePreviewCount = useMemo(() => {
    if (reportType === 'individual_requisitions' || reportType === 'requisition_history') {
      let filtered = requisitions.filter(r => {
        const rDate = parseRecordDateTime(r.isoDate, r.timestamp);
        return isWithinDateTimeRange(rDate, startDate, startTime, endDate, endTime);
      });
      if (reportType === 'individual_requisitions') {
        if (!selectedUser) return 0;
        const matched = findEmployeeInSystem(selectedUser);
        if (matched) {
          const aliases = [
            matched.name.toLowerCase(),
            matched.id.toLowerCase(),
            matched.nickname.toLowerCase(),
            matched.thaiName.toLowerCase(),
            matched.thaiNickname.toLowerCase(),
            ...(matched.aliases || []).map(a => a.toLowerCase())
          ];
          filtered = filtered.filter(r => {
            if (!r.requestedBy) return false;
            const rLower = r.requestedBy.trim().toLowerCase();
            return aliases.some(alias => rLower === alias || rLower.includes(alias) || alias.includes(rLower));
          });
        } else {
          return 0; // ไม่อนุญาตหากไม่ใช่พนักงาน 32 คนที่กำหนด
        }
      } else if (selectedUser) {
        const matched = findEmployeeInSystem(selectedUser);
        if (matched) {
          const aliases = [
            matched.name.toLowerCase(),
            matched.id.toLowerCase(),
            matched.nickname.toLowerCase(),
            matched.thaiName.toLowerCase(),
            matched.thaiNickname.toLowerCase(),
            ...(matched.aliases || []).map(a => a.toLowerCase())
          ];
          filtered = filtered.filter(r => {
            if (!r.requestedBy) return false;
            const rLower = r.requestedBy.trim().toLowerCase();
            return aliases.some(alias => rLower === alias || rLower.includes(alias) || alias.includes(rLower));
          });
        } else {
          const lower = selectedUser.toLowerCase();
          filtered = filtered.filter(r => r.requestedBy && r.requestedBy.toLowerCase().includes(lower));
        }
      }
      return filtered.length;
    } else if (reportType === 'purchase_orders') {
      let filtered = orders.filter(o => {
        const oDate = parseRecordDateTime(o.isoDate, o.createdAt);
        return isWithinDateTimeRange(oDate, startDate, startTime, endDate, endTime);
      });
      if (orderStatusFilter !== 'all') {
        filtered = filtered.filter(o => o.status === orderStatusFilter);
      }
      if (selectedUser) {
        const lower = selectedUser.toLowerCase();
        filtered = filtered.filter(o => o.requestedBy && o.requestedBy.toLowerCase().includes(lower));
      }
      return filtered.length;
    } else if (reportType === 'low_stock') {
      return items.filter(i => i.status === 'low' || i.status === 'out').length;
    } else if (reportType === 'inventory_all') {
      if (categoryFilter !== 'all') {
        return items.filter(i => i.category === categoryFilter).length;
      }
      return items.length;
    } else if (reportType === 'executive_summary') {
      const reqsInPeriod = requisitions.filter(r => {
        const rDate = parseRecordDateTime(r.isoDate, r.timestamp);
        return isWithinDateTimeRange(rDate, startDate, startTime, endDate, endTime);
      });
      return reqsInPeriod.length;
    }
    return items.length;
  }, [reportType, requisitions, orders, items, startDate, endDate, startTime, endTime, selectedUser, categoryFilter, orderStatusFilter]);

  // Handle Export Click (Instant zero-delay execution with immediate UI feedback)
  const handleExport = () => {
    if (isGenerating) return;
    if (reportType === 'individual_requisitions' && !selectedUser) return;

    // Instant synchronous UI feedback - 0ms delay!
    setIsGenerating(true);
    setIsSuccess(false);

    // Run PDF generation in the next animation frame after browser has painted the loading state
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          await generateAndDownloadPdf({
            type: reportType,
            userFilter: (reportType === 'individual_requisitions' || reportType === 'purchase_orders' || reportType === 'requisition_history') 
              ? (selectedUser || undefined) 
              : undefined,
            categoryFilter: categoryFilter !== 'all' ? categoryFilter : undefined,
            orderStatusFilter: orderStatusFilter !== 'all' ? orderStatusFilter : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            startTime,
            endTime,
            items,
            requisitions,
            orders,
            generatedBy: currentUser.name || currentUser.username || 'Admin',
          });

          setIsSuccess(true);
          setTimeout(() => {
            setIsSuccess(false);
          }, 3000);
        } catch (err) {
          console.error('Failed to generate PDF:', err);
          alert('เกิดข้อผิดพลาดในการสร้างเอกสาร PDF กรุณาลองใหม่อีกครั้ง');
        } finally {
          setIsGenerating(false);
        }
      }, 16);
    });
  };

  // Helper for status badge styling
  const orderStatusOptions = [
    { value: 'all', label: 'ทุกสถานะคำสั่งซื้อ (All Statuses)', icon: '📦', color: 'text-slate-700 dark:text-slate-300' },
    { value: 'pending', label: 'รอยืนยัน (Pending)', icon: '⏳', color: 'text-amber-600 dark:text-amber-400' },
    { value: 'confirmed', label: 'ยืนยันแล้ว (Confirmed)', icon: '✅', color: 'text-blue-600 dark:text-blue-400' },
    { value: 'received', label: 'รับสินค้าแล้ว (Received)', icon: '📦', color: 'text-emerald-600 dark:text-emerald-400' },
    { value: 'cancelled', label: 'ยกเลิก (Cancelled)', icon: '❌', color: 'text-rose-600 dark:text-rose-400' },
  ];

  const selectedStatusObj = orderStatusOptions.find(o => o.value === orderStatusFilter) || orderStatusOptions[0];

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isGenerating) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[28px] border border-slate-200/90 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[92dvh] max-h-[92dvh] sm:h-[88vh] sm:max-h-[88vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="relative px-5 sm:px-6 py-4 sm:py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner shrink-0">
              <FileDown className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                  ศูนย์ออกรายงาน PDF (PDF Report Center)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-xs shrink-0">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5 line-clamp-1">
                เลือกรูปแบบรายงาน ตัวกรองรายบุคคล และช่วงเวลาที่ต้องการออกเอกสาร
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 sm:w-5 h-4 sm:h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div 
          className="p-4 sm:p-6 overflow-y-auto overscroll-y-contain flex-1 min-h-0 space-y-5 text-slate-800 dark:text-slate-100 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          
          {/* 1. Report Type Selection Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>1. เลือกประเภทรายงานที่ต้องการออก:</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                เลือกได้ 1 รูปแบบต่อครั้ง
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Individual Requisitions */}
              <button
                type="button"
                onClick={() => setReportType('individual_requisitions')}
                className={`group p-3 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  reportType === 'individual_requisitions'
                    ? 'liquid-glass border-2 border-blue-500 shadow-md shadow-blue-500/15 ring-2 ring-blue-500/20'
                    : 'liquid-glass-card hover:border-blue-400/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    reportType === 'individual_requisitions'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/25'
                  }`}>
                    <UserIcon className="w-4 h-4" />
                  </div>
                  {reportType === 'individual_requisitions' ? (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      ยอดนิยม
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    ประวัติเบิกรายบุคคล
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    ระบุชื่อช่าง/ผู้ทำรายการ
                  </div>
                </div>
              </button>

              {/* Option 2: All Requisitions */}
              <button
                type="button"
                onClick={() => setReportType('requisition_history')}
                className={`group p-3 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  reportType === 'requisition_history'
                    ? 'liquid-glass border-2 border-emerald-500 shadow-md shadow-emerald-500/15 ring-2 ring-emerald-500/20'
                    : 'liquid-glass-card hover:border-emerald-400/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    reportType === 'requisition_history'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/25'
                  }`}>
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  {reportType === 'requisition_history' && (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    ประวัติเบิก-รับทั้งหมด
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    สต็อกเข้า-ออกรวมทั้งระบบ
                  </div>
                </div>
              </button>

              {/* Option 3: All Inventory */}
              <button
                type="button"
                onClick={() => setReportType('inventory_all')}
                className={`group p-3 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  reportType === 'inventory_all'
                    ? 'liquid-glass border-2 border-purple-500 shadow-md shadow-purple-500/15 ring-2 ring-purple-500/20'
                    : 'liquid-glass-card hover:border-purple-400/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    reportType === 'inventory_all'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/25'
                  }`}>
                    <Package className="w-4 h-4" />
                  </div>
                  {reportType === 'inventory_all' && (
                    <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    สินค้าคงคลังทั้งหมด
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    แสดงสต็อกตามหมวดหมู่
                  </div>
                </div>
              </button>

              {/* Option 4: Low Stock */}
              <button
                type="button"
                onClick={() => setReportType('low_stock')}
                className={`group p-3 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  reportType === 'low_stock'
                    ? 'liquid-glass border-2 border-amber-500 shadow-md shadow-amber-500/15 ring-2 ring-amber-500/20'
                    : 'liquid-glass-card hover:border-amber-400/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    reportType === 'low_stock'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/25'
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  {reportType === 'low_stock' ? (
                    <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      แจ้งเตือน
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    สต็อกใกล้หมด / หมด
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    เฉพาะสินค้าจุดวิกฤต
                  </div>
                </div>
              </button>

              {/* Option 5: Purchase Orders */}
              <button
                type="button"
                onClick={() => setReportType('purchase_orders')}
                className={`group p-3 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  reportType === 'purchase_orders'
                    ? 'liquid-glass border-2 border-rose-500 shadow-md shadow-rose-500/15 ring-2 ring-rose-500/20'
                    : 'liquid-glass-card hover:border-rose-400/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    reportType === 'purchase_orders'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/25'
                  }`}>
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  {reportType === 'purchase_orders' && (
                    <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    ประวัติการสั่งซื้อ (PO)
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    ยอดสั่งซื้อและสถานะ
                  </div>
                </div>
              </button>

              {/* Option 6: Executive Summary */}
              <button
                type="button"
                onClick={() => setReportType('executive_summary')}
                className={`group p-3 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden ${
                  reportType === 'executive_summary'
                    ? 'liquid-glass border-2 border-indigo-500 shadow-md shadow-indigo-500/15 ring-2 ring-indigo-500/20'
                    : 'liquid-glass-card hover:border-indigo-400/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                    reportType === 'executive_summary'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/25'
                  }`}>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  {reportType === 'executive_summary' && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    สรุปภาพรวมผู้บริหาร
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                    รวมทุกข้อมูลสรุปสำคัญ
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Custom Liquid-Glass User Dropdown (Searchable Combobox) */}
          {(reportType === 'individual_requisitions' || reportType === 'requisition_history' || reportType === 'purchase_orders') && (
            <div 
              ref={userDropdownRef}
              className={`p-4 rounded-[22px] transition-all relative ${
                reportType === 'individual_requisitions'
                  ? 'liquid-glass border-2 border-blue-400/60 dark:border-blue-500/50 shadow-sm'
                  : 'liquid-glass-card'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    {reportType === 'individual_requisitions' 
                      ? '2. เลือกพนักงาน / ช่างเทคนิคที่ต้องการออกรายงาน (จำเป็น):' 
                      : '2. กรองเฉพาะรายบุคคล (เลือกได้ หรือเว้นว่างเพื่อดูทุกคน):'}
                  </span>
                </label>
                {selectedUser && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser('');
                    }}
                    className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline transition-colors cursor-pointer flex items-center gap-0.5"
                  >
                    <X className="w-3 h-3" />
                    <span>ล้างการเลือก</span>
                  </button>
                )}
              </div>

              {/* Dropdown Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className={`w-full liquid-glass-input rounded-2xl px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 border transition-all cursor-pointer shadow-xs ${
                    isUserDropdownOpen 
                      ? 'border-blue-500 ring-2 ring-blue-500/25' 
                      : selectedUser 
                        ? 'border-blue-400/50 hover:border-blue-400' 
                        : reportType === 'individual_requisitions'
                          ? 'border-amber-400/80 bg-amber-500/5 hover:border-amber-500'
                          : 'hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {selectedUser ? (
                      <>
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                          {selectedUserInfo?.id || selectedUser.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {selectedUserInfo ? selectedUserInfo.name : selectedUser}
                            </span>
                            {selectedUserInfo && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                                ID: {selectedUserInfo.id}
                              </span>
                            )}
                            {selectedUserInfo && (
                              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                                ({selectedUserInfo.nickname})
                              </span>
                            )}
                            {selectedUserInfo?.role && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                selectedUserInfo.role === 'admin'
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30'
                                  : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-400/30'
                              }`}>
                                {selectedUserInfo.role === 'admin' ? 'Admin' : 'Staff'}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {selectedUserInfo ? `ประวัติทำรายการ ${selectedUserInfo.count} ครั้ง` : 'พนักงานที่ระบุ'}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs sm:text-sm font-semibold truncate block ${
                            reportType === 'individual_requisitions' 
                              ? 'text-amber-600 dark:text-amber-400' 
                              : 'text-slate-600 dark:text-slate-300'
                          }`}>
                            {reportType === 'individual_requisitions'
                              ? '👉 คลิกเลือกพนักงาน (32 ท่านในระบบ Store FL.6)...'
                              : '👥 ผู้ทำรายการทุกคน (All Users)'}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {reportType === 'individual_requisitions'
                              ? 'ค้นหาด้วยรหัสพนักงาน หรือชื่อภาษาอังกฤษ (ID, Name, Nickname)'
                              : 'แสดงข้อมูลรวมของพนักงานทุกคน'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
                      <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180 text-blue-500' : ''}`} />
                    </div>
                  </div>
                </button>

                {/* Animated Dropdown Menu Panel */}
                {isUserDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl p-2 animate-in fade-in-50 zoom-in-98 duration-150 flex flex-col max-h-72">
                    {/* Integrated Search Box */}
                    <div className="relative mb-2 shrink-0">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        ref={userSearchInputRef}
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="ค้นหารหัสพนักงาน, ชื่อ หรือชื่อเล่น (e.g. 1847, Mild, Chanayood)..."
                        className="w-full liquid-glass-input rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 border border-slate-300/80 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {userSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setUserSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Scrollable User Options */}
                    <div className="overflow-y-auto overscroll-contain space-y-1 flex-1 pr-0.5 touch-pan-y">
                      {/* Option for All Users (if not strict individual requisitions) */}
                      {reportType !== 'individual_requisitions' && !userSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser('');
                            setIsUserDropdownOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                            !selectedUser
                              ? 'bg-blue-600 text-white font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              !selectedUser ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}>
                              <Users className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold leading-tight">👥 ผู้ทำรายการทุกคน (All Users)</div>
                              <div className={`text-[10px] ${!selectedUser ? 'text-blue-100' : 'text-slate-400'}`}>
                                รวมรายการของทุกคนในระบบ
                              </div>
                            </div>
                          </div>
                          {!selectedUser && <Check className="w-4 h-4 text-white stroke-[3] shrink-0" />}
                        </button>
                      )}

                      {filteredUsers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                          ไม่พบรายชื่อในทำเนียบพนักงาน 32 คนที่ตรงกับ "{userSearchQuery}"
                        </div>
                      ) : (
                        filteredUsers.map((user) => {
                          const isSelected = selectedUser.toLowerCase() === user.name.toLowerCase();
                          return (
                            <button
                              key={user.name}
                              type="button"
                              onClick={() => {
                                setSelectedUser(user.name);
                                setIsUserDropdownOpen(false);
                              }}
                              className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                                  : 'hover:bg-blue-500/10 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : user.role === 'admin'
                                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                      : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                }`}>
                                  {user.id}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold truncate">{user.name}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                      isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                    }`}>
                                      ({user.nickname})
                                    </span>
                                    {user.role === 'admin' && (
                                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                                        isSelected
                                          ? 'bg-white/20 text-white'
                                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                      }`}>
                                        Admin
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                    ประวัติเบิก: {user.count} รายการ
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                  {user.count} รายการ
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Helpful Alert if Individual is Selected and User is Empty */}
              {reportType === 'individual_requisitions' && !selectedUser && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-amber-700 dark:text-amber-300 flex items-center gap-2 text-xs font-semibold animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>โปรดกดเลือกพนักงานจากกล่องด้านบน เพื่อออกรายงานเฉพาะบุคคล</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Category Custom Dropdown (When Inventory All is Selected) */}
          {reportType === 'inventory_all' && (
            <div 
              ref={categoryDropdownRef}
              className="p-4 rounded-[22px] liquid-glass-card relative"
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>2. กรองหมวดหมู่สินค้า (Category Filter):</span>
                </label>
                {categoryFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>ดูทุกหมวดหมู่</span>
                  </button>
                )}
              </div>

              {/* Trigger */}
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="w-full liquid-glass-input rounded-2xl px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 border border-slate-200 dark:border-slate-700 hover:border-purple-400 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {categoryFilter === 'all' ? '📦 ทุกหมวดหมู่สินค้า (All Categories)' : `📁 ${categoryFilter}`}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {categoryFilter === 'all' 
                        ? `รวมสินค้าทั้งหมดในคลัง (${items.length} รายการ)` 
                        : `มีสินค้าในหมวดนี้ ${items.filter(i => i.category === categoryFilter).length} รายการ`}
                    </div>
                  </div>
                </div>

                <div className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isCategoryDropdownOpen ? 'rotate-180 text-purple-500' : ''}`} />
                </div>
              </button>

              {/* Menu */}
              {isCategoryDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl p-2 animate-in fade-in-50 zoom-in-98 duration-150 flex flex-col max-h-64">
                  {/* Category Search */}
                  <div className="relative mb-2 shrink-0">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      placeholder="ค้นหาหมวดหมู่สินค้า..."
                      className="w-full liquid-glass-input rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/30"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="overflow-y-auto overscroll-contain space-y-1 flex-1 touch-pan-y">
                    {/* All Categories Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter('all');
                        setIsCategoryDropdownOpen(false);
                      }}
                      className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                        categoryFilter === 'all'
                          ? 'bg-purple-600 text-white font-bold'
                          : 'hover:bg-purple-500/10 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>📦 ทุกหมวดหมู่สินค้า (All Categories)</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        categoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {items.length} รายการ
                      </span>
                    </button>

                    {filteredCategories.map((cat) => {
                      const isSelected = categoryFilter === cat.name;
                      return (
                        <button
                          key={cat.name}
                          type="button"
                          onClick={() => {
                            setCategoryFilter(cat.name);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white font-bold'
                              : 'hover:bg-purple-500/10 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span className="text-xs font-semibold">📁 {cat.name}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}>
                            {cat.count} รายการ
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Order Status Custom Dropdown (When Purchase Orders is Selected) */}
          {reportType === 'purchase_orders' && (
            <div 
              ref={orderStatusDropdownRef}
              className="p-4 rounded-[22px] liquid-glass-card relative"
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>กรองสถานะคำสั่งซื้อ (Order Status):</span>
                </label>
              </div>

              {/* Trigger */}
              <button
                type="button"
                onClick={() => setIsOrderStatusDropdownOpen(!isOrderStatusDropdownOpen)}
                className="w-full liquid-glass-input rounded-2xl px-3.5 py-2.5 text-left flex items-center justify-between gap-2.5 border border-slate-200 dark:border-slate-700 hover:border-rose-400 transition-all cursor-pointer shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{selectedStatusObj.icon}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {selectedStatusObj.label}
                  </span>
                </div>

                <div className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOrderStatusDropdownOpen ? 'rotate-180 text-rose-500' : ''}`} />
                </div>
              </button>

              {/* Menu */}
              {isOrderStatusDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl p-2 animate-in fade-in-50 zoom-in-98 duration-150 space-y-1">
                  {orderStatusOptions.map((opt) => {
                    const isSelected = orderStatusFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setOrderStatusFilter(opt.value);
                          setIsOrderStatusDropdownOpen(false);
                        }}
                        className={`w-full p-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white font-bold'
                            : 'hover:bg-rose-500/10 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{opt.icon}</span>
                          <span className="text-xs font-semibold">{opt.label}</span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 5. Date & Time Range Selection */}
          <div className="p-4 sm:p-5 rounded-[22px] liquid-glass-card space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>3. กำหนดช่วงวันที่และเวลา (Date & Time Range):</span>
              </label>

              {/* Quick Preset Segmented Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-inner">
                {(['today', '7days', '30days', 'month', 'all'] as const).map((preset) => {
                  const labels = {
                    today: 'วันนี้',
                    '7days': '7 วัน',
                    '30days': '30 วัน',
                    month: 'เดือนนี้',
                    all: 'กำหนดเอง',
                  };
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyDatePreset(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        datePreset === preset
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date and Time Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Start Date & Time */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>ตั้งแต่วันที่ (Start Date):</span>
                  <span className="text-[10px] text-slate-400 font-normal">เวลาเริ่มต้น</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDatePreset('all');
                      }}
                      className="w-full liquid-glass-input rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/25 border border-slate-200 dark:border-slate-700 shadow-2xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 liquid-glass-input rounded-xl px-2.5 py-2 text-xs border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white outline-none w-14"
                    />
                  </div>
                </div>
              </div>

              {/* End Date & Time */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>ถึงวันที่ (End Date):</span>
                  <span className="text-[10px] text-slate-400 font-normal">เวลาสิ้นสุด</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDatePreset('all');
                      }}
                      className="w-full liquid-glass-input rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/25 border border-slate-200 dark:border-slate-700 shadow-2xs"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 liquid-glass-input rounded-xl px-2.5 py-2 text-xs border border-slate-200 dark:border-slate-700 shadow-2xs">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white outline-none w-14"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Live Summary Preview Box */}
          <div className="p-4 rounded-[22px] bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 border border-blue-400/30 dark:border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex flex-col items-center justify-center font-black shadow-md shrink-0">
                <span className="text-base sm:text-lg leading-none font-mono tabular-nums">{livePreviewCount}</span>
                <span className="text-[8px] uppercase tracking-wider font-bold opacity-80">รายการ</span>
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>ข้อมูลพร้อมพิมพ์ในรายงาน PDF</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                    {livePreviewCount} Records
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {reportType === 'individual_requisitions' && (
                    selectedUser 
                      ? `พนักงาน: "${selectedUser}" · ประวัติการเบิกตามช่วงเวลาที่กำหนด` 
                      : '⚠️ กรุณาเลือกพนักงานจากกล่องด้านบนเพื่อดูสรุป'
                  )}
                  {reportType === 'requisition_history' && (
                    selectedUser 
                      ? `พนักงาน: "${selectedUser}" · ประวัติเบิกและรับเข้าตามช่วงเวลา`
                      : 'ผู้ทำรายการทุกคน · ประวัติเบิกและรับเข้าตามช่วงเวลา'
                  )}
                  {reportType === 'inventory_all' && (
                    categoryFilter !== 'all' 
                      ? `หมวดหมู่ "${categoryFilter}" (${livePreviewCount} รายการ)` 
                      : `รวมสินค้าคงคลังทุกหมวด (${livePreviewCount} รายการ)`
                  )}
                  {reportType === 'low_stock' && `สินค้าจุดวิกฤตที่ต้องสั่งซื้อด่วน (${livePreviewCount} รายการ)`}
                  {reportType === 'purchase_orders' && `ใบสั่งซื้อสินค้าในระบบ (${livePreviewCount} ฉบับ)`}
                  {reportType === 'executive_summary' && `ภาพรวมผู้บริหารรอบ ${startDate || 'เริ่มต้น'} ถึง ${endDate || 'ปัจจุบัน'}`}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto text-blue-600 dark:text-blue-400 font-bold text-xs">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>ระบบจัดหน้าอัตโนมัติ</span>
            </div>
          </div>

        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            เอกสาร PDF ฟอร์แมตทางการขนาด A4 พร้อมตราสัญลักษณ์ ENG STORE
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={isGenerating || (reportType === 'individual_requisitions' && !selectedUser)}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 active:from-blue-800 active:to-violet-800 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all duration-75 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 active:brightness-90 select-none touch-manipulation"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังสร้างเอกสาร PDF...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>ดาวน์โหลดสำเร็จแล้ว!</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>ดาวน์โหลดรายงาน PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
