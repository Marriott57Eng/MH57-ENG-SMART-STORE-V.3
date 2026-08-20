const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldLogic = `      // 2. Pass everything if the inventory is small enough (up to 150 items is easily handled by Gemini)
      let matchedItems = items;
      
      if (items.length > 150) {
          const filtered = items.filter(item => {
              const itemNameLower = item.name.toLowerCase();
              // Check if prompt contains the exact item name (good for Thai where words don't have spaces)
              const nameInPrompt = pLower.includes(itemNameLower) || cleanPrompt.includes(itemNameLower);
              const idInPrompt = pLower.includes(item.id.toLowerCase());
              const catInPrompt = pLower.includes(item.category.toLowerCase());
              
              // Check if any whitespace-separated term is inside the item name (good for partial matches)
              const termInItem = searchTerms.some((term: string) => 
                  itemNameLower.includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              );
              
              return nameInPrompt || idInPrompt || catInPrompt || termInItem;
          });
          
          if (filtered.length > 0) {
              matchedItems = filtered.slice(0, 150);
          } else {
              matchedItems = items.slice(0, 150); // fallback
          }
      }`;

const newLogic = `      // 2. Smart filtering to keep context small and fast
      let matchedItems = [];
      const isSummaryRequest = pLower.includes('สรุป') || pLower.includes('ใกล้หมด') || pLower.includes('สั่งซื้อ') || pLower.includes('วิเคราะห์') || pLower.includes('ภาพรวม');
      
      if (isSummaryRequest) {
          // Only pass items that need attention (low or out of stock)
          matchedItems = items.filter(i => i.status === 'low' || i.status === 'out').slice(0, 20);
          if (matchedItems.length === 0) {
              matchedItems = items.slice(0, 5); // Just some context
          }
      } else {
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
          
          if (filtered.length > 0) {
              matchedItems = filtered.slice(0, 15);
          } else {
              matchedItems = items.slice(0, 15); // fallback
          }
      }`;

code = code.replace(oldLogic, newLogic);

const oldSys = `      const systemInstruction = \`คุณคือ "AI ผู้ช่วยจัดการคลังสินค้าอัจฉริยะ" (Warehouse Assistant) ประจำคลังสินค้า Store FL.6
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
\${JSON.stringify(recentReqs)}\`;`;

const newSys = `      const systemInstruction = \`คุณคือ AI คลังสินค้า Store FL.6
ตอบสั้นกระชับที่สุด ทำงานเร็ว ไม่ต้องเกริ่นนำ
คำสั่ง JSON (ห้ามมี \`\`\` ครอบ):
{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัส", "qty": จำนวน, "requestedBy": "ผู้เบิก"}
ข้อมูลอ้างอิง:
\${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}\`;`;

code = code.replace(oldSys, newSys);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched server.ts for speed");
