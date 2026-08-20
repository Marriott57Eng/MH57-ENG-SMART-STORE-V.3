const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regexLine = 'const actionMatch = rawResponseText.match(/```(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*```/);';
const debugLine = `const actionMatch = rawResponseText.match(/\\\`\\\`\\\`(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*\\\`\\\`\\\`/);
      console.log("rawResponseText length:", rawResponseText.length);
      console.log("actionMatch found?", !!actionMatch);
`;
code = code.replace(regexLine, debugLine);

const dbActionBlockEnd = `               // Save to Firestore
               await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });`;

const dbActionBlockDebugEnd = `               // Save to Firestore
               try {
                  console.log("Attempting to save to Firestore...");
                  await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });
                  console.log("Saved to Firestore successfully");
               } catch(err) {
                  console.error("Firestore save error:", err);
               }`;
code = code.replace(dbActionBlockEnd, dbActionBlockDebugEnd);

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched server.ts with debug logs");
