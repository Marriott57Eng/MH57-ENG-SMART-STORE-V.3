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
  onExportPdf?: () => void;
  isExporting?: boolean;
}

export const CategoryView: React.FC<CategoryViewProps> = ({
  summary,
  items,
  onSelectCategory,
  onExportPdf,
  isExporting,
}) => {
  const getCategoryIcon = (name: string) => {
    switch (name) {
      case 'เคมี':
        return <Droplet className="w-4.5 h-4.5 text-purple-600" />;
      case 'ท่อ':
        return <Layers className="w-4.5 h-4.5 text-cyan-600" />;
      case 'ไฟฟ้า':
      case 'Lighting':
        return <Zap className="w-4.5 h-4.5 text-amber-500" />;
      case 'แอร์':
        return <Wind className="w-4.5 h-4.5 text-blue-500" />;
      case 'สุขภัณฑ์':
        return <Bath className="w-4.5 h-4.5 text-teal-600" />;
      case 'สี+Grouting':
        return <Palette className="w-4.5 h-4.5 text-rose-500" />;
      case 'Fire Alarm':
        return <Flame className="w-4.5 h-4.5 text-red-500" />;
      case 'ประตู':
        return <DoorOpen className="w-4.5 h-4.5 text-stone-600" />;
      case 'เน็ต+โทรศัพท์':
        return <Radio className="w-4.5 h-4.5 text-indigo-500" />;
      default:
        return <Package className="w-4.5 h-4.5 text-blue-600" />;
    }
  };

  const getCategoryDescription = (name: string) => {
    return CATEGORY_IMAGE_MAP[name]?.description || 'อุปกรณ์และอะไหล่ช่างประจำคลัง ';
  };

  return (
    <div className="p-3.5 sm:p-4 pt-safe-content space-y-4 pb-28 sm:pb-24 bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Boxes className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">หมวดหมู่สินค้าในคลัง</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              จำแนกตามโครงสร้างคลังสินค้า ({summary?.categories.length || 0} หมวดหมู่)
            </p>
          </div>
        </div>
        
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            disabled={isExporting || items.length === 0}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1 border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer"
            title="ส่งออกรายงาน PDF คลังสินค้า"
          >
            {isExporting ? (
              <Loader2 className="w-4.5 h-4.5 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <FileDown className="w-4.5 h-4.5 text-red-600 dark:text-red-400" />
            )}
            <span className="text-xs sm:text-sm font-bold hidden sm:inline-block">PDF</span>
          </button>
        )}
      </div>

      {/* Category Grid with Real Photos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              whileHover={{ y: -2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSelectCategory(cat.name)}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/70 transition-all cursor-pointer group flex flex-col justify-between"
            >
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
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />
                
                {/* Category Badge & Icon */}
                <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs flex items-center justify-center shrink-0 shadow-xs border border-white/40 dark:border-slate-700">
                      {getCategoryIcon(cat.name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-white text-base leading-tight drop-shadow-xs truncate">
                        {cat.name}
                      </h3>
                      <span className="text-xs text-slate-200 font-medium drop-shadow-xs">
                        {cat.count} รายการ
                      </span>
                    </div>
                  </div>

                  {/* Stock status pills (Red for out of stock, Amber for low stock) */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                    {outOfStockItemsInCat > 0 && (
                      <span className="bg-red-600/95 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs shadow-xs border border-red-400/40">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>หมด {outOfStockItemsInCat}</span>
                      </span>
                    )}

                    {lowStockItemsInCat > 0 && (
                      <span className="bg-amber-500/95 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs shadow-xs border border-amber-300/40">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>ใกล้หมด {lowStockItemsInCat}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Details */}
              <div className="p-3 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-normal">
                    {getCategoryDescription(cat.name)}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                    คงเหลือรวม: <span className="text-blue-600 dark:text-blue-400 font-bold">{cat.totalQty.toLocaleString()}</span> หน่วย
                  </p>
                </div>

                <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-slate-700 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center justify-center shrink-0 transition-colors border border-slate-200 dark:border-slate-700">
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
