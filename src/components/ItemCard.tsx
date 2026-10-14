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
  onLongPress?: (item: InventoryItem) => void;
  isRecentlyUpdated?: boolean;
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
  onLongPress,
  isRecentlyUpdated = false,
  isLowSpec = false,
  onOrderClick,
  isFavorite = false,
  onToggleFavorite,
}) => {
  // Long press detection for selecting multiple items
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggeredRef = React.useRef(false);
  const startPosRef = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      if (onLongPress) {
        onLongPress(item);
      } else if (onToggleSelect) {
        onToggleSelect(item);
      }
    }, 450); // 450ms long press standard
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current || !longPressTimerRef.current) return;
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    startPosRef.current = null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Category badge
  const getCategoryColor = () => {
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700';
  };

  // Status configuration
  const getStatusConfig = () => {
    if (item.status === 'out' || item.qty <= 0) {
      return {
        cardBorder: isSelected ? 'border-red-500 ring-2 ring-red-500/30' : 'hover:border-red-400/50',
        topAccent: 'bg-red-500',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-800 dark:text-red-300 border border-red-400/30 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>หมดจากคลัง</span>
          </span>
        ),
      };
    }
    if (item.status === 'low') {
      return {
        cardBorder: isSelected ? 'border-amber-500 ring-2 ring-amber-500/30' : 'hover:border-amber-400/50',
        topAccent: 'bg-amber-500',
        badge: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/30 shadow-2xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>ใกล้หมด</span>
          </span>
        ),
      };
    }
    return {
      cardBorder: isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'hover:border-emerald-400/50',
      topAccent: 'bg-emerald-500',
      badge: (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/30 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>พร้อมเบิก</span>
        </span>
      ),
    };
  };

  const statusConfig = getStatusConfig();

  const handleCardClick = (e: React.MouseEvent) => {
    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      return;
    }
    if (isMultiSelectMode && onToggleSelect) {
      e.stopPropagation();
      onToggleSelect(item);
    } else {
      onClick(item);
    }
  };

  const cardClasses = `item-card-container liquid-glass-card rounded-[22px] sm:rounded-[26px] p-4 sm:p-5 shadow-xs ${statusConfig.cardBorder} transition-all cursor-pointer relative group flex flex-col justify-between overflow-hidden select-none touch-manipulation ${
    isSelected 
      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30' 
      : isFavorite
        ? 'border-amber-400/60 dark:border-amber-500/40 bg-amber-500/[0.04] ring-1 ring-amber-400/30'
        : ''
  }`;

  const cardInner = (
    <>
      {/* Specular top edge rim light */}
      <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent pointer-events-none rounded-full" />

      {/* Subtle top indicator bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${statusConfig.topAccent} opacity-80`} />

      <div className="flex gap-3 pt-1">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row with ID, Category, Status & Multi-select checkbox */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
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
                      ? 'bg-blue-600 text-white border border-blue-600 ring-2 ring-blue-500/40' 
                      : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-transparent hover:border-blue-500'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>
              )}

              <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-2.5 py-0.5 rounded-xl shadow-2xs">
                {item.id}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs ${getCategoryColor()}`}
              >
                {item.category}
              </span>

              {isFavorite && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40 shadow-2xs">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
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
                  className={`p-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                    isFavorite 
                      ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-400/40 shadow-xs active:scale-90'
                      : 'text-stone-400 hover:text-amber-500 dark:text-stone-500 dark:hover:text-amber-400 hover:bg-amber-500/10 border border-transparent active:scale-90'
                  }`}
                >
                  <Star className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-amber-400 text-amber-500 scale-105' : ''}`} />
                </button>
              )}
              <div>{statusConfig.badge}</div>
            </div>
          </div>

          {/* Item Name */}
          <h3 className="font-semibold text-slate-900 dark:text-white text-base sm:text-lg leading-snug line-clamp-2 mt-1">
            {item.name}
          </h3>

          {/* Location info */}
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
              <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate max-w-[260px] font-medium">{item.location || 'Store FL.6'}</span>
            </div>
            
            {/* Days Out of Stock Alert */}
            {item.status === 'out' && (
              <div className="flex flex-col gap-1 mt-1">
                {item.outOfStockDate ? (
                  <div className="inline-flex flex-col w-fit gap-0.5 text-xs font-semibold bg-red-500/15 text-red-800 dark:text-red-300 border border-red-400/30 px-3 py-1.5 rounded-xl shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>หมดสต็อกตั้งแต่: {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="ml-5 font-bold">
                      (ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน)
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold bg-red-500/15 text-red-800 dark:text-red-300 border border-red-400/30 px-3 py-1 rounded-xl shadow-2xs">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>สินค้าหมด (ไม่ได้บันทึกเวลา)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Stock Balance, Order Button & Arrow */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            เกณฑ์: <span className="font-bold text-slate-700 dark:text-slate-300">{item.minStock} {item.unit}</span>
          </div>

          {/* Prominent Order Button */}
          {(item.status === 'out' || item.status === 'low' || item.qty <= item.minStock) && onOrderClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOrderClick(item);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              title={`กดเพื่อสั่งซื้อ ${item.name}`}
            >
              <ShoppingCart className="w-3 h-3" />
              <span>สั่งซื้อ</span>
            </button>
          )}

          {item.ordered && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800" title={item.ordered}>
              ✓ สั่งซื้อแล้ว
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="text-right">
            <span className="text-xs text-slate-400 dark:text-slate-500 mr-1.5 font-medium">คงเหลือ:</span>
            <span className="font-bold text-slate-900 dark:text-white text-xl sm:text-2xl tabular-nums">
              {item.qty.toLocaleString()}
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">{item.unit}</span>
            </span>
          </div>

          <div className={`w-8 h-8 rounded-xl ${isSelected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-slate-800 dark:group-hover:text-white'} flex items-center justify-center transition-all shadow-xs`}>
            {isMultiSelectMode ? (
              <Check className={`w-4 h-4 ${isSelected ? 'opacity-100' : 'opacity-40'}`} />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (isLowSpec) {
    return (
      <div 
        onClick={handleCardClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={handleContextMenu}
        className={cardClasses}
      >
        {cardInner}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.15) }}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      className={cardClasses}
    >
      {cardInner}
    </motion.div>
  );
});

ItemCard.displayName = 'ItemCard';
