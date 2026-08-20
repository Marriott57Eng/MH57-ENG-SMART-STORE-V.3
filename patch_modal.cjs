const fs = require('fs');
let code = fs.readFileSync('src/components/ItemDetailModal.tsx', 'utf-8');

const stockStatusCard = `            <div className="flex items-baseline justify-between mt-1">
              <div>
                <span className="text-3xl font-extrabold text-slate-900">{item.qty}</span>
                <span className="text-lg font-medium text-slate-600 ml-1.5">{item.unit}</span>
              </div>
            </div>
          </div>`;

const newStockStatusCard = `            <div className="flex items-baseline justify-between mt-1">
              <div>
                <span className="text-3xl font-extrabold text-slate-900">{item.qty}</span>
                <span className="text-lg font-medium text-slate-600 ml-1.5">{item.unit}</span>
              </div>
            </div>
          </div>
          
          {/* Out of Stock Details */}
          {isOut && item.outOfStockDate && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <AlertTriangle className="w-16 h-16 text-red-600" />
              </div>
              <h4 className="text-[13.5px] font-bold text-red-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                รายละเอียดการหมดสต็อก
              </h4>
              <div className="space-y-1.5 text-[13.5px] text-red-900/80">
                <p>
                  <span className="font-semibold">วันที่หมด:</span>{' '}
                  {new Date(item.outOfStockDate).toLocaleDateString('th-TH', { 
                    year: 'numeric', month: 'long', day: 'numeric', 
                  })}
                </p>
                <p>
                  <span className="font-semibold">เวลา:</span>{' '}
                  {new Date(item.outOfStockDate).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', minute: '2-digit' 
                  })} น.
                </p>
                <p className="pt-1 border-t border-red-200/50 mt-1.5 font-bold text-red-700">
                  ⚠️ สินค้าขาดสต็อกมาแล้ว {Math.max(0, Math.floor((Date.now() - new Date(item.outOfStockDate).getTime()) / (1000 * 60 * 60 * 24)))} วัน
                </p>
              </div>
            </div>
          )}`;

code = code.replace(stockStatusCard, newStockStatusCard);
fs.writeFileSync('src/components/ItemDetailModal.tsx', code);
