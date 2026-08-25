const fs = require('fs');
let content = fs.readFileSync('src/utils/pdfGenerator.ts', 'utf8');

content = content.replace(
  "    const totalOut = requisitions.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);",
  `    let reqs = requisitions;
    if (options.userFilter) {
      const lowerFilter = options.userFilter.toLowerCase();
      reqs = reqs.filter(r => (r.requestedBy && r.requestedBy.toLowerCase().includes(lowerFilter)));
      subtitle = 'คลังสินค้า Store FL.6 | ผู้ทำรายการ: ' + options.userFilter;
    }
    const totalOut = reqs.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);`
);

content = content.replace(
  "const totalIn = requisitions.filter(r => r.type === 'in').reduce((sum, r) => sum + r.qty, 0);",
  "const totalIn = reqs.filter(r => r.type === 'in').reduce((sum, r) => sum + r.qty, 0);"
);

content = content.replace(
  "const uniquePeople = new Set(requisitions.map(r => r.requestedBy)).size;",
  "const uniquePeople = new Set(reqs.map(r => r.requestedBy)).size;"
);

content = content.replace(
  "requisitions.length} รายการ</div>",
  "reqs.length} รายการ</div>"
);

content = content.replace(
  "requisitions.length === 0",
  "reqs.length === 0"
);

content = content.replace(
  "requisitions\n                  .map((rec, idx) => {",
  "reqs\n                  .map((rec, idx) => {"
);
content = content.replace(
  "requisitions.map((rec, idx) => {",
  "reqs.map((rec, idx) => {"
);
fs.writeFileSync('src/utils/pdfGenerator.ts', content);
