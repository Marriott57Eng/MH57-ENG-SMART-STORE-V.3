import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InventoryItem, RequisitionRecord, PurchaseOrder } from '../types';
import { formatRecordTimestamp } from './dateUtils';
import { findEmployeeInSystem } from './employeeDirectory';

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

// In-memory cache for official logo to guarantee instant zero-delay PDF rendering
let cachedLogoDataUrl: string = '';
export async function getCachedLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUrl = (reader.result as string) || '/logo.png';
        resolve(cachedLogoDataUrl);
      };
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return '/logo.png';
  }
}

// Automatically preload logo on module load
if (typeof window !== 'undefined') {
  getCachedLogoDataUrl().catch(() => {});
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

  // Pre-resolve logo data URI immediately
  const logoSrc = await getCachedLogoDataUrl();

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

  // Hidden container positioned in normal screen space to guarantee positive pixel rendering coordinates
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.zIndex = '-9999';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.backgroundColor = '#ffffff';
  document.body.appendChild(container);

  try {
    // -------------------------------------------------------------
    // Header Renderer: Page 1 (Full Letterhead) vs Page 2+ (Condensed)
    // -------------------------------------------------------------
    const renderHeader = (isCondensed: boolean): string => {
      if (isCondensed) {
        return `
          <div style="border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; line-height: 1.3;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <img src="${logoSrc}" style="width: 28px; height: 28px; object-fit: contain; border-radius: 5px; background-color: #0f172a; padding: 2px;" alt="Logo" />
              <div>
                <div style="font-size: 8.5px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">
                  BANGKOK MARRIOTT HOTEL SUKHUMVIT • ENG SMART STORE
                </div>
                <div style="font-size: 13px; font-weight: 800; color: #0f172a;">
                  ${reportTitle} <span style="font-size: 10px; font-weight: 500; color: #64748b;">(ต่อ)</span>
                </div>
              </div>
            </div>
            <div style="text-align: right; font-size: 8px; color: #64748b; line-height: 1.3;">
              <div>วันที่ออกรายงาน: <strong style="color: #2563eb;">${timestampStr}</strong></div>
              <div>ผู้ออกรายงาน: <strong style="color: #0f172a;">${generatedBy}</strong></div>
            </div>
          </div>
        `;
      }

      return `
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; line-height: 1.3;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img 
              src="${logoSrc}" 
              style="width: 40px; height: 40px; object-fit: contain; border-radius: 6px; background-color: #0f172a; padding: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" 
              alt="ENG SMART STORE"
            />
            <div>
              <div style="font-size: 9px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">
                BANGKOK MARRIOTT HOTEL SUKHUMVIT • ENG SMART STORE
              </div>
              <h1 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 1px 0 2px 0; line-height: 1.2;">
                ${reportTitle}
              </h1>
              <div style="font-size: 9.5px; color: #64748b; font-weight: 500;">
                ${subtitle}
              </div>
            </div>
          </div>
          <div style="text-align: right; font-size: 8.5px; color: #64748b; border-left: 1px solid #e2e8f0; padding-left: 10px; line-height: 1.35;">
            <div style="font-weight: 700; color: #1e293b; margin-bottom: 1px;">วันที่และเวลาออกรายงาน:</div>
            <div style="color: #2563eb; font-weight: 600;">${timestampStr}</div>
            <div style="color: #64748b; margin-top: 1px;">ผู้ออกรายงาน: <span style="font-weight: 600; color: #0f172a;">${generatedBy}</span></div>
          </div>
        </div>
      `;
    };

    // -------------------------------------------------------------
    // Footer Renderer: Anchored to Bottom of A4 Sheet ("ลงมาถึงขีด เว้น 2 บรรทัด")
    // -------------------------------------------------------------
    const renderFooter = (pageIndex: number, totalPages: number): string => {
      return `
        <div style="margin-top: 10px; padding-top: 6px; border-top: 1.5px solid #2563eb; display: flex; justify-content: space-between; align-items: center; font-size: 8.5px; color: #64748b; line-height: 1.35;">
          <div style="font-weight: 700; color: #0f172a;">
            ระบบบริหารคลังสินค้าช่างและอะไหล่อัจฉริยะ (ENG SMART STORE APP) • แผนกวิศวกรรม Store FL.6
          </div>
          <div style="font-weight: 600; color: #475569;">
            Bangkok Marriott Hotel Sukhumvit • หน้า <strong style="color: #2563eb;">${pageIndex + 1}</strong> จาก <strong>${totalPages}</strong>
          </div>
        </div>
      `;
    };

    // -------------------------------------------------------------
    // Create Discrete Standard A4 Page Element (Exact 794px x 1122px)
    // -------------------------------------------------------------
    const createPageElement = (
      contentHtml: string,
      pageIndex: number,
      totalPages: number,
      isFirstPage: boolean
    ): HTMLDivElement => {
      const page = document.createElement('div');
      page.style.width = '794px'; // Standard A4 width at 96 DPI
      page.style.height = '1122px'; // Standard A4 height at 96 DPI (210mm x 297mm)
      page.style.padding = '22px 32px 18px 32px';
      page.style.boxSizing = 'border-box';
      page.style.display = 'flex';
      page.style.flexDirection = 'column';
      page.style.justifyContent = 'space-between';
      page.style.backgroundColor = '#ffffff';
      page.style.color = '#1e293b';
      page.style.fontFamily = '"IBM Plex Sans Thai", "Sarabun", "Prompt", sans-serif';
      page.style.lineHeight = '1.35';
      page.style.overflow = 'hidden';

      page.innerHTML = `
        <div style="flex-shrink: 0; margin-bottom: 4px;">
          ${renderHeader(!isFirstPage)}
        </div>
        <div style="flex-grow: 1; display: flex; flex-direction: column; min-height: 0;">
          ${contentHtml}
        </div>
        <div style="flex-shrink: 0; margin-top: auto;">
          ${renderFooter(pageIndex, totalPages)}
        </div>
      `;
      return page;
    };

    const pageElements: HTMLDivElement[] = [];

    // =============================================================
    // REPORT TYPE: REQUISITION HISTORY / INDIVIDUAL REQUISITION
    // =============================================================
    if (type === 'requisition_history' || type === 'individual_requisitions') {
      const matchedEmployee = findEmployeeInSystem(userFilter);
      const isIndividual = type === 'individual_requisitions' || Boolean(matchedEmployee) || Boolean(userFilter);

      if (matchedEmployee) {
        reportTitle = `รายงานประวัติการเบิก-รับสินค้ารายบุคคล: ${matchedEmployee.name} (${matchedEmployee.nickname}) [รหัส: ${matchedEmployee.id}]`;
        filename = `Requisition_${matchedEmployee.name.replace(/\s+/g, '_')}_ID_${matchedEmployee.id}_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;
        subtitle = `คลังสินค้า Store FL.6 | Employee: ${matchedEmployee.name} (${matchedEmployee.nickname}) | Employee ID: ${matchedEmployee.id}`;
      } else if (type === 'individual_requisitions') {
        reportTitle = 'รายงานประวัติการเบิก-รับสินค้ารายบุคคล (พนักงาน 32 คนที่กำหนด)';
        subtitle = `คลังสินค้า Store FL.6 | การออกรายงานรายบุคคลกำหนดเฉพาะพนักงาน 32 ท่านในระบบเท่านั้น (ไม่พบ: ${userFilter || 'ไม่ได้ระบุ'})`;
        filename = `Requisition_Invalid_Employee_${startDate || 'All'}.pdf`;
      } else {
        reportTitle = isIndividual 
          ? `รายงานประวัติการเบิก-รับสินค้ารายบุคคล: ${userFilter || 'ผู้ทำรายการ'}` 
          : 'รายงานประวัติการเบิก-รับเข้าสินค้าคงคลัง (Stock In-Out)';
        filename = isIndividual
          ? `Requisition_${(userFilter || 'User').replace(/\s+/g, '_')}_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`
          : `Requisitions_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;
      }

      // Filter by Date/Time
      let reqs = requisitions.filter(r => {
        const rDate = parseRecordDateTime(r.isoDate, r.timestamp);
        return isWithinDateTimeRange(rDate, startDate, startTime, endDate, endTime);
      });

      // Filter by User
      if (matchedEmployee) {
        const aliases = [
          matchedEmployee.name.toLowerCase(),
          matchedEmployee.id.toLowerCase(),
          matchedEmployee.nickname.toLowerCase(),
          matchedEmployee.thaiName.toLowerCase(),
          matchedEmployee.thaiNickname.toLowerCase(),
          ...(matchedEmployee.aliases || []).map(a => a.toLowerCase())
        ];
        reqs = reqs.filter(r => {
          if (!r.requestedBy) return false;
          const rLower = r.requestedBy.trim().toLowerCase();
          return aliases.some(alias => rLower === alias || rLower.includes(alias) || alias.includes(rLower));
        });
      } else if (type === 'individual_requisitions') {
        reqs = [];
      } else if (userFilter && userFilter.trim() !== '') {
        const lower = userFilter.trim().toLowerCase();
        reqs = reqs.filter(r => r.requestedBy && r.requestedBy.toLowerCase().includes(lower));
        subtitle = `คลังสินค้า Store FL.6 | ข้อมูลเฉพาะผู้ทำรายการ: ${userFilter}`;
      }

      const totalOut = reqs.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);
      const totalIn = reqs.filter(r => r.type === 'in').reduce((sum, r) => sum + r.qty, 0);
      const outRecordsCount = reqs.filter(r => r.type === 'out' || !r.type).length;
      const inRecordsCount = reqs.filter(r => r.type === 'in').length;
      const uniquePeople = new Set(reqs.map(r => r.requestedBy).filter(Boolean)).size;

      const summaryBannerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4.5px 10px; margin-bottom: 6px; font-size: 8.5px; line-height: 1.35;">
          <div>
            <strong>ช่วงเวลา:</strong> ${dateRangeLabel} • <strong>บันทึก:</strong> ${reqs.length} รายการ
            ${matchedEmployee ? ` • <strong>พนักงาน:</strong> ${matchedEmployee.name} (${matchedEmployee.nickname}) [${matchedEmployee.id}]` : userFilter ? ` • <strong>ผู้เบิก:</strong> ${userFilter}` : ''}
          </div>
          <div style="display: flex; gap: 12px;">
            <span>เบิกออก (Out): <strong style="color: #1d4ed8;">-${totalOut.toLocaleString()} ชิ้น</strong></span>
            <span>รับเข้า (In): <strong style="color: #15803d;">+${totalIn.toLocaleString()} ชิ้น</strong></span>
            <span>ผู้ทำรายการ: <strong style="color: #0f172a;">${isIndividual ? (userFilter || 'ระบุแล้ว') : `${uniquePeople} ท่าน`}</strong></span>
          </div>
        </div>
      `;

      // 30 items per page exactly as requested ("หน้าละ 30 รายการ แบบเต็มพอดี")
      const pageSize = 30;
      const totalPages = reqs.length === 0 ? 1 : Math.ceil(reqs.length / pageSize);

      const renderTableChunk = (chunk: typeof reqs, startIndex: number) => `
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8.5px; text-align: left; line-height: 1.35;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 4.5px 5px; width: 25px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">#</th>
                <th style="padding: 4.5px 5px; width: 95px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">วัน-เวลา</th>
                <th style="padding: 4.5px 5px; width: 55px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ประเภท</th>
                ${!isIndividual ? `<th style="padding: 4.5px 5px; width: 90px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ผู้ทำรายการ</th>` : ''}
                <th style="padding: 4.5px 5px; width: 75px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">รหัสสินค้า</th>
                <th style="padding: 4.5px 5px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">รายการสินค้า / หมวด</th>
                <th style="padding: 4.5px 5px; width: 70px; text-align: right; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">จำนวน</th>
                <th style="padding: 4.5px 5px; width: 80px; text-align: right; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">สต็อกปัจจุบัน</th>
                <th style="padding: 4.5px 5px; width: 140px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">งานที่นำไปใช้ / แหล่งที่มา</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.length === 0 ? `
                <tr><td colspan="${isIndividual ? 8 : 9}" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 11px;">ไม่พบประวัติการเบิกหรือรับเข้าตามช่วงเวลาและเงื่อนไขที่เลือก</td></tr>
              ` : chunk.map((rec, idx) => {
                const globalIdx = startIndex + idx;
                const isStockIn = rec.type === 'in';
                const typeBadge = isStockIn
                  ? `<span style="background-color: #dcfce7; color: #15803d; padding: 1px 5px; border-radius: 4px; font-weight: bold; font-size: 8px;">รับเข้า</span>`
                  : `<span style="background-color: #dbeafe; color: #1d4ed8; padding: 1px 5px; border-radius: 4px; font-weight: bold; font-size: 8px;">เบิกออก</span>`;
                const qtyColor = isStockIn ? '#15803d' : '#1d4ed8';
                const qtyPrefix = isStockIn ? '+' : '-';
                const itemMatch = items.find(i => i.id === rec.itemId) || items.find(i => i.name === rec.itemName);
                const currentStockText = itemMatch ? `${itemMatch.qty} ${itemMatch.unit}` : '-';

                return `
                  <tr style="${globalIdx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                    <td style="padding: 4px 5px; text-align: center; color: #64748b; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">${globalIdx + 1}</td>
                    <td style="padding: 4px 5px; color: #475569; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${formatRecordTimestamp(rec.timestamp, rec.isoDate)}</td>
                    <td style="padding: 4px 5px; text-align: center; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">${typeBadge}</td>
                    ${!isIndividual ? `<td style="padding: 4px 5px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${rec.requestedBy}</td>` : ''}
                    <td style="padding: 4px 5px; font-family: monospace; font-size: 8px; color: #2563eb; font-weight: bold; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${rec.itemId}</td>
                    <td style="padding: 4px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                      <div style="font-weight: 600; color: #1e293b; line-height: 1.35; padding: 1px 0;">${rec.itemName}</div>
                      ${rec.category ? `<div style="font-size: 7.5px; color: #64748b; line-height: 1.25;">${rec.category}</div>` : ''}
                    </td>
                    <td style="padding: 4px 5px; text-align: right; font-weight: bold; color: ${qtyColor}; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${qtyPrefix}${rec.qty} ${rec.unit}</td>
                    <td style="padding: 4px 5px; text-align: right; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${currentStockText}</td>
                    <td style="padding: 4px 5px; color: #334155; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                      <div style="line-height: 1.35;">${rec.purpose || '-'}</div>
                      ${rec.note ? `<div style="font-size: 7.5px; color: #94a3b8; line-height: 1.25;">(${rec.note})</div>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      let cursor = 0;
      let pageNum = 0;
      while (cursor < reqs.length || (reqs.length === 0 && pageNum === 0)) {
        const pRows = reqs.slice(cursor, cursor + pageSize);
        const isFirst = pageNum === 0;
        const pageHtml = `
          ${isFirst ? summaryBannerHtml : ''}
          ${renderTableChunk(pRows, cursor)}
        `;
        pageElements.push(createPageElement(pageHtml, pageNum, totalPages, isFirst));
        cursor += pageSize;
        pageNum++;
      }

    // =============================================================
    // REPORT TYPE: PURCHASE ORDERS HISTORY
    // =============================================================
    } else if (type === 'purchase_orders') {
      reportTitle = 'รายงานประวัติและสถานะคำสั่งซื้อสินค้า (Purchase Orders History)';
      filename = `PurchaseOrders_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;

      let filteredOrders = orders.filter(o => {
        const oDate = parseRecordDateTime(o.isoDate, o.createdAt);
        return isWithinDateTimeRange(oDate, startDate, startTime, endDate, endTime);
      });

      if (orderStatusFilter && orderStatusFilter !== 'all') {
        filteredOrders = filteredOrders.filter(o => o.status === orderStatusFilter);
      }
      if (userFilter && userFilter.trim() !== '') {
        const lower = userFilter.trim().toLowerCase();
        filteredOrders = filteredOrders.filter(o => o.requestedBy && o.requestedBy.toLowerCase().includes(lower));
      }

      const pendingCount = filteredOrders.filter(o => o.status === 'pending').length;
      const confirmedCount = filteredOrders.filter(o => o.status === 'confirmed').length;
      const receivedCount = filteredOrders.filter(o => o.status === 'received').length;
      const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length;
      const totalOrderedQty = filteredOrders.reduce((sum, o) => sum + (o.qty || 0), 0);

      const filterChipsHtml = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; font-size: 9.5px;">
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

      const summaryBannerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4.5px 10px; margin-bottom: 6px; font-size: 8.5px; line-height: 1.35;">
          <div>
            <strong>ช่วงเวลา:</strong> ${dateRangeLabel} • <strong>คำสั่งซื้อทั้งหมด:</strong> ${filteredOrders.length} ใบ (${totalOrderedQty.toLocaleString()} ชิ้น)
            ${userFilter ? ` • <strong>ผู้สั่ง:</strong> ${userFilter}` : ''}
          </div>
          <div style="display: flex; gap: 10px;">
            <span>รอยืนยัน: <strong style="color: #d97706;">${pendingCount}</strong></span>
            <span>ยืนยันแล้ว: <strong style="color: #2563eb;">${confirmedCount}</strong></span>
            <span>รับสินค้าแล้ว: <strong style="color: #16a34a;">${receivedCount}</strong></span>
            ${cancelledCount > 0 ? `<span>ยกเลิก: <strong style="color: #dc2626;">${cancelledCount}</strong></span>` : ''}
          </div>
        </div>
      `;

      // 30 items per page exactly as requested ("หน้าละ 30 รายการ แบบเต็มพอดี")
      const pageSize = 30;
      const totalPages = filteredOrders.length === 0 ? 1 : Math.ceil(filteredOrders.length / pageSize);

      const renderPoChunk = (chunk: typeof filteredOrders, startIndex: number) => `
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8.5px; text-align: left; line-height: 1.35;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 4.5px 5px; width: 20px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">#</th>
                <th style="padding: 4.5px 5px; width: 75px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">รหัส PO</th>
                <th style="padding: 4.5px 5px; width: 80px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">วันที่สั่ง</th>
                <th style="padding: 4.5px 5px; width: 65px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">รหัสสินค้า</th>
                <th style="padding: 4.5px 5px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">รายการสินค้า / ยี่ห้อ / รุ่น</th>
                <th style="padding: 4.5px 5px; width: 65px; text-align: right; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">จำนวน</th>
                <th style="padding: 4.5px 5px; width: 75px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ผู้สั่งซื้อ</th>
                <th style="padding: 4.5px 5px; width: 85px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ซัพพลายเออร์</th>
                <th style="padding: 4.5px 5px; width: 55px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ความเร่งด่วน</th>
                <th style="padding: 4.5px 5px; width: 70px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.length === 0 ? `
                <tr><td colspan="10" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 11px;">ไม่พบประวัติการสั่งซื้อสินค้าตามเงื่อนไขที่เลือก</td></tr>
              ` : chunk.map((order, idx) => {
                const globalIdx = startIndex + idx;
                let statusBadge = `<span style="background-color: #fef3c7; color: #b45309; padding: 1px 5px; border-radius: 4px; font-weight: bold; font-size: 8px;">รอยืนยัน</span>`;
                if (order.status === 'confirmed') {
                  statusBadge = `<span style="background-color: #dbeafe; color: #1d4ed8; padding: 1px 5px; border-radius: 4px; font-weight: bold; font-size: 8px;">ยืนยันแล้ว</span>`;
                } else if (order.status === 'received') {
                  statusBadge = `<span style="background-color: #dcfce7; color: #15803d; padding: 1px 5px; border-radius: 4px; font-weight: bold; font-size: 8px;">รับสินค้าแล้ว</span>`;
                } else if (order.status === 'cancelled') {
                  statusBadge = `<span style="background-color: #fee2e2; color: #b91c1c; padding: 1px 5px; border-radius: 4px; font-weight: bold; font-size: 8px;">ยกเลิก</span>`;
                }

                let urgencyBadge = `<span style="color: #64748b;">ปกติ</span>`;
                if (order.urgency === 'urgent') {
                  urgencyBadge = `<span style="color: #d97706; font-weight: bold;">ด่วน</span>`;
                } else if (order.urgency === 'critical') {
                  urgencyBadge = `<span style="color: #dc2626; font-weight: bold;">ด่วนที่สุด!</span>`;
                }

                const poDate = formatRecordTimestamp('', order.isoDate || order.createdAt);

                return `
                  <tr style="${globalIdx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                    <td style="padding: 4px 5px; text-align: center; color: #64748b; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">${globalIdx + 1}</td>
                    <td style="padding: 4px 5px; font-family: monospace; font-size: 8px; font-weight: bold; color: #2563eb; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${order.id}</td>
                    <td style="padding: 4px 5px; color: #475569; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${poDate}</td>
                    <td style="padding: 4px 5px; font-family: monospace; font-size: 8px; color: #64748b; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${order.itemId}</td>
                    <td style="padding: 4px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                      <div style="font-weight: 600; color: #1e293b; line-height: 1.35; padding: 1px 0;">${order.itemName}</div>
                      ${[order.brand, order.model].filter(Boolean).length > 0 ? `<div style="font-size: 7.5px; color: #64748b; line-height: 1.25;">${[order.brand, order.model].filter(Boolean).join(' • ')}</div>` : ''}
                    </td>
                    <td style="padding: 4px 5px; text-align: right; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${order.qty} ${order.unit}</td>
                    <td style="padding: 4px 5px; color: #334155; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${order.requestedBy}</td>
                    <td style="padding: 4px 5px; color: #475569; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${order.supplier || '-'}</td>
                    <td style="padding: 4px 5px; text-align: center; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">${urgencyBadge}</td>
                    <td style="padding: 4px 5px; text-align: center; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">${statusBadge}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      let cursor = 0;
      let pageNum = 0;
      while (cursor < filteredOrders.length || (filteredOrders.length === 0 && pageNum === 0)) {
        const pRows = filteredOrders.slice(cursor, cursor + pageSize);
        const isFirst = pageNum === 0;
        const pageHtml = `
          ${isFirst ? summaryBannerHtml : ''}
          ${renderPoChunk(pRows, cursor)}
        `;
        pageElements.push(createPageElement(pageHtml, pageNum, totalPages, isFirst));
        cursor += pageSize;
        pageNum++;
      }

    // =============================================================
    // REPORT TYPE: EXECUTIVE SUMMARY
    // =============================================================
    } else if (type === 'executive_summary') {
      reportTitle = 'รายงานสรุปภาพรวมผู้บริหาร (Executive Inventory & Transaction Summary)';
      filename = `Executive_Summary_${startDate || 'All'}_to_${endDate || now.toISOString().slice(0, 10)}.pdf`;

      const periodReqs = requisitions.filter(r => {
        const rDate = parseRecordDateTime(r.isoDate, r.timestamp);
        return isWithinDateTimeRange(rDate, startDate, startTime, endDate, endTime);
      });

      const periodOrders = orders.filter(o => {
        const oDate = parseRecordDateTime(o.isoDate, o.createdAt);
        return isWithinDateTimeRange(oDate, startDate, startTime, endDate, endTime);
      });

      const totalItemsCount = items.length;
      const totalInventoryQty = items.reduce((sum, i) => sum + i.qty, 0);
      const lowCount = items.filter(i => i.status === 'low').length;
      const outCount = items.filter(i => i.status === 'out').length;
      const totalOut = periodReqs.filter(r => r.type === 'out' || !r.type).reduce((sum, r) => sum + r.qty, 0);

      const userReqCounts: Record<string, { count: number; qty: number }> = {};
      periodReqs.forEach(r => {
        const u = r.requestedBy || 'ไม่ระบุ';
        if (!userReqCounts[u]) userReqCounts[u] = { count: 0, qty: 0 };
        userReqCounts[u].count += 1;
        userReqCounts[u].qty += r.qty;
      });
      const sortedUsers = Object.entries(userReqCounts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

      const catReqCounts: Record<string, number> = {};
      periodReqs.forEach(r => {
        const c = r.category || 'อื่นๆ';
        catReqCounts[c] = (catReqCounts[c] || 0) + r.qty;
      });
      const sortedCats = Object.entries(catReqCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const criticalItems = items.filter(i => i.status === 'out' || i.status === 'low');

      const filterChipsHtml = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; font-size: 9.5px;">
          <span style="background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 6px; color: #475569;">
            <strong>📅 ช่วงเวลาประเมิน:</strong> ${dateRangeLabel}
          </span>
          <span style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; color: #1d4ed8;">
            <strong>ผู้สร้างรายงาน:</strong> ${generatedBy}
          </span>
        </div>
      `;

      const summaryCardsHtml = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 10px;">
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px;">
            <div style="font-size: 9.5px; color: #64748b;">สินค้าคงคลังทั้งหมด</div>
            <div style="font-size: 15px; font-weight: bold; color: #0f172a;">${totalItemsCount} รายการ</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 1px;">สต็อกรวม ${totalInventoryQty.toLocaleString()} ชิ้น</div>
          </div>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 7px 10px;">
            <div style="font-size: 9.5px; color: #dc2626;">สินค้าวิกฤต (หมด/ใกล้หมด)</div>
            <div style="font-size: 15px; font-weight: bold; color: #b91c1c;">${lowCount + outCount} รายการ</div>
            <div style="font-size: 8px; color: #b91c1c; margin-top: 1px;">หมด ${outCount} | เหลือน้อย ${lowCount}</div>
          </div>
          <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 7px 10px;">
            <div style="font-size: 9.5px; color: #2563eb;">การเบิกใช้ในรอบเวลา</div>
            <div style="font-size: 15px; font-weight: bold; color: #1d4ed8;">-${totalOut.toLocaleString()} ชิ้น</div>
            <div style="font-size: 8px; color: #1d4ed8; margin-top: 1px;">จาก ${periodReqs.filter(r => r.type === 'out' || !r.type).length} ครั้ง</div>
          </div>
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 7px 10px;">
            <div style="font-size: 9.5px; color: #b45309;">การสั่งซื้อสินค้าในรอบ</div>
            <div style="font-size: 15px; font-weight: bold; color: #d97706;">${periodOrders.length} ใบ</div>
            <div style="font-size: 8px; color: #d97706; margin-top: 1px;">สำเร็จแล้ว ${periodOrders.filter(o => o.status === 'received').length} ใบ</div>
          </div>
        </div>
      `;

      const rankingsHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background-color: #ffffff;">
            <div style="font-size: 9.5px; font-weight: bold; color: #0f172a; margin-bottom: 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
              👤 5 อันดับผู้เบิกสินค้าสูงสุดในรอบเวลา
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
              <thead>
                <tr style="color: #64748b; border-bottom: 1px solid #e2e8f0;">
                  <th style="padding: 3.5px 2px; text-align: left;">ชื่อผู้เบิก</th>
                  <th style="padding: 3.5px 2px; text-align: right;">จำนวนครั้ง</th>
                  <th style="padding: 3.5px 2px; text-align: right;">จำนวนชิ้น</th>
                </tr>
              </thead>
              <tbody>
                ${sortedUsers.length === 0 ? `
                  <tr><td colspan="3" style="padding: 8px; text-align: center; color: #94a3b8;">ไม่มีรายการเบิก</td></tr>
                ` : sortedUsers.map(([name, stat], i) => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 3.5px 2px; font-weight: 600; color: #1e293b;">${i+1}. ${name}</td>
                    <td style="padding: 3.5px 2px; text-align: right; color: #64748b;">${stat.count} ครั้ง</td>
                    <td style="padding: 3.5px 2px; text-align: right; font-weight: bold; color: #2563eb;">${stat.qty.toLocaleString()} ชิ้น</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background-color: #ffffff;">
            <div style="font-size: 9.5px; font-weight: bold; color: #0f172a; margin-bottom: 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;">
              📦 5 หมวดหมู่ที่มีการเบิกจ่ายสูงสุด
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 8.5px;">
              <thead>
                <tr style="color: #64748b; border-bottom: 1px solid #e2e8f0;">
                  <th style="padding: 3.5px 2px; text-align: left;">หมวดหมู่</th>
                  <th style="padding: 3.5px 2px; text-align: right;">ยอดเบิกออกรวม</th>
                </tr>
              </thead>
              <tbody>
                ${sortedCats.length === 0 ? `
                  <tr><td colspan="2" style="padding: 8px; text-align: center; color: #94a3b8;">ไม่มีรายการเบิก</td></tr>
                ` : sortedCats.map(([cat, qty], i) => `
                  <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 3.5px 2px; font-weight: 600; color: #1e293b;">${i+1}. ${cat}</td>
                    <td style="padding: 3.5px 2px; text-align: right; font-weight: bold; color: #dc2626;">-${qty.toLocaleString()} ชิ้น</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      const renderCriticalTable = (chunk: typeof criticalItems, title: string = '🚨 รายการสินค้าที่ต้องสั่งซื้อด่วน (หมดสต็อกหรือต่ำกว่า Min Stock)') => `
        <div style="border: 1px solid #fee2e2; background-color: #fffafa; border-radius: 8px; padding: 8px;">
          <div style="font-size: 9.5px; font-weight: bold; color: #b91c1c; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
            <span>${title}</span>
            <span style="font-size: 8px; font-weight: normal; color: #dc2626;">ทั้งหมด ${criticalItems.length} รายการ</span>
          </div>
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8.5px; text-align: left; line-height: 1.35;">
            <thead>
              <tr style="background-color: #fee2e2; color: #991b1b;">
                <th style="padding: 4px; width: 80px; border-bottom: 1.5px solid #fca5a5; font-weight: 700;">รหัสสินค้า</th>
                <th style="padding: 4px; border-bottom: 1.5px solid #fca5a5; font-weight: 700;">ชื่อสินค้า</th>
                <th style="padding: 4px; width: 90px; border-bottom: 1.5px solid #fca5a5; font-weight: 700;">หมวดหมู่</th>
                <th style="padding: 4px; width: 60px; text-align: right; border-bottom: 1.5px solid #fca5a5; font-weight: 700;">คงเหลือ</th>
                <th style="padding: 4px; width: 60px; text-align: right; border-bottom: 1.5px solid #fca5a5; font-weight: 700;">Min Stock</th>
                <th style="padding: 4px; width: 70px; text-align: center; border-bottom: 1.5px solid #fca5a5; font-weight: 700;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.length === 0 ? `
                <tr><td colspan="6" style="padding: 16px; text-align: center; color: #16a34a; font-weight: bold;">สต็อกสินค้าอยู่ในเกณฑ์ปกติทุกรายการ ✅</td></tr>
              ` : chunk.map((it, idx) => `
                <tr style="${idx % 2 === 1 ? 'background-color: #ffffff;' : ''}">
                  <td style="padding: 4px; font-family: monospace; font-weight: bold; color: #b91c1c; border-bottom: 1px solid #fecaca; vertical-align: middle; white-space: nowrap;">${it.id}</td>
                  <td style="padding: 4px; font-weight: 600; color: #1e293b; border-bottom: 1px solid #fecaca; vertical-align: middle;">
                    <div style="line-height: 1.35; padding: 1px 0;">${it.name}</div>
                  </td>
                  <td style="padding: 4px; color: #64748b; border-bottom: 1px solid #fecaca; vertical-align: middle;">${it.category}</td>
                  <td style="padding: 4px; text-align: right; font-weight: bold; color: ${it.status === 'out' ? '#dc2626' : '#d97706'}; border-bottom: 1px solid #fecaca; vertical-align: middle; white-space: nowrap;">${it.qty} ${it.unit}</td>
                  <td style="padding: 4px; text-align: right; color: #64748b; border-bottom: 1px solid #fecaca; vertical-align: middle; white-space: nowrap;">${it.minStock}</td>
                  <td style="padding: 4px; text-align: center; border-bottom: 1px solid #fecaca; vertical-align: middle;">
                    <span style="font-size: 7.5px; font-weight: bold; padding: 1px 5px; border-radius: 4px; background-color: ${it.status === 'out' ? '#fee2e2' : '#fef3c7'}; color: ${it.status === 'out' ? '#b91c1c' : '#b45309'};">
                      ${it.status === 'out' ? 'หมดสต็อก' : 'ใกล้หมด'}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Page 1 holds up to 18 critical items with ranking tables, subsequent pages hold 30 items
      const firstPageCriticalLimit = 18;
      const subPageCriticalLimit = 30;

      let totalPages = 1;
      if (criticalItems.length > firstPageCriticalLimit) {
        totalPages = 1 + Math.ceil((criticalItems.length - firstPageCriticalLimit) / subPageCriticalLimit);
      }

      const p1Critical = criticalItems.slice(0, firstPageCriticalLimit);
      const remainingCritical = criticalItems.slice(firstPageCriticalLimit);

      const p1Html = `
        ${filterChipsHtml}
        ${summaryCardsHtml}
        ${rankingsHtml}
        ${renderCriticalTable(p1Critical, '🚨 รายการสินค้าที่ต้องสั่งซื้อด่วน (หมดสต็อกหรือต่ำกว่า Min Stock)')}
      `;
      pageElements.push(createPageElement(p1Html, 0, totalPages, true));

      let cursor = 0;
      let pageNum = 1;
      while (cursor < remainingCritical.length) {
        const chunk = remainingCritical.slice(cursor, cursor + subPageCriticalLimit);
        const pSubHtml = renderCriticalTable(
          chunk,
          `🚨 รายการสินค้าที่ต้องสั่งซื้อด่วน (ต่อ - รายการที่ ${firstPageCriticalLimit + 1 + cursor} ถึง ${firstPageCriticalLimit + cursor + chunk.length})`
        );
        pageElements.push(createPageElement(pSubHtml, pageNum, totalPages, false));
        cursor += subPageCriticalLimit;
        pageNum++;
      }

    // =============================================================
    // REPORT TYPE: ALL INVENTORY / LOW STOCK / CATEGORY
    // =============================================================
    } else {
      let filteredItems = [...items];
      if (type === 'low_stock') {
        reportTitle = 'รายงานสินค้าใกล้หมด / หมดสต็อก (Low & Out of Stock Report)';
        filename = `Low_Stock_Report_${now.toISOString().slice(0, 10)}.pdf`;
        filteredItems = items.filter(i => i.status === 'low' || i.status === 'out');
      } else if (type === 'category' && categoryFilter) {
        reportTitle = `รายงานสต็อกสินค้า หมวดหมู่: ${categoryFilter}`;
        filename = `Category_Report_${now.toISOString().slice(0, 10)}.pdf`;
        filteredItems = items.filter(i => (i.category || '').toLowerCase() === categoryFilter.toLowerCase());
      } else {
        reportTitle = 'รายงานบัญชีสต็อกสินค้าคงคลังทั้งหมด (Master Inventory All)';
        filename = `Inventory_All_${now.toISOString().slice(0, 10)}.pdf`;
      }

      const totalQty = filteredItems.reduce((sum, i) => sum + i.qty, 0);
      const lowCount = filteredItems.filter(i => i.status === 'low').length;
      const outCount = filteredItems.filter(i => i.status === 'out').length;
      const normalCount = filteredItems.filter(i => i.status === 'normal' || (!i.status && i.qty > i.minStock)).length;

      const summaryBannerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4.5px 10px; margin-bottom: 6px; font-size: 8.5px; line-height: 1.35;">
          <div><strong>หมวดหมู่:</strong> ${categoryFilter || 'ทุกหมวดหมู่'} • <strong>รายการทั้งหมด:</strong> ${filteredItems.length} รายการ</div>
          <div style="display: flex; gap: 12px;">
            <span>ปกติ: <strong style="color: #15803d;">${normalCount}</strong></span>
            <span>ใกล้หมด: <strong style="color: #ca8a04;">${lowCount}</strong></span>
            <span>หมดสต็อก: <strong style="color: #dc2626;">${outCount}</strong></span>
            <span>สต็อกรวม: <strong style="color: #2563eb;">${totalQty.toLocaleString()} ชิ้น</strong></span>
          </div>
        </div>
      `;

      // 30 items per page exactly as requested ("หน้าละ 30 รายการ แบบเต็มพอดี")
      const pageSize = 30;
      const totalPages = filteredItems.length === 0 ? 1 : Math.ceil(filteredItems.length / pageSize);

      const renderItemChunk = (chunk: typeof filteredItems, startIndex: number) => `
        <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
          <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8.5px; text-align: left; line-height: 1.35;">
            <thead>
              <tr style="background-color: #f1f5f9;">
                <th style="padding: 4.5px 5px; width: 25px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">#</th>
                <th style="padding: 4.5px 5px; width: 85px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">รหัสสินค้า</th>
                <th style="padding: 4.5px 5px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ชื่อสินค้า / รายการ</th>
                <th style="padding: 4.5px 5px; width: 90px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">หมวดหมู่</th>
                <th style="padding: 4.5px 5px; width: 65px; text-align: right; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">คงเหลือ</th>
                <th style="padding: 4.5px 5px; width: 55px; text-align: right; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">Min Stock</th>
                <th style="padding: 4.5px 5px; width: 85px; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">ตำแหน่งจัดเก็บ</th>
                <th style="padding: 4.5px 5px; width: 65px; text-align: center; border-bottom: 1.5px solid #cbd5e1; color: #334155; font-weight: 700;">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${chunk.length === 0 ? `
                <tr><td colspan="8" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 11px;">ไม่พบรายการสินค้า</td></tr>
              ` : chunk.map((item, idx) => {
                const globalIdx = startIndex + idx;
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
                  <tr style="${globalIdx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
                    <td style="padding: 4px 5px; text-align: center; color: #64748b; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">${globalIdx + 1}</td>
                    <td style="padding: 4px 5px; font-family: monospace; font-size: 8px; font-weight: bold; color: #2563eb; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${item.id}</td>
                    <td style="padding: 4px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                      <div style="font-weight: 600; color: #0f172a; line-height: 1.35; padding: 1px 0;">${item.name}</div>
                      ${item.note ? `<div style="font-size: 7.5px; color: #64748b; line-height: 1.25;">${item.note}</div>` : ''}
                    </td>
                    <td style="padding: 4px 5px; color: #475569; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${item.category}</td>
                    <td style="padding: 4px 5px; text-align: right; font-weight: bold; color: #0f172a; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${item.qty} <span style="font-size: 7.5px; font-weight: normal; color: #64748b;">${item.unit}</span></td>
                    <td style="padding: 4px 5px; text-align: right; color: #64748b; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${item.minStock}</td>
                    <td style="padding: 4px 5px; color: #475569; font-size: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; white-space: nowrap;">${item.location || 'Store FL.6'}</td>
                    <td style="padding: 4px 5px; text-align: center; border-bottom: 1px solid #e2e8f0; vertical-align: middle;">
                      <span style="display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 8px; font-weight: bold; background-color: ${statusBg}; color: ${statusColor};">
                        ${statusLabel}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      let cursor = 0;
      let pageNum = 0;
      while (cursor < filteredItems.length || (filteredItems.length === 0 && pageNum === 0)) {
        const pRows = filteredItems.slice(cursor, cursor + pageSize);
        const isFirst = pageNum === 0;
        const pageHtml = `
          ${isFirst ? summaryBannerHtml : ''}
          ${renderItemChunk(pRows, cursor)}
        `;
        pageElements.push(createPageElement(pageHtml, pageNum, totalPages, isFirst));
        cursor += pageSize;
        pageNum++;
      }
    }

    // Append all constructed A4 pages to the hidden container
    for (const pageEl of pageElements) {
      container.appendChild(pageEl);
    }

    // Ensure fonts are fully loaded before capturing canvas to prevent text baseline distortion
    if (document.fonts) {
      try {
        await document.fonts.ready;
      } catch {
        // ignore font loading error
      }
    }

    // Convert each page to high-res canvas and write to standard A4 PDF sheet (210mm x 297mm)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    for (let i = 0; i < pageElements.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }
      const pageEl = pageElements[i];
      const canvas = await html2canvas(pageEl, {
        scale: 2, // 2x sharp resolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 794,
        height: 1122,
        windowWidth: 794,
        windowHeight: 1122,
        x: 0,
        y: 0,
        scrollY: 0,
        scrollX: 0,
        imageTimeout: 0,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
