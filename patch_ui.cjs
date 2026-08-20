const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

// The file currently has this block:
/*
              {msg.fileReport && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="bg-gradient-to-r from-red-50/80 to-orange-50/60 border border-red-200/90 rounded-xl p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-lg">{msg.fileReport.title}</span>
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
                  </div>
                </div>
              )}
*/

const oldBlock = `{msg.fileReport && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="bg-gradient-to-r from-red-50/80 to-orange-50/60 border border-red-200/90 rounded-xl p-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-lg">{msg.fileReport.title}</span>
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
                  </div>
                </div>
              )}`;

const newBlock = `{msg.fileReport && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className={\`border rounded-xl p-3 shadow-xs \${msg.fileReport.format === 'excel' ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/60 border-green-200/90' : 'bg-gradient-to-r from-red-50/80 to-orange-50/60 border-red-200/90'}\`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={\`w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-xs shrink-0 \${msg.fileReport.format === 'excel' ? 'bg-green-600' : 'bg-red-600'}\`}>
                          <FileText className="w-8 h-8" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-lg">{msg.fileReport.title}</span>
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
                  </div>
                </div>
              )}`;

code = code.replace(oldBlock, newBlock);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
console.log("Replaced block");
