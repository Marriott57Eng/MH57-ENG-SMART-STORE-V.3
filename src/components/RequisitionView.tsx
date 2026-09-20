import React, { useState } from 'react';
import { RequisitionRecord, InventoryItem } from '../types';
import { 
  ClipboardList, Search, Clock, MapPin,
  Plus, Package, FileText, Trash2, FileDown, Loader2,
  ArrowDownRight, ArrowUpRight, CheckCircle2, AlertTriangle, XCircle, Boxes, Edit3
} from 'lucide-react';
import { generateAndDownloadPdf } from '../utils/pdfGenerator';
import { formatRecordTimestamp } from '../utils/dateUtils';

interface RequisitionViewProps {
  records: RequisitionRecord[];
  items: InventoryItem[];
  isAdmin?: boolean;
  onOpenNewRequisition: () => void;
  onDeleteRecord: (id: string) => void;
  onEditRecord?: (record: RequisitionRecord) => void;
}

export const RequisitionView: React.FC<RequisitionViewProps> = ({
  records,
  items,
  isAdmin = false,
  onOpenNewRequisition,
  onDeleteRecord,
  onEditRecord,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'out' | 'in'>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const getCategoryColor = (_cat?: string) => {
    return 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-700/80';
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await generateAndDownloadPdf({
        type: 'requisition_history',
        title: 'รายงานประวัติการเบิก/รับเข้าสินค้า (Store FL.6)',
        items,
        requisitions: filteredRecords.length > 0 ? filteredRecords : records,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Filtered records by search and type
  const filteredRecords = records.filter((rec) => {
    const matchesType = 
      typeFilter === 'all' 
        ? true 
        : typeFilter === 'in' 
        ? rec.type === 'in' 
        : (rec.type === 'out' || !rec.type);

    const matchesSearch =
      rec.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.category.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesType && matchesSearch;
  });

  // Calculate quick stats
  const totalWithdrawn = records
    .filter((r) => r.type === 'out' || !r.type)
    .reduce((sum, r) => sum + r.qty, 0);

  const totalReceived = records
    .filter((r) => r.type === 'in')
    .reduce((sum, r) => sum + r.qty, 0);

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      {/* Subheader */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 px-4 sm:px-6 py-2.5 shrink-0 shadow-2xs transition-colors duration-200">
        <div className="max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs border border-blue-500">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ประวัติการเบิก / รับเข้า</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">บันทึกความเคลื่อนไหวสต็อกสินค้าเข้า-ออก</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || records.length === 0}
              className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 active:scale-95 disabled:opacity-50 text-slate-700 dark:text-slate-200 px-2.5 py-2 rounded-xl text-lg font-semibold flex items-center gap-1 transition-all border border-slate-300 dark:border-slate-650 cursor-pointer shadow-2xs"
              title="ส่งออกรายงาน PDF"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              ) : (
                <FileDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
              <span className="hidden sm:inline">ส่งออก</span> PDF
            </button>

            <button
              onClick={onOpenNewRequisition}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 active:scale-95 text-white px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all border border-blue-500 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              บันทึก เบิก/รับเข้า
            </button>
          </div>
        </div>

        {/* Stats summary banner */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-750">
          <div className="bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-2xs">
            <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 block font-medium">รายการทั้งหมด</span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">{records.length} ครั้ง</span>
          </div>
          <div className="bg-blue-50/80 dark:bg-blue-950/40 p-2 rounded-xl border border-blue-200 dark:border-blue-800/80 text-center shadow-2xs">
            <span className="text-[11px] sm:text-xs text-blue-600 dark:text-blue-400 block font-medium">เบิกออกรวม</span>
            <span className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300">{totalWithdrawn} ชิ้น</span>
          </div>
          <div className="bg-emerald-50/80 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 text-center shadow-2xs">
            <span className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 block font-medium">รับเข้ารวม</span>
            <span className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-300">+{totalReceived} ชิ้น</span>
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 mt-3 pt-1">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-2xs ${
              typeFilter === 'all'
                ? 'bg-blue-600 text-white border border-blue-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
            }`}
          >
            ทั้งหมด ({records.length})
          </button>
          <button
            onClick={() => setTypeFilter('out')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
              typeFilter === 'out'
                ? 'bg-blue-600 text-white border border-blue-700 dark:border-blue-500 shadow-xs'
                : 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 hover:bg-blue-100 dark:hover:bg-blue-900/50'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            เบิกออก ({records.filter((r) => r.type === 'out' || !r.type).length})
          </button>
          <button
            onClick={() => setTypeFilter('in')}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
              typeFilter === 'in'
                ? 'bg-emerald-600 text-white border border-emerald-700 dark:border-emerald-500 shadow-xs'
                : 'bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            รับเข้า ({records.filter((r) => r.type === 'in').length})
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mt-2.5">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อผู้ทำรายการ, สินค้า, รหัส หรือสถานที่..."
            className="w-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm sm:text-base text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500 shadow-2xs transition-all"
          />
        </div>
        </div>
      </div>

      {/* Record list container */}
      <div className="flex-1 p-3.5 sm:p-5 md:p-6 pb-28 sm:pb-24 landscape:pb-8">
        {filteredRecords.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-12 px-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-white/50 dark:bg-slate-900/50">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-850 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-750">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-lg mb-1">
              {searchTerm
                ? 'ไม่พบประวัติที่ตรงกับคำค้นหา'
                : 'ยังไม่มีประวัติการเบิกหรือรับเข้าสินค้า'}
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
              แตะปุ่ม "บันทึก เบิก/รับเข้า" ด้านบนเพื่อเริ่มบันทึกรายการ
            </p>
            <button
              onClick={onOpenNewRequisition}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer border border-blue-500"
            >
              <Plus className="w-4 h-4" />
              บันทึก เบิก/รับเข้า
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 landscape:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5 max-w-7xl mx-auto w-full">
            {filteredRecords.map((record) => {
            const isStockIn = record.type === 'in';
            
            // Find current inventory item matching this record
            const currentItem = items.find((i) => i.id === record.itemId) || 
                                items.find((i) => i.name === record.itemName);
            
            const currentQty = currentItem ? currentItem.qty : null;
            const currentUnit = currentItem ? currentItem.unit : record.unit;
            const currentStatus = currentItem ? currentItem.status : 'normal';

            return (
              <div
                key={record.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] hover:border-blue-400 dark:hover:border-blue-500/70 transition-all space-y-3"
              >
                {/* Top: User Info, Type Badge & Timestamp */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border ${
                      isStockIn 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                        : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    }`}>
                      {isStockIn ? (
                        <ArrowDownRight className="w-4.5 h-4.5" />
                      ) : (
                        <ArrowUpRight className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                          {record.requestedBy}
                        </h3>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                          isStockIn
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80'
                            : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80'
                        }`}>
                          {isStockIn ? 'รับเข้า' : 'เบิกออก'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{formatRecordTimestamp(record.timestamp, record.isoDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Quantity Badge */}
                  <div className="text-right">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-sm sm:text-base font-black border ${
                      isStockIn
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/80'
                    }`}>
                      {isStockIn ? `+${record.qty}` : `-${record.qty}`} {record.unit}
                    </span>
                  </div>
                </div>

                {/* Middle: Item Details */}
                <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-black px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-800 shadow-2xs">
                          {record.itemId}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getCategoryColor(
                            record.category
                          )}`}
                        >
                          {record.category}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug line-clamp-2">
                        {record.itemName}
                      </h4>

                      {/* CURRENT WAREHOUSE STOCK BALANCE */}
                      <div className="mt-2 pt-1.5 border-t border-slate-200/80 dark:border-slate-700 flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                          <Boxes className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                          <span className="text-slate-500 dark:text-slate-400">สต็อกคงเหลือปัจจุบัน:</span>
                          <span className="font-black text-slate-900 dark:text-white">
                            {currentQty !== null ? `${currentQty} ${currentUnit}` : 'ไม่พบข้อมูล'}
                          </span>
                        </div>

                        {currentQty !== null && (
                          <div>
                            {currentStatus === 'out' ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 px-1.5 py-0.5 rounded">
                                <XCircle className="w-2.5 h-2.5" /> หมดสต็อก
                              </span>
                            ) : currentStatus === 'low' ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 px-1.5 py-0.5 rounded">
                                <AlertTriangle className="w-2.5 h-2.5" /> สต็อกเหลือน้อย
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="w-2.5 h-2.5" /> ปกติ
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom: Purpose / Location & Note */}
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="flex items-start gap-1.5 text-slate-700 dark:text-slate-300">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isStockIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
                    <span className="font-medium">
                      <strong className="text-slate-900 dark:text-slate-100">
                        {isStockIn ? 'แหล่งที่มา / เหตุผล:' : 'งานที่นำไปใช้:'}
                      </strong>{' '}
                      {record.purpose}
                    </span>
                  </div>

                  {record.note && (
                    <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
                      <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                      <span>หมายเหตุ: {record.note}</span>
                    </div>
                  )}
                </div>

                {/* Admin Actions: Edit & Delete (Only visible for Admin) */}
                {isAdmin && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    {onEditRecord && (
                      <button
                        onClick={() => onEditRecord(record)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1 font-semibold transition-all px-2.5 py-1 rounded-lg cursor-pointer border border-blue-200 dark:border-blue-800"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        แก้ไขประวัติ
                      </button>
                    )}
                    <button
                      onClick={() => {
                        const cleanId = record.id.replace(/^REQ-?/i, '');
                        if (confirm(`คุณต้องการลบประวัติรายการ "${record.itemName}" (${cleanId}) ใช่หรือไม่?`)) {
                          onDeleteRecord(record.id);
                        }
                      }}
                      className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center gap-1 font-semibold transition-all px-2.5 py-1 rounded-lg cursor-pointer border border-red-200 dark:border-red-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      ลบประวัตินี้
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        )}
      </div>
    </div>
  );
};
