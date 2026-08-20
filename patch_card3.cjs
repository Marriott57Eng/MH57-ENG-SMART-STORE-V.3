const fs = require('fs');
let code = fs.readFileSync('src/components/ItemCard.tsx', 'utf-8');

const oldLocation = `            {/* Days Out of Stock Alert */}
            {item.status === 'out' && item.outOfStockDate && (
              <div className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md shadow-xs">
                <AlertTriangle className="w-4 h-4" />
                ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน
              </div>
            )}
          </div>
        </div>`;

const newLocation = `            {/* Days Out of Stock Alert */}
            {item.status === 'out' && (
              <div className="flex flex-col gap-1 mt-1">
                {item.outOfStockDate ? (
                  <div className="inline-flex flex-col w-fit gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1.5 rounded-md shadow-xs">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>หมดสต็อกตั้งแต่: {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} เวลา {new Date(item.outOfStockDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span>
                    </div>
                    <div className="ml-5 text-red-600">
                      (ขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน)
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md shadow-xs">
                    <AlertTriangle className="w-4 h-4" />
                    สินค้าหมด (ไม่ได้บันทึกเวลา)
                  </div>
                )}
              </div>
            )}
          </div>
        </div>`;

code = code.replace(oldLocation, newLocation);

fs.writeFileSync('src/components/ItemCard.tsx', code);
