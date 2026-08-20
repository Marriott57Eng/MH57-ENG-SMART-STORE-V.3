const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const lines = code.split('\n');
// We want to replace lines 315 to 320
const startIdx = 314; // 0-based
const endIdx = 320;

const newBlock = `      const systemInstruction = \`คุณคือ AI คลังสินค้า Store FL.6
ตอบสั้นๆ กระชับที่สุด ไม่ต้องเกริ่นนำ
ถ้ามีการทำรายการให้แนบ JSON ไว้ท้ายข้อความเสมอ:
\\\`\\\`\\\`json:action
{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัส", "qty": 1, "requestedBy": "คนเบิก"}
\\\`\\\`\\\`
ข้อมูลสินค้า: \${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}\`;`;

lines.splice(startIdx, endIdx - startIdx + 1, newBlock);

fs.writeFileSync('server.ts', lines.join('\n'), 'utf-8');
console.log("Fixed system prompt backticks issue");
