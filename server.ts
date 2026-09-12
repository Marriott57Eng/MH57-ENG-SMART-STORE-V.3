import express from "express";
import path from "path";
import { GoogleGenAI, LiveServerMessage, Modality, Type, ThinkingLevel } from "@google/genai";
import fs from "fs";
import { WebSocketServer } from "ws";
import http from "http";
import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  pushLineMessage, 
  createStockFlexMessage, 
  createAuthFlexMessage, 
  createTestFlexMessage, 
  getServerLineConfig, 
  updateServerLineConfig 
} from './server/lineService';

let ai: GoogleGenAI;
function getAI(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
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
  const PORT = 3000;

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
  }

  // API: Get LINE Notification Config
  app.get("/api/line/config", async (req, res) => {
    try {
      const config = getServerLineConfig();
      // Mask token for security when sending to frontend
      const maskedToken = config.channelAccessToken 
        ? `${config.channelAccessToken.slice(0, 8)}...${config.channelAccessToken.slice(-6)}` 
        : '';
      res.json({
        ...config,
        hasToken: !!config.channelAccessToken,
        maskedToken,
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

      const newConfig = updateServerLineConfig({
        ...updated,
        channelAccessToken: token,
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
      const { channelAccessToken, destinationId } = req.body;
      const currentConfig = getServerLineConfig();
      const token = (channelAccessToken && !channelAccessToken.includes('...')) 
        ? channelAccessToken 
        : currentConfig.channelAccessToken;
      const dest = destinationId || currentConfig.destinationId;

      if (!token) {
        return res.status(400).json({ success: false, error: 'กรุณากรอก LINE Channel Access Token' });
      }
      if (!dest) {
        return res.status(400).json({ success: false, error: 'กรุณากรอก LINE Destination ID (User ID หรือ Group ID)' });
      }

      const testMessage = createTestFlexMessage();
      const result = await pushLineMessage([testMessage], token, dest);

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      res.json({ success: true, message: 'ส่งข้อความทดสอบไปยัง LINE สำเร็จเรียบร้อยแล้ว!' });
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
      } else if (type === 'login' || type === 'logout') {
        const isLogin = type === 'login';
        if (isLogin && !config.notifyLogin) {
          return res.json({ success: false, skipped: true, reason: 'Login notification disabled' });
        }
        if (!isLogin && !config.notifyLogout) {
          return res.json({ success: false, skipped: true, reason: 'Logout notification disabled' });
        }
        flexMessage = createAuthFlexMessage(data);
      }

      if (!flexMessage) {
        return res.status(400).json({ success: false, error: 'Invalid notification type' });
      }

      const result = await pushLineMessage([flexMessage]);
      if (!result.success) {
        return res.json({ success: false, skipped: result.skipped ?? false, error: result.error });
      }

      res.json({ success: true, message: 'LINE notification sent successfully' });
    } catch (error: any) {
      console.warn("LINE notify endpoint exception:", error?.message || error);
      res.json({ success: false, error: error?.message || 'Failed to process notification' });
    }
  });

  // API: Analyze with Antigravity Agent (antigravity-preview-05-2026)
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

      const deepAnalysisInstruction = `คุณคือ Antigravity Executive Supply Chain & Inventory Analyst ผู้เชี่ยวชาญระดับสูงด้านการวิเคราะห์คลังสินค้า Store FL.6 ของ ENG Smart Store

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
        // Run deep reasoning analysis with Antigravity Agent
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
        console.warn("Antigravity agent fallback to generative model:", agentError.message);
        // Seamless fallback to high-intelligence reasoning model
        const fallbackRes = await getAI().models.generateContent({
          model: "gemini-3.7-flash",
          contents: `${deepAnalysisInstruction}\n\n${prompt || 'วิเคราะห์สถานะคลังสินค้าแบบเจาะลึก'}\n\n${summaryText}`,
          config: {
            systemInstruction: "คุณคือ Antigravity Executive Supply Chain & Inventory Analyst ผู้เชี่ยวชาญการวิเคราะห์คลังสินค้า Store FL.6 ให้รายงานเชิงลึก มีการเว้นวรรค ใช้สัญลักษณ์สวยงาม น่าอ่าน และแม่นยำ"
          }
        });
        analysisResult = fallbackRes.text || '';
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
      const { prompt, history, isVoice, items: clientItems, requisitions: clientRequisitions, currentUser } = req.body;
      
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
  - หากผู้ใช้สั่งให้แก้สต็อกโดยตรง ให้ตอบปฏิเสธอย่างสุภาพและเป็นมิตร เช่น:
    "ขออภัยด้วยนะคะคุณ${callingName} 🥺 ผู้ใช้งานระดับ **Staff** จะยังไม่สามารถแก้ไขจำนวนสต็อกโดยตรงหรือเปลี่ยนชื่ออะไหล่ได้ค่ะ (สิทธิ์สำหรับ **Admin** เท่านั้นนะคะ ✨)
    
    👉 แต่คุณ${callingName}สามารถสั่ง **เบิกสินค้า** หรือ **รับเข้า/เติมสต็อก** ได้ตามปกติเลยค่ะ ยินดีช่วยเหลือเสมอนะคะ! 📦🚀"
- ✅ **สิ่งที่ Staff/User ทำได้ 100%**:
  - สั่งเบิกสินค้า (\`requisition\`)
  - สั่งรับเข้า/เติมสต็อก (\`stock_in\`)
  - ขอออกรายงาน PDF / Excel (\`export_reports\`)
` : `
- 👑 **สิทธิ์ Admin**: สามารถดำเนินการได้ทุกคำสั่ง ทั้งเบิกสินค้า, รับเข้าสินค้า, แก้ไขยอดสต็อกโดยตรง, เปลี่ยนชื่อสินค้า, และออกรายงาน
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

📄 หากผู้ใช้ต้องการรายงาน (PDF/Excel):
\`\`\`json:action
{"action": "export_reports", "reports": [{"type": "inventory_all"|"requisition_history"|"low_stock"|"category", "format": "pdf"|"excel", "title": "ชื่อรายงาน", "categoryFilter": "หมวดหมู่ถ้ามี", "userFilter": "ชื่อบุคคล (ถ้ามีคนเจาะจงขอประวัติของคนนั้น)"}]}
\`\`\`

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
        // Disable reasoning latency for Flash Lite models to achieve instant sub-second TTFT (~300-400ms)
        if (modelName.includes('flash-lite')) {
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

        // Responsive TTFT timeout (7s) to prevent long freezes on congested models
        const ttftTimeout = setTimeout(() => {
          if (!hasSentChunks) {
            isTimedOut = true;
            modelAbortController.abort(new Error(`Timeout waiting for TTFT on ${modelName}`));
          }
        }, 7000);

        let chunkInactivityTimeout: NodeJS.Timeout | null = null;
        const resetChunkTimeout = () => {
          if (chunkInactivityTimeout) clearTimeout(chunkInactivityTimeout);
          chunkInactivityTimeout = setTimeout(() => {
            console.warn(`[API CHAT] Inter-chunk inactivity timeout on ${modelName}`);
            modelAbortController.abort(new Error(`Inter-chunk timeout on ${modelName}`));
          }, 8000);
        };

        let localRawText = "";
        try {
          config.abortSignal = modelAbortController.signal;
          const stream = await getAI().models.generateContentStream({
            model: modelName,
            contents,
            config,
          });
          
          for await (const chunk of stream) {
            clearTimeout(ttftTimeout);
            resetChunkTimeout();
            if (isClientAborted || clientAbortController.signal.aborted || res.destroyed || res.writableEnded) break;
            if (chunk.text) {
              hasSentChunks = true;
              localRawText += chunk.text;
              if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
              }
            }
          }
          if (chunkInactivityTimeout) clearTimeout(chunkInactivityTimeout);
          return localRawText;
        } catch (err: any) {
          if (chunkInactivityTimeout) clearTimeout(chunkInactivityTimeout);
          // If we already sent substantial text to the client and stream stalled, return what we have cleanly
          if (hasSentChunks && (err?.name === 'AbortError' || (err?.message && err.message.includes('Inter-chunk')))) {
            console.warn(`[API CHAT] Rescuing completed chunks on stream pause for ${modelName}`);
            return localRawText || "";
          }
          if (isTimedOut) {
            const timeoutErr = new Error(`Timeout waiting for TTFT on ${modelName}`);
            (timeoutErr as any).isTimeout = true;
            throw timeoutErr;
          }
          throw err;
        } finally {
          clearTimeout(ttftTimeout);
          if (chunkInactivityTimeout) clearTimeout(chunkInactivityTimeout);
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
              console.warn(`[API CHAT] Model ${currentModel} reached TTFT timeout, switching to next model...`);
            } else {
              console.warn(`[API CHAT] Model ${currentModel} error (attempt ${i + 1}/${models.length}):`, err?.message || err);
            }
            
            // If chunks have already started streaming to the client, we cannot cleanly switch models mid-stream
            if (hasSentChunks) {
              throw err;
            }

            // If there are more fallback models available, try the next model immediately
            if (i < models.length - 1) {
              await new Promise(r => setTimeout(r, 100));
              continue;
            } else {
              // All models exhausted
              const is429 = err.status === 429 || err.status === 'RESOURCE_EXHAUSTED' || (err.message && err.message.includes('429')) || err.code === 429;
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
        // Primary model: Gemini 3.5 Flash Lite with ThinkingLevel.MINIMAL for ultra-fast streaming (~500ms), followed by resilient fallbacks
        const fallbackModels = [
           'gemini-3.5-flash-lite',
           'gemini-3.1-flash-lite',
           'gemini-flash-lite-latest',
           'gemini-3.8-flash'
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
      
      // If AI generated export_reports JSON
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
          if (isReportRequestStr.includes('เบิก') || isReportRequestStr.includes('requisition') || isReportRequestStr.includes('รับเข้า')) {
            fileReports = [{ format, type: 'requisition_history', title: 'รายงานประวัติการเบิก / รับเข้าสินค้า (Store FL.6)' }];
          } else if (isReportRequestStr.includes('ใกล้หมด') || isReportRequestStr.includes('หมดสต็อก') || isReportRequestStr.includes('หมดสต็อค') || isReportRequestStr.includes('สั่งซื้อ') || isReportRequestStr.includes('low') || isReportRequestStr.includes('out')) {
            fileReports = [{ format, type: 'low_stock', title: 'รายงานสินค้าใกล้หมด / หมดสต็อก' }];
          } else {
            fileReports = [{ format, type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)' }];
          }
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

      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        dbAction, 
        fileReport: fileReports?.[0], 
        fileReports: fileReports,
        suggestedItems: itemCards
      })}\n\n`);
      res.end();
      
    } catch (error: any) {
      if (isClientAborted || clientAbortController.signal.aborted || res.destroyed || res.writableEnded || error?.name === 'AbortError' || (error?.message && (error.message.includes('aborted') || error.message.includes('canceled')))) {
        return;
      }
      console.error("SERVER /api/chat ERROR:", error);
      if (error.message === 'QUOTA_EXCEEDED') {
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
      server: { middlewareMode: true },
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

        const adminInstruction = userRole === 'admin' 
          ? "อนุญาตให้ใช้เครื่องมือปรับสต็อกได้" 
          : "ผู้ใช้ท่านนี้ไม่มีสิทธิ์แก้ไขสต็อก(update_stock) หรือแก้ไขชื่อสินค้า หากผู้ใช้สั่งแก้ไขให้ตอบปฏิเสธอย่างสุภาพ อนุญาตเฉพาะการ รับเข้า (stock_in) และ เบิก (stock_out) เท่านั้น";

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

🎯 ขอบเขตการสนทนาและความรู้ (Conversational Scope & External Knowledge):
1. **การคุยเรื่องทั่วไป ฟุตบอล กีฬา ข่าวสาร และความรู้เชิงช่าง**: คุณเป็น AI ที่มีความรอบรู้สูง สามารถพูดคุยเรื่องทั่วไป ตอบผลฟุตบอล โปรแกรมการแข่งขัน ข่าวด่วน สภาพอากาศ และให้ความรู้เชิงช่างได้อย่างเป็นกันเอง
2. **การตอบคำถามทั่วไป/กีฬา/ภายนอก**:
   - สามารถสนทนาตอบคำถามทั่วไปได้อย่างสุภาพ กระชับ และเป็นกันเอง

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

⚡ กฎการดำเนินการคำสั่ง (เรียก Function Tools ทันที):
1. **เมื่อได้ยินคำสั่งเบิกสินค้า** (เช่น "ขอเบิก...", "เบิก...", "เอา...", "ใช้..."): เรียก \`prepare_stock_action\` (action: 'stock_out') ทันที แล้วพูดสั้นๆ เช่น "ส่งการ์ดยืนยันการเบิก...ให้ที่หน้าจอแล้วค่ะ คุณ${callingName}" (หรือปรับสำเนียงตามภาษาที่สนทนาอยู่)
2. **เมื่อได้ยินคำสั่งรับเข้าสินค้า** (เช่น "รับเข้า...", "เติมของ...", "ซื้อมาเพิ่ม..."): เรียก \`prepare_stock_action\` (action: 'stock_in') ทันที แล้วพูดสั้นๆ เช่น "ส่งการ์ดยืนยันการรับเข้า...ให้ที่หน้าจอแล้วค่ะ"
3. **เมื่อถามหาสินค้าหรือเช็คสต็อก** (เช่น "เช็ค...", "มี...ไหม", "ดู...", "หา..."): เรียก \`inquire_item_info\` หรือ \`check_stock\` ทันที แล้วตอบจำนวนคงเหลือสั้นๆ
4. **เมื่อถามสินค้าใกล้หมด**: เรียก \`get_low_stock_items\` ทันที แล้วตอบสั้นๆ "พบสินค้าใกล้หมด...รายการ ส่งขึ้นจอแล้วค่ะ"
5. **เมื่อถามสินค้าหมดสต็อก**: เรียก \`get_out_of_stock_items\` ทันที แล้วตอบสั้นๆ "พบสินค้าหมดสต็อก...รายการ ส่งขึ้นจอแล้วค่ะ"
6. **เมื่อถามภาพรวมคลัง**: เรียก \`get_stock_summary\` ทันที แล้วตอบสรุปสั้นๆ 1 ประโยค
7. **เมื่อสั่งออกรายงาน** (PDF/Excel): เรียก \`export_report\` ทันที แล้วตอบสั้นๆ "ออกรายงานเรียบร้อยแล้วค่ะ"
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
                description: "เรียกใช้นี้เมื่อผู้ใช้ต้องการออกรายงานหรือดาวน์โหลดเอกสาร PDF หรือ Excel เช่น สต็อกทั้งหมด, สินค้าใกล้หมด, ประวัติการเบิกรับเข้า, หรือรายงานแยกตามหมวดหมู่",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    format: { type: Type.STRING, description: "รูปแบบไฟล์ 'pdf' หรือ 'excel'" },
                    reportType: { type: Type.STRING, description: "ประเภทรายงาน: 'inventory_all' (สต็อกทั้งหมด), 'low_stock' (สินค้าใกล้หมด/หมดสต็อก), 'requisition_history' (ประวัติการเบิก/รับเข้า), 'category' (แยกตามหมวดหมู่)" },
                    title: { type: Type.STRING, description: "ชื่อหัวข้อรายงานภาษาไทย" },
                    categoryFilter: { type: Type.STRING, description: "ชื่อหมวดหมู่ที่ต้องการกรอง (ถ้ามี เช่น 'ไฟฟ้า', 'ประปา')" }
                  },
                  required: ["format", "reportType"]
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
                    const format = (fc.args?.format as string || "pdf").toLowerCase();
                    toolResult = `สร้างการ์ดดาวน์โหลดรายงาน ${format.toUpperCase()} ส่งไปยังหน้าจอเรียบร้อยแล้วค่ะ`;
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

        sessionPromise = getAI().live.connect({
          model: "gemini-3.1-flash-live-preview",
          config,
          callbacks,
        });

        const session = await sessionPromise;
        activeLiveSession = session;
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({ ready: true }));
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
