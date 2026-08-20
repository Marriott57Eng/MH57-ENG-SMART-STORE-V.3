import React, { useState, useEffect } from 'react';
import { RequisitionRecord, InventoryItem } from '../types';
import { formatRecordTimestamp } from '../utils/dateUtils';
import { 
  X, Save, AlertCircle, Clock, Calendar, MapPin, 
  ArrowDownRight, ArrowUpRight, FileText, User, Package, Trash2
} from 'lucide-react';

interface EditRequisitionModalProps {
  isOpen: boolean;
  record: RequisitionRecord | null;
  items: InventoryItem[];
  onClose: () => void;
  onSave: (updatedRecord: RequisitionRecord) => Promise<void>;
  onDelete?: (recordId: string) => Promise<void>;
}

export const EditRequisitionModal: React.FC<EditRequisitionModalProps> = ({
  isOpen,
  record,
  items,
  onClose,
  onSave,
  onDelete,
}) => {
  const [type, setType] = useState<'out' | 'in'>('out');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('ชิ้น');
  const [qty, setQty] = useState<number | ''>(1);
  const [requestedBy, setRequestedBy] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [note, setNote] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && record) {
      setType(record.type || 'out');
      setSelectedItemId(record.itemId || '');
      setItemName(record.itemName || '');
      setCategory(record.category || '');
      setUnit(record.unit || 'ชิ้น');
      setQty(record.qty || 1);
      setRequestedBy(record.requestedBy || '');
      setPurpose(record.purpose || '');
      setNote(record.note || '');
      setError('');
      setShowDeleteConfirm(false);

      // Parse date and time
      const pad = (n: number) => n.toString().padStart(2, '0');
      if (record.isoDate) {
        try {
          const d = new Date(record.isoDate);
          if (!isNaN(d.getTime())) {
            setDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            setTimeStr(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          }
        } catch {
          const now = new Date();
          setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
          setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
        }
      } else {
        const now = new Date();
        setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
        setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
      }
    }
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = items.find((i) => i.id === itemId);
    if (item) {
      setItemName(item.name);
      setCategory(item.category);
      setUnit(item.unit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedBy.trim()) {
      setError('กรุณาระบุชื่อผู้ทำรายการ');
      return;
    }
    if (!itemName.trim()) {
      setError('กรุณาระบุชื่อสินค้า');
      return;
    }

    const numQty = typeof qty === 'number' ? qty : 1;
    if (numQty <= 0) {
      setError('จำนวนต้องมากกว่า 0');
      return;
    }

    // Format human readable Thai timestamp
    let formattedTimestamp = '';
    let isoDate = record.isoDate || new Date().toISOString();
    try {
      const [year, month, day] = dateStr.split('-');
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const thaiYear = parseInt(year, 10) > 2500 ? parseInt(year, 10) : parseInt(year, 10) + 543;
      const monthName = thaiMonths[parseInt(month, 10) - 1] || month;
      formattedTimestamp = `${parseInt(day, 10)} ${monthName} ${thaiYear}, ${timeStr} น.`;

      const selectedDateTime = new Date(`${dateStr}T${timeStr}:00`);
      if (!isNaN(selectedDateTime.getTime())) {
        isoDate = selectedDateTime.toISOString();
      }
    } catch {
      formattedTimestamp = `${dateStr} ${timeStr}`;
    }

    const updatedRecord: RequisitionRecord = {
      ...record,
      type,
      itemId: selectedItemId.trim() || record.itemId,
      itemName: itemName.trim(),
      category: category.trim() || record.category,
      qty: numQty,
      unit: unit.trim() || record.unit,
      requestedBy: requestedBy.trim(),
      purpose: purpose.trim(),
      timestamp: formattedTimestamp || record.timestamp,
      isoDate,
      note: note.trim(),
    };

    try {
      setIsSaving(true);
      setError('');
      await onSave(updatedRecord);
      onClose();
    } catch (err: any) {
      console.error('Save requisition error:', err);
      setError(err?.message || 'เกิดข้อผิดพลาดในการแก้ไขประวัติ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setIsSaving(true);
      await onDelete(record.id);
      onClose();
    } catch (err: any) {
      console.error('Delete requisition error:', err);
      setError('เกิดข้อผิดพลาดในการลบประวัติ');
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
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">แก้ไขประวัติการเบิก / รับเข้า (Admin)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">รหัสรายการ: {record.id}</p>
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

          {/* Type Toggle: Out vs In */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ประเภทรายการ</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('out')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  type === 'out'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                เบิกออก (Withdrawn)
              </button>
              <button
                type="button"
                onClick={() => setType('in')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  type === 'in'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                รับเข้า (Stock In)
              </button>
            </div>
          </div>

          {/* Item Selector / Details */}
          <div className="space-y-2 bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              เลือกสินค้าจากคลัง หรือแก้ไขข้อมูลสินค้าในบันทึก
            </label>

            {items.length > 0 && (
              <select
                value={selectedItemId}
                onChange={(e) => handleItemSelect(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:border-blue-500 outline-none"
              >
                <option value="">-- เลือกสินค้าจากฐานข้อมูล หรือกรอกเองด้านล่าง --</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    [{i.id}] {i.name} ({i.category})
                  </option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">รหัสสินค้า (Item ID)</label>
                <input
                  type="text"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                  placeholder="เช่น A000000166"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">หมวดหมู่ (Category)</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                  placeholder="เช่น เคมี, ไฟฟ้า"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">ชื่อสินค้า (Item Name)</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                placeholder="ระบุชื่อสินค้า..."
              />
            </div>
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">จำนวนที่ทำรายการ *</label>
              <input
                type="number"
                min="1"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-extrabold text-blue-700 dark:text-blue-400 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">หน่วยนับ</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
                placeholder="เช่น ชิ้น, กล่อง"
              />
            </div>
          </div>

          {/* Requested By (ผู้ทำรายการ) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              {type === 'in' ? 'ผู้รับเข้าสินค้า' : 'ผู้เบิกสินค้า'} *
            </label>
            <input
              type="text"
              required
              value={requestedBy}
              onChange={(e) => setRequestedBy(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              placeholder="ระบุชื่อผู้ทำรายการ..."
            />
          </div>

          {/* Purpose / Location */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {type === 'in' ? 'แหล่งที่มา / เหตุผลการรับเข้า' : 'งานที่นำไปใช้ / แผนก / หน้างาน'} *
            </label>
            <input
              type="text"
              required
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              placeholder="เช่น ซ่อมแซมระบบน้ำ FL.3 / จัดซื้อใหม่จากซัพพลายเออร์"
            />
          </div>

          {/* Date and Time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                วันที่
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                เวลา
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              หมายเหตุเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 outline-none resize-none"
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-2 shrink-0 pb-[max(16px,calc(env(safe-area-inset-bottom,16px)+12px))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] dark:shadow-none">
          {onDelete && (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">ลบประวัติ?</span>
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
                  title="ลบประวัตินี้ออกจากระบบ"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">ลบประวัติ</span>
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

