import React from 'react';
import { motion } from 'motion/react';
import { Package, BarChart3, Bot, ClipboardList, Layers, Users } from 'lucide-react';

export type AppTab = 'inventory' | 'history' | 'voice' | 'dashboard' | 'categories' | 'users';

interface MobileNavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  lowStockCount?: number;
  requisitionCount?: number;
  isAdmin?: boolean;
  isLiveActive?: boolean;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({
  activeTab,
  setActiveTab,
  lowStockCount = 0,
  requisitionCount = 0,
  isAdmin = false,
  isLiveActive = false,
}) => {
  const tabs = [
    { id: 'inventory' as AppTab, label: 'อะไหล่ทั้งหมด', icon: Package },
    { id: 'history' as AppTab, label: 'เบิก/รับ', icon: ClipboardList, badge: requisitionCount },
    { id: 'voice' as AppTab, label: isLiveActive ? '🔴 คุยสดกับ AI' : 'ถาม AI', icon: Bot, isCenter: true },
    { id: 'dashboard' as AppTab, label: 'ภาพรวม', icon: BarChart3, dot: lowStockCount > 0 },
    { id: 'categories' as AppTab, label: 'หมวด', icon: Layers },
    ...(isAdmin ? [{ id: 'users' as AppTab, label: 'ผู้ใช้', icon: Users }] : []),
  ];

  return (
    <nav 
      style={{
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
      className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-1.5 sm:px-3 pt-2 sm:pt-2.5 flex items-center justify-around z-50 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.45)] transition-colors duration-200"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative -top-5 sm:-top-5.5 flex flex-col items-center justify-center transition-transform active:scale-95 px-1 cursor-pointer shrink-0"
            >
              {isLiveActive && (
                <span className="absolute -top-1 right-0 flex h-4 w-4 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
                </span>
              )}
              <motion.div
                whileTap={{ scale: 0.92 }}
                className={`w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${
                  isLiveActive
                    ? 'bg-gradient-to-tr from-red-500 via-rose-500 to-purple-600 text-white shadow-red-500/40 ring-4 ring-red-200 dark:ring-red-950 animate-pulse'
                    : isActive
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/45 ring-4 ring-blue-100 dark:ring-blue-900/60 scale-105'
                    : 'bg-slate-900 dark:bg-slate-800 text-white shadow-slate-400/20 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 dark:border-slate-700'
                }`}
              >
                <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
              </motion.div>
              <span
                className={`text-xs sm:text-[13px] font-bold mt-1 tracking-tight transition-colors duration-150 ${
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
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl relative transition-all duration-150 cursor-pointer min-h-[54px] sm:min-h-[58px] ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeNavBackground"
                className="absolute inset-0 bg-blue-50/90 dark:bg-blue-950/60 rounded-2xl -z-10 border border-blue-200/60 dark:border-blue-800/50"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <Icon className={`w-[22px] h-[22px] sm:w-6 sm:h-6 mb-1 transition-transform duration-150 ${isActive ? 'stroke-[2.5] scale-110' : 'stroke-[1.9]'}`} />
            <span className={`text-[11.5px] sm:text-xs tracking-tight transition-all duration-150 whitespace-nowrap ${isActive ? 'font-bold text-blue-600 dark:text-blue-400' : 'font-medium'}`}>
              {tab.label}
            </span>

            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute top-1 right-1.5 px-1.5 min-w-[18px] h-[18px] text-[9.5px] sm:text-[10px] font-extrabold bg-blue-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 shadow-xs">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}

            {tab.dot && (
              <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse shadow-xs" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

