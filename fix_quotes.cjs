const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  '9. เมื่อผู้ใช้ถามถึงสินค้าที่มีจำนวนมากที่สุด หรือน้อยที่สุด ให้เรียกใช้ฟังก์ชัน `get_stock_extremes` ทันที`,',
  '9. เมื่อผู้ใช้ถามถึงสินค้าที่มีจำนวนมากที่สุด หรือน้อยที่สุด ให้เรียกใช้ฟังก์ชัน \\`get_stock_extremes\\` ทันที`,'
);
fs.writeFileSync('server.ts', code);
