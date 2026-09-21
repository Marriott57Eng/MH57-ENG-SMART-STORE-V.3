import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useScrollLock } from '../hooks/useScrollLock';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'menu' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useScrollLock(showIOSGuide);

  // If already running in standalone PWA mode, don't show the prompt
  if (isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {isInstallable ? (
        <button
          type="button"
          onClick={handleInstall}
          disabled={isInstalling}
          className={`p-1.5 sm:p-2 px-2 sm:px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white active:scale-95 transition-all text-xs sm:text-sm font-bold flex items-center gap-1.5 border border-blue-500 dark:border-blue-400 shadow-xs cursor-pointer ${className}`}
          title="ติดตั้งแอป ENG Store ลงบนอุปกรณ์เพื่อใช้งานออฟไลน์เต็มรูปแบบ"
        >
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">ติดตั้งแอป</span>
        </button>
      ) : isIOS ? (
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`p-1.5 sm:p-2 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 active:scale-95 transition-all text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer ${className}`}
          title="วิธีติดตั้งบน iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">ติดตั้งบน iOS</span>
        </button>
      ) : null}

      {/* iOS Safari Installation Guide Modal */}
      <AnimatePresence>
        {showIOSGuide && (
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
              onClick={() => setShowIOSGuide(false)}
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
                  <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <span>ติดตั้งบน iPhone / iPad</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <p className="text-slate-500 dark:text-slate-400">
                  สำหรับ Safari บน iOS สามารถติดตั้งแอปเพื่อเปิดใช้งานแบบเต็มหน้าจอ (Standalone) และใช้งานออฟไลน์ได้ดังนี้:
                </p>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                      1
                    </div>
                    <div>
                      แตะที่ปุ่ม <strong className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">แชร์ (Share) <Share2 className="w-3 h-3 inline" /></strong> ที่แถบเครื่องมือของ Safari ด้านล่าง
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold text-xs">
                      2
                    </div>
                    <div>
                      เลื่อนลงมาแล้วเลือก <strong className="text-slate-800 dark:text-slate-100 inline-flex items-center gap-1">"เพิ่มไปยังหน้าจอโฮม" <PlusSquare className="w-3 h-3 inline" /></strong> (Add to Home Screen)
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      กดปุ่ม <strong>"เพิ่ม" (Add)</strong> ที่มุมบนขวา ไอคอนแอป ENG Store จะปรากฏบนหน้าจอโฮมพร้อมใช้งานทันที
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
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
