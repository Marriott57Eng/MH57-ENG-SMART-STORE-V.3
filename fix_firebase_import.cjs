const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace('import admin from "firebase-admin";', 'import { initializeApp } from "firebase-admin/app";\nimport { getFirestore } from "firebase-admin/firestore";');
code = code.replace('admin.initializeApp();', 'initializeApp();');
code = code.replace('const db = admin.firestore();', 'const db = getFirestore();');

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Fixed firebase-admin imports.");
