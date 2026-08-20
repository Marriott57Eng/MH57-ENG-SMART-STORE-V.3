const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `               const isStockIn = parsedAction.action === 'stock_in';
               const actionQty = Math.max(1, Number(parsedAction.qty) || 1);
               const prevQty = targetItem.qty;
               const newQty = isStockIn ? prevQty + actionQty : Math.max(0, prevQty - actionQty);`;

const replaceStr = `               const isStockIn = parsedAction.action === 'stock_in';
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
                 const newQty = isStockIn ? prevQty + actionQty : Math.max(0, prevQty - actionQty);`;

const targetStrClose = `                 previousQty: prevQty,
                 newQty: newQty,
                 record: recordData
               };
            }`;

const replaceStrClose = `                 previousQty: prevQty,
                 newQty: newQty,
                 record: recordData
               };
               }
            }`;

code = code.replace(targetStr, replaceStr);
code = code.replace(targetStrClose, replaceStrClose);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Fixed server action parsing successfully");
