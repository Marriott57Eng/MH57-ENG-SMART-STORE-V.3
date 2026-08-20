const { initializeApp, applicationDefault, getApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  projectId: "fake-project"
});

const app = getApp();

try {
  const db = getFirestore(app, "fake-db");
  console.log("Passed app, string!", db.databaseId);
} catch (e) {
  console.log("Error app string", e.message);
}

try {
  const db = getFirestore(app);
  console.log("Passed app only!", db.databaseId);
} catch (e) {
  console.log("Error app only", e.message);
}

