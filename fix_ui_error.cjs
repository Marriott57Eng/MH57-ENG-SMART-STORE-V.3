const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const oldHeader = `{msg.dbAction.action === 'stock_in' && <ArrowUpRight className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'requisition' && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'update_stock' && <Sliders className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'delete_record' && <Trash2 className="w-3.5 h-3.5" />}`;

const newHeader = `{msg.dbAction.action === 'stock_in' && <ArrowUpRight className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'requisition' && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'update_stock' && <Sliders className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'delete_record' && <Trash2 className="w-3.5 h-3.5" />}
                          {msg.dbAction.action === 'error' && <AlertCircle className="w-3.5 h-3.5" />}`;

code = code.replace(oldHeader, newHeader);

const oldText = `{msg.dbAction.action === 'stock_in' && '✅ บันทึกรับเข้าสินค้า (Stock In)'}
                            {msg.dbAction.action === 'requisition' && '✅ บันทึกการเบิกสินค้า (Stock Out)'}
                            {msg.dbAction.action === 'update_stock' && '✅ ปรับปรุงยอดสต็อกสินค้า'}
                            {msg.dbAction.action === 'delete_record' && '✅ ลบประวัติเรียบร้อยแล้ว'}`;

const newText = `{msg.dbAction.action === 'stock_in' && '✅ บันทึกรับเข้าสินค้า (Stock In)'}
                            {msg.dbAction.action === 'requisition' && '✅ บันทึกการเบิกสินค้า (Stock Out)'}
                            {msg.dbAction.action === 'update_stock' && '✅ ปรับปรุงยอดสต็อกสินค้า'}
                            {msg.dbAction.action === 'delete_record' && '✅ ลบประวัติเรียบร้อยแล้ว'}
                            {msg.dbAction.action === 'error' && '❌ ไม่สามารถดำเนินการได้'}`;

code = code.replace(oldText, newText);

const oldSubText = `<span className="text-[10px] text-slate-500">อัปเดตฐานข้อมูลคลังสินค้าอัตโนมัติ</span>`;
const newSubText = `<span className="text-[10px] text-slate-500">
                            {msg.dbAction.action === 'error' ? msg.dbAction.message : 'อัปเดตฐานข้อมูลคลังสินค้าอัตโนมัติ'}
                          </span>`;

code = code.replace(oldSubText, newSubText);

const importRegex = /import \{([^}]+)\} from 'lucide-react';/;
const match = code.match(importRegex);
if (match) {
  if (!match[1].includes('AlertCircle')) {
    code = code.replace(importRegex, `import { $1, AlertCircle } from 'lucide-react';`);
  }
}

fs.writeFileSync('src/components/VoiceAssistantView.tsx', code, 'utf-8');
console.log("Patched VoiceAssistantView UI error");
