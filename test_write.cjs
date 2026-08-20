const { initializeApp, applicationDefault, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf-8'));
const app = initializeApp({
  credential: applicationDefault(),
  projectId: config.projectId
});

const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    await db.collection('test').doc('test').set({ a: 1 });
    console.log("Success write!");
  } catch(e) {
    console.log("Error write:", e.message);
  }
}
run();
