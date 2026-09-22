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
  BellOff
} from 'lucide-react';
import { LineNotificationConfig, User, WebPushNotificationConfig } from '../types';
import { getLineConfig, saveLineConfig, testLineNotification } from '../utils/lineNotify';
import { 
  isWebPushSupported, 
  getWebPushPermission, 
  getWebPushConfig, 
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
  });
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Web Push State
  const [webPushSupported, setWebPushSupported] = useState(true);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [webPushConfig, setWebPushConfig] = useState<WebPushNotificationConfig>(getWebPushConfig());
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushTesting, setPushTesting] = useState(false);
  const [pushMessage, setPushMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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
    setWebPushConfig(getWebPushConfig());

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
          const updated = { ...webPushConfig, enabled: false };
          setWebPushConfig(updated);
          saveWebPushConfig(updated);
          setPushMessage({ type: 'info', text: 'ยกเลิกการรับแจ้งเตือน Web Push บนอุปกรณ์นี้เรียบร้อยแล้ว' });
        } else {
          setPushMessage({ type: 'error', text: res.error || 'ไม่สามารถยกเลิกได้' });
        }
      } else {
        const res = await subscribeToWebPush(currentUser);
        if (res.success) {
          setIsPushSubscribed(true);
          setPushPermission('granted');
          const updated = { ...webPushConfig, enabled: true };
          setWebPushConfig(updated);
          saveWebPushConfig(updated);
          setPushMessage({ type: 'success', text: 'เปิดรับการแจ้งเตือน Web Push สำเร็จแล้ว! พร้อมแจ้งเตือนแม้ไม่ได้เปิดหน้าจออยู่' });
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

  const handleTogglePushOption = (key: keyof WebPushNotificationConfig) => {
    const updated = {
      ...webPushConfig,
      [key]: !webPushConfig[key]
    };
    setWebPushConfig(updated);
    saveWebPushConfig(updated);
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

  const handleSaveLine = async (e?: React.FormEvent) => {
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

  if (!isOpen) return null;

  const isConfigured = Boolean(config.channelAccessToken && config.destinationId);
  const isAdmin = currentUser.role === 'admin';

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

        {/* Top Navigation Tabs */}
        <div className="flex border-b border-white/40 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md p-2 gap-2 shrink-0">
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

          {isAdmin && (
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
          )}
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

              {/* Master Device Toggle */}
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

              {/* Alert Conditions Checklist */}
              <div className="space-y-3 bg-white dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>เงื่อนไขการแจ้งเตือน Web Push:</span>
                </h5>

                <div className="space-y-2">
                  {/* Low Stock Alert */}
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={webPushConfig.notifyLowStock}
                      onChange={() => handleTogglePushOption('notifyLowStock')}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        <span>แจ้งเตือนสต็อกสินค้าต่ำ (Low Stock Alert)</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        ส่งเตือนทันทีเมื่อจำนวนสินค้าในคลังลดลงจนเท่ากับหรือต่ำกว่าจุดสั่งซื้อขั้นต่ำ (Min Stock) หรือสินค้าหมด (0 หน่วย)
                      </p>
                    </div>
                  </label>

                  {/* Important Requisition Alert */}
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/60 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={webPushConfig.notifyImportantRequisition}
                      onChange={() => handleTogglePushOption('notifyImportantRequisition')}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <PackageMinus className="w-3.5 h-3.5 text-blue-500" />
                        <span>แจ้งเตือนเมื่อมีการเบิกจ่ายสำคัญ (Important Requisition Alert)</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        ส่งเตือนเมื่อมีการเบิกจ่ายจำนวนมาก (ตั้งแต่ 5 หน่วยขึ้นไป) หรือมีวัตถุประสงค์งานสำคัญ งานด่วน งานฉุกเฉิน หรือผ่าน AI Assistant
                      </p>
                    </div>
                  </label>
                </div>
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
                      <span>🔔 ทดสอบส่ง Web Push ตอนนี้</span>
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
                        <span>เข้าสู่ระบบ (Login)</span>
                      </div>
                    </div>
                  </label>
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
                  <span>บันทึกการตั้งค่า LINE สำเร็จเรียบร้อยแล้ว</span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
