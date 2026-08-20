const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldRAG = `      // RAG: Filter items based on prompt keywords to drastically reduce context size
      const searchTerms = prompt.toLowerCase().split(/\\s+/).filter((t: string) => t.length > 1);
      let matchedItems = items;
      if (searchTerms.length > 0) {
          const filtered = items.filter(item => 
              searchTerms.some((term: string) => 
                  item.name.toLowerCase().includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              )
          );
          if (filtered.length > 0) {
              matchedItems = filtered.slice(0, 50); // limit to top 50 matches
          } else {
              matchedItems = items.slice(0, 50); // fallback to first 50
          }
      } else {
          matchedItems = items.slice(0, 50);
      }`;

const newRAG = `      // Improved RAG: Smart context filtering for Thai Language
      const pLower = prompt.toLowerCase();
      // 1. Remove common action/stop words to isolate nouns
      const cleanPrompt = pLower.replace(/(เบิก|ขอ|เพิ่ม|รับเข้า|ค้นหา|มี|ไหม|สต็อก|จำนวน|ช่วย|หน่อย|อัปเดต|เอา|สินค้า|กี่|แผ่น|ชิ้น|อัน|หลอด|ม้วน|แกลลอน|กล่อง|ตัว)/g, '');
      const searchTerms = pLower.split(/\\s+/).filter((t: string) => t.length > 1);
      
      // 2. Pass everything if the inventory is small enough (up to 150 items is easily handled by Gemini)
      let matchedItems = items;
      
      if (items.length > 150) {
          const filtered = items.filter(item => {
              const itemNameLower = item.name.toLowerCase();
              // Check if prompt contains the exact item name (good for Thai where words don't have spaces)
              const nameInPrompt = pLower.includes(itemNameLower) || cleanPrompt.includes(itemNameLower);
              const idInPrompt = pLower.includes(item.id.toLowerCase());
              const catInPrompt = pLower.includes(item.category.toLowerCase());
              
              // Check if any whitespace-separated term is inside the item name (good for partial matches)
              const termInItem = searchTerms.some((term: string) => 
                  itemNameLower.includes(term) || 
                  item.id.toLowerCase().includes(term) ||
                  item.category.toLowerCase().includes(term)
              );
              
              return nameInPrompt || idInPrompt || catInPrompt || termInItem;
          });
          
          if (filtered.length > 0) {
              matchedItems = filtered.slice(0, 150);
          } else {
              matchedItems = items.slice(0, 150); // fallback
          }
      }`;

code = code.replace(oldRAG, newRAG);
fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched RAG system successfully");
