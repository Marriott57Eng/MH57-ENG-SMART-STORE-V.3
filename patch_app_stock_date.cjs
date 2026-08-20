const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          let newStatus: 'normal' | 'low' | 'out' = 'normal';
          if (newQty <= 0) newStatus = 'out';
          else if (newQty <= item.minStock) newStatus = 'low';

          const updatedItem = { ...item, qty: newQty, status: newStatus };`;

const replacement = `          let newStatus: 'normal' | 'low' | 'out' = 'normal';
          if (newQty <= 0) newStatus = 'out';
          else if (newQty <= item.minStock) newStatus = 'low';

          const updatedItem = { ...item, qty: newQty, status: newStatus };
          
          if (newStatus === 'out' && item.status !== 'out') {
            updatedItem.outOfStockDate = new Date().toISOString();
          } else if (newStatus !== 'out' && item.status === 'out') {
            updatedItem.outOfStockDate = undefined;
          }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App outOfStockDate patched.');
} else {
  console.log('App outOfStockDate target not found.');
}
