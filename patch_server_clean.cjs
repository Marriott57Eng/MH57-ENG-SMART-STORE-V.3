const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regexDebug = `const actionMatch = rawResponseText.match(/\\\`\\\`\\\`(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*\\\`\\\`\\\`/);
      console.log("rawResponseText length:", rawResponseText.length);
      console.log("actionMatch found?", !!actionMatch);`;
const regexClean = `const actionMatch = rawResponseText.match(/\\\`\\\`\\\`(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*\\\`\\\`\\\`/);`;
code = code.replace(regexDebug, regexClean);

const dbActionBlockDebug = `               // Save to Firestore
               try {
                  console.log("Attempting to save to Firestore...");
                  await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });
                  console.log("Saved to Firestore successfully");
               } catch(err) {
                  console.error("Firestore save error:", err);
               }`;
const dbActionBlockClean = `               // Save to Firestore
               await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });`;
code = code.replace(dbActionBlockDebug, dbActionBlockClean);

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Cleaned server.ts");
