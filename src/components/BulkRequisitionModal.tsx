import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  X, User, Calendar, Clock, MapPin, Check, 
  AlertCircle, FileText, Layers, Trash2, Plus, Minus,
  Package, Sparkles, CheckCircle2, ArrowRight
} from 'lucide-react';

export interface BulkRequisitionSubmitData {
  items: Array<{
    item: InventoryItem;
    qty: number;
  }>;
  requestedBy: string;
  purpose: string;
  dateStr: string;
  timeStr: string;
  note: string;
}

interface BulkRequisitionModalProps {
  isOpen: boolean;
  selectedItems: InventoryItem[];
  currentUser: { name: string; username: string };
  onClose: () => void;
  onRemoveItem: (itemId: string) => void;
  onSubmit: (data: BulkRequisitionSubmitData) => Promise<void>;
}

export const BulkRequisitionModal: React.FC<BulkRequisitionModalProps> = ({
  isOpen,
  selectedItems,
  currentUser,
  onClose,
  onRemoveItem,
  onSubmit,
}) => {
  useScrollLock(isOpen);

  // Map of itemId -> requested quantity
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [requestedBy, setRequestedBy] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize and reset fields
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setDateStr(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
      setTimeStr(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
      setError('');
      setIsSubmitting(false);
      setRequestedBy(currentUser.name || 'ผู้ใช้งาน');
      setPurpose('งานซ่อมบำรุงประจำวัน');

      // Initialize quantities: default to 1 (or 0 if out of stock)
      const initialQtys: Record<string, number> = {};
      selectedItems.forEach(item => {
        initialQtys[item.id] = quantities[item.id] !== undefined 
          ? Math.min(quantities[item.id], Math.max(1, item.qty))
          : (item.qty > 0 ? 1 : 0);
      });
      setQuantities(initialQtys);
    }
  }, [isOpen, selectedItems, currentUser]);

  if (!isOpen) return null;

  const handleQtyChange = (itemId: string, newQty: number, maxQty: number) => {
    const clamped = Math.max(1, Math.min(newQty, maxQty || 1));
    setQuantities(prev => ({
      ...prev,
      [itemId]: clamped
    }));
    setError('');
  };

  const handleSetMax = (itemId: string, maxQty: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, maxQty)
    }));
    setError('');
  };

  const totalItemCount = selectedItems.length;
  const totalUnits = selectedItems.reduce((sum, item) => {
    const q = quantities[item.id] || 0;
    return sum + (item.qty > 0 ? q : 0);
  }, 0);

  const outOfStockItems = selectedItems.filter(i => i.qty <= 0);
  const validItems = selectedItems.filter(i => i.qty > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!requestedBy.trim()) {
      setError('กรุณาระบุชื่อผู้เบิก');
      return;
    }

    if (!purpose.trim()) {
      setError('กรุณาระบุงานที่นำไปใช้หรือวัตถุประสงค์');
      return;
    }

    if (validItems.length === 0) {
      setError('ไม่มีรายการสินค้าที่พร้อมเบิกได้ (สินค้าหมดสต็อกทั้งหมด)');
      return;
    }

    // Validate quantities
    const itemsToSubmit: Array<{ item: InventoryItem; qty: number }> = [];
    for (const item of validItems) {
      const q = quantities[item.id] || 1;
      if (q <= 0) {
        setError(`จำนวนการเบิกของ ${item.name} ต้องมากกว่า 0`);
        return;
      }
      if (q > item.qty) {
        setError(`จำนวนเบิกของ ${item.name} (${q}) เกินจำนวนคงเหลือ (${item.qty})`);
        return;
      }
      itemsToSubmit.push({ item, qty: q });
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        items: itemsToSubmit,
        requestedBy: requestedBy.trim(),
        purpose: purpose.trim(),
        dateStr,
        timeStr,
        note: note.trim(),
      });
    } catch (err: any) {
      setError(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
      setIsSubmitting(false);
    }
  };

  const quickPurposes = [
    'งานซ่อมบำรุงประจำวัน',
    'ซ่อมระบบไฟฟ้า FL.6',
    'งานประปา/สุขภัณฑ์',
    'งานแอร์และปรับอากาศ',
    'งานบริการเร่งด่วน',
    'เบิกสำรองใช้งาน',
  ];

  const modalContent = (
    <div 
      id="bulk-requisition-modal-overlay"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 overflow-y-auto transform-gpu overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ willChange: 'transform, opacity' }}
        className="relative w-full max-w-2xl max-h-[92dvh] landscape:max-h-[94dvh] my-auto flex flex-col bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transform-gpu"
      >
        {/* Specular top rim light */}
        <div className="absolute top-0 left-8 right-8 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  เบิกสินค้าพร้อมกันหลายรายการ
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {totalItemCount} รายการ
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                รวมยอดเบิกทั้งหมด {totalUnits} ชิ้น ในธุรกรรมเดียว
              </p>
            </div>
          </div>

          <button
            id="close-bulk-requisition-btn"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div className="font-medium">{error}</div>
            </div>
          )}

          {outOfStockItems.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 flex items-center gap-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>มี {outOfStockItems.length} รายการที่สินค้าหมดสต็อกแล้ว ระบบจะข้ามรายการที่หมดสต็อกอัตโนมัติ</span>
            </div>
          )}

          {/* Section 1: Selected Items List with Quantities */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                รายการสินค้าที่จะเบิก ({selectedItems.length})
              </label>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                ปรับจำนวนแต่ละรายการด้านล่าง
              </span>
            </div>

            {selectedItems.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                ยังไม่ได้เลือกสินค้า กรุณาเลือกสินค้าจากรายการสต็อก
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {selectedItems.map((item) => {
                  const isOutOfStock = item.qty <= 0;
                  const itemQty = quantities[item.id] || (isOutOfStock ? 0 : 1);
                  const isOver = itemQty > item.qty;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${
                        isOutOfStock
                          ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-60'
                          : isOver
                          ? 'bg-red-50/50 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                          : 'bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              {item.id}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                              {item.category}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {item.location || 'Store FL.6'}
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug truncate">
                            {item.name}
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-slate-500 dark:text-slate-400">
                              คงเหลือในคลัง:{' '}
                              <strong className={`font-bold ${isOutOfStock ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                {item.qty} {item.unit}
                              </strong>
                            </span>
                            {isOutOfStock && (
                              <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold">
                                หมดสต็อก
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Stepper & Controls */}
                        {!isOutOfStock ? (
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-center">
                            {/* Fast Presets */}
                            <div className="hidden xs:flex items-center gap-1">
                              {item.qty >= 5 && (
                                <button
                                  type="button"
                                  onClick={() => handleQtyChange(item.id, 5, item.qty)}
                                  className="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 transition-colors font-medium"
                                >
                                  5
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSetMax(item.id, item.qty)}
                                className="px-2 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors font-bold"
                              >
                                ทั้งหมด ({item.qty})
                              </button>
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item.id, itemQty - 1, item.qty)}
                                disabled={itemQty <= 1}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="number"
                                min="1"
                                max={item.qty}
                                value={itemQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  handleQtyChange(item.id, isNaN(val) ? 1 : val, item.qty);
                                }}
                                className="w-12 text-center font-bold text-slate-900 dark:text-white bg-transparent border-none focus:outline-hidden text-sm sm:text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />

                              <button
                                type="button"
                                onClick={() => handleQtyChange(item.id, itemQty + 1, item.qty)}
                                disabled={itemQty >= item.qty}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="text-xs font-semibold text-slate-500 w-8 text-left">
                              {item.unit}
                            </span>

                            {/* Remove button */}
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="นำออกจากรายการเบิก"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="text-xs text-red-500 hover:underline flex items-center gap-1 self-end sm:self-center"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            ลบออก
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Common Requisition Information */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ข้อมูลการเบิก (ใช้ร่วมกันทุกรายการ)
            </h3>

            {/* Requester & Purpose */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  ชื่อผู้เบิก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  placeholder="เช่น สมชาย ช่างซ่อมบำรุง"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  งานที่นำไปใช้ / วัตถุประสงค์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="เช่น ซ่อมระบบไฟฟ้า FL.6"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-hidden transition-all"
                />
              </div>
            </div>

            {/* Quick Purpose Tag Chips */}
            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">วัตถุประสงค์ด่วน:</div>
              <div className="flex flex-wrap gap-1.5">
                {quickPurposes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      purpose === p
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  วันที่บันทึก
                </label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  เวลา
                </label>
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ระบุรายละเอียดเพิ่มเติม หรือเลขอ้างอิงใบงาน"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3.5 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              รวมเบิก <span className="font-bold text-slate-900 dark:text-white">{validItems.length}</span> รายการ ({totalUnits} ชิ้น)
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || validItems.length === 0}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-98"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ยืนยันเบิก {validItems.length} รายการ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
