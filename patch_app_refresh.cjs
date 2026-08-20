const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldFetch2 = `      if (!forceRefresh) {
        const snapshot = await getDocs(collection(db, 'inventory'));
        inventoryData = snapshot.docs.map(doc => doc.data() as InventoryItem);
      }

      if (inventoryData.length === 0 || forceRefresh) {
        const res = await fetch(\`/api/inventory\${forceRefresh ? '?refresh=true' : ''}\`);
        if (!res.ok) throw new Error('Failed to fetch inventory from Google Sheet');
        const data = await res.json();
        inventoryData = data.items || [];
        summaryData = data.summary || null;

        // Seed to Firestore in background
        inventoryData.forEach(item => {
          setDoc(doc(db, 'inventory', item.id), item).catch(console.error);
        });
      }`;

const newFetch2 = `      // Always pull from Firestore as source of truth
      const snapshot = await getDocs(collection(db, 'inventory'));
      inventoryData = snapshot.docs.map(doc => doc.data() as InventoryItem);

      // If Firestore is empty, we seed from Google Sheets (initial load only)
      if (inventoryData.length === 0) {
        const res = await fetch(\`/api/inventory?refresh=true\`);
        if (!res.ok) throw new Error('Failed to fetch inventory from Google Sheet');
        const data = await res.json();
        inventoryData = data.items || [];
        summaryData = data.summary || null;

        // Seed to Firestore
        const promises = inventoryData.map(item => setDoc(doc(db, 'inventory', item.id), item));
        await Promise.all(promises).catch(console.error);
      }`;

code = code.replace(oldFetch2, newFetch2);
fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Patched App.tsx refresh logic");
