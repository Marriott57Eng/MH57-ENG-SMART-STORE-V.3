import { WebPushPayload, WebPushNotificationConfig } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const DEFAULT_WEBPUSH_CONFIG: WebPushNotificationConfig = {
  enabled: true,
  notifyLowStock: true,
  notifyImportantRequisition: true,
  notifyPurchaseOrder: true,
};

let cachedWebPushConfig: WebPushNotificationConfig | null = null;

/**
 * Utility to convert VAPID public key from URL-safe Base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if Web Push and Service Worker are supported in the current browser
 */
export function isWebPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export const getWebPushPermission = getNotificationPermission;

/**
 * Get cached Web Push config synchronously (fallback to localStorage or defaults)
 */
export function getWebPushConfig(): WebPushNotificationConfig {
  if (cachedWebPushConfig) return cachedWebPushConfig;
  try {
    const raw = localStorage.getItem('webpush_config');
    if (raw) {
      cachedWebPushConfig = { ...DEFAULT_WEBPUSH_CONFIG, ...JSON.parse(raw) };
      return cachedWebPushConfig;
    }
  } catch (_) {}
  return DEFAULT_WEBPUSH_CONFIG;
}

/**
 * Fetch master Web Push config from Firestore (configured by Admin)
 * All regular users inherit this master config
 */
export async function fetchWebPushConfigFromFirestore(): Promise<WebPushNotificationConfig> {
  try {
    const docRef = doc(db, 'settings', 'webpush_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const remoteData = { ...DEFAULT_WEBPUSH_CONFIG, ...(snap.data() as WebPushNotificationConfig) };
      cachedWebPushConfig = remoteData;
      try {
        localStorage.setItem('webpush_config', JSON.stringify(remoteData));
      } catch (_) {}
      return remoteData;
    }
  } catch (err) {
    console.warn('Failed to fetch Web Push config from Firestore, trying backend:', err);
  }

  // Fallback to backend API
  try {
    const res = await fetch('/api/push/config');
    if (res.ok) {
      const serverCfg = await res.json();
      if (serverCfg && serverCfg.success && serverCfg.config) {
        cachedWebPushConfig = { ...DEFAULT_WEBPUSH_CONFIG, ...serverCfg.config };
        return cachedWebPushConfig;
      }
    }
  } catch (_) {}

  return getWebPushConfig();
}

/**
 * Save master Web Push config to Firestore (Admin only)
 * Synchronizes to both Firestore and backend server memory
 */
export async function saveWebPushConfig(
  cfg: Partial<WebPushNotificationConfig>,
  updatedBy?: string
): Promise<WebPushNotificationConfig> {
  const current = getWebPushConfig();
  const updated: WebPushNotificationConfig = {
    ...current,
    ...cfg,
    updatedAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  };
  cachedWebPushConfig = updated;
  try {
    localStorage.setItem('webpush_config', JSON.stringify(updated));
  } catch (_) {}

  try {
    const docRef = doc(db, 'settings', 'webpush_config');
    await setDoc(docRef, updated, { merge: true });
  } catch (err) {
    console.error('Failed to save Web Push config to Firestore:', err);
  }

  // Also sync to backend server
  try {
    await fetch('/api/push/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (_) {}

  return updated;
}

/**
 * Check if current client has an active push subscription
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('Error checking existing push subscription:', err);
    return null;
  }
}

/**
 * Subscribe the current device/browser to Web Push Notifications
 */
export async function subscribeToWebPush(user?: { id?: string; name?: string; role?: string }): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isWebPushSupported()) {
    return {
      success: false,
      error: 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ Web Push',
    };
  }

  try {
    // 1. Request notification permission from the user
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        error: permission === 'denied' 
          ? 'การแจ้งเตือนถูกปิดกั้นในบราวเซอร์ กรุณาเปิดการอนุญาตแจ้งเตือนในหน้าตั้งค่าเว็บไซต์' 
          : 'ยังไม่ได้กดยืนยันการอนุญาตการแจ้งเตือน',
      };
    }

    // 2. Ensure service worker is active
    const registration = await navigator.serviceWorker.ready;

    // 3. Fetch public VAPID key from backend
    const keyRes = await fetch('/api/push/public-key');
    if (!keyRes.ok) {
      throw new Error('ไม่สามารถดึงรหัสความปลอดภัย VAPID Key จากเซิร์ฟเวอร์ได้');
    }
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) {
      throw new Error(keyData.error || 'ไม่พบ VAPID Public Key');
    }

    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);

    // 4. Subscribe with PushManager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    // 5. Send subscription to server
    const subscribeRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        userId: user?.id || 'guest',
        userName: user?.name || 'ผู้ใช้งานคลัง',
        deviceInfo: navigator.userAgent.slice(0, 100),
      }),
    });

    const subscribeData = await subscribeRes.json();
    if (!subscribeRes.ok || !subscribeData.success) {
      throw new Error(subscribeData.error || 'บันทึกการสมัครรับแจ้งเตือนไม่สำเร็จ');
    }

    try {
      localStorage.setItem('webpush_enabled', 'true');
    } catch (_) {}

    return {
      success: true,
      subscription,
    };
  } catch (err: any) {
    console.error('Web Push subscription failed:', err);
    return {
      success: false,
      error: err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน Web Push',
    };
  }
}

