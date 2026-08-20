const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Imports
code = code.replace(/import \{ CategoryView \} from '\.\/components\/CategoryView';/, "import { CategoryView } from './components/CategoryView';\nimport { Toast, ToastMessage } from './components/Toast';");

// States
const stateAnchor = "  const [dbErrorAlert, setDbErrorAlert] = useState<string | null>(null);";
const stateCode = `  const [dbErrorAlert, setDbErrorAlert] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    setToasts(prev => [{ ...toast, id: Date.now().toString() + Math.random() }, ...prev]);
  };
  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));`;
code = code.replace(stateAnchor, stateCode);

// handleExecuteDbAction
const handleExecuteStr = `  // Handle database modifications executed by AI
  const handleExecuteDbAction = (action: DbActionPayload) => {
    if (action.action === 'error') {
      setDbErrorAlert(action.message || 'เกิดข้อผิดพลาดในการทำรายการ');
      return;
    }
    if (action.action === 'requisition' || action.action === 'stock_in') {
      if (action.record) {
        setRequisitions((prev) => [action.record!, ...prev]);
        setDoc(doc(db, 'requisitions', action.record!.id), action.record!).catch(err => console.error("Failed to save requisition", err));
      }
      if (action.item) {
        setDoc(doc(db, 'inventory', action.item!.id), action.item!).catch(err => console.error("Failed to update inventory", err));
        setItems((prev) =>
          prev.map((i) => (i.id === action.item!.id ? action.item! : i))
        );
      }
    } else if (action.action === 'update_stock') {
      if (action.item) {
        setDoc(doc(db, 'inventory', action.item!.id), action.item!).catch(err => console.error("Failed to update inventory", err));
        setItems((prev) =>
          prev.map((i) => (i.id === action.item!.id ? action.item! : i))
        );
      }
    }
  };`;

const newHandleExecuteStr = `  // Handle database modifications executed by AI
  const handleExecuteDbAction = (action: DbActionPayload) => {
    if (action.action === 'error') {
      addToast({ type: 'error', title: 'ไม่สามารถทำรายการได้', message: action.message || 'เกิดข้อผิดพลาด' });
      setDbErrorAlert(action.message || 'เกิดข้อผิดพลาดในการทำรายการ');
      return;
    }
    
    // Popup Success
    if (action.action === 'requisition') {
      addToast({ type: 'success', title: 'เบิกสินค้าสำเร็จ', message: \`เบิก \${action.item?.name || 'สินค้า'} จำนวน \${action.record?.qty || 0}\` });
    } else if (action.action === 'stock_in') {
      addToast({ type: 'success', title: 'รับเข้าสินค้าสำเร็จ', message: \`รับเข้า \${action.item?.name || 'สินค้า'} จำนวน \${action.record?.qty || 0}\` });
    } else if (action.action === 'update_stock') {
      addToast({ type: 'success', title: 'อัปเดตสต็อกสำเร็จ', message: \`อัปเดต \${action.item?.name || 'สินค้า'} เรียบร้อย\` });
    }

    if (action.action === 'requisition' || action.action === 'stock_in') {
      if (action.record) {
        setRequisitions((prev) => [action.record!, ...prev]);
        setDoc(doc(db, 'requisitions', action.record!.id), action.record!).catch(err => console.error("Failed to save requisition", err));
      }
      if (action.item) {
        setDoc(doc(db, 'inventory', action.item!.id), action.item!).catch(err => console.error("Failed to update inventory", err));
        setItems((prev) =>
          prev.map((i) => (i.id === action.item!.id ? action.item! : i))
        );
      }
    } else if (action.action === 'update_stock') {
      if (action.item) {
        setDoc(doc(db, 'inventory', action.item!.id), action.item!).catch(err => console.error("Failed to update inventory", err));
        setItems((prev) =>
          prev.map((i) => (i.id === action.item!.id ? action.item! : i))
        );
      }
    }

    // Popup Warning for low stock after requisition
    if (action.action === 'requisition' && action.item) {
      if (action.item.qty <= 0) {
        addToast({ type: 'error', title: '⚠️ สินค้าหมดสต็อก!', message: \`\${action.item.name} หมดสต็อกแล้ว กรุณาสั่งซื้อเพิ่ม\` });
      } else if (action.item.qty <= action.item.minStock) {
        addToast({ type: 'warning', title: '⚠️ สินค้าใกล้หมด', message: \`\${action.item.name} เหลือเพียง \${action.item.qty} \${action.item.unit}\` });
      }
    }
  };`;

code = code.replace(handleExecuteStr, newHandleExecuteStr);

// Toasts Container
const renderEnd = `      {/* Voice Assistant Overlay Tab */}`;
const newRenderEnd = `      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-auto">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>

      {/* Voice Assistant Overlay Tab */}`;
code = code.replace(renderEnd, newRenderEnd);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx with Toast support");
