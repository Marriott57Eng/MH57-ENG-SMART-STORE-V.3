import express from "express";
import path from "path";
import { GoogleGenAI, LiveServerMessage, Modality, Type, ThinkingLevel } from "@google/genai";
import fs from "fs";
import { WebSocketServer } from "ws";
import http from "http";
import webpush from "web-push";
import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, collection, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  pushLineMessage, 
  pushPurchaseOrderLineMessage,
  replyLineMessage,
  getLineUserProfile,
  createStockFlexMessage, 
  createBulkStockFlexMessage,
  createAuthFlexMessage, 
  createTestFlexMessage, 
  createPurchaseOrderFlexMessage,
  createOrderConfirmedFlexMessage,
  getServerLineConfig, 
  updateServerLineConfig 
} from './server/lineService.ts';
import { 
  SYSTEM_EMPLOYEES, 
  getSystemEmployeeCatalogForAi, 
  findEmployeeInSystem 
} from './src/utils/employeeDirectory.ts';

// ==========================================
// Web Push Notifications Engine (VAPID)
// ==========================================
interface WebPushSubscriptionRecord {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userName?: string;
  deviceInfo?: string;
  subscribedAt: string;
}

let vapidKeys: { publicKey: string; privateKey: string } | null = null;
const memorySubscriptions: Map<string, WebPushSubscriptionRecord> = new Map();

interface ServerWebPushConfig {
  enabled: boolean;
  notifyLowStock: boolean;
  notifyImportantRequisition: boolean;
  notifyPurchaseOrder: boolean;
  importantRequisitionThreshold?: number;
  updatedAt?: string;
  updatedBy?: string;
}

let serverWebPushConfig: ServerWebPushConfig = {
  enabled: true,
  notifyLowStock: true,
  notifyImportantRequisition: true,
  notifyPurchaseOrder: true,
};

interface ServerGeoConfig {
  isGeoLocationEnabled: boolean;
  lat: number;
  lng: number;
  maxDistanceMeters: number;
  locationName: string;
  updatedAt?: string;
  updatedBy?: string;
}

let serverGeoConfig: ServerGeoConfig = {
  isGeoLocationEnabled: true,
  lat: 13.7233708,
  lng: 100.5805155,
  maxDistanceMeters: 100,
  locationName: 'Bangkok Marriott Hotel Sukhumvit (Store FL.6)',
};

async function getOrInitVapidKeys() {
  if (vapidKeys) return vapidKeys;
  try {
    if (firestoreDb) {
      const docSnap = await getDoc(doc(firestoreDb, 'settings', 'web_push_vapid'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.publicKey && data.privateKey) {
          vapidKeys = { publicKey: data.publicKey, privateKey: data.privateKey };
          webpush.setVapidDetails('mailto:support@engstore.app', vapidKeys.publicKey, vapidKeys.privateKey);
          return vapidKeys;
        }
      }
    }
  } catch (err) {
    console.warn("Could not read vapid keys from Firestore:", err);
  }

  // Generate new persistent VAPID keys
  const keys = webpush.generateVAPIDKeys();
  vapidKeys = keys;
  webpush.setVapidDetails('mailto:support@engstore.app', vapidKeys.publicKey, vapidKeys.privateKey);

  try {
    if (firestoreDb) {
      await setDoc(doc(firestoreDb, 'settings', 'web_push_vapid'), keys);
    }
  } catch (err) {
    console.warn("Could not persist vapid keys to Firestore:", err);
  }

  return vapidKeys;
}

async function loadSubscriptions(): Promise<WebPushSubscriptionRecord[]> {
  try {
    if (firestoreDb) {
      const snap = await getDocs(collection(firestoreDb, 'push_subscriptions'));
      snap.forEach(d => {
        const data = d.data() as WebPushSubscriptionRecord;
        if (data && data.endpoint && data.keys) {
          memorySubscriptions.set(data.endpoint, data);
        }
      });
    }
  } catch (err) {
    console.warn("Failed to load push subscriptions from Firestore:", err);
  }
  return Array.from(memorySubscriptions.values());
}

async function sendWebPushToAll(payload: {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  type?: 'low_stock' | 'requisition' | 'system';
  data?: any;
}) {
  try {
    await getOrInitVapidKeys();
    const subs = await loadSubscriptions();
    if (subs.length === 0) {
      console.log("Web Push: No active subscriptions registered yet.");
      return { sent: 0, failed: 0, total: 0 };
    }

    const payloadString = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/icon-192.png',
      tag: payload.tag || `eng-push-${Date.now()}`,
      url: payload.url || '/',
      type: payload.type || 'system',
      data: payload.data || {},
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: sub.keys
        }, payloadString, {
          TTL: 60 * 60 * 24, // 24 hours
          urgency: 'high'
        });
        sent++;
      } catch (err: any) {
        failed++;
        // Remove dead/expired subscription (HTTP 404 or 410)
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          memorySubscriptions.delete(sub.endpoint);
          try {
            if (firestoreDb) {
              const subId = Buffer.from(sub.endpoint).toString('base64url').slice(0, 60);
              await deleteDoc(doc(firestoreDb, 'push_subscriptions', subId));
            }
          } catch (_) {}
        }
      }
    }

    return { sent, failed, total: subs.length };
  } catch (error: any) {
    console.error("sendWebPushToAll error:", error);
    return { sent: 0, failed: 0, total: 0, error: error.message };
  }
}

let ai: GoogleGenAI;
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = process.env.GEMINI_API_KEY
      ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
      : new GoogleGenAI({});
  }
  return ai;
}

let firebaseConfig: any = { projectId: "", firestoreDatabaseId: "(default)" };
try {
  if (fs.existsSync('firebase-applet-config.json')) {
    firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  }
} catch (err) {
  console.warn("Could not load firebase-applet-config.json");
}

let firebaseApp: any = null;
let firestoreDb: any = null;
try {
  if (firebaseConfig && firebaseConfig.projectId) {
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");
  }
} catch (err) {
  console.warn("Firebase initialization skipped in server:", err);
}



const SPREADSHEET_ID = "1CcVHWwEiFyZHa684ftrevx2aXt-DKn7mMqYp7QsZ2sc";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;

// Simple CSV parser supporting quotes and commas
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(cell.trim());
      cell = '';
      if (row.length > 0 && row.some(c => c.length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

interface Item {
  id: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  minStock: number;
  location: string;
  note: string;
  ordered: string;
  orderedDate: string;
  status: 'normal' | 'low' | 'out';
  outOfStockDate?: string;
}

let cachedItems: Item[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 120 * 1000; // 2 minutes cache

async function fetchInventoryFromFirestore(): Promise<Item[]> {
  try {
    if (!firestoreDb) return [];
    const snap = await getDocs(collection(firestoreDb, 'inventory'));
    if (!snap.empty) {
      const items: Item[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const qty = Number(data.qty) || 0;
        const minStock = Number(data.minStock) || 1;
        let status: 'normal' | 'low' | 'out' = data.status || 'normal';
        if (qty <= 0) status = 'out';
        else if (qty <= minStock) status = 'low';

        items.push({
          id: data.id || d.id,
          name: data.name || '',
          category: data.category || 'ทั่วไป',
          unit: data.unit || 'ชิ้น',
          qty,
          minStock,
          location: data.location || 'Store FL.6',
          note: data.note || '',
          ordered: data.ordered || '',
          orderedDate: data.orderedDate || '',
          outOfStockDate: data.outOfStockDate || (qty <= 0 ? new Date().toISOString() : ''),
          status,
        });
      });
      return items;
    }
  } catch (err) {
    console.warn("Failed to fetch inventory from Firestore:", err);
  }
  return [];
}

async function fetchInventoryFromSheet(force = false): Promise<Item[]> {
  if (!force && cachedItems.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedItems;
  }

  const firestoreItems = await fetchInventoryFromFirestore();
  if (firestoreItems.length > 0) {
    cachedItems = firestoreItems;
    cacheTimestamp = Date.now();
    return firestoreItems;
  }

  // Fallback to CSV if Firestore is empty
  try {
    const res = await fetch(SHEET_CSV_URL, {
      headers: { 'User-Agent': 'Warehouse-Manager/1.0' },
    });
    if (!res.ok) throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) return cachedItems;

    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const idIdx = headers.findIndex(h => h.includes('itemid') || h.includes('id') || h.includes('code'));
    const nameIdx = headers.findIndex(h => h.includes('itemname') || h.includes('name') || h.includes('ชื่อ'));
    const catIdx = headers.findIndex(h => h.includes('category') || h.includes('หมวด'));
    const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('หน่วย'));
    const qtyIdx = headers.findIndex(h => h.includes('qty') || h.includes('quantity') || h.includes('จำนวน'));
    const minStockIdx = headers.findIndex(h => h.includes('minstock') || h.includes('min') || h.includes('ขั้นต่ำ'));
    const locIdx = headers.findIndex(h => h.includes('location') || h.includes('ที่อยู่') || h.includes('สถานที่'));
    const noteIdx = headers.findIndex(h => h.includes('note') || h.includes('หมายเหตุ'));
    const ordIdx = headers.findIndex(h => h.includes('ordered') && !h.includes('date'));
    const ordDateIdx = headers.findIndex(h => h.includes('ordereddate') || h.includes('date'));

    const items: Item[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const rawId = idIdx !== -1 ? row[idIdx] : (row[0] || `ITEM-${r}`);
      const rawName = nameIdx !== -1 ? row[nameIdx] : (row[1] || 'ไม่ระบุชื่อ');
      if (!rawName && !rawId) continue;
      const rawCategory = catIdx !== -1 ? row[catIdx] : (row[2] || 'ทั่วไป');
      const rawUnit = unitIdx !== -1 ? row[unitIdx] : (row[3] || 'ชิ้น');
      const rawQty = qtyIdx !== -1 ? parseFloat(row[qtyIdx]) : (parseFloat(row[4]) || 0);
      const rawMin = minStockIdx !== -1 ? parseFloat(row[minStockIdx]) : (parseFloat(row[5]) || 0);
      const rawLoc = locIdx !== -1 ? row[locIdx] : (row[6] || 'Store FL.6');
      const rawNote = noteIdx !== -1 ? row[noteIdx] : (row[7] || '');
      const rawOrd = ordIdx !== -1 ? row[ordIdx] : (row[8] || '');
      const rawOrdDate = ordDateIdx !== -1 ? row[ordDateIdx] : (row[9] || '');

      const qty = isNaN(rawQty) ? 0 : rawQty;
      const minStock = isNaN(rawMin) ? 1 : rawMin;
      let status: 'normal' | 'low' | 'out' = 'normal';
      if (qty <= 0) status = 'out';
      else if (qty <= minStock) status = 'low';

      items.push({
        id: rawId || `ITEM-${r}`,
        name: rawName,
        category: rawCategory || 'ทั่วไป',
        unit: rawUnit || 'ชิ้น',
        qty,
        minStock,
        location: rawLoc || 'Store FL.6',
        note: rawNote,
        ordered: rawOrd,
        orderedDate: rawOrdDate,
        status,
      });
    }

    cachedItems = items;
    cacheTimestamp = Date.now();
    return items;
  } catch (err) {
    console.error('Error loading inventory sheet:', err);
    return cachedItems;
  }
}

