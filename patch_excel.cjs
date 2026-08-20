const fs = require('fs');
let code = fs.readFileSync('src/utils/excelGenerator.ts', 'utf-8');

code = code.replace(/item\.quantity/g, "item.qty");
code = code.replace(/req\.quantity/g, "req.qty");
code = code.replace(/req\.person/g, "req.requestedBy");

fs.writeFileSync('src/utils/excelGenerator.ts', code);
