const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const target = `            let pdfReport = undefined;
      const isPdfRequestStr = prompt.toLowerCase();
      const isPdfRequest = isPdfRequestStr.includes('pdf') || isPdfRequestStr.includes('รายงาน') || isPdfRequestStr.includes('เอกสาร') || isPdfRequestStr.includes('export');
      if (isPdfRequest) {
        if (isPdfRequestStr.includes('เบิก') || isPdfRequestStr.includes('requisition') || isPdfRequestStr.includes('รับเข้า')) {
          pdfReport = { type: 'requisition_history', title: 'รายงานประวัติการเบิก / รับเข้าสินค้า (Store FL.6)' };
        } else if (isPdfRequestStr.includes('ใกล้หมด') || isPdfRequestStr.includes('หมดสต็อก') || isPdfRequestStr.includes('สั่งซื้อ') || isPdfRequestStr.includes('low') || isPdfRequestStr.includes('out')) {
          pdfReport = { type: 'low_stock', title: 'รายงานสินค้าใกล้หมด / หมดสต็อก' };
        } else {
          pdfReport = { type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)' };
        }
      }`;

code = code.replace(/let pdfReport = undefined;[\s\S]*?pdfReport = \{ type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด \(Store FL\.6\)' \};\n        }\n      \}/, target);

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Fixed PDF check block");
