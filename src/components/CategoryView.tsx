import React from 'react';
import { motion } from 'motion/react';
import { InventorySummary, InventoryItem } from '../types';
import { 
  Layers, Package, Zap, Droplet, Flame,
  Wind, Bath, Palette, DoorOpen, Radio, ChevronRight,
  Boxes, AlertCircle, AlertTriangle, FileDown, Loader2
} from 'lucide-react';
import { getCategoryImageUrl, CATEGORY_IMAGE_MAP } from '../utils/imageMap';

interface CategoryViewProps {
  summary: InventorySummary | null;
  items: InventoryItem[];
  onSelectCategory: (category: string) => void;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  summary,
  items,
  onSelectCategory,
}) => {
  const getCategoryIcon = (name: string) => {
    const iconClass = "w-4.5 h-4.5 text-blue-600 dark:text-blue-400";
    switch (name) {
      case 'เคมี':
        return <Droplet className={iconClass} />;
      case 'ท่อ':
        return <Layers className={iconClass} />;
      case 'ไฟฟ้า':
      case 'Lighting':
        return <Zap className={iconClass} />;
      case 'แอร์':
        return <Wind className={iconClass} />;
      case 'สุขภัณฑ์':
        return <Bath className={iconClass} />;
      case 'สี+Grouting':
        return <Palette className={iconClass} />;
      case 'Fire Alarm':
        return <Flame className={iconClass} />;
      case 'ประตู':
        return <DoorOpen className={iconClass} />;
      case 'เน็ต+โทรศัพท์':
        return <Radio className={iconClass} />;
      default:
        return <Package className={iconClass} />;
    }
  };

  const getCategoryDescription = (name: string) => {
    return CATEGORY_IMAGE_MAP[name]?.description || 'อุปกรณ์และอะไหล่ช่างประจำคลัง ';
  };

  return (
    <div className="p-3.5 sm:p-5 md:p-6 pt-3 sm:pt-4 space-y-4 pb-28 sm:pb-32 max-w-7xl mx-auto w-full transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 border border-blue-400/40 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">หมวดหมู่สินค้าในคลัง</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              จำแนกตามโครงสร้างคลังสินค้า ({summary?.categories.length || 0} หมวดหมู่)
            </p>
          </div>
        </div>
      </div>

      {/* Category Grid with Real Photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {summary?.categories.map((cat, idx) => {
          const catImg = getCategoryImageUrl(cat.name);
          const outOfStockItemsInCat = items.filter(
            i => i.category === cat.name && (i.status === 'out' || i.qty <= 0)
          ).length;
          const lowStockItemsInCat = items.filter(
            i => i.category === cat.name && i.status === 'low' && i.qty > 0
          ).length;

          return (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
                delay: Math.min(idx * 0.025, 0.2),
              }}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSelectCategory(cat.name)}
              className="liquid-glass-card rounded-[28px] overflow-hidden shadow-lg hover:shadow-xl hover:border-blue-400/50 dark:hover:border-blue-500/40 transition-all cursor-pointer group flex flex-col justify-between border border-white/70 dark:border-white/10 relative"
            >
              {/* Top rim specular light */}
              <div className="absolute top-0 left-6 right-6 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/30 to-transparent pointer-events-none rounded-full z-10" />

              {/* Category Image Banner with Overlay */}
              <div className="relative h-28 sm:h-32 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <img
                  src={catImg}
                  alt={cat.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                
                {/* Category Badge & Icon */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-2xl liquid-glass flex items-center justify-center shrink-0 shadow-md border border-white/60 dark:border-white/20">
                      {getCategoryIcon(cat.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-white text-base leading-tight drop-shadow-md truncate">
                        {cat.name}
                      </h3>
                      <span className="text-xs text-slate-200/90 font-medium drop-shadow-xs">
                        {cat.count} รายการ
                      </span>
                    </div>
                  </div>

                  {/* Stock status pills (Red for out of stock, Amber for low stock) */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                    {outOfStockItemsInCat > 0 && (
                      <span className="bg-red-500/90 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-md shadow-xs border border-red-300/40">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>หมด {outOfStockItemsInCat}</span>
                      </span>
                    )}

                    {lowStockItemsInCat > 0 && (
                      <span className="bg-amber-500/90 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-md shadow-xs border border-amber-300/40">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>ใกล้หมด {lowStockItemsInCat}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Details */}
              <div className="p-3.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md flex items-center justify-between gap-2 border-t border-white/40 dark:border-white/10">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
                    {getCategoryDescription(cat.name)}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    คงเหลือรวม: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{cat.totalQty.toLocaleString()}</span> หน่วย
                  </p>
                </div>

                <div className="w-7 h-7 rounded-xl liquid-glass-pill group-hover:bg-blue-500/15 text-slate-400 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center shrink-0 transition-colors border border-white/60 dark:border-white/10 shadow-2xs">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
