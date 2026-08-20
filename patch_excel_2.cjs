const fs = require('fs');
let code = fs.readFileSync('src/utils/excelGenerator.ts', 'utf-8');

code = code.replace(/req\.type === 'withdraw'/g, "req.type === 'out'");
code = code.replace(/item\.status === 'in_stock'/g, "item.status === 'normal'");

fs.writeFileSync('src/utils/excelGenerator.ts', code);
