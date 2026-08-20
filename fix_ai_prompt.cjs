const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldSys = `      const systemInstruction = \`คุณคือ AI คลังสินค้า Store FL.6
ตอบสั้นๆ กระชับที่สุด ไม่ต้องเกริ่นนำ
ถ้ามีการทำรายการให้แนบ JSON ไว้ท้ายข้อความเสมอ:
\\\`\\\`\\\`json:action
{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัส", "qty": 1, "requestedBy": "คนเบิก"}
\\\`\\\`\\\`
ข้อมูลสินค้า: \${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}\`;`;

const newSys = `      const systemInstruction = \`คุณคือ AI คลังสินค้า Store FL.6
1. ตอบรับการกระทำสั้นๆ เป็นภาษาคนเสมอ (เช่น "บันทึกการเบิกเรียบร้อยครับ")
2. ถ้ามีการทำรายการ (เบิก/รับเข้า) ให้แนบ JSON ไว้ท้ายข้อความเสมอ (ต้องมีทั้ง itemId และ itemName):
\\\`\\\`\\\`json:action
{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัสสินค้า", "itemName": "ชื่อสินค้า", "qty": 1, "requestedBy": "คนเบิก"}
\\\`\\\`\\\`
ข้อมูลสินค้า: \${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}\`;`;

code = code.replace(oldSys, newSys);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched server.ts system instruction");
