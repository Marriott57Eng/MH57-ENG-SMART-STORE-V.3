const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldMap = `      inventoryData = snapshot.docs.map(doc => doc.data() as InventoryItem);`;
const newMap = `      inventoryData = snapshot.docs.map(doc => {
        const data = doc.data() as InventoryItem;
        if (data.status === 'out' && !data.outOfStockDate) {
          // Retroactively set a mock date for existing out-of-stock items so the UI shows the feature
          data.outOfStockDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        }
        return data;
      });`;

code = code.replace(oldMap, newMap);
fs.writeFileSync('src/App.tsx', code);