async function startServer() {
  const app = express();
  // Dev server must run on port 3000 as Nginx proxies 8080 -> 3000
  const PORT = Number(process.env.DEFAULT_APP_PORT) || (process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000);

  app.use(express.json({ limit: "50mb" }));

  // Health check endpoints for Cloud Run container monitoring, startup, & rollout probes
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", time: new Date().toISOString() });
  });
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", time: new Date().toISOString() });
  });
  app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
  });
  app.get("/_health", (req, res) => {
    res.status(200).send("OK");
  });

  // API: Get Inventory Data
  app.get("/api/inventory", async (req, res) => {
    try {
      const force = req.query.refresh === 'true';
      const items = await fetchInventoryFromSheet(force);
      
      const totalItems = items.length;
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
      const lowStockCount = items.filter(i => i.status === 'low').length;
      const outOfStockCount = items.filter(i => i.status === 'out').length;

      const categoryMap = new Map<string, { count: number; totalQty: number }>();
      const locationMap = new Map<string, number>();

      for (const item of items) {
        const cat = item.category || 'ทั่วไป';
        const currentCat = categoryMap.get(cat) || { count: 0, totalQty: 0 };
        currentCat.count += 1;
        currentCat.totalQty += item.qty;
        categoryMap.set(cat, currentCat);

        const loc = item.location || 'Store FL.6';
        locationMap.set(loc, (locationMap.get(loc) || 0) + 1);
      }

      const categories = Array.from(categoryMap.entries()).map(([name, val]) => ({
        name,
        count: val.count,
        totalQty: val.totalQty,
      })).sort((a, b) => b.count - a.count);

      const locations = Array.from(locationMap.entries()).map(([name, count]) => ({
        name,
        count,
      })).sort((a, b) => b.count - a.count);

      res.json({
        items,
        summary: {
          totalItems,
          totalQty,
          lowStockCount,
          outOfStockCount,
          categories,
          locations,
          lastUpdated: new Date().toISOString(),
          sheetId: SPREADSHEET_ID,
        },
      });
    } catch (error: any) {
      console.error("Inventory fetch error:", error);
      res.status(500).json({ error: error.message });
    }
  });



  // API: Update item stock directly
  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { qty, minStock, location, note } = req.body;
      const items = await fetchInventoryFromSheet();
      const targetItem = items.find(i => i.id === id);
      if (!targetItem) {
        return res.status(404).json({ error: "Item not found" });
      }

      if (typeof qty === 'number') {
        targetItem.qty = Math.max(0, qty);
        if (targetItem.qty <= 0) {
          targetItem.status = 'out';
          if (!targetItem.outOfStockDate) targetItem.outOfStockDate = new Date().toISOString();
        } else if (targetItem.qty <= (targetItem.minStock || 1)) {
          targetItem.status = 'low';
          targetItem.outOfStockDate = '';
        } else {
          targetItem.status = 'normal';
          targetItem.outOfStockDate = '';
        }
      }
      if (typeof minStock === 'number') targetItem.minStock = minStock;
      if (typeof location === 'string') targetItem.location = location;
      if (typeof note === 'string') targetItem.note = note;

      if (firestoreDb) {
        await setDoc(doc(firestoreDb, 'inventory', targetItem.id), targetItem);
      }
      cacheTimestamp = 0; // force refresh cache

      res.json({ success: true, item: targetItem });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync initial LINE config from Firestore if available
  if (firestoreDb) {
    getDoc(doc(firestoreDb, 'settings', 'line_config')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        updateServerLineConfig(data as any);
        console.log("LINE notification config loaded from Firestore");
      }
    }).catch((err) => {
      console.warn("Could not load LINE config from Firestore on startup:", err?.message || err);
    });

    getDoc(doc(firestoreDb, 'settings', 'webpush_config')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        serverWebPushConfig = { ...serverWebPushConfig, ...(data as any) };
        console.log("Web Push notification config loaded from Firestore");
      }
    }).catch((err) => {
      console.warn("Could not load Web Push config from Firestore on startup:", err?.message || err);
    });

    getDoc(doc(firestoreDb, 'settings', 'geo_config')).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        serverGeoConfig = { ...serverGeoConfig, ...(data as any) };
        console.log("Geo Location config loaded from Firestore");
      }
    }).catch((err) => {
      console.warn("Could not load Geo config from Firestore on startup:", err?.message || err);
    });
  }

  // API: Get Geo Location Central Config (Master config set by Admin)
  app.get("/api/geo/config", async (req, res) => {
    try {
      if (firestoreDb) {
        const snap = await getDoc(doc(firestoreDb, 'settings', 'geo_config'));
        if (snap.exists()) {
          const data = snap.data();
          serverGeoConfig = { ...serverGeoConfig, ...(data as any) };
        }
      }
      res.json(serverGeoConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Update Geo Location Central Config (Admin only)
  app.post("/api/geo/config", async (req, res) => {
    try {
      const updated = req.body;
      serverGeoConfig = {
        ...serverGeoConfig,
        ...updated,
        updatedAt: new Date().toISOString(),
      };
      if (firestoreDb) {
        await setDoc(doc(firestoreDb, 'settings', 'geo_config'), serverGeoConfig, { merge: true });
      }
      res.json({ success: true, config: serverGeoConfig });
    } catch (error: any) {
      console.error("Save Geo config error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: Get LINE Notification Config
  app.get("/api/line/config", async (req, res) => {
    try {
      const config = getServerLineConfig();
      // Mask token for security when sending to frontend
      const maskedToken = config.channelAccessToken 
        ? `${config.channelAccessToken.slice(0, 8)}...${config.channelAccessToken.slice(-6)}` 
        : '';
      const maskedPoToken = config.purchaseOrderChannelAccessToken 
        ? `${config.purchaseOrderChannelAccessToken.slice(0, 8)}...${config.purchaseOrderChannelAccessToken.slice(-6)}` 
        : '';
      res.json({
        ...config,
        hasToken: !!config.channelAccessToken,
        maskedToken,
        hasPoToken: !!config.purchaseOrderChannelAccessToken,
        maskedPoToken,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Save LINE Notification Config
  app.post("/api/line/config", async (req, res) => {
    try {
      const updated = req.body;
      const current = getServerLineConfig();
      
      // If client didn't send a new token (or sent masked), keep existing
      const token = (updated.channelAccessToken && !updated.channelAccessToken.includes('...'))
        ? updated.channelAccessToken
        : current.channelAccessToken;

      const poToken = (updated.purchaseOrderChannelAccessToken && !updated.purchaseOrderChannelAccessToken.includes('...'))
        ? updated.purchaseOrderChannelAccessToken
        : (updated.purchaseOrderChannelAccessToken === '' ? '' : current.purchaseOrderChannelAccessToken);

      const newConfig = updateServerLineConfig({
        ...updated,
        channelAccessToken: token,
        purchaseOrderChannelAccessToken: poToken,
      });

      if (firestoreDb) {
        await setDoc(doc(firestoreDb, 'settings', 'line_config'), newConfig, { merge: true });
      }

      res.json({ success: true, config: newConfig });
    } catch (error: any) {
      console.error("Save LINE config error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: Test LINE Notification
  app.post("/api/line/test", async (req, res) => {
    try {
      const { channelAccessToken, destinationId, isOrderTest } = req.body;
      const currentConfig = getServerLineConfig();
      const token = (channelAccessToken && !channelAccessToken.includes('...')) 
        ? channelAccessToken 
        : (isOrderTest && currentConfig.purchaseOrderChannelAccessToken ? currentConfig.purchaseOrderChannelAccessToken : currentConfig.channelAccessToken);
      const dest = destinationId || (isOrderTest && currentConfig.purchaseOrderDestinationId ? currentConfig.purchaseOrderDestinationId : currentConfig.destinationId);

      if (!token) {
        return res.status(400).json({ success: false, error: 'กรุณากรอก LINE Channel Access Token' });
      }
      if (!dest) {
        return res.status(400).json({ success: false, error: 'กรุณากรอก LINE Destination ID (User ID หรือ Group ID)' });
      }

      let testMessage: any;
      if (isOrderTest) {
        const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        testMessage = createPurchaseOrderFlexMessage({
          order: {
            id: 'PO-TEST-' + Math.floor(1000 + Math.random() * 9000),
            itemId: 'TEST-001',
            itemName: 'กล่องทดสอบระบบสั่งซื้อ (LINE Test PO)',
            category: 'วัสดุสิ้นเปลือง',
            qty: 10,
            unit: 'กล่อง',
            currentQty: 2,
            minStock: 5,
            location: 'ชั้น A1',
            requestedBy: 'ระบบทดสอบ (Admin)',
            brand: 'ENG SMART STORE',
            model: 'v2.5',
            status: 'pending',
            createdAt: new Date().toLocaleString('th-TH'),
          },
          baseUrl: origin,
        });
      } else {
        testMessage = createTestFlexMessage();
      }

      const result = await pushLineMessage([testMessage], token, dest);

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ 
        success: true, 
        message: isOrderTest 
          ? 'ส่งการ์ดทดสอบสั่งซื้อสินค้าไปยัง LINE ปลายทางสั่งของสำเร็จแล้ว!' 
          : 'ส่งข้อความทดสอบไปยัง LINE สำเร็จเรียบร้อยแล้ว!' 
      });
    } catch (error: any) {
      console.error("Test LINE notification error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API: Send LINE Notification
  app.post("/api/line/notify", async (req, res) => {
    try {
      const { type, data } = req.body;
      const config = getServerLineConfig();

      if (!config.enabled) {
        return res.json({ success: false, skipped: true, reason: 'LINE notifications disabled' });
      }

      if (!config.channelAccessToken || !config.destinationId) {
        return res.json({ success: false, skipped: true, reason: 'LINE token or destination not configured yet' });
      }

      let flexMessage: any = null;

      if (type === 'stock_in' || type === 'stock_out') {
        const isStockIn = type === 'stock_in';
        if (isStockIn && !config.notifyStockIn) {
          return res.json({ success: false, skipped: true, reason: 'Stock in notification disabled' });
        }
        if (!isStockIn && !config.notifyStockOut) {
          return res.json({ success: false, skipped: true, reason: 'Stock out notification disabled' });
        }
        flexMessage = createStockFlexMessage(data);
      } else if (type === 'bulk_stock_out') {
        if (!config.notifyStockOut) {
          return res.json({ success: false, skipped: true, reason: 'Stock out notification disabled' });
        }
        flexMessage = createBulkStockFlexMessage(data);
      } else if (type === 'login' || type === 'logout') {
        const isLogin = type === 'login';
        if (isLogin && !config.notifyLogin) {
          return res.json({ success: false, skipped: true, reason: 'Login notification disabled' });
        }
        if (!isLogin && !config.notifyLogout) {
          return res.json({ success: false, skipped: true, reason: 'Logout notification disabled' });
        }
        flexMessage = createAuthFlexMessage(data);
      } else if (type === 'purchase_order') {
        if (config.notifyPurchaseOrder === false) {
          return res.json({ success: false, skipped: true, reason: 'Purchase order notification disabled' });
        }
        const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        if (data.order && (data.order.status === 'confirmed' || data.order.status === 'received' || data.order.confirmedAt)) {
          flexMessage = createOrderConfirmedFlexMessage({
            order: data.order,
            baseUrl: data.baseUrl || origin,
          });
        } else {
          flexMessage = createPurchaseOrderFlexMessage({
            order: data.order,
            baseUrl: data.baseUrl || origin,
          });
        }
      } else if (type === 'order_confirmed') {
        const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        flexMessage = createOrderConfirmedFlexMessage({
          ...data,
          baseUrl: data.baseUrl || origin,
        });
      }

      if (!flexMessage) {
        return res.status(400).json({ success: false, error: 'Invalid notification type' });
      }

      // Check if this is a purchase order event and has separate destination configured
      const isOrderEvent = type === 'purchase_order' || type === 'order_confirmed';
      const useDedicatedOrder = isOrderEvent && Boolean(config.useSeparateOrderDestination && config.purchaseOrderDestinationId);

      const targetDestination = useDedicatedOrder 
        ? config.purchaseOrderDestinationId! 
        : config.destinationId;

      const targetToken = (useDedicatedOrder && config.purchaseOrderChannelAccessToken)
        ? config.purchaseOrderChannelAccessToken
        : config.channelAccessToken;

      const result = await pushLineMessage([flexMessage], targetToken, targetDestination);
      if (!result.success) {
        return res.json({ success: false, skipped: result.skipped ?? false, error: result.error });
      }

      res.json({ success: true, message: 'LINE notification sent successfully' });
    } catch (error: any) {
      console.warn("LINE notify endpoint exception:", error?.message || error);
      res.json({ success: false, error: error?.message || 'Failed to process notification' });
    }
  });

  // API: LINE Messaging API Webhook Status / Verification Check
  app.get("/api/line/webhook", (req, res) => {
    res.json({
      status: "ready",
      service: "ENG SMART STORE - LINE Webhook Engine",
      features: [
        "One-Click Postback Order Confirmation directly inside LINE chat",
        "Instant Firestore real-time status update without external redirection",
        "Automatic LINE reply confirmation card",
        "Web Push notification integration"
      ],
      time: new Date().toISOString()
    });
  });

  // API: LINE Messaging API Webhook Handler
  // Processes postback clicks directly in LINE (zero redirect, immediate Firestore save)
  app.post("/api/line/webhook", async (req, res) => {
    try {
      const body = req.body || {};
      const events: any[] = body.events || [];

      // Verification ping from LINE Developers Console (events is empty or test event)
      if (!events || events.length === 0) {
        return res.status(200).send("OK");
      }

      for (const event of events) {
        // 1. Handle Postback Event (from Flex Message button click)
        if (event.type === 'postback' && event.postback?.data) {
          const params = new URLSearchParams(event.postback.data);
          const action = params.get('action');
          const orderId = (params.get('orderId') || '').trim();
          const token = (params.get('token') || '').trim();

          if (action === 'confirm_order' && orderId) {
            if (!firestoreDb) {
              if (event.replyToken) {
                await replyLineMessage(event.replyToken, [{
                  type: 'text',
                  text: '⚠️ เกิดข้อผิดพลาด: ระบบฐานข้อมูล Firestore ยังไม่พร้อมเชื่อมต่อ กรุณาลองใหม่อีกครั้ง'
                }]);
              }
              continue;
            }

            const orderRef = doc(firestoreDb, 'orders', orderId);
            const orderSnap = await getDoc(orderRef);

            if (!orderSnap.exists()) {
              if (event.replyToken) {
                await replyLineMessage(event.replyToken, [{
                  type: 'text',
                  text: `❌ ไม่พบใบสั่งซื้อรหัส "${orderId}" ในระบบ`
                }]);
              }
              continue;
            }

            const orderData: any = orderSnap.data();

            // Strict Single-Use Lock: Already confirmed, received, or cancelled
            const isAlreadyProcessed = orderData.status !== 'pending' || Boolean(orderData.confirmedAt) || Boolean(orderData.confirmationTokenUsed);
            if (isAlreadyProcessed) {
              if (event.replyToken) {
                const poToken = (getServerLineConfig().useSeparateOrderDestination && getServerLineConfig().purchaseOrderChannelAccessToken) 
                  ? getServerLineConfig().purchaseOrderChannelAccessToken 
                  : undefined;
                await replyLineMessage(event.replyToken, [{
                  type: 'text',
                  text: `🔒 ใบสั่งซื้อ ${orderId} (${orderData.itemName}) ได้รับการยืนยันไปแล้วเมื่อ ${orderData.confirmedAt || 'ก่อนหน้านี้'} โดย ${orderData.confirmedBy || 'ผู้ดูแลระบบ'}\n\n⚠️ ระบบล็อกถาวร: คำสั่งซื้อสามารถยืนยันได้เพียง 1 ครั้งเท่านั้น ไม่สามารถกดยืนยันซ้ำได้อีกครับ`
                }], poToken);
              }
              continue;
            }

            // Token security check if order has token
            if (orderData.confirmationToken && token && orderData.confirmationToken !== token) {
              if (event.replyToken) {
                const poToken = (getServerLineConfig().useSeparateOrderDestination && getServerLineConfig().purchaseOrderChannelAccessToken) 
                  ? getServerLineConfig().purchaseOrderChannelAccessToken 
                  : undefined;
                await replyLineMessage(event.replyToken, [{
                  type: 'text',
                  text: `⚠️ สิทธิ์การยืนยันไม่ถูกต้อง (Token Mismatch) หรือลิงก์นี้หมดอายุแล้ว สำหรับใบสั่งซื้อ ${orderId}`
                }], poToken);
              }
              continue;
            }

            // Look up who confirmed it from LINE Profile
            const lineUserId = event.source?.userId;
            const lineGroupId = event.source?.groupId || event.source?.roomId;
            let confirmedByName = 'Admin (ยืนยันผ่านแชท LINE)';

            if (lineUserId) {
              try {
                const profile = await getLineUserProfile(lineUserId, lineGroupId);
                if (profile?.displayName) {
                  confirmedByName = `${profile.displayName} (ยืนยันใน LINE)`;
                }
              } catch (_) {}
            }

            const nowTimeStr = new Date().toLocaleString('th-TH', {
              timeZone: 'Asia/Bangkok',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            // Update Firestore Order status to 'confirmed' and permanently lock
            const updatedOrder = {
              ...orderData,
              status: 'confirmed',
              confirmedAt: nowTimeStr,
              confirmedBy: confirmedByName,
              confirmedVia: 'line_postback',
              confirmationTokenUsed: true,
              confirmationToken: null,
              isLocked: true,
              updatedAt: new Date().toISOString(),
            };

            await setDoc(orderRef, updatedOrder, { merge: true });

            // Also update inventory item's ordered status in Firestore
            if (orderData.itemId) {
              try {
                const itemRef = doc(firestoreDb, 'inventory', orderData.itemId);
                const itemSnap = await getDoc(itemRef);
                if (itemSnap.exists()) {
                  await setDoc(itemRef, {
                    ordered: `สั่งซื้อแล้ว ${orderData.qty} ${orderData.unit} (${nowTimeStr})`,
                    orderedDate: new Date().toISOString(),
                  }, { merge: true });
                }
              } catch (itemErr) {
                console.warn("Could not update item ordered date:", itemErr);
              }
            }

            // Web Push notification to web users
            try {
              await sendWebPushToAll({
                title: `✅ ยืนยันการสั่งซื้อ: ${orderData.itemName}`,
                body: `ใบสั่งซื้อ ${orderData.id} (${orderData.qty} ${orderData.unit}) ได้รับการยืนยันผ่าน LINE ทันที โดย ${confirmedByName}`,
                tag: `order-confirm-${orderData.id}`,
                type: 'system',
              });
            } catch (_) {}

            // Send instant reply confirmation bubble back into the LINE chat
            if (event.replyToken) {
              const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
              const confirmFlex = createOrderConfirmedFlexMessage({
                order: {
                  id: orderData.id,
                  itemId: orderData.itemId,
                  itemName: orderData.itemName,
                  qty: orderData.qty,
                  unit: orderData.unit,
                  confirmedBy: confirmedByName,
                  confirmedAt: nowTimeStr,
                },
                baseUrl: origin,
              });

              const poToken = (getServerLineConfig().useSeparateOrderDestination && getServerLineConfig().purchaseOrderChannelAccessToken) 
                ? getServerLineConfig().purchaseOrderChannelAccessToken 
                : undefined;
              const replyRes = await replyLineMessage(event.replyToken, [confirmFlex], poToken);
              if (!replyRes.success) {
                // If replyToken expired or failed, push directly to purchase order destination
                await pushPurchaseOrderLineMessage([confirmFlex]);
              }
            } else {
              const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
              const confirmFlex = createOrderConfirmedFlexMessage({
                order: {
                  id: orderData.id,
                  itemId: orderData.itemId,
                  itemName: orderData.itemName,
                  qty: orderData.qty,
                  unit: orderData.unit,
                  confirmedBy: confirmedByName,
                  confirmedAt: nowTimeStr,
                },
                baseUrl: origin,
              });
              await pushPurchaseOrderLineMessage([confirmFlex]);
            }
          }
        } else if (event.type === 'message' && event.message?.type === 'text') {
          // 2. Optional text message commands e.g. "ยืนยัน PO-..." or "อนุมัติ PO-..."
          const text = (event.message.text || '').trim();
          const match = text.match(/(?:ยืนยัน|อนุมัติ|confirm)\s*(PO-[\w-]+)/i);
          if (match && match[1]) {
            const orderId = match[1];
            if (firestoreDb) {
              const orderRef = doc(firestoreDb, 'orders', orderId);
              const orderSnap = await getDoc(orderRef);
              if (orderSnap.exists()) {
                const orderData: any = orderSnap.data();
                const isAlreadyProcessed = orderData.status !== 'pending' || Boolean(orderData.confirmedAt) || Boolean(orderData.confirmationTokenUsed);
                if (isAlreadyProcessed) {
                  if (event.replyToken) {
                    const poToken = (getServerLineConfig().useSeparateOrderDestination && getServerLineConfig().purchaseOrderChannelAccessToken) 
                      ? getServerLineConfig().purchaseOrderChannelAccessToken 
                      : undefined;
                    await replyLineMessage(event.replyToken, [{
                      type: 'text',
                      text: `🔒 ใบสั่งซื้อ ${orderId} (${orderData.itemName}) ได้รับการยืนยันไปแล้วเมื่อ ${orderData.confirmedAt || 'ก่อนหน้านี้'}\n\n⚠️ ไม่สามารถกดยืนยันซ้ำได้อีกครับ`
                    }], poToken);
                  }
                } else {
                  const nowTimeStr = new Date().toLocaleString('th-TH', {
                    timeZone: 'Asia/Bangkok',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const lineUserId = event.source?.userId;
                  let confirmedByName = 'Admin (ยืนยันผ่านแชท LINE)';
                  if (lineUserId) {
                    const profile = await getLineUserProfile(lineUserId, event.source?.groupId);
                    if (profile?.displayName) confirmedByName = `${profile.displayName} (ยืนยันใน LINE)`;
                  }

                  await setDoc(orderRef, {
                    ...orderData,
                    status: 'confirmed',
                    confirmedAt: nowTimeStr,
                    confirmedBy: confirmedByName,
                    confirmedVia: 'line_text_command',
                    confirmationTokenUsed: true,
                    confirmationToken: null,
                    isLocked: true,
                    updatedAt: new Date().toISOString(),
                  }, { merge: true });

                  if (orderData.itemId) {
                    try {
                      const itemRef = doc(firestoreDb, 'inventory', orderData.itemId);
                      await setDoc(itemRef, {
                        ordered: `สั่งซื้อแล้ว ${orderData.qty} ${orderData.unit} (${nowTimeStr})`,
                        orderedDate: new Date().toISOString(),
                      }, { merge: true });
                    } catch (_) {}
                  }

                  const confirmFlex = createOrderConfirmedFlexMessage({
                    order: {
                      id: orderData.id,
                      itemId: orderData.itemId,
                      itemName: orderData.itemName,
                      qty: orderData.qty,
                      unit: orderData.unit,
                      confirmedBy: confirmedByName,
                      confirmedAt: nowTimeStr,
                    }
                  });

                  if (event.replyToken) {
                    const poToken = (getServerLineConfig().useSeparateOrderDestination && getServerLineConfig().purchaseOrderChannelAccessToken) 
                      ? getServerLineConfig().purchaseOrderChannelAccessToken 
                      : undefined;
                    const replyRes = await replyLineMessage(event.replyToken, [confirmFlex], poToken);
                    if (!replyRes.success) {
                      await pushPurchaseOrderLineMessage([confirmFlex]);
                    }
                  } else {
                    await pushPurchaseOrderLineMessage([confirmFlex]);
                  }
                }
              }
            }
          }
        }
      }

      // Always return 200 OK within 2 seconds as required by LINE Messaging API
      return res.status(200).send("OK");
    } catch (err: any) {
      console.error("LINE Webhook error:", err);
      return res.status(200).send("OK");
    }
  });

  // Helper HTML renderer for LINE 1-Click order confirmation page
  function renderConfirmHtml(opts: {
    success: boolean;
    title: string;
    message: string;
    order?: any;
    alreadyConfirmed?: boolean;
  }) {
    const { success, title, message, order, alreadyConfirmed } = opts;
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ENG SMART STORE</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Sarabun', 'Plus Jakarta Sans', sans-serif; }
    @keyframes pulse-ring {
      0% { transform: scale(0.95); opacity: 0.8; }
      50% { transform: scale(1.08); opacity: 0.4; }
      100% { transform: scale(0.95); opacity: 0.8; }
    }
    .pulse-ring { animation: pulse-ring 2s infinite ease-in-out; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-800/90 backdrop-blur-xl border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
    <div class="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

    <div class="flex justify-center mb-5">
      <img src="/logo.png" alt="ENG SMART STORE" class="h-16 w-auto object-contain drop-shadow-lg" onerror="this.style.display='none'">
    </div>

    <div class="flex justify-center mb-4">
      <div class="w-20 h-20 rounded-full ${alreadyConfirmed ? 'bg-rose-500/20 border-2 border-rose-400 text-rose-400' : success ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400' : 'bg-red-500/20 border-2 border-red-400 text-red-400'} flex items-center justify-center relative shadow-lg">
        ${success && !alreadyConfirmed ? '<div class="absolute inset-0 rounded-full border-2 border-emerald-400/40 pulse-ring"></div>' : ''}
        ${alreadyConfirmed 
          ? '<svg class="w-10 h-10 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>'
          : success
            ? '<svg class="w-10 h-10 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>'
            : '<svg class="w-10 h-10 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>'
        }
      </div>
    </div>

    <h1 class="text-xl sm:text-2xl font-black ${alreadyConfirmed ? 'text-rose-400' : success ? 'text-emerald-400' : 'text-red-400'} mb-2 tracking-tight">
      ${title}
    </h1>
    <p class="text-sm text-slate-300 leading-relaxed mb-4">
      ${message}
    </p>

    ${alreadyConfirmed ? `
    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-400/50 text-rose-300 text-xs font-bold mb-4 shadow-sm">
      <span class="w-2 h-2 rounded-full bg-rose-500"></span>
      <span>🔒 หมดอายุ: ลิงก์ยืนยันถูกใช้งานไปแล้ว ไม่อนุญาตให้กดซ้ำ</span>
    </div>
    ` : ''}

    ${order ? `
    <div class="bg-slate-900/80 rounded-2xl p-4 border ${alreadyConfirmed ? 'border-rose-500/30' : 'border-slate-700/80'} text-left mb-4 text-xs space-y-2">
      <div class="flex justify-between items-center pb-2 border-b border-slate-800">
        <span class="text-slate-400">เลขที่ใบสั่งซื้อ:</span>
        <span class="font-mono font-bold text-white text-sm">${order.id || '-'}</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-slate-400">ชื่อสินค้า:</span>
        <span class="font-bold text-white text-sm text-right line-clamp-1">${order.itemName || '-'}</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-slate-400">รหัสอะไหล่:</span>
        <span class="font-mono text-slate-300">${order.itemId || '-'}</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-slate-400">จำนวนที่สั่งซื้อ:</span>
        <span class="font-black text-amber-400 text-base">${order.qty || '-'} ${order.unit || ''}</span>
      </div>
      <div class="flex justify-between items-center">
        <span class="text-slate-400">สถานะปัจจุบัน:</span>
        <span class="font-bold ${order.status === 'received' ? 'text-blue-400' : 'text-emerald-400'}">
          ${order.status === 'received' ? '📦 รับเข้าคลังแล้ว' : '✅ ยืนยันการสั่งซื้อแล้ว'}
        </span>
      </div>
      ${order.confirmedAt ? `
      <div class="flex justify-between items-center pt-2 border-t border-slate-800">
        <span class="text-slate-400">เวลายืนยันเดิม:</span>
        <span class="text-emerald-300 font-medium">${order.confirmedAt}</span>
      </div>
      ` : ''}
      ${order.confirmedBy ? `
      <div class="flex justify-between items-center">
        <span class="text-slate-400">ผู้ยืนยัน:</span>
        <span class="text-slate-200 font-medium">${order.confirmedBy}</span>
      </div>
      ` : ''}
    </div>
    ` : ''}

    ${alreadyConfirmed ? `
    <div class="p-3 bg-slate-900/90 border border-rose-500/30 rounded-2xl text-xs text-rose-200/90 mb-4 text-center">
      🛡️ <strong>คำสั่งซื้อนี้ถูกล็อกถาวรแล้ว:</strong> ไม่ว่าจะกดปุ่มใน LINE กี่ครั้ง จะไม่มีการสั่งซื้อซ้ำหรือเปลี่ยนแปลงข้อมูลในระบบครับ
    </div>
    ` : ''}

    ${(!alreadyConfirmed && success) ? `
    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      <span>ฐานข้อมูล Firestore อัปเดต Real-time อัตโนมัติ</span>
    </div>
    ` : ''}

    <div class="space-y-3">
      <button id="btn-return" onclick="handleCloseOrReturn()" class="block w-full py-3.5 px-4 rounded-xl ${alreadyConfirmed ? 'bg-slate-700 hover:bg-slate-600' : 'bg-emerald-600 hover:bg-emerald-500'} active:scale-95 text-white font-bold text-sm shadow-lg transition-all cursor-pointer">
        ⬅️ ปิดหน้านี้และกลับสู่แชท LINE
      </button>

      <div id="line-inapp-guide" class="p-3 bg-slate-900/90 border border-emerald-500/30 rounded-2xl text-center">
        <p class="text-xs text-emerald-300 font-semibold mb-0.5">
          💡 สำหรับ LINE บน iOS และ Android
        </p>
        <p class="text-[11px] text-slate-300 leading-tight">
          สามารถแตะปุ่ม <b>✖</b> (ปิด) ที่มุมบนของหน้าจอ LINE เพื่อกลับสู่ห้องแชทได้ทันที
        </p>
      </div>

      <a href="/" class="block w-full py-2.5 px-4 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-600 transition-all">
        เปิดเข้าสู่หน้าหลักแอปพลิเคชัน ENG SMART STORE
      </a>
    </div>
  </div>

  <script>
    function handleCloseOrReturn() {
      var isLineApp = /Line/i.test(navigator.userAgent);

      // 1. Try standard window.close
      try {
        window.close();
      } catch (_) {}

      // 2. Try window.history.back if navigation stack exists
      try {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
      } catch (_) {}

      if (isLineApp) {
        // User is inside LINE in-app browser on iOS or Android.
        // DO NOT redirect to https://line.me/R/ inside in-app browser to avoid LINE's error alert popup.
        var guide = document.getElementById('line-inapp-guide');
        if (guide) {
          guide.className = 'p-3 bg-emerald-950/90 border-2 border-emerald-400 rounded-2xl text-center shadow-lg transition-all animate-bounce';
          guide.innerHTML = '<p class="text-xs text-emerald-300 font-bold mb-1">👆 แตะปุ่ม ✖ (ปิด) ที่มุมบนหน้าจอ</p><p class="text-[11px] text-white">เพื่อกลับสู่ห้องแชท LINE ได้ทันทีครับ</p>';
          setTimeout(function() {
            guide.classList.remove('animate-bounce');
          }, 2000);
        }
      } else {
        // User opened from external browser (Chrome / Safari outside LINE)
        try {
          window.location.href = 'line://';
        } catch (_) {
          window.location.href = 'https://line.me/R/';
        }
      }
    }
  </script>
</body>
</html>`;
  }

  // API: One-Click Purchase Order Confirmation from LINE (Web Action)
  app.get("/api/orders/confirm", async (req, res) => {
    try {
      const orderId = (req.query.orderId as string || '').trim();
      const token = (req.query.token as string || '').trim();

      if (!orderId) {
        return res.status(400).send(renderConfirmHtml({
          success: false,
          title: "ข้อมูลคำสั่งซื้อไม่ถูกต้อง",
          message: "ไม่พบรหัสคำสั่งซื้อ (Missing Order ID)",
        }));
      }

      if (!firestoreDb) {
        return res.status(500).send(renderConfirmHtml({
          success: false,
          title: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล",
          message: "ไม่สามารถเข้าถึง Firestore Database ได้ในขณะนี้",
        }));
      }

      const orderRef = doc(firestoreDb, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);

      if (!orderSnap.exists()) {
        return res.status(404).send(renderConfirmHtml({
          success: false,
          title: "ไม่พบรายการสั่งซื้อ",
          message: `ไม่พบใบสั่งซื้อรหัส "${orderId}" ในระบบ`,
        }));
      }

      const orderData: any = orderSnap.data();

      // STRICT SINGLE-USE LOCK:
      // If status is not 'pending', or if confirmedAt exists, or if confirmationTokenUsed is true
      const isAlreadyProcessed = orderData.status !== 'pending' || Boolean(orderData.confirmedAt) || Boolean(orderData.confirmationTokenUsed);
      if (isAlreadyProcessed) {
        return res.status(409).send(renderConfirmHtml({
          success: false,
          title: "🔒 คำสั่งซื้อนี้ถูกยืนยันไปแล้ว",
          message: `ใบสั่งซื้อ "${orderId}" (${orderData.itemName}) ได้รับการยืนยันเสร็จสิ้นไปแล้วเมื่อ ${orderData.confirmedAt || 'ก่อนหน้านี้'} โดย ${orderData.confirmedBy || 'ผู้ดูแลระบบ'}<br><br>⚠️ <strong>ระบบป้องกันการยืนยันซ้ำ:</strong> คำสั่งซื้อสามารถกดยืนยันได้เพียง 1 ครั้งเท่านั้น และลิงก์นี้หมดอายุการใช้งานถาวรแล้ว`,
          order: orderData,
          alreadyConfirmed: true,
        }));
      }

      // Check token if provided in order (or if token was already cleared)
      if (orderData.confirmationToken && token && orderData.confirmationToken !== token) {
        return res.status(403).send(renderConfirmHtml({
          success: false,
          title: "สิทธิ์การยืนยันไม่ถูกต้อง",
          message: "Token การยืนยันไม่ตรงกับข้อมูลในระบบ หรือลิงก์นี้หมดอายุการใช้งานแล้ว",
        }));
      }

      const nowTimeStr = new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Update Firestore Order status to 'confirmed' and permanently consume confirmation token
      const updatedOrder = {
        ...orderData,
        status: 'confirmed',
        confirmedAt: nowTimeStr,
        confirmedBy: 'Admin (ยืนยันผ่าน LINE)',
        confirmedVia: 'line_url',
        confirmationTokenUsed: true,
        confirmationToken: null, // Permanently nullify token so it cannot be reused
        isLocked: true,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(orderRef, updatedOrder, { merge: true });

      // Also update inventory item's ordered status in Firestore
      if (orderData.itemId) {
        try {
          const itemRef = doc(firestoreDb, 'inventory', orderData.itemId);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            await setDoc(itemRef, {
              ordered: `สั่งซื้อแล้ว ${orderData.qty} ${orderData.unit} (${nowTimeStr})`,
              orderedDate: new Date().toISOString(),
            }, { merge: true });
          }
        } catch (itemErr) {
          console.warn("Could not update item ordered date:", itemErr);
        }
      }

      // Send follow-up LINE message informing the group that order is confirmed
      try {
        const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
        const confirmFlex = createOrderConfirmedFlexMessage({
          order: {
            id: orderData.id,
            itemId: orderData.itemId,
            itemName: orderData.itemName,
            qty: orderData.qty,
            unit: orderData.unit,
            confirmedBy: 'Admin (ยืนยันผ่าน LINE)',
            confirmedAt: nowTimeStr,
          },
          baseUrl: origin,
        });
        await pushPurchaseOrderLineMessage([confirmFlex]);
      } catch (notifyErr) {
        console.warn("Could not send LINE confirmation notice:", notifyErr);
      }

      // Send Web Push notification to web users
      try {
        await sendWebPushToAll({
          title: `✅ ยืนยันการสั่งซื้อ: ${orderData.itemName}`,
          body: `ใบสั่งซื้อ ${orderData.id} (${orderData.qty} ${orderData.unit}) ได้รับการยืนยันผ่าน LINE แล้ว`,
          tag: `order-confirm-${orderData.id}`,
          type: 'system',
        });
      } catch (_) {}

      // Render confirmation web page
      return res.send(renderConfirmHtml({
        success: true,
        title: "ยืนยันการสั่งซื้อสำเร็จเรียบร้อย!",
        message: "ระบบได้ทำการอัปเดตสถานะลงในฐานข้อมูล Firestore แล้ว และหน้าจอเว็บแอปพลิเคชันจะอัปเดตแบบ Real-time ทันที",
        order: updatedOrder,
      }));
    } catch (error: any) {
      console.error("Order confirm error:", error);
      res.status(500).send(renderConfirmHtml({
        success: false,
        title: "เกิดข้อผิดพลาดในการประมวลผล",
        message: error.message || "ระบบไม่สามารถบันทึกการยืนยันได้",
      }));
    }
  });

  // API: Confirm Purchase Order from Web Admin
  app.post("/api/orders/confirm", async (req, res) => {
    try {
      const { orderId, confirmedBy, userRole } = req.body;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }

      // Enforce Admin RBAC for order confirmation
      if (userRole && userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถกดยืนยันคำสั่งซื้อได้",
        });
      }

      if (!firestoreDb) {
        return res.status(500).json({ success: false, error: "Firestore not initialized" });
      }

      const orderRef = doc(firestoreDb, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      const orderData: any = orderSnap.data();

      // Check if order is already confirmed or processed
      const isAlreadyProcessed = orderData.status !== 'pending' || Boolean(orderData.confirmedAt) || Boolean(orderData.confirmationTokenUsed);
      if (isAlreadyProcessed) {
        return res.status(409).json({
          success: false,
          error: `คำสั่งซื้อ ${orderId} (${orderData.itemName}) ได้รับการยืนยันไปแล้วเมื่อ ${orderData.confirmedAt || 'ก่อนหน้านี้'} โดย ${orderData.confirmedBy || 'ผู้ดูแลระบบ'} (ไม่สามารถกดยืนยันซ้ำได้)`,
          order: orderData,
          alreadyConfirmed: true,
        });
      }

      const nowTimeStr = new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const updatedOrder = {
        ...orderData,
        status: 'confirmed',
        confirmedAt: nowTimeStr,
        confirmedBy: confirmedBy || 'ผู้ดูแลระบบ (Admin Web)',
        confirmedVia: 'admin_web',
        confirmationTokenUsed: true,
        confirmationToken: null,
        isLocked: true,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(orderRef, updatedOrder, { merge: true });

      // Update inventory item
      if (orderData.itemId) {
        try {
          const itemRef = doc(firestoreDb, 'inventory', orderData.itemId);
          await setDoc(itemRef, {
            ordered: `สั่งซื้อแล้ว ${orderData.qty} ${orderData.unit} (${nowTimeStr})`,
            orderedDate: new Date().toISOString(),
          }, { merge: true });
        } catch (_) {}
      }

      // Notify LINE
      try {
        const confirmFlex = createOrderConfirmedFlexMessage({
          order: {
            id: orderData.id,
            itemId: orderData.itemId,
            itemName: orderData.itemName,
            qty: orderData.qty,
            unit: orderData.unit,
            confirmedBy: confirmedBy || 'ผู้ดูแลระบบ (Admin Web)',
            confirmedAt: nowTimeStr,
          }
        });
        await pushPurchaseOrderLineMessage([confirmFlex]);
      } catch (_) {}

      res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
      console.error("Web order confirm error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Mark Order Received & Auto Stock In
  app.post("/api/orders/receive", async (req, res) => {
    try {
      const { orderId, receivedQty, receivedBy, note } = req.body;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }
      if (!firestoreDb) {
        return res.status(500).json({ success: false, error: "Firestore not initialized" });
      }

      const orderRef = doc(firestoreDb, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      const orderData: any = orderSnap.data();
      const qtyToAdd = Number(receivedQty) || Number(orderData.qty) || 0;
      const nowTimeStr = new Date().toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // 1. Update Order status to 'received'
      const updatedOrder = {
        ...orderData,
        status: 'received',
        receivedAt: nowTimeStr,
        receivedBy: receivedBy || 'ผู้ดูแลระบบ',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(orderRef, updatedOrder, { merge: true });

      // 2. Auto Stock In to Inventory item in Firestore (Update existing or auto-register new item)
      let updatedItem: any = null;
      const targetItemId = orderData.itemId || `ITEM-${Date.now().toString().slice(-6)}`;
      try {
        const itemRef = doc(firestoreDb, 'inventory', targetItemId);
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const currentItem = itemSnap.data() as any;
          const newQty = (Number(currentItem.qty) || 0) + qtyToAdd;
          const minStock = Number(currentItem.minStock) || 1;
          const newStatus = newQty <= 0 ? 'out' : newQty <= minStock ? 'low' : 'normal';

          updatedItem = {
            ...currentItem,
            qty: newQty,
            status: newStatus,
            ordered: '', // Clear active ordered flag
            outOfStockDate: newStatus === 'normal' ? '' : currentItem.outOfStockDate,
          };
          await setDoc(itemRef, updatedItem, { merge: true });
        } else {
          // Item was not in store: Auto-register into warehouse inventory upon receipt!
          const minStock = 5;
          const newStatus = qtyToAdd <= 0 ? 'out' : qtyToAdd <= minStock ? 'low' : 'normal';
          updatedItem = {
            id: targetItemId,
            name: orderData.itemName,
            category: orderData.category || 'อื่นๆ',
            qty: qtyToAdd,
            minStock: minStock,
            unit: orderData.unit || 'ชิ้น',
            location: orderData.location || 'Store FL.6',
            brand: orderData.brand || '',
            model: orderData.model || '',
            status: newStatus,
            ordered: '',
            orderedDate: '',
            note: `บันทึกเข้าคลังอัตโนมัติจากการสั่งซื้อ ${orderData.id}`,
          };
          await setDoc(itemRef, updatedItem);
        }
      } catch (itemErr) {
        console.warn("Could not update item stock on receive:", itemErr);
      }

      // 3. Create auto requisition record (Stock In)
      try {
        const reqId = `REQ-IN-${Date.now().toString().slice(-6)}`;
        const requisitionRecord = {
          id: reqId,
          type: 'in',
          itemId: orderData.itemId,
          itemName: orderData.itemName,
          category: orderData.category || '',
          qty: qtyToAdd,
          unit: orderData.unit,
          requestedBy: receivedBy || 'ผู้ดูแลระบบ (รับของจากใบสั่งซื้อ)',
          purpose: `รับสินค้าตามใบสั่งซื้อ ${orderData.id}${note ? ` (${note})` : ''}`,
          timestamp: nowTimeStr,
          isoDate: new Date().toISOString(),
          note: `รับเข้าจากใบสั่งซื้อ PO: ${orderData.id}`,
        };
        await setDoc(doc(firestoreDb, 'requisitions', reqId), requisitionRecord);
      } catch (reqErr) {
        console.warn("Could not log stock-in requisition:", reqErr);
      }

      // 4. Notify LINE about Stock In
      try {
        const stockFlex = createStockFlexMessage({
          type: 'in',
          itemId: orderData.itemId,
          itemName: orderData.itemName,
          category: orderData.category,
          qty: qtyToAdd,
          unit: orderData.unit,
          requestedBy: receivedBy || 'ผู้ดูแลระบบ',
          purpose: `รับสินค้าเข้าคลังตามใบสั่งซื้อ ${orderData.id}`,
          timestamp: nowTimeStr,
          newQty: updatedItem ? updatedItem.qty : undefined,
          status: updatedItem ? updatedItem.status : 'normal',
        });
        await pushLineMessage([stockFlex]);
      } catch (_) {}

      res.json({ success: true, order: updatedOrder, item: updatedItem });
    } catch (err: any) {
      console.error("Receive order error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Cancel Purchase Order
  app.post("/api/orders/cancel", async (req, res) => {
    try {
      const { orderId, reason, cancelledBy } = req.body;
      if (!orderId) {
        return res.status(400).json({ success: false, error: "Missing orderId" });
      }
      if (!firestoreDb) {
        return res.status(500).json({ success: false, error: "Firestore not initialized" });
      }

      const orderRef = doc(firestoreDb, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ success: false, error: "Order not found" });
      }

      const orderData: any = orderSnap.data();
      const updatedOrder = {
        ...orderData,
        status: 'cancelled',
        cancelReason: reason || 'ยกเลิกโดยผู้ดูแลระบบ',
        cancelledBy: cancelledBy || 'ผู้ดูแลระบบ',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(orderRef, updatedOrder, { merge: true });

      // Clear ordered flag on item
      if (orderData.itemId) {
        try {
          const itemRef = doc(firestoreDb, 'inventory', orderData.itemId);
          await setDoc(itemRef, { ordered: '' }, { merge: true });
        } catch (_) {}
      }

      res.json({ success: true, order: updatedOrder });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // ==========================================
  // API: Web Push Notifications Endpoints
  // ==========================================

  // Get VAPID Public Key for client subscription
  app.get("/api/push/public-key", async (req, res) => {
    try {
      const keys = await getOrInitVapidKeys();
      res.json({ success: true, publicKey: keys.publicKey });
    } catch (err: any) {
      console.error("Fetch VAPID public key error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Subscribe a device / browser to Web Push
  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription, userId, userName, deviceInfo } = req.body;
      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ success: false, error: "ข้อมูล Subscription ไม่ถูกต้อง" });
      }

      const record: WebPushSubscriptionRecord = {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId: userId || 'anonymous',
        userName: userName || 'ผู้ใช้ระบบ',
        deviceInfo: deviceInfo || 'Browser',
        subscribedAt: new Date().toISOString(),
      };

      memorySubscriptions.set(record.endpoint, record);

      if (firestoreDb) {
        const subId = Buffer.from(record.endpoint).toString('base64url').slice(0, 60);
        await setDoc(doc(firestoreDb, 'push_subscriptions', subId), record, { merge: true });
      }

      // Send an instant confirmation push to verify connectivity
      try {
        await getOrInitVapidKeys();
        await webpush.sendNotification({
          endpoint: record.endpoint,
          keys: record.keys
        }, JSON.stringify({
          title: "✅ เชื่อมต่อ Web Push สำเร็จ",
          body: "ระบบพร้อมแจ้งเตือนสต็อกต่ำและการเบิกจ่ายสำคัญ แม้แอปปิดหน้าจออยู่",
          icon: "/logo.png",
          badge: "/icon-192.png",
          url: "/",
          tag: "welcome-push",
        }), { TTL: 300 });
      } catch (pushErr) {
        console.warn("Welcome push test warning:", pushErr);
      }

      res.json({ success: true, message: "ลงทะเบียนรับการแจ้งเตือน Web Push สำเร็จ" });
    } catch (err: any) {
      console.error("Subscribe push error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Unsubscribe a device
  app.post("/api/push/unsubscribe", async (req, res) => {
    try {
      const { endpoint } = req.body;
      if (endpoint) {
        memorySubscriptions.delete(endpoint);
        if (firestoreDb) {
          const subId = Buffer.from(endpoint).toString('base64url').slice(0, 60);
          await deleteDoc(doc(firestoreDb, 'push_subscriptions', subId)).catch(() => {});
        }
      }
      res.json({ success: true, message: "ยกเลิกการแจ้งเตือนเรียบร้อยแล้ว" });
    } catch (err: any) {
      console.error("Unsubscribe error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Get Web Push Config (All users fetch master config set by Admin)
  app.get("/api/push/config", async (req, res) => {
    try {
      if (firestoreDb) {
        const snap = await getDoc(doc(firestoreDb, 'settings', 'webpush_config'));
        if (snap.exists()) {
          serverWebPushConfig = { ...serverWebPushConfig, ...(snap.data() as any) };
        }
      }
      res.json({ success: true, config: serverWebPushConfig });
    } catch (err: any) {
      res.json({ success: true, config: serverWebPushConfig });
    }
  });

  // API: Save Web Push Config (Admin only - sets master policy for whole system)
  app.post("/api/push/config", async (req, res) => {
    try {
      const updated = req.body || {};
      serverWebPushConfig = {
        ...serverWebPushConfig,
        ...updated,
        updatedAt: new Date().toISOString(),
      };
      if (firestoreDb) {
        await setDoc(doc(firestoreDb, 'settings', 'webpush_config'), serverWebPushConfig, { merge: true });
      }
      res.json({ success: true, config: serverWebPushConfig });
    } catch (err: any) {
      console.error("Save Web Push config error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Broadcast push notification (Triggered on low stock or important requisitions - strictly respects Admin master policy)
  app.post("/api/push/notify", async (req, res) => {
    try {
      const { title, body, icon, url, tag, type, data } = req.body;
      if (!title || !body) {
        return res.status(400).json({ success: false, error: "กรุณาระบุ title และ body" });
      }

      // Check Master Web Push Policy set by Admin
      if (!serverWebPushConfig.enabled) {
        return res.json({ success: false, skipped: true, reason: 'Web push notifications disabled by Admin master policy' });
      }

      if (type === 'low_stock' && !serverWebPushConfig.notifyLowStock) {
        return res.json({ success: false, skipped: true, reason: 'Low stock push disabled by Admin master policy' });
      }

      if (type === 'requisition' && !serverWebPushConfig.notifyImportantRequisition) {
        return res.json({ success: false, skipped: true, reason: 'Important requisition push disabled by Admin master policy' });
      }

      if (type === 'order' && serverWebPushConfig.notifyPurchaseOrder === false) {
        return res.json({ success: false, skipped: true, reason: 'Purchase order push disabled by Admin master policy' });
      }

      const result = await sendWebPushToAll({
        title,
        body,
        icon: icon || '/logo.png',
        url: url || '/',
        tag: tag || `eng-push-${Date.now()}`,
        type: type || 'system',
        data: data || {},
      });

      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("Push notify error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Test Web Push notification endpoint
  app.post("/api/push/test", async (req, res) => {
    try {
      const result = await sendWebPushToAll({
        title: "🔔 ทดสอบ Web Push Notifications",
        body: "ระบบแจ้งเตือนคลังสินค้า Store FL.6 พร้อมทำงานแล้ว แม้ไม่ได้เปิดหน้าจออยู่!",
        icon: "/logo.png",
        url: "/",
        tag: "test-push",
        type: "system"
      });

      res.json({ 
        success: true, 
        message: result.sent > 0 
          ? `ส่งการแจ้งเตือนทดสอบสำเร็จไปยัง ${result.sent} อุปกรณ์` 
          : "ยังไม่มีอุปกรณ์ที่ลงทะเบียนเปิดรับการแจ้งเตือน Web Push", 
        ...result 
      });
    } catch (err: any) {
      console.error("Test Web Push error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get Web Push status / subscriber count
  app.get("/api/push/status", async (req, res) => {
    try {
      const subs = await loadSubscriptions();
      res.json({
        success: true,
        activeSubscribers: subs.length,
        hasVapidKey: !!vapidKeys,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Analyze with Ai Agent (antigravity-preview-05-2026)
  app.post("/api/analyze", async (req, res) => {
    try {
      const { prompt, items, requisitions } = req.body;
      
      const currentItems: Item[] = Array.isArray(items) ? items : [];
      const currentReqs: any[] = Array.isArray(requisitions) ? requisitions : [];

      const totalItemsCount = currentItems.length;
      const totalUnits = currentItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const outOfStockItems = currentItems.filter(i => (Number(i.qty) || 0) <= 0);
      const lowStockItems = currentItems.filter(i => (Number(i.qty) || 0) > 0 && (Number(i.qty) || 0) <= (Number(i.minStock) || 1));
      const normalStockItems = currentItems.filter(i => (Number(i.qty) || 0) > (Number(i.minStock) || 1));

      // Health Score Calculation
      const healthScore = totalItemsCount > 0 
        ? Math.round(((totalItemsCount - outOfStockItems.length - (lowStockItems.length * 0.5)) / totalItemsCount) * 100)
        : 100;

      const summaryText = `
📊 ข้อมูลสถานะคลังสินค้าแบบเจาะจง:
- จำนวนรายการสินค้าทั้งหมด: ${totalItemsCount} รายการ (รวม ${totalUnits} หน่วย)
- สุขภาพคลังสินค้า (Health Score): ${healthScore}%
- สินค้าหมดสต็อก (${outOfStockItems.length} รายการ): ${JSON.stringify(outOfStockItems.map(i => ({ id: i.id, name: i.name, category: i.category, minStock: i.minStock, location: i.location })))}
- สินค้าใกล้หมด (${lowStockItems.length} รายการ): ${JSON.stringify(lowStockItems.map(i => ({ id: i.id, name: i.name, qty: i.qty, minStock: i.minStock, unit: i.unit, location: i.location })))}
- สินค้าปกติ (${normalStockItems.length} รายการ): ${JSON.stringify(normalStockItems.slice(0, 15).map(i => ({ id: i.id, name: i.name, qty: i.qty, unit: i.unit })))}
- ประวัติการเบิกล่าสุด (${currentReqs.length} รายการ): ${JSON.stringify(currentReqs.slice(0, 20).map(r => ({ item: r.itemName, qty: r.qty, user: r.requestedBy, date: r.timestamp, type: r.type })))}
`;

      const deepAnalysisInstruction = `คุณคือ Ai Executive Supply Chain & Inventory Analyst ผู้เชี่ยวชาญระดับสูงด้านการวิเคราะห์คลังสินค้า Store FL.6 ของ ENG Smart Store

กรุณาวิเคราะห์ข้อมูลสต็อกและประวัติการเบิกใช้อย่างละเอียดเชิงลึก (Deep-dive Strategic Analytics) โดยจัดโครงสร้างรายงานให้น่าอ่านอย่างมืออาชีพ:
- ใช้การเว้นวรรค (Spacing) จัดย่อหน้าชัดเจน มีบรรทัดว่างคั่นแต่ละประเด็น
- ใช้อิโมจิและสัญลักษณ์ (📊, 🚨, ⚠️, 📈, 📦, 💡, 🛡️, 🔍, ⚡, 📌) กำกับทุกหัวข้อย่อย
- วิเคราะห์อย่างตรงไปตรงมา อ้างอิงตัวเลขจริงจากข้อมูลที่ได้รับ ห้ามแต่งตัวเลขขึ้นเอง
- จัดโครงสร้างรายงานเป็น 4 ส่วนหลักดังนี้:

### 1. 📊 สรุปภาพรวมและดัชนีสุขภาพคลังสินค้า (Warehouse Health & Executive Summary)
- ดัชนีสุขภาพคลังสินค้า (Inventory Health Index): ประเมินสถานะพร้อม % และเกรดความพร้อม
- สรุปตัวเลขสำคัญ: สินค้าทั้งหมด ${totalItemsCount} รายการ (${totalUnits} หน่วย), หมดสต็อก ${outOfStockItems.length} รายการ, ใกล้หมด ${lowStockItems.length} รายการ, ปกติ ${normalStockItems.length} รายการ

### 2. 🚨 รายการวิกฤตและแผนการสั่งซื้อด่วน (Critical Stockout & Replenishment)
- สรุปรายการสินค้าที่หมดสต็อก (Out of Stock) โดยระบุชื่อ, รหัส, และผลกระทบต่องานซ่อมบำรุง
- สรุปรายการสินค้าที่ต่ำกว่าเกณฑ์ความปลอดภัย (Low Stock)
- ระบุปริมาณที่แนะนำให้สั่งซื้อ (Suggested Order Qty) เพื่อให้ครอบคลุมความต้องการอย่างน้อย 30 วัน

### 3. 📈 อัตราการหมุนเวียนและแนวโน้มการเบิกใช้ (Usage Velocity & Movement Trends)
- วิเคราะห์สินค้าที่มีอัตราการเบิกใช้สูงสุด (Fast-Moving Items)
- สังเกตสินค้าที่มีการเคลื่อนไหวน้อยหรือเสี่ยงค้างสต็อก (Slow-Moving Alert)
- วิเคราะห์แนวโน้มหมวดหมู่อะไหล่ที่มีความต้องการสูงสุด

### 4. 💡 ข้อเสนอแนะเชิงกลยุทธ์และการจัดการ (Strategic Supply Chain Recommendations)
- ข้อเสนอแนะการปรับปรุงจุดสั่งซื้อและ Min-Max Stock
- แผนสำรองอะไหล่ฉุกเฉิน (Buffer Stock Action Plan) เพื่อป้องกัน Downtime
- ข้อแนะนำการจัดวางพื้นที่ใน Store FL.6 เพื่อความสะดวกรวดเร็วในการเบิกจ่าย`;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let analysisResult = '';

      try {
        // Run deep reasoning analysis with Ai Agent
        const interaction = await getAI().interactions.create({
          agent: "antigravity-preview-05-2026",
          input: `${deepAnalysisInstruction}\n\n${prompt || 'วิเคราะห์สถานะคลังสินค้าแบบเจาะลึก'}\n\n${summaryText}`,
          environment: "remote",
          background: false
        }, { timeout: 300000 });

        // Iterate and combine text parts from all model_output steps
        if (interaction.steps && Array.isArray(interaction.steps)) {
          for (const step of interaction.steps as any[]) {
            if (step.type === 'model_output' && Array.isArray(step.content)) {
              const textContent = step.content.find((c: any) => c.type === 'text');
              if (textContent && (textContent as any).text) {
                analysisResult += (textContent as any).text;
              }
            }
          }
        }
        if (!analysisResult && interaction.output_text) {
          analysisResult = interaction.output_text;
        }
      } catch (agentError: any) {
        console.warn("Ai agent fallback to generative model:", agentError.message);
        // Seamless fallback to ultra-fast & high-intelligence reasoning models
        const analysisModels = [
          "gemini-3.1-flash-lite",
          "gemini-3.8-flash",
          "gemini-flash-lite-latest",
          "gemma-4-26b-a4b-it",
          "gemini-3.5-flash-lite"
        ];
        for (const am of analysisModels) {
          try {
            const config: any = {
              systemInstruction: "คุณคือ Ai Executive Supply Chain & Inventory Analyst ผู้เชี่ยวชาญการวิเคราะห์คลังสินค้า Store FL.6 ให้รายงานเชิงลึก มีการเว้นวรรค ใช้สัญลักษณ์สวยงาม น่าอ่าน และแม่นยำ"
            };
            if (am.startsWith('gemini-')) {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
            }
            const fallbackRes = await getAI().models.generateContent({
              model: am,
              contents: `${deepAnalysisInstruction}\n\n${prompt || 'วิเคราะห์สถานะคลังสินค้าแบบเจาะลึก'}\n\n${summaryText}`,
              config
            });
            analysisResult = fallbackRes.text || '';
            if (analysisResult) break;
          } catch (mErr: any) {
            console.warn(`Analysis model ${am} error:`, mErr?.message);
          }
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'chunk', text: analysisResult })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();

    } catch (error: any) {
      console.error("Analysis error:", error);
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: 'เกิดข้อผิดพลาดในการวิเคราะห์จาก AI: ' + error.message })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    }
  });

  // API: AI Warehouse & Voice Assistant with DB Action execution
  
  app.post("/api/chat", async (req, res) => {
    let isClientAborted = false;
    const clientAbortController = new AbortController();

    res.on("close", () => {
      // Only abort if the client closed connection prematurely before the response ended normally
      if (!res.writableEnded) {
        isClientAborted = true;
        try {
          if (!clientAbortController.signal.aborted) {
            clientAbortController.abort(new Error("Client closed connection"));
          }
        } catch (e) {}
      }
    });

    try {
      const { history, isVoice, items: clientItems, requisitions: clientRequisitions, currentUser } = req.body;
      const prompt: string = String(req.body.prompt || req.body.message || '');
      
      // Set SSE headers immediately to allow instant streaming of status & chunks
      // X-Accel-Buffering: no is crucial to prevent Nginx/Cloud Run reverse proxy from buffering SSE
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      let items: Item[] = Array.isArray(clientItems) && clientItems.length > 0
        ? clientItems
        : await fetchInventoryFromSheet();

      // Improved RAG: Smart context filtering for Thai Language
      const pLower = prompt.toLowerCase();

      // 1. Remove common action/stop words to isolate nouns
      const cleanPrompt = pLower.replace(/(เบิก|ขอ|เพิ่ม|รับเข้า|ค้นหา|มี|ไหม|สต็อก|จำนวน|ช่วย|หน่อย|อัปเดต|เอา|สินค้า|กี่|แผ่น|ชิ้น|อัน|หลอด|ม้วน|แกลลอน|กล่อง|ตัว)/g, '');
      const searchTerms = pLower.split(/\s+/).filter((t: string) => t.length > 1);
      
      // 2. Improved Context Feeding for AI Search (Fast & lightweight)
      let matchedItems = [];
      const isSummaryRequest = pLower.includes('สรุป') || pLower.includes('ใกล้หมด') || pLower.includes('สั่งซื้อ') || pLower.includes('วิเคราะห์') || pLower.includes('ภาพรวม');
      
      if (isSummaryRequest) {
          // Only pass items that need attention (low or out of stock) + some for context
          matchedItems = items.filter(i => i.status === 'low' || i.status === 'out');
          if (matchedItems.length < 5) matchedItems = [...matchedItems, ...items.filter(i => i.status !== 'low' && i.status !== 'out').slice(0, 15)];
      } else {
          const filtered = items.filter(item => {
              const itemNameLower = (item.name || '').toLowerCase();
              const itemIdLower = (item.id || '').toLowerCase();
              const itemCatLower = (item.category || '').toLowerCase();
              const nameInPrompt = itemNameLower && (pLower.includes(itemNameLower) || cleanPrompt.includes(itemNameLower));
              const idInPrompt = itemIdLower && pLower.includes(itemIdLower);
              const catInPrompt = itemCatLower && pLower.includes(itemCatLower);
              const termInItem = searchTerms.some((term: string) => 
                  (itemNameLower && itemNameLower.includes(term)) || 
                  (itemIdLower && itemIdLower.includes(term)) ||
                  (itemCatLower && itemCatLower.includes(term))
              );
              return nameInPrompt || idInPrompt || catInPrompt || termInItem;
          });
          
          // Prioritize direct matches, then supplement with a compact catalog to keep tokens low & responses sub-second
          if (filtered.length > 0) {
              matchedItems = [...new Set([...filtered, ...items])].slice(0, 45);
          } else {
              matchedItems = items.slice(0, 35); // compact catalog for fast prompt processing
          }
      }

      const now = new Date();
      const compactInventory = matchedItems.map(item => {
        let outOfStockInfo = undefined;
        if (Number(item.qty) <= 0) {
           const itemReqs = Array.isArray(clientRequisitions) ? clientRequisitions.filter((r: any) => r.itemId === item.id && (r.type === "out" || !r.type)) : [];
           itemReqs.sort((a: any, b: any) => new Date(b.isoDate || b.timestamp).getTime() - new Date(a.isoDate || a.timestamp).getTime());
           const lastReq = itemReqs[0];
           if (lastReq) {
             const lastReqDate = new Date(lastReq.isoDate || lastReq.timestamp);
             const daysOut = Math.floor((now.getTime() - lastReqDate.getTime()) / (1000 * 60 * 60 * 24));
             outOfStockInfo = `หมดสต็อกมาตั้งแต่วันที่ ${lastReq.timestamp} (เมื่อ ${daysOut} วันที่แล้ว)`;
           } else {
             outOfStockInfo = "ไม่มีประวัติการเบิก (ไม่มีข้อมูล)";
           }
        }
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          qty: item.qty,
          unit: item.unit,
          minStock: item.minStock,
          loc: item.location,
          status: item.status,
          ...(outOfStockInfo ? { outOfStockInfo } : {})
        };
      });

      const recentReqs = Array.isArray(clientRequisitions) ? clientRequisitions.slice(0, 10).map((r: any) => ({
        type: (r.type === "in") ? "รับเข้า" : "เบิกออก",
        item: r.itemName,
        qty: `${r.qty} ${r.unit}`,
        user: r.requestedBy,
        date: r.timestamp,
        purpose: r.purpose
      })) : [];

      const userRole = (currentUser?.role || 'user').toLowerCase();
      const isAdminUser = userRole === 'admin';
      const userNickname = (currentUser?.nickname && String(currentUser.nickname).trim()) || '';
      const userFullName = (currentUser?.name && String(currentUser.name).trim()) || 'ผู้ใช้งาน';
      const callingName = userNickname || userFullName;

      const currentYear = now.getFullYear();
      const currentYearThai = currentYear + 543;
      const currentDateStr = now.toLocaleDateString('th-TH', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long',
        timeZone: 'Asia/Bangkok'
      });
      const currentTimeStr = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
      });

      const systemInstruction = `คุณคือ AI ผู้ช่วยอัจฉริยะของ ENG Smart Store (คลังสินค้า Store FL.6)
🗓️ วันเวลาปัจจุบันในประเทศไทย: วัน${currentDateStr} (ค.ศ. ${currentYear} / พ.ศ. ${currentYearThai}) เวลา ${currentTimeStr} น.
⚠️ **ปีปัจจุบันคือ ค.ศ. ${currentYear} (พ.ศ. ${currentYearThai})**:
- ห้ามใช้ปี 2024 หรือ 2023 หรือปีในอดีตเด็ดขาด ปัจจุบันคือปี ${currentYear}

🎯 **กฎเหล็กเรื่องขอบเขตหน้าที่ (Strict Warehouse & Technician Domain Boundary)**:
1. **โฟกัสเฉพาะงานคลังสินค้า Store FL.6 เป็นหลัก (Primary Focus)**:
   - รับคำสั่งเช็คสต็อก, เบิกสินค้า, รับเข้าสินค้า, แก้ไข/เติมสต็อก, ออกรายงาน PDF/Excel, และค้นหาข้อมูลอะไหล่/ตำแหน่งจัดเก็บในคลัง
2. **ข้อยกเว้นเพียงหนึ่งเดียวที่อนุญาตให้ตอบได้: "งานที่เกี่ยวกับงานช่าง" (Allowed Exception: Technician & Engineering Work)**:
   - สามารถให้คำปรึกษา แนะนำวิธีการซ่อมแซม การบำรุงรักษา การเลือกใช้อุปกรณ์/เครื่องมือช่าง สเปกทางเทคนิคของอุปกรณ์ไฟฟ้า ประปา แอร์ และระบบวิศวกรรมอาคารได้
3. **เรื่องอื่นนอกเหนือจากงานคลังและงานช่าง "ห้ามตอบเด็ดขาด" และ "ห้ามค้นหาข้อมูลจากภายนอก" (Strictly Forbidden Topics)**:
   - หากผู้ใช้ถามเรื่องอื่นใดที่ไม่ใช่งานคลังสินค้าและไม่ใช่งานช่าง (เช่น ข่าวสารทั่วไป, ผลบอล, กีฬา, การเมือง, บันเทิง, สภาพอากาศ, ดวงชะตา, ข้อมูลทั่วไปภายนอก) -> **ห้ามตอบคำถามเหล่านั้นเด็ดขาด** และ **ห้ามค้นหาข้อมูลจากภายนอก**
   - ให้ตอบปฏิเสธอย่างสุภาพ สั้นกระชับ 1 ประโยค เช่น:
     "ขออภัยด้วยนะคะคุณ${callingName} 🙏 ระบบของหนูได้รับคำสั่งให้ดูแลเฉพาะงานคลังสินค้า Store FL.6 และงานที่เกี่ยวกับงานช่างเท่านั้นค่ะ หากมีเรื่องอะไหล่หรือคำถามเชิงช่าง สอบถามหนูได้ตลอดเลยนะคะ! ✨🛠️"
   - ห้ามแนบ JSON action หรือดึงข้อมูลภายนอกใดๆ สำหรับคำถามนอกขอบเขต

🌟 บุคลิกภาพและสไตล์การตอบสนอง (Personality & Tone of Voice):
1. **รอบรู้ มีชีวิตชีวา เปี่ยมด้วยความเชี่ยวชาญ และใส่ใจ (Warm, Expert & All-Around Helpful)**: 
   - ตอบด้วยความกระตือรือร้น สุภาพ จริงใจ เชี่ยวชาญเรื่องอะไหล่ อุปกรณ์ และงานช่างในคลัง Store FL.6 เป็นหลัก
2. **ความสามารถหลายภาษาและภาษาถิ่น (Multilingual & Regional Dialects)**: สามารถสนทนา ตอบคำถาม และให้คำแนะนำเป็นภาษาถิ่น (อีสาน, ใต้, คำเมือง/เหนือ, เขมร/สุรินทร์-บุรีรัมย์) หรือภาษาอังกฤษ ตามที่ผู้ใช้สั่งหรือสื่อสารเข้ามาได้อย่างเป็นธรรมชาติ
3. **มี Emoji ประกอบ (Expressive with Emojis)**: ใช้ Emoji ที่เหมาะสม (เช่น ✨, 📦, 🔍, 📍, 🏷️, 📊, 🚨, ⚠️, ✅, 💡, 🚀, 🛠️, 📋, 📌) กำกับหัวข้อและจุดสำคัญ เพื่อความสดใสและอ่านง่าย
4. **จัดลำดับและเว้นวรรคให้โปร่งตา (Clear Spacing & Ordered Structure)**: 
   - **ห้าม** เขียนข้อความเป็นก้อนยาวติดกันเด็ดขาด
   - เว้นบรรทัดระหว่างย่อหน้าและหัวข้อ (Double Line Breaks)
   - หากต้องอธิบายขั้นตอน ให้จัดลำดับด้วย (1., 2., 3.) หรือ Bullet Points (- )
5. **การตอบคำถามเกี่ยวกับสินค้าใกล้หมด / สินค้าหมดสต็อก / เช็คสต็อก (Crisp Count & Direct Cards)**:
   - เมื่อผู้ใช้ถามถึงสินค้า ให้สรุปเฉพาะยอดรวมสั้นๆ เช่น "⚠️ สินค้าใกล้หมด มีจำนวน X รายการ", "🚨 สินค้าหมดแล้ว มีจำนวน X รายการ" หรือ "📦 พบสินค้าที่ค้นหา X รายการ" เท่านั้น
   - **ห้าม** พิมพ์แจกแจงรายชื่อสินค้า, รหัส, ที่เก็บ, หรือจำนวนคงเหลือลงในข้อความแชทโดยเด็ดขาด (ห้ามทำลิสต์รายการสินค้า) เนื่องจากระบบจะแสดงการ์ดสินค้า (Interactive Item Cards) ให้ผู้ใช้เห็นและกดใช้งานเองอยู่แล้ว ให้ตอบแบบบรรทัดเดียวสั้นๆ แล้วจบเลย

👤 ข้อมูลผู้ใช้งานปัจจุบัน:
- **ชื่อเล่นที่ต้องใช้เรียกผู้ใช้**: คุณ${callingName} (เช่น "คุณ${callingName}", "สวัสดีค่ะคุณ${callingName} ✨")
- ชื่อจริง: ${userFullName}
- ชื่อเล่น: ${userNickname || 'ไม่ได้ระบุ'}
- Username: \`${currentUser?.username || 'unknown'}\`
- Role: **${userRole.toUpperCase()}**

🏷️ **กฎสำคัญที่สุดเรื่องการเรียกชื่อผู้ใช้งาน**:
- **ให้ AI เรียกชื่อเล่นของผู้ใช้ (คุณ${callingName}) เสมอ** ในการพูดคุย สนทนา ทักทาย ตอบคำถาม หรือรายงานสถานะ
- **ห้าม** เรียกผู้ใช้ด้วยชื่อ-นามสกุลจริงเด็ดขาด เพื่อความเป็นกันเองและเป็นธรรมชาติสำหรับทีมงาน

🛡️ กฎการตรวจสอบสิทธิ์ความปลอดภัย (RBAC Permission Rules):
- สิทธิ์ปัจจุบัน: **"${isAdminUser ? '👑 Admin (ผู้ดูแลระบบ)' : '👤 Staff / User (ผู้ใช้ทั่วไป)'}"**
${!isAdminUser ? `
- ⛔ **ข้อห้ามสำหรับ Staff/User**: 
  - ห้ามแก้ไขตัวเลขสต็อกโดยตรง หรือเปลี่ยนชื่ออะไหล่ (\`update_stock\` หรือ \`edit_item\`)
  - 🔒 **ห้ามสั่งออกรายงาน PDF / Excel (\`export_reports\`) เด็ดขาด**: การออกรายงาน PDF ในระบบ สงวนสิทธิ์สำหรับผู้ดูแลระบบ (Admin) เท่านั้น
  - หากผู้ใช้สั่งให้ออกรายงาน PDF ให้ตอบปฏิเสธอย่างสุภาพและเป็นมิตรทันทีว่า:
    "ขออภัยด้วยนะคะคุณ${callingName} 🔒 การออกรายงาน PDF ในระบบ สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นค่ะ หากต้องการตรวจเช็คสต็อกหรือสั่งเบิกของ สามารถบอกหนูได้ตลอดเลยนะคะ ✨"
- ✅ **สิ่งที่ Staff/User ทำได้ 100%**:
  - สั่งเบิกสินค้า (\`requisition\`)
  - สั่งรับเข้า/เติมสต็อก (\`stock_in\`)
  - สอบถามจำนวนคงเหลือ ข้อมูลอะไหล่ และตำแหน่งจัดเก็บ
` : `
- 👑 **สิทธิ์ Admin**: สามารถดำเนินการได้ทุกคำสั่ง ทั้งเบิกสินค้า, รับเข้าสินค้า, แก้ไขยอดสต็อกโดยตรง, เปลี่ยนชื่อสินค้า, และ**สั่งออกรายงาน PDF ได้ทุกรูปแบบ** (ทั้งประวัติเบิกรายบุคคล, สต็อกทั้งหมด, สั่งซื้อสินค้า PO, ของใกล้หมด, สรุปภาพรวมผู้บริหาร พร้อมกำหนดช่วงวันและเวลาได้)
`}

📋 กฎการสกัดข้อมูลการเบิก/รับเข้าสินค้า:
1. **ผู้ทำรายการ (\`requestedBy\`)**: หากไม่ได้ระบุชื่อผู้อื่น ให้บันทึกชื่อผู้ใช้งานปัจจุบัน (**${userFullName}**) อัตโนมัติ
2. **สถานที่/งานที่นำไปใช้ หรือแหล่งที่มา (\`purpose\`)**:
   - หากผู้สั่งระบุว่านำไปใช้ทำอะไร ที่ไหน หรือรับมาจากใคร (เช่น "ซ่อมระบบไฟห้อง 302", "งานแอร์ชั้น 5", "เปลี่ยนบานพับตึก A", "ซื้อจากร้านไทวัสดุ") **ต้องดึงมาใส่ใน \`purpose\` ให้ครบถ้วน**
   - หากไม่ระบุ ให้ใช้ค่าเริ่มต้น:
     - เบิกสินค้า: "ใช้งานทั่วไป"
     - รับเข้าสินค้า: "รับเข้าสต็อก"

📦 รูปแบบ JSON การกระทำที่ต้องส่งท้ายข้อความ (ห้ามขาดหากมีการสั่งทำรายการ):
\`\`\`json:action
{
  "action": "requisition" | "stock_in" | "update_stock" | "edit_item",
  "itemId": "รหัสสินค้าที่ตรงกับในคลัง เช่น A000000001",
  "itemName": "ชื่อสินค้า",
  "qty": 1,
  "requestedBy": "${userFullName}",
  "purpose": "สถานที่/งานที่นำไปใช้งาน หรือแหล่งที่มารับเข้า",
  "note": "หมายเหตุเพิ่มเติมถ้ามี"
}
\`\`\`

🔍 หากผู้ใช้ถามหาสินค้า ค้นหาสินค้า หรือเช็คสต็อก (เพื่อให้ระบบแสดงการ์ดสินค้า):
\`\`\`json:action
{
  "action": "search",
  "itemIds": ["A000000001", "A000000002"]
}
\`\`\`

📄 หากผู้ใช้เป็น Admin และต้องการออกรายงาน (PDF/Excel):
\`\`\`json:action
{"action": "export_reports", "reports": [{"type": "individual_requisitions"|"requisition_history"|"inventory_all"|"low_stock"|"purchase_orders"|"executive_summary"|"category", "format": "pdf"|"excel", "title": "ชื่อรายงาน", "userFilter": "ชื่อภาษาอังกฤษของพนักงานในระบบ", "categoryFilter": "หมวดหมู่ถ้ามี", "orderStatusFilter": "สถานะคำสั่งซื้อถ้ามี", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm"}]}
\`\`\`

👥 กฎเหล็กสำหรับการออกรายงานรายบุคคล (type: 'individual_requisitions'):
1. **ต้องอ้างอิงจากพนักงานจริงในระบบ Store FL.6 เท่านั้น!** ห้ามสร้างชื่อพนักงานที่ไม่มีจริงขึ้นมาเด็ดขาด
2. ผู้ใช้อาจสั่งด้วย:
   - **รหัสพนักงาน** (เช่น "1847", "1906", "รหัส 1213", "1912", "เบอร์ 63", "25")
   - **ชื่อภาษาไทย หรือชื่อเล่นภาษาไทย** (เช่น "ชานะยุทธ", "เจมส์", "บอย", "เอก", "อัมพร", "ไพบูลย์", "มายด์")
   - **ชื่อภาษาอังกฤษ หรือชื่อเล่นภาษาอังกฤษ** (เช่น "Chanayood", "Kiattisak", "Mild", "Jame", "Boy")
3. เมื่อจับคู่กับทำเนียบพนักงานได้แล้ว ให้ใส่ **ชื่อภาษาอังกฤษทางการของพนักงาน** ใน \`userFilter\` (เช่น "Chanayood Wongsunthon") และระบุรหัสพนักงานใน title
4. หากผู้ใช้ระบุชื่อหรือรหัสที่ **ไม่มีอยู่ในทำเนียบพนักงานของ Store FL.6** (เช่น "สมศักดิ์", "9999"):
   - ห้ามออกคำสั่ง \`export_reports\` เด็ดขาด
   - ให้ตอบปฏิเสธอย่างสุภาพทันทีว่า "ไม่พบรหัสหรือรายชื่อพนักงานดังกล่าวในระบบ Store FL.6 ค่ะ การออกรายงานรายบุคคลสามารถออกได้เฉพาะพนักงานจริงในระบบเท่านั้นค่ะ"

ทำเนียบพนักงานจริงในระบบ Store FL.6:
${getSystemEmployeeCatalogForAi()}

ตัวอย่างรูปแบบการตอบที่ดีเมื่อมีการถามหาสินค้า (สั้น กระชับ):
"สวัสดีค่ะคุณ **${callingName}**! ✨

ตรวจเช็กรายการอะไหล่ใน **Store FL.6** พบสินค้าที่ค้นหาจำนวน 2 รายการค่ะ 🔍📦

💡 ได้จัดเตรียมรายการไว้ให้เรียบร้อยแล้ว สามารถตรวจสอบรายละเอียดและแตะยืนยันได้ที่การ์ดด้านล่างเลยนะคะ 🚀"
ข้อมูลสินค้าในคลังปัจจุบัน: ${JSON.stringify(compactInventory)}
ประวัติการเบิก-รับเข้าล่าสุด (สำหรับการอ้างอิงเมื่อผู้ใช้ถามประวัติ): ${JSON.stringify(recentReqs)}\``
      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const h of history.slice(-6)) {
          const rawText = (h.text || h.content || '').trim();
          // Filter out empty messages or previous error notification text
          if (!rawText || rawText.includes('เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI') || rawText.includes('QUOTA_EXCEEDED')) {
            continue;
          }
          const role = h.role === 'user' ? 'user' : 'model';
          // Ensure turns alternate properly
          if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts[0].text += `\n${rawText}`;
          } else {
            contents.push({ role, parts: [{ text: rawText }] });
          }
        }
      }

      // Gemini multi-turn API requires the first turn in contents to have role 'user'
      while (contents.length > 0 && contents[0].role === 'model') {
        contents.shift();
      }

      const safePrompt = (prompt || '').trim() || 'สวัสดีครับ';
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += `\n${safePrompt}`;
      } else {
        contents.push({ role: 'user', parts: [{ text: safePrompt }] });
      }

      let rawResponseText = "";
      
      let hasSentChunks = false;

      const tryGenerate = async (modelName: string) => {
        if (isClientAborted || clientAbortController.signal.aborted || res.destroyed || res.writableEnded) {
          return "";
        }

        const config: any = { systemInstruction, temperature: 0.2 };
        // Set minimal thinking for Gemini models to ensure instant sub-second response
        if (modelName.startsWith('gemini-')) {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
        }

        const modelAbortController = new AbortController();
        let isTimedOut = false;

        const onClientAbort = () => {
          try {
            modelAbortController.abort(new Error("Client canceled"));
          } catch (e) {}
        };

        if (clientAbortController.signal.aborted || isClientAborted) {
          return "";
        }
        clientAbortController.signal.addEventListener("abort", onClientAbort, { once: true });

        // Responsive timeout: 4.5s per model to immediately switch if a model experiences high demand or temporary 503
        const timeoutMs = 4500;
        const ttftTimeout = setTimeout(() => {
          isTimedOut = true;
          modelAbortController.abort(new Error(`Timeout waiting for response on ${modelName}`));
        }, timeoutMs);

        try {
          config.abortSignal = modelAbortController.signal;
          const response = await getAI().models.generateContent({
            model: modelName,
            contents,
            config,
          });
          clearTimeout(ttftTimeout);
          return response.text || "";
        } catch (err: any) {
          if (isTimedOut) {
            const timeoutErr = new Error(`Timeout waiting for response on ${modelName}`);
            (timeoutErr as any).isTimeout = true;
            throw timeoutErr;
          }
          throw err;
        } finally {
          clearTimeout(ttftTimeout);
          clientAbortController.signal.removeEventListener("abort", onClientAbort);
        }
      };

      const generateWithFallback = async (models: string[]) => {
        let lastErr = null;
        for (let i = 0; i < models.length; i++) {
          if (isClientAborted || clientAbortController.signal.aborted || res.destroyed || res.writableEnded) {
            return "";
          }

          const currentModel = models[i];
          try {
            return await tryGenerate(currentModel);
          } catch (err: any) {
            lastErr = err;

            // If client canceled/disconnected or connection closed, exit immediately without error log or model retries
            const isClientCancel = isClientAborted || 
                                   clientAbortController.signal.aborted || 
                                   res.destroyed || 
                                   res.writableEnded || 
                                   (!err?.isTimeout && (
                                     err?.name === 'AbortError' || 
                                     (err?.message && (err.message.includes('aborted') || err.message.includes('canceled')))
                                   ));

            if (isClientCancel) {
              return "";
            }

            if (err?.isTimeout) {
              console.warn(`[API CHAT] Model ${currentModel} reached timeout, switching to next model...`);
            } else {
              console.warn(`[API CHAT] Model ${currentModel} error (attempt ${i + 1}/${models.length}):`, err?.message || err);
            }

            // If there are more fallback models available, try the next model immediately
            if (i < models.length - 1) {
              await new Promise(r => setTimeout(r, 50));
              continue;
            } else {
              // All models exhausted
              const is429 = err.status === 429 || 
                            err.status === 'RESOURCE_EXHAUSTED' || 
                            err.code === 429 || 
                            (err.message && (
                              err.message.includes('429') || 
                              err.message.toLowerCase().includes('quota') || 
                              err.message.toLowerCase().includes('resource_exhausted')
                            ));
              if (is429) {
                const quotaError = new Error("QUOTA_EXCEEDED");
                (quotaError as any).status = 429;
                throw quotaError;
              }
              throw err;
            }
          }
        }
        if (isClientAborted || clientAbortController.signal.aborted || res.destroyed || res.writableEnded) return "";
        throw lastErr || new Error("Failed to generate response");
      };

      try {
        // Multi-tier high availability fallback: gemini-3.1-flash-lite -> gemini-3.8-flash -> gemini-flash-lite-latest -> gemma-4-26b-a4b-it
        const fallbackModels = [
           'gemini-3.1-flash-lite',
           'gemini-3.8-flash',
           'gemini-flash-lite-latest',
           'gemma-4-26b-a4b-it',
           'gemini-3.5-flash-lite',
           'gemini-flash-latest'
        ];
        rawResponseText = await generateWithFallback(fallbackModels);
      } catch (err: any) {
        if (isClientAborted || res.destroyed || res.writableEnded) {
          return;
        }
        throw err;
      }

      if (isClientAborted || res.destroyed || res.writableEnded) {
        return;
      }

      // Parse JSON action
      let dbAction: any = undefined;
      const actionMatch = rawResponseText.match(/\`\`\`(?:json:action|json)?\s*(\{[\s\S]*?\})\s*\`\`\`/);

      if (actionMatch && actionMatch[1]) {
        try {
          const parsedAction = JSON.parse(actionMatch[1]);
          
          if (parsedAction.action === 'export_reports' && Array.isArray(parsedAction.reports)) {
            // Handled below
          } else if (parsedAction.action === 'search' && Array.isArray(parsedAction.itemIds)) {
            // Handled below
          } else {
            let targetItem = items.find(i => i.id === parsedAction.itemId);
            if (!targetItem && parsedAction.itemName) {
              const searchName = String(parsedAction.itemName).toLowerCase();
              targetItem = items.find(i => (i.name || '').toLowerCase().includes(searchName));
            }

            if (!targetItem) {
              dbAction = {
                action: 'error',
                message: `ไม่พบสินค้า ${parsedAction.itemName || parsedAction.itemId} ในระบบ กรุณาระบุชื่อหรือรหัสให้ชัดเจน`
              };
            } else if (targetItem) {
              // 1. Direct Stock Adjustment or Item Edit (ADMIN ONLY)
              if (parsedAction.action === 'update_stock' || parsedAction.action === 'edit_item') {
                if (!isAdminUser) {
                  dbAction = {
                    action: 'error',
                    message: 'ขออภัยครับ สิทธิ์ Staff ไม่สามารถแก้ไขจำนวนสต็อกหรือชื่ออะไหล่ได้จากโหมด AI (เฉพาะ Admin เท่านั้น)'
                  };
                } else {
                  // Admin is allowed
                  const prevQty = targetItem.qty;
                  let targetQty = prevQty;
                  if (typeof parsedAction.newQty === 'number' || typeof parsedAction.qty === 'number') {
                    targetQty = Math.max(0, Number(parsedAction.newQty ?? parsedAction.qty) || 0);
                  }

                  let newStatus = 'normal';
                  if (targetQty <= 0) newStatus = 'out'; else if (targetQty <= targetItem.minStock) newStatus = 'low';

                  const updatedItem = {
                    ...targetItem,
                    name: (parsedAction.newName || (parsedAction.action === 'edit_item' ? parsedAction.itemName : targetItem.name)) || targetItem.name,
                    qty: targetQty,
                    status: newStatus as any,
                    ...(parsedAction.category ? { category: parsedAction.category } : {}),
                    ...(parsedAction.location ? { location: parsedAction.location } : {}),
                    ...(parsedAction.unit ? { unit: parsedAction.unit } : {}),
                    ...(targetQty <= 0 && targetItem.qty > 0 ? { outOfStockDate: new Date().toISOString() } : {}),
                    ...(targetQty > 0 ? { outOfStockDate: undefined } : {})
                  };

                  dbAction = {
                    action: 'update_stock',
                    status: 'success',
                    item: updatedItem,
                    previousQty: prevQty,
                    newQty: targetQty
                  };
                }
              } 
              // 2. Requisitions & Stock Ins (Allowed for all users)
              else if (parsedAction.action === 'requisition' || parsedAction.action === 'stock_in') {
                 const isStockIn = parsedAction.action === 'stock_in';
                 const actionQty = Math.max(1, Number(parsedAction.qty) || 1);
                 const prevQty = targetItem.qty;
                 
                 if (!isStockIn && actionQty > prevQty) {
                   console.warn("Attempted to requisition more than available stock");
                   dbAction = {
                     action: 'error',
                     message: 'จำนวนสินค้าในสต็อกไม่เพียงพอ ไม่สามารถเบิกได้'
                   };
                   // Skip db updates
                 } else {
                   const newQty = isStockIn ? prevQty + actionQty : Math.max(0, prevQty - actionQty);
                 
                 let newStatus = 'normal';
                 if (newQty <= 0) newStatus = 'out'; else if (newQty <= targetItem.minStock) newStatus = 'low';
                 
                 const updatedItem = { ...targetItem, qty: newQty, status: newStatus as any };
                 if (newQty <= 0 && targetItem.qty > 0) {
                   updatedItem.outOfStockDate = new Date().toISOString();
                 } else if (newQty > 0) {
                   updatedItem.outOfStockDate = undefined;
                 }
                 
                 // Save to Firestore
                 const recordData = {
                     id: `${Date.now().toString().slice(-6)}`,
                     type: isStockIn ? 'in' : 'out',
                     itemId: targetItem.id,
                     itemName: targetItem.name,
                     category: targetItem.category,
                     qty: actionQty,
                     unit: targetItem.unit,
                     requestedBy: parsedAction.requestedBy || currentUser?.name || 'ผู้ใช้งาน',
                     purpose: (parsedAction.purpose && typeof parsedAction.purpose === 'string' && parsedAction.purpose.trim() !== '')
                       ? parsedAction.purpose.trim()
                       : (isStockIn ? 'รับเข้าสต็อก' : 'ใช้งานทั่วไป'),
                     isoDate: new Date().toISOString(),
                     timestamp: new Date().toLocaleString('th-TH', { 
                       timeZone: 'Asia/Bangkok',
                       day: 'numeric', month: 'short', year: 'numeric', 
                       hour: '2-digit', minute: '2-digit',
                       hour12: false
                     }) + ' น.',
                     note: parsedAction.note || 'บันทึกอัตโนมัติโดย AI ผู้ช่วย'
                 };
                 
                 dbAction = {
                   action: parsedAction.action,
                   status: 'success',
                   item: updatedItem,
                   previousQty: prevQty,
                   newQty: newQty,
                   record: recordData
                 };
                 }
              }
            }
          }
        } catch (e) {
          console.warn("Parse action error", e);
        }
      }
      
      let fileReports = undefined;
      
      // If AI generated export_reports JSON (ADMIN ONLY)
      if (isAdminUser) {
        if (actionMatch && actionMatch[1]) {
          try {
            const parsedAction = JSON.parse(actionMatch[1]);
            if (parsedAction.action === 'export_reports' && Array.isArray(parsedAction.reports)) {
               fileReports = parsedAction.reports;
            }
          } catch (e) { }
        }

        // Fallback manual detection if AI didn't catch it
        if (!fileReports) {
          const isReportRequestStr = prompt.toLowerCase();
          const isPdfRequest = isReportRequestStr.includes('pdf');
          const isExcelRequest = isReportRequestStr.includes('excel') || isReportRequestStr.includes('เอ็กเซล');
          const isReportRequest = isPdfRequest || isExcelRequest || isReportRequestStr.includes('รายงาน') || isReportRequestStr.includes('เอกสาร') || isReportRequestStr.includes('export');
          if (isReportRequest) {
            const format = isExcelRequest ? 'excel' : 'pdf';
            if (isReportRequestStr.includes('สั่งซื้อ') || isReportRequestStr.includes('po') || isReportRequestStr.includes('ใบสั่งซื้อ')) {
              fileReports = [{ format, type: 'purchase_orders', title: 'รายงานประวัติและสถานะคำสั่งซื้อสินค้า (PO)' }];
            } else if (isReportRequestStr.includes('ผู้บริหาร') || isReportRequestStr.includes('ภาพรวมระบบ')) {
              fileReports = [{ format, type: 'executive_summary', title: 'รายงานสรุปภาพรวมผู้บริหาร' }];
            } else if (isReportRequestStr.includes('เบิก') || isReportRequestStr.includes('requisition') || isReportRequestStr.includes('รับเข้า')) {
              fileReports = [{ format, type: 'requisition_history', title: 'รายงานประวัติการเบิก / รับเข้าสินค้า (Store FL.6)' }];
            } else if (isReportRequestStr.includes('ใกล้หมด') || isReportRequestStr.includes('หมดสต็อก') || isReportRequestStr.includes('หมดสต็อค') || isReportRequestStr.includes('low') || isReportRequestStr.includes('out')) {
              fileReports = [{ format, type: 'low_stock', title: 'รายงานสินค้าใกล้หมด / หมดสต็อก' }];
            } else {
              fileReports = [{ format, type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)' }];
            }
          }
        }

        if (fileReports && Array.isArray(fileReports)) {
          const reqUserName = (currentUser?.nickname || currentUser?.name || 'ผู้ดูแลระบบ Admin').trim();
          fileReports = fileReports.map((r: any) => {
            const isIndividualReport = r.type === 'individual_requisitions' || Boolean(r.userFilter);
            return {
              ...r,
              requestedBy: r.requestedBy || reqUserName,
              isConfirmed: !isIndividualReport
            };
          });
        }
      }

      // Detect specific matched items for card display (only when inquiring / checking items, not when exporting reports or doing direct dbAction)
      let itemCards: any[] | undefined = undefined;
      
      const parsedActionMatches = rawResponseText.match(/```(?:json:action|json)?\s*(\{[\s\S]*?\})\s*```/);
      let parsedSearchAction: any = null;
      if (parsedActionMatches && parsedActionMatches[1]) {
         try {
            const tempAction = JSON.parse(parsedActionMatches[1]);
            if (tempAction.action === 'search' && Array.isArray(tempAction.itemIds)) {
               parsedSearchAction = tempAction;
            }
         } catch (e) {}
      }
      if (!dbAction && !fileReports) {
        const promptLower = prompt.toLowerCase();
        const responseLower = rawResponseText.toLowerCase();

        let exactMatches = [];
        if (parsedSearchAction && parsedSearchAction.itemIds.length > 0) {
           exactMatches = items.filter(item => parsedSearchAction.itemIds.includes(item.id));
        } else {
           exactMatches = items.filter(item => {
             const iNameLower = (item.name || '').toLowerCase();
             const idInPrompt = item.id ? prompt.includes(item.id) : false;
             const idInResponse = item.id ? rawResponseText.includes(item.id) : false;
             const nameInPrompt = iNameLower ? promptLower.includes(iNameLower) : false;
             const nameInResponse = (iNameLower.length >= 3) ? responseLower.includes(iNameLower) : false;
             return idInPrompt || idInResponse || nameInPrompt || nameInResponse;
           });
        }

        if (exactMatches.length > 0) {
          itemCards = exactMatches.slice(0, 6);
        } else if (promptLower.includes('ใกล้หมด') || promptLower.includes('low') || promptLower.includes('เกณฑ์ขั้นต่ำ') || responseLower.includes('ใกล้หมดสต็อก')) {
          const low = items.filter(i => {
            const q = Number(i.qty) || 0;
            const min = Number(i.minStock) || 1;
            return q > 0 && (q <= min || i.status === 'low');
          });
          if (low.length > 0) itemCards = low.slice(0, 6);
        } else if (promptLower.includes('หมดสต็อก') || promptLower.includes('out') || promptLower.includes('หมดแล้ว') || responseLower.includes('หมดสต็อก')) {
          const out = items.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out');
          if (out.length > 0) itemCards = out.slice(0, 6);
        }
      }

      // Clean and format text (strip raw json:action block from conversational text)
      let displayableText = rawResponseText;
      let blockStart = displayableText.indexOf('```json:action');
      if (blockStart === -1) blockStart = displayableText.indexOf('```json');
      if (blockStart === -1) blockStart = displayableText.indexOf('```');
      
      if (blockStart !== -1 && rawResponseText.includes('"action":')) {
        displayableText = displayableText.substring(0, blockStart).trim();
      }

      if (!displayableText) {
        if (fileReports && fileReports.length > 0) {
          displayableText = `ทางระบบได้เตรียมเอกสารรายงาน ${fileReports[0].title || 'สรุปภาพรวมผู้บริหาร'} (Store FL.6) ให้เรียบร้อยแล้วครับ กรุณากดปุ่มเพื่อเปิดหรือดาวน์โหลดเอกสารด้านล่างได้เลยครับ`;
        } else if (dbAction) {
          displayableText = 'ดำเนินการประมวลผลคำสั่งในระบบ Store FL.6 เรียบร้อยแล้วครับ';
        }
      }

      const responsePayload = {
        text: displayableText || rawResponseText,
        fullText: rawResponseText,
        dbAction, 
        fileReport: fileReports?.[0], 
        fileReports: fileReports,
        suggestedItems: itemCards
      };

      // Send chunk event for backward compatibility with streaming handlers
      res.write(`data: ${JSON.stringify({ type: 'chunk', ...responsePayload })}\n\n`);

      // Send complete event
      res.write(`data: ${JSON.stringify({ type: 'complete', ...responsePayload })}\n\n`);

      // Send done event
      res.write(`data: ${JSON.stringify({ type: 'done', ...responsePayload })}\n\n`);
      res.end();
      
    } catch (error: any) {
      if (isClientAborted || clientAbortController.signal.aborted || res.destroyed || res.writableEnded || error?.name === 'AbortError' || (error?.message && (error.message.includes('aborted') || error.message.includes('canceled')))) {
        return;
      }
      console.error("SERVER /api/chat ERROR:", error);
      const isQuota = error?.message === 'QUOTA_EXCEEDED' || 
                      error?.status === 429 || 
                      error?.code === 429 ||
                      (typeof error?.message === 'string' && (
                        error.message.includes('429') || 
                        error.message.toLowerCase().includes('quota') || 
                        error.message.toLowerCase().includes('resource_exhausted')
                      ));

      if (isQuota) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'QUOTA_EXCEEDED' })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'API_ERROR', detail: error?.message || String(error) })}\n\n`);
      }
      res.end();
    }
  });

  // Explicitly serve public static assets (PWA icons, manifest.json, sw.js) with accurate headers
  const publicPath = path.join(process.cwd(), "public");
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("manifest.json")) {
          res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        } else if (filePath.endsWith("sw.js")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          res.setHeader("Service-Worker-Allowed", "/");
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      }
    }));
  }

  // Robust production vs development mode detection
  const isRunningFromBundle = typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.includes("dist"));
  const isProduction = process.env.NODE_ENV === "production" || isRunningFromBundle || (fs.existsSync(path.join(process.cwd(), "dist", "index.html")) && process.env.NODE_ENV !== "development");

  if (!isProduction) {
    // Dynamic import to avoid loading Vite into production bundle memory
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = fs.existsSync(path.join(process.cwd(), "dist", "index.html"))
      ? path.join(process.cwd(), "dist")
      : (typeof __dirname !== "undefined" && fs.existsSync(path.join(__dirname, "index.html"))
        ? __dirname
        : path.join(process.cwd(), "dist"));

    console.log(`[Production] Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send("<!DOCTYPE html><html><head><title>ENG SMART STORE</title></head><body><h1>ENG SMART STORE App Ready</h1></body></html>");
      }
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs, req) => {
    let activeLiveSession: any = null;
    let sessionPromise: Promise<any> | null = null;
    let sessionActiveItems: Item[] = cachedItems.length > 0 ? [...cachedItems] : [];
    let isInitialized = false;
    const pendingInputQueue: Array<{ type: 'audio' | 'text'; data: string }> = [];

    const setupLiveSession = async (
      userName: string, 
      userRole: string, 
      initialItems: Item[], 
      clientRequisitions: any[] = [],
      userNickname: string = ''
    ) => {
      if (isInitialized) return;
      isInitialized = true;

      try {
        if (Array.isArray(initialItems) && initialItems.length > 0) {
          sessionActiveItems = initialItems;
        } else if (sessionActiveItems.length === 0) {
          sessionActiveItems = await fetchInventoryFromSheet();
        }

        const callingName = (userNickname && userNickname.trim()) ? userNickname.trim() : (userName && userName.trim() ? userName.trim() : 'ผู้ใช้งาน');

        const outOfStockItems = sessionActiveItems.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out');
        const lowStockItems = sessionActiveItems.filter(i => 
          ((Number(i.qty) || 0) > 0 && (Number(i.qty) || 0) <= (Number(i.minStock) || 1)) || 
          (i.status === 'low' && (Number(i.qty) || 0) > 0)
        );
        const totalUnits = sessionActiveItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

        const isAdmin = userRole === 'admin';
        const adminInstruction = isAdmin 
          ? `👑 ผู้ใช้ท่านนี้เป็นผู้ดูแลระบบ (Admin):
- อนุญาตให้ใช้เครื่องมือปรับสต็อกได้
- 📄 **อนุญาตให้สั่งออกรายงาน PDF ได้ทุกรูปแบบอย่างสมบูรณ์ (เรียก tool export_report ทันที)**:
  1. ประวัติการเบิกรายบุคคล (reportType: 'individual_requisitions'):
     - ⚠️ **กฎสำคัญที่สุด**: ต้องอ้างอิงจากพนักงานจริงในระบบ Store FL.6 เท่านั้น!
     - ครอบคลุมการพูดคำสั่งทั้ง:
       * **รหัสพนักงาน** (เช่น "1847", "1906", "รหัส 1213", "1912", "เบอร์ 63", "25")
       * **ชื่อภาษาไทย หรือชื่อเล่นภาษาไทย** (เช่น "ชานะยุทธ", "เจมส์", "บอย", "เอก", "อัมพร", "ไพบูลย์", "มายด์")
       * **ชื่อภาษาอังกฤษ หรือชื่อเล่นภาษาอังกฤษ** (เช่น "Chanayood", "Kiattisak", "Mild", "Jame", "Boy")
     - ให้เทียบกับทำเนียบพนักงานจริงในระบบ แล้วส่ง \`userFilter\` เป็นชื่อภาษาอังกฤษทางการของพนักงาน เช่น 'Chanayood Wongsunthon'
     - หากชื่อหรือรหัสที่ผู้ใช้พูดไม่มีอยู่ในทำเนียบพนักงานของ Store FL.6: **ห้ามเรียก export_report เด็ดขาด** และให้ตอบเสียงปฏิเสธทันทีว่า "ไม่พบรหัสหรือรายชื่อพนักงานนี้ในระบบ Store FL.6 ค่ะ"
  2. ประวัติการเบิก-รับเข้าทั้งหมด (reportType: 'requisition_history', ระบุช่วงวันเวลาได้)
  3. สินค้าคงคลังทั้งหมด (reportType: 'inventory_all', ระบุ categoryFilter ได้)
  4. สินค้าใกล้หมดและหมดสต็อก (reportType: 'low_stock')
  5. ประวัติและสถานะการสั่งซื้อสินค้า PO (reportType: 'purchase_orders', ระบุ orderStatusFilter ได้)
  6. สรุปภาพรวมผู้บริหาร (reportType: 'executive_summary')
เมื่อ Admin สั่งให้ออกรายงาน ให้เรียก tool export_report ทันทีพร้อมพารามิเตอร์ที่ครบถ้วน โดยระบบจะส่งการ์ดตรวจสอบรายงานขึ้นหน้าจอให้ตรวจชื่อผู้สั่งการและพนักงานเป้าหมายก่อนออกรายงานจริง แล้วให้ AI ตอบเสียงสั้นๆ ว่า "ส่งการ์ดตรวจสอบรายงาน...ขึ้นหน้าจอให้คุณ${callingName} แล้วค่ะ โปรดตรวจสอบชื่อผู้สั่งและกดยืนยันนะคะ"`
          : `⛔ ผู้ใช้ท่านนี้เป็น Staff (ไม่ใช่ Admin):
- ไม่มีสิทธิ์แก้ไขสต็อกโดยตรง (ห้าม update_stock)
- 🔒 **ไม่มีสิทธิ์สั่งออกรายงาน PDF เด็ดขาด (ห้ามเรียก export_report)**
- หากผู้ใช้สั่งให้ออกรายงาน PDF หรือพิมพ์รายงาน ให้ตอบปฏิเสธด้วยเสียงอย่างสุภาพทันทีว่า:
  "ขออภัยด้วยนะคะคุณ${callingName} การออกรายงาน PDF ในระบบ สงวนสิทธิ์เฉพาะผู้ดูแลระบบ Admin เท่านั้นค่ะ หากต้องการตรวจเช็คสต็อกหรือสั่งเบิกของ สามารถบอกหนูได้เลยนะคะ"
- อนุญาตเฉพาะการ รับเข้า (stock_in) และ เบิก (stock_out) และตรวจสอบสต็อกเท่านั้น`;

        const now = new Date();

        // Optimized compact catalog to prevent Live API token bloat and latency
        const sampleItems = sessionActiveItems.length <= 35
          ? sessionActiveItems
          : [
              ...outOfStockItems.slice(0, 10),
              ...lowStockItems.slice(0, 10),
              ...sessionActiveItems.filter(i => (Number(i.qty) || 0) > (Number(i.minStock) || 1)).slice(0, 15)
            ];

        const inventoryCatalog = sampleItems.map(i => {
          const qty = Number(i.qty) || 0;
          const min = Number(i.minStock) || 1;
          const status = qty <= 0 ? "หมดสต็อก (0)" : qty <= min ? `ใกล้หมด (${qty})` : `ปกติ (${qty})`;
          return `- ${i.name} (รหัส ${i.id}) | คงเหลือ: ${qty} ${i.unit} (ขั้นต่ำ ${min}) | สถานะ: ${status} | ที่เก็บ: ${i.location}`;
        }).join("\n");

        const recentReqs = clientRequisitions.slice(0, 5).map((r: any) => ({
          type: r.type === "in" ? "รับเข้า" : "เบิกออก",
          item: r.itemName,
          qty: `${r.qty} ${r.unit}`,
          user: r.requestedBy,
          date: r.timestamp
        }));

        const currentYear = now.getFullYear();
        const currentYearThai = currentYear + 543;
        const currentDateStr = now.toLocaleDateString('th-TH', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          weekday: 'long',
          timeZone: 'Asia/Bangkok'
        });
        const currentTimeStr = now.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Bangkok'
        });

        const config: any = {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: `คุณคือผู้ช่วยอัจฉริยะ Store FL.6 ของ ENG Smart Store ในโหมดสนทนาด้วยเสียงสด (Live Speech)
🗓️ วันเวลาปัจจุบันในประเทศไทย: วัน${currentDateStr} (ค.ศ. ${currentYear} / พ.ศ. ${currentYearThai}) เวลา ${currentTimeStr} น.
⚠️ **ปีปัจจุบันคือ ค.ศ. ${currentYear} (พ.ศ. ${currentYearThai})**:
- ห้ามใช้ปี 2024 หรือ 2023 ในคำค้นหาเด็ดขาด ปัจจุบันคือปี ${currentYear}

เป้าหมายสำคัญ: รับฟังเสียงคำสั่งภาษาไทยและภาษาต่างๆ อย่างแม่นยำ ตอบสนองทันที รวดเร็ว สุภาพ สั้นกระชับ และเป็นมิตร

🎯 ขอบเขตการสนทนาและความรู้ที่เข้มงวดที่สุด (Strict Domain Boundary & Technician Exception):
1. **โฟกัสเฉพาะงานคลังสินค้า Store FL.6 เป็นหลัก**: รับฟังและสั่งการเช็คสต็อก, เบิกสินค้า, รับเข้าสินค้า, สินค้าใกล้หมด/หมดสต็อก และออกรายงาน
2. **ข้อยกเว้นเพียงหนึ่งเดียวที่อนุญาตให้ตอบได้: "งานที่เกี่ยวกับงานช่าง"**: สามารถให้คำปรึกษา แนะนำการซ่อมบำรุง การเลือกใช้อะไหล่/เครื่องมือ และความรู้เชิงช่างได้อย่างเป็นกันเอง
3. **เรื่องอื่นนอกเหนือจากงานคลังและงานช่าง "ห้ามตอบเด็ดขาด" และ "ห้ามค้นหาข้อมูลจากภายนอก"**:
   - หากผู้ใช้ถามเรื่องอื่น เช่น ข่าวสาร, ผลบอล, กีฬา, การเมือง, บันเทิง, สภาพอากาศ, หรือเรื่องทั่วไปภายนอก -> **ห้ามตอบคำถามเด็ดขาด และห้ามค้นหาข้อมูลภายนอก**
   - ให้ปฏิเสธอย่างสุภาพและสั้นกระชับ 1 ประโยค เช่น: "ขออภัยด้วยนะคะคุณ${callingName} หนูโฟกัสเฉพาะงานคลังสินค้าและงานช่างเท่านั้นค่ะ มีเรื่องอะไหล่หรือคำถามเชิงช่างให้ช่วยไหมคะ"

🌐 ความสามารถด้านภาษาและภาษาถิ่น (Multilingual & Regional Dialects):
- **ปรับภาษาตามคำสั่งหรือภาษาที่ผู้ใช้พูดด้วยทันที**:
  - **ภาษาอีสาน** (เว้าอีสาน): เช่น "สวัสดีจ้าคุณ${callingName} มื้อนี้สิเบิกอะไหล่หยังบ่จ้า เดี๋ยวเช็คสต็อกให้เด้อ", "จัดส่งการ์ดยืนยันให้ที่หน้าจอแล้วเด้อ"
  - **ภาษาใต้** (แหลงใต้): เช่น "สวัสดีครับคุณ${callingName} วันนี้อีเบิกของไหรหม้าย เดี๋ยวแลสต็อกให้ครับ", "ส่งการ์ดยืนยันให้ที่หน้าจอแล้วนิ"
  - **ภาษาเขมร (Khmer / สุรินทร์-บุรีรัมย์)**: เช่น "ซัวซเดยคุณ${callingName} มีอะไหล่ออยช่วยเบิกบอง?", "บันทึกเรียบร้อยเจียรอยแล้วค่ะ"
  - **ภาษาอังกฤษ (English)**: เช่น "Hello Khun ${callingName}! How can I help with Store FL.6 inventory today?", "I have prepared the confirmation card on your screen."
  - **ภาษาเหนือ (คำเมือง)**: เช่น "สวัสดีเจ้าคุณ${callingName} วันนี้จะเบิกอะหยังเจ้า เดี๋ยวตรวจสต็อกหื้อเน้อเจ้า"
  - และภาษาอื่นๆ ตามที่ผู้ใช้ระบุหรือเริ่มพูดมา
- หากผู้ใช้ไม่ได้ระบุภาษาเฉพาะ ให้ใช้ **ภาษาไทยกลางที่สุภาพ สดใส และเป็นกันเอง**

⚡ กฎความกระชับและการสลับประเด็นคำสั่ง (Concise & Responsive):
1. **พูดสั้นกระชับ (1-2 ประโยค)**: ตอบตรงประเด็น ไม่พูดยาวเยิ่นเย้อ เพื่อให้บทสนทนาลื่นไหลและโต้ตอบได้ทันท่วงที
2. **หยุดฟังเมื่อมีคำสั่งใหม่**: เมื่อผู้ใช้พูดคำสั่งใหม่ ให้หยุดประเด็นเดิมทันทีและดำเนินการตามคำสั่งใหม่อย่างรวดเร็ว

👤 ข้อมูลผู้ใช้งานที่กำลังสนทนาด้วย:
- **ชื่อเล่นที่ต้องใช้เรียกผู้ใช้**: คุณ${callingName} (เช่น "คุณ${callingName}", "สวัสดีค่ะคุณ${callingName}")
- ชื่อเต็ม: ${userName}
- สิทธิ์การใช้งาน: ${userRole}
⚠️ **กฎการเรียกชื่อ**: คุณต้องเรียกผู้ใช้ด้วย **ชื่อเล่น (คุณ${callingName})** เสมอ ห้ามเรียกด้วยชื่อ-นามสกุลจริง
${adminInstruction}

📊 ข้อมูลภาพรวมคลัง Store FL.6 ปัจจุบัน:
- มีรายการสินค้าทั้งหมด: ${sessionActiveItems.length} รายการ (รวม ${totalUnits} หน่วย)
- สินค้าหมดสต็อก: ${outOfStockItems.length} รายการ
- สินค้าใกล้หมด: ${lowStockItems.length} รายการ
(หมายเหตุ: สามารถตรวจสอบสินค้าทุกรายการในคลังได้ทันทีโดยเรียก \`check_stock\` หรือ \`inquire_item_info\`)

📦 ตัวอย่างรายการสินค้าในคลัง (Out of Stock / Low Stock / Active):
${inventoryCatalog}
 
📝 ประวัติการเบิก-รับเข้าล่าสุด: 
${JSON.stringify(recentReqs)}

👥 ทำเนียบพนักงานจริงในระบบ Store FL.6 (สำหรับอ้างอิงการออกรายงานรายบุคคล และการจับคู่ชื่อภาษาไทย/รหัสพนักงาน):
${getSystemEmployeeCatalogForAi()}

⚡ กฎการดำเนินการคำสั่ง (เรียก Function Tools ทันที):
1. **เมื่อได้ยินคำสั่งเบิกสินค้า** (เช่น "ขอเบิก...", "เบิก...", "เอา...", "ใช้..."): เรียก \`prepare_stock_action\` (action: 'stock_out') ทันที แล้วพูดสั้นๆ เช่น "ส่งการ์ดยืนยันการเบิก...ให้ที่หน้าจอแล้วค่ะ คุณ${callingName}" (หรือปรับสำเนียงตามภาษาที่สนทนาอยู่)
2. **เมื่อได้ยินคำสั่งรับเข้าสินค้า** (เช่น "รับเข้า...", "เติมของ...", "ซื้อมาเพิ่ม..."): เรียก \`prepare_stock_action\` (action: 'stock_in') ทันที แล้วพูดสั้นๆ เช่น "ส่งการ์ดยืนยันการรับเข้า...ให้ที่หน้าจอแล้วค่ะ"
3. **เมื่อถามหาสินค้าหรือเช็คสต็อก** (เช่น "เช็ค...", "มี...ไหม", "ดู...", "หา..."): เรียก \`inquire_item_info\` หรือ \`check_stock\` ทันที แล้วตอบจำนวนคงเหลือสั้นๆ
4. **เมื่อถามสินค้าใกล้หมด**: เรียก \`get_low_stock_items\` ทันที แล้วตอบสั้นๆ "พบสินค้าใกล้หมด...รายการ ส่งขึ้นจอแล้วค่ะ"
5. **เมื่อถามสินค้าหมดสต็อก**: เรียก \`get_out_of_stock_items\` ทันที แล้วตอบสั้นๆ "พบสินค้าหมดสต็อก...รายการ ส่งขึ้นจอแล้วค่ะ"
6. **เมื่อถามภาพรวมคลัง**: เรียก \`get_stock_summary\` ทันที แล้วตอบสรุปสั้นๆ 1 ประโยค
7. **เมื่อสั่งออกรายงาน** (PDF/Excel): หากผู้ใช้เป็น Admin ให้เรียก \`export_report\` ทันที โดยหากเป็นรายงานรายบุคคลให้อ้างอิงพนักงานจริงในระบบเท่านั้น แล้วตอบสั้นๆ "ส่งการ์ดตรวจสอบรายงาน...ขึ้นหน้าจอให้คุณ${callingName} แล้วค่ะ โปรดตรวจชื่อผู้สั่งและกดยืนยันนะคะ" แต่หากผู้ใช้เป็น Staff ให้ตอบปฏิเสธทันทีว่าการออกรายงาน PDF ในระบบ สงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น และห้ามเรียก export_report เด็ดขาด
8. **เมื่อยืนยันทำรายการ**: ตอบสั้นๆ "บันทึกการเบิก/รับเข้า...เรียบร้อยแล้วค่ะ คุณ${callingName}"`,
          tools: [{
            functionDeclarations: [
              {
                name: "get_stock_extremes",
                description: "ค้นหาสินค้าที่มีจำนวนมากที่สุดและน้อยที่สุดในคลัง",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "get_stock_summary",
                description: "ดูข้อมูลสรุปภาพรวมของคลังสินค้า เช่น จำนวนรายการทั้งหมด หน่วยรวม หมดสต็อก ใกล้หมด",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "get_out_of_stock_items",
                description: "ดึงรายชื่อสินค้าที่จำนวนเป็น 0 หรือหมดสต็อก",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "get_low_stock_items",
                description: "ดึงรายชื่อสินค้าใกล้หมดจากเกณฑ์ความปลอดภัย",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "check_stock",
                description: "ตรวจสอบสต็อกสินค้าปัจจุบันตามคำค้นหา",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    searchTerm: { type: Type.STRING, description: "คำค้นหา เช่น ชื่อสินค้า หรือรหัสสินค้า หรือหมวดหมู่" }
                  },
                  required: ["searchTerm"]
                }
              },
              {
                name: "prepare_stock_action",
                description: "เรียกใช้นี้เมื่อผู้ใช้ต้องการ เบิก (stock_out) หรือ รับเข้า (stock_in) สินค้า ระบบจะส่งการ์ดยืนยันไปยังหน้าจอของผู้ใช้ทันที",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING, description: "ประเภทรายการ 'stock_in' หรือ 'stock_out'" },
                    itemId: { type: Type.STRING, description: "รหัสสินค้า ID (เช่น ITEM-001)" },
                    quantity: { type: Type.NUMBER, description: "จำนวนสินค้า" },
                    purpose: { type: Type.STRING, description: "งานหรือสถานที่นำไปใช้ หรือแหล่งรับเข้า" },
                    note: { type: Type.STRING, description: "หมายเหตุ หรือ ชื่อผู้ที่เบิก/รับเข้า" }
                  },
                  required: ["action", "itemId", "quantity"]
                }
              },
              {
                name: "export_report",
                description: "เรียกใช้นี้เมื่อ Admin ต้องการออกรายงานหรือดาวน์โหลดเอกสาร PDF (เฉพาะ Admin เท่านั้น): ระบบจะส่งการ์ดตรวจสอบขึ้นหน้าจอให้ผู้ใช้ตรวจชื่อผู้สั่งการและพนักงานเป้าหมายก่อนกดยืนยันออกรายงานจริง",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    format: { type: Type.STRING, description: "รูปแบบไฟล์ 'pdf' หรือ 'excel' (ค่าเริ่มต้น 'pdf')" },
                    reportType: { 
                      type: Type.STRING, 
                      description: "ประเภทรายงาน: 'individual_requisitions' (ประวัติเบิกรายบุคคล), 'requisition_history' (ประวัติเบิกรับเข้าทั้งหมด), 'inventory_all' (สต็อกทั้งหมด), 'low_stock' (สินค้าใกล้หมด/หมดสต็อก), 'purchase_orders' (ประวัติการสั่งซื้อสินค้า PO), 'executive_summary' (สรุปภาพรวมผู้บริหาร), 'category' (แยกตามหมวดหมู่)" 
                    },
                    title: { type: Type.STRING, description: "ชื่อหัวข้อรายงานภาษาไทย" },
                    userFilter: { type: Type.STRING, description: "ชื่อภาษาอังกฤษของพนักงานในระบบ หรือรหัสพนักงาน สำหรับรายงานรายบุคคล โดยต้องอ้างอิงจากทำเนียบพนักงาน Store FL.6 เท่านั้น (เช่น 'Chanayood Wongsunthon', 'Kiattisak Ninsang' หรือรหัส '1847', '1906')" },
                    categoryFilter: { type: Type.STRING, description: "ชื่อหมวดหมู่ที่ต้องการกรอง (ถ้ามี เช่น 'ไฟฟ้า', 'ประปา')" },
                    orderStatusFilter: { type: Type.STRING, description: "สถานะใบสั่งซื้อ: 'pending', 'confirmed', 'received', 'cancelled' หรือ 'all'" },
                    startDate: { type: Type.STRING, description: "วันที่เริ่มต้น รูปแบบ YYYY-MM-DD (เช่น 2026-10-01)" },
                    endDate: { type: Type.STRING, description: "วันที่สิ้นสุด รูปแบบ YYYY-MM-DD (เช่น 2026-10-31)" },
                    startTime: { type: Type.STRING, description: "เวลาเริ่มต้น เช่น 00:00 หรือ 08:30" },
                    endTime: { type: Type.STRING, description: "เวลาสิ้นสุด เช่น 23:59 หรือ 17:00" }
                  },
                  required: ["reportType"]
                }
              },
              {
                name: "inquire_item_info",
                description: "เรียกใช้นี้เมื่อผู้ใช้ถามหาข้อมูลสินค้า สต็อก ตำแหน่งที่เก็บ หรือต้องการให้แสดงข้อมูลอะไหล่บนหน้าจอ",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    searchTerm: { type: Type.STRING, description: "คำค้นหา หรือชื่อสินค้า หรือรหัสสินค้า" }
                  },
                  required: ["searchTerm"]
                }
              }
            ]
          }]
        };

        const callbacks = {
          onmessage: async (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts || [];
            let textTranscript = "";
            let audioData = "";
            for (const part of parts) {
              if (part.text) textTranscript += part.text;
              if (part.inlineData?.data) audioData = part.inlineData.data;
            }

            // Check for transcription from output / input audio transcription
            const outputTrans = (message.serverContent as any)?.outputAudioTranscription?.text;
            if (outputTrans && !textTranscript) {
              textTranscript = outputTrans;
            }

            const inputTrans = (message.serverContent as any)?.inputAudioTranscription?.text;
            if (inputTrans && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ userTranscript: inputTrans }));
            }

            if (textTranscript && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ text: textTranscript, transcript: true }));
            }

            if (audioData && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ audio: audioData }));
            }

            if (message.serverContent?.turnComplete && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }

            if (message.serverContent?.interrupted && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            if (message.toolCall) {
              const calls = message.toolCall.functionCalls || [];
              for (const fc of calls) {
                if (fc) {
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({
                      toolCall: { name: fc.name, args: fc.args, id: fc.id }
                    }));
                  }

                  let toolResult = "ดำเนินการเรียบร้อยแล้ว";
                  
                  if (fc.name === "get_stock_extremes") {
                    let sortedItems = [...sessionActiveItems].sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0));
                    
                    if (sortedItems.length === 0) {
                      toolResult = "ขณะนี้ไม่มีข้อมูลสินค้าในคลังค่ะ";
                    } else {
                      const minItem = sortedItems[0];
                      const maxItem = sortedItems[sortedItems.length - 1];
                      toolResult = `สินค้าที่มีจำนวนน้อยที่สุดคือ: ${minItem.name} (รหัส ${minItem.id}) มีจำนวน ${minItem.qty} ${minItem.unit}\n` +
                        `สินค้าที่มีจำนวนมากที่สุดคือ: ${maxItem.name} (รหัส ${maxItem.id}) มีจำนวน ${maxItem.qty} ${maxItem.unit}`;
                    }
                  } else if (fc.name === "get_stock_summary") {
                    const totalItems = sessionActiveItems.length;
                    const totalQty = sessionActiveItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
                    const outCount = sessionActiveItems.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out').length;
                    const lowCount = sessionActiveItems.filter(i => 
                      ((Number(i.qty) || 0) > 0 && (Number(i.qty) || 0) <= (Number(i.minStock) || 1)) || 
                      (i.status === 'low' && (Number(i.qty) || 0) > 0)
                    ).length;
                    
                    toolResult = `ข้อมูลสรุปภาพรวมคลังสินค้า Store FL.6 ปัจจุบัน:\n` +
                      `- มีสินค้าทั้งหมด: ${totalItems} รายการ\n` +
                      `- ปริมาณสต็อกรวมทุกรายการ: ${totalQty} หน่วย\n` +
                      `- สินค้าหมดสต็อก (ของขาด): ${outCount} รายการ\n` +
                      `- สินค้าใกล้หมด (ต่ำกว่าเกณฑ์ความปลอดภัย): ${lowCount} รายการ`;
                  } else if (fc.name === "get_out_of_stock_items") {
                    const outItems = sessionActiveItems.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out');
                    if (outItems.length === 0) {
                      toolResult = "ขณะนี้ไม่มีสินค้าหมดสต็อกในคลัง Store FL.6 ทุกรายการมีของพร้อมใช้งานค่ะ";
                    } else {
                      toolResult = `พบสินค้าหมดสต็อกทั้งหมด ${outItems.length} รายการ:\n` +
                        outItems.map((i, idx) => `${idx + 1}. ${i.name} (รหัส: ${i.id}) - ตำแหน่ง: ${i.location}`).join('\n');
                    }
                  } else if (fc.name === "get_low_stock_items") {
                    const lowItems = sessionActiveItems.filter(i => 
                      ((Number(i.qty) || 0) > 0 && (Number(i.qty) || 0) <= (Number(i.minStock) || 1)) || 
                      (i.status === 'low' && (Number(i.qty) || 0) > 0)
                    );
                    if (lowItems.length === 0) {
                      toolResult = "ขณะนี้ไม่มีสินค้าใกล้หมดสต็อก ปริมาณสินค้าทุกรายการเกินเกณฑ์ความปลอดภัยค่ะ";
                    } else {
                      toolResult = `พบสินค้าใกล้หมดสต็อก ${lowItems.length} รายการ:\n` +
                        lowItems.map((i, idx) => `${idx + 1}. ${i.name} (รหัส: ${i.id}) - คงเหลือ ${i.qty} ${i.unit} (เกณฑ์ขั้นต่ำ ${i.minStock} ${i.unit})`).join('\n');
                    }
                  } else if (fc.name === "prepare_stock_action") {
                    const { action, itemId, quantity } = (fc.args as any) || {};
                    const qtyNum = Math.max(1, Number(quantity) || 1);
                    const isStockIn = action === 'stock_in';

                    sessionActiveItems = sessionActiveItems.map(item => {
                      if (item.id === itemId || 
                          item.name.toLowerCase() === (itemId || '').toLowerCase() || 
                          item.name.toLowerCase().includes((itemId || '').toLowerCase())) {
                        const prevQty = Number(item.qty) || 0;
                        const newQty = isStockIn ? prevQty + qtyNum : Math.max(0, prevQty - qtyNum);
                        let newStatus = 'normal';
                        if (newQty <= 0) newStatus = 'out';
                        else if (newQty <= (Number(item.minStock) || 1)) newStatus = 'low';
                        return { ...item, qty: newQty, status: newStatus as any };
                      }
                      return item;
                    });

                    toolResult = "ส่งการ์ดยืนยันรายการไปยังหน้าจอของผู้ใช้เรียบร้อยแล้ว แจ้งให้ผู้ใช้ตรวจสอบและกดยืนยัน";
                  } else if (fc.name === "export_report") {
                    if (userRole !== 'admin') {
                      toolResult = "ขออภัยด้วยนะคะ การออกรายงาน PDF ในระบบ สงวนสิทธิ์สำหรับผู้ดูแลระบบ (Admin) เท่านั้นค่ะ";
                    } else {
                      const format = (fc.args?.format as string || "pdf").toUpperCase();
                      const reportType = fc.args?.reportType as string || 'inventory_all';
                      const userFilter = fc.args?.userFilter as string || '';
                      const matchedEmp = findEmployeeInSystem(userFilter);
                      const targetLabel = matchedEmp 
                        ? `คุณ${matchedEmp.name} (${matchedEmp.nickname}) [รหัส: ${matchedEmp.id}]` 
                        : (userFilter ? `คุณ${userFilter}` : 'ภาพรวม');
                      toolResult = `สร้างและส่งการ์ดตรวจสอบรายงาน ${format} ของพนักงาน ${targetLabel} ส่งไปยังหน้าจอเรียบร้อยแล้วค่ะ โปรดตรวจสอบข้อมูลและกดยืนยันเพื่อดาวน์โหลดนะคะ`;
                    }
                  } else if (fc.name === "inquire_item_info" || fc.name === "check_stock") {
                    const searchTerm = (fc.args?.searchTerm as string || "").toLowerCase().trim();
                    let matchingItems = sessionActiveItems;
                    if (searchTerm) {
                      const tokens = searchTerm.split(/\s+/).filter(t => t.length > 0);
                      matchingItems = sessionActiveItems.filter(i => {
                        const n = (i.name || "").toLowerCase();
                        const id = (i.id || "").toLowerCase();
                        const c = (i.category || "").toLowerCase();
                        return tokens.every(t => n.includes(t) || id.includes(t) || c.includes(t));
                      });
                    }
                    
                    let resultText = "";
                    if (matchingItems.length > 0) {
                      resultText = `พบข้อมูลสินค้าตรงกัน ${matchingItems.length} รายการ (ส่งการ์ดขึ้นจอเรียบร้อยแล้ว):\n` + 
                        matchingItems.slice(0, 3).map((i, idx) => {
                          const qty = Number(i.qty) || 0;
                          const minStock = Number(i.minStock) || 1;
                          const isOut = qty <= 0 || i.status === 'out';
                          const isLow = !isOut && (qty <= minStock || i.status === 'low');
                          const statusStr = isOut 
                            ? `⛔ หมดสต็อก (เหลือ 0 ${i.unit})` 
                            : isLow 
                            ? `⚠️ ใกล้หมดสต็อก (เหลือ ${qty} ${i.unit} จากขั้นต่ำ ${minStock})` 
                            : `✅ พร้อมใช้ (${qty} ${i.unit})`;
                          return `${idx + 1}. ${i.name} (รหัส: ${i.id}) - คงเหลือ: ${qty} ${i.unit} [${statusStr}] ที่เก็บ: ${i.location}`;
                        }).join('\n');
                    } else {
                      resultText = `ไม่พบสินค้าหรืออะไหล่ที่ตรงกับคำค้นหา "${searchTerm}" ในระบบคลังสินค้า Store FL.6`;
                    }
                    
                    toolResult = resultText;
                  }

                  const liveTarget = activeLiveSession;
                  if (liveTarget) {
                    try {
                      liveTarget.sendToolResponse({
                        functionResponses: [{
                          id: fc.id,
                          name: fc.name,
                          response: { result: toolResult }
                        }]
                      });
                    } catch (e) {
                      console.error("Tool response error", e);
                    }
                  } else if (sessionPromise) {
                    sessionPromise.then((s: any) => {
                      try {
                        s.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {}
                    }).catch(() => {});
                  }
                }
              }
            }
          },
        };

        // Model Priority: gemini-3.8-live (high intelligence, ultra-fast low latency) with gemini-3.1-flash-live-preview fallback
        const liveModelsToTry = [
          "gemini-3.8-live",
          "gemini-3.1-flash-live-preview"
        ];

        let session: any = null;
        let lastLiveError: any = null;
        let connectedModel = "";

        for (const candidateModel of liveModelsToTry) {
          try {
            console.log(`[Gemini Live] Connecting with model: ${candidateModel}...`);
            const p = getAI().live.connect({
              model: candidateModel,
              config,
              callbacks,
            });
            sessionPromise = p;
            session = await p;
            connectedModel = candidateModel;
            console.log(`[Gemini Live] Successfully connected with: ${connectedModel}`);
            break;
          } catch (modelErr: any) {
            console.warn(`[Gemini Live] Model ${candidateModel} failed, trying next candidate:`, modelErr?.message || modelErr);
            lastLiveError = modelErr;
            sessionPromise = null;
          }
        }

        if (!session) {
          throw lastLiveError || new Error("All Gemini Live models failed to connect.");
        }

        activeLiveSession = session;
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({ ready: true, model: connectedModel }));
        }

        // Flush any pending audio/text received during connect handshake
        while (pendingInputQueue.length > 0) {
          const item = pendingInputQueue.shift();
          if (item?.type === 'audio') {
            activeLiveSession.sendRealtimeInput({
              audio: { data: item.data, mimeType: "audio/pcm;rate=16000" },
            });
          } else if (item?.type === 'text') {
            activeLiveSession.sendClientContent({ turns: [{ role: "user", parts: [{ text: item.data }] }] });
          }
        }
      } catch (err) {
        console.error("Live API setup failed:", err);
        clientWs.close();
      }
    };

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const defaultUserName = url.searchParams.get('userName') || 'ผู้ใช้งาน';
    const defaultUserRole = url.searchParams.get('userRole') || 'user';
    const defaultUserNickname = url.searchParams.get('userNickname') || '';

    // Wait up to 250ms for client's 'init' message with full client state, or fallback to query params
    const initTimer = setTimeout(() => {
      if (!isInitialized) {
        setupLiveSession(defaultUserName, defaultUserRole, cachedItems, [], defaultUserNickname);
      }
    }, 250);

    clientWs.on("message", async (data) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.type === "init") {
          clearTimeout(initTimer);
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            sessionActiveItems = parsed.items;
          }
          if (!isInitialized) {
            setupLiveSession(
              parsed.userName || defaultUserName,
              parsed.userRole || defaultUserRole,
              parsed.items?.length ? parsed.items : cachedItems,
              parsed.requisitions || [],
              parsed.userNickname || defaultUserNickname
            );
          }
          return;
        }

        if (parsed.type === "sync_inventory" && Array.isArray(parsed.items)) {
          sessionActiveItems = parsed.items;
          return;
        }

        if (parsed.audio) {
          if (activeLiveSession) {
            activeLiveSession.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          } else {
            if (pendingInputQueue.length < 20) {
              pendingInputQueue.push({ type: 'audio', data: parsed.audio });
            }
          }
        } else if (parsed.text) {
          if (activeLiveSession) {
            activeLiveSession.sendClientContent({ turns: [{ role: "user", parts: [{ text: parsed.text }] }] });
          } else {
            pendingInputQueue.push({ type: 'text', data: parsed.text });
          }
        }
      } catch (e) {
        console.error("Error processing websocket message:", e);
      }
    });

    clientWs.on("close", async () => {
      try {
        if (activeLiveSession) {
          activeLiveSession.close();
          activeLiveSession = null;
        } else if (sessionPromise) {
          const session = await sessionPromise;
          session.close();
        }
      } catch (e) { }
    });
  });

  // Pre-warm inventory cache immediately on startup (safe background task)
  fetchInventoryFromSheet().catch((err) => {
    console.warn("Initial inventory warm-up notice:", err?.message || err);
  });

  server.on("error", (err: any) => {
    console.error("HTTP Server error:", err?.message || err);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ENG SMART STORE Server running on http://0.0.0.0:${PORT} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });

  // Graceful shutdown on Cloud Run revision shifts & container rollout
  const handleShutdown = (signal: string) => {
    console.log(`${signal} received, closing server connections cleanly...`);
    try {
      wss.clients.forEach((client) => {
        try { client.terminate(); } catch (e) {}
      });
    } catch (e) {}

    const forceExitTimer = setTimeout(() => {
      console.log("Forced exit after shutdown timeout");
      process.exit(0);
    }, 2000);
    forceExitTimer.unref();

    server.close(() => {
      clearTimeout(forceExitTimer);
      console.log("Server closed cleanly");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

// Global safety catchers to prevent container crash on transient network errors
process.on("uncaughtException", (err) => {
  console.error("Uncaught server exception (handled):", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection (handled):", reason);
});

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
