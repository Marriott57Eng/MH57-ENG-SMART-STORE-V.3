const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  projectId: 'ai-studio-mh57engstoreapp-784a83f6-61a7-4ef0-bf35-c6f08295318f'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching inventory...");
  const snapshot = await getDocs(collection(db, 'inventory'));
  let updatedCount = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.status === 'out' && !data.outOfStockDate) {
      // Simulate it went out of stock 2 days ago
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, 'inventory', docSnap.id), {
        outOfStockDate: twoDaysAgo
      });
      console.log(`Updated ${data.name} with outOfStockDate ${twoDaysAgo}`);
      updatedCount++;
    }
  }
  console.log(`Finished updating ${updatedCount} items.`);
  process.exit(0);
}

run();