/**
 * Unsubscribe from Web Push notifications
 */
export async function unsubscribeFromWebPush(): Promise<{ success: boolean; error?: string }> {
  if (!isWebPushSupported()) {
    return { success: true };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }

    try {
      localStorage.removeItem('webpush_enabled');
    } catch (_) {}

    return { success: true };
  } catch (err: any) {
    console.error('Error unsubscribing from Web Push:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send Web Push notification (Broadcasts to all subscribed devices even if app is closed)
 */
export async function sendWebPushNotification(payload: WebPushPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'ส่งการแจ้งเตือนไม่สำเร็จ' };
    }
    return { success: true };
  } catch (err: any) {
    console.warn('sendWebPushNotification exception:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger Low Stock Web Push alert (respects Admin master config)
 */
export async function triggerLowStockPush(item: {
  id: string;
  name: string;
  unit: string;
  location?: string;
  minStock?: number;
}, newQty: number) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || !cfg.notifyLowStock) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const isOutOfStock = newQty <= 0;
  const title = isOutOfStock 
    ? `🚨 อะไหล่หมดสต็อก: ${item.name}` 
    : `⚠️ สินค้าใกล้หมดสต็อก: ${item.name}`;

  const body = isOutOfStock
    ? `รหัส ${item.id} จำนวนเหลือ 0 ${item.unit}! กรุณาดำเนินการสั่งซื้อด่วน (ที่เก็บ: ${item.location || 'Store FL.6'})`
    : `รหัส ${item.id} คงเหลือเพียง ${newQty} ${item.unit} (จุดเตือน: ${item.minStock || 5}) ที่เก็บ: ${item.location || 'Store FL.6'}`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/logo.png',
    badge: '/icon-192.png',
    tag: `low-stock-${item.id}`,
    url: `/?tab=inventory&search=${encodeURIComponent(item.id)}`,
    type: 'low_stock',
    data: { itemId: item.id, newQty, minStock: item.minStock },
  });
}

/**
 * Trigger Important Requisition Web Push alert (respects Admin master config)
 */
export async function triggerImportantRequisitionPush(data: {
  itemId?: string;
  itemName: string;
  qty: number;
  unit: string;
  requestedBy: string;
  purpose: string;
  newQty?: number;
  isImportant?: boolean;
}) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || !cfg.notifyImportantRequisition) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const title = `📋 มีการเบิกจ่ายอะไหล่: ${data.itemName}`;
  const remainText = data.newQty !== undefined ? ` (คงเหลือ: ${data.newQty} ${data.unit})` : '';
  const body = `ผู้เบิก: ${data.requestedBy} | จำนวน ${data.qty} ${data.unit} | เพื่องาน: "${data.purpose}"${remainText}`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/logo.png',
    badge: '/icon-192.png',
    tag: `req-${Date.now()}`,
    url: '/?tab=history',
    type: 'requisition',
    data,
  });
}

/**
 * Trigger Purchase Order Web Push alert (respects Admin master config)
 */
export async function triggerPurchaseOrderPush(order: {
  id: string;
  itemName: string;
  qty: number;
  unit: string;
  requestedBy: string;
  urgency?: string;
}) {
  const cfg = await fetchWebPushConfigFromFirestore();
  if (!cfg.enabled || cfg.notifyPurchaseOrder === false) {
    return { success: false, skipped: true, reason: 'Disabled by Admin config' };
  }

  const urgencyText = order.urgency === 'urgent' ? ' [ด่วนมาก]' : '';
  const title = `🛒 มีคำขอสั่งของใหม่${urgencyText}: ${order.itemName}`;
  const body = `ผู้ขอ: ${order.requestedBy} | จำนวน ${order.qty} ${order.unit} | รอแอดมินยืนยันคำสั่งซื้อ`;

  return await sendWebPushNotification({
    title,
    body,
    icon: '/logo.png',
    badge: '/icon-192.png',
    tag: `order-${order.id}`,
    url: '/?tab=orders',
    type: 'order',
    data: order,
  });
}

/**
 * Send a test Web Push notification to all devices
 */
export async function testWebPushNotification(): Promise<{ success: boolean; message?: string; error?: string; sent?: number }> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'การทดสอบ Web Push ไม่สำเร็จ' };
    }
    return { success: true, message: data.message || 'ส่งการแจ้งเตือนทดสอบสำเร็จแล้ว', sent: data.sent };
  } catch (err: any) {
    return { success: false, error: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
  }
}
