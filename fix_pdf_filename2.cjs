const fs = require('fs');
let code = fs.readFileSync('src/utils/pdfGenerator.ts', 'utf-8');

code = code.replace(/filename = \`ประวัติการเบิก.*?\`/g, "filename = \`Requisition_History_${now.toISOString().slice(0, 10)}.pdf\`");
code = code.replace(/filename = \`รายงาน_.*?\.pdf\`/, "filename = \`Report_${Date.now()}.pdf\`");

fs.writeFileSync('src/utils/pdfGenerator.ts', code, 'utf-8');
console.log("Fixed PDF filenames 2");
