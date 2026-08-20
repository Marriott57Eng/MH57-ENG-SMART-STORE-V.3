const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldCode = `               let newStatus = 'normal';
               if (newQty <= 0) newStatus = 'out'; else if (newQty <= targetItem.minStock) newStatus = 'low';
               
               const updatedItem = { ...targetItem, qty: newQty, status: newStatus as any };`;

const newCode = `               let newStatus = 'normal';
               if (newQty <= 0) newStatus = 'out'; else if (newQty <= targetItem.minStock) newStatus = 'low';
               
               const updatedItem = { ...targetItem, qty: newQty, status: newStatus as any };
               if (newQty <= 0 && targetItem.qty > 0) {
                 updatedItem.outOfStockDate = new Date().toISOString();
               } else if (newQty > 0) {
                 updatedItem.outOfStockDate = undefined;
               }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('server.ts', code);
