const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldSave = `               // Save to Firestore
               await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });

               dbAction = {`;

const newSave = `               // Save to Firestore
               const recordData = {
                   id: \`REQ-\${Date.now().toString().slice(-4)}\`,
                   type: isStockIn ? 'in' : 'out',
                   itemId: targetItem.id,
                   itemName: targetItem.name,
                   category: targetItem.category,
                   qty: actionQty,
                   unit: targetItem.unit,
                   requestedBy: parsedAction.requestedBy || 'ผู้ใช้งาน',
                   purpose: parsedAction.purpose || 'ใช้งาน',
                   isoDate: new Date().toISOString(),
                   timestamp: new Date().toLocaleString('th-TH', { 
                     day: 'numeric', month: 'short', year: 'numeric', 
                     hour: '2-digit', minute: '2-digit' 
                   }) + ' น.',
                   note: parsedAction.note || 'บันทึกอัตโนมัติโดย AI ผู้ช่วย'
               };
               
               await db.collection('inventory').doc(targetItem.id).set(updatedItem, { merge: true });
               await db.collection('requisitions').doc(recordData.id).set(recordData);

               dbAction = {`;

code = code.replace(oldSave, newSave);

const oldRecord = `                 record: {
                   id: \`REQ-\${Date.now().toString().slice(-4)}\`,
                   type: isStockIn ? 'in' : 'out',
                   itemId: targetItem.id,
                   itemName: targetItem.name,
                   category: targetItem.category,
                   qty: actionQty,
                   unit: targetItem.unit,
                   requestedBy: parsedAction.requestedBy || 'ผู้ใช้งาน',
                   purpose: parsedAction.purpose || 'ใช้งาน',
                   isoDate: new Date().toISOString(),
                   timestamp: new Date().toLocaleString('th-TH', { 
                     day: 'numeric', month: 'short', year: 'numeric', 
                     hour: '2-digit', minute: '2-digit' 
                   }) + ' น.',
                   note: parsedAction.note || 'บันทึกอัตโนมัติโดย AI ผู้ช่วย'
                 }`;

const newRecord = `                 record: recordData`;
code = code.replace(oldRecord, newRecord);

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched server.ts to save requisitions to Firestore");
