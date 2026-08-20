const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace("  // API: Get Requisitions\n      }\n  });", "");

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Fixed syntax in server.ts");
