const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Remove remaining db operations
code = code.replace(/try\s*\{\s*const batch = db\.batch\(\)[\s\S]*?console\.error\("Failed to seed Firestore", err\);\s*\}/, '');
code = code.replace(/await db\.collection\('inventory'\)\.doc\(targetItem\.id\)\.set\([^;]+\);/, '');
code = code.replace(/await db\.collection\('requisitions'\)\.doc\(recordData\.id\)\.set\([^;]+\);/, '');
code = code.replace(/const docRef = db\.collection\('inventory'\)\.doc\(id\);\s*await docRef\.set\([^;]+\);/, '');

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Cleaned server.ts");
