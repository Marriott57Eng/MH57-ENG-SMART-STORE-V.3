const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');

code = code.replace(
  "  action: 'requisition' | 'stock_in' | 'update_stock' | 'delete_record';",
  "  action: 'requisition' | 'stock_in' | 'update_stock' | 'delete_record' | 'error';"
);

fs.writeFileSync('src/types.ts', code, 'utf-8');
console.log("Updated types.ts");
