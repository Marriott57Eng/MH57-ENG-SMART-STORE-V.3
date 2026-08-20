const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldLogic = `          if (targetItem) {
            if (parsedAction.action === 'requisition' || parsedAction.action === 'stock_in') {`;

const newLogic = `          if (!targetItem) {
            dbAction = {
              action: 'error',
              message: \`ไม่พบสินค้า \${parsedAction.itemName || parsedAction.itemId} ในระบบ กรุณาระบุชื่อหรือรหัสให้ชัดเจน\`
            };
          } else if (targetItem) {
            if (parsedAction.action === 'requisition' || parsedAction.action === 'stock_in') {`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched missing item logic");
