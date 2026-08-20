const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const regexLine = 'const actionMatch = rawResponseText.match(/\\`\\`\\`json:action\\s*([\\s\\S]*?)\\s*\\`\\`\\`/);';
const newRegexLine = 'const actionMatch = rawResponseText.match(/```(?:json:action|json)?\\s*(\\{[\\s\\S]*?\\})\\s*```/);';
code = code.replace(regexLine, newRegexLine);

const oldPdfBlock = `      let pdfReport = undefined;
      const pLower = prompt.toLowerCase();
      if (pLower.includes('pdf') || pLower.includes('รายงาน')) {
         pdfReport = { type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลัง' };
      }`;
      
const newPdfBlock = `      let pdfReport = undefined;
      const pLower = prompt.toLowerCase();
      const isPdfRequest = pLower.includes('pdf') || pLower.includes('รายงาน') || pLower.includes('เอกสาร') || pLower.includes('export');
      if (isPdfRequest) {
        if (pLower.includes('เบิก') || pLower.includes('requisition') || pLower.includes('รับเข้า')) {
          pdfReport = { type: 'requisition_history', title: 'รายงานประวัติการเบิก / รับเข้าสินค้า (Store FL.6)' };
        } else if (pLower.includes('ใกล้หมด') || pLower.includes('หมดสต็อก') || pLower.includes('สั่งซื้อ') || pLower.includes('low') || pLower.includes('out')) {
          pdfReport = { type: 'low_stock', title: 'รายงานสินค้าใกล้หมด / หมดสต็อก' };
        } else {
          pdfReport = { type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)' };
        }
      }`;
code = code.replace(oldPdfBlock, newPdfBlock);

// Also fix the Thai timestamp format for record.timestamp
const recordBlockOld = `                   requestedBy: parsedAction.requestedBy || 'ผู้ใช้งาน',
                   purpose: parsedAction.purpose || 'ใช้งาน',
                   timestamp: new Date().toISOString()`;
const recordBlockNew = `                   requestedBy: parsedAction.requestedBy || 'ผู้ใช้งาน',
                   purpose: parsedAction.purpose || 'ใช้งาน',
                   isoDate: new Date().toISOString(),
                   timestamp: new Date().toLocaleString('th-TH', { 
                     day: 'numeric', month: 'short', year: 'numeric', 
                     hour: '2-digit', minute: '2-digit' 
                   }) + ' น.',
                   note: parsedAction.note || 'บันทึกอัตโนมัติโดย AI ผู้ช่วย'`;
code = code.replace(recordBlockOld, recordBlockNew);

fs.writeFileSync('server.ts', code, 'utf-8');
console.log("Patched server.ts successfully");
