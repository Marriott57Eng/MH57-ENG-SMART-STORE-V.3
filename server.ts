import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import fs from "fs";
import { WebSocketServer } from "ws";
import http from "http";
import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, collection, doc, setDoc } from 'firebase/firestore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let firebaseConfig: any = { projectId: "", firestoreDatabaseId: "(default)" };
try {
  if (fs.existsSync('firebase-applet-config.json')) {
    firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  }
} catch (err) {
  console.warn("Could not load firebase-applet-config.json");
}

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);



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

      await setDoc(doc(firestoreDb, 'inventory', targetItem.id), targetItem);
      cacheTimestamp = 0; // force refresh cache

      res.json({ success: true, item: targetItem });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        const interaction = await ai.interactions.create({
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
        const fallbackRes = await ai.models.generateContent({
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
    try {
      const { prompt, history, isVoice, items: clientItems, requisitions: clientRequisitions, currentUser } = req.body;
      
      let items: Item[] = Array.isArray(clientItems) && clientItems.length > 0
        ? clientItems
        : await fetchInventoryFromSheet();

      // Improved RAG: Smart context filtering for Thai Language
      const pLower = prompt.toLowerCase();
      // 1. Remove common action/stop words to isolate nouns
      const cleanPrompt = pLower.replace(/(เบิก|ขอ|เพิ่ม|รับเข้า|ค้นหา|มี|ไหม|สต็อก|จำนวน|ช่วย|หน่อย|อัปเดต|เอา|สินค้า|กี่|แผ่น|ชิ้น|อัน|หลอด|ม้วน|แกลลอน|กล่อง|ตัว)/g, '');
      const searchTerms = pLower.split(/\s+/).filter((t: string) => t.length > 1);
      
      // 2. Improved Context Feeding for AI Search
      let matchedItems = [];
      const isSummaryRequest = pLower.includes('สรุป') || pLower.includes('ใกล้หมด') || pLower.includes('สั่งซื้อ') || pLower.includes('วิเคราะห์') || pLower.includes('ภาพรวม');
      
      if (isSummaryRequest) {
          // Only pass items that need attention (low or out of stock) + some random for context
          matchedItems = items.filter(i => i.status === 'low' || i.status === 'out');
          if (matchedItems.length < 5) matchedItems = [...matchedItems, ...items.filter(i => i.status !== 'low' && i.status !== 'out').slice(0, 10)];
      } else {
          // Pass more items to AI to let it find the right item. Since Gemini context window is huge, we can afford passing ~100 items.
          const filtered = items.filter(item => {
              const itemNameLower = item.name.toLowerCase();
              const nameInPrompt = pLower.includes(itemNameLower) || cleanPrompt.includes(itemNameLower);
              const idInPrompt = pLower.includes(item.id.toLowerCase());
              const catInPrompt = pLower.includes(item.category.toLowerCase());
              const termInItem = searchTerms.some((term: string) => 
                  itemNameLower.includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              );
              return nameInPrompt || idInPrompt || catInPrompt || termInItem;
          });
          
          // If we find direct matches, prioritize them, but also include a chunk of other items so AI doesn't miss out due to slight misspellings
          if (filtered.length > 0) {
              matchedItems = [...new Set([...filtered, ...items])].slice(0, 500);
          } else {
              matchedItems = items.slice(0, 500); // fallback to first 100 items
          }
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const compactInventory = matchedItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        qty: item.qty,
        unit: item.unit,
        minStock: item.minStock,
        loc: item.location,
        status: item.status,
      }));

      const recentReqs = Array.isArray(clientRequisitions) ? clientRequisitions.slice(0, 5).map(r => ({
        type: r.type || 'out',
        item: r.itemName,
        qty: r.qty,
        user: r.requestedBy
      })) : [];

      const userRole = (currentUser?.role || 'user').toLowerCase();
      const isAdminUser = userRole === 'admin';

      const systemInstruction = `คุณคือ AI ผู้ช่วยจัดการคลังสินค้าอัจฉริยะ Store FL.6 ของอาคาร/องค์กร (ENG Smart Store AI)

🌟 บุคลิกภาพและสไตล์การตอบสนอง (Personality & Tone of Voice):
1. **มีชีวิตชีวาและเปี่ยมด้วยความใส่ใจ (Warm, Lively & Enthusiastic)**: ตอบด้วยความกระตือรือร้น สุภาพ จริงใจ ให้ความมั่นใจ และพร้อมช่วยเหลือทีมช่างและพนักงานเสมอ
2. **มี Emoji ประกอบ (Expressive with Emojis)**: ใช้ Emoji ที่เหมาะสม (เช่น ✨, 📦, 🔍, 📍, 🏷️, 📊, 🚨, ⚠️, ✅, 💡, 🚀, 🛠️, 📋, 📌) กำกับหัวข้อและจุดสำคัญ เพื่อความสดใสและอ่านง่าย
3. **จัดลำดับและเว้นวรรคให้โปร่งตา (Clear Spacing & Ordered Structure)**: 
   - **ห้าม** เขียนข้อความเป็นก้อนยาวติดกันเด็ดขาด
   - เว้นบรรทัดระหว่างย่อหน้าและหัวข้อ (Double Line Breaks)
   - จัดลำดับข้อมูลอย่างเป็นขั้นเป็นตอน ใช้ตัวเลขลำดับ (1., 2., 3.) หรือ Bullet Points (- ) เมื่อแสดงรายการสินค้า ขั้นตอน หรือข้อเสนอแนะ
4. **เน้นคำสำคัญ (Highlight Key Terms with Bold Markdown)**: 
   - ใช้เครื่องหมาย \`**...**\` เน้นคำสำคัญทุกครั้ง เช่น **ชื่อสินค้า/อะไหล่**, **รหัสสินค้า**, **จำนวนและหน่วย**, **สถานที่จัดเก็บ**, **สถานะสต็อก**, **ผู้ทำรายการ**, และ **สถานที่/งานที่นำไปใช้**

👤 ข้อมูลผู้ใช้งานปัจจุบัน:
- ผู้ใช้งาน: **${currentUser?.name || 'ผู้ใช้งาน'}** (Username: \`${currentUser?.username || 'unknown'}\`, Role: **${userRole.toUpperCase()}**)

🛡️ กฎการตรวจสอบสิทธิ์ความปลอดภัย (RBAC Permission Rules):
- สิทธิ์ปัจจุบัน: **"${isAdminUser ? '👑 Admin (ผู้ดูแลระบบ)' : '👤 Staff / User (ผู้ใช้ทั่วไป)'}"**
${!isAdminUser ? `
- ⛔ **ข้อห้ามสำหรับ Staff/User**: 
  - ห้ามแก้ไขตัวเลขสต็อกโดยตรง หรือเปลี่ยนชื่ออะไหล่ (\`update_stock\` หรือ \`edit_item\`)
  - หากผู้ใช้สั่งให้แก้สต็อกโดยตรง ให้ตอบปฏิเสธอย่างสุภาพและเป็นมิตร เช่น:
    "ขออภัยด้วยนะคะ 🥺 ผู้ใช้งานระดับ **Staff** จะยังไม่สามารถแก้ไขจำนวนสต็อกโดยตรงหรือเปลี่ยนชื่ออะไหล่ได้ค่ะ (สิทธิ์สำหรับ **Admin** เท่านั้นนะคะ ✨)
    
    👉 แต่คุณสามารถสั่ง **เบิกสินค้า** หรือ **รับเข้า/เติมสต็อก** ได้ตามปกติเลยค่ะ ยินดีช่วยเหลือเสมอนะคะ! 📦🚀"
- ✅ **สิ่งที่ Staff/User ทำได้ 100%**:
  - สั่งเบิกสินค้า (\`requisition\`)
  - สั่งรับเข้า/เติมสต็อก (\`stock_in\`)
  - ขอออกรายงาน PDF / Excel (\`export_reports\`)
` : `
- 👑 **สิทธิ์ Admin**: สามารถดำเนินการได้ทุกคำสั่ง ทั้งเบิกสินค้า, รับเข้าสินค้า, แก้ไขยอดสต็อกโดยตรง, เปลี่ยนชื่อสินค้า, และออกรายงาน
`}

📋 กฎการสกัดข้อมูลการเบิก/รับเข้าสินค้า:
1. **ผู้ทำรายการ (\`requestedBy\`)**: หากไม่ได้ระบุชื่อผู้อื่น ให้ใช้ชื่อผู้ใช้งานปัจจุบัน (**${currentUser?.name || 'ผู้ใช้งาน'}**) อัตโนมัติ
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
  "requestedBy": "${currentUser?.name || 'ชื่อผู้ทำรายการ'}",
  "purpose": "สถานที่/งานที่นำไปใช้งาน หรือแหล่งที่มารับเข้า",
  "note": "หมายเหตุเพิ่มเติมถ้ามี"
}
\`\`\`

📄 หากผู้ใช้ต้องการรายงาน (PDF/Excel):
\`\`\`json:action
{"action": "export_reports", "reports": [{"type": "inventory_all"|"requisition_history"|"low_stock"|"category", "format": "pdf"|"excel", "title": "ชื่อรายงาน", "categoryFilter": "หมวดหมู่ถ้ามี"}]}
\`\`\`

ตัวอย่างรูปแบบการตอบที่ดี (เน้นเว้นวรรค เรียงลำดับ อิโมจิ และเน้นตัวหนา):
"สวัสดีค่ะคุณ **${currentUser?.name || 'ช่าง'}**! ✨ ยินดีให้บริการค่ะ 

ตรวจเช็กรายการอะไหล่ใน **Store FL.6** ให้เรียบร้อยแล้วนะคะ 🔍📦

1. **สาย THW 1x1.5 สีแดง** (รหัส: \`A000000001\`)
   - 📍 ที่เก็บ: **Store FL.6 ตู้ A1**
   - 📊 คงเหลือ: **9 ม้วน** [สถานะ: **ปกติ**]

2. **เทปพันสายไฟ 3M** (รหัส: \`A000000031\`)
   - 📍 ที่เก็บ: **Store FL.6 ชั้นวาง B2**
   - 📊 คงเหลือ: **15 ม้วน** [สถานะ: **ปกติ**]

💡 ได้จัดเตรียมรายการเบิกให้เรียบร้อยแล้วค่ะ สามารถตรวจสอบและแตะยืนยันที่การ์ดด้านล่างได้เลยนะคะ 🚀"

ข้อมูลสินค้าในคลังปัจจุบัน: ${JSON.stringify(compactInventory)}`;
      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const h of history.slice(-4)) {
          contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let rawResponseText = "";
      
      let hasSentChunks = false;
      const tryGenerate = async (modelName) => {
        const stream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: { systemInstruction, temperature: 0.2 },
        });
        
        let localRawText = "";
        for await (const chunk of stream) {
          if (chunk.text) {
            hasSentChunks = true;
            localRawText += chunk.text;
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk.text })}\n\n`);
          }
        }
        return localRawText;
      };

      const generateWithFallback = async (models: string[]) => {
        let lastErr = null;
        for (let i = 0; i < models.length; i++) {
          const currentModel = models[i];
          try {
            return await tryGenerate(currentModel);
          } catch (err: any) {
            lastErr = err;
            const is503 = err.status === 503 || err.status === 'UNAVAILABLE' || (err.message && err.message.includes('503')) || err.code === 503;
            const is429 = err.status === 429 || err.status === 'RESOURCE_EXHAUSTED' || (err.message && err.message.includes('429')) || err.code === 429;
            const is404 = err.status === 404 || err.status === 'NOT_FOUND' || (err.message && err.message.includes('404')) || err.code === 404;
            
            if ((is503 || is429 || is404) && !hasSentChunks) {
              if (i < models.length - 1) {
                 const delayMs = 500 + Math.random() * 500;
                 await new Promise(r => setTimeout(r, delayMs));
                 continue; // try next model
              } else {
                 if (is429) {
                     const quotaError = new Error("QUOTA_EXCEEDED");
                     (quotaError as any).status = 429;
                     throw quotaError;
                 }
                 throw err;
              }
            } else {
              throw err;
            }
          }
        }
        throw lastErr;
      };

      try {
        // Primary model: Flash Lite (3.5 Flash Lite / 3.1 Flash Lite) for maximum speed and lowest latency
        const fallbackModels = [
           'gemini-3.5-flash-lite',
           'gemini-3.1-flash-lite',
           'gemini-flash-lite-latest',
           'gemini-3.1-flash-live-preview',
           'gemini-flash-latest',
           'gemini-3.7-flash'
        ];
        rawResponseText = await generateWithFallback(fallbackModels);
      } catch (err: any) {
        throw err;
      }

      // Parse JSON action
      let dbAction: any = undefined;
      const actionMatch = rawResponseText.match(/\`\`\`(?:json:action|json)?\s*(\{[\s\S]*?\})\s*\`\`\`/);

      if (actionMatch && actionMatch[1]) {
        try {
          const parsedAction = JSON.parse(actionMatch[1]);
          
          if (parsedAction.action === 'export_reports' && Array.isArray(parsedAction.reports)) {
            // Handled below
          } else {
            let targetItem = items.find(i => i.id === parsedAction.itemId);
            if (!targetItem && parsedAction.itemName) {
              targetItem = items.find(i => i.name.toLowerCase().includes(parsedAction.itemName.toLowerCase()));
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

      res.write(`data: ${JSON.stringify({ 
        type: 'done', 
        dbAction, 
        fileReport: fileReports?.[0], 
        fileReports: fileReports,
        suggestedItems: matchedItems.slice(0, 5) 
      })}\n\n`);
      res.end();
      
    } catch (error: any) {
      if (error.message === 'QUOTA_EXCEEDED') {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'QUOTA_EXCEEDED' })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'API_ERROR' })}\n\n`);
      }
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
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

    const setupLiveSession = async (userName: string, userRole: string, initialItems: Item[]) => {
      if (isInitialized) return;
      isInitialized = true;

      try {
        if (Array.isArray(initialItems) && initialItems.length > 0) {
          sessionActiveItems = initialItems;
        } else if (sessionActiveItems.length === 0) {
          sessionActiveItems = await fetchInventoryFromSheet();
        }

        const outOfStockItems = sessionActiveItems.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out');
        const lowStockItems = sessionActiveItems.filter(i => 
          ((Number(i.qty) || 0) > 0 && (Number(i.qty) || 0) <= (Number(i.minStock) || 1)) || 
          (i.status === 'low' && (Number(i.qty) || 0) > 0)
        );
        const totalUnits = sessionActiveItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

        const adminInstruction = userRole === 'admin' 
          ? "อนุญาตให้ใช้เครื่องมือปรับสต็อกได้" 
          : "ผู้ใช้ท่านนี้ไม่มีสิทธิ์แก้ไขสต็อก(update_stock) หรือแก้ไขชื่อสินค้า หากผู้ใช้สั่งแก้ไขให้ตอบปฏิเสธอย่างสุภาพ อนุญาตเฉพาะการ รับเข้า (stock_in) และ เบิก (stock_out) เท่านั้น";

        const inventoryCatalog = sessionActiveItems.map(i => {
          const qty = Number(i.qty) || 0;
          const min = Number(i.minStock) || 1;
          const status = qty <= 0 ? 'หมดสต็อก (0)' : qty <= min ? `ใกล้หมด (${qty})` : `ปกติ (${qty})`;
          return `- ${i.name} (รหัส ${i.id}) | คงเหลือ: ${qty} ${i.unit} (ขั้นต่ำ ${min}) | สถานะ: ${status} | หมวด: ${i.category} | ที่เก็บ: ${i.location}`;
        }).join('\n');

        const config = {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: `คุณคือผู้ช่วยจัดการคลังสินค้าอัจฉริยะ Store FL.6 ของ ENG Smart Store ในโหมดสนทนาด้วยเสียงสด (Live Speech)
ให้ตอบสนองด้วยเสียงภาษาไทยอย่างเป็นธรรมชาติ สุภาพ ชัดเจน สั้นกระชับ รวดเร็ว และเป็นกันเอง
ผู้ใช้งานที่คุณกำลังคุยด้วยชื่อ: ${userName} (สิทธิ์: ${userRole})
${adminInstruction}

📊 ข้อมูลภาพรวมคลัง Store FL.6 ปัจจุบัน:
- มีรายการสินค้าทั้งหมด: ${sessionActiveItems.length} รายการ (รวม ${totalUnits} หน่วย)
- สินค้าหมดสต็อก: ${outOfStockItems.length} รายการ
- สินค้าใกล้หมด: ${lowStockItems.length} รายการ

📦 รายการสต็อกสินค้าคงคลังปัจจุบัน:
${inventoryCatalog}

⚡ คำแนะนำในการตอบ:
1. คุณมีข้อมูลสต็อกทั้งหมดอยู่แล้วด้านบน ตอบคำถามเรื่องจำนวนคงเหลือ สินค้าหมด หรือสินค้าใกล้หมดได้ทันทีอย่างรวดเร็วและกระชับ
2. เมื่อผู้ใช้สั่ง "เบิก" หรือ "รับเข้า" สินค้า ให้เรียกใช้ฟังก์ชัน \`prepare_stock_action\` ทันทีเพื่อส่งการ์ดยืนยันไปยังหน้าจอของผู้ใช้
3. เมื่อผู้ใช้สั่งออกรายงาน PDF หรือ Excel ให้เรียกใช้ฟังก์ชัน \`export_report\` ทันที
4. เมื่อผู้ใช้ต้องการดูข้อมูลสินค้าเฉพาะเจาะจงหรือต้องการแสดงการ์ดบนจอ ให้เรียกใช้ \`inquire_item_info\`
5. หากผู้ใช้กดยืนยันรายการ ให้ตอบสั้นๆ ว่า "บันทึกรายการลงระบบให้เรียบร้อยแล้วค่ะ"`,
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
          onmessage: (message: LiveServerMessage) => {
            const parts = message.serverContent?.modelTurn?.parts || [];
            let textTranscript = "";
            let audioData = "";
            for (const part of parts) {
              if (part.text) textTranscript += part.text;
              if (part.inlineData?.data) audioData = part.inlineData.data;
            }

            if (textTranscript) {
              clientWs.send(JSON.stringify({ text: textTranscript, transcript: true }));
            }

            if (audioData) {
              clientWs.send(JSON.stringify({ audio: audioData }));
            }

            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }

            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }

            if (message.toolCall) {
              const calls = message.toolCall.functionCalls || [];
              for (const fc of calls) {
                if (fc) {
                  clientWs.send(JSON.stringify({
                    toolCall: { name: fc.name, args: fc.args, id: fc.id }
                  }));

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

                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
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
                    
                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
                    }
                  } else if (fc.name === "get_out_of_stock_items") {
                    const outItems = sessionActiveItems.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out');
                    if (outItems.length === 0) {
                      toolResult = "ขณะนี้ไม่มีสินค้าหมดสต็อกในคลัง Store FL.6 ทุกรายการมีของพร้อมใช้งานค่ะ";
                    } else {
                      toolResult = `พบสินค้าหมดสต็อกทั้งหมด ${outItems.length} รายการ:\n` +
                        outItems.map((i, idx) => `${idx + 1}. ${i.name} (รหัส: ${i.id}) - ตำแหน่ง: ${i.location}`).join('\n');
                    }

                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
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

                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
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
                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
                    }
                  } else if (fc.name === "export_report") {
                    const format = (fc.args?.format as string || "pdf").toLowerCase();
                    toolResult = `สร้างการ์ดดาวน์โหลดรายงาน ${format.toUpperCase()} ส่งไปยังหน้าจอเรียบร้อยแล้วค่ะ`;
                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
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
                    
                    if (activeLiveSession) {
                      try {
                        activeLiveSession.sendToolResponse({
                          functionResponses: [{
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolResult }
                          }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
                    }
                  }
                }
              }
            }
          },
        };

        sessionPromise = ai.live.connect({
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

    // Immediate session initialization on connection
    setupLiveSession(defaultUserName, defaultUserRole, cachedItems);

    clientWs.on("message", async (data) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.type === "init") {
          if (Array.isArray(parsed.items) && parsed.items.length > 0) {
            sessionActiveItems = parsed.items;
          }
          if (!isInitialized) {
            setupLiveSession(
              parsed.userName || defaultUserName,
              parsed.userRole || defaultUserRole,
              parsed.items || []
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

  // Pre-warm inventory cache immediately on startup
  fetchInventoryFromSheet().catch(() => {});

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
