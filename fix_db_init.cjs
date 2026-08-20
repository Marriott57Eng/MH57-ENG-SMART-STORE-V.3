const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

const oldInit = `import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();`;

const newInit = `import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

let firebaseConfig = { projectId: "", firestoreDatabaseId: "(default)" };
try {
  if (fs.existsSync('firebase-applet-config.json')) {
    firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
  }
} catch (err) {
  console.warn("Could not load firebase-applet-config.json");
}

initializeApp({
  credential: applicationDefault(),
  projectId: firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID,
});

const db = getFirestore();
const dbId = firebaseConfig.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID;
if (dbId) {
  db.settings({ databaseId: dbId });
}
`;

code = code.replace(oldInit, newInit);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Fixed Firebase initialization.");
