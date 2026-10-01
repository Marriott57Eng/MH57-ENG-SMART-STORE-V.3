import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Package, BarChart3, Bot, ClipboardList, Layers, ShieldCheck, ShoppingCart } from 'lucide-react';

export type AppTab = 'inventory' | 'history' | 'orders' | 'voice' | 'dashboard' | 'categories' | 'admin' | 'users';

interface MobileNavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  lowStockCount?: number;
  requisitionCount?: number;
  pendingOrdersCount?: number;
  isAdmin?: boolean;
  isLiveActive?: boolean;
}

interface NavItem {
  id: AppTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  dot?: boolean;
  isCenter?: boolean;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount = 0,
  requisitionCount = 0,
  pendingOrdersCount = 0,
  isAdmin = false,
  isLiveActive = false,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // For regular user: exactly 5 items (2 on left, AI in center, 2 on right)
  // For admin user: exactly 7 items (3 on left, AI in center, 3 on right)
  const tabs: NavItem[] = isAdmin
    ? [
        { id: 'inventory', label: 'อะไหล่', icon: Package },
        { id: 'history', label: 'เบิก/รับ', icon: ClipboardList, badge: requisitionCount },
        { id: 'categories', label: 'หมวด', icon: Layers },
        { id: 'voice', label: isLiveActive ? '🔴 คุยสด AI' : 'ถาม AI', icon: Bot, isCenter: true },
        { id: 'orders', label: 'สั่งของ', icon: ShoppingCart, badge: pendingOrdersCount },
        { id: 'dashboard', label: 'ภาพรวม', icon: BarChart3, dot: lowStockCount > 0 },
        { id: 'admin', label: 'Admin', icon: ShieldCheck },
      ]
    : [
        { id: 'inventory', label: 'อะไหล่', icon: Package },
        { id: 'history', label: 'เบิก/รับ', icon: ClipboardList, badge: requisitionCount },
        { id: 'voice', label: isLiveActive ? '🔴 คุยสด AI' : 'ถาม AI', icon: Bot, isCenter: true },
        { id: 'orders', label: 'สั่งของ', icon: ShoppingCart, badge: pendingOrdersCount },
        { id: 'dashboard', label: 'ภาพรวม', icon: BarChart3, dot: lowStockCount > 0 },
      ];

  const navContent = (
    <nav 
      aria-label="เมนูหลักด้านล่าง"
      style={{
        position: 'fixed',
        bottom: 'max(8px, calc(env(safe-area-inset-bottom, 0px) * 0.4 + 6px))',
        left: '50%',
        transform: 'translateX(-50%)',
        WebkitTransform: 'translateX(-50%)',
        paddingBottom: 'max(6px, calc(env(safe-area-inset-bottom, 0px) * 0.3 + 4px))',
        paddingLeft: 'max(10px, env(safe-area-inset-left, 8px))',
        paddingRight: 'max(10px, env(safe-area-inset-right, 8px))',
        zIndex: 60,
      }}
      className="flex w-[calc(100%-16px)] sm:w-[calc(100%-28px)] max-w-lg sm:max-w-xl md:max-w-2xl liquid-glass rounded-[28px] sm:rounded-[32px] px-2 sm:px-3.5 pt-1.5 sm:pt-2 items-center justify-around shadow-[0_16px_45px_rgba(15,23,42,0.18)] dark:shadow-[0_20px_55px_rgba(0,0,0,0.75)] border border-white/70 dark:border-white/15 pointer-events-auto select-none transition-transform"
    >
      {/* Specular top sheen line */}
      <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent pointer-events-none rounded-full" />

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'admin' && activeTab === 'users');

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="relative -top-4 sm:-top-5 flex flex-col items-center justify-center transition-transform active:scale-95 px-1 cursor-pointer shrink-0"
              aria-label={tab.label}
            >
              {isLiveActive && (
                <span className="absolute -top-1 right-0 flex h-4 w-4 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
                </span>
              )}
              <motion.div
                whileTap={{ scale: 0.92 }}
                className={`w-[52px] h-[52px] sm:w-[64px] sm:h-[64px] rounded-full flex items-center justify-center shadow-xl transition-all duration-200 relative overflow-hidden ${
                  isLiveActive
                    ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/40 ring-4 ring-red-200/80 dark:ring-red-950/90 animate-pulse'
                    : isActive
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-blue-500/40 ring-4 ring-blue-100/90 dark:ring-blue-900/60 scale-105'
                    : 'bg-gradient-to-br from-slate-800 to-slate-950 text-white shadow-slate-900/25 dark:shadow-none hover:from-slate-700 hover:to-slate-900 border border-white/20 dark:border-white/10'
                }`}
              >
                {/* Specular glare inside orb */}
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent rounded-t-full pointer-events-none" />
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 relative z-10" />
              </motion.div>
              <span
                className={`text-[11px] sm:text-[12px] font-bold mt-0.5 tracking-tight transition-colors duration-150 ${
                  isLiveActive
                    ? 'text-red-600 dark:text-red-400 animate-pulse'
                    : isActive
                    ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-1 sm:py-1.5 px-0.5 sm:px-1 rounded-2xl relative transition-all duration-150 cursor-pointer min-h-[44px] sm:min-h-[52px] ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            aria-label={tab.label}
          >
            {isActive && (
              <motion.div
                layoutId="activeNavBackground"
                className="absolute inset-0 bg-blue-500/12 dark:bg-blue-400/15 backdrop-blur-md rounded-2xl -z-10 border border-blue-500/25 dark:border-blue-400/25 shadow-xs"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon className={`w-5 h-5 sm:w-5.5 sm:h-5.5 mb-0.5 transition-transform duration-150 ${isActive ? 'stroke-[2.5] scale-110' : 'stroke-[1.9]'}`} />
            <span className={`text-[10px] sm:text-[11px] tracking-tight transition-all duration-150 whitespace-nowrap ${isActive ? 'font-bold text-blue-600 dark:text-blue-400' : 'font-medium'}`}>
              {tab.label}
            </span>

            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute top-0.5 sm:top-1 right-1 sm:right-1.5 px-1.5 min-w-[16px] sm:min-w-[18px] h-4 sm:h-[18px] text-[9px] sm:text-[10px] font-extrabold bg-blue-600 text-white rounded-full flex items-center justify-center ring-2 ring-white/90 dark:ring-slate-900/90 shadow-xs">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}

            {tab.dot && (
              <span className="absolute top-1 sm:top-1.5 right-1.5 sm:right-2 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-amber-500 rounded-full ring-2 ring-white/90 dark:ring-slate-900/90 animate-pulse shadow-xs" />
            )}
          </button>
        );
      })}
    </nav>
  );

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(navContent, document.body);
};
