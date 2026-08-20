const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();
async function run() {
    try {
        await db.collection('inventory').doc('ITEM-1').set({qty: 5}, { merge: true });
        console.log("Success");
    } catch(e) {
        console.error("Firestore error:", e);
    }
}
run();
