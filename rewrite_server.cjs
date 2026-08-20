const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// 1. Add Firebase Admin
code = code.replace('import { GoogleGenAI } from "@google/genai";', 'import { GoogleGenAI } from "@google/genai";\nimport admin from "firebase-admin";\n\nadmin.initializeApp();\nconst db = admin.firestore();');

// 2. Rewrite fetchInventoryFromSheet
const oldFetchFunc = code.substring(code.indexOf('async function fetchInventoryFromSheet'), code.indexOf('async function startServer()'));
const newFetchFunc = `
async function fetchInventoryFromSheet(force = false): Promise<Item[]> {
  try {
    const snapshot = await db.collection('inventory').get();
    if (!snapshot.empty && !force) {
      const items = snapshot.docs.map(doc => doc.data() as Item);
      return items.sort((a,b) => a.id.localeCompare(b.id));
    }
  } catch (err) {
    console.error("Firestore error, falling back to CSV:", err);
  }

  // Fallback to CSV if Firestore is empty or force is true
  try {
    const res = await fetch(SHEET_CSV_URL, {
      headers: { 'User-Agent': 'Warehouse-Manager/1.0' },
    });
    if (!res.ok) throw new Error(\`Failed to fetch sheet: HTTP \${res.status}\`);
    const csvText = await res.text();
    const rows = parseCSV(csvText);
    if (rows.length < 2) return [];

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
      const rawId = idIdx !== -1 ? row[idIdx] : (row[0] || \`ITEM-\${r}\`);
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
        id: rawId || \`ITEM-\${r}\`,
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
    
    // Save to Firestore
    try {
       const batch = db.batch();
       items.forEach(item => {
           const docRef = db.collection('inventory').doc(item.id);
           batch.set(docRef, item);
       });
       await batch.commit();
    } catch(err) {
       console.error("Failed to seed Firestore", err);
    }
    
    return items;
  } catch (err) {
    console.error('Error loading inventory sheet:', err);
    return [];
  }
}
`;
code = code.replace(oldFetchFunc, newFetchFunc + '\n');

// 3. Rewrite PUT /api/inventory/:id
code = code.replace(
  `const targetItem = items.find(i => i.id === id);`,
  `const targetItem = items.find(i => i.id === id);\n      if (targetItem) {\n        const docRef = db.collection('inventory').doc(id);\n        await docRef.set(targetItem, { merge: true });\n      }`
);

// 4. Rewrite POST /api/chat
const chatEndpointStart = code.indexOf('app.post("/api/chat"');
const chatEndpointEnd = code.indexOf('// Vite middleware for development');
const oldChatEndpoint = code.substring(chatEndpointStart, chatEndpointEnd);

