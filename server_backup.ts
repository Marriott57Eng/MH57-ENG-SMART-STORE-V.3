import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

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
}

let cachedItems: Item[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

async function fetchInventoryFromSheet(force = false): Promise<Item[]> {
  const now = Date.now();
  if (!force && cachedItems.length > 0 && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedItems;
  }

  try {
    const res = await fetch(SHEET_CSV_URL, {
      headers: {
        'User-Agent': 'Warehouse-Manager/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch sheet: HTTP ${res.status}`);
    }

    const csvText = await res.text();
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return cachedItems;
    }

    const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    // Find column indexes
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
      if (qty <= 0) {
        status = 'out';
      } else if (qty <= minStock) {
        status = 'low';
      }

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
    cacheTimestamp = now;
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
        if (targetItem.qty <= 0) targetItem.status = 'out';
        else if (targetItem.qty <= targetItem.minStock) targetItem.status = 'low';
        else targetItem.status = 'normal';
      }
      if (typeof minStock === 'number') targetItem.minStock = minStock;
      if (typeof location === 'string') targetItem.location = location;
      if (typeof note === 'string') targetItem.note = note;

      res.json({ success: true, item: targetItem });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: AI Warehouse & Voice Assistant with DB Action execution
  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, history, isVoice, items: clientItems, requisitions: clientRequisitions } = req.body;
      
      // Use clientItems if provided (to maintain state synchronized with client edits), otherwise fetch cached items
      let items: Item[] = Array.isArray(clientItems) && clientItems.length > 0
        ? clientItems
        : await fetchInventoryFromSheet();

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Create a compact representation of the inventory for Gemini
      const compactInventory = items.map(item => ({
        id: item.id,
        name: item.name,
        cat: item.category,
        qty: `${item.qty} ${item.unit}`,
        min: item.minStock,
        loc: item.location,
        status: item.status,
      }));

      // Recent requisitions for context
      const recentReqs = Array.isArray(clientRequisitions)
        ? clientRequisitions.slice(0, 10).map(r => ({
            id: r.id,
            type: r.type || 'out',
            item: `${r.itemName} (${r.itemId})`,
            qty: `${r.qty} ${r.unit}`,
            user: r.requestedBy,
            purpose: r.purpose,
            time: r.timestamp,
          }))
        : [];

      const systemInstruction = `คุณคือ "AI ผู้ช่วยจัดการคลังสินค้าอัจฉริยะ" (Warehouse Assistant) ประจำคลังสินค้า Store FL.6
หน้าที่สำคัญของคุณ:
1. ตอบคำถามเกี่ยวกับสต็อกสินค้า, ค้นหาตำแหน่งจัดเก็บ (Location), ตรวจสอบจำนวนคงเหลือ, สินค้าที่ต้องสั่งซื้อเพิ่ม (Low Stock), และข้อมูลหมวดหมู่สินค้า
2. ความสามารถพิเศษ: **สามารถสั่งแก้ข้อมูลสต็อก และบันทึกประวัติการเบิก/รับเข้า ได้ทันที (Database Operations)**
   - เมื่อผู้ใช้สั่งให้ "เบิกของ", "ตัดสต็อก", "เบิกสินค้า", "เอาของออก": ให้ระบุ action "requisition"
   - เมื่อผู้ใช้สั่งให้ "รับเข้า", "เพิ่มสต็อก", "รับของเข้า", "เติมของ": ให้ระบุ action "stock_in"
   - เมื่อผู้ใช้สั่งให้ "ปรับสต็อก", "แก้จำนวนสินค้า": ให้ระบุ action "update_stock"
   - เมื่อผู้ใช้สั่งให้ "ลบประวัติการเบิก/รับเข้า": ให้ระบุ action "delete_record"

3. เมื่อมีการสั่งทำ Database Operation ให้ทำดังนี้:
   - ค้นหารหัสสินค้า (itemId) และชื่อสินค้า (itemName) จากฐานข้อมูลที่ตรงกับที่ผู้ใช้ต้องการ
   - คำนวณจำนวนคงเหลือใหม่ (เบิกออก: ลดสต็อก, รับเข้า: เพิ่มสต็อก)
   - ตอบกลับเป็นข้อความภาษาไทยที่สุภาพ ชัดเจน สรุปรายละเอียดสิ่งที่ได้ดำเนินการสำเร็จ
   - **สำคัญมาก**: แนบ Action JSON Block ท้ายข้อความเสมอ ในรูปแบบดังนี้:

\`\`\`json:action
{
  "action": "requisition" | "stock_in" | "update_stock" | "delete_record",
  "itemId": "รหัสสินค้า เช่น A000000166",
  "itemName": "ชื่อสินค้า",
  "category": "หมวดหมู่",
  "qty": 2,
  "unit": "หน่วยนับ เช่น แกลลอน/หลอด/ชิ้น",
  "requestedBy": "ชื่อผู้เบิกหรือผู้รับเข้า (ถ้าผู้ใช้ไม่ระบุ ให้ใช้ 'ผู้ใช้งาน (สั่งผ่าน AI)')",
  "purpose": "งานที่นำไปใช้ หรือแหล่งที่มา (ถ้าไม่ระบุ ให้ใส่คำอธิบายที่เหมาะสม เช่น 'งานซ่อมบำรุง')",
  "note": "หมายเหตุเพิ่มเติม (ถ้ามี)",
  "newQty": 28,
  "recordId": "รหัสประวัติ (กรณีสั่งลบ เช่น REQ-1001)"
}
\`\`\`

4. คุณสามารถสร้างและออกรายงานไฟล์ PDF ให้ผู้ใช้ได้ทันที เมื่อผู้ใช้ขอไฟล์ PDF หรือขอให้ออกรายงาน
5. ข้อมูลสินค้าและประวัติปัจจุบัน:
รายการสินค้า (${items.length} รายการ):
${JSON.stringify(compactInventory, null, 1)}

ประวัติความเคลื่อนไหวล่าสุด (${recentReqs.length} รายการ):
${JSON.stringify(recentReqs, null, 1)}
`;

      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const h of history.slice(-6)) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }],
          });
        }
      }

      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });

      let rawResponseText = "";
      const modelsToTry = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              temperature: 0.2,
            },
          });
          if (response.text) {
            rawResponseText = response.text;
            break;
          }
        } catch (mErr: any) {
          console.warn(`Model ${model} failed, trying next:`, mErr.message);
        }
      }

      if (!rawResponseText) {
        throw new Error("Unable to generate response from AI models");
      }

      // Parse action JSON block if present
      let dbAction: any = undefined;
      let cleanedResponseText = rawResponseText;

      const actionMatch = rawResponseText.match(/```json:action\s*([\s\S]*?)\s*```/);
      if (actionMatch && actionMatch[1]) {
        try {
          const parsedAction = JSON.parse(actionMatch[1]);
          cleanedResponseText = rawResponseText.replace(/```json:action[\s\S]*?```/, '').trim();

          // Match item
          let matchedItem = items.find(i => i.id === parsedAction.itemId);
          if (!matchedItem && parsedAction.itemName) {
            matchedItem = items.find(i => 
              i.name.toLowerCase().includes(parsedAction.itemName.toLowerCase()) ||
              parsedAction.itemName.toLowerCase().includes(i.name.toLowerCase())
            );
          }

          if (parsedAction.action === 'requisition' || parsedAction.action === 'stock_in') {
            const isStockIn = parsedAction.action === 'stock_in';
            const actionQty = Math.max(1, Number(parsedAction.qty) || 1);
            const target = matchedItem || (items[0] as Item);

            const prevQty = target.qty;
            const newQty = isStockIn 
              ? prevQty + actionQty 
              : Math.max(0, prevQty - actionQty);

            // Format Thai timestamp
            const now = new Date();
            const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            const thaiYear = now.getFullYear() + 543;
            const pad = (n: number) => n.toString().padStart(2, '0');
            const formattedTimestamp = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${thaiYear}, ${pad(now.getHours())}:${pad(now.getMinutes())} น.`;

            const newRecord = {
              id: `REQ-${Date.now().toString().slice(-4)}`,
              type: isStockIn ? 'in' : 'out',
              itemId: target.id,
              itemName: target.name,
              category: target.category,
              qty: actionQty,
              unit: target.unit || parsedAction.unit || 'ชิ้น',
              requestedBy: parsedAction.requestedBy || (isStockIn ? 'ฝ่ายจัดซื้อ / สั่งผ่าน AI' : 'ผู้ใช้งาน (สั่งผ่าน AI)'),
              purpose: parsedAction.purpose || (isStockIn ? 'รับของเข้าสต็อก (สั่งผ่าน AI)' : 'งานซ่อมบำรุง (สั่งผ่าน AI)'),
              timestamp: formattedTimestamp,
              isoDate: now.toISOString(),
              note: parsedAction.note || 'บันทึกอัตโนมัติโดย AI ผู้ช่วย',
            };

            let newStatus: 'normal' | 'low' | 'out' = 'normal';
            if (newQty <= 0) newStatus = 'out';
            else if (newQty <= target.minStock) newStatus = 'low';

            const updatedItem: Item = {
              ...target,
              qty: newQty,
              status: newStatus,
            };

            dbAction = {
              action: parsedAction.action,
              status: 'success',
              message: isStockIn ? `รับเข้าสินค้า ${target.name} จำนวน +${actionQty} ${target.unit} เรียบร้อยแล้ว` : `เบิกสินค้า ${target.name} จำนวน -${actionQty} ${target.unit} เรียบร้อยแล้ว`,
              record: newRecord,
              item: updatedItem,
              previousQty: prevQty,
              newQty: newQty,
            };
          } else if (parsedAction.action === 'update_stock') {
            const target = matchedItem || (items[0] as Item);
            const prevQty = target.qty;
            const newQty = Math.max(0, Number(parsedAction.newQty) || 0);

            let newStatus: 'normal' | 'low' | 'out' = 'normal';
            if (newQty <= 0) newStatus = 'out';
            else if (newQty <= target.minStock) newStatus = 'low';

            const updatedItem: Item = {
              ...target,
              qty: newQty,
              status: newStatus,
            };

            dbAction = {
              action: 'update_stock',
              status: 'success',
              message: `ปรับปรุงสต็อก ${target.name} จาก ${prevQty} เป็น ${newQty} ${target.unit} สำเร็จ`,
              item: updatedItem,
              previousQty: prevQty,
              newQty: newQty,
            };
          } else if (parsedAction.action === 'delete_record') {
            dbAction = {
              action: 'delete_record',
              status: 'success',
              message: `ลบประวัติรายการรหัส ${parsedAction.recordId || ''} สำเร็จ`,
              recordId: parsedAction.recordId,
            };
          }
        } catch (actionErr) {
          console.warn("Failed to parse AI action JSON:", actionErr);
        }
      }

      // Check if PDF generation was requested
      const pLower = prompt.toLowerCase();
      let pdfReport: { type: string; title: string; categoryFilter?: string } | undefined = undefined;
      const isPdfRequest = pLower.includes('pdf') || pLower.includes('รายงาน') || pLower.includes('report') || pLower.includes('เอกสาร') || pLower.includes('export');

      if (isPdfRequest) {
        if (pLower.includes('เบิก') || pLower.includes('requisition') || pLower.includes('รับเข้า')) {
          pdfReport = {
            type: 'requisition_history',
            title: 'รายงานประวัติการเบิก / รับเข้าสินค้า (Store FL.6)',
          };
        } else if (pLower.includes('ใกล้หมด') || pLower.includes('หมดสต็อก') || pLower.includes('สั่งซื้อ') || pLower.includes('low') || pLower.includes('out')) {
          pdfReport = {
            type: 'low_stock',
            title: 'รายงานสินค้าใกล้หมด / หมดสต็อก',
          };
        } else {
          // Check if category is mentioned
          const categories = Array.from(new Set(items.map(i => i.category))).filter(Boolean);
          const matchedCategory = categories.find(cat => pLower.includes(cat.toLowerCase()));
          if (matchedCategory) {
            pdfReport = {
              type: 'category',
              title: `รายงานสต็อกสินค้า หมวด: ${matchedCategory}`,
              categoryFilter: matchedCategory,
            };
          } else {
            pdfReport = {
              type: 'inventory_all',
              title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)',
            };
          }
        }
      }

      // Find matching items to recommend in UI if relevant
      const searchTerms = prompt.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);
      const matchedItems = items.filter(item => {
        return searchTerms.some((term: string) => 
          item.name.toLowerCase().includes(term) || 
          item.id.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term)
        );
      }).slice(0, 5);

      res.json({ 
        response: cleanedResponseText,
        suggestedItems: matchedItems.length > 0 ? matchedItems : undefined,
        pdfReport: pdfReport || undefined,
        dbAction: dbAction || undefined,
      });
    } catch (error: any) {
      console.error("Chat API Error:", error);
      res.status(500).json({ error: error.message });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
