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
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
      className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-300 dark:border-slate-750 px-1.5 pt-1.5 flex items-center justify-around z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-colors duration-200"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (tab.isCenter) {
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative -top-3.5 flex flex-col items-center justify-center transition-transform active:scale-90 px-1 cursor-pointer"
            >
              {isLiveActive && (
                <span className="absolute -top-1 right-0 flex h-3.5 w-3.5 z-20">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 ring-2 ring-white dark:ring-slate-900"></span>
                </span>
              )}
              <motion.div
                whileTap={{ scale: 0.92 }}
                className={`w-13 h-13 sm:w-15 sm:h-15 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                  isLiveActive
                    ? 'bg-gradient-to-tr from-red-500 to-purple-600 text-white shadow-red-500/40 ring-4 ring-red-200 dark:ring-red-950 animate-pulse'
                    : isActive
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/30 ring-4 ring-blue-100 dark:ring-blue-900/50 scale-105'
                    : 'bg-slate-900 dark:bg-slate-800 text-white shadow-slate-300 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700'
                }`}
              >
                <Icon className="w-6 h-6 sm:w-6.5 sm:h-6.5" />
              </motion.div>
              <span
                className={`text-[10.5px] sm:text-[11.5px] font-bold mt-1 tracking-tight transition-colors duration-150 ${
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
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl relative transition-all duration-150 cursor-pointer ${
              isActive
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeNavBackground"
                className="absolute inset-0 bg-blue-50/80 dark:bg-blue-950/50 rounded-xl -z-10"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            <Icon className={`w-5 h-5 mb-0.5 transition-transform duration-150 ${isActive ? 'stroke-[2.5] scale-110' : 'stroke-[1.8]'}`} />
            <span className={`text-[10px] tracking-tight transition-all duration-150 ${isActive ? 'font-bold' : 'font-normal'}`}>
              {tab.label}
            </span>

            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="absolute top-0 right-0.5 px-1 min-w-[14px] h-[14px] text-[8px] font-extrabold bg-blue-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}

            {tab.dot && (
              <span className="absolute top-0.5 right-1 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

