const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `      if (action.item) {
        setDoc(doc(db, 'inventory', action.item!.id), action.item!).catch(err => console.error("Failed to update inventory", err));
        setItems((prev) =>
          prev.map((i) => (i.id === action.item!.id ? action.item! : i))
        );
      }`;

const replacement = `      if (action.item) {
        const itemToSave = { ...action.item };
        // Check for outOfStockDate logic
        const oldItem = items.find(i => i.id === itemToSave.id);
        if (itemToSave.status === 'out' && oldItem?.status !== 'out') {
          itemToSave.outOfStockDate = new Date().toISOString();
        } else if (itemToSave.status !== 'out' && oldItem?.status === 'out') {
          itemToSave.outOfStockDate = undefined;
        }

        setDoc(doc(db, 'inventory', itemToSave.id), itemToSave).catch(err => console.error("Failed to update inventory", err));
        setItems((prev) =>
          prev.map((i) => (i.id === itemToSave.id ? itemToSave : i))
        );
      }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  // Do it twice because it appears in `update_stock` as well
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log('App AI outOfStockDate patched.');
} else {
  console.log('App AI outOfStockDate target not found.');
}
