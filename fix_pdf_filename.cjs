const fs = require('fs');
let code = fs.readFileSync('src/utils/pdfGenerator.ts', 'utf-8');

code = code.replace(/filename = \`รายงานประวัติ.*?\`/g, "filename = \`Requisition_History_${now.toISOString().slice(0, 10)}.pdf\`");
code = code.replace(/filename = \`สินค้าใกล้หมด.*?\`/g, "filename = \`Low_Stock_Report_${now.toISOString().slice(0, 10)}.pdf\`");
code = code.replace(/filename = \`สต็อกหมวด_.*?\`/g, "filename = \`Category_Report_${now.toISOString().slice(0, 10)}.pdf\`");
code = code.replace(/filename = \`รายงานคลังสินค้าทั้งหมด.*?\`/g, "filename = \`Inventory_All_${now.toISOString().slice(0, 10)}.pdf\`");

fs.writeFileSync('src/utils/pdfGenerator.ts', code, 'utf-8');
console.log("Fixed PDF filenames");
