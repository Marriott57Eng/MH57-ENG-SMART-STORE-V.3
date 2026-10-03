import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InventoryItem, RequisitionRecord, PurchaseOrder } from '../types';
import { formatRecordTimestamp } from './dateUtils';

export interface GeneratePdfOptions {
  type: 
    | 'inventory_all' 
    | 'requisition_history' 
    | 'individual_requisitions' 
    | 'low_stock' 
    | 'category' 
    | 'purchase_orders' 
    | 'executive_summary';
  title?: string;
  subtitle?: string;
  categoryFilter?: string;
  userFilter?: string;
  orderStatusFilter?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  items: InventoryItem[];
  requisitions: RequisitionRecord[];
  orders?: PurchaseOrder[];
  generatedBy?: string;
}

/**
 * Safely parse date from ISO string or timestamp
 */
export function parseRecordDateTime(isoDate?: string, timestamp?: string): Date | null {
  if (isoDate) {
    const d = new Date(isoDate);
    if (!isNaN(d.getTime())) return d;
  }
  if (timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Check if a date falls within specified start and end date/time
 */
export function isWithinDateTimeRange(
  recordDate: Date | null,
  startDate?: string,
  startTime?: string,
  endDate?: string,
  endTime?: string
): boolean {
  if (!startDate && !endDate) return true;
  if (!recordDate) return true;

  const recordTime = recordDate.getTime();

  if (startDate) {
    const startStr = `${startDate}T${startTime ? startTime : '00:00'}:00`;
    const startObj = new Date(startStr);
    if (!isNaN(startObj.getTime()) && recordTime < startObj.getTime()) {
      return false;
    }
  }

  if (endDate) {
    const endStr = `${endDate}T${endTime ? endTime : '23:59'}:59`;
    const endObj = new Date(endStr);
    if (!isNaN(endObj.getTime()) && recordTime > endObj.getTime()) {
      return false;
    }
  }

  return true;
}

export async function generateAndDownloadPdf(options: GeneratePdfOptions): Promise<void> {
  const {
    type,
    categoryFilter,
    userFilter,
    orderStatusFilter,
    startDate,
    endDate,
    startTime = '00:00',
    endTime = '23:59',
    items = [],
    requisitions = [],
    orders = [],
    generatedBy = 'Admin',
  } = options;

  // 1. Prepare Timestamp & Range label
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

  // Range description
  let dateRangeLabel = 'ทั้งหมด (All Time)';
  if (startDate && endDate) {
    dateRangeLabel = `${startDate} (${startTime} น.) ถึง ${endDate} (${endTime} น.)`;
  } else if (startDate) {
    dateRangeLabel = `ตั้งแต่ ${startDate} (${startTime} น.) เป็นต้นไป`;
  } else if (endDate) {
    dateRangeLabel = `ถึงวันที่ ${endDate} (${endTime} น.)`;
  }

  let reportTitle = options.title || 'รายงานคลังสินค้า';
  let subtitle = options.subtitle || 'คลังสินค้า Store FL.6 • Bangkok Marriott Hotel Sukhumvit';
  let filename = `Report_${Date.now()}.pdf`;

  // Build HTML container for rendering
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '840px'; // A4 proportional width
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Sarabun", "Prompt", sans-serif';
  container.style.padding = '32px';
  container.style.boxSizing = 'border-box';

  let tableHtml = '';
  let summaryCardsHtml = '';
  let filterChipsHtml = '';

  // -------------------------------------------------------------
  // REPORT TYPE: INDIVIDUAL REQUISITION OR GENERAL REQUISITION
  // -------------------------------------------------------------
  if (type === 'requisition_history' || type === 'individual_requisitions') {
    const isIndividual = type === 'individual_requisitions' || Boolean(userFilter);
    reportTitle = isIndividual 
      ? `รายงานประวัติการเบิก-รับสินค้ารายบุคคล: ${userFilter || 'ผู้ทำรายการ'}` 
      : 'รายงานประวัติการเบิก-รับเข้าสินค้าคงคลัง (Stock In-Out)';
    
    filename = isIndividual
      ? `Requisition_${(userFilter || 'User').replace(/\s+/g, '_')}_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`
      : `Requisitions_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;

    // Filter by Date/Time
    let reqs = requisitions.filter(r => {
      const rDate = parseRecordDateTime(r.isoDate, r.timestamp);
      return isWithinDateTimeRange(rDate, startDate, startTime, endDate, endTime);
    });

    // Filter by User
    if (userFilter && userFilter.trim() !== '') {
      const lower = userFilter.trim().toLowerCase();
      reqs = reqs.filter(r => r.requestedBy && r.requestedBy.toLowerCase().includes(lower));
      subtitle = `คลังสินค้า Store FL.6 | ข้อมูลเฉพาะผู้ทำรายการ: ${userFilter}`;
    }

    const totalOut = reqs.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);
    const totalIn = reqs.filter(r => r.type === 'in').reduce((sum, r) => sum + r.qty, 0);
    const outRecordsCount = reqs.filter(r => r.type === 'out' || !r.type).length;
    const inRecordsCount = reqs.filter(r => r.type === 'in').length;
    const uniquePeople = new Set(reqs.map(r => r.requestedBy).filter(Boolean)).size;

    filterChipsHtml = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-size: 10px;">
        <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; color: #475569;">
          <strong>📅 ช่วงเวลา:</strong> ${dateRangeLabel}
        </span>
        ${userFilter ? `
          <span style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; color: #1d4ed8;">
            <strong>👤 ผู้ทำรายการ:</strong> ${userFilter}
          </span>
        ` : `
          <span style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 6px; color: #64748b;">
            <strong>👥 ผู้ทำรายการ:</strong> ทุกคน (${uniquePeople} ท่าน)
          </span>
        `}
        <span style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 6px; color: #64748b;">
          <strong>📊 จำนวนบันทึก:</strong> ${reqs.length} รายการ
        </span>
      </div>
    `;

    summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">รายการทั้งหมดในรอบ</div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${reqs.length} รายการ</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">เบิก ${outRecordsCount} | รับเข้า ${inRecordsCount}</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #2563eb;">ยอดเบิกออกรวม (Stock Out)</div>
          <div style="font-size: 16px; font-weight: bold; color: #1d4ed8;">-${totalOut.toLocaleString()} ชิ้น</div>
          <div style="font-size: 9px; color: #3b82f6; margin-top: 2px;">รวมจำนวนหน่วยสินค้า</div>
        </div>
        <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #16a34a;">ยอดรับเข้ารวม (Stock In)</div>
          <div style="font-size: 16px; font-weight: bold; color: #15803d;">+${totalIn.toLocaleString()} ชิ้น</div>
          <div style="font-size: 9px; color: #22c55e; margin-top: 2px;">เติมสต็อกคลัง</div>
        </div>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">${isIndividual ? 'สถานะผู้เบิก' : 'ผู้ทำรายการทั้งหมด'}</div>
          <div style="font-size: 16px; font-weight: bold; color: #334155;">${isIndividual ? (userFilter || 'ระบุชื่อแล้ว') : `${uniquePeople} ท่าน`}</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">ออกรายงานโดย: ${generatedBy}</div>
        </div>
      </div>
    `;

    tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 9.5px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
            <th style="padding: 7px 5px; width: 25px; text-align: center;">#</th>
            <th style="padding: 7px 5px; width: 95px;">วัน-เวลา</th>
            <th style="padding: 7px 5px; width: 55px; text-align: center;">ประเภท</th>
            ${!isIndividual ? `<th style="padding: 7px 5px; width: 90px;">ผู้ทำรายการ</th>` : ''}
            <th style="padding: 7px 5px; width: 75px;">รหัสสินค้า</th>
            <th style="padding: 7px 5px;">รายการสินค้า / หมวด</th>
            <th style="padding: 7px 5px; width: 70px; text-align: right;">จำนวน</th>
            <th style="padding: 7px 5px; width: 80px; text-align: right;">สต็อกปัจจุบัน</th>
            <th style="padding: 7px 5px; width: 140px;">งานที่นำไปใช้ / แหล่งที่มา</th>
          </tr>
        </thead>
        <tbody>
          ${
            reqs.length === 0
              ? `<tr><td colspan="${isIndividual ? 8 : 9}" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 11px;">ไม่พบประวัติการเบิกหรือรับเข้าตามช่วงเวลาและเงื่อนไขที่เลือก</td></tr>`
              : reqs
                  .map((rec, idx) => {
                    const isStockIn = rec.type === 'in';
                    const typeBadge = isStockIn
                      ? `<span style="background-color: #dcfce7; color: #15803d; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 8.5px;">รับเข้า</span>`
                      : `<span style="background-color: #dbeafe; color: #1d4ed8; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 8.5px;">เบิกออก</span>`;
                    const qtyColor = isStockIn ? '#15803d' : '#1d4ed8';
                    const qtyPrefix = isStockIn ? '+' : '-';

                    const itemMatch = items.find(i => i.id === rec.itemId) || items.find(i => i.name === rec.itemName);
                    const currentStockText = itemMatch ? `${itemMatch.qty} ${itemMatch.unit}` : '-';

                    return `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 6px 5px; text-align: center; color: #64748b; font-size: 8.5px;">${idx + 1}</td>
                <td style="padding: 6px 5px; color: #475569; font-size: 8.5px;">${formatRecordTimestamp(rec.timestamp, rec.isoDate)}</td>
                <td style="padding: 6px 5px; text-align: center;">${typeBadge}</td>
                ${!isIndividual ? `<td style="padding: 6px 5px; font-weight: 600; color: #0f172a;">${rec.requestedBy}</td>` : ''}
                <td style="padding: 6px 5px; font-family: monospace; font-size: 8.5px; color: #2563eb; font-weight: bold;">${rec.itemId}</td>
                <td style="padding: 6px 5px; font-weight: 500; color: #1e293b;">
                  <div>${rec.itemName}</div>
                  <div style="font-size: 8px; color: #64748b;">${rec.category || ''}</div>
                </td>
                <td style="padding: 6px 5px; text-align: right; font-weight: bold; color: ${qtyColor};">${qtyPrefix}${rec.qty} ${rec.unit}</td>
                <td style="padding: 6px 5px; text-align: right; font-weight: bold; color: #0f172a;">${currentStockText}</td>
                <td style="padding: 6px 5px; color: #334155; font-size: 8.5px;">
                  <div>${rec.purpose || '-'}</div>
                  ${rec.note ? `<div style="font-size: 8px; color: #94a3b8;">(${rec.note})</div>` : ''}
                </td>
              </tr>
            `;
                  })
                  .join('')
          }
        </tbody>
      </table>
    `;
  // -------------------------------------------------------------
  // REPORT TYPE: PURCHASE ORDERS HISTORY
  // -------------------------------------------------------------
  } else if (type === 'purchase_orders') {
    reportTitle = 'รายงานประวัติและสถานะคำสั่งซื้อสินค้า (Purchase Orders History)';
    filename = `PurchaseOrders_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;

    // Filter orders by Date/Time
    let filteredOrders = orders.filter(o => {
      const oDate = parseRecordDateTime(o.isoDate, o.createdAt);
      return isWithinDateTimeRange(oDate, startDate, startTime, endDate, endTime);
    });

    // Filter by Status
    if (orderStatusFilter && orderStatusFilter !== 'all') {
      filteredOrders = filteredOrders.filter(o => o.status === orderStatusFilter);
    }

    // Filter by User / Requester
    if (userFilter && userFilter.trim() !== '') {
      const lower = userFilter.trim().toLowerCase();
      filteredOrders = filteredOrders.filter(o => o.requestedBy && o.requestedBy.toLowerCase().includes(lower));
    }

    const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
    const confirmedCount = filteredOrders.filter(o => o.status === 'confirmed').length;
    const receivedCount = filteredOrders.filter(o => o.status === 'received').length;
    const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length;
    const totalOrderedQty = filteredOrders.reduce((sum, o) => sum + (o.qty || 0), 0);

    filterChipsHtml = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-size: 10px;">
        <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; color: #475569;">
          <strong>📅 ช่วงเวลา:</strong> ${dateRangeLabel}
        </span>
        <span style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 3px 8px; border-radius: 6px; color: #b45309;">
          <strong>สถานะคำสั่งซื้อ:</strong> ${orderStatusFilter ? (orderStatusFilter === 'pending' ? 'รอยืนยัน' : orderStatusFilter === 'confirmed' ? 'ยืนยันแล้ว' : orderStatusFilter === 'received' ? 'รับสินค้าแล้ว' : orderStatusFilter) : 'ทุกสถานะ'}
        </span>
        ${userFilter ? `
          <span style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; color: #1d4ed8;">
            <strong>ผู้สั่งซื้อ:</strong> ${userFilter}
          </span>
        ` : ''}
        <span style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 6px; color: #64748b;">
          <strong>จำนวนใบสั่งซื้อ:</strong> ${filteredOrders.length} ใบ
        </span>
      </div>
    `;

    summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 18px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px;">
          <div style="font-size: 9.5px; color: #64748b;">ยอดสั่งซื้อทั้งหมด</div>
          <div style="font-size: 15px; font-weight: bold; color: #0f172a;">${filteredOrders.length} ใบ</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">รวม ${totalOrderedQty.toLocaleString()} ชิ้น</div>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 8px;">
          <div style="font-size: 9.5px; color: #b45309;">รอยืนยัน (Pending)</div>
          <div style="font-size: 15px; font-weight: bold; color: #d97706;">${pendingCount} รายการ</div>
          <div style="font-size: 8.5px; color: #d97706; margin-top: 2px;">รอหัวหน้าตรวจสอบ</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 8px;">
          <div style="font-size: 9.5px; color: #1d4ed8;">ยืนยันแล้ว (Confirmed)</div>
          <div style="font-size: 15px; font-weight: bold; color: #2563eb;">${confirmedCount} รายการ</div>
          <div style="font-size: 8.5px; color: #2563eb; margin-top: 2px;">รอของมาส่ง</div>
        </div>
        <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 8px;">
          <div style="font-size: 9.5px; color: #15803d;">รับสินค้าแล้ว (Received)</div>
          <div style="font-size: 15px; font-weight: bold; color: #16a34a;">${receivedCount} รายการ</div>
          <div style="font-size: 8.5px; color: #16a34a; margin-top: 2px;">เติมเข้าคลังแล้ว</div>
        </div>
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 8px;">
          <div style="font-size: 9.5px; color: #b91c1c;">ยกเลิก (Cancelled)</div>
          <div style="font-size: 15px; font-weight: bold; color: #dc2626;">${cancelledCount} รายการ</div>
          <div style="font-size: 8.5px; color: #dc2626; margin-top: 2px;">ไม่ดำเนินการ</div>
        </div>
      </div>
    `;

    tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
            <th style="padding: 7px 5px; width: 20px; text-align: center;">#</th>
            <th style="padding: 7px 5px; width: 75px;">รหัส PO</th>
            <th style="padding: 7px 5px; width: 80px;">วันที่สั่ง</th>
            <th style="padding: 7px 5px; width: 65px;">รหัสสินค้า</th>
            <th style="padding: 7px 5px;">รายการสินค้า / ยี่ห้อ / รุ่น</th>
            <th style="padding: 7px 5px; width: 65px; text-align: right;">จำนวน</th>
            <th style="padding: 7px 5px; width: 75px;">ผู้สั่งซื้อ</th>
            <th style="padding: 7px 5px; width: 85px;">ซัพพลายเออร์</th>
            <th style="padding: 7px 5px; width: 55px; text-align: center;">ความเร่งด่วน</th>
            <th style="padding: 7px 5px; width: 70px; text-align: center;">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${
            filteredOrders.length === 0
              ? `<tr><td colspan="10" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 11px;">ไม่พบประวัติการสั่งซื้อสินค้าตามเงื่อนไขที่เลือก</td></tr>`
              : filteredOrders
                  .map((order, idx) => {
                    let statusBadge = `<span style="background-color: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">รอยืนยัน</span>`;
                    if (order.status === 'confirmed') {
                      statusBadge = `<span style="background-color: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">ยืนยันแล้ว</span>`;
                    } else if (order.status === 'received') {
                      statusBadge = `<span style="background-color: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">รับสินค้าแล้ว</span>`;
                    } else if (order.status === 'cancelled') {
                      statusBadge = `<span style="background-color: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 8px;">ยกเลิก</span>`;
                    }

                    let urgencyBadge = `<span style="color: #64748b;">ปกติ</span>`;
                    if (order.urgency === 'urgent') {
                      urgencyBadge = `<span style="color: #d97706; font-weight: bold;">ด่วน</span>`;
                    } else if (order.urgency === 'critical') {
                      urgencyBadge = `<span style="color: #dc2626; font-weight: bold;">ด่วนที่สุด!</span>`;
                    }

                    const poDate = formatRecordTimestamp('', order.isoDate || order.createdAt);

                    return `
              <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                <td style="padding: 6px 5px; text-align: center; color: #64748b; font-size: 8.5px;">${idx + 1}</td>
                <td style="padding: 6px 5px; font-family: monospace; font-size: 8.5px; font-weight: bold; color: #2563eb;">${order.id}</td>
                <td style="padding: 6px 5px; color: #475569; font-size: 8px;">${poDate}</td>
                <td style="padding: 6px 5px; font-family: monospace; font-size: 8px; color: #64748b;">${order.itemId}</td>
                <td style="padding: 6px 5px; font-weight: 500; color: #1e293b;">
                  <div>${order.itemName}</div>
                  <div style="font-size: 8px; color: #64748b;">${[order.brand, order.model].filter(Boolean).join(' • ')}</div>
                </td>
                <td style="padding: 6px 5px; text-align: right; font-weight: bold; color: #0f172a;">${order.qty} ${order.unit}</td>
                <td style="padding: 6px 5px; color: #334155; font-size: 8.5px;">${order.requestedBy}</td>
                <td style="padding: 6px 5px; color: #475569; font-size: 8.5px;">${order.supplier || '-'}</td>
                <td style="padding: 6px 5px; text-align: center; font-size: 8.5px;">${urgencyBadge}</td>
                <td style="padding: 6px 5px; text-align: center;">${statusBadge}</td>
              </tr>
            `;
                  })
                  .join('')
          }
        </tbody>
      </table>
    `;
  // -------------------------------------------------------------
  // REPORT TYPE: EXECUTIVE OVERVIEW SUMMARY
  // -------------------------------------------------------------
  } else if (type === 'executive_summary') {
    reportTitle = 'รายงานสรุปภาพรวมผู้บริหาร (Executive Inventory & Transaction Summary)';
    filename = `Executive_Summary_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;

    // Filter Requisitions by Date/Time
    const periodReqs = requisitions.filter(r => {
      const rDate = parseRecordDateTime(r.isoDate, r.timestamp);
      return isWithinDateTimeRange(rDate, startDate, startTime, endDate, endTime);
    });

    // Filter Orders by Date/Time
    const periodOrders = orders.filter(o => {
      const oDate = parseRecordDateTime(o.isoDate, o.createdAt);
      return isWithinDateTimeRange(oDate, startDate, startTime, endDate, endTime);
    });

    const totalItemsCount = items.length;
    const totalInventoryQty = items.reduce((sum, i) => sum + i.qty, 0);
    const lowCount = items.filter(i => i.status === 'low').length;
    const outCount = items.filter(i => i.status === 'out').length;

    const totalOut = periodReqs.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);
    const totalIn = periodReqs.filter(r => r.type === 'in').reduce((sum, r) => sum + r.qty, 0);

    // Requisition by user ranking
    const userReqCounts: Record<string, { count: number; qty: number }> = {};
    periodReqs.forEach(r => {
      const u = r.requestedBy || 'ไม่ระบุ';
      if (!userReqCounts[u]) userReqCounts[u] = { count: 0, qty: 0 };
      userReqCounts[u].count += 1;
      userReqCounts[u].qty += r.qty;
    });
    const sortedUsers = Object.entries(userReqCounts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

    // Requisition by category ranking
    const catReqCounts: Record<string, number> = {};
    periodReqs.forEach(r => {
      const c = r.category || 'อื่นๆ';
      catReqCounts[c] = (catReqCounts[c] || 0) + r.qty;
    });
    const sortedCats = Object.entries(catReqCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    filterChipsHtml = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-size: 10px;">
        <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; color: #475569;">
          <strong>📅 ช่วงเวลาประเมิน:</strong> ${dateRangeLabel}
        </span>
        <span style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; color: #1d4ed8;">
          <strong>ผู้สร้างรายงาน:</strong> ${generatedBy}
        </span>
      </div>
    `;

    summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">สินค้าคงคลังทั้งหมด</div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${totalItemsCount} รายการ</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">สต็อกรวม ${totalInventoryQty.toLocaleString()} ชิ้น</div>
        </div>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #dc2626;">สินค้าวิกฤต (หมด/ใกล้หมด)</div>
          <div style="font-size: 16px; font-weight: bold; color: #b91c1c;">${lowCount + outCount} รายการ</div>
          <div style="font-size: 9px; color: #b91c1c; margin-top: 2px;">หมด ${outCount} | เหลือน้อย ${lowCount}</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #2563eb;">การเบิกใช้ในรอบเวลา</div>
          <div style="font-size: 16px; font-weight: bold; color: #1d4ed8;">-${totalOut.toLocaleString()} ชิ้น</div>
          <div style="font-size: 9px; color: #1d4ed8; margin-top: 2px;">จาก ${periodReqs.filter(r => r.type === 'out' || !r.type).length} ครั้ง</div>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #b45309;">การสั่งซื้อสินค้าในรอบ</div>
          <div style="font-size: 16px; font-weight: bold; color: #d97706;">${periodOrders.length} ใบ</div>
          <div style="font-size: 9px; color: #d97706; margin-top: 2px;">สำเร็จแล้ว ${periodOrders.filter(o => o.status === 'received').length} ใบ</div>
        </div>
      </div>
    `;

    tableHtml = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 11px; font-weight: bold; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            👤 5 อันดับผู้เบิกสินค้าสูงสุดในรอบเวลา
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="color: #64748b; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 4px; text-align: left;">ชื่อผู้เบิก</th>
                <th style="padding: 4px; text-align: right;">จำนวนครั้ง</th>
                <th style="padding: 4px; text-align: right;">จำนวนชิ้น</th>
              </tr>
            </thead>
            <tbody>
              ${
                sortedUsers.length === 0
                  ? `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">ไม่มีรายการเบิก</td></tr>`
                  : sortedUsers.map(([name, stat], i) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 5px 4px; font-weight: 600; color: #1e293b;">${i+1}. ${name}</td>
                      <td style="padding: 5px 4px; text-align: right; color: #64748b;">${stat.count} ครั้ง</td>
                      <td style="padding: 5px 4px; text-align: right; font-weight: bold; color: #2563eb;">${stat.qty.toLocaleString()} ชิ้น</td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>

        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 11px; font-weight: bold; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
            📦 5 หมวดหมู่ที่มีการเบิกจ่ายสูงสุด
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9.5px;">
            <thead>
              <tr style="color: #64748b; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 4px; text-align: left;">หมวดหมู่</th>
                <th style="padding: 4px; text-align: right;">ยอดเบิกออกรวม</th>
              </tr>
            </thead>
            <tbody>
              ${
                sortedCats.length === 0
                  ? `<tr><td colspan="2" style="padding: 12px; text-align: center; color: #94a3b8;">ไม่มีรายการเบิก</td></tr>`
                  : sortedCats.map(([cat, qty], i) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 5px 4px; font-weight: 600; color: #1e293b;">${i+1}. ${cat}</td>
                      <td style="padding: 5px 4px; text-align: right; font-weight: bold; color: #dc2626;">-${qty.toLocaleString()} ชิ้น</td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <div style="border: 1px solid #fee2e2; background-color: #fffafa; border-radius: 8px; padding: 10px;">
        <div style="font-size: 11px; font-weight: bold; color: #b91c1c; margin-bottom: 6px;">
          🚨 รายการสินค้าที่ต้องสั่งซื้อด่วน (หมดสต็อกหรือต่ำกว่า Min Stock)
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px; text-align: left;">
          <thead>
            <tr style="background-color: #fee2e2; color: #991b1b;">
              <th style="padding: 5px; width: 80px;">รหัสสินค้า</th>
              <th style="padding: 5px;">ชื่อสินค้า</th>
              <th style="padding: 5px; width: 90px;">หมวดหมู่</th>
              <th style="padding: 5px; width: 60px; text-align: right;">คงเหลือ</th>
              <th style="padding: 5px; width: 60px; text-align: right;">Min Stock</th>
              <th style="padding: 5px; width: 70px; text-align: center;">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${
              items.filter(i => i.status === 'out' || i.status === 'low').slice(0, 10).map((it, idx) => `
                <tr style="border-bottom: 1px solid #fecaca; ${idx % 2 === 1 ? 'background-color: #fff;' : ''}">
                  <td style="padding: 5px; font-family: monospace; font-weight: bold; color: #b91c1c;">${it.id}</td>
                  <td style="padding: 5px; font-weight: 600; color: #1e293b;">${it.name}</td>
                  <td style="padding: 5px; color: #64748b;">${it.category}</td>
                  <td style="padding: 5px; text-align: right; font-weight: bold; color: ${it.status === 'out' ? '#dc2626' : '#d97706'};">${it.qty} ${it.unit}</td>
                  <td style="padding: 5px; text-align: right; color: #64748b;">${it.minStock}</td>
                  <td style="padding: 5px; text-align: center;">
                    <span style="font-size: 8px; font-weight: bold; padding: 2px 5px; border-radius: 4px; background-color: ${it.status === 'out' ? '#fee2e2' : '#fef3c7'}; color: ${it.status === 'out' ? '#b91c1c' : '#b45309'};">
                      ${it.status === 'out' ? 'หมดสต็อก' : 'ใกล้หมด'}
                    </span>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  // -------------------------------------------------------------
  // REPORT TYPE: ALL INVENTORY / LOW STOCK / CATEGORY
  // -------------------------------------------------------------
  } else {
    let filteredItems = [...items];
    if (type === 'low_stock') {
      reportTitle = 'รายงานสินค้าใกล้หมด / หมดสต็อก (Low & Out of Stock Report)';
      filename = `Low_Stock_Report_${now.toISOString().slice(0, 10)}.pdf`;
      filteredItems = items.filter(i => i.status === 'low' || i.status === 'out');
    } else if (type === 'category' && categoryFilter) {
      reportTitle = `รายงานสต็อกสินค้า หมวดหมู่: ${categoryFilter}`;
      filename = `Category_Report_${now.toISOString().slice(0, 10)}.pdf`;
      const filters = categoryFilter.split(',').map(f => f.trim().toLowerCase());
      filteredItems = items.filter(i => 
        filters.some(f => i.category.toLowerCase().includes(f))
      );
    } else {
      reportTitle = 'รายงานสต็อกสินค้าคงคลังทั้งหมด (All Inventory Master Report)';
      filename = `Inventory_All_${now.toISOString().slice(0, 10)}.pdf`;
      if (categoryFilter && categoryFilter !== 'all') {
        filteredItems = filteredItems.filter(i => i.category === categoryFilter);
      }
    }

    const totalQty = filteredItems.reduce((sum, i) => sum + i.qty, 0);
    const lowCount = filteredItems.filter(i => i.status === 'low').length;
    const outCount = filteredItems.filter(i => i.status === 'out').length;
    const normalCount = filteredItems.filter(i => i.status === 'normal' || (!i.status && i.qty > (i.minStock || 0))).length;

    filterChipsHtml = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; font-size: 10px;">
        <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; color: #475569;">
          <strong>หมวดหมู่:</strong> ${categoryFilter || 'ทุกหมวดหมู่'}
        </span>
        <span style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 6px; color: #64748b;">
          <strong>จำนวนรายการ:</strong> ${filteredItems.length} รายการ
        </span>
        <span style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; color: #1d4ed8;">
          <strong>ออกรายงานโดย:</strong> ${generatedBy}
        </span>
      </div>
    `;

    summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #64748b;">จำนวนรายการสินค้า</div>
          <div style="font-size: 16px; font-weight: bold; color: #0f172a;">${filteredItems.length} รายการ</div>
          <div style="font-size: 9px; color: #10b981; margin-top: 2px;">ปกติ ${normalCount} รายการ</div>
        </div>
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #2563eb;">ยอดสต็อกรวมทั้งหมด</div>
          <div style="font-size: 16px; font-weight: bold; color: #1d4ed8;">${totalQty.toLocaleString()} ชิ้น</div>
          <div style="font-size: 9px; color: #3b82f6; margin-top: 2px;">นับรวมทุกหน่วย</div>
        </div>
        <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #ca8a04;">สินค้าสต็อกใกล้หมด</div>
          <div style="font-size: 16px; font-weight: bold; color: #a16207;">${lowCount} รายการ</div>
          <div style="font-size: 9px; color: #ca8a04; margin-top: 2px;">ต้องเตรียมสั่งซื้อ</div>
        </div>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px;">
          <div style="font-size: 10px; color: #dc2626;">สินค้าหมดสต็อก</div>
          <div style="font-size: 16px; font-weight: bold; color: #b91c1c;">${outCount} รายการ</div>
          <div style="font-size: 9px; color: #dc2626; margin-top: 2px;">ต้องสั่งซื้อทันที</div>
        </div>
      </div>
    `;

    tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; color: #334155;">
            <th style="padding: 7px 5px; width: 25px; text-align: center;">#</th>
            <th style="padding: 7px 5px; width: 85px;">รหัสสินค้า</th>
            <th style="padding: 7px 5px;">ชื่อสินค้า / รายการ</th>
            <th style="padding: 7px 5px; width: 90px;">หมวดหมู่</th>
            <th style="padding: 7px 5px; width: 65px; text-align: right;">คงเหลือ</th>
            <th style="padding: 7px 5px; width: 55px; text-align: right;">Min Stock</th>
            <th style="padding: 7px 5px; width: 85px;">ตำแหน่งจัดเก็บ</th>
            <th style="padding: 7px 5px; width: 65px; text-align: center;">สถานะ</th>
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
                <td style="padding: 6px 5px; text-align: center; color: #64748b; font-size: 9px;">${idx + 1}</td>
                <td style="padding: 6px 5px; font-family: monospace; font-size: 9px; font-weight: bold; color: #2563eb;">${item.id}</td>
                <td style="padding: 6px 5px; font-weight: 600; color: #0f172a;">
                  <div>${item.name}</div>
                  ${item.note ? `<div style="font-size: 8px; color: #64748b; font-weight: normal;">${item.note}</div>` : ''}
                </td>
                <td style="padding: 6px 5px; color: #475569; font-size: 9px;">${item.category}</td>
                <td style="padding: 6px 5px; text-align: right; font-weight: bold; color: #0f172a;">${item.qty} <span style="font-size: 8px; font-weight: normal; color: #64748b;">${item.unit}</span></td>
                <td style="padding: 6px 5px; text-align: right; color: #64748b; font-size: 9px;">${item.minStock}</td>
                <td style="padding: 6px 5px; color: #475569; font-size: 9px;">${item.location || 'Store FL.6'}</td>
                <td style="padding: 6px 5px; text-align: center;">
                  <span style="display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 8.5px; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};">
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

  // Assemble full HTML document with official Branding & Header
  container.innerHTML = `
    <!-- Header Section with Official Branding -->
    <div style="border-bottom: 2.5px solid #2563eb; padding-bottom: 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 14px;">
        <img 
          src="/logo.png" 
          crossorigin="anonymous" 
          style="width: 52px; height: 52px; object-fit: contain; border-radius: 10px; background-color: #0f172a; padding: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" 
          alt="ENG SMART STORE"
        />
        <div>
          <div style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">
            BANGKOK MARRIOTT HOTEL SUKHUMVIT • ENG SMART STORE
          </div>
          <h1 style="font-size: 19px; font-weight: 800; color: #0f172a; margin: 2px 0 3px 0; line-height: 1.2;">
            ${reportTitle}
          </h1>
          <div style="font-size: 11px; color: #64748b; font-weight: 500;">
            ${subtitle}
          </div>
        </div>
      </div>
      <div style="text-align: right; font-size: 9.5px; color: #64748b; border-left: 1px solid #e2e8f0; padding-left: 14px;">
        <div style="font-weight: 700; color: #1e293b; margin-bottom: 2px;">วันที่และเวลาออกรายงาน:</div>
        <div style="color: #2563eb; font-weight: 600;">${timestampStr}</div>
        <div style="color: #64748b; margin-top: 3px;">ผู้ออกรายงาน: <span style="font-weight: 600; color: #0f172a;">${generatedBy}</span></div>
      </div>
    </div>

    <!-- Filter chips banner -->
    ${filterChipsHtml}

    <!-- Summary Statistics Banner -->
    ${summaryCardsHtml}

    <!-- Content Table -->
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 14px;">
      ${tableHtml}
    </div>

    <!-- Footer -->
    <div style="margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8;">
      <div>ระบบบริหารคลังสินค้าช่างและอะไหล่อัจฉริยะ (ENG SMART STORE APP) • แผนกวิศวกรรม Store FL.6</div>
      <div>เอกสารรายงานอย่างเป็นทางการของระบบ</div>
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
