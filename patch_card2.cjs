const fs = require('fs');
let code = fs.readFileSync('src/components/ItemCard.tsx', 'utf-8');

const oldOut = `    if (item.status === 'out') {
      const daysOut = item.outOfStockDate ? Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24))) : null;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
          <XCircle className="w-6 h-6" /> หมด {daysOut !== null ? \`(\${daysOut} วัน)\` : ''}
        </span>
      );
    }`;

const newOut = `    if (item.status === 'out') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
          <XCircle className="w-6 h-6" /> หมด
        </span>
      );
    }`;

code = code.replace(oldOut, newOut);

const oldLocation = `          {/* Location info */}
          <div className="flex items-center gap-1 text-slate-400 text-sm mt-1.5">
            <MapPin className="w-6 h-6 text-slate-400 shrink-0" />
            <span className="truncate max-w-[140px]">{item.location || 'Store FL.6'}</span>
          </div>
        </div>`;

const newLocation = `          {/* Location info */}
          <div className="flex flex-col gap-2 mt-1.5">
            <div className="flex items-center gap-1 text-slate-400 text-sm">
              <MapPin className="w-6 h-6 text-slate-400 shrink-0" />
              <span className="truncate max-w-[140px]">{item.location || 'Store FL.6'}</span>
            </div>
            
            {/* Days Out of Stock Alert */}
            {item.status === 'out' && item.outOfStockDate && (
              <div className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md shadow-xs">
                <AlertTriangle className="w-4 h-4" />
                ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน
              </div>
            )}
          </div>
        </div>`;

code = code.replace(oldLocation, newLocation);

fs.writeFileSync('src/components/ItemCard.tsx', code);
