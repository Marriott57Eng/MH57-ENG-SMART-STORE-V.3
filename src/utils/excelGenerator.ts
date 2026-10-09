import * as XLSX from 'xlsx';
import { InventoryItem, RequisitionRecord } from '../types';
import { formatRecordTimestamp } from './dateUtils';
import { findEmployeeInSystem } from './employeeDirectory';

interface GenerateExcelProps {
  type: 'inventory_all' | 'low_stock' | 'requisition_history' | 'individual_requisitions' | 'category';
  title: string;
  categoryFilter?: string;
  userFilter?: string;
  items: InventoryItem[];
  requisitions: RequisitionRecord[];
}

export const generateAndDownloadExcel = async ({
  type,
  title,
  categoryFilter,
  userFilter,
  items,
  requisitions
}: GenerateExcelProps) => {
  let data: any[] = [];
  let filename = 'Report.xlsx';

  if (type === 'inventory_all' || type === 'low_stock' || type === 'category') {
    let filteredItems = items;
    if (type === 'low_stock') {
      filteredItems = items.filter(i => i.status === 'low' || i.status === 'out');
    }
    if (categoryFilter) {
      const filters = categoryFilter.split(',').map(f => f.trim().toLowerCase());
      filteredItems = filteredItems.filter(i => 
        filters.some(f => i.category.toLowerCase().includes(f))
      );
    }
    
    data = filteredItems.map(item => ({
      'รหัสสินค้า': item.id,
      'ชื่อสินค้า': item.name,
      'หมวดหมู่': item.category,
      'จำนวนคงเหลือ': item.qty,
      'หน่วย': item.unit,
      'สถานที่เก็บ': item.location || '-',
      'สถานะ': item.status === 'normal' ? 'ปกติ' : item.status === 'low' ? 'ใกล้หมด' : 'หมด'
    }));
    filename = type === 'low_stock' ? 'Low_Stock_Report.xlsx' : 'Inventory_Report.xlsx';
  } else if (type === 'requisition_history' || type === 'individual_requisitions') {
    let reqs = requisitions;
    const matchedEmployee = findEmployeeInSystem(userFilter);

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
      filename = `Transaction_History_${matchedEmployee.name.replace(/\s+/g, '_')}_ID_${matchedEmployee.id}.xlsx`;
    } else if (userFilter) {
      const lowerFilter = userFilter.toLowerCase();
      reqs = reqs.filter(r => (r.requestedBy && r.requestedBy.toLowerCase().includes(lowerFilter)));
      filename = `Transaction_History_${userFilter.replace(/\s+/g, '_')}.xlsx`;
    } else {
      filename = 'Transaction_History.xlsx';
    }

    const sortedReqs = [...reqs].sort((a, b) => {
      const timeA = a.isoDate ? new Date(a.isoDate).getTime() : 0;
      const timeB = b.isoDate ? new Date(b.isoDate).getTime() : 0;
      return timeB - timeA;
    });
    data = sortedReqs.map(req => ({
      'วันที่': formatRecordTimestamp(req.timestamp, req.isoDate),
      'ประเภท': req.type === 'in' ? 'รับเข้า' : 'เบิกออก',
      'รหัสสินค้า': req.itemId,
      'ชื่อสินค้า': req.itemName,
      'จำนวน': req.qty,
      'ผู้ทำรายการ': req.requestedBy,
      'งาน/สถานที่': req.purpose || '-',
      'หมายเหตุ': req.note || '-'
    }));
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  
  XLSX.writeFile(wb, filename);
};
