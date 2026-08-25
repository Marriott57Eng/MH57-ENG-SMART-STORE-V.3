const fs = require('fs');
let content = fs.readFileSync('src/utils/excelGenerator.ts', 'utf8');

content = content.replace(
  'const sortedReqs = [...requisitions].sort((a, b) => {',
  `let reqs = requisitions;
    if (options.userFilter) {
      const lowerFilter = options.userFilter.toLowerCase();
      reqs = reqs.filter(r => (r.requestedBy && r.requestedBy.toLowerCase().includes(lowerFilter)));
    }
    const sortedReqs = [...reqs].sort((a, b) => {`
);
fs.writeFileSync('src/utils/excelGenerator.ts', content);
