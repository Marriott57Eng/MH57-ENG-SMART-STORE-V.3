import React from 'react';
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
  return (
    <nav 
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
      className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-1 pt-1.5 flex items-center justify-around z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-colors duration-200"
    >
      {/* 1. Inventory Tab */}
      <button
        onClick={() => setActiveTab('inventory')}
        className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
          activeTab === 'inventory'
            ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Package className={`w-5 h-5 mb-0.5 ${activeTab === 'inventory' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] tracking-tight">อะไหล่ทั้งหมด</span>
      </button>

      {/* 2. Requisition History Tab */}
      <button
        onClick={() => setActiveTab('history')}
        className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl relative transition-all cursor-pointer ${
          activeTab === 'history'
            ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <ClipboardList className={`w-5 h-5 mb-0.5 ${activeTab === 'history' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] tracking-tight">เบิก/รับ</span>
        {requisitionCount > 0 && (
          <span className="absolute top-0 right-0 px-1 min-w-[14px] h-[14px] text-[8px] font-extrabold bg-blue-600 text-white rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {requisitionCount > 99 ? '99+' : requisitionCount}
          </span>
        )}
      </button>

      {/* 3. AI Assistant Tab (Center Highlighted Button) */}
      <button
        onClick={() => setActiveTab('voice')}
        className={`relative -top-4 flex flex-col items-center justify-center transition-transform active:scale-95 px-1 cursor-pointer`}
      >
        {isLiveActive && (
          <span className="absolute -top-1 right-0 flex h-3 w-3 z-20">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        )}
        <div
          className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
            isLiveActive
              ? 'bg-gradient-to-tr from-red-500 to-purple-600 text-white shadow-red-500/40 ring-4 ring-red-200 dark:ring-red-950 animate-pulse'
              : activeTab === 'voice'
              ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/30 ring-4 ring-blue-100 dark:ring-blue-900/50'
              : 'bg-slate-900 dark:bg-slate-800 text-white shadow-slate-300 dark:shadow-none hover:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700'
          }`}
        >
          <Bot className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>
        <span
          className={`text-[11px] sm:text-[12px] font-bold mt-1 ${
            isLiveActive
              ? 'text-red-600 dark:text-red-400 animate-pulse'
              : activeTab === 'voice'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {isLiveActive ? '🔴 คุยสด AI' : 'ถาม AI'}
        </span>
      </button>

      {/* 4. Dashboard Tab */}
      <button
        onClick={() => setActiveTab('dashboard')}
        className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl relative transition-all cursor-pointer ${
          activeTab === 'dashboard'
            ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <BarChart3 className={`w-5 h-5 mb-0.5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] tracking-tight">ภาพรวม</span>
        {lowStockCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
        )}
      </button>

      {/* 5. Categories Tab */}
      <button
        onClick={() => setActiveTab('categories')}
        className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
          activeTab === 'categories'
            ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Layers className={`w-5 h-5 mb-0.5 ${activeTab === 'categories' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
        <span className="text-[10px] tracking-tight">หมวด</span>
      </button>
      
      {/* 6. Users Tab (Admin Only) */}
      {isAdmin && (
        <button
          onClick={() => setActiveTab('users')}
          className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'text-blue-600 dark:text-blue-400 font-bold scale-105'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className={`w-5 h-5 mb-0.5 ${activeTab === 'users' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
          <span className="text-[10px] tracking-tight">ผู้ใช้</span>
        </button>
      )}
    </nav>
  );
};
