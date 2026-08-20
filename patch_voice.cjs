const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

code = code.replace(/import \{ generateAndDownloadPdf \} from '\.\.\/utils\/pdfGenerator';/, "import { generateAndDownloadPdf } from '../utils/pdfGenerator';\nimport { generateAndDownloadExcel } from '../utils/excelGenerator';");

const oldHandler = `  // Download PDF handler
  const handleDownloadPdf = async (report: PdfReportAction, msgId: string) => {
    try {
      setGeneratingPdfId(msgId);
      await generateAndDownloadPdf({
        type: report.type,
        title: report.title,
        categoryFilter: report.categoryFilter,
        items,
        requisitions,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
    } finally {
      setGeneratingPdfId(null);
    }
  };`;

const newHandler = `  // Download handler
  const handleDownloadReport = async (report: any, msgId: string, isExcel: boolean = false) => {
    try {
      setGeneratingPdfId(msgId); // reuse state for loading
      if (isExcel || report.format === 'excel') {
        await generateAndDownloadExcel({
          type: report.type,
          title: report.title,
          categoryFilter: report.categoryFilter,
          items,
          requisitions,
        });
      } else {
        await generateAndDownloadPdf({
          type: report.type,
          title: report.title,
          categoryFilter: report.categoryFilter,
          items,
          requisitions,
        });
      }
    } catch (err) {
      console.error('Error generating report:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์');
    } finally {
      setGeneratingPdfId(null);
    }
  };`;
code = code.replace(oldHandler, newHandler);

// Replace mapping inside JSX
// Replace pdfReport in JSON parsing
code = code.replace(/pdfReport: data\.pdfReport,/g, 'fileReport: data.fileReport || data.pdfReport,');

// Replace msg.pdfReport! usage
code = code.replace(/msg\.pdfReport!/g, 'msg.fileReport!');

// Replace the UI for pdfReport with fileReport
code = code.replace(/\{msg\.pdfReport && \(/g, '{msg.fileReport && (');
code = code.replace(/\{msg\.pdfReport\.title\}/g, '{msg.fileReport.title}');
// Handle PDF/Excel UI
const oldUI = `<span className="font-bold text-slate-900 text-lg">{msg.fileReport.title}</span>
                            <span className="text-sm font-extrabold bg-red-100 text-red-700 px-1.5 py-0.2 rounded">PDF</span>
                          </div>
                          <p className="text-xs text-slate-500">เอกสารรายงานพร้อมดาวน์โหลด</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadPdf(msg.fileReport!, msg.id)}
                      disabled={generatingPdfId === msg.id}
                      className="w-full bg-red-600 hover:bg-red-700 active:scale-[0.98] disabled:opacity-75 text-white py-2 px-3 rounded-lg text-lg font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {generatingPdfId === msg.id ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span>กำลังสร้างไฟล์ PDF...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-8 h-8" />
                          <span>ดาวน์โหลดไฟล์ PDF</span>
                        </>
                      )}
                    </button>
                  </div>`;

const newUI = `<span className="font-bold text-slate-900 text-lg">{msg.fileReport.title}</span>
                            <span className={\`text-sm font-extrabold px-1.5 py-0.2 rounded \${msg.fileReport.format === 'excel' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}\`}>
                              {msg.fileReport.format === 'excel' ? 'EXCEL' : 'PDF'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">เอกสารรายงานพร้อมดาวน์โหลด</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadReport(msg.fileReport!, msg.id, msg.fileReport.format === 'excel')}
                      disabled={generatingPdfId === msg.id}
                      className={\`w-full active:scale-[0.98] disabled:opacity-75 text-white py-2 px-3 rounded-lg text-lg font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer \${msg.fileReport.format === 'excel' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}\`}
                    >
                      {generatingPdfId === msg.id ? (
                        <>
                          <Loader2 className="w-8 h-8 animate-spin" />
                          <span>กำลังสร้างไฟล์...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-8 h-8" />
                          <span>ดาวน์โหลดไฟล์ {msg.fileReport.format === 'excel' ? 'Excel' : 'PDF'}</span>
                        </>
                      )}
                    </button>
                  </div>`;

code = code.replace(oldUI, newUI);

// Re-add pdfReport to fileReport
code = code.replace(/msg\.pdfReport/g, 'msg.fileReport');

fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
console.log("Patched VoiceView for Excel");
