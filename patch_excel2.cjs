const fs = require('fs');
let content = fs.readFileSync('src/utils/excelGenerator.ts', 'utf8');

content = content.replace(
  "filename = 'Transaction_History.xlsx';",
  "filename = options.userFilter ? `Transaction_History_${options.userFilter.replace(/\\s+/g, '_')}.xlsx` : 'Transaction_History.xlsx';"
);
fs.writeFileSync('src/utils/excelGenerator.ts', content);
