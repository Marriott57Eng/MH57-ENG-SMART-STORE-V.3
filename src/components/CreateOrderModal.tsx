import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ShoppingCart, 
  Package, 
  AlertTriangle, 
  User as UserIcon, 
  FileText, 
  Flame, 
  Zap, 
  Check, 
  Loader2, 
  MapPin, 
  Tag,
  Lock,
  Award,
  Layers,
  Sparkles,
  Search,
  Plus
} from 'lucide-react';
import { InventoryItem, User, PurchaseOrder } from '../types';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  items?: InventoryItem[];
  currentUser: User | null;
  onSubmitOrder: (order: Partial<PurchaseOrder>) => Promise<void>;
  isSubmitting?: boolean;
}

const COMMON_CATEGORIES = [
  'ไฟฟ้า',
  'ท่อ',
  'เคมี',
  'แอร์',
  'Lighting',
  'สุขภัณฑ์',
  'สี+Grouting',
  'Fire Alarm',
  'ประตู',
  'เน็ต+โทรศัพท์',
  'เครื่องมือช่าง',
  'วัสดุสิ้นเปลือง',
  'อื่นๆ (ระบุเอง)',
];

const COMMON_UNITS = ['ชิ้น', 'ม้วน', 'กล่อง', 'ชุด', 'ถัง', 'เมตร', 'ขวด', 'แพ็ค', 'หลอด', 'อัน'];

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  item = null,
  items = [],
  currentUser,
  onSubmitOrder,
  isSubmitting = false,
}) => {
  // Mode: 'store' = item in store, 'custom' = new item not in store
  const [orderMode, setOrderMode] = useState<'store' | 'custom'>('store');
  
  // Selected store item (if in store mode)
  const [selectedStoreItem, setSelectedStoreItem] = useState<InventoryItem | null>(item);
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [showStorePicker, setShowStorePicker] = useState(false);

  // Form Fields
  const [orderCode, setOrderCode] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('ไฟฟ้า');
  const [customCategory, setCustomCategory] = useState('');
  const [qty, setQty] = useState<number | string>(1);
  const [unit, setUnit] = useState('ชิ้น');
  const [location, setLocation] = useState('Store FL.6');
  const [requestedBy, setRequestedBy] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'critical'>('normal');

  // Lock background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
      };
    }
  }, [isOpen]);

  // Generate unique PO Code and initialize form based on item or custom
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setOrderCode(`PO-${dateStr}-${randomSuffix}`);

      const userDisplay = currentUser?.name || currentUser?.username || 'ช่างเทคนิค';
      setRequestedBy(userDisplay);
      setNote('');

      // Always start on Store mode first
      setOrderMode('store');

      if (item) {
        // Pre-selected item from Store
        setSelectedStoreItem(item);
        setShowStorePicker(false);
        setItemCode(item.id || '');
        setItemName(item.name || '');
        setCategory(item.category || 'ไฟฟ้า');
        const suggestedQty = Math.max(1, (item.minStock * 2) - (item.qty > 0 ? item.qty : 0));
        setQty(suggestedQty);
        setUnit(item.unit || 'ชิ้น');
        setLocation(item.location || 'Store FL.6');
        setBrand((item as any).brand || '');
        setModel((item as any).model || '');
        setUrgency(item.status === 'out' || item.qty <= 0 ? 'urgent' : 'normal');
      } else {
        // Start on Store mode without pre-selected item: show store item search/picker immediately
        setSelectedStoreItem(null);
        setShowStorePicker(true);
        setItemCode('');
        setItemName('');
        setCategory('ไฟฟ้า');
        setCustomCategory('');
        setQty(1);
        setUnit('ชิ้น');
        setLocation('Store FL.6');
        setBrand('');
        setModel('');
        setSupplier('');
        setUrgency('normal');
      }
    }
  }, [isOpen, item, currentUser]);

  // Filter store items when searching in picker
  const filteredStoreItems = useMemo(() => {
    if (!storeSearchTerm.trim()) return items.slice(0, 10);
    const term = storeSearchTerm.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        i.id.toLowerCase().includes(term) ||
        (i.category && i.category.toLowerCase().includes(term))
    ).slice(0, 15);
  }, [items, storeSearchTerm]);

  const handleSelectStoreItem = (selected: InventoryItem) => {
    setSelectedStoreItem(selected);
    setShowStorePicker(false);
    setItemCode(selected.id || '');
    setItemName(selected.name || '');
    setCategory(selected.category || 'ไฟฟ้า');
    const suggestedQty = Math.max(1, (selected.minStock * 2) - (selected.qty > 0 ? selected.qty : 0));
    setQty(suggestedQty);
    setUnit(selected.unit || 'ชิ้น');
    setLocation(selected.location || 'Store FL.6');
    setBrand((selected as any).brand || '');
    setModel((selected as any).model || '');
    if (selected.status === 'out' || selected.qty <= 0) {
      setUrgency('urgent');
    }
  };

  const handleSwitchToCustom = () => {
    setOrderMode('custom');
    setSelectedStoreItem(null);
    if (!itemCode.startsWith('NEW-')) {
      const now = new Date();
      const dateStr = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0');
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setItemCode(`NEW-${dateStr}-${randomSuffix}`);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = Math.max(1, Number(qty) || 1);
    const finalCategory = category === 'อื่นๆ (ระบุเอง)' ? (customCategory.trim() || 'อื่นๆ') : category;

    await onSubmitOrder({
      id: orderCode.trim() || `PO-${Date.now()}`,
      itemId: itemCode.trim() || (selectedStoreItem ? selectedStoreItem.id : `NEW-${Date.now().toString().slice(-6)}`),
      itemName: itemName.trim() || (selectedStoreItem ? selectedStoreItem.name : 'สินค้าสั่งซื้อ'),
      category: finalCategory,
      qty: parsedQty,
      unit: unit.trim() || (selectedStoreItem ? selectedStoreItem.unit : 'ชิ้น'),
      currentQty: selectedStoreItem ? selectedStoreItem.qty : 0,
      minStock: selectedStoreItem ? selectedStoreItem.minStock : 5,
      location: location.trim() || (selectedStoreItem ? selectedStoreItem.location : 'Store FL.6'),
      requestedBy: currentUser?.name || currentUser?.username || requestedBy || 'ช่างเทคนิค',
      brand: brand.trim(),
      model: model.trim(),
      supplier: supplier.trim(),
      note: note.trim(),
      urgency,
      status: 'pending',
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto"
        >
          {/* Top Header Accent */}
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 w-full shrink-0" />

          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-400/30 shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>ขอสั่งซื้อสินค้า / สั่งของ</span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30">
                    Purchase Request
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ส่งคำขอสั่งซื้อเข้าสู่ระบบ Admin เพื่อรออนุมัติ และแจ้งเตือนผ่าน LINE ทันที
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher: Store vs Custom non-store item */}
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setOrderMode('store');
                if (!selectedStoreItem && items.length > 0) {
                  setShowStorePicker(true);
                }
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                orderMode === 'store'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>สินค้าใน Store</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchToCustom}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                orderMode === 'custom'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>✨ พิมพ์สั่งสินค้าใหม่ (ไม่มีใน Store)</span>
            </button>
          </div>

          {/* Context Banner */}
          {orderMode === 'store' && selectedStoreItem && (
            <div className="bg-amber-50/80 dark:bg-amber-950/30 px-4 sm:px-5 py-2 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <span className="text-slate-600 dark:text-slate-300 font-medium">สต็อกปัจจุบัน: </span>
                  <span className={`font-bold ${selectedStoreItem.qty <= 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {selectedStoreItem.qty} {selectedStoreItem.unit}
                  </span>
                  <span className="text-slate-400 ml-1.5">(เกณฑ์ขั้นต่ำ: {selectedStoreItem.minStock} {selectedStoreItem.unit})</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStorePicker(true)}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                เปลี่ยนสินค้า
              </button>
            </div>
          )}

          {orderMode === 'custom' && (
            <div className="bg-amber-50/90 dark:bg-amber-950/40 px-4 sm:px-5 py-2 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span><strong>โหมดสั่งสินค้าใหม่:</strong> สามารถพิมพ์ชื่ออะไหล่หรือสิ่งของที่ต้องการสั่งได้อย่างอิสระ เมื่อได้รับสินค้าแล้วจะถูกบันทึกเข้าคลังอัตโนมัติ</span>
            </div>
          )}

          {/* Store Items Picker Popup */}
          {showStorePicker && (
            <div className="p-3 bg-blue-50/90 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>ค้นหาอะไหล่ใน Store FL.6 เพื่อสั่งซื้อ:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowStorePicker(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  ปิดการค้นหา
                </button>
              </div>
              <input
                type="text"
                autoFocus
                placeholder="พิมพ์ชื่อสินค้าหรือรหัสอะไหล่..."
                value={storeSearchTerm}
                onChange={(e) => setStoreSearchTerm(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-slate-900 dark:text-white"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredStoreItems.map((si) => (
                  <div
                    key={si.id}
                    onClick={() => handleSelectStoreItem(si)}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{si.name}</div>
                      <div className="text-[10px] text-slate-400">{si.id} • หมวด: {si.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-700 dark:text-slate-300">คงเหลือ {si.qty} {si.unit}</div>
                      <div className="text-[10px] text-amber-500">เกณฑ์ {si.minStock} {si.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 pb-8 space-y-4">
              
              {/* Row 1: Item Code & Item Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    <span>รหัสสินค้า / SKU</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="w-full font-mono text-xs sm:text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    placeholder="รหัสสินค้า"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                    <span>ชื่อสินค้า / อะไหล่ที่สั่งซื้อ *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    placeholder={orderMode === 'custom' ? "พิมพ์ชื่อสินค้าใหม่ที่ต้องการสั่ง..." : "ชื่อสินค้าใน Store..."}
                  />
                </div>
              </div>

              {/* Row 2: Quantity & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">
                    จำนวนที่ต้องการสั่งซื้อ *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    หน่วยนับ *
                  </label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full text-sm font-semibold px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="เช่น ชิ้น, ม้วน, กล่อง"
                    />
                    {/* Common unit pills */}
                    <div className="flex flex-wrap gap-1">
                      {COMMON_UNITS.slice(0, 6).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUnit(u)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${
                            unit === u
                              ? 'bg-amber-500 text-white border-amber-500 font-bold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Category & Storage Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>หมวดหมู่สินค้า</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    {COMMON_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {category === 'อื่นๆ (ระบุเอง)' && (
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="ระบุชื่อหมวดหมู่..."
                      className="w-full text-xs mt-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>สถานที่จัดเก็บ</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="เช่น Store FL.6"
                  />
                </div>
              </div>

              {/* Row 4: Brand & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>ยี่ห้อ (Brand)</span>
                  </label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="เช่น Makita, Schneider, 3M..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>รุ่น / สเปค (Model)</span>
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="เช่น 2.5 sq.mm, DHP482..."
                  />
                </div>
              </div>

              {/* Row 5: Requester & Urgency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span>ผู้ขอสั่งซื้อ *</span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>ล็อคตามบัญชีผู้ใช้</span>
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={requestedBy}
                      className="w-full text-sm px-3 py-2 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold cursor-not-allowed select-none"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-500" />
                    <span>ระดับความเร่งด่วน</span>
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  >
                    <option value="normal">⚪ ปกติ (ตามรอบสั่งของ)</option>
                    <option value="urgent">⚡ ด่วน (ใช้งานสัปดาห์นี้)</option>
                    <option value="critical">🔥 ด่วนที่สุด (หมดสต็อก/กระทบงาน)</option>
                  </select>
                </div>
              </div>

              {/* Row 6: Note & Supplier */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>หมายเหตุ / ลิงก์ร้านค้า / เหตุผลการสั่งซื้อ</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="เช่น นำไปใช้งานกับระบบปั๊มน้ำชั้น 4, แนะนำซื้อจากร้านโฮมโปร..."
                />
              </div>

              {/* RBAC Workflow Notice */}
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                <span className="text-base leading-none">🛡️</span>
                <div className="leading-relaxed">
                  <strong>ขั้นตอนการสั่งซื้อ (RBAC):</strong> คำขอนี้จะมีสถานะเป็น 
                  <span className="font-bold text-amber-600 dark:text-amber-400"> "รอยืนยัน"</span> โดยอัตโนมัติ 
                  ผู้ดูแลระบบ (Admin) จะเป็นผู้ตรวจสอบและกดยืนยันสั่งซื้อ เมื่อสินค้ามาส่งถึงสโตร์ คุณสามารถกดรับเข้าคลังได้ทันที
                </div>
              </div>

              {/* In-Body Submit Button */}
              <div className="pt-2 pb-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm sm:text-base shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 border border-amber-400/40"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>กำลังส่งคำขอสั่งซื้อ & แจ้ง LINE...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5 stroke-[2.5]" />
                      <span>บันทึกและส่งคำขอสั่งซื้อ (Submit Order)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pinned Modal Footer */}
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between sm:justify-end gap-2.5 z-20">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังส่ง...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>ส่งคำขอสั่งซื้อ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
