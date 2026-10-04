import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { InventoryItem } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  X, MapPin, Layers, FileText, ShoppingCart, MessageSquare, ClipboardList, AlertTriangle, CheckCircle2, XCircle, Edit3, Globe, Star
} from 'lucide-react';

interface ItemDetailModalProps {
  item: InventoryItem | null;
  isAdmin?: boolean;
  onClose: () => void;
  onAskAI: (item: InventoryItem) => void;
  onStartRequisition: (item: InventoryItem) => void;
  onEditItem?: (item: InventoryItem) => void;
  onOrderClick?: (item: InventoryItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (item: InventoryItem) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  isAdmin = false,
  onClose,
  onAskAI,
  onStartRequisition,
  onEditItem,
  onOrderClick,
  isFavorite = false,
  onToggleFavorite,
}) => {
  useScrollLock(Boolean(item));

  if (!item) return null;

  const isLow = item.status === 'low';
  const isOut = item.status === 'out';

  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      {/* Smooth Backdrop - Solid Hardware-Accelerated Overlay to prevent flicker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={onClose}
        style={{ willChange: 'opacity' }}
        className="fixed inset-0 bg-slate-950/80 transform-gpu touch-none"
      />

      {/* Smooth Modal Dialog - Hardware-Accelerated without CSS transition conflicts */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: 'transform, opacity' }}
        className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-md max-h-[92dvh] landscape:max-h-[94dvh] rounded-[32px] sm:rounded-[36px] flex flex-col shadow-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 transform-gpu overscroll-contain"
      >
        {/* Specular top rim highlight */}
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none rounded-full" />

        {/* Header Badges & Close Button */}
        <div className="px-4 py-3 sm:py-3.5 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full shadow-2xs border border-slate-200 dark:border-slate-700">
              {item.id}
            </span>
            <span className="text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
              {item.category}
            </span>
            {isOut ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-xs border border-red-400/40">
                <XCircle className="w-4 h-4 text-white" /> หมดจากคลัง
              </span>
            ) : isLow ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs border border-amber-300/40">
                <AlertTriangle className="w-4 h-4 text-white" /> ใกล้หมด
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs border border-emerald-400/40">
                <CheckCircle2 className="w-4 h-4 text-white" /> พร้อมเบิก
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleFavorite && (
              <button
                type="button"
                aria-label={isFavorite ? `ยกเลิกปักหมุด ${item.name}` : `ปักหมุดรายการโปรด ${item.name}`}
                title={isFavorite ? "เลิกปักหมุดรายการโปรด" : "ปักหมุดเป็นรายการโปรด (แสดงด้านบนสุด)"}
                onClick={() => onToggleFavorite(item)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer border shadow-2xs ${
                  isFavorite
                    ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border-amber-400/50 hover:bg-amber-500/30 ring-1 ring-amber-400/30'
                    : 'bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-amber-500 border-slate-300/60 dark:border-slate-700'
                }`}
              >
                <Star className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-amber-400 text-amber-400 scale-105 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]' : ''}`} />
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 border border-slate-300/60 dark:border-slate-700 shadow-2xs"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Item Title */}
        <div className="px-5 py-3.5 sm:py-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <h2 className="text-base sm:text-xl font-extrabold text-slate-900 dark:text-white leading-snug tracking-wide">
            {item.name}
          </h2>
        </div>

        {/* Body content */}
        <div className="p-4 space-y-3 overflow-y-auto overscroll-contain flex-1 min-h-0">
          {/* Stock Status Card */}
          <div
            className={`p-4 rounded-2xl border shadow-2xs ${
              isOut
                ? 'bg-red-500/10 dark:bg-red-950/40 border-red-400/30 dark:border-red-600/30'
                : isLow
                ? 'bg-amber-500/10 dark:bg-amber-950/40 border-amber-400/30 dark:border-amber-600/30'
                : 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-400/30 dark:border-emerald-600/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                จำนวนคงเหลือปัจจุบัน
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                เกณฑ์ขั้นต่ำ: <strong className="text-slate-900 dark:text-slate-200 font-bold">{item.minStock}</strong> {item.unit}
              </span>
            </div>

            <div className="flex items-baseline">
              <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{item.qty}</span>
              <span className="text-sm font-bold text-slate-600 dark:text-slate-300 ml-2">{item.unit}</span>
            </div>
          </div>
          
          {/* Out of Stock Details Card */}
          {isOut && (
            <div className="bg-red-500/10 dark:bg-red-950/40 border border-red-400/30 dark:border-red-600/30 p-3.5 rounded-2xl relative overflow-hidden shadow-2xs">
              <div className="absolute top-1 right-2 opacity-15 pointer-events-none">
                <AlertTriangle className="w-12 h-12 text-red-500" />
              </div>
              <h4 className="text-xs font-bold text-red-700 dark:text-red-300 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                รายละเอียดการหมดสต็อก
              </h4>
              <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
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
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl shadow-2xs border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <span>ตำแหน่งจัดเก็บ</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{item.location || 'Store FL.6'}</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl shadow-2xs border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>หมวดหมู่</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{item.category}</p>
            </div>
          </div>

          {/* Ordered / Delivery info if any */}
          {(item.ordered || item.orderedDate) && (
            <div className="bg-blue-500/10 dark:bg-blue-950/40 border border-blue-400/30 dark:border-blue-600/30 p-3 rounded-2xl shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 mb-1">
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
            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-2xl shadow-2xs border border-slate-200/80 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>หมายเหตุ</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{item.note}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 pt-2.5 pb-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 flex flex-col gap-2 shrink-0">
          {/* Order Button in Item Detail Modal */}
          {onOrderClick && (
            <button
              onClick={() => {
                onOrderClick(item);
                onClose();
              }}
              className={`w-full py-3 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer border ${
                (isLow || isOut || item.qty <= item.minStock)
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-orange-500/25 border-amber-400/40'
                  : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-amber-500/10'
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>
                {(isLow || isOut || item.qty <= item.minStock)
                  ? 'สั่งซื้อสินค้านี้ (Purchase Order)'
                  : 'สั่งซื้อสินค้าล่วงหน้า (Purchase Order)'}
              </span>
            </button>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                onStartRequisition(item);
                onClose();
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 px-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer border border-blue-400/40 relative overflow-hidden"
            >
              <ClipboardList className="w-4 h-4 shrink-0 relative z-10" />
              <span className="truncate relative z-10">เบิก/รับเข้า</span>
            </button>

            <button
              onClick={() => {
                onAskAI(item);
                onClose();
              }}
              className="w-full bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-400/40 dark:border-blue-500/40 hover:bg-blue-50 dark:hover:bg-slate-700 py-3 px-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-2xs"
            >
              <MessageSquare className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="truncate">ถาม AI</span>
            </button>

            <button
              onClick={() => {
                window.open(`https://www.google.com/search?q=${encodeURIComponent(item.name)}`, '_blank', 'noopener,noreferrer');
              }}
              className="w-full bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-slate-700 py-3 px-2 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-2xs"
            >
              <Globe className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">ถาม Google</span>
            </button>
          </div>

          {isAdmin && onEditItem && (
            <button
              onClick={() => {
                onEditItem(item);
                onClose();
              }}
              className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              แก้ไขข้อมูลอะไหล่นี้ (Admin)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
