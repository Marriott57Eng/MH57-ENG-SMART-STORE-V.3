import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  PackagePlus, 
  Bell, 
  FileDown, 
  AlertTriangle, 
  Package, 
  ClipboardList, 
  ExternalLink,
  CheckCircle2,
  Database,
  MapPin,
  Smartphone,
  Layers,
  ArrowRight,
  Shield,
  Radio,
  Sliders,
  Sparkles,
  BarChart3,
  ShoppingCart
} from 'lucide-react';
import { User, InventoryItem, RequisitionRecord, InventorySummary, PurchaseOrder } from '../types';
import { UserManagementView } from './UserManagementView';
import { OrdersManagementView } from './OrdersManagementView';

export interface AdminHubViewProps {
  currentUser: User;
  onUpdateCurrentUser?: (user: User) => void;
  onOpenAddItem: () => void;
  onOpenNotificationSettings: (initialTab?: 'webpush' | 'line') => void;
  onExportInventoryPdf: () => void;
  isExportingInventoryPdf?: boolean;
  summary: InventorySummary | null;
  items: InventoryItem[];
  requisitions: RequisitionRecord[];
  onNavigateToTab: (tab: 'inventory' | 'history' | 'dashboard' | 'categories') => void;
  onFilterLowStock: () => void;
  onEditItem?: (item: InventoryItem) => void;
  isGeoLocationEnabled?: boolean;
  onToggleGeoLocation?: (enabled: boolean) => void;
  orders?: PurchaseOrder[];
  onConfirmOrder?: (orderId: string) => Promise<void>;
  onReceiveOrder?: (orderId: string, receivedQty: number, note?: string) => Promise<void>;
  onCancelOrder?: (orderId: string, reason?: string) => Promise<void>;
  onResendLineNotification?: (order: PurchaseOrder) => Promise<void>;
  onOpenCreateOrder?: (item?: InventoryItem | null) => void;
  initialSubTab?: 'users' | 'orders' | 'inventory' | 'system';
}

