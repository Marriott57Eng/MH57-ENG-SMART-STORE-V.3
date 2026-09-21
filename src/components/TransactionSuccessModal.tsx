import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  User, 
  MapPin, 
  Calendar, 
  Volume2, 
  X,
  Sparkles,
  Layers
} from 'lucide-react';
import { playSuccessSoundAndSpeak } from '../utils/audioUtils';

export interface TransactionSuccessData {
  type: 'out' | 'in';
  itemId?: string;
  itemName?: string;
  category?: string;
  qty?: number;
  unit?: string;
  requestedBy: string;
  purpose: string;
  timestamp?: string;
  previousQty?: number;
  newQty?: number;
  // Bulk items support
  isBulk?: boolean;
  bulkItems?: Array<{
    id: string;
    name: string;
    category?: string;
    qty: number;
    unit: string;
    newQty?: number;
  }>;
}

interface TransactionSuccessModalProps {
  isOpen: boolean;
  data: TransactionSuccessData | null;
  onClose: () => void;
}

export const TransactionSuccessModal: React.FC<TransactionSuccessModalProps> = ({
  isOpen,
  data,
  onClose,
}) => {
  useScrollLock(isOpen && Boolean(data));

  if (!isOpen || !data) return null;

  const isStockIn = data.type === 'in';
  const isBulk = Boolean(data.isBulk && data.bulkItems && data.bulkItems.length > 0);
  const totalBulkUnits = isBulk ? (data.bulkItems?.reduce((sum, i) => sum + i.qty, 0) || 0) : (data.qty || 0);
  const totalBulkItems = isBulk ? (data.bulkItems?.length || 0) : 1;

  const handleReplayVoice = () => {
    let speechText = '';
    if (isBulk) {
      speechText = `บันทึกการเบิกสินค้า ${totalBulkItems} รายการ รวม ${totalBulkUnits} ชิ้น เรียบร้อยแล้วค่ะ`;
    } else {
      speechText = isStockIn
        ? `บันทึกรับเข้า ${data.itemName || 'สินค้า'} จำนวน ${data.qty} ${data.unit || 'ชิ้น'} เรียบร้อยแล้วค่ะ`
        : `บันทึกการเบิก ${data.itemName || 'สินค้า'} จำนวน ${data.qty} ${data.unit || 'ชิ้น'} เรียบร้อยแล้วค่ะ`;
    }
    playSuccessSoundAndSpeak(speechText);
  };

  const modalContent = (
    <div 
      id="transaction-success-modal-overlay"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 overflow-y-auto transform-gpu overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: 'transform, opacity' }}
        className="relative w-full max-w-md max-h-[92dvh] landscape:max-h-[94dvh] my-auto overflow-y-auto bg-white dark:bg-slate-900 rounded-[32px] sm:rounded-[36px] border border-slate-200 dark:border-slate-700 shadow-2xl p-5 sm:p-7 text-center transform-gpu"
      >
          {/* Top specular rim light */}
          <div className="absolute top-0 left-8 right-8 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

          {/* Background subtle glow */}
          <div 
            className={`absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-40 ${
              isStockIn ? 'bg-emerald-500' : 'bg-blue-500'
            }`} 
          />

          {/* Close button */}
          <button
            id="close-success-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full liquid-glass-pill transition-colors z-10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Success Animated Badge */}
          <div className="relative mx-auto mb-4 w-20 h-20 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.08, type: 'spring', damping: 14, stiffness: 220 }}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-xl border ${
                isStockIn 
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-400/40 shadow-emerald-500/35' 
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 border-blue-400/40 shadow-blue-500/35'
              }`}
            >
              <CheckCircle2 className="w-11 h-11 stroke-[2.2]" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute -bottom-1 -right-1 liquid-glass p-1.5 rounded-full shadow-md border border-white/60 dark:border-white/10"
            >
              {isStockIn ? (
                <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
              )}
            </motion.div>
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-2 border ${
              isStockIn 
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30' 
                : isBulk
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-400/30'
                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30'
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              {isStockIn ? 'รับเข้าสินค้า (Stock In)' : isBulk ? 'เบิกสินค้าพร้อมกันหลายรายการ (Bulk)' : 'เบิกสินค้า (Stock Out)'}
            </span>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
              ทำรายการเรียบร้อยแล้ว
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-5">
              {isBulk 
                ? `บันทึกเบิกสินค้าทั้งหมด ${totalBulkItems} รายการ รวม ${totalBulkUnits} ชิ้น สำเร็จ`
                : isStockIn 
                ? 'ระบบได้เพิ่มยอดสต็อกสินค้าเข้าคลัง Store FL.6 สำเร็จ'
                : 'ระบบได้ตัดยอดสต็อกสินค้าออกจากคลัง Store FL.6 สำเร็จ'}
            </p>
          </motion.div>

          {/* Transaction Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-white/40 dark:bg-slate-900/40 rounded-2xl p-4 border border-white/60 dark:border-white/10 text-left space-y-3 mb-5 shadow-xs text-xs sm:text-sm backdrop-blur-md"
          >
            {/* Bulk items list or single item details */}
            {isBulk && data.bulkItems ? (
              <div className="space-y-2 pb-2.5 border-b border-white/40 dark:border-white/10 max-h-48 overflow-y-auto pr-1">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>รายการที่เบิก ({data.bulkItems.length} รายการ):</span>
                  <span>รวม {totalBulkUnits} ชิ้น</span>
                </div>
                {data.bulkItems.map((bi) => (
                  <div key={bi.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span className="font-bold">{bi.id}</span>
                        {bi.category && <span>• {bi.category}</span>}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">
                        {bi.name}
                      </div>
                      {typeof bi.newQty === 'number' && (
                        <div className="text-[11px] text-slate-400">
                          คงเหลือ: {bi.newQty} {bi.unit}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-400/30">
                        -{bi.qty} {bi.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/40 dark:border-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mb-0.5">
                      <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold">{data.itemId}</span>
                      {data.category && (
                        <span className="text-[11px] px-2 py-0.5 liquid-glass-pill rounded-full text-slate-600 dark:text-slate-300 border border-white/40 dark:border-white/10">
                          {data.category}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                      {data.itemName}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block font-black text-sm sm:text-base px-3 py-1 rounded-xl shadow-2xs border ${
                      isStockIn
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/40'
                    }`}>
                      {isStockIn ? `+${data.qty}` : `-${data.qty}`} {data.unit}
                    </span>
                  </div>
                </div>

                {/* Remaining Qty */}
                {typeof data.newQty === 'number' && (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      คงเหลือปัจจุบันในคลัง:
                    </span>
                    <span className="font-black text-slate-900 dark:text-slate-100">
                      {data.newQty.toLocaleString()} {data.unit}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Requester */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {isStockIn ? 'ผู้รับเข้า / ตรวจรับ:' : 'ผู้เบิกสินค้า:'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {data.requestedBy}
              </span>
            </div>

            {/* Purpose */}
            <div className="flex items-start justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {isStockIn ? 'แหล่งที่มา:' : 'งานที่นำไปใช้:'}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]">
                {data.purpose}
              </span>
            </div>

            {/* Timestamp */}
            {data.timestamp && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/40 dark:border-white/10 text-slate-400 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  เวลาบันทึก:
                </span>
                <span className="font-medium">{data.timestamp}</span>
              </div>
            )}
          </motion.div>

          {/* Controls */}
          <div className="flex items-center gap-2.5">
            <button
              id="replay-voice-btn"
              type="button"
              onClick={handleReplayVoice}
              title="กดเพื่อฟังเสียงอ่านผลการทำรายการอีกครั้ง"
              className="py-3 px-3.5 rounded-2xl liquid-glass-pill hover:bg-white/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-white/60 dark:border-white/10 transition-colors flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer shadow-xs"
            >
              <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">ฟังเสียงซ้ำ</span>
            </button>

            <button
              id="confirm-success-modal-btn"
              type="button"
              onClick={onClose}
              className={`flex-1 py-3.5 px-5 rounded-2xl font-extrabold text-sm text-white shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border ${
                isStockIn
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/40 shadow-emerald-500/25'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-blue-400/40 shadow-blue-500/25'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              ตกลง / ปิดหน้าต่าง
            </button>
          </div>
        </motion.div>
      </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
