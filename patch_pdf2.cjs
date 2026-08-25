const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfGenerator.ts', 'utf8');

content = content.replace(
  "subtitle = 'คลังสินค้า Store FL.6 | ผู้ทำรายการ: ' + options.userFilter;",
  "subtitle = 'คลังสินค้า Store FL.6 | ผู้ทำรายการ: ' + options.userFilter;\n      filename = `Requisition_History_${options.userFilter.replace(/\\s+/g, '_')}_${now.toISOString().slice(0, 10)}.pdf`;"
);
fs.writeFileSync('src/utils/pdfGenerator.ts', content);
