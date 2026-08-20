import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InventoryItem, RequisitionRecord } from '../types';
import { formatRecordTimestamp } from './dateUtils';

export interface GeneratePdfOptions {
  type: 'inventory_all' | 'requisition_history' | 'low_stock' | 'category';
  title?: string;
  categoryFilter?: string;
  items: InventoryItem[];
  requisitions: RequisitionRecord[];
}

export async function generateAndDownloadPdf(options: GeneratePdfOptions): Promise<void> {
  const { type, categoryFilter, items, requisitions } = options;

  // 1. Prepare Data
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const timestampStr = `${dateStr} เวลา ${timeStr} น.`;

  let reportTitle = options.title || 'รายงานคลังสินค้า';
  let subtitle = 'คลังสินค้า Store FL.6';
  let filename = `Report_${Date.now()}.pdf`;

  // Build HTML container for rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '820px'; // Standard A4 width proportion
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Sarabun", "Prompt", sans-serif';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';

  let tableHtml = '';
  let summaryCardsHtml = '';

  if (type === 'requisition_history') {
    reportTitle = 'รายงานประวัติการเบิก / รับเข้าสินค้า (Stock In-Out History)';
    filename = `Requisition_History_${now.toISOString().slice(0, 10)}.pdf`;
    
    const totalOut = requisitions.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);
    const totalIn = requisitions.filter(r => r.type === 'in').reduce((sum, r) => sum + r.qty, 0);
    const uniquePeople = new Set(requisitions.map(r => r.requestedBy)).size;

    summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">รายการทั้งหมด</div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${requisitions.length} รายการ</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #2563eb;">ยอดเบิกออกรวม</div>
          <div style="font-size: 16px; font-weight: bold; color: #1d4ed8;">-${totalOut} ชิ้น</div>
        </div>
        <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #16a34a;">ยอดรับเข้ารวม</div>
          <div style="font-size: 16px; font-weight: bold; color: #15803d;">+${totalIn} ชิ้น</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">ผู้ทำรายการ</div>
          <div style="font-size: 16px; font-weight: bold; color: #334155;">${uniquePeople} ท่าน</div>
        </div>
      </div>
    `;

    tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
            <th style="padding: 8px 5px; width: 25px; text-align: center;">#</th>
            <th style="padding: 8px 5px; width: 90px;">วัน-เวลา</th>
            <th style="padding: 8px 5px; width: 55px; text-align: center;">ประเภท</th>
            <th style="padding: 8px 5px; width: 95px;">ผู้ทำรายการ</th>
            <th style="padding: 8px 5px; width: 75px;">รหัสสินค้า</th>
            <th style="padding: 8px 5px;">รายการสินค้า</th>
            <th style="padding: 8px 5px; width: 70px; text-align: right;">จำนวน</th>
            <th style="padding: 8px 5px; width: 85px; text-align: right;">คงเหลือปัจจุบัน</th>
            <th style="padding: 8px 5px; width: 130px;">งานนำไปใช้ / แหล่งที่มา</th>
          </tr>
        </thead>
        <tbody>
          ${
            requisitions.length === 0
              ? `<tr><td colspan="9" style="padding: 24px; text-align: center; color: #94a3b8;">ยังไม่มีประวัติการเบิกหรือรับเข้าสินค้า</td></tr>`
              : requisitions
                  .map((rec, idx) => {
                    const isStockIn = rec.type === 'in';
                    const typeBadge = isStockIn
                      ? `<span style="background-color: #dcfce7; color: #15803d; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 9px;">รับเข้า</span>`
                      : `<span style="background-color: #dbeafe; color: #1d4ed8; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 9px;">เบิกออก</span>`;
                    const qtyColor = isStockIn ? '#15803d' : '#1d4ed8';
                    const qtyPrefix = isStockIn ? '+' : '-';

                    const itemMatch = items.find(i => i.id === rec.itemId) || items.find(i => i.name === rec.itemName);
                    const currentStockText = itemMatch ? `${itemMatch.qty} ${itemMatch.unit}` : '-';

                    return `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 7px 5px; text-align: center; color: #64748b; font-size: 9px;">${idx + 1}</td>
                <td style="padding: 7px 5px; color: #475569; font-size: 9px;">${formatRecordTimestamp(rec.timestamp, rec.isoDate)}</td>
                <td style="padding: 7px 5px; text-align: center;">${typeBadge}</td>
                <td style="padding: 7px 5px; font-weight: 600; color: #0f172a;">${rec.requestedBy}</td>
                <td style="padding: 7px 5px; font-family: monospace; font-size: 9px; color: #2563eb;">${rec.itemId}</td>
                <td style="padding: 7px 5px; font-weight: 500; color: #1e293b;">
                  <div>${rec.itemName}</div>
                  <div style="font-size: 8.5px; color: #64748b;">${rec.category}</div>
                </td>
                <td style="padding: 7px 5px; text-align: right; font-weight: bold; color: ${qtyColor};">${qtyPrefix}${rec.qty} ${rec.unit}</td>
                <td style="padding: 7px 5px; text-align: right; font-weight: bold; color: #0f172a;">${currentStockText}</td>
                <td style="padding: 7px 5px; color: #334155; font-size: 9px;">
                  <div>${rec.purpose}</div>
                  ${rec.note ? `<div style="font-size: 8.5px; color: #94a3b8;">(${rec.note})</div>` : ''}
                </td>
              </tr>
            `;
                  })
                  .join('')
          }
        </tbody>
      </table>
    `;
  } else {
    // Inventory Report (All, Low Stock, or Category)
    let filteredItems = [...items];
    if (type === 'low_stock') {
      reportTitle = 'รายงานสินค้าใกล้หมด / หมดสต็อก (Low & Out of Stock)';
      filename = `Low_Stock_Report_${now.toISOString().slice(0, 10)}.pdf`;
      filteredItems = items.filter(i => i.status === 'low' || i.status === 'out');
    } else if (type === 'category' && categoryFilter) {
      reportTitle = `รายงานสต็อกสินค้า หมวด: ${categoryFilter}`;
      filename = `Category_Report_${now.toISOString().slice(0, 10)}.pdf`;
      const filters = categoryFilter.split(',').map(f => f.trim().toLowerCase());
      filteredItems = items.filter(i => 
        filters.some(f => i.category.toLowerCase().includes(f))
      );
    } else {
      reportTitle = 'รายงานสต็อกสินค้าคงคลังทั้งหมด (All Inventory)';
      filename = `Inventory_All_${now.toISOString().slice(0, 10)}.pdf`;
    }

    const totalQty = filteredItems.reduce((sum, i) => sum + i.qty, 0);
    const lowCount = filteredItems.filter(i => i.status === 'low').length;
    const outCount = filteredItems.filter(i => i.status === 'out').length;

    summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">จำนวนรายการ</div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${filteredItems.length} รายการ</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #2563eb;">ยอดสต็อกรวม</div>
          <div style="font-size: 16px; font-weight: bold; color: #1d4ed8;">${totalQty} ชิ้น</div>
        </div>
        <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #ca8a04;">สต็อกใกล้หมด</div>
          <div style="font-size: 16px; font-weight: bold; color: #a16207;">${lowCount} รายการ</div>
        </div>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #dc2626;">สินค้าหมดสต็อก</div>
          <div style="font-size: 16px; font-weight: bold; color: #b91c1c;">${outCount} รายการ</div>
        </div>
      </div>
    `;

    tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
            <th style="padding: 8px 6px; width: 30px; text-align: center;">#</th>
            <th style="padding: 8px 6px; width: 85px;">รหัสสินค้า</th>
            <th style="padding: 8px 6px;">ชื่อสินค้า / รายการ</th>
            <th style="padding: 8px 6px; width: 85px;">หมวดหมู่</th>
            <th style="padding: 8px 6px; width: 65px; text-align: right;">คงเหลือ</th>
            <th style="padding: 8px 6px; width: 55px; text-align: right;">Min Stock</th>
            <th style="padding: 8px 6px; width: 85px;">ตำแหน่ง</th>
            <th style="padding: 8px 6px; width: 65px; text-align: center;">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${filteredItems
            .map((item, idx) => {
              let statusBg = '#dcfce7';
              let statusColor = '#15803d';
              let statusLabel = 'ปกติ';
              if (item.status === 'out') {
                statusBg = '#fee2e2';
                statusColor = '#b91c1c';
                statusLabel = 'หมด';
              } else if (item.status === 'low') {
                statusBg = '#fef3c7';
                statusColor = '#b45309';
                statusLabel = 'เหลือน้อย';
              }

              return `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 7px 6px; text-align: center; color: #64748b; font-size: 10px;">${idx + 1}</td>
                <td style="padding: 7px 6px; font-family: monospace; font-size: 10px; font-weight: bold; color: #2563eb;">${item.id}</td>
                <td style="padding: 7px 6px; font-weight: 600; color: #0f172a;">
                  <div>${item.name}</div>
                  ${item.note ? `<div style="font-size: 9px; color: #64748b; font-weight: normal;">${item.note}</div>` : ''}
                </td>
                <td style="padding: 7px 6px; color: #475569; font-size: 10px;">${item.category}</td>
                <td style="padding: 7px 6px; text-align: right; font-weight: bold; color: #0f172a;">${item.qty} <span style="font-size: 9px; font-weight: normal; color: #64748b;">${item.unit}</span></td>
                <td style="padding: 7px 6px; text-align: right; color: #64748b; font-size: 10px;">${item.minStock}</td>
                <td style="padding: 7px 6px; color: #475569; font-size: 10px;">${item.location || 'Store FL.6'}</td>
                <td style="padding: 7px 6px; text-align: center;">
                  <span style="display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};">
                    ${statusLabel}
                  </span>
                </td>
              </tr>
            `;
            })
            .join('')}
        </tbody>
      </table>
    `;
  }

  container.innerHTML = `
    <!-- Header Section -->
    <div style="border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${reportTitle}</h1>
        <div style="font-size: 12px; color: #64748b; font-weight: 500;">${subtitle}</div>
      </div>
      <div style="text-align: right; font-size: 10px; color: #64748b;">
        <div style="font-weight: 600; color: #334155; margin-bottom: 2px;">วันที่ออกรายงาน:</div>
        <div>${timestampStr}</div>
      </div>
    </div>

    <!-- Summary Banner -->
    ${summaryCardsHtml}

    <!-- Content Table -->
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
      ${tableHtml}
    </div>

    <!-- Footer -->
    <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
      <div>ระบบบริหารคลังสินค้าอัจฉริยะ (AI Warehouse System) • Store FL.6</div>
      <div>หน้า 1 / 1</div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
