import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  itemId: string;
  itemName: string;
  category?: string;
  qty: number;
  unit: string;
  requestedBy: string;
  purpose: string;
  timestamp?: string;
  previousQty?: number;
  newQty?: number;
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
  if (!isOpen || !data) return null;

  const isStockIn = data.type === 'in';

  const handleReplayVoice = () => {
    const speechText = isStockIn
      ? `บันทึกรับเข้า ${data.itemName} จำนวน ${data.qty} ${data.unit} เรียบร้อยแล้วค่ะ`
      : `บันทึกการเบิก ${data.itemName} จำนวน ${data.qty} ${data.unit} เรียบร้อยแล้วค่ะ`;
    playSuccessSoundAndSpeak(speechText);
  };

  return (
    <AnimatePresence>
      <div 
        id="transaction-success-modal-overlay"
        className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 26, stiffness: 360 }}
          className="relative w-full max-w-md max-h-[92dvh] landscape:max-h-[94dvh] my-auto overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 sm:p-7 text-center"
        >
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
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Success Animated Badge */}
          <div className="relative mx-auto mb-4 w-20 h-20 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.08, type: 'spring', damping: 14, stiffness: 220 }}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-lg border ${
                isStockIn 
                  ? 'bg-emerald-600 border-emerald-500 shadow-emerald-500/30' 
                  : 'bg-blue-600 border-blue-500 shadow-blue-500/30'
              }`}
            >
              <CheckCircle2 className="w-11 h-11 stroke-[2.2]" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 p-1.5 rounded-full shadow-md border border-slate-200 dark:border-slate-700"
            >
              {isStockIn ? (
                <ArrowDownRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </motion.div>
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 border ${
              isStockIn 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              {isStockIn ? 'รับเข้าสินค้า (Stock In)' : 'เบิกสินค้า (Stock Out)'}
            </span>
            <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
              ทำรายการเรียบร้อยแล้ว
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mb-5">
              {isStockIn 
                ? 'ระบบได้เพิ่มยอดสต็อกสินค้าเข้าคลัง Store FL.6 สำเร็จ'
                : 'ระบบได้ตัดยอดสต็อกสินค้าออกจากคลัง Store FL.6 สำเร็จ'}
            </p>
          </motion.div>

          {/* Transaction Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 text-left space-y-3 mb-5 shadow-2xs text-xs sm:text-sm"
          >
            {/* Item details */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700/70">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono mb-0.5">
                  <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{data.itemId}</span>
                  {data.category && (
                    <span className="text-[11px] px-1.5 py-0.2 bg-slate-200/80 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                      {data.category}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">
                  {data.itemName}
                </h4>
              </div>
              <div className="text-right shrink-0">
                <span className={`inline-block font-extrabold text-sm sm:text-base px-2.5 py-1 rounded-xl ${
                  isStockIn
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                }`}>
                  {isStockIn ? `+${data.qty}` : `-${data.qty}`} {data.unit}
                </span>
              </div>
            </div>

            {/* Remaining Qty */}
            {typeof data.newQty === 'number' && (
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  คงเหลือปัจจุบันในคลัง:
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {data.newQty.toLocaleString()} {data.unit}
                </span>
              </div>
            )}

            {/* Requester */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {isStockIn ? 'ผู้รับเข้า / ตรวจรับ:' : 'ผู้เบิกสินค้า:'}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {data.requestedBy}
              </span>
            </div>

            {/* Purpose */}
            <div className="flex items-start justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {isStockIn ? 'แหล่งที่มา:' : 'งานที่นำไปใช้:'}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[200px]">
                {data.purpose}
              </span>
            </div>

            {/* Timestamp */}
            {data.timestamp && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700/70 text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  เวลาบันทึก:
                </span>
                <span>{data.timestamp}</span>
              </div>
            )}
          </motion.div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              id="replay-voice-btn"
              type="button"
              onClick={handleReplayVoice}
              title="กดเพื่อฟังเสียงอ่านผลการทำรายการอีกครั้ง"
              className="py-3 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">ฟังเสียงซ้ำ</span>
            </button>

            <button
              id="confirm-success-modal-btn"
              type="button"
              onClick={onClose}
              className={`flex-1 py-3.5 px-5 rounded-xl font-bold text-sm text-white shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 border ${
                isStockIn
                  ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500 shadow-emerald-500/25'
                  : 'bg-blue-600 hover:bg-blue-700 border-blue-500 shadow-blue-500/25'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              ตกลง / ปิดหน้าต่าง
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
