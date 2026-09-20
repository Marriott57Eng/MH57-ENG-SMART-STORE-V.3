import React from 'react';
import { motion } from 'motion/react';
import { InventoryItem } from '../types';
import { MapPin, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

interface ItemCardProps {
  item: InventoryItem;
  onClick: () => void;
  index?: number;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, index = 0 }) => {
  // Clean neutral category badge to reduce visual noise
  const getCategoryColor = () => {
    return 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80';
  };

  // Cohesive 4-color semantic status configuration: Success (Green), Warning (Orange), Danger (Red)
  const getStatusConfig = () => {
    if (item.status === 'out' || item.qty <= 0) {
      return {
        cardBorder: 'hover:border-red-500/70 dark:hover:border-red-500/60',
        topAccent: 'bg-red-600',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-red-600 text-white shadow-xs border border-red-500">
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span>หมดจากคลัง</span>
          </span>
        ),
      };
    }
    if (item.status === 'low') {
      return {
        cardBorder: 'hover:border-amber-500/70 dark:hover:border-amber-500/60',
        topAccent: 'bg-amber-500',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500 text-white shadow-xs border border-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span>ใกล้หมด</span>
          </span>
        ),
      };
    }
    return {
      cardBorder: 'hover:border-emerald-500/70 dark:hover:border-emerald-500/60',
      topAccent: 'bg-emerald-600',
      badge: (
        <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-600 text-white shadow-xs border border-emerald-500">
          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
          <span>พร้อมเบิก</span>
        </span>
      ),
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, y: -6 }}
      transition={{
        duration: 0.22,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index * 0.015, 0.18),
      }}
      whileHover={{ y: -2, transition: { duration: 0.12 } }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] ${statusConfig.cardBorder} transition-all cursor-pointer relative group flex flex-col justify-between overflow-hidden`}
    >
      {/* Top Accent Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusConfig.topAccent} opacity-90`} />

      <div className="flex gap-3 pt-0.5">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row with ID, Category & Status */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-lg shadow-2xs">
                {item.id}
              </span>
              <span
                className={`text-xs sm:text-sm font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs ${getCategoryColor()}`}
              >
                {item.category}
              </span>
            </div>
            <div>{statusConfig.badge}</div>
          </div>

          {/* Item Name */}
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg sm:text-xl leading-snug line-clamp-2 mt-1">
            {item.name}
          </h3>

          {/* Location info */}
          <div className="flex flex-col gap-1.5 mt-2.5">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm sm:text-base">
              <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate max-w-[260px] font-medium">{item.location || 'Store FL.6'}</span>
            </div>
            
            {/* Days Out of Stock Alert (Danger = Red) */}
            {item.status === 'out' && (
              <div className="flex flex-col gap-1 mt-1">
                {item.outOfStockDate ? (
                  <div className="inline-flex flex-col w-fit gap-1 text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-1.5 rounded-xl shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                      <span>หมดสต็อกตั้งแต่: {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา {new Date(item.outOfStockDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                    </div>
                    <div className="ml-5 font-bold text-red-600 dark:text-red-400">
                      (ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน)
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 px-3 py-1 rounded-lg shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    สินค้าหมด (ไม่ได้บันทึกเวลา)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Stock Balance & Arrow */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 mt-3">
        <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          เกณฑ์ขั้นต่ำ: <span className="font-bold text-slate-700 dark:text-slate-200">{item.minStock} {item.unit}</span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <span className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mr-1.5 font-medium">คงเหลือ:</span>
            <span className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl">
              {item.qty}{' '}
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">{item.unit}</span>
            </span>
          </div>

          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/60 transition-colors shadow-2xs border border-slate-200/60 dark:border-slate-700/60">
            <ChevronRight className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
