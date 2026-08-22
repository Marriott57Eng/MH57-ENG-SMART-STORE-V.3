const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetPrompt = `8. หากมีข้อความแจ้งว่าผู้ใช้กดยืนยันรายการ ให้ตอบกลับด้วยเสียงสั้นๆ ว่า "บันทึกรายการลงระบบให้เรียบร้อยแล้วค่ะ" หรือหากยกเลิกให้บอกว่า "ยกเลิกรายการให้แล้วค่ะ"\`,`;
const replacementPrompt = `8. หากมีข้อความแจ้งว่าผู้ใช้กดยืนยันรายการ ให้ตอบกลับด้วยเสียงสั้นๆ ว่า "บันทึกรายการลงระบบให้เรียบร้อยแล้วค่ะ" หรือหากยกเลิกให้บอกว่า "ยกเลิกรายการให้แล้วค่ะ"
9. เมื่อผู้ใช้ถามถึงสินค้าที่มีจำนวนมากที่สุด หรือน้อยที่สุด ให้เรียกใช้ฟังก์ชัน \\\`get_stock_extremes\\\` ทันที\`,`;

code = code.replace(targetPrompt, replacementPrompt);

const targetTool = `              {
                name: "get_stock_summary",`;
const replacementTool = `              {
                name: "get_stock_extremes",
                description: "เรียกใช้นี้เมื่อผู้ใช้ถามว่า สินค้าอะไรมีจำนวนมากที่สุด หรือน้อยที่สุดในคลัง ระบบจะค้นหาและส่งคืนรายการสินค้าที่มีจำนวนมากที่สุดและน้อยที่สุดทันที",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "get_stock_summary",`;

code = code.replace(targetTool, replacementTool);

const targetHandler = `                  if (fc.name === "get_stock_summary") {`;
const replacementHandler = `                  if (fc.name === "get_stock_extremes") {
                    let sortedItems = [...sessionActiveItems].sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0));
                    
                    if (sortedItems.length === 0) {
                      toolResult = "ขณะนี้ไม่มีข้อมูลสินค้าในคลังค่ะ";
                    } else {
                      const minItem = sortedItems[0];
                      const maxItem = sortedItems[sortedItems.length - 1];
                      toolResult = \`สินค้าที่มีจำนวนน้อยที่สุดคือ: \${minItem.name} (รหัส \${minItem.id}) มีจำนวน \${minItem.qty} \${minItem.unit}\\n\` +
                                   \`สินค้าที่มีจำนวนมากที่สุดคือ: \${maxItem.name} (รหัส \${maxItem.id}) มีจำนวน \${maxItem.qty} \${maxItem.unit}\`;
                    }
                    
                    sessionPromise?.then(session => {
                      try {
                        session.sendToolResponse({
                          functionResponses: [{ id: fc.id, name: fc.name, response: { result: toolResult } }]
                        });
                      } catch (e) {
                        console.error("Tool response error", e);
                      }
                    });
                  } else if (fc.name === "get_stock_summary") {`;

code = code.replace(targetHandler, replacementHandler);

fs.writeFileSync('server.ts', code);
