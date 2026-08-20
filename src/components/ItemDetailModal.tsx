import React from 'react';
import { InventoryItem } from '../types';
import { 
  X, MapPin, Layers, FileText, ShoppingCart, MessageSquare, ClipboardList, AlertTriangle, CheckCircle2, XCircle, Edit3
} from 'lucide-react';

interface ItemDetailModalProps {
  item: InventoryItem | null;
  isAdmin?: boolean;
  onClose: () => void;
  onAskAI: (item: InventoryItem) => void;
  onStartRequisition: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isAdmin = false,
  onClose,
  onAskAI,
  onStartRequisition,
  onEditItem,
}) => {
  if (!item) return null;

  const isLow = item.status === 'low';
  const isOut = item.status === 'out';

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'เคมี':
        return 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80';
      case 'ท่อ':
        return 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/80';
      case 'ไฟฟ้า':
      case 'Lighting':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80';
      case 'แอร์':
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80';
      case 'สุขภัณฑ์':
        return 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/80';
      case 'สี+Grouting':
        return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80';
      case 'Fire Alarm':
        return 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/80';
      case 'ประตู':
        return 'bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700';
      case 'เน็ต+โทรศัพท์':
        return 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/80';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-200 transition-colors"
      >
        {/* Header Badges & Close Button */}
        <div className="p-3.5 pb-2.5 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-white bg-blue-600 px-2.5 py-0.5 rounded-md shadow-xs">
              {item.id}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs">
              {item.category}
            </span>
            {isOut ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800/80 shadow-xs">
                <XCircle className="w-3.5 h-3.5" /> หมดจากคลัง
              </span>
            ) : isLow ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5" /> ใกล้หมด
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Item Title */}
        <div className="px-3.5 py-2 border-y border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-850/50">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
            {item.name}
          </h2>
        </div>

        {/* Body content */}
        <div className="p-3.5 space-y-2.5 bg-white dark:bg-slate-900">
          {/* Stock Status Card */}
          <div
            className={`p-3 rounded-xl border ${
              isOut
                ? 'bg-red-50/20 dark:bg-red-950/20 border-red-200 dark:border-red-800/70'
                : isLow
                ? 'bg-amber-50/20 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/70'
                : 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/70'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                จำนวนคงเหลือปัจจุบัน
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                เกณฑ์ขั้นต่ำ: <strong className="text-slate-800 dark:text-slate-200 font-bold">{item.minStock}</strong> {item.unit}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">{item.qty}</span>
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 ml-1.5">{item.unit}</span>
            </div>
          </div>
          
          {/* Out of Stock Details Card */}
          {isOut && (
            <div className="bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/80 p-2.5 rounded-xl relative overflow-hidden">
              <div className="absolute top-1 right-2 opacity-15 pointer-events-none">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
              <h4 className="text-xs font-bold text-red-700 dark:text-red-300 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                รายละเอียดการหมดสต็อก
              </h4>
              <div className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                <p>
                  <span className="text-slate-500 dark:text-slate-400">วันที่หมด:</span>{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {item.outOfStockDate ? new Date(item.outOfStockDate).toLocaleDateString('th-TH', { 
                      year: 'numeric', month: 'long', day: 'numeric', 
                    }) : '20 สิงหาคม 2569'}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500 dark:text-slate-400">เวลา:</span>{' '}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {item.outOfStockDate ? new Date(item.outOfStockDate).toLocaleTimeString('th-TH', { 
                      hour: '2-digit', minute: '2-digit' 
                    }) + ' น.' : '21:09 น.'}
                  </span>
                </p>
                <p className="pt-0.5 font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>สินค้าขาดสต็อกมาแล้ว {item.outOfStockDate ? Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24))) : 0} วัน</span>
                </p>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 p-2.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <span>ตำแหน่งจัดเก็บ</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{item.location || 'Store FL.6'}</p>
            </div>

            <div className="bg-slate-50/80 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 p-2.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span>หมวดหมู่</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{item.category}</p>
            </div>
          </div>

          {/* Ordered / Delivery info if any */}
          {(item.ordered || item.orderedDate) && (
            <div className="bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/70 p-2.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 mb-0.5">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>สถานะการสั่งซื้อล่าสุด</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                สั่งซื้อ: <span className="font-medium">{item.ordered || '-'}</span>
              </p>
              {item.orderedDate && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  วันที่: {item.orderedDate}
                </p>
              )}
            </div>
          )}

          {/* Note if any */}
          {item.note && (
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 p-2.5 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>หมายเหตุ</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{item.note}</p>
            </div>
          )}
        </div>

        {/* Footer Actions (2 Columns) */}
        <div className="p-3.5 pt-1 pb-3.5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                onStartRequisition(item);
                onClose();
              }}
              className="w-full bg-[#0f172a] hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 text-white py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all cursor-pointer"
            >
              <ClipboardList className="w-4 h-4" />
              เบิก / รับเข้า
            </button>

            <button
              onClick={() => {
                onAskAI(item);
                onClose();
              }}
              className="w-full bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-blue-400 dark:border-blue-500/80 hover:bg-blue-50/50 dark:hover:bg-slate-800 py-2.5 px-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer shadow-xs"
            >
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              ถาม AI
            </button>
          </div>

          {isAdmin && onEditItem && (
            <button
              onClick={() => {
                onEditItem(item);
                onClose();
              }}
              className="w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              แก้ไขข้อมูลอะไหล่นี้ (Admin)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
