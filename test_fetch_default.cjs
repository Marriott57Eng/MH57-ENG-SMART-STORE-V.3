const { initializeApp, applicationDefault, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp({
  credential: applicationDefault(),
  projectId: config.projectId
});

const db = getFirestore(app);

async function run() {
  try {
    const snap = await db.collection('requisitions').limit(1).get();
    console.log("Success! Docs:", snap.docs.length);
  } catch(e) {
    console.log("Error default:", e.message);
  }
}
run();
