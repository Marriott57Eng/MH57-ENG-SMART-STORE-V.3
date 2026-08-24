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
    <div className="p-4 pt-safe-content space-y-4 pb-24 bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      {/* Top Header Card */}
      <div className="bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-950 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950/80 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden border border-slate-700/80 dark:border-slate-700">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
        
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div>
            <span className="text-xs text-blue-300 dark:text-blue-400 font-semibold tracking-wider uppercase">
              Store Database
            </span>
            <h1 className="text-lg font-bold tracking-tight">ภาพรวมคลังสินค้า</h1>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-1.5 text-lg border border-white/20 dark:border-slate-600 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>ซิงค์ชีต</span>
          </button>
        </div>

        <p className="text-lg text-slate-300 dark:text-slate-300 mb-4 leading-relaxed">
          เชื่อมต่อกับ Store Data คลัง Store FL.6 พร้อมอัปเดตและมี AI วิเคราะห์ข้อมูลอัตโนมัติ
        </p>

        {/* 3 Key Metric Blocks */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          <div className="bg-white/10 dark:bg-slate-800/80 backdrop-blur-md rounded-xl p-2.5 border border-white/25 dark:border-slate-600/80 text-center shadow-xs">
            <span className="text-xs text-slate-300 uppercase tracking-wider block">สินค้าทั้งหมด</span>
            <span className="text-lg font-extrabold text-white">{summary?.totalItems || items.length}</span>
            <span className="text-sm text-slate-400 block">SKUs</span>
          </div>

          <div 
            onClick={onFilterLowStock}
            className="bg-amber-500/20 dark:bg-amber-950/60 backdrop-blur-md rounded-xl p-2.5 border border-amber-400/50 dark:border-amber-500/70 text-center cursor-pointer active:scale-95 transition-transform shadow-xs"
          >
            <span className="text-[11px] sm:text-xs text-amber-200 dark:text-amber-300 font-semibold uppercase tracking-tight block truncate">
              สต๊อกใกล้หมดและหมดแล้ว
            </span>
            <span className="text-lg font-extrabold text-amber-300 dark:text-amber-300">
              {lowStockItems.length}
            </span>
            <span className="text-xs text-amber-200/80 dark:text-amber-300/80 block">กดดูรายการ &gt;</span>
          </div>

          <div className="bg-white/10 dark:bg-slate-800/80 backdrop-blur-md rounded-xl p-2.5 border border-white/25 dark:border-slate-600/80 text-center shadow-xs">
            <span className="text-xs text-slate-300 uppercase tracking-wider block">จำนวนรวม</span>
            <span className="text-lg font-extrabold text-white">{summary?.totalQty || 0}</span>
            <span className="text-sm text-slate-400 block">หน่วย</span>
          </div>
        </div>
      </div>

      {/* AI Quick Insight Prompt Card */}
      <div className="flex flex-col gap-2">
      <div 
        onClick={handleInlineAnalysis}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-blue-950/40 border border-blue-300 dark:border-blue-700/80 rounded-3xl p-5 flex items-center justify-between cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 active:scale-[0.99] transition-all shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm border border-blue-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xl">AI Smart Analysis</h3>
              <span className="text-[10px] bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-300 dark:border-blue-700">
                Antigravity
              </span>
            </div>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">แตะเพื่อให้ Antigravity Agent วิเคราะห์สถานะคลังสินค้า</p>
          </div>
        </div>
        {isAnalyzing ? <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" /> : (showAnalysis ? <ChevronUp className="w-6 h-6 text-blue-600 dark:text-blue-400" /> : <ChevronDown className="w-6 h-6 text-blue-600 dark:text-blue-400" />)}
      </div>
      
      {showAnalysis && (
        <div className="bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700/80 rounded-3xl p-5 md:p-6 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-200 dark:border-blue-800">
                AI
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm md:text-base">รายงานวิเคราะห์เชิงลึก (Antigravity Engine)</h4>
                <p className="text-xs text-slate-400">อัปเดตตามข้อมูลสต็อกและประวัติการเบิกใช้จริง</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInlineAnalysis('');
                setIsAnalyzing(false);
                setTimeout(() => handleInlineAnalysis(), 50);
              }}
              disabled={isAnalyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>วิเคราะห์ใหม่</span>
            </button>
          </div>

          {isAnalyzing && !inlineAnalysis ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Antigravity Agent กำลังประมวลผลข้อมูลคลังสินค้า...</p>
                <p className="text-xs text-slate-400 mt-0.5">คำนวณอัตราหมุนเวียน ดัชนีสุขภาพ และจุดสั่งซื้อฉุกเฉิน</p>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none text-sm md:text-base leading-relaxed space-y-3 prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
              <ReactMarkdown>{inlineAnalysis}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Low Stock Alert Section */}
      {lowStockItems.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">รายการสต็อกที่ต้องเติม ({lowStockItems.length})</h2>
            </div>
            <button
              onClick={onFilterLowStock}
              className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
            >
              ดูทั้งหมด
            </button>
          </div>

          <div className="space-y-2">
            {lowStockItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 border border-amber-300 dark:border-amber-700/70 rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-colors shadow-2xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-lg truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {item.id} • {item.category} • ที่เก็บ: {item.location}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-400 block">
                    เหลือ {item.qty} {item.unit}
                  </span>
                  <span className="text-sm text-slate-400 dark:text-slate-500">Min: {item.minStock}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">สัดส่วนสินค้าตามหมวดหมู่</h2>
        </div>

        <div className="space-y-2.5">
          {summary?.categories.map((cat) => {
            const percentage = Math.round((cat.count / (summary.totalItems || 1)) * 100);
            return (
              <div
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className="p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-lg mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {cat.count} รายการ ({cat.totalQty} ชิ้น)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700/60">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">รายการเบิกสูงสุดเดือนนี้</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItemsThisMonth} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.3} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: '1px solid #475569', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.2)', backgroundColor: '#1e293b', color: '#f8fafc' }} />
                <Bar dataKey="qty" name="จำนวนที่เบิก" fill="#10B981" radius={[0, 4, 4, 0]}>
                  {topItemsThisMonth.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analytics: Monthly Trend */}
      {monthlyTrend.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">แนวโน้มการเบิกจ่าย (ยอดรวม)</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <RechartsTooltip cursor={{fill: 'rgba(100,116,139,0.1)'}} contentStyle={{ borderRadius: '12px', border: '1px solid #475569', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.2)', backgroundColor: '#1e293b', color: '#f8fafc' }} />
                <Bar dataKey="qty" name="จำนวนรวม" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Analytics: Out of Stock Duration */}
      {outOfStockDurations.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-lg">สินค้าหมดสต๊อกนานที่สุด (วัน)</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outOfStockDurations} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <RechartsTooltip cursor={{fill: 'rgba(100,116,139,0.1)'}} contentStyle={{ borderRadius: '12px', border: '1px solid #475569', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.2)', backgroundColor: '#1e293b', color: '#f8fafc' }} />
                <Bar dataKey="days" name="จำนวนวัน" fill="#EF4444" radius={[4, 4, 0, 0]}>
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
  );
};
