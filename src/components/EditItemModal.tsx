import React, { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { X, Save, AlertCircle, Trash2, Package, MapPin, Layers, Hash, FileText } from 'lucide-react';

interface EditItemModalProps {
  isOpen: boolean;
  item: InventoryItem | null;
  categories: string[];
  onClose: () => void;
  onSave: (updatedItem: InventoryItem, oldId?: string) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  item,
  categories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [unit, setUnit] = useState('ชิ้น');
  const [qty, setQty] = useState<number | ''>(0);
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [ordered, setOrdered] = useState('');
  const [orderedDate, setOrderedDate] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setId(item.id || '');
      setName(item.name || '');
      setCategory(item.category || (categories[0] || 'เคมี'));
      setCustomCategory('');
      setUnit(item.unit || 'ชิ้น');
      setQty(item.qty ?? 0);
      setMinStock(item.minStock ?? 5);
      setLocation(item.location || 'Store FL.6');
      setNote(item.note || '');
      setOrdered(item.ordered || '');
      setOrderedDate(item.orderedDate || '');
      setError('');
      setShowDeleteConfirm(false);
    }
  }, [isOpen, item, categories]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      setError('กรุณาระบุรหัสสินค้า (Item Code)');
      return;
    }
    if (!name.trim()) {
      setError('กรุณาระบุชื่อสินค้า');
      return;
    }

    const numQty = typeof qty === 'number' ? qty : 0;
    const numMinStock = typeof minStock === 'number' ? minStock : 0;

    let finalCategory = category;
    if (category === '__custom__' && customCategory.trim()) {
      finalCategory = customCategory.trim();
    }

    let status: 'normal' | 'low' | 'out' = 'normal';
    if (numQty <= 0) {
      status = 'out';
    } else if (numQty <= numMinStock) {
      status = 'low';
    }

    let outOfStockDate = item.outOfStockDate;
    if (status === 'out' && !outOfStockDate) {
      outOfStockDate = new Date().toISOString();
    } else if (status !== 'out') {
      outOfStockDate = undefined;
    }

    const updatedItem: InventoryItem = {
      ...item,
      id: id.trim(),
      name: name.trim(),
      category: finalCategory,
      unit: unit.trim() || 'ชิ้น',
      qty: numQty,
      minStock: numMinStock,
      location: location.trim() || 'Store FL.6',
      note: note.trim(),
      ordered: ordered.trim(),
      orderedDate: orderedDate.trim(),
      status,
      outOfStockDate,
    };

    try {
      setIsSaving(true);
      setError('');
      await onSave(updatedItem, item.id !== id.trim() ? item.id : undefined);
      onClose();
    } catch (err: any) {
      console.error('Save item error:', err);
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setIsSaving(true);
      await onDelete(item.id);
      onClose();
    } catch (err: any) {
      console.error('Delete item error:', err);
      setError('เกิดข้อผิดพลาดในการลบสินค้า');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border-0 sm:border border-slate-200/80 dark:border-slate-800 animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200 transition-colors">
        
        {/* Modal Header */}
        <div className="px-4 pt-safe-header pb-3 sm:py-4 bg-slate-50 dark:bg-slate-850 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">แก้ไขรายละเอียดสินค้า (Admin)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">ปรับปรุงข้อมูลสินค้าและสต็อกคงเหลือ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-700 dark:text-red-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Code (ID) & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                รหัสสินค้า (Item Code) *
              </label>
              <input
                type="text"
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
                placeholder="เช่น A000000166"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                หมวดหมู่สินค้า *
              </label>
              <select
                value={categories.includes(category) ? category : '__custom__'}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCategory('__custom__');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__custom__">+ หมวดหมู่อื่นๆ (ระบุเอง)</option>
              </select>
              {category === '__custom__' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="ระบุชื่อหมวดหมู่ใหม่..."
                  className="w-full mt-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
                />
              )}
            </div>
          </div>

          {/* Item Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ชื่อสินค้า (Item Name) *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              placeholder="ระบุชื่อสินค้า..."
            />
          </div>

          {/* Stock Quantity, Unit, Min Stock */}
          <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">การจัดการสต็อกและหน่วยนับ</h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">จำนวนคงเหลือ</label>
                <input
                  type="number"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-extrabold text-blue-700 dark:text-blue-400 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">หน่วยนับ</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="เช่น ชิ้น, กล่อง"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">เกณฑ์ขั้นต่ำ</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-amber-700 dark:text-amber-400 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              ตำแหน่งจัดเก็บ (Location)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              placeholder="เช่น Store FL.6 / ตู้ A ชั้น 2"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              หมายเหตุ (Note)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none resize-none"
              placeholder="หมายเหตุเพิ่มเติมสำหรับสินค้านี้..."
            />
          </div>

          {/* Ordered / OrderedDate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">สถานะสั่งซื้อล่าสุด</label>
              <input
                type="text"
                value={ordered}
                onChange={(e) => setOrdered(e.target.value)}
                placeholder="เช่น 10 กล่อง (PR#1234)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">วันที่สั่งซื้อล่าสุด</label>
              <input
                type="text"
                value={orderedDate}
                onChange={(e) => setOrderedDate(e.target.value)}
                placeholder="เช่น 10/08/2026"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-2 shrink-0 pb-[max(16px,calc(env(safe-area-inset-bottom,16px)+12px))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-none">
          {onDelete && (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">ลบสินค้า?</span>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleDelete}
                    className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 cursor-pointer"
                  >
                    ยืนยัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="ลบสินค้านี้ออกจากระบบ"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">ลบสินค้า</span>
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