export const AdminHubView: React.FC<AdminHubViewProps> = ({
  currentUser,
  onUpdateCurrentUser,
  onOpenAddItem,
  onOpenNotificationSettings,
  onExportInventoryPdf,
  isExportingInventoryPdf = false,
  summary,
  items,
  requisitions,
  onNavigateToTab,
  onFilterLowStock,
  onEditItem,
  isGeoLocationEnabled = true,
  onToggleGeoLocation,
  orders = [],
  onConfirmOrder = async () => {},
  onReceiveOrder = async () => {},
  onCancelOrder = async () => {},
  onResendLineNotification = async () => {},
  onOpenCreateOrder,
  initialSubTab = 'users',
}) => {
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'orders' | 'inventory' | 'system'>(initialSubTab);
  const [searchTerm, setSearchTerm] = useState('');

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const lowStockItems = items.filter(
    (item) => item.status === 'out' || item.status === 'low' || (item.minStock && item.qty <= item.minStock)
  );

  return (
    <div className="flex-1 overflow-y-auto pb-28 sm:pb-32 transition-colors">
      {/* Top Banner / Admin Console Header */}
      <div className="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-3.5 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/30 shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  ระบบผู้ดูแลระบบ (Admin Console)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-400/30">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                ศูนย์รวมการจัดการผู้ใช้ สินค้า สต็อกคลัง การแจ้งเตือน และรายงานระบบ
              </p>
            </div>
          </div>

          {/* Quick Stat Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <div className="liquid-glass-pill px-3 py-1.5 rounded-xl border border-white/60 dark:border-white/10 flex items-center gap-1.5 shrink-0 text-xs shadow-2xs">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-semibold text-slate-600 dark:text-slate-300">สินค้า:</span>
              <span className="font-black text-slate-900 dark:text-white">{items.length}</span>
            </div>

            <div 
              onClick={onFilterLowStock}
              className="liquid-glass-pill px-3 py-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 dark:bg-amber-400/10 flex items-center gap-1.5 shrink-0 text-xs shadow-2xs cursor-pointer hover:bg-amber-500/20 transition-all"
              title="คลิกเพื่อดูสินค้าสต็อกต่ำ"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-semibold text-amber-800 dark:text-amber-200">สต็อกต่ำ/หมด:</span>
              <span className="font-black text-amber-900 dark:text-amber-100">{lowStockItems.length}</span>
            </div>

            <div className="liquid-glass-pill px-3 py-1.5 rounded-xl border border-white/60 dark:border-white/10 flex items-center gap-1.5 shrink-0 text-xs shadow-2xs">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-semibold text-slate-600 dark:text-slate-300">เบิก/รับ:</span>
              <span className="font-black text-slate-900 dark:text-white">{requisitions.length}</span>
            </div>

            {/* Geo Location Quick Toggle Pill */}
            {onToggleGeoLocation && (
              <button
                type="button"
                onClick={() => onToggleGeoLocation(!isGeoLocationEnabled)}
                className={`liquid-glass-pill px-3 py-1.5 rounded-xl border flex items-center gap-2 shrink-0 text-xs shadow-2xs cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${
                  isGeoLocationEnabled
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                    : 'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
                }`}
                title="คลิกเพื่อสลับเปิด-ปิดระบบ Geo Location"
              >
                <span className="relative flex h-2 w-2">
                  {isGeoLocationEnabled && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isGeoLocationEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <MapPin className={`w-3.5 h-3.5 ${isGeoLocationEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                <span className="font-semibold">Geo Location:</span>
                <span className="font-black">{isGeoLocationEnabled ? 'เปิดใช้งาน' : 'ปิดระบบ'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full p-3.5 sm:p-5 md:p-6 space-y-5">
        {/* =========================================================
            ADMIN QUICK ACTIONS BAR (ทุกฟังก์ชันหลักของ Admin)
            ========================================================= */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>คำสั่งและเครื่องมือด่วน (Quick Admin Tools)</span>
            </h2>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              แตะเพื่อทำรายการทันที
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
            {/* 1. Add New Item */}
            <button
              type="button"
              onClick={onOpenAddItem}
              className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white shadow-md shadow-blue-500/25 border border-blue-400/40 hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2 border border-white/30">
                <PackagePlus className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1">
                  <span>เพิ่มสินค้าใหม่</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[11px] text-blue-100 mt-0.5 line-clamp-1">
                  ลงทะเบียนอะไหล่เข้าคลัง
                </p>
              </div>
            </button>

            {/* 2. Notification Settings */}
            <button
              type="button"
              onClick={() => onOpenNotificationSettings('line')}
              className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-teal-700 text-white shadow-md shadow-emerald-500/25 border border-emerald-400/40 hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2 border border-white/30">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1">
                  <span>ตั้งค่าแจ้งเตือน</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[11px] text-emerald-100 mt-0.5 line-clamp-1">
                  LINE & Web Push
                </p>
              </div>
            </button>

            {/* 3. Geo Location Toggle Button */}
            <button
              type="button"
              onClick={() => onToggleGeoLocation && onToggleGeoLocation(!isGeoLocationEnabled)}
              className={`p-3.5 sm:p-4 rounded-2xl border hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer shadow-sm relative overflow-hidden ${
                isGeoLocationEnabled
                  ? 'bg-gradient-to-br from-teal-700 via-emerald-700 to-emerald-800 text-white border-emerald-400/50 shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-slate-700 via-slate-800 to-zinc-900 text-white border-amber-400/40 shadow-slate-500/20'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  isGeoLocationEnabled
                    ? 'bg-white/20 text-white border-white/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                }`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-300 ease-in-out flex items-center ${
                  isGeoLocationEnabled ? 'bg-emerald-400 justify-end' : 'bg-slate-600 justify-start'
                }`}>
                  <div className="w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform" />
                </div>
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-white flex items-center justify-between gap-1">
                  <span>Geo Location</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    isGeoLocationEnabled ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-400 text-amber-950'
                  }`}>
                    {isGeoLocationEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-[11px] opacity-85 mt-0.5 line-clamp-1">
                  {isGeoLocationEnabled ? 'จำกัดพื้นที่ 100 ม.' : 'ปิดระบบ (เบิกได้ทุกที่)'}
                </p>
              </div>
            </button>

            {/* 4. Category & Movement Dashboard */}
            <button
              type="button"
              onClick={() => onNavigateToTab('dashboard')}
              className="p-3.5 sm:p-4 rounded-2xl liquid-glass-card border border-white/70 dark:border-white/15 hover:border-blue-400/40 hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer shadow-sm relative overflow-hidden"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2 border border-blue-400/30">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1">
                  <span>กราฟการเบิกจ่าย</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  วิเคราะห์แยกตามหมวด
                </p>
              </div>
            </button>

            {/* 5. Export PDF Report */}
            <button
              type="button"
              onClick={onExportInventoryPdf}
              disabled={isExportingInventoryPdf}
              className="p-3.5 sm:p-4 rounded-2xl liquid-glass-card border border-white/70 dark:border-white/15 hover:border-blue-400/40 hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer shadow-sm relative overflow-hidden"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-2 border border-violet-400/30">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1">
                  <span>{isExportingInventoryPdf ? 'กำลังส่งออก...' : 'ส่งออกรายงาน PDF'}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  พิมพ์รายงานสต็อกอะไหล่
                </p>
              </div>
            </button>

            {/* 6. Low Stock Audit */}
            <button
              type="button"
              onClick={onFilterLowStock}
              className="p-3.5 sm:p-4 rounded-2xl liquid-glass-card border border-white/70 dark:border-white/15 hover:border-amber-400/40 hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer shadow-sm relative overflow-hidden"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 border border-amber-400/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1">
                  <span>ตรวจสต็อกต่ำ ({lowStockItems.length})</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-1 transition-transform text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  รายการที่ต้องสั่งซื้อเพิ่ม
                </p>
              </div>
            </button>

            {/* 7. Orders Management Tool */}
            <button
              type="button"
              onClick={() => setAdminSubTab('orders')}
              className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-amber-500/25 border border-amber-400/40 hover:scale-[1.02] active:scale-95 transition-all text-left flex flex-col justify-between group cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center mb-2 border border-white/30">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm text-white flex items-center justify-between gap-1">
                  <span>รายการสั่งซื้อ</span>
                  {pendingOrders.length > 0 && (
                    <span className="bg-white text-amber-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                      {pendingOrders.length}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-100 mt-0.5 line-clamp-1">
                  {pendingOrders.length > 0 ? `รอยืนยัน ${pendingOrders.length} รายการ` : `${orders.length} รายการทั้งหมด`}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* =========================================================
            ADMIN MODULE TABS SWITCHER
            ========================================================= */}
        <div className="flex border-b border-white/60 dark:border-white/10 gap-2 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setAdminSubTab('users')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              adminSubTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-500'
                : 'liquid-glass text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-white/60 dark:border-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>จัดการผู้ใช้งาน & สิทธิ์ (Users)</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminSubTab('orders')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              adminSubTab === 'orders'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 border border-amber-400'
                : 'liquid-glass text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-white/60 dark:border-white/10'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>รายการที่ถูกสั่งซื้อ (Orders)</span>
            {pendingOrders.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                adminSubTab === 'orders' ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
              }`}>
                {pendingOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAdminSubTab('inventory')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              adminSubTab === 'inventory'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-500'
                : 'liquid-glass text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-white/60 dark:border-white/10'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>ตรวจสอบสต็อก & สินค้า (Inventory Control)</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminSubTab('system')}
            className={`flex items-center gap-2 py-2 px-3.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 ${
              adminSubTab === 'system'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 border border-blue-500'
                : 'liquid-glass text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-white/60 dark:border-white/10'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>ตั้งค่าระบบ & สถานะ (System & Alerts)</span>
          </button>
        </div>

        {/* =========================================================
            SUB-TAB 1: USER MANAGEMENT
            ========================================================= */}
        {adminSubTab === 'users' && (
          <div className="space-y-4">
            <UserManagementView 
              currentUser={currentUser} 
              onUpdateCurrentUser={onUpdateCurrentUser}
            />
          </div>
        )}

        {/* =========================================================
            SUB-TAB 2: ORDERS MANAGEMENT
            ========================================================= */}
        {adminSubTab === 'orders' && (
          <OrdersManagementView
            orders={orders}
            items={items}
            currentUser={currentUser}
            onConfirmOrder={onConfirmOrder}
            onReceiveOrder={onReceiveOrder}
            onCancelOrder={onCancelOrder}
            onResendLineNotification={onResendLineNotification}
            onOpenLineSettings={() => onOpenNotificationSettings?.('line')}
            onOpenCreateOrder={onOpenCreateOrder}
          />
        )}

        {/* =========================================================
            SUB-TAB 2: INVENTORY & STOCK AUDIT
            ========================================================= */}
        {adminSubTab === 'inventory' && (
          <div className="space-y-5">
            {/* Quick Action Banner */}
            <div className="liquid-glass-card p-5 rounded-[28px] border border-white/70 dark:border-white/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>ภาพรวมอะไหล่และรายการควบคุมสำหรับ Admin</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  ตรวจเช็คสต็อกต่ำ แก้ไขข้อมูลอะไหล่ หรือลงทะเบียนสินค้าใหม่เข้าสู่ Store FL.6
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onOpenAddItem}
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>เพิ่มสินค้าใหม่</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('inventory')}
                  className="flex-1 sm:flex-none liquid-glass-pill hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-white/60 dark:border-white/10 transition-all cursor-pointer"
                >
                  <span>ไปที่หน้ารายการอะไหล่</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Low Stock Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>รายการสินค้าสต็อกต่ำ / หมดสต็อก ({lowStockItems.length} รายการ)</span>
                </h4>
                {lowStockItems.length > 0 && (
                  <button
                    type="button"
                    onClick={onFilterLowStock}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>ดูทั้งหมดในคลัง</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {lowStockItems.length === 0 ? (
                <div className="p-8 text-center liquid-glass-card rounded-2xl border border-white/60 dark:border-white/10">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    ยอดสต็อกสินค้าทุกรายการอยู่ในเกณฑ์ปกติ
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ไม่มีรายการใดที่ต่ำกว่าจุดสั่งซื้อขั้นต่ำ (Min Stock)
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl liquid-glass-card border border-amber-300/40 dark:border-amber-500/20 shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                            {item.id}
                          </span>
                          <h5 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {item.name}
                          </h5>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.category}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              ที่เก็บ: {item.location || 'Store FL.6'}
                            </span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                          item.qty <= 0 
                            ? 'bg-red-500 text-white shadow-xs' 
                            : 'bg-amber-500 text-white shadow-xs'
                        }`}>
                          {item.qty <= 0 ? 'หมดสต็อก' : 'สต็อกต่ำ'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/40 dark:border-white/10 text-xs">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px]">คงเหลือ: </span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {item.qty} {item.unit}
                          </span>
                          <span className="text-slate-400 text-[11px] ml-1">
                            (เกณฑ์: {item.minStock || 5})
                          </span>
                        </div>

                        {onEditItem && (
                          <button
                            type="button"
                            onClick={() => onEditItem(item)}
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            แก้ไข/สั่งเพิ่ม
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            SUB-TAB 3: SYSTEM SETTINGS & NOTIFICATIONS
            ========================================================= */}
        {adminSubTab === 'system' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Geo Location System Control Card */}
              <div className="liquid-glass-card p-5 rounded-[28px] border border-white/70 dark:border-white/10 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${
                      isGeoLocationEnabled
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-400/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30'
                    }`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <span>ระบบพิกัด Geo Location</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                          isGeoLocationEnabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/30'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/30'
                        }`}>
                          {isGeoLocationEnabled ? 'เปิดใช้งาน (Active)' : 'ปิดระบบ (Bypassed)'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ควบคุมการตรวจสอบตำแหน่ง GPS ในการเบิก-รับสินค้า
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interactive Toggle Switch Bar */}
                <div className="p-4 rounded-2xl liquid-glass border border-white/60 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        สถานะระบบตรวจจับพิกัด (Geofencing)
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isGeoLocationEnabled 
                          ? 'จำกัดให้ทำรายการเฉพาะเมื่ออยู่ในรัศมี 100 เมตร' 
                          : 'ข้ามการตรวจสอบพิกัด (อนุญาตให้เบิก/รับได้ทุกสถานที่)'}
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => onToggleGeoLocation && onToggleGeoLocation(!isGeoLocationEnabled)}
                      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        isGeoLocationEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      role="switch"
                      aria-checked={isGeoLocationEnabled}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isGeoLocationEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/40 dark:border-white/10 text-[11.5px] text-slate-600 dark:text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">พิกัดคลัง Store FL.6:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">13.7233708, 100.5805155</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">รัศมีที่อนุญาต:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">100 เมตร</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  💡 <strong>คำแนะนำ:</strong> เมื่อเปิดระบบ พนักงานทั่วไปต้องเปิด GPS และอยู่ในระยะ 100 ม. จึงจะเบิกสินค้าได้ / หากปิดระบบ พนักงานจะสามารถเบิก-รับสินค้าจากนอกสถานที่หรือใช้งานผ่านคอมพิวเตอร์ที่ไม่มี GPS ได้ทันที
                </div>
              </div>

              {/* Notification Center Card */}
              <div className="liquid-glass-card p-5 rounded-[28px] border border-white/70 dark:border-white/10 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-400/30">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      การแจ้งเตือน LINE & Web Push
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      จัดการการแจ้งเตือนเบิก-รับ สต็อกต่ำ และการล็อกอินเข้าสู่ระบบ
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between p-3 rounded-xl liquid-glass border border-white/50 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-blue-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Web Push (แจ้งเตือนนอกแอป)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      พร้อมใช้งาน
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl liquid-glass border border-white/50 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        LINE Messaging API (กลุ่ม/บอท)
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      พร้อมใช้งาน
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenNotificationSettings('line')}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>ตั้งค่า LINE Bot</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenNotificationSettings('webpush')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>ตั้งค่า Web Push</span>
                  </button>
                </div>
              </div>

              {/* System Infrastructure Card */}
              <div className="liquid-glass-card p-5 rounded-[28px] border border-white/70 dark:border-white/10 shadow-sm space-y-4 md:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-400/30">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      โครงสร้างพื้นฐานระบบ (System Health)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      สถานะฐานข้อมูลคลาวด์ พิกัดคลังสินค้า และการจัดเก็บข้อมูล
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                  <div className="p-3 rounded-xl liquid-glass border border-white/50 dark:border-white/10 flex flex-col justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <Database className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">Firebase Firestore:</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ออนไลน์ (Live Sync)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl liquid-glass border border-white/50 dark:border-white/10 flex flex-col justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-3.5 h-3.5 ${isGeoLocationEnabled ? 'text-rose-500' : 'text-amber-500'}`} />
                      <span className="font-bold text-slate-700 dark:text-slate-300">พิกัดคลังสินค้า:</span>
                    </div>
                    <span className={`text-[11px] font-bold ${isGeoLocationEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {isGeoLocationEnabled ? 'Bangkok Marriott (บังคับ 100 ม.)' : 'ปิดระบบพิกัด (เบิกได้ทุกที่)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl liquid-glass border border-white/50 dark:border-white/10 flex flex-col justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">PWA Offline Cache:</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> เปิดใช้งาน Service Worker
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onExportInventoryPdf}
                    disabled={isExportingInventoryPdf}
                    className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>{isExportingInventoryPdf ? 'กำลังเตรียมไฟล์...' : 'ดาวน์โหลดรายงานระบบฉบับเต็ม (PDF)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
