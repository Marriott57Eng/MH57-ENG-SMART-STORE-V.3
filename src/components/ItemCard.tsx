import React from 'react';
import { InventoryItem } from '../types';
import { MapPin, AlertTriangle, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';

interface ItemCardProps {
  item: InventoryItem;
  onClick: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick }) => {
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

  const getStatusBadge = () => {
    if (item.status === 'out' || item.qty <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
          <XCircle className="w-3.5 h-3.5" /> หมดจากคลัง
        </span>
      );
    }
    if (item.status === 'low') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">
          <AlertTriangle className="w-3.5 h-3.5" /> ใกล้หมด
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
        <CheckCircle2 className="w-3.5 h-3.5" /> ปกติ
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs dark:shadow-none active:scale-[0.99] hover:border-blue-300 dark:hover:border-blue-500/50 transition-all cursor-pointer relative group flex flex-col justify-between"
    >
      <div className="flex gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row with ID, Category & Status */}
          <div className="flex items-center justify-between gap-1.5 mb-1 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                {item.id}
              </span>
              <span
                className={`text-sm font-semibold px-2 py-0.5 rounded-full border ${getCategoryColor(
                  item.category
                )}`}
              >
                {item.category}
              </span>
            </div>
            <div>{getStatusBadge()}</div>
          </div>

          {/* Item Name */}
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg sm:text-lg leading-snug line-clamp-2 mt-0.5">
            {item.name}
          </h3>

          {/* Location info */}
          <div className="flex flex-col gap-2 mt-1.5">
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-400 text-sm">
              <MapPin className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="truncate max-w-[140px]">{item.location || 'Store FL.6'}</span>
            </div>
            
            {/* Days Out of Stock Alert */}
            {item.status === 'out' && (
              <div className="flex flex-col gap-1 mt-1">
                {item.outOfStockDate ? (
                  <div className="inline-flex flex-col w-fit gap-1 text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/80 px-2.5 py-1.5 rounded-md shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>หมดสต็อกตั้งแต่: {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา {new Date(item.outOfStockDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                    </div>
                    <div className="ml-5 text-red-600 dark:text-red-400">
                      (ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน)
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                    สินค้าหมด (ไม่ได้บันทึกเวลา)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Stock Balance & Arrow */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-lg text-slate-500 dark:text-slate-400 mt-2.5">
        <div className="text-sm text-slate-400 dark:text-slate-500">
          เกณฑ์ขั้นต่ำ: <span className="font-medium text-slate-600 dark:text-slate-300">{item.minStock} {item.unit}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-xs text-slate-400 dark:text-slate-500 mr-1.5">คงเหลือ:</span>
            <span className="font-extrabold text-slate-900 dark:text-white text-lg">
              {item.qty}{' '}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{item.unit}</span>
            </span>
          </div>

          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
        </div>
      </div>
    </div>
  );
};
