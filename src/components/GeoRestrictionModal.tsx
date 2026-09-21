import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, X, Navigation } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import { STORE_LOCATION, MAX_DISTANCE_METERS } from '../utils/geo';

export interface GeoModalState {
  isOpen: boolean;
  type: 'login_notice' | 'action_blocked' | 'permission_denied' | 'unsupported';
  distance?: number;
  message?: string;
}

interface GeoRestrictionModalProps {
  state: GeoModalState;
  onClose: () => void;
  onRetry?: () => void;
  isChecking?: boolean;
}

export const GeoRestrictionModal: React.FC<GeoRestrictionModalProps> = ({
  state,
  onClose,
  onRetry,
  isChecking = false,
}) => {
  useScrollLock(state.isOpen);

  if (!state.isOpen) return null;

  const isPermission = state.type === 'permission_denied';
  const isActionBlocked = state.type === 'action_blocked';
  const isLoginNotice = state.type === 'login_notice';

  const modalContent = (
    <div 
      id="geo-restriction-modal-overlay"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 overflow-y-auto transform-gpu overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ willChange: 'transform, opacity' }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-red-200 dark:border-red-900/60 shadow-2xl overflow-hidden p-6 sm:p-7 text-center transform-gpu"
      >
          {/* Close button */}
          <button
            id="close-geo-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Icon */}
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/70 border border-red-200 dark:border-red-800/80 flex items-center justify-center text-red-600 dark:text-red-400 shadow-inner">
            {isPermission ? (
              <ShieldAlert className="w-8 h-8 animate-pulse" />
            ) : isActionBlocked ? (
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            ) : (
              <MapPin className="w-8 h-8 text-amber-500 animate-pulse" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            {isPermission
              ? 'ยังไม่ได้รับอนุญาตระบุตำแหน่ง'
              : isActionBlocked
              ? 'ไม่สามารถทำรายการได้'
              : 'แจ้งเตือน: อยู่นอกพื้นที่ทำงาน'}
          </h3>

          {/* Subtitle / Description */}
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5">
            {state.message || (
              isActionBlocked
                ? 'ไม่สามารถทำรายการเบิกหรือรับเข้าสินค้าได้ เนื่องจากคุณอยู่นอกพื้นที่ทำงานที่กำหนด'
                : isPermission
                ? 'กรุณากดอนุญาตการเข้าถึงตำแหน่ง (Location) บนเบราว์เซอร์หรืออุปกรณ์ เพื่อยืนยันว่าคุณอยู่ในพื้นที่ทำงาน'
                : 'คุณอยู่นอกพื้นที่ทำงาน ระบบอนุญาตให้เข้าดูข้อมูลได้เท่านั้น และจะไม่สามารถทำรายการเบิกหรือรับเข้าได้'
            )}
          </p>

          {/* Info Card Box */}
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 text-left space-y-2.5 mb-6 text-xs sm:text-sm">
            <div className="flex items-start gap-2 text-slate-700 dark:text-slate-200">
              <Navigation className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">สถานที่ทำงาน:</span>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Bangkok Marriott Hotel Sukhumvit (สุขุมวิท 57)</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-500 dark:text-slate-400">รัศมีที่อนุญาต:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                ไม่เกิน {MAX_DISTANCE_METERS} เมตร
              </span>
            </div>

            {typeof state.distance === 'number' && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400">ระยะห่างปัจจุบัน:</span>
                <span className={`font-bold px-2 py-0.5 rounded-md ${
                  state.distance <= MAX_DISTANCE_METERS
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                    : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60'
                }`}>
                  ~{Math.round(state.distance).toLocaleString()} เมตร
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            {onRetry && (
              <button
                id="retry-geo-check-btn"
                type="button"
                onClick={onRetry}
                disabled={isChecking}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'กำลังตรวจสอบ...' : 'ตรวจสอบพิกัดอีกครั้ง'}
              </button>
            )}
            
            <button
              id="acknowledge-geo-btn"
              type="button"
              onClick={onClose}
              className={`py-3 px-5 rounded-xl font-semibold text-sm transition-all active:scale-98 cursor-pointer ${
                onRetry
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md'
              }`}
            >
              รับทราบ / ปิด
            </button>
          </div>
        </motion.div>
      </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
