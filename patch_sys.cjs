const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldSys = `      const systemInstruction = \`คุณคือ AI คลังสินค้า Store FL.6
ตอบสั้นกระชับที่สุด ทำงานเร็ว ไม่ต้องเกริ่นนำ
คำสั่ง JSON (ห้ามมี \\\`\\\`\\\` ครอบ):
{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัส", "qty": จำนวน, "requestedBy": "ผู้เบิก"}
ข้อมูลอ้างอิง:
\${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}\`;`;

const newSys = `      const systemInstruction = \`คุณคือ AI คลังสินค้า Store FL.6
ตอบสั้นๆ กระชับที่สุด ไม่ต้องเกริ่นนำ
ถ้ามีการทำรายการ (เบิก/รับเข้า) ให้แนบ JSON ไว้ท้ายข้อความแบบนี้เสมอ:
\\\`\\\`\\\`json:action
{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัสสินค้า", "qty": 1, "requestedBy": "คนเบิก"}
\\\`\\\`\\\`
ข้อมูลสินค้าที่เกี่ยวข้อง: \${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc,minStock:i.minStock})))}\`;`;

code = code.replace(oldSys, newSys);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched server.ts sys instruction");
