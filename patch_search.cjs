const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldSearch = `      // 2. Smart filtering to keep context small and fast
      let matchedItems = [];
      const isSummaryRequest = pLower.includes('สรุป') || pLower.includes('ใกล้หมด') || pLower.includes('สั่งซื้อ') || pLower.includes('วิเคราะห์') || pLower.includes('ภาพรวม');
      
      if (isSummaryRequest) {
          // Only pass items that need attention (low or out of stock)
          matchedItems = items.filter(i => i.status === 'low' || i.status === 'out').slice(0, 20);
          if (matchedItems.length === 0) {
              matchedItems = items.slice(0, 5); // Just some context
          }
      } else {
          const filtered = items.filter(item => {
              const itemNameLower = item.name.toLowerCase();
              const nameInPrompt = pLower.includes(itemNameLower) || cleanPrompt.includes(itemNameLower);
              const idInPrompt = pLower.includes(item.id.toLowerCase());
              const catInPrompt = pLower.includes(item.category.toLowerCase());
              const termInItem = searchTerms.some((term: string) => 
                  itemNameLower.includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              );
              return nameInPrompt || idInPrompt || catInPrompt || termInItem;
          });
          
          if (filtered.length > 0) {
              matchedItems = filtered.slice(0, 15);
          } else {
              matchedItems = items.slice(0, 15); // fallback
          }
      }`;

const newSearch = `      // 2. Improved Context Feeding for AI Search
      let matchedItems = [];
      const isSummaryRequest = pLower.includes('สรุป') || pLower.includes('ใกล้หมด') || pLower.includes('สั่งซื้อ') || pLower.includes('วิเคราะห์') || pLower.includes('ภาพรวม');
      
      if (isSummaryRequest) {
          // Only pass items that need attention (low or out of stock) + some random for context
          matchedItems = items.filter(i => i.status === 'low' || i.status === 'out');
          if (matchedItems.length < 5) matchedItems = [...matchedItems, ...items.filter(i => i.status !== 'low' && i.status !== 'out').slice(0, 10)];
      } else {
          // Pass more items to AI to let it find the right item. Since Gemini context window is huge, we can afford passing ~100 items.
          const filtered = items.filter(item => {
              const itemNameLower = item.name.toLowerCase();
              const nameInPrompt = pLower.includes(itemNameLower) || cleanPrompt.includes(itemNameLower);
              const idInPrompt = pLower.includes(item.id.toLowerCase());
              const catInPrompt = pLower.includes(item.category.toLowerCase());
              const termInItem = searchTerms.some((term: string) => 
                  itemNameLower.includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              );
              return nameInPrompt || idInPrompt || catInPrompt || termInItem;
          });
          
          // If we find direct matches, prioritize them, but also include a chunk of other items so AI doesn't miss out due to slight misspellings
          if (filtered.length > 0) {
              matchedItems = [...new Set([...filtered, ...items])].slice(0, 100);
          } else {
              matchedItems = items.slice(0, 100); // fallback to first 100 items
          }
      }`;

if (code.includes('// 2. Smart filtering')) {
    code = code.replace(oldSearch, newSearch);
    fs.writeFileSync('server.ts', code);
    console.log("Patched search logic");
} else {
    console.log("Could not find oldSearch");
}
