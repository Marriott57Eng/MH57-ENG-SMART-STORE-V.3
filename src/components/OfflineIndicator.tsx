import React, { useEffect, useState } from 'react';
import { WifiOff, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useScrollLock } from '../hooks/useScrollLock';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline, resetWasOffline } = useOnlineStatus();
  const [showDetails, setShowDetails] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useScrollLock(showDetails);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
        resetWasOffline();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, resetWasOffline]);

  return (
    <>
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-[90] w-[94%] max-w-md px-2 pointer-events-none"
          >
            <div className="pointer-events-auto bg-amber-500/95 dark:bg-amber-600/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-lg shadow-amber-500/20 border border-amber-400/50 flex items-center justify-between gap-2 text-xs font-semibold">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                </span>
                <WifiOff className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  โหมดออฟไลน์ — ใช้งานข้อมูลจากแคชในเครื่อง
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="shrink-0 bg-white/20 hover:bg-white/30 active:scale-95 px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="รายละเอียดโหมดออฟไลน์"
              >
                <span>รายละเอียด</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restored Connection Toast */}
      <AnimatePresence>
        {showRestored && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-[90] w-[94%] max-w-md px-2 pointer-events-none"
          >
            <div className="pointer-events-auto bg-emerald-600/95 dark:bg-emerald-600/95 backdrop-blur-md text-white px-3.5 py-2 rounded-2xl shadow-lg shadow-emerald-600/20 border border-emerald-400/50 flex items-center justify-between gap-2 text-xs font-semibold">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-100 shrink-0" />
                <span className="truncate">
                  กลับมาเชื่อมต่อเครือข่ายแล้ว — ระบบพร้อมซิงค์ข้อมูล
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRestored(false);
                  resetWasOffline();
                }}
                className="p-1 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline Details Modal */}
      <AnimatePresence>
        {showDetails && (
          <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 overscroll-contain"
            onTouchMove={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetails(false)}
              style={{ willChange: 'opacity' }}
              className="fixed inset-0 bg-slate-950/80 transform-gpu touch-none"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{ willChange: 'transform, opacity' }}
              className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-5 transform-gpu"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <WifiOff className="w-4 h-4" />
                  </div>
                  <span>ความสามารถในโหมดออฟไลน์</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-800 dark:text-slate-200 font-bold mb-0.5">
                      ดูข้อมูลสินค้าและประวัติ:
                    </strong>
                    แอปแคชข้อมูลสินค้า รายการเบิก สรุปยอดสต็อก และหน้าจอทั้งหมดไว้ในเครื่อง สามารถค้นหา ตรวจสอบจุด Min Stock และเปิดดูประวัติได้ตามปกติ
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-slate-800 dark:text-slate-200 font-bold mb-0.5">
                      เบิกของและรับเข้า (0ms Optimistic):
                    </strong>
                    เมื่อทำรายการเบิก ยอดสต็อกจะถูกตัดทอนในเครื่องทันที และบันทึกประวัติไว้ในคลังความจำเครื่อง เพื่อส่งต่อไปยังฐานข้อมูลเมื่อเน็ตกลับมา
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 text-center">
                  * ฟีเจอร์ AI Voice คุยสด และ AI Analyze รายงานเชิงลึก จำเป็นต้องใช้อินเทอร์เน็ต
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="mt-4 w-full py-2.5 px-4 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                เข้าใจแล้ว
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
