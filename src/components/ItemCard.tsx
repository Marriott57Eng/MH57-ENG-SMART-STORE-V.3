import React from 'react';
import { motion } from 'motion/react';
import { InventoryItem } from '../types';
import { MapPin, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Check, ShoppingCart, Star } from 'lucide-react';

interface ItemCardProps {
  item: InventoryItem;
  onClick: (item: InventoryItem) => void;
  index?: number;
  isMultiSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (item: InventoryItem) => void;
  isLowSpec?: boolean;
  onOrderClick?: (item: InventoryItem) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (item: InventoryItem) => void;
}

export const ItemCard: React.FC<ItemCardProps> = React.memo(({ 
  item, 
  onClick, 
  index = 0,
  isMultiSelectMode = false,
  isSelected = false,
  onToggleSelect,
  isLowSpec = false,
  onOrderClick,
  isFavorite = false,
  onToggleFavorite,
}) => {
  // Clean neutral category badge to reduce visual noise
  const getCategoryColor = () => {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  // Cohesive semantic status configuration: Success (Green), Warning (Orange), Danger (Red)
  const getStatusConfig = () => {
    if (item.status === 'out' || item.qty <= 0) {
      return {
        cardBorder: isSelected ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/40' : 'hover:border-red-500/60 dark:hover:border-red-400/50',
        topAccent: 'bg-gradient-to-r from-red-600 via-red-500 to-rose-600',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-red-600 text-white shadow-xs border border-red-400/40">
            <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span>หมดจากคลัง</span>
          </span>
        ),
      };
    }
    if (item.status === 'low') {
      return {
        cardBorder: isSelected ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/40' : 'hover:border-amber-500/60 dark:hover:border-amber-400/50',
        topAccent: 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-amber-500 text-white shadow-xs border border-amber-300/40">
            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
            <span>ใกล้หมด</span>
          </span>
        ),
      };
    }
    return {
      cardBorder: isSelected ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/40' : 'hover:border-emerald-500/60 dark:hover:border-emerald-400/50',
      topAccent: 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500',
      badge: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-600 text-white shadow-xs border border-emerald-400/40">
          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white shrink-0" />
          <span>พร้อมเบิก</span>
        </span>
      ),
    };
  };

  const statusConfig = getStatusConfig();

  const handleCardClick = (e: React.MouseEvent) => {
    if (isMultiSelectMode && onToggleSelect) {
      e.stopPropagation();
      onToggleSelect(item);
    } else {
      onClick(item);
    }
  };

  const cardClasses = `item-card-container liquid-glass-card rounded-[24px] sm:rounded-[28px] p-4 sm:p-5 shadow-[0_4px_20px_rgba(15,23,42,0.04)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] ${statusConfig.cardBorder} transition-all cursor-pointer relative group flex flex-col justify-between overflow-hidden border ${
    isSelected 
      ? 'bg-blue-50/85 dark:bg-blue-950/50 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30' 
      : isFavorite
        ? 'border-amber-400/50 dark:border-amber-500/40 bg-amber-500/[0.03] shadow-[0_4px_20px_rgba(245,158,11,0.08)] ring-1 ring-amber-400/30'
        : 'border-white/70 dark:border-white/10'
  } ${isLowSpec ? '' : 'active:scale-[0.99]'}`;

  const cardInner = (
    <>
      {/* Specular top edge rim light */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full" />

      {/* Top Accent Bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusConfig.topAccent} opacity-90`} />

      <div className="flex gap-3 pt-1">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row with ID, Category, Status & Multi-select checkbox */}
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Multi-select checkbox trigger */}
              {isMultiSelectMode && (
                <button
                  type="button"
                  aria-label={isSelected ? `ยกเลิกเลือก ${item.name}` : `เลือก ${item.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleSelect) onToggleSelect(item);
                  }}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0 ${
                    isSelected 
                      ? 'bg-blue-600 text-white border border-blue-500 ring-2 ring-blue-400/50' 
                      : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>
              )}

              <span className="font-mono text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 rounded-xl shadow-2xs">
                {item.id}
              </span>
              <span
                className={`text-xs sm:text-sm font-semibold px-3 py-0.5 rounded-full border shadow-2xs ${getCategoryColor()}`}
              >
                {item.category}
              </span>
              {isFavorite && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40 shadow-2xs">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  <span>ปักหมุด</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {/* Star Favorite Button */}
              {onToggleFavorite && (
                <button
                  type="button"
                  aria-label={isFavorite ? `ยกเลิกปักหมุด ${item.name}` : `ปักหมุดรายการโปรด ${item.name}`}
                  title={isFavorite ? "เลิกปักหมุดรายการโปรด" : "ปักหมุดเป็นรายการโปรด (แสดงด้านบนสุด)"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item);
                  }}
                  className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    isFavorite 
                      ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-400/40 shadow-xs hover:bg-amber-500/30 active:scale-90 ring-1 ring-amber-400/30'
                      : 'text-slate-400 hover:text-amber-500 dark:text-slate-500 dark:hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-300/30 active:scale-90'
                  }`}
                >
                  <Star className={`w-4 h-4 sm:w-4.5 sm:h-4.5 transition-transform ${isFavorite ? 'fill-amber-400 text-amber-400 scale-105 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]' : ''}`} />
                </button>
              )}
              <div>{statusConfig.badge}</div>
            </div>
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
                  <div className="inline-flex flex-col w-fit gap-1 text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 px-3.5 py-2 rounded-2xl shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                      <span>หมดสต็อกตั้งแต่: {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา {new Date(item.outOfStockDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                    </div>
                    <div className="ml-5 font-bold text-red-600 dark:text-red-400">
                      (ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน)
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 px-3.5 py-1 rounded-xl shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    สินค้าหมด (ไม่ได้บันทึกเวลา)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Stock Balance, Order Button & Arrow */}
      <div className="flex items-center justify-between pt-3.5 border-t border-slate-200/60 dark:border-slate-800/80 mt-3.5 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            เกณฑ์: <span className="font-bold text-slate-700 dark:text-slate-200">{item.minStock} {item.unit}</span>
          </div>

          {/* Prominent Order Button for low/out-of-stock items */}
          {(item.status === 'out' || item.status === 'low' || item.qty <= item.minStock) && onOrderClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOrderClick(item);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs shadow-md shadow-orange-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer ring-1 ring-white/30"
              title={`กดเพื่อสั่งซื้อ ${item.name}`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>สั่งซื้อ</span>
            </button>
          )}

          {item.ordered && (
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-800" title={item.ordered}>
              ✓ สั่งซื้อแล้ว
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          <div className="text-right">
            <span className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mr-1.5 font-medium">คงเหลือ:</span>
            <span className="font-black text-slate-900 dark:text-white text-xl sm:text-2xl">
              {item.qty}{' '}
              <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">{item.unit}</span>
            </span>
          </div>

          <div className={`w-9 h-9 rounded-2xl ${isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-blue-500/10'} flex items-center justify-center transition-all shadow-xs`}>
            {isMultiSelectMode ? (
              <Check className={`w-5 h-5 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (isLowSpec) {
    return (
      <div onClick={handleCardClick} className={cardClasses}>
        {cardInner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.15,
        ease: 'easeOut',
        delay: Math.min(index * 0.01, 0.05),
      }}
      onClick={handleCardClick}
      className={cardClasses}
    >
      {cardInner}
    </motion.div>
  );
});

ItemCard.displayName = 'ItemCard';

