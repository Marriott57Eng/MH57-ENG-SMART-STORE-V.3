const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importTarget = `import { collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';`;
const importReplacement = `import { collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';`;

if (code.includes(importTarget)) {
  code = code.replace(importTarget, importReplacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('Import patched.');
} else {
  console.log('Import target not found.');
}
