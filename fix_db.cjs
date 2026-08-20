const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const targetStr = `import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";`;

const replacementStr = `import { initializeApp, applicationDefault, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";`;

code = code.replace(targetStr, replacementStr);

const targetInit = `initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID,
});

const db = getFirestore();
const dbId = firebaseConfig.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID;
if (dbId) {
  db.settings({ databaseId: dbId });
}`;

const replaceInit = `const app = initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID,
});

const dbId = firebaseConfig.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID;
const db = getFirestore(app, dbId);`;

code = code.replace(targetInit, replaceInit);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Fixed getFirestore");
