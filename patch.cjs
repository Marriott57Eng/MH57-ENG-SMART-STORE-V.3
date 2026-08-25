const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

let newContent = content.replace(
  '📄 หากผู้ใช้ต้องการรายงาน (PDF/Excel):',
  '🔍 หากผู้ใช้ถามหาสินค้า ค้นหาสินค้า หรือเช็คสต็อก (เพื่อให้ระบบแสดงการ์ดสินค้า):\n```json:action\n{\n  "action": "search",\n  "itemIds": ["A000000001", "A000000002"]\n}\n```\n\n📄 หากผู้ใช้ต้องการรายงาน (PDF/Excel):'
);

newContent = newContent.replace(
  'if (parsedAction.action === \'export_reports\' && Array.isArray(parsedAction.reports)) {\n            // Handled below\n          } else {',
  `if (parsedAction.action === 'export_reports' && Array.isArray(parsedAction.reports)) {
            // Handled below
          } else if (parsedAction.action === 'search' && Array.isArray(parsedAction.itemIds)) {
            // Handled below
          } else {`
);

fs.writeFileSync('server.ts', newContent);
