const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const oldErrToast = `        addToast({ 
          type: 'error', 
          title: '⚠️ สินค้าหมดสต็อก!', 
          message: \`\${it.name} หมดสต็อกแล้ว กรุณาสั่งซื้อเพิ่ม\`,
          actionText: 'ดูสินค้า',`;
          
const newErrToast = `        addToast({ 
          type: 'error', 
          title: '⚠️ สินค้าหมดสต็อก!', 
          message: \`\${it.name} หมดสต็อกแล้ว (คงเหลือ 0 \${it.unit})\`,
          actionText: 'ดูสินค้า',`;

code = code.replace(oldErrToast, newErrToast);
fs.writeFileSync('src/App.tsx', code);