const newChatEndpoint = `
  app.post("/api/chat", async (req, res) => {
    try {
      const { prompt, history, isVoice, items: clientItems, requisitions: clientRequisitions } = req.body;
      
      let items: Item[] = Array.isArray(clientItems) && clientItems.length > 0
        ? clientItems
        : await fetchInventoryFromSheet();

      // RAG: Filter items based on prompt keywords to drastically reduce context size
      const searchTerms = prompt.toLowerCase().split(/\\s+/).filter((t: string) => t.length > 1);
      let matchedItems = items;
      if (searchTerms.length > 0) {
          const filtered = items.filter(item => 
              searchTerms.some((term: string) => 
                  item.name.toLowerCase().includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              )
          );
          if (filtered.length > 0) {
              matchedItems = filtered.slice(0, 50); // limit to top 50 matches
          } else {
              matchedItems = items.slice(0, 50); // fallback to first 50
          }
      } else {
          matchedItems = items.slice(0, 50);
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const compactInventory = matchedItems.map(item => ({
        id: item.id,
        name: item.name,
        qty: \`\${item.qty} \${item.unit}\`,
        loc: item.location,
        status: item.status,
      }));

      const recentReqs = Array.isArray(clientRequisitions) ? clientRequisitions.slice(0, 5).map(r => ({
        type: r.type || 'out',
        item: r.itemName,
        qty: r.qty,
        user: r.requestedBy
      })) : [];

      const systemInstruction = \`คุณคือ "AI ผู้ช่วยจัดการคลังสินค้าอัจฉริยะ" (Warehouse Assistant) ประจำคลังสินค้า Store FL.6
หน้าที่สำคัญ:
1. ตอบคำถามเรื่องสต็อก ค้นหาตำแหน่ง ตรวจสอบสินค้า 
2. สามารถสั่งแก้ข้อมูลสต็อก และบันทึกประวัติการเบิก/รับเข้า ได้ทันที
   - เบิกของ/ตัดสต็อก/เอาของออก -> action "requisition"
   - รับเข้า/เติมของ -> action "stock_in"
   - ปรับสต็อก -> action "update_stock"
3. ตอบกลับสั้นๆ ชัดเจน ถ้ามีการทำ DB action ให้แนบ Action JSON Block ไว้ตอนท้ายเสมอ:
\\\`\\\`\\\`json:action
{
  "action": "requisition" | "stock_in" | "update_stock",
  "itemId": "รหัสสินค้า",
  "itemName": "ชื่อสินค้า",
  "qty": 2,
  "unit": "ชิ้น",
  "requestedBy": "ผู้ใช้งาน",
  "purpose": "รายละเอียด",
  "newQty": 0
}
\\\`\\\`\\\`
ข้อมูลสินค้าที่เกี่ยวข้อง (\${compactInventory.length} รายการ):
\${JSON.stringify(compactInventory)}
ประวัติล่าสุด:
\${JSON.stringify(recentReqs)}\`;

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
      
      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-flash-lite',
        contents,
        config: { systemInstruction, temperature: 0.2 },
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          rawResponseText += chunk.text;
          res.write(\`data: \${JSON.stringify({ type: 'chunk', text: chunk.text })}\\n\\n\`);
        }
      }

      // Parse JSON action
      let dbAction: any = undefined;
      const actionMatch = rawResponseText.match(/\\\`\\\`\\\`json:action\\s*([\\s\\S]*?)\\s*\\\`\\\`\\\`/);
      if (actionMatch && actionMatch[1]) {
        try {
          const parsedAction = JSON.parse(actionMatch[1]);
          let targetItem = items.find(i => i.id === parsedAction.itemId);
          if (!targetItem && parsedAction.itemName) {
            targetItem = items.find(i => i.name.toLowerCase().includes(parsedAction.itemName.toLowerCase()));
          }

          if (targetItem) {
            if (parsedAction.action === 'requisition' || parsedAction.action === 'stock_in') {
               const isStockIn = parsedAction.action === 'stock_in';
               const actionQty = Math.max(1, Number(parsedAction.qty) || 1);
               const prevQty = targetItem.qty;
               const newQty = isStockIn ? prevQty + actionQty : Math.max(0, prevQty - actionQty);
               
               let newStatus = 'normal';
               if (newQty <= 0) newStatus = 'out'; else if (newQty <= targetItem.minStock) newStatus = 'low';
               
               const updatedItem = { ...targetItem, qty: newQty, status: newStatus as any };
               
               // Save to Firestore
               await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });

               dbAction = {
                 action: parsedAction.action,
                 status: 'success',
                 item: updatedItem,
                 previousQty: prevQty,
                 newQty: newQty,
                 record: {
                   id: \`REQ-\${Date.now().toString().slice(-4)}\`,
                   type: isStockIn ? 'in' : 'out',
                   itemId: targetItem.id,
                   itemName: targetItem.name,
                   category: targetItem.category,
                   qty: actionQty,
                   unit: targetItem.unit,
                   requestedBy: parsedAction.requestedBy || 'ผู้ใช้งาน',
                   purpose: parsedAction.purpose || 'ใช้งาน',
                   timestamp: new Date().toISOString()
                 }
               };
            }
          }
        } catch (e) {
          console.warn("Parse action error", e);
        }
      }
      
      let pdfReport = undefined;
      const pLower = prompt.toLowerCase();
      if (pLower.includes('pdf') || pLower.includes('รายงาน')) {
         pdfReport = { type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลัง' };
      }

      res.write(\`data: \${JSON.stringify({ type: 'done', dbAction, pdfReport, suggestedItems: matchedItems.slice(0, 5) })}\\n\\n\`);
      res.end();
      
    } catch (error: any) {
      console.error("Chat API Error:", error);
      res.write(\`data: \${JSON.stringify({ type: 'error', message: error.message })}\\n\\n\`);
      res.end();
    }
  });

  `;

code = code.replace(oldChatEndpoint, newChatEndpoint);

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Rewrote server.ts");
