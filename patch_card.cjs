const fs = require('fs');
let code = fs.readFileSync('src/components/ItemCard.tsx', 'utf-8');

const oldOut = `    if (item.status === 'out') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
          <XCircle className="w-6 h-6" /> หมด
        </span>
      );
    }`;

const newOut = `    if (item.status === 'out') {
      const daysOut = item.outOfStockDate ? Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24))) : null;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
          <XCircle className="w-6 h-6" /> หมด {daysOut !== null ? \`(\${daysOut} วัน)\` : ''}
        </span>
      );
    }`;

code = code.replace(oldOut, newOut);
fs.writeFileSync('src/components/ItemCard.tsx', code);
