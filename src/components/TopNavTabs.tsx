import React from 'react';
import { Package, ClipboardList, Bot, BarChart3, Layers, ShieldCheck } from 'lucide-react';
import { AppTab } from './MobileNavbar';

interface TopNavTabsProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  requisitionCount?: number;
  lowStockCount?: number;
  isAdmin?: boolean;
  isLiveActive?: boolean;
  className?: string;
}

export const TopNavTabs: React.FC<TopNavTabsProps> = ({
  activeTab,
  setActiveTab,
  requisitionCount = 0,
  lowStockCount = 0,
  isAdmin = false,
  isLiveActive = false,
  className = '',
}) => {
  const tabs = [
    { id: 'inventory' as AppTab, label: 'อะไหล่', icon: Package },
    { 
      id: 'history' as AppTab, 
      label: 'เบิก/รับ', 
      icon: ClipboardList, 
      badge: requisitionCount > 0 ? requisitionCount : undefined 
    },
    { 
      id: 'voice' as AppTab, 
      label: isLiveActive ? 'คุยสด AI' : 'ถาม AI', 
      icon: Bot,
      isLive: isLiveActive 
    },
    { 
      id: 'dashboard' as AppTab, 
      label: 'ภาพรวม', 
      icon: BarChart3, 
      dot: lowStockCount > 0 
    },
    { id: 'categories' as AppTab, label: 'หมวด', icon: Layers },
    ...(isAdmin ? [{ id: 'admin' as AppTab, label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <nav 
      aria-label="Navigation Tabs"
      className={`items-center gap-1 liquid-glass p-1.5 rounded-2xl border border-white/60 dark:border-white/10 shadow-[0_4px_20px_rgba(15,23,42,0.06)] dark:shadow-[0_6px_25px_rgba(0,0,0,0.4)] ${className}`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'admin' && activeTab === 'users');

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer select-none relative shrink-0 ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
            <span>{tab.label}</span>

            {/* Badge for Requisition Count */}
            {tab.badge !== undefined && (
              <span 
                className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold shadow-2xs ${
                  isActive 
                    ? 'bg-white text-blue-700' 
                    : 'bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300'
                }`}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}

            {/* Live active voice pulsating indicator */}
            {tab.isLive && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute -top-0.5 -right-0.5" />
            )}

            {/* Alert dot for low stock on dashboard */}
            {tab.dot && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1 right-1 shadow-xs" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
