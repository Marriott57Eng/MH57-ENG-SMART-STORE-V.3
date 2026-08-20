const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf-8');

code = code.replace(/status: 'normal' \| 'low' \| 'out';/, "status: 'normal' | 'low' | 'out';\n  outOfStockDate?: string;");

fs.writeFileSync('src/types.ts', code);
