import React from 'react';
import { InventoryItem, InventorySummary, RequisitionRecord } from '../types';
import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { 
  Package, AlertTriangle, XCircle, CheckCircle2, 
  Layers, MapPin, ArrowUpRight, ShieldAlert, Sparkles, RefreshCw, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface StatsDashboardProps {
  summary: InventorySummary | null;
  items: InventoryItem[];
  requisitions?: RequisitionRecord[];
  onSelectCategory: (category: string) => void;
  onFilterLowStock: () => void;
  onSelectItem: (item: InventoryItem) => void;
  onAskAI: (prompt: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  summary,
  items,
  onSelectCategory,
  onFilterLowStock,
  onSelectItem,
  requisitions = [],
  onAskAI,
  onRefresh,
  loading,
}) => {
  const lowStockItems = items.filter(i => i.status === 'low' || i.status === 'out');

  // --- NEW ANALYTICS ---
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  const currentMonthRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      if (req.type !== 'out') return false;
      try {
        const d = parseISO(req.isoDate);
        return isWithinInterval(d, { start: currentMonthStart, end: currentMonthEnd });
      } catch (e) {
        return false;
      }
    });
  }, [requisitions, currentMonthStart, currentMonthEnd]);

  const topItemsThisMonth = useMemo(() => {
    const counts: Record<string, { name: string; qty: number }> = {};
    currentMonthRequisitions.forEach(req => {
      if (!counts[req.itemId]) {
        counts[req.itemId] = { name: req.itemName, qty: 0 };
      }
      counts[req.itemId].qty += req.qty;
    });
    return Object.values(counts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [currentMonthRequisitions]);

  const monthlyTrend = useMemo(() => {
    const trend: Record<string, number> = {};
    const outReqs = requisitions.filter(r => r.type === 'out');
    outReqs.forEach(req => {
      try {
        const d = parseISO(req.isoDate);
        const monthYear = format(d, 'MMM yy', { locale: th });
        trend[monthYear] = (trend[monthYear] || 0) + req.qty;
      } catch (e) {}
    });
    // For sorting, keep it simple by mapping entries and returning the top 6 (already mostly in order due to query)
    return Object.entries(trend).map(([month, qty]) => ({ month, qty })).reverse().slice(0, 6).reverse(); 
  }, [requisitions]);

  const outOfStockDurations = useMemo(() => {
    const outItems = items.filter(item => item.status === 'out' && item.outOfStockDate);
    return outItems.map(item => {
      try {
        const outDate = parseISO(item.outOfStockDate!);
        const days = differenceInDays(new Date(), outDate);
        return { name: item.name, days: days < 0 ? 0 : days, date: outDate };
      } catch (e) {
        return { name: item.name, days: 0, date: new Date() };
      }
    }).sort((a, b) => b.days - a.days).slice(0, 5);
  }, [items]);

  const [inlineAnalysis, setInlineAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleInlineAnalysis = async () => {
    if (isAnalyzing) return;
    if (inlineAnalysis && showAnalysis) {
      setShowAnalysis(false);
      return;
    }
    if (inlineAnalysis && !showAnalysis) {
      setShowAnalysis(true);
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setShowAnalysis(true);
      setInlineAnalysis('📡 ขณะนี้ระบบอยู่ในโหมดออฟไลน์ (Offline Mode) การประมวลผลวิเคราะห์เชิงลึกด้วย AI จำเป็นต้องใช้อินเทอร์เน็ตในการติดต่อโมเดล ข้อมูลสรุปตัวเลขและกราฟด้านล่างสามารถดูได้ตามปกติจากแคชในเครื่องครับ');
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysis(true);
    setInlineAnalysis('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'วิเคราะห์เชิงลึกสถานะคลังสินค้า Store FL.6 และแนวโน้มการใช้อะไหล่ พร้อมแผนการสั่งซื้อด่วนและข้อเสนอแนะเชิงกลยุทธ์ โดยจัดย่อหน้าเว้นวรรคให้โปร่งตา ใช้สัญลักษณ์และอิโมจิหัวข้อชัดเจน น่าอ่าน',
          items,
          requisitions: currentMonthRequisitions,
        }),
      });

      if (!res.ok) throw new Error('Network error');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');
      const decoder = new TextDecoder();
      let done = false;
      let textBuffer = '';
      let jsonBuffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          jsonBuffer += chunk;
          const parts = jsonBuffer.split('\n\n');
          jsonBuffer = parts.pop() || '';
          for (const part of parts) {
            if (part.startsWith('data: ')) {
              try {
                const data = JSON.parse(part.slice(6));
                if (data.type === 'chunk') {
                  textBuffer += data.text;
                  setInlineAnalysis(textBuffer);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (err) {
      setInlineAnalysis('เกิดข้อผิดพลาดในการวิเคราะห์ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 md:p-6 pt-3 sm:pt-4 space-y-4.5 pb-28 sm:pb-32 max-w-7xl mx-auto w-full transition-colors duration-200">
      {/* Top Header Card */}
      <div className="liquid-glass-card rounded-[32px] p-5 sm:p-6 shadow-xl relative overflow-hidden border border-white/70 dark:border-white/10">
        {/* Specular top highlight */}
        <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent pointer-events-none rounded-full" />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-extrabold tracking-wider uppercase">
              Store Database
            </span>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">ภาพรวมคลังสินค้า</h1>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 rounded-2xl liquid-glass-pill hover:bg-white/80 dark:hover:bg-slate-700 active:scale-95 transition-all text-slate-800 dark:text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm font-bold border border-white/60 dark:border-white/10 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>ซิงค์ชีต</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4.5 leading-relaxed">
          เชื่อมต่อกับ Store Data คลัง Store FL.6 พร้อมอัปเดตและมี AI วิเคราะห์ข้อมูลอัตโนมัติ
        </p>

        {/* 3 Key Metric Blocks */}
        <div className="grid grid-cols-3 gap-2.5 relative z-10">
          <div className="liquid-glass-pill rounded-2xl p-3 sm:p-3.5 border border-white/60 dark:border-white/10 text-center shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-semibold">สินค้าทั้งหมด</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{summary?.totalItems || items.length}</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">SKUs</span>
          </div>

          <div 
            onClick={onFilterLowStock}
            className="bg-amber-500/15 dark:bg-amber-950/40 rounded-2xl p-3 sm:p-3.5 border border-amber-500/30 dark:border-amber-500/30 text-center cursor-pointer active:scale-95 transition-all shadow-xs backdrop-blur-md"
          >
            <span className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 font-bold uppercase tracking-tight block truncate">
              ใกล้หมด/หมดแล้ว
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {lowStockItems.length}
            </span>
            <span className="text-[10px] sm:text-xs text-amber-600/90 dark:text-amber-400/90 block font-bold">กดดูรายการ &gt;</span>
          </div>

          <div className="liquid-glass-pill rounded-2xl p-3 sm:p-3.5 border border-white/60 dark:border-white/10 text-center shadow-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider block font-semibold">จำนวนรวม</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{summary?.totalQty || 0}</span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 block font-medium">หน่วย</span>
          </div>
        </div>
      </div>

      {/* AI Quick Insight Prompt Card */}
      <div className="flex flex-col gap-2">
      <div 
        onClick={handleInlineAnalysis}
        className="liquid-glass-card border border-white/70 dark:border-white/10 rounded-[28px] p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-500/40 active:scale-[0.99] transition-all shadow-md"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 border border-blue-400/40 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg">AI Smart Analysis</h3>
              <span className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 font-extrabold px-2.5 py-0.5 rounded-full border border-blue-400/30">
                Antigravity
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">แตะเพื่อให้ Antigravity Agent วิเคราะห์สถานะคลังสินค้า</p>
          </div>
        </div>
        {isAnalyzing ? <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" /> : (showAnalysis ? <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />)}
      </div>
      
      {showAnalysis && (
        <div className="liquid-glass-card border border-blue-400/40 dark:border-blue-500/30 rounded-[28px] p-5 sm:p-6 shadow-xl animate-in fade-in slide-in-from-top-2 backdrop-blur-2xl">
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/40 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs border border-blue-400/40 shadow-xs shrink-0">
                AI
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">รายงานวิเคราะห์เชิงลึก (Antigravity Engine)</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">อัปเดตตามข้อมูลสต็อกและประวัติการเบิกใช้จริง</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInlineAnalysis('');
                setIsAnalyzing(false);
                setTimeout(() => handleInlineAnalysis(), 50);
              }}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-blue-600 dark:text-blue-400 liquid-glass-pill border border-blue-400/30 hover:bg-blue-500/10 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>วิเคราะห์ใหม่</span>
            </button>
          </div>

          {isAnalyzing && !inlineAnalysis ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-6">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs sm:text-sm">Antigravity Agent กำลังประมวลผลข้อมูลคลังสินค้า...</p>
                <p className="text-xs text-slate-400 mt-0.5">คำนวณอัตราหมุนเวียน ดัชนีสุขภาพ และจุดสั่งซื้อฉุกเฉิน</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-2.5 prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5">
              <ReactMarkdown>{inlineAnalysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Responsive Analytics & Breakdown Grid (1 col on phone, 2 cols on tablet/desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4.5">
        {/* Low Stock Alert Section */}
        {lowStockItems.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border border-white/70 dark:border-white/10 p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">รายการสต็อกที่ต้องเติม ({lowStockItems.length})</h2>
              </div>
              <button
                onClick={onFilterLowStock}
                className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
              >
                ดูทั้งหมด
              </button>
            </div>

            <div className="space-y-2.5">
              {lowStockItems.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-amber-500/10 dark:bg-amber-950/30 hover:bg-amber-500/20 dark:hover:bg-amber-950/50 border border-amber-400/30 dark:border-amber-700/40 rounded-2xl p-3 flex items-center justify-between cursor-pointer transition-all active:scale-98 shadow-2xs backdrop-blur-md"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.id} • {item.category} • ที่เก็บ: {item.location}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 block">
                      เหลือ {item.qty} {item.unit}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">Min: {item.minStock}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown Section */}
        <div className="liquid-glass-card rounded-[28px] border border-white/70 dark:border-white/10 p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3.5">
            <Layers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">สัดส่วนสินค้าตามหมวดหมู่</h2>
          </div>

          <div className="space-y-2.5">
            {summary?.categories.map((cat) => {
              const percentage = Math.round((cat.count / (summary.totalItems || 1)) * 100);
              return (
                <div
                  key={cat.name}
                  onClick={() => onSelectCategory(cat.name)}
                  className="p-2.5 rounded-2xl hover:bg-blue-500/10 dark:hover:bg-slate-800/80 border border-transparent hover:border-white/40 dark:hover:border-white/10 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{cat.name}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      {cat.count} รายการ ({cat.totalQty} ชิ้น)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/50 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden border border-white/40 dark:border-white/10">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Analytics: Top Items This Month */}
        {topItemsThisMonth.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border border-white/70 dark:border-white/10 p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">รายการเบิกสูงสุดเดือนนี้</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItemsThisMonth} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(16px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', backgroundColor: 'rgba(15,23,42,0.85)', color: '#f8fafc' }} />
                  <Bar dataKey="qty" name="จำนวนที่เบิก" fill="#10B981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Analytics: Monthly Trend */}
        {monthlyTrend.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border border-white/70 dark:border-white/10 p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">แนวโน้มการเบิกจ่าย (ยอดรวม)</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'rgba(100,116,139,0.08)'}} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(16px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', backgroundColor: 'rgba(15,23,42,0.85)', color: '#f8fafc' }} />
                  <Bar dataKey="qty" name="จำนวนรวม" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Analytics: Out of Stock Duration */}
        {outOfStockDurations.length > 0 && (
          <div className="liquid-glass-card rounded-[28px] border border-white/70 dark:border-white/10 p-5 shadow-lg lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">สินค้าหมดสต๊อกนานที่สุด (วัน)</h2>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outOfStockDurations} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <RechartsTooltip cursor={{fill: 'rgba(100,116,139,0.08)'}} contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(16px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)', backgroundColor: 'rgba(15,23,42,0.85)', color: '#f8fafc' }} />
                  <Bar dataKey="days" name="จำนวนวัน" fill="#EF4444" radius={[6, 6, 0, 0]}>
                    {outOfStockDurations.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.days > 7 ? '#EF4444' : '#F87171'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
