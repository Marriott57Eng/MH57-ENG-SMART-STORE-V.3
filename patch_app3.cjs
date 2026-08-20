const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const handleExecuteDbActionStr = `  // Handle database modifications executed by AI
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
    } else if (action.action === 'delete_record' && action.recordId) {
      setRequisitions((prev) => prev.filter((r) => r.id !== action.recordId));
      deleteDoc(doc(db, 'requisitions', action.recordId)).catch(err => console.error("Failed to delete requisition", err));
    }
  };`;

const newHandleExecuteDbActionStr = `  // Handle database modifications executed by AI
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
    } else if (action.action === 'delete_record' && action.recordId) {
      setRequisitions((prev) => prev.filter((r) => r.id !== action.recordId));
      deleteDoc(doc(db, 'requisitions', action.recordId)).catch(err => console.error("Failed to delete requisition", err));
    }

    // Popup Warning for low stock after requisition
    if (action.action === 'requisition' && action.item) {
      const it = action.item;
      if (it.qty <= 0) {
        addToast({ 
          type: 'error', 
          title: '⚠️ สินค้าหมดสต็อก!', 
          message: \`\${it.name} หมดสต็อกแล้ว กรุณาสั่งซื้อเพิ่ม\`,
          actionText: 'ดูสินค้า',
          onClick: () => {
            setSelectedItem(it);
            setActiveTab('inventory');
          }
        });
      } else if (it.qty <= it.minStock) {
        addToast({ 
          type: 'warning', 
          title: '⚠️ สินค้าใกล้หมด', 
          message: \`\${it.name} เหลือเพียง \${it.qty} \${it.unit}\`,
          actionText: 'ดูสินค้า',
          onClick: () => {
            setSelectedItem(it);
            setActiveTab('inventory');
          }
        });
      }
    }
  };`;

if (code.includes('const handleExecuteDbAction = (action: DbActionPayload) => {') && !code.includes('// Popup Success')) {
  code = code.replace(handleExecuteDbActionStr, newHandleExecuteDbActionStr);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Patched handleExecuteDbAction");
} else {
  console.log("Could not find handleExecuteDbActionStr or already patched.");
}
