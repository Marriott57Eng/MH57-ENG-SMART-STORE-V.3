const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  projectId: "fake-project"
});

try {
  const db = getFirestore("fake-db");
  console.log("Passed string!");
} catch (e) {
  console.log("Error string", e.message);
}

try {
  const db = getFirestore({ databaseId: "fake-db" });
  console.log("Passed object!");
} catch (e) {
  console.log("Error object", e.message);
}
