const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const insertPos = code.indexOf('  // API: Update item stock directly');
if (insertPos !== -1) {
  const newEndpoint = `  // API: Get Requisitions
  app.get("/api/requisitions", async (req, res) => {
    try {
      const snapshot = await db.collection('requisitions').orderBy('isoDate', 'desc').limit(100).get();
      const records = snapshot.docs.map(doc => doc.data());
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });\n\n`;
  code = code.slice(0, insertPos) + newEndpoint + code.slice(insertPos);
  fs.writeFileSync('server.ts', code, 'utf-8');
  console.log("Added GET /api/requisitions");
}
