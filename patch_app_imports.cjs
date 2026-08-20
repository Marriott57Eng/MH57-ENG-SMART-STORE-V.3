const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `import { collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';`;
const replacement = `import { collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App imports patched.');
} else {
  console.log('App imports target not found.');
}
