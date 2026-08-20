const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldCode = `      if (!summaryData && inventoryData.length > 0) {
        summaryData = {
          totalItems: inventoryData.length,
          totalQty: inventoryData.reduce((sum, item) => sum + item.qty, 0),
          lowStockCount: inventoryData.filter(i => i.status === 'low').length,
          outOfStockCount: inventoryData.filter(i => i.status === 'out').length,
          categories: {}
        };
      }

      setItems(inventoryData);
      setSummary(summaryData);
      
      // Fetch requisitions
      fetchRequisitions();
      
      // Trigger low stock alert if needed
      if (data.summary && (data.summary.lowStockCount > 0 || data.summary.outOfStockCount > 0)) {`;

const newCode = `      if (!summaryData && inventoryData.length > 0) {
        const categoryMap = new Map();
        inventoryData.forEach(item => {
          const cat = categoryMap.get(item.category) || { count: 0, totalQty: 0 };
          cat.count++;
          cat.totalQty += item.qty;
          categoryMap.set(item.category, cat);
        });

        summaryData = {
          totalItems: inventoryData.length,
          totalQty: inventoryData.reduce((sum, item) => sum + item.qty, 0),
          lowStockCount: inventoryData.filter(i => i.status === 'low').length,
          outOfStockCount: inventoryData.filter(i => i.status === 'out').length,
          categories: Array.from(categoryMap.entries()).map(([name, stats]) => ({
            name,
            ...stats
          }))
        };
      }

      setItems(inventoryData);
      setSummary(summaryData);
      
      // Fetch requisitions
      fetchRequisitions();
      
      // Trigger low stock alert if needed
      if (summaryData && (summaryData.lowStockCount > 0 || summaryData.outOfStockCount > 0)) {`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Patched App.tsx errors");
