const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Add states
const stateMatch = `  // Search & Filter state`;
const statesStr = `  // Alert state
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [hasShownAlert, setHasShownAlert] = useState(false);

  // Search & Filter state`;
code = code.replace(stateMatch, statesStr);

// Modify fetchInventory
const fetchInventoryStr = `      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || null);`;
const fetchInventoryReplacement = `      const data = await res.json();
      setItems(data.items || []);
      setSummary(data.summary || null);
      
      // Trigger low stock alert if needed
      if (data.summary && (data.summary.lowStockCount > 0 || data.summary.outOfStockCount > 0)) {
        if (!hasShownAlert) {
          setShowLowStockAlert(true);
          setHasShownAlert(true);
        }
      }`;
code = code.replace(fetchInventoryStr, fetchInventoryReplacement);

// Add modal JSX before closing tags
const modalStr = `        {/* Mobile Bottom Navigation Bar */}
        <MobileNavbar`;
const modalReplacement = `        {showLowStockAlert && summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
               <div className="bg-amber-500 p-4 text-white flex items-center gap-3">
                 <AlertTriangle className="w-6 h-6" />
                 <h2 className="font-bold text-lg">แจ้งเตือนสินค้าสต็อกต่ำ!</h2>
               </div>
               <div className="p-5">
                 <p className="text-sm text-slate-600 mb-4">
                   พบว่ามีสินค้า <b>{summary.lowStockCount || 0}</b> รายการใกล้หมด และ <b>{summary.outOfStockCount || 0}</b> รายการหมดสต็อกแล้ว<br/><br/>
                   <span className="text-red-600 font-semibold">กรุณาตรวจสอบและดำเนินการเขียนใบสั่งซื้อ (PR) เพื่อเติมสต็อกโดยด่วน</span>
                 </p>
                 <div className="flex justify-end gap-2 mt-4">
                   <button 
                     onClick={() => setShowLowStockAlert(false)}
                     className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                   >
                     ปิดหน้าต่าง
                   </button>
                   <button 
                     onClick={() => {
                       setShowLowStockAlert(false);
                       setStatusFilter('low');
                       setActiveTab('inventory');
                     }}
                     className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600 transition-colors cursor-pointer"
                   >
                     ดูรายการสินค้า
                   </button>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <MobileNavbar`;
code = code.replace(modalStr, modalReplacement);

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Updated App.tsx successfully");
