const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regex = /try\s*\{\s*const snapshot = await db\.collection\('inventory'\)\.get\(\);[\s\S]*?\} catch \(err\) \{\s*\}/;
code = code.replace(regex, '');

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Cleaned server.ts 2");
