import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { InventoryItem, RequisitionRecord } from '../types';
import { 
  X, User, Calendar, Clock, MapPin, Check, 
  AlertCircle, FileText, Search, ArrowDownRight, ArrowUpRight,
  ChevronDown, Package, Layers
} from 'lucide-react';
import { playSuccessSoundAndSpeak } from '../utils/audioUtils';

interface RequisitionModalProps {
  isOpen: boolean;
  preselectedItem?: InventoryItem | null;
  items: InventoryItem[];
  currentUser: { name: string; username: string };
  onClose: () => void;
  onSubmit: (record: Omit<RequisitionRecord, 'id'>) => void;
}

export const RequisitionModal: React.FC<RequisitionModalProps> = ({
  isOpen,
  preselectedItem,
  items,
  currentUser,
  onClose,
  onSubmit,
}) => {
  const [transactionType, setTransactionType] = useState<'out' | 'in'>('out');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [qty, setQty] = useState<number | ''>(1);
  const [requestedBy, setRequestedBy] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize and reset fields
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
      setQty(1);
      setError('');
      setIsDropdownOpen(false);
      setRequestedBy(currentUser.name);

      if (preselectedItem) {
        setSelectedItemId(preselectedItem.id);
        setItemSearchQuery(`${preselectedItem.name} (${preselectedItem.id})`);
      } else if (items.length > 0 && !selectedItemId) {
        setSelectedItemId(items[0].id);
        setItemSearchQuery(`${items[0].name} (${items[0].id})`);
      }
    }
  }, [isOpen, preselectedItem, items]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.id === selectedItemId);

  // Filter items for searchable dropdown
  const filteredDropdownItems = items.filter((item) => {
    const query = itemSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query)
    );
  });

  const handleSelectItem = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setItemSearchQuery(`${item.name} (${item.id})`);
    setIsDropdownOpen(false);
    setError('');
  };

  // Haptic feedback trigger for mobile devices
  const triggerHapticFeedback = (pattern: number | number[] = 50) => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore vibration errors on unsupported platforms
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem) {
      triggerHapticFeedback([40, 50, 40]);
      setError('กรุณาเลือกรายการสินค้า');
      return;
    }
    const finalQty = typeof qty === 'number' ? qty : 0;
    if (finalQty <= 0) {
      triggerHapticFeedback([40, 50, 40]);
      setError(`จำนวนที่${transactionType === 'out' ? 'เบิก' : 'รับเข้า'}ต้องมากกว่า 0`);
      return;
    }
    if (transactionType === 'out' && finalQty > currentItem.qty) {
      triggerHapticFeedback([40, 50, 40]);
      setError(`สินค้ามีคงเหลือเพียง ${currentItem.qty} ${currentItem.unit} (ไม่พอสำหรับการเบิก ${qty} ${currentItem.unit})`);
      return;
    }
    if (!requestedBy.trim()) {
      triggerHapticFeedback([40, 50, 40]);
      setError(`กรุณาระบุชื่อผู้${transactionType === 'out' ? 'เบิก' : 'รับเข้า'}สินค้า`);
      return;
    }
    if (!purpose.trim()) {
      triggerHapticFeedback([40, 50, 40]);
      setError(`กรุณาระบุ${transactionType === 'out' ? 'งานหรือสถานที่ที่นำไปใช้' : 'แหล่งที่มาหรือเหตุผลการรับเข้า'}`);
      return;
    }

    // Physical haptic vibration confirmation for successful action
    triggerHapticFeedback([50, 40, 60]);

    // Format human readable Thai timestamp
    let formattedTimestamp = '';
    try {
      const [year, month, day] = dateStr.split('-');
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const thaiYear = parseInt(year, 10) > 2500 ? parseInt(year, 10) : parseInt(year, 10) + 543;
      const monthName = thaiMonths[parseInt(month, 10) - 1] || month;
      formattedTimestamp = `${parseInt(day, 10)} ${monthName} ${thaiYear}, ${timeStr} น.`;
    } catch {
      formattedTimestamp = `${dateStr} ${timeStr}`;
    }

    // Calculate accurate ISO date from dateStr & timeStr
    let isoDate = new Date().toISOString();
    try {
      const selectedDateTime = new Date(`${dateStr}T${timeStr}:00`);
      if (!isNaN(selectedDateTime.getTime())) {
        isoDate = selectedDateTime.toISOString();
      }
    } catch {}

    const isStockIn = transactionType === 'in';
    const speechText = isStockIn
      ? `บันทึกรับเข้า ${currentItem.name} จำนวน ${finalQty} ${currentItem.unit} เรียบร้อยแล้วค่ะ`
      : `บันทึกการเบิก ${currentItem.name} จำนวน ${finalQty} ${currentItem.unit} เรียบร้อยแล้วค่ะ`;

    playSuccessSoundAndSpeak(speechText);

    onSubmit({
      type: transactionType,
      itemId: currentItem.id,
      itemName: currentItem.name,
      category: currentItem.category,
      qty: finalQty,
      unit: currentItem.unit,
      requestedBy: requestedBy.trim(),
      purpose: purpose.trim(),
      timestamp: formattedTimestamp,
      isoDate,
      note: note.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Smooth Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
      />

      {/* Smooth Modal Dialog */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 bg-white dark:bg-slate-900 w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border-0 sm:border border-slate-200/90 dark:border-slate-800 transition-colors"
      >
        
        {/* Header */}
        <div className="px-3.5 sm:px-4 pt-safe-header pb-3 sm:py-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-sm transition-colors border ${
              transactionType === 'out' ? 'bg-blue-600 border-blue-500 shadow-blue-500/20' : 'bg-emerald-600 border-emerald-500 shadow-emerald-500/20'
            }`}>
              {transactionType === 'out' ? (
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {transactionType === 'out' ? 'บันทึกการเบิกสินค้า' : 'บันทึกการรับเข้าสินค้า'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {transactionType === 'out' 
                  ? 'ตัดยอดสต็อกสินค้าออกจากคลัง Store FL.6' 
                  : 'เพิ่มยอดสต็อกสินค้าเข้าคลัง Store FL.6'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transaction Type Switcher (เบิกออก vs รับเข้า) */}
        <div className="px-3.5 sm:px-4 pt-2.5 pb-1 bg-white dark:bg-slate-900 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setTransactionType('out');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg sm:rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                transactionType === 'out'
                  ? 'bg-blue-600 text-white shadow-xs border border-blue-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              เบิกออก (Stock Out)
            </button>

            <button
              type="button"
              onClick={() => {
                setTransactionType('in');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg sm:rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                transactionType === 'in'
                  ? 'bg-emerald-600 text-white shadow-xs border border-emerald-500'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              รับเข้า (Stock In)
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900">
          <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3 flex-1">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl text-sm flex items-center gap-2 shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

          {/* 1. Item Selection with Typing & Live Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                เลือกสินค้า ({transactionType === 'out' ? 'เบิก' : 'รับเข้า'}) <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-slate-400 dark:text-slate-400">
                พิมพ์ค้นหาจากรหัส, ชื่อ, หรือหมวดหมู่
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={itemSearchQuery}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  setItemSearchQuery(e.target.value);
                  setIsDropdownOpen(true);
                }}
                placeholder="พิมพ์ชื่อสินค้า หรือรหัส (เช่น A0000001, แอลกอฮอล์, สายยาง)..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Live Autocomplete Dropdown List */}
            {isDropdownOpen && (
              <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700 animate-in fade-in-50 zoom-in-95">
                {filteredDropdownItems.length === 0 ? (
                  <div className="p-3 text-center text-sm text-slate-400 dark:text-slate-400">
                    ไม่พบสินค้าที่ตรงกับ "{itemSearchQuery}"
                  </div>
                ) : (
                  filteredDropdownItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-2.5 hover:bg-blue-50/70 dark:hover:bg-slate-700 transition-colors flex items-center justify-between gap-2.5 ${
                        item.id === selectedItemId ? 'bg-blue-50 dark:bg-slate-700 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-black border border-slate-300 dark:border-slate-800 px-1.5 py-0.2 rounded shadow-2xs">
                              {item.id}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded">
                              {item.category}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
                            ที่เก็บ: {item.location}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-sm font-bold block ${
                          item.qty <= 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : item.qty <= item.minStock 
                            ? 'text-amber-600 dark:text-amber-400' 
                            : 'text-slate-700 dark:text-slate-200'
                        }`}>
                          {item.qty} {item.unit}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-400">คงเหลือ</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Current Item Summary Card - Compact Frame with Extra Large Font Filling the Space */}
            {currentItem && (
              <motion.div 
                key={currentItem.id} // Re-animate if item changes
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="mt-2.5 overflow-hidden rounded-xl border-2 border-blue-500/80 dark:border-blue-500/60 bg-white dark:bg-slate-900 shadow-sm"
              >
                {/* Top Header Row: Status & ID on Left | Location & Category on Top-Right */}
                <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {transactionType === 'out' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-600 text-white shadow-2xs">
                        <ArrowDownRight className="w-3 h-3 stroke-[3]" />
                        เบิกออก
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-600 text-white shadow-2xs">
                        <ArrowUpRight className="w-3 h-3 stroke-[3]" />
                        รับเข้า
                      </span>
                    )}
                    <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded shadow-2xs">
                      {currentItem.id}
                    </span>
                  </div>

                  {/* Right Side: Location & Category Stacked */}
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-2xs">
                      <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                      <span>ที่เก็บ: <strong className="text-slate-900 dark:text-white font-extrabold">{currentItem.location}</strong></span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 shadow-2xs">
                      หมวด: {currentItem.category}
                    </span>
                  </div>
                </div>

                {/* Middle Body: Giant Item Name filling the compact container */}
                <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center bg-white dark:bg-slate-900">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight break-words tracking-tight w-full drop-shadow-sm">
                    {currentItem.name}
                  </h3>
                </div>

                {/* Bottom Footer: Stock Balance Bar */}
                <div className="px-3 py-1.5 bg-slate-50/90 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    คงเหลือปัจจุบัน
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                      {currentItem.qty}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                      {currentItem.unit}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 ml-1">
                      (ขั้นต่ำ: {currentItem.minStock} {currentItem.unit})
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* 2. Quantity & Requisitioner Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                จำนวนที่{transactionType === 'out' ? 'เบิก' : 'รับเข้า'} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max={transactionType === 'out' ? (currentItem ? currentItem.qty : 9999) : 99999}
                  value={qty}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setQty('');
                    else {
                       const parsed = parseInt(val);
                       setQty(isNaN(parsed) ? '' : Math.max(0, parsed));
                    }
                  }}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 shadow-2xs"
                />
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-2 rounded-xl min-w-[65px] text-center shadow-2xs">
                  {currentItem?.unit || 'ชิ้น'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <User className={`w-4 h-4 ${transactionType === 'out' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                {transactionType === 'out' ? 'ชื่อผู้เบิกสินค้า' : 'ชื่อผู้รับเข้า / ตรวจรับ'}
              </label>
              <input
                type="text"
                value={requestedBy}
                readOnly
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-500 dark:text-slate-300 outline-none cursor-not-allowed font-medium shadow-2xs"
              />
            </div>
          </div>

          {/* 3. Purpose / Location */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
              <MapPin className="w-4 h-4 text-red-500" />
              {transactionType === 'out' 
                ? 'งานที่นำไปใช้ / สถานที่ติดตั้ง' 
                : 'แหล่งที่มา / เหตุผลการรับเข้า'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={
                transactionType === 'out'
                  ? 'เช่น ซ่อมระบบแอร์ชั้น 4, เปลี่ยนสวิตช์ไฟห้อง 201'
                  : 'เช่น สั่งซื้อเติมสต็อกประจำเดือน, ซัพพลายเออร์ส่งมอบ, คืนของเหลือ'
              }
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
            />
          </div>

          {/* 4. Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                วันที่ทำรายการ
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                เวลา
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 shadow-2xs"
              />
            </div>
          </div>

          {/* 5. Note */}
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1">
              <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              หมายเหตุเพิ่มเติม (ถ้ามี)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ใบสั่งซื้อ PO-1029, งานด่วนรอบดึก"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs"
            />
          </div>
        </div>

        {/* Sticky Fixed Bottom Action Button */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 pb-[max(16px,calc(env(safe-area-inset-bottom,16px)+12px))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-none">
          <button
            type="submit"
            onTouchStart={() => triggerHapticFeedback(25)}
            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-md text-base flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer border ${
              transactionType === 'out'
                ? 'bg-blue-600 hover:bg-blue-700 border-blue-500 shadow-blue-500/20'
                : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500 shadow-emerald-500/20'
            }`}
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            {transactionType === 'out' ? 'ยืนยันการบันทึกการเบิกสินค้า' : 'ยืนยันการบันทึกรับเข้าสินค้า'}
          </button>
        </div>
      </form>
      </motion.div>
    </div>
  );
};

