import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Check, 
  X, 
  Send, 
  Key, 
  Users, 
  HelpCircle, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Smartphone,
  Eye,
  EyeOff,
  PackageMinus,
  PackagePlus,
  LogIn,
  LogOut,
  Info
} from 'lucide-react';
import { LineNotificationConfig, User } from '../types';
import { getLineConfig, saveLineConfig, testLineNotification } from '../utils/lineNotify';

interface LineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

export const LineSettingsModal: React.FC<LineSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [config, setConfig] = useState<LineNotificationConfig>({
    enabled: true,
    channelAccessToken: '',
    destinationId: '',
    notifyStockOut: true,
    notifyStockIn: true,
    notifyLogin: true,
    notifyLogout: true,
    notifyLowStock: true,
  });

  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'token' | 'destination'>('token');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // 1. Fetch from backend API first to see if server has env/config
      const res = await fetch('/api/line/config');
      if (res.ok) {
        const serverData = await res.json();
        setConfig(prev => ({
          ...prev,
          enabled: serverData.enabled ?? true,
          channelAccessToken: serverData.maskedToken || serverData.channelAccessToken || '',
          destinationId: serverData.destinationId || '',
          notifyStockOut: serverData.notifyStockOut ?? true,
          notifyStockIn: serverData.notifyStockIn ?? true,
          notifyLogin: serverData.notifyLogin ?? true,
          notifyLogout: serverData.notifyLogout ?? true,
          notifyLowStock: serverData.notifyLowStock ?? true,
        }));
      } else {
        // Fallback to Firestore
        const firestoreData = await getLineConfig();
        setConfig(firestoreData);
      }
    } catch (err) {
      console.warn('Failed to load line config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      await saveLineConfig(config, currentUser.name || currentUser.username);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving LINE config:', err);
      alert('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า LINE');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testLineNotification({
        channelAccessToken: config.channelAccessToken,
        destinationId: config.destinationId,
      });

      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อทดสอบส่งข้อความได้',
      });
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  const isConfigured = Boolean(config.channelAccessToken && config.destinationId);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92dvh] rounded-3xl shadow-2xl overflow-hidden border border-slate-300 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-200 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-xs">
              <Bell className="w-5 h-5 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  ตั้งค่าแจ้งเตือนผ่าน LINE
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-extrabold bg-white/20 border border-white/30">
                  LINE Bot
                </span>
              </div>
              <p className="text-xs text-white/90 font-medium">
                แจ้งเตือนการเบิก, รับเข้า, เข้าสู่ระบบ และออกจากระบบแบบเรียลไทม์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
          {/* Status Callout */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
            isConfigured 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/70 text-emerald-800 dark:text-emerald-200' 
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/70 text-amber-800 dark:text-amber-200'
          }`}>
            {isConfigured ? (
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            )}
            <div className="text-xs sm:text-sm space-y-1">
              <div className="font-bold flex items-center gap-2">
                {isConfigured ? '🟢 ระบบแจ้งเตือน LINE พร้อมทำงาน' : '🟡 ยังไม่ได้ตั้งค่า Token หรือ Destination ID'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">
                {isConfigured 
                  ? 'ระบบจะส่งข้อความแจ้งเตือนอัตโนมัติไปยัง LINE ตามเหตุการณ์ที่เลือกไว้ด้านล่าง'
                  : 'กรุณากรอก Channel Access Token และ Destination ID (User ID / Group ID) ด้านล่าง จากนั้นกด "ทดสอบส่ง" เพื่อเริ่มรับการแจ้งเตือน'}
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Switch */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-300 dark:border-slate-700 flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                เปิดระบบแจ้งเตือน LINE ทั้งหมด
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เปิดหรือปิดการทำงานของระบบแจ้งเตือน LINE ชั่วคราว
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Configuration Form */}
          <div className="space-y-4">
            {/* Channel Access Token */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  LINE Channel Access Token (Long-Lived) <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-slate-400">จาก LINE Developers</span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={config.channelAccessToken}
                  onChange={(e) => setConfig({ ...config, channelAccessToken: e.target.value.trim() })}
                  placeholder="เช่น eyJhbGciOi..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Warning if token appears to be Channel Secret (32 hex chars) rather than Access Token */}
              {config.channelAccessToken && !config.channelAccessToken.includes('...') && config.channelAccessToken.length < 60 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/60">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    ข้อสังเกต: Token ที่กรอกดูสั้นเกินไป ({config.channelAccessToken.length} ตัวอักษร) กรุณาตรวจสอบว่าคัดลอก <strong>"Channel access token (long-lived)"</strong> จากแท็บ <strong>Messaging API</strong> (ไม่ใช่ Channel secret ในหน้า Basic settings)
                  </span>
                </p>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Token สำหรับส่งข้อความแบบฟรีจาก LINE Messaging API (ความยาวประมาณ 100-200+ ตัวอักษร)
              </p>
            </div>

            {/* Destination ID */}
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Destination ID (User ID หรือ Group ID) <span className="text-red-500">*</span>
                </span>
                <span className="text-[11px] font-normal text-slate-400">แชทเดี่ยว หรือ กลุ่ม LINE</span>
              </label>
              <input
                type="text"
                value={config.destinationId}
                onChange={(e) => setConfig({ ...config, destinationId: e.target.value.trim() })}
                placeholder="เช่น U123456789... (User ID) หรือ C123456789... (Group ID)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors shadow-2xs"
              />

              {config.destinationId && !['U', 'C', 'R'].includes(config.destinationId.charAt(0).toUpperCase()) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/60">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    ข้อสังเกต: Destination ID ปกติต้องขึ้นต้นด้วยตัว <strong>U</strong> (User ID สำหรับแชทส่วนตัว) หรือตัว <strong>C / R</strong> (Group ID สำหรับส่งเข้ากลุ่ม)
                  </span>
                </p>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                ระบุ <strong>User ID</strong> (ขึ้นต้นด้วย U...) สำหรับแชทส่วนตัว หรือ <strong>Group ID</strong> (ขึ้นต้นด้วย C... หรือ R...) สำหรับส่งเข้ากลุ่มทีมงาน
              </p>
            </div>
          </div>

          {/* Event Toggles (Granular Permissions) */}
          <div className="space-y-2.5 pt-2">
            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              เลือกเหตุการณ์ที่ต้องการให้แจ้งเตือน
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Stock Out */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-xs">
                    <PackageMinus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">การเบิกสินค้า (Stock Out)</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400">ส่งแจ้งเตือนเมื่อมีผู้เบิกอะไหล่</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyStockOut}
                  onChange={(e) => setConfig({ ...config, notifyStockOut: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>

              {/* Stock In */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    <PackagePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">การรับเข้าสินค้า (Stock In)</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400">ส่งแจ้งเตือนเมื่อมีการเติมของ</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyStockIn}
                  onChange={(e) => setConfig({ ...config, notifyStockIn: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>

              {/* User Login */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                    <LogIn className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">การเข้าสู่ระบบ (Login)</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400">ส่งแจ้งเตือนเมื่อมีผู้ใช้ล็อกอิน</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyLogin}
                  onChange={(e) => setConfig({ ...config, notifyLogin: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>

              {/* User Logout */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">การออกจากระบบ (Logout)</div>
                    <div className="text-[10.5px] text-slate-500 dark:text-slate-400">ส่งแจ้งเตือนเมื่อผู้ใช้ออกจากระบบ</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.notifyLogout}
                  onChange={(e) => setConfig({ ...config, notifyLogout: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Test Send Section */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                  ทดสอบการส่งข้อความแจ้งเตือน
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  ส่ง Flex Message ทดสอบไปยัง LINE เพื่อตรวจสอบความถูกต้อง
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestSend}
                disabled={testing || !config.channelAccessToken || !config.destinationId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-xs border border-emerald-500"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {testing ? 'กำลังส่ง...' : 'ทดสอบส่งข้อความ'}
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 border animate-in fade-in duration-200 ${
                testResult.success 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' 
                  : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border-red-300 dark:border-red-700'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{testResult.success ? '🎉 สำเร็จ!' : '❌ ไม่สำเร็จ'}</div>
                  <div className="mt-0.5">{testResult.message || testResult.error}</div>
                </div>
              </div>
            )}
          </div>

          {/* Step-by-Step Setup Guide Accordion */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/50">
            <div className="bg-slate-100/70 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h5 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                คู่มือวิธีรับ Token และ User/Group ID (ฟรี 100%)
              </h5>
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-600 dark:text-emerald-400 hover:underline text-xs flex items-center gap-1 font-semibold"
              >
                เปิด LINE Developers <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-4 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
                  <p>
                    เข้าสู่ระบบที่ <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 font-bold underline">LINE Developers Console</a> และสร้าง Provider & Channel ประเภท <strong>Messaging API</strong> (ฟรี 100% ไม่มีค่าใช้จ่าย)
                  </p>
                </div>

                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
                  <p>
                    ไปที่แท็บ <strong>Messaging API</strong> เลื่อนลงมาด้านล่างสุดที่หัวข้อ <strong>Channel access token (long-lived)</strong> แล้วกด <strong>Issue</strong> เพื่อคัดลอก Token มาวางในช่องด้านบน
                  </p>
                </div>

                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
                  <p>
                    ในแท็บ <strong>Basic settings</strong> เลื่อนลงมาดู <strong>Your user ID</strong> (ขึ้นต้นด้วย <code>U...</code>) นำมาใส่ในช่อง Destination ID เพื่อรับแจ้งเตือนส่วนตัว หรือเพิ่ม LINE Bot เข้ากลุ่มเพื่อส่งเข้ากลุ่ม LINE
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between shrink-0 pb-[max(16px,calc(env(safe-area-inset-bottom,16px)+12px))]">
          <div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> บันทึกการตั้งค่าเรียบร้อยแล้ว
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              ปิด
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-70 cursor-pointer shadow-xs border border-emerald-500"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
