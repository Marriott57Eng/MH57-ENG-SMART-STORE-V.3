const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldSys = 'const systemInstruction = `คุณคือ AI คลังสินค้า Store FL.6\n1. ตอบรับการกระทำสั้นๆ เป็นภาษาคนเสมอ (เช่น "บันทึกการเบิกเรียบร้อยครับ")\n2. ถ้ามีการทำรายการ (เบิก/รับเข้า) ให้แนบ JSON ไว้ท้ายข้อความเสมอ (ต้องมีทั้ง itemId และ itemName):\n\\`\\`\\`json:action\n{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัสสินค้า", "itemName": "ชื่อสินค้า", "qty": 1, "requestedBy": "คนเบิก"}\n\\`\\`\\`\nข้อมูลสินค้า: ${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}`;';
const newSys = 'const systemInstruction = `คุณคือ AI คลังสินค้า Store FL.6\n1. ตอบรับการกระทำสั้นๆ เป็นภาษาคนเสมอ\n2. ถ้ามีการทำรายการ (เบิก/รับเข้า) คุณ **ต้องตรวจสอบว่าผู้ใช้ระบุชื่อผู้ทำรายการ (เช่น ช่างสมชาย) มาด้วยหรือไม่**\n3. **ถ้าผู้ใช้ไม่ระบุชื่อผู้ทำรายการ ห้ามสร้าง JSON action เด็ดขาด** ให้ตอบกลับเพื่อถามชื่อผู้ทำรายการแทน (เช่น "ใครเป็นผู้ทำรายการครับ?")\n4. ถ้าข้อมูลครบ ให้แนบ JSON ไว้ท้ายข้อความเสมอ:\n\\`\\`\\`json:action\n{"action": "requisition"|"stock_in"|"update_stock", "itemId": "รหัสสินค้า", "itemName": "ชื่อสินค้า", "qty": 1, "requestedBy": "ชื่อคนเบิก/รับเข้า"}\n\\`\\`\\`\nข้อมูลสินค้า: ${JSON.stringify(compactInventory.map(i => ({id:i.id,name:i.name,qty:i.qty,loc:i.loc})))}`;';
code = code.replace(oldSys, newSys);

const oldPdf = `      let pdfReport = undefined;
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
      }

      res.write(\`data: \${JSON.stringify({ type: 'done', dbAction, pdfReport, suggestedItems: matchedItems.slice(0, 5) })}\\n\\n\`);`;

const newPdf = `      let fileReport = undefined;
      const isReportRequestStr = prompt.toLowerCase();
      const isPdfRequest = isReportRequestStr.includes('pdf');
      const isExcelRequest = isReportRequestStr.includes('excel') || isReportRequestStr.includes('เอ็กเซล');
      const isReportRequest = isPdfRequest || isExcelRequest || isReportRequestStr.includes('รายงาน') || isReportRequestStr.includes('เอกสาร') || isReportRequestStr.includes('export');
      if (isReportRequest) {
        const format = isExcelRequest ? 'excel' : 'pdf';
        if (isReportRequestStr.includes('เบิก') || isReportRequestStr.includes('requisition') || isReportRequestStr.includes('รับเข้า')) {
          fileReport = { format, type: 'requisition_history', title: 'รายงานประวัติการเบิก / รับเข้าสินค้า (Store FL.6)' };
        } else if (isReportRequestStr.includes('ใกล้หมด') || isReportRequestStr.includes('หมดสต็อก') || isReportRequestStr.includes('สั่งซื้อ') || isReportRequestStr.includes('low') || isReportRequestStr.includes('out')) {
          fileReport = { format, type: 'low_stock', title: 'รายงานสินค้าใกล้หมด / หมดสต็อก' };
        } else {
          fileReport = { format, type: 'inventory_all', title: 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Store FL.6)' };
        }
      }

      res.write(\`data: \${JSON.stringify({ type: 'done', dbAction, fileReport, pdfReport: fileReport?.format === 'pdf' ? fileReport : undefined, suggestedItems: matchedItems.slice(0, 5) })}\\n\\n\`);`;

code = code.replace(oldPdf, newPdf);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts successfully");
