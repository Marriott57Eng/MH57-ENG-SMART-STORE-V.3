import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '../hooks/useScrollLock';
import { 
  Bell, 
  Check, 
  X, 
  Send, 
  Key, 
  Users, 
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
  Info,
  Radio,
  Wifi,
  Sparkles,
  BellRing,
  BellOff,
  Copy,
  ShoppingCart,
  Lock,
  LogOut
} from 'lucide-react';
import { LineNotificationConfig, User, WebPushNotificationConfig } from '../types';
import { getLineConfig, saveLineConfig, testLineNotification } from '../utils/lineNotify';
import { 
  isWebPushSupported, 
  getWebPushPermission, 
  getWebPushConfig, 
  fetchWebPushConfigFromFirestore,
  saveWebPushConfig, 
  subscribeToWebPush, 
  unsubscribeFromWebPush, 
  testWebPushNotification 
} from '../utils/webPush';

export interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  initialTab?: 'webpush' | 'line';
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialTab = 'webpush'
}) => {
  useScrollLock(isOpen);

  const isAdmin = currentUser.role === 'admin';
  const [activeTab, setActiveTab] = useState<'webpush' | 'line'>(initialTab);
  
  // LINE State
  const [config, setConfig] = useState<LineNotificationConfig>({
    enabled: true,
    channelAccessToken: '',
    destinationId: '',
    notifyStockOut: true,
    notifyStockIn: true,
    notifyLogin: true,
    notifyLogout: true,
    notifyLowStock: true,
    notifyPurchaseOrder: true,
    useSeparateOrderDestination: false,
    purchaseOrderDestinationId: '',
    purchaseOrderChannelAccessToken: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [showPoToken, setShowPoToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingPo, setTestingPo] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [testPoResult, setTestPoResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Web Push State
  const [webPushSupported, setWebPushSupported] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [webPushConfig, setWebPushConfig] = useState<WebPushNotificationConfig>(getWebPushConfig());
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [savingPushConfig, setSavingPushConfig] = useState(false);
  const [pushConfigSaved, setPushConfigSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      loadConfig();
      checkWebPushStatus();
      setTestResult(null);
      setSaveSuccess(false);
      setPushMessage(null);
    }
  }, [isOpen, initialTab]);

  const checkWebPushStatus = async () => {
    const supported = isWebPushSupported();
    setWebPushSupported(supported);
    setPushPermission(getWebPushPermission());
    
    // Always fetch the central config from Firestore/server so all users inherit Admin's rules
    try {
      const remoteConfig = await fetchWebPushConfigFromFirestore();
      setWebPushConfig(remoteConfig);
    } catch (_) {
      setWebPushConfig(getWebPushConfig());
    }

    if (supported && 'serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsPushSubscribed(!!sub);
      } catch (e) {
        console.warn('Check push subscription error:', e);
      }
    }
  };

  const handleToggleWebPush = async () => {
    setPushLoading(true);
    setPushMessage(null);
    try {
      if (isPushSubscribed) {
        const res = await unsubscribeFromWebPush();
        if (res.success) {
          setIsPushSubscribed(false);
          setPushMessage({ type: 'info', text: 'ยกเลิกการรับแจ้งเตือน Web Push บนอุปกรณ์นี้เรียบร้อยแล้ว' });
        } else {
          setPushMessage({ type: 'error', text: res.error || 'ไม่สามารถยกเลิกได้' });
        }
      } else {
        const res = await subscribeToWebPush(currentUser);
        if (res.success) {
          setIsPushSubscribed(true);
          setPushPermission('granted');
          setPushMessage({ type: 'success', text: 'เปิดรับการแจ้งเตือน Web Push บนอุปกรณ์นี้สำเร็จแล้ว! พร้อมรับแจ้งเตือนตามเงื่อนไขที่แอดมินกำหนด' });
        } else {
          setPushPermission(getWebPushPermission());
          setPushMessage({ type: 'error', text: res.error || 'ไม่สามารถลงทะเบียนรับการแจ้งเตือนได้' });
        }
      }
    } catch (err: any) {
      setPushMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการตั้งค่า Web Push' });
    } finally {
      setPushLoading(false);
    }
  };

  const handleTogglePushOption = async (key: keyof WebPushNotificationConfig) => {
    if (!isAdmin) return;
    const updated = {
      ...webPushConfig,
      [key]: !webPushConfig[key]
    };
    setWebPushConfig(updated);
    try {
      setSavingPushConfig(true);
      await saveWebPushConfig(updated, currentUser.name || currentUser.username);
      setPushConfigSaved(true);
      setTimeout(() => setPushConfigSaved(false), 2500);
    } catch (err) {
      console.error('Error saving webpush config:', err);
    } finally {
      setSavingPushConfig(false);
    }
  };

  const handleTestWebPush = async () => {
    setPushTesting(true);
    setPushMessage(null);
    try {
      const res = await testWebPushNotification();
      if (res.success) {
        setPushMessage({ 
          type: 'success', 
          text: `ส่งการแจ้งเตือนทดสอบแล้ว! คุณจะเห็นข้อความเด้งขึ้นบนอุปกรณ์ (ส่งไปยัง ${res.sent || 1} อุปกรณ์)` 
        });
      } else {
        setPushMessage({ type: 'error', text: res.error || 'ไม่สามารถส่งการแจ้งเตือนทดสอบได้' });
      }
    } catch (err: any) {
      setPushMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการทดสอบ Web Push' });
    } finally {
      setPushTesting(false);
    }
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
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
          notifyPurchaseOrder: serverData.notifyPurchaseOrder ?? true,
          useSeparateOrderDestination: serverData.useSeparateOrderDestination ?? false,
          purchaseOrderDestinationId: serverData.purchaseOrderDestinationId || '',
          purchaseOrderChannelAccessToken: serverData.maskedPoToken || serverData.purchaseOrderChannelAccessToken || '',
        }));
      } else {
        const firestoreData = await getLineConfig();
        setConfig(firestoreData);
      }
    } catch (err) {
      console.warn('Failed to load line config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWebhook = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/api/line/webhook`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setWebhookCopied(true);
        setTimeout(() => setWebhookCopied(false), 2500);
      }).catch(() => {});
    }
  };

  const handleSaveLine = async (e?: React.FormEvent) => {
    if (!isAdmin) return;
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

  const handleTestSendLine = async () => {
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
        error: err?.message || 'Failed to connect to LINE API',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestSendOrderLine = async () => {
    setTestingPo(true);
    setTestPoResult(null);
    try {
      const result = await testLineNotification({
        channelAccessToken: config.purchaseOrderChannelAccessToken || config.channelAccessToken,
        destinationId: config.purchaseOrderDestinationId || config.destinationId,
        isOrderTest: true,
      });
      setTestPoResult(result);
    } catch (err: any) {
      setTestPoResult({
        success: false,
        error: err?.message || 'Failed to connect to LINE API for purchase order',
      });
    } finally {
      setTestingPo(false);
    }
  };

  if (!isOpen) return null;

  const isConfigured = Boolean(config.channelAccessToken && config.destinationId);

  const modalContent = (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 animate-in fade-in duration-150 transform-gpu overscroll-contain"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[92dvh] rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col animate-in zoom-in-95 duration-150 relative transform-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular Rim Light */}
        <div className="absolute top-0 left-8 right-8 h-[1.5px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/40 to-transparent pointer-events-none rounded-full z-10" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/40 dark:border-white/10 bg-slate-950/85 backdrop-blur-xl text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center border border-blue-400/40 shadow-md shadow-blue-500/25">
              <Bell className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight">
                  ศูนย์รวมการแจ้งเตือน (Notifications)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-white/20 border border-white/30 backdrop-blur-xs">
                  Store FL.6
                </span>
              </div>
              <p className="text-xs text-white/80 font-medium">
                Web Push แจ้งเตือนแม้อยู่นอกแอป และ LINE Messaging API
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full liquid-glass-pill transition-colors cursor-pointer border border-white/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Master Role Banner: Clear Architecture Indicator */}
        <div className="px-4 sm:px-6 pt-3 shrink-0">
          {isAdmin ? (
            <div className="bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-blue-500/15 border border-amber-500/35 rounded-2xl p-3 text-xs space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
                  <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>👑 แผงควบคุมหลักผู้ดูแลระบบ (Admin Master Control)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30">
                  Master Settings
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                การตั้งค่าทั้งหมดที่บันทึกที่นี่ (ทั้ง <strong>LINE Bot</strong> และ <strong>Web Push</strong>) คือ<strong>นโยบายหลักของทั้งระบบ</strong> โดยผู้ใช้งาน (User) ทุกคนจะได้รับการแจ้งเตือนอิงตามการตั้งค่าของคุณ
              </p>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-500/15 via-slate-500/10 to-indigo-500/15 border border-blue-400/35 rounded-2xl p-3 text-xs space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-blue-800 dark:text-blue-300 text-xs sm:text-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>🛡️ นโยบายการแจ้งเตือนอิงตามแอดมิน (Admin-Controlled Policy)</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-800 dark:text-blue-200 border border-blue-500/30">
                  User Inherited
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                เงื่อนไขการแจ้งเตือนทั้งหมดถูก<strong>กำหนดโดยผู้ดูแลระบบ (Admin) เป็นหลัก</strong> คุณสามารถเปิดรับการแจ้งเตือนบนอุปกรณ์เครื่องนี้ได้ โดยระบบจะส่งการแจ้งเตือนตามเงื่อนไขที่แอดมินเปิดใช้งานไว้
              </p>
            </div>
          )}
        </div>

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-white/40 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md p-2 gap-2 shrink-0 mt-1">
          <button
            type="button"
            onClick={() => setActiveTab('webpush')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'webpush'
                ? 'liquid-glass text-blue-600 dark:text-blue-400 shadow-md border border-white/80 dark:border-white/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Web Push Notifications</span>
            {isPushSubscribed && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('line')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === 'line'
                ? 'liquid-glass text-emerald-600 dark:text-emerald-400 shadow-md border border-white/80 dark:border-white/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>LINE Bot API</span>
            {isConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-100">
          {activeTab === 'webpush' ? (
            /* ==========================================
               TAB 1: WEB PUSH NOTIFICATIONS
               ========================================== */
            <div className="space-y-5">
              {/* Web Push Status Card */}
              <div className={`p-4 rounded-2xl border transition-all ${
                !webPushSupported
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                  : isPushSubscribed
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/70 text-emerald-800 dark:text-emerald-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/70 text-blue-900 dark:text-blue-200'
              }`}>
                <div className="flex items-start gap-3">
                  {isPushSubscribed ? (
                    <BellRing className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  ) : (
                    <BellOff className="w-6 h-6 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <div className="font-bold text-sm sm:text-base flex items-center justify-between">
                      <span>
                        {isPushSubscribed
                          ? '🟢 อุปกรณ์นี้เปิดรับ Web Push เรียบร้อยแล้ว'
                          : pushPermission === 'denied'
                            ? '🔴 การแจ้งเตือนถูกปิดกั้นในบราวเซอร์'
                            : '🟡 อุปกรณ์นี้ยังไม่ได้เปิดรับ Web Push'}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/60 dark:bg-slate-800 border border-current">
                        สิทธิ์: {pushPermission}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {isPushSubscribed
                        ? 'ระบบจะส่ง Push Notification มายังอุปกรณ์เครื่องนี้โดยตรงเมื่อสต็อกสินค้าต่ำ หรือเมื่อมีการเบิกจ่ายสำคัญ แม้ว่าแอปจะปิดหน้าจอหรือไม่ได้เปิดอยู่'
                        : pushPermission === 'denied'
                          ? 'บราวเซอร์ของคุณปฏิเสธการแจ้งเตือน กรุณาแตะที่ไอคอนแม่กุญแจหน้า URL เพื่อ "อนุญาตการแจ้งเตือน" แล้วรีเฟรชหน้าเว็บ'
                          : 'แตะปุ่มด้านล่างเพื่อเปิดใช้งาน Web Push Notifications สำหรับอุปกรณ์เครื่องนี้'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Push Feedback Banner */}
              {pushMessage && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                  pushMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : pushMessage.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {pushMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{pushMessage.text}</span>
                </div>
              )}

              {/* Master Device Toggle (For Current User's Browser/Phone) */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 sm:p-5 rounded-2xl border border-slate-300 dark:border-slate-700 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>รับการแจ้งเตือนบนอุปกรณ์เครื่องนี้</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    ลงทะเบียน Service Worker เพื่อรับ Push ผ่านระบบปฏิบัติการ (Android, iOS, Windows, macOS)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleWebPush}
                  disabled={pushLoading || !webPushSupported || pushPermission === 'denied'}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
                    isPushSubscribed
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {pushLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : isPushSubscribed ? (
                    <>
                      <BellOff className="w-4 h-4" />
                      <span>ยกเลิกการแจ้งเตือน</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4" />
                      <span>เปิดรับการแจ้งเตือน</span>
                    </>
                  )}
                </button>
              </div>

              {/* ADMIN ONLY: Master Global Enable/Disable Web Push */}
              {isAdmin && (
                <div className="bg-blue-50/70 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-300 dark:border-blue-700/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                        เปิดใช้งานระบบ Web Push ทั้งระบบ
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        Admin Master
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      หากปิดสวิตช์นี้ ระบบจะไม่ส่ง Web Push ไปยังผู้ใช้งานทุกคนในระบบ
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webPushConfig.enabled}
                      onChange={() => handleTogglePushOption('enabled')}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              )}

              {/* Alert Conditions Checklist */}
              <div className="space-y-3 bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>เงื่อนไขการแจ้งเตือน Web Push:</span>
                  </h5>
                  {isAdmin ? (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      {savingPushConfig ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : pushConfigSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>บันทึกเป็นค่าหลักแล้ว</span>
                        </>
                      ) : (
                        <span>👑 แอดมินสามารถเปิด/ปิดได้</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>อิงตามการตั้งค่าจากแอดมิน</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Low Stock Alert */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    isAdmin 
                      ? 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700' 
                      : 'border-slate-200 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/30 cursor-default'
                  }`}>
                    <input
                      type="checkbox"
                      checked={webPushConfig.notifyLowStock}
                      disabled={!isAdmin}
                      onChange={() => handleTogglePushOption('notifyLowStock')}
                      className={`mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 ${!isAdmin ? 'cursor-not-allowed opacity-75' : ''}`}
                    />
                    <div className="text-xs space-y-0.5 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          <span>แจ้งเตือนสต็อกสินค้าต่ำ (Low Stock Alert)</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          webPushConfig.notifyLowStock 
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' 
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}>
                          {webPushConfig.notifyLowStock ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        ส่งเตือนทันทีเมื่อจำนวนสินค้าในคลังลดลงจนเท่ากับหรือต่ำกว่าจุดสั่งซื้อขั้นต่ำ (Min Stock) หรือสินค้าหมด (0 หน่วย)
                      </p>
                    </div>
                  </label>

                  {/* Important Requisition Alert */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    isAdmin 
                      ? 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700' 
                      : 'border-slate-200 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/30 cursor-default'
                  }`}>
                    <input
                      type="checkbox"
                      checked={webPushConfig.notifyImportantRequisition}
                      disabled={!isAdmin}
                      onChange={() => handleTogglePushOption('notifyImportantRequisition')}
                      className={`mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 ${!isAdmin ? 'cursor-not-allowed opacity-75' : ''}`}
                    />
                    <div className="text-xs space-y-0.5 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <PackageMinus className="w-3.5 h-3.5 text-blue-500" />
                          <span>แจ้งเตือนเมื่อมีการเบิกจ่ายสำคัญ (Important Requisition Alert)</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          webPushConfig.notifyImportantRequisition 
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' 
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}>
                          {webPushConfig.notifyImportantRequisition ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        ส่งเตือนเมื่อมีการเบิกจ่ายจำนวนมาก (ตั้งแต่ 5 หน่วยขึ้นไป) หรือมีวัตถุประสงค์งานสำคัญ งานด่วน งานฉุกเฉิน หรือผ่าน AI Assistant
                      </p>
                    </div>
                  </label>

                  {/* Purchase Order Alert */}
                  <label className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    isAdmin 
                      ? 'border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700' 
                      : 'border-slate-200 dark:border-slate-700/50 bg-slate-50/40 dark:bg-slate-800/30 cursor-default'
                  }`}>
                    <input
                      type="checkbox"
                      checked={webPushConfig.notifyPurchaseOrder !== false}
                      disabled={!isAdmin}
                      onChange={() => handleTogglePushOption('notifyPurchaseOrder')}
                      className={`mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 ${!isAdmin ? 'cursor-not-allowed opacity-75' : ''}`}
                    />
                    <div className="text-xs space-y-0.5 flex-1">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />
                          <span>แจ้งเตือนคำสั่งซื้อสินค้า (Purchase Order Alert)</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          webPushConfig.notifyPurchaseOrder !== false 
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20' 
                            : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}>
                          {webPushConfig.notifyPurchaseOrder !== false ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        ส่งเตือนเมื่อมีการส่งคำขอสั่งซื้อสินค้าใหม่ เพื่อให้เจ้าหน้าที่และแอดมินทราบทันที
                      </p>
                    </div>
                  </label>
                </div>

                {!isAdmin && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-1 italic">
                    <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span>*เงื่อนไขการแจ้งเตือนด้านบนควบคุมโดย Admin เพื่อให้การแจ้งเตือนสอดคล้องกันทั้งระบบ*</span>
                  </p>
                )}
              </div>

              {/* Action Buttons: Test Push */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestWebPush}
                  disabled={pushTesting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {pushTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังส่งแจ้งเตือนทดสอบ...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>🔔 ทดสอบส่ง Web Push บนอุปกรณ์</span>
                    </>
                  )}
                </button>
              </div>

              {/* PWA & Mobile installation hint */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/70 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>คำแนะนำสำหรับการใช้งานบนอุปกรณ์พกพา (Mobile & PWA):</span>
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400 leading-relaxed">
                  <li>
                    <strong>Android / Chrome / Edge:</strong> สามารถรับการแจ้งเตือนได้ทันทีหลังกดเปิดรับการแจ้งเตือน
                  </li>
                  <li>
                    <strong>iPhone / iPad (iOS 16.4+):</strong> ต้องแตะที่ปุ่มแชร์ (Share) แล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong> จากนั้นเปิดแอปจากหน้าจอโฮมเพื่อเปิดรับการแจ้งเตือน
                  </li>
                  <li>
                    การแจ้งเตือนจะทำงานผ่านระบบพุชของบราวเซอร์ แม้ว่าผู้ใช้จะปิดหน้าต่างบราวเซอร์หรือพักหน้าจอโทรศัพท์อยู่ก็ตาม
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* ==========================================
               TAB 2: LINE MESSAGING API
               ========================================== */
            <div className="space-y-5">
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
                      ? 'ระบบจะส่งข้อความแจ้งเตือนอัตโนมัติไปยัง LINE ตามเหตุการณ์ที่แอดมินกำหนดไว้'
                      : isAdmin 
                        ? 'กรุณากรอก Channel Access Token และ Destination ID ด้านล่าง จากนั้นกดบันทึกและทดสอบส่ง'
                        : 'ผู้ดูแลระบบยังไม่ได้กำหนดค่า Token หรือกลุ่มรับแจ้งเตือน กรุณาติดต่อแอดมิน'}
                  </p>
                </div>
              </div>

              {/* NON-ADMIN USER VIEW: SUMMARY ONLY */}
              {!isAdmin ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-white">
                      <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>สถานะการแจ้งเตือน LINE ที่แอดมินกำหนดไว้:</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      ทุกครั้งที่คุณทำรายการเบิก-รับ หรือสั่งซื้ออะไหล่ ข้อมูลจะถูกส่งไปยังห้องแชท LINE ของคลังสินค้าโดยอัตโนมัติตามนโยบายที่แอดมินเปิดไว้:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <PackageMinus className="w-3.5 h-3.5 text-rose-500" />
                          <span>การเบิกจ่ายสินค้า</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${config.notifyStockOut ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {config.notifyStockOut ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <PackagePlus className="w-3.5 h-3.5 text-emerald-500" />
                          <span>การรับเข้าสินค้า</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${config.notifyStockIn ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {config.notifyStockIn ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          <span>สินค้าใกล้หมดสต็อก</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${config.notifyLowStock ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {config.notifyLowStock ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                          <span>คำขอสั่งซื้อสินค้าใหม่</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${config.notifyPurchaseOrder !== false ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {config.notifyPurchaseOrder !== false ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <LogIn className="w-3.5 h-3.5 text-blue-500" />
                          <span>เข้าสู่ระบบ (Log in)</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${config.notifyLogin ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {config.notifyLogin ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="flex items-center gap-1.5 font-medium">
                          <LogOut className="w-3.5 h-3.5 text-slate-500" />
                          <span>ออกจากระบบ (Log out)</span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${config.notifyLogout ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                          {config.notifyLogout ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>การแก้ไข Token และห้องแชทปลายทาง LINE สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น</span>
                  </div>
                </div>
              ) : (
                /* ADMIN VIEW: FULL CONFIGURATION */
                <>
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

                      {config.channelAccessToken && !config.channelAccessToken.includes('...') && config.channelAccessToken.length < 60 && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-800/60">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            ข้อสังเกต: Token ที่กรอกดูสั้นเกินไป ({config.channelAccessToken.length} ตัวอักษร) กรุณาตรวจสอบว่าคัดลอก <strong>"Channel access token (long-lived)"</strong> จากแท็บ <strong>Messaging API</strong>
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Destination ID */}
                    <div className="space-y-1.5">
                      <label className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Destination ID (User ID หรือ Group ID) <span className="text-red-500">*</span>
                        </span>
                        <span className="text-[11px] font-normal text-slate-400">เป้าหมายส่งข้อความ</span>
                      </label>
                      <input
                        type="text"
                        value={config.destinationId}
                        onChange={(e) => setConfig({ ...config, destinationId: e.target.value.trim() })}
                        placeholder="เช่น U12345678... หรือ C12345678..."
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-colors shadow-2xs"
                      />
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        ขึ้นต้นด้วย <strong>U</strong> สำหรับแชทส่วนตัว, <strong>C</strong> หรือ <strong>R</strong> สำหรับกลุ่มห้องแชท
                      </p>
                    </div>
                  </div>

                  {/* Event Notification Toggles */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>เลือกเหตุการณ์ที่ต้องการให้ส่งแจ้งเตือน LINE:</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.notifyStockOut}
                          onChange={(e) => setConfig({ ...config, notifyStockOut: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <PackageMinus className="w-3.5 h-3.5 text-rose-500" />
                            <span>การเบิกจ่ายสินค้า (Stock-Out)</span>
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.notifyStockIn}
                          onChange={(e) => setConfig({ ...config, notifyStockIn: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <PackagePlus className="w-3.5 h-3.5 text-emerald-500" />
                            <span>การรับเข้าสินค้า (Stock-In)</span>
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.notifyLowStock}
                          onChange={(e) => setConfig({ ...config, notifyLowStock: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                            <span>สินค้าใกล้หมด/หมดสต็อก</span>
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.notifyLogin}
                          onChange={(e) => setConfig({ ...config, notifyLogin: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <LogIn className="w-3.5 h-3.5 text-blue-500" />
                            <span>เข้าสู่ระบบ (Log in)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            แจ้งเตือนเมื่อมีผู้ใช้ล็อกอิน
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.notifyLogout}
                          onChange={(e) => setConfig({ ...config, notifyLogout: e.target.checked })}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <LogOut className="w-3.5 h-3.5 text-slate-500" />
                            <span>ออกจากระบบ (Log out)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            แจ้งเตือนเมื่อผู้ใช้ล็อกเอาท์
                          </span>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/30 cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={config.notifyPurchaseOrder ?? true}
                          onChange={(e) => setConfig({ ...config, notifyPurchaseOrder: e.target.checked })}
                          className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                        />
                        <div className="text-xs">
                          <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>สั่งซื้อสินค้าใหม่ (Purchase Order)</span>
                          </div>
                          <span className="text-[10px] text-amber-700 dark:text-amber-300">
                            พร้อมปุ่มยืนยันคำสั่งซื้อทันทีใน LINE
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* DEDICATED PURCHASE ORDER LINE DESTINATION (SEPARATE GROUP/BOT) */}
                  <div className="bg-amber-500/10 dark:bg-amber-950/25 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-5 space-y-4 transition-all">
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                          <ShoppingCart className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-amber-200 flex items-center gap-2 flex-wrap">
                            <span>🎯 แยก LINE แจ้งเตือนการสั่งของโดยเฉพาะ</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              Purchase Order Only
                            </span>
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                            ส่งใบสั่งซื้อพร้อมปุ่มยืนยันไปยังกลุ่ม/แชทสั่งของแยกต่างหาก (ไม่ปนกับแจ้งเตือนเบิก-รับทั่วไป)
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 sm:mt-0">
                        <input
                          type="checkbox"
                          checked={config.useSeparateOrderDestination || false}
                          onChange={(e) => setConfig({ ...config, useSeparateOrderDestination: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-600"></div>
                      </label>
                    </div>

                    {config.useSeparateOrderDestination ? (
                      <div className="pt-3 space-y-4 border-t border-amber-500/30 animate-in fade-in duration-200">
                        {/* Order Destination ID */}
                        <div className="space-y-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              Destination ID สำหรับสั่งของ (Group ID หรือ User ID) <span className="text-red-500">*</span>
                            </span>
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md">
                              ปลายทางเฉพาะสั่งของ
                            </span>
                          </label>
                          <input
                            type="text"
                            value={config.purchaseOrderDestinationId || ''}
                            onChange={(e) => setConfig({ ...config, purchaseOrderDestinationId: e.target.value.trim() })}
                            placeholder="เช่น Cxxxxxxxxxxxxxxxxxxxxxxxx (Group ID) หรือ Uxxxxxxxx (User ID)"
                            className="w-full bg-white dark:bg-slate-850 border-2 border-amber-400/80 dark:border-amber-600/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-colors shadow-2xs"
                          />
                          <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                            <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <span>💡 ข้อมูลที่ต้องกรอก:</span>
                            </div>
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                              <li>
                                <strong>Group ID:</strong> ขึ้นต้นด้วย <strong>C...</strong> หรือ <strong>R...</strong> (เชิญ LINE Bot เข้ากลุ่มสั่งของก่อน แล้วดู Group ID)
                              </li>
                              <li>
                                <strong>User ID:</strong> ขึ้นต้นด้วย <strong>U...</strong> (กรณีต้องการส่งแจ้งเตือนสั่งของเข้าแชทส่วนตัวของเจ้าหน้าที่จัดซื้อ)
                              </li>
                            </ul>
                          </div>
                        </div>

                        {/* Order Channel Access Token (Optional) */}
                        <div className="space-y-1.5">
                          <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              Channel Access Token เฉพาะสั่งซื้อ (ทางเลือกเสริม)
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">เว้นว่างได้</span>
                          </label>
                          <div className="relative">
                            <input
                              type={showPoToken ? 'text' : 'password'}
                              value={config.purchaseOrderChannelAccessToken || ''}
                              onChange={(e) => setConfig({ ...config, purchaseOrderChannelAccessToken: e.target.value.trim() })}
                              placeholder="เว้นว่างไว้หากใช้บอทตัวเดียวกัน (ระบบจะใช้ Token หลักอัตโนมัติ)"
                              className="w-full bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white font-mono focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-none transition-colors shadow-2xs"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPoToken(!showPoToken)}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                              {showPoToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            * หากใช้ LINE Official Account ตัวเดิมสำหรับทั้งระบบ <strong>ไม่ต้องกรอกช่อง Token นี้</strong>
                          </p>
                        </div>

                        {/* Test Order Notification Button */}
                        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={handleTestSendOrderLine}
                            disabled={testingPo || !(config.purchaseOrderDestinationId || config.destinationId)}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer"
                          >
                            {testingPo ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>กำลังส่งการ์ดทดสอบสั่งของ...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>🔔 ทดสอบส่งการ์ดสั่งซื้อไปยัง LINE นี้</span>
                              </>
                            )}
                          </button>

                          {testPoResult && (
                            <div className={`text-xs px-3.5 py-2 rounded-xl border font-semibold flex items-center gap-2 ${
                              testPoResult.success
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                            }`}>
                              {testPoResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                              <span>{testPoResult.success ? 'ส่งการ์ดทดสอบสั่งซื้อสินค้าสำเร็จ!' : (testPoResult.error || 'ส่งไม่สำเร็จ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/40 p-3 rounded-xl border border-amber-500/20 flex items-center justify-between">
                        <span>ปัจจุบันใช้ปลายทางหลัก: <strong>{config.destinationId ? `ID: ${config.destinationId}` : 'ยังไม่ได้ตั้งค่า'}</strong></span>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">แตะเปิดสวิตช์ด้านบนเพื่อแยกกลุ่ม</span>
                      </div>
                    )}
                  </div>

                  {/* LINE 1-Click Confirm Feature Card */}
                  <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-900/10 dark:bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-emerald-300">
                          ระบบยืนยันคำสั่งซื้อทันทีใน LINE (พร้อมใช้งาน)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        ไม่ต้องตั้งค่า Webhook
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      เมื่อมีการขอสั่งซื้อสินค้า ระบบจะส่งการ์ดแจ้งเตือนพร้อมปุ่ม <strong>"✅ ยืนยันการสั่งซื้อทันที"</strong> เข้าในห้องแชท LINE ของคุณ:
                    </p>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-500/20 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">1.</span>
                        <span>แตะปุ่ม <strong>"✅ ยืนยันการสั่งซื้อทันที"</strong> ในแชท LINE โดยตรง</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">2.</span>
                        <span>ระบบจะ<strong>บันทึกสถานะเป็น "ยืนยันแล้ว" ลง Firestore ทันที</strong> และอัปเดตสต็อกสินค้า Real-time</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">3.</span>
                        <span>ส่งข้อความยืนยันพร้อมรายละเอียดกลับเข้าห้องแชท LINE และ<strong>ปิดหน้านี้กลับสู่แชท LINE ให้อัตโนมัติใน 3 วินาที</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Test Result Message */}
                  {testResult && (
                    <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}>
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {testResult.success 
                          ? 'ส่งข้อความทดสอบไปยัง LINE สำเร็จเรียบร้อยแล้ว!' 
                          : `เกิดข้อผิดพลาด: ${testResult.error || 'ส่งไม่สำเร็จ'}`}
                      </span>
                    </div>
                  )}

                  {/* Save Success Banner */}
                  {saveSuccess && (
                    <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>บันทึกการตั้งค่า LINE สำเร็จเรียบร้อยแล้ว (มีผลกับผู้ใช้งานทุกคน)</span>
                    </div>
                  )}

                  {/* Action Buttons for LINE */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleTestSendLine}
                      disabled={testing || !config.channelAccessToken || !config.destinationId}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {testing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังทดสอบส่ง...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>ทดสอบส่งข้อความ LINE</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveLine()}
                      disabled={saving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังบันทึก...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>บันทึกการตั้งค่า LINE</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default NotificationSettingsModal;
