const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const strToReplace = `  try {
    const snapshot = await db.collection('inventory').get();
    if (!snapshot.empty && !force) {
      const items = snapshot.docs.map(doc => doc.data() as Item);
      return items.sort((a,b) => a.id.localeCompare(b.id));
    }
  } catch (err) {
  }`;

code = code.replace(strToReplace, '');

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Cleaned server.ts 3");
