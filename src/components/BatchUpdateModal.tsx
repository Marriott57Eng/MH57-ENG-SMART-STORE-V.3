import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  SlidersHorizontal, 
  X, 
  MapPin, 
  AlertTriangle, 
  Package, 
  Check, 
  ArrowRight, 
  Loader2, 
  Sparkles,
  Layers,
  Search,
  Plus,
  Minus,
  RefreshCw,
  Info,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { InventoryItem } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export interface BatchUpdatePayload {
  updateLocation: boolean;
  newLocation: string;
  updateMinStock: boolean;
  minStockMode: 'uniform' | 'delta';
  minStockValue: number;
}

export interface BatchUpdateModalProps {
  isOpen: boolean;
  selectedItems: InventoryItem[];
  allItems?: InventoryItem[];
  allLocations?: string[];
  onClose: () => void;
  onApply: (payload: BatchUpdatePayload) => Promise<void>;
  onRemoveItem?: (itemId: string) => void;
  onToggleItemSelect?: (itemId: string) => void;
  onSelectAll?: () => void;
}

export const BatchUpdateModal: React.FC<BatchUpdateModalProps> = ({
  isOpen,
  selectedItems,
  allItems = [],
  allLocations = [],
  onClose,
  onApply,
  onRemoveItem,
  onToggleItemSelect,
  onSelectAll,
}) => {
  useScrollLock(isOpen);

  // Modification toggles
  const [updateLocation, setUpdateLocation] = useState(false);
  const [newLocation, setNewLocation] = useState('Store FL.6');
  
  const [updateMinStock, setUpdateMinStock] = useState(false);
  const [minStockMode, setMinStockMode] = useState<'uniform' | 'delta'>('uniform');
  const [minStockValue, setMinStockValue] = useState<number>(5);

  // Internal item picker open state
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemPickerSearch, setItemPickerSearch] = useState('');

  // Preview filtering & search
  const [previewSearch, setPreviewSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-populate initial location suggestion from first item if available
  useEffect(() => {
    if (isOpen && selectedItems.length > 0) {
      const firstLoc = selectedItems[0]?.location?.trim();
      if (firstLoc) {
        setNewLocation(firstLoc);
      }
      const firstMin = selectedItems[0]?.minStock;
      if (typeof firstMin === 'number' && firstMin >= 0) {
        setMinStockValue(firstMin);
      }
      setErrorMsg('');
    }
  }, [isOpen, selectedItems]);

  // Unique suggestions from current items & passed locations
  const locationSuggestions = useMemo(() => {
    const locSet = new Set<string>();
    locSet.add('Store FL.6');
    allLocations.forEach(loc => loc && locSet.add(loc.trim()));
    selectedItems.forEach(item => item.location && locSet.add(item.location.trim()));
    return Array.from(locSet).slice(0, 8);
  }, [allLocations, selectedItems]);

  // Common minStock presets
  const minStockPresets = [0, 2, 3, 5, 8, 10, 15, 20, 30, 50];

  // Calculate live preview for all selected items
  const previewItems = useMemo(() => {
    return selectedItems.map(item => {
      // Calculate target location
      const targetLocation = updateLocation ? (newLocation.trim() || 'Store FL.6') : (item.location || 'Store FL.6');
      const isLocationChanged = updateLocation && targetLocation !== (item.location || 'Store FL.6');

      // Calculate target minStock
      let targetMinStock = item.minStock ?? 5;
      if (updateMinStock) {
        if (minStockMode === 'uniform') {
          targetMinStock = Math.max(0, Number(minStockValue) || 0);
        } else {
          targetMinStock = Math.max(0, (item.minStock ?? 5) + Number(minStockValue));
        }
      }
      const isMinStockChanged = updateMinStock && targetMinStock !== (item.minStock ?? 5);

      // Calculate new predicted status
      let predictedStatus: 'normal' | 'low' | 'out' = 'normal';
      if (item.qty <= 0) {
        predictedStatus = 'out';
      } else if (item.qty <= targetMinStock) {
        predictedStatus = 'low';
      } else {
        predictedStatus = 'normal';
      }

      return {
        item,
        targetLocation,
        isLocationChanged,
        targetMinStock,
        isMinStockChanged,
        predictedStatus,
      };
    });
  }, [selectedItems, updateLocation, newLocation, updateMinStock, minStockMode, minStockValue]);

  // Filtered preview items for table search
  const filteredPreview = useMemo(() => {
    if (!previewSearch.trim()) return previewItems;
    const q = previewSearch.toLowerCase().trim();
    return previewItems.filter(({ item }) => 
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.location && item.location.toLowerCase().includes(q))
    );
  }, [previewItems, previewSearch]);

  // Statistics of changes
  const changedLocationsCount = useMemo(() => {
    return previewItems.filter(p => p.isLocationChanged).length;
  }, [previewItems]);

  const changedMinStockCount = useMemo(() => {
    return previewItems.filter(p => p.isMinStockChanged).length;
  }, [previewItems]);

  const newLowStockCount = useMemo(() => {
    return previewItems.filter(p => p.predictedStatus === 'low' && p.item.status !== 'low').length;
  }, [previewItems]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateLocation && !updateMinStock) {
      setErrorMsg('กรุณาเลือกอย่างน้อย 1 รายการที่ต้องการแก้ไข (สถานที่เก็บ หรือ จุดสั่งซื้อขั้นต่ำ)');
      return;
    }

    if (selectedItems.length === 0) {
      setErrorMsg('ไม่มีรายการสินค้าที่เลือกสำหรับแก้ไข');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await onApply({
        updateLocation,
        newLocation: newLocation.trim() || 'Store FL.6',
        updateMinStock,
        minStockMode,
        minStockValue: Number(minStockValue) || 0,
      });
    } catch (err: any) {
      console.error('Batch update failed:', err);
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl liquid-glass-modal rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 p-5 sm:p-7 text-slate-800 dark:text-slate-100 my-auto animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  แก้ไขสินค้าแบบกลุ่ม (Batch Update)
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-400/30">
                  ADMIN ONLY
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-xs">
                  {selectedItems.length} รายการที่เลือก
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ปรับปรุงสถานที่เก็บ (Location) และจุดสั่งซื้อขั้นต่ำ (Min Stock) พร้อมกันหลายรายการในครั้งเดียว
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Selected Items Summary Strip */}
          <div className="p-3 sm:p-4 rounded-2xl liquid-glass-card space-y-2">
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-indigo-500" />
                <span>รายการสินค้าที่เลือก ({selectedItems.length} รายการ):</span>
              </span>
              
              <div className="flex items-center gap-2">
                {allItems.length > 0 && onSelectAll && (
                  <button
                    type="button"
                    onClick={onSelectAll}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    เลือกทั้งหมด ({allItems.length})
                  </button>
                )}
                {allItems.length > 0 && onToggleItemSelect && (
                  <button
                    type="button"
                    onClick={() => setShowItemPicker(!showItemPicker)}
                    className="px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {showItemPicker ? 'ซ่อนการค้นหาสินค้า' : '+ เลือกสินค้าเพิ่ม'}
                  </button>
                )}
              </div>
            </div>

            {/* In-Modal Search and Picker */}
            {showItemPicker && allItems.length > 0 && onToggleItemSelect && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={itemPickerSearch}
                    onChange={(e) => setItemPickerSearch(e.target.value)}
                    placeholder="พิมพ์ชื่อสินค้า หรือรหัสเพื่อค้นหาและคลิกเลือก..."
                    className="w-full liquid-glass-input rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 border border-slate-300 dark:border-slate-600"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {allItems
                    .filter(i => {
                      if (!itemPickerSearch.trim()) return true;
                      const q = itemPickerSearch.toLowerCase().trim();
                      return i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
                    })
                    .slice(0, 50)
                    .map(item => {
                      const isSelected = selectedItems.some(si => si.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onToggleItemSelect(item.id)}
                          className={`w-full p-1.5 rounded-lg text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'hover:bg-slate-200/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className={`font-mono text-[10px] font-bold ${isSelected ? 'text-indigo-200' : 'text-blue-600 dark:text-blue-400'}`}>
                              {item.id}
                            </span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                            <span>{item.qty} {item.unit}</span>
                            <span className={`px-1.5 py-0.2 rounded font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                              {isSelected ? '✓ เลือกแล้ว' : '+ เลือก'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {selectedItems.length === 0 ? (
              <div className="p-3 text-center rounded-xl bg-amber-500/10 border border-amber-400/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                ⚠️ ยังไม่มีรายการสินค้าที่เลือก — โปรดกดปุ่ม "+ เลือกสินค้าเพิ่ม" ด้านบน หรือติ๊กเลือกรายการในหน้าคลังสินค้า
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {selectedItems.map((item) => (
                  <div
                    key={item.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0 shadow-2xs group"
                  >
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[10px]">
                      {item.id}
                    </span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 max-w-[130px] truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                      คงเหลือ {item.qty}
                    </span>
                    {onRemoveItem && selectedItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-0.5 rounded-full transition-colors cursor-pointer"
                        title="นำออกจากชุดนี้"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Two Modification Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Location Batch Update */}
            <div 
              className={`p-4 sm:p-5 rounded-2xl transition-all border ${
                updateLocation 
                  ? 'liquid-glass border-2 border-emerald-500 shadow-md shadow-emerald-500/10' 
                  : 'liquid-glass-card opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateLocation}
                    onChange={(e) => setUpdateLocation(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      <span>แก้ไขสถานที่เก็บ (Location)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ย้าย/ระบุตำแหน่งจัดเก็บใหม่พร้อมกัน
                    </div>
                  </div>
                </label>

                {updateLocation && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30">
                    เปิดใช้งาน
                  </span>
                )}
              </div>

              {updateLocation && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 pt-2 border-t border-emerald-500/20"
                >
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ระบุสถานที่เก็บใหม่:
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        placeholder="เช่น Store FL.6, Rack A-01, Shelf 3..."
                        className="w-full liquid-glass-input rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 border border-slate-300 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* Suggestion Pills */}
                  {locationSuggestions.length > 0 && (
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1 font-medium">
                        สถานที่เก็บที่ใช้บ่อยในระบบ:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {locationSuggestions.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => setNewLocation(loc)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                              newLocation === loc
                                ? 'bg-emerald-600 text-white font-bold'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15'
                            }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>จะเปลี่ยนสถานที่เก็บของ {selectedItems.length} รายการเป็น "{newLocation || 'Store FL.6'}"</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Card 2: Min Stock Batch Update */}
            <div 
              className={`p-4 sm:p-5 rounded-2xl transition-all border ${
                updateMinStock 
                  ? 'liquid-glass border-2 border-indigo-500 shadow-md shadow-indigo-500/10' 
                  : 'liquid-glass-card opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateMinStock}
                    onChange={(e) => setUpdateMinStock(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-indigo-500" />
                      <span>แก้ไขจุดสั่งซื้อขั้นต่ำ (Min Stock)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ปรับระดับจำนวนเตือนสินค้าใกล้หมด
                    </div>
                  </div>
                </label>

                {updateMinStock && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30">
                    เปิดใช้งาน
                  </span>
                )}
              </div>

              {updateMinStock && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 pt-2 border-t border-indigo-500/20"
                >
                  {/* Mode switch (Uniform vs Delta) */}
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setMinStockMode('uniform');
                        setMinStockValue(5);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        minStockMode === 'uniform'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      กำหนดค่าเดียวกันทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMinStockMode('delta');
                        setMinStockValue(1);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        minStockMode === 'delta'
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      ปรับเพิ่ม/ลด (+/- Delta)
                    </button>
                  </div>

                  {/* Stepper Input */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {minStockMode === 'uniform' 
                        ? 'ค่า Min Stock ใหม่สำหรับทุกรายการ:' 
                        : 'จำนวนที่ต้องการปรับ (+ หรือ -):'}
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMinStockValue(prev => minStockMode === 'uniform' ? Math.max(0, prev - 1) : prev - 1)}
                        className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer font-bold"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div className="relative flex-1">
                        <input
                          type="number"
                          value={minStockValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setMinStockValue(isNaN(val) ? 0 : val);
                          }}
                          className="w-full liquid-glass-input rounded-xl text-center py-2 font-mono font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 border border-slate-300 dark:border-slate-700"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                          หน่วย
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMinStockValue(prev => prev + 1)}
                        className="w-9 h-9 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer font-bold"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Presets */}
                  {minStockMode === 'uniform' && (
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1 font-medium">
                        ค่ายอดนิยมที่ตั้งบ่อย:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {minStockPresets.map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setMinStockValue(val)}
                            className={`w-7 h-6 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              minStockValue === val
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/15'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {minStockMode === 'delta' && (
                    <div>
                      <div className="text-[10px] text-slate-400 mb-1 font-medium">
                        ทางลัดการปรับเพิ่ม/ลด:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[-5, -2, -1, 1, 2, 5, 10].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setMinStockValue(d)}
                            className={`px-2 h-6 rounded-md text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              minStockValue === d
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-500/15'
                            }`}
                          >
                            {d > 0 ? `+${d}` : d}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {minStockMode === 'uniform' 
                        ? `จะปรับค่า Min Stock ของทั้ง ${selectedItems.length} รายการเป็น ${minStockValue} ชิ้น` 
                        : `จะปรับ Min Stock ${minStockValue >= 0 ? `+${minStockValue}` : minStockValue} ชิ้น จากค่าเดิมของแต่ละรายการ`}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Interactive Live Preview Table */}
          <div className="p-4 rounded-2xl liquid-glass-card space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>ตารางเปรียบเทียบผลลัพธ์ก่อน-หลังบันทึก (Live Preview)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ตรวจสอบความถูกต้องก่อนกดบันทึกข้อมูลเข้าฐานข้อมูล Firestore
                </p>
              </div>

              {/* Preview Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  placeholder="ค้นหาในตารางตัวอย่าง..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl liquid-glass-input border border-slate-300 dark:border-slate-700 outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>

            {/* Impact Metric Chips */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                changedLocationsCount > 0 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <MapPin className="w-3.5 h-3.5" />
                <span>เปลี่ยนสถานที่: {changedLocationsCount} รายการ</span>
              </span>

              <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                changedMinStockCount > 0 ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>เปลี่ยน Min Stock: {changedMinStockCount} รายการ</span>
              </span>

              {newLowStockCount > 0 && (
                <span className="px-2.5 py-1 rounded-xl font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>จะกลายเป็นสินค้าใกล้หมด: {newLowStockCount} รายการ</span>
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/90 dark:bg-slate-800/90 sticky top-0 z-10 text-[11px] font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2.5 pl-3">สินค้า</th>
                    <th className="p-2.5 text-center">คงเหลือ</th>
                    <th className="p-2.5">สถานที่เก็บ (เดิม ➔ ใหม่)</th>
                    <th className="p-2.5 text-center">Min Stock (เดิม ➔ ใหม่)</th>
                    <th className="p-2.5 text-center">สถานะใหม่</th>
                    {onRemoveItem && <th className="p-2.5 pr-3 text-center">จัดการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400">
                        ไม่พบรายการที่ตรงกับ "{previewSearch}"
                      </td>
                    </tr>
                  ) : (
                    filteredPreview.map(({ item, targetLocation, isLocationChanged, targetMinStock, isMinStockChanged, predictedStatus }) => (
                      <tr key={item.id} className="hover:bg-slate-500/5 transition-colors">
                        <td className="p-2.5 pl-3">
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.id} • {item.category}
                          </div>
                        </td>

                        <td className="p-2.5 text-center">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.qty}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">
                            {item.unit}
                          </span>
                        </td>

                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-slate-400 line-through">
                              {item.location || '-'}
                            </span>
                            {isLocationChanged ? (
                              <>
                                <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
                                  {targetLocation}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                                {targetLocation}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-mono">
                              {item.minStock ?? 5}
                            </span>
                            {isMinStockChanged ? (
                              <>
                                <ArrowRight className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px]">
                                  {targetMinStock}
                                </span>
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">
                                (คงเดิม)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-2.5 text-center">
                          {predictedStatus === 'out' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                              หมดสต็อก
                            </span>
                          ) : predictedStatus === 'low' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              ใกล้หมด
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              ปกติ
                            </span>
                          )}
                        </td>

                        {onRemoveItem && (
                          <td className="p-2.5 pr-3 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="ไม่แก้ไขรายการนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 w-full sm:w-auto">
            <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
            <span>
              {!updateLocation && !updateMinStock
                ? 'โปรดเลือกข้อมูลที่ต้องการแก้ไข (สถานที่เก็บ หรือ จุดสั่งซื้อ)'
                : `พร้อมปรับปรุง: ${updateLocation ? `สถานที่เก็บ "${newLocation || 'Store FL.6'}"` : ''}${updateLocation && updateMinStock ? ' และ ' : ''}${updateMinStock ? `Min Stock (${minStockMode === 'uniform' ? minStockValue : `${minStockValue >= 0 ? '+' : ''}${minStockValue}`})` : ''} สำหรับ ${selectedItems.length} รายการ`}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || (!updateLocation && !updateMinStock) || selectedItems.length === 0}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 active:from-purple-800 active:to-blue-800 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-transform duration-75 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 select-none touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกข้อมูล...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>บันทึกการแก้ไข ({selectedItems.length} รายการ)</span>
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
