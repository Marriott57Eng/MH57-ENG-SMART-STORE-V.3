const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const stateMatch = `  // Alert state`;
const statesStr = `  const [dbErrorAlert, setDbErrorAlert] = useState<string | null>(null);
  // Alert state`;
code = code.replace(stateMatch, statesStr);

const handleExecuteStr = `  const handleExecuteDbAction = (action: DbActionPayload) => {
    if (action.action === 'requisition' || action.action === 'stock_in') {`;
const handleExecuteReplacement = `  const handleExecuteDbAction = (action: DbActionPayload) => {
    if (action.action === 'error') {
      setDbErrorAlert(action.message || 'เกิดข้อผิดพลาดในการทำรายการ');
      return;
    }
    if (action.action === 'requisition' || action.action === 'stock_in') {`;
code = code.replace(handleExecuteStr, handleExecuteReplacement);

const modalStr = `        {showLowStockAlert && summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (`;
const modalReplacement = `        {dbErrorAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
               <div className="bg-red-600 p-4 text-white flex items-center gap-3">
                 <XCircle className="w-6 h-6" />
                 <h2 className="font-bold text-lg">รายการไม่สำเร็จ</h2>
               </div>
               <div className="p-5">
                 <p className="text-sm text-slate-600 mb-4 font-medium">
                   {dbErrorAlert}
                 </p>
                 <div className="flex justify-end mt-4">
                   <button 
                     onClick={() => setDbErrorAlert(null)}
                     className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                   >
                     ปิดหน้าต่าง
                   </button>
                 </div>
               </div>
             </div>
          </div>
        )}

        {showLowStockAlert && summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (`;
code = code.replace(modalStr, modalReplacement);

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Updated App.tsx successfully with db error alert");
