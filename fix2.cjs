const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const startPattern = /{generatingPdfId === \(msg\.id \+ idx\) \? \([\s\S]*?{\/\* Live Chat Button \*\//;

const replacement = `{generatingPdfId === (msg.id + idx) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังสร้างไฟล์...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-4 h-4" />
                          <span>ดาวน์โหลดไฟล์ {report.format === 'excel' ? 'Excel' : 'PDF'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Live Interim Transcript Bubble while Listening */}
        {isListening && transcript && (
          <div className="flex flex-col items-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-none p-3 bg-blue-500/80 text-white text-lg shadow-xs animate-pulse">
              <span className="text-xs block opacity-80 mb-0.5">กำลังฟังเสียง...</span>
              {transcript}
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-3 shadow-xs w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-lg">AI กำลังวิเคราะห์คำสั่งและปรับปรุงฐานข้อมูล...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Voice Control & Input Area (Permanently locked above bottom navigation bar) */}
      <div 
        style={{
          paddingBottom: 'max(108px, calc(env(safe-area-inset-bottom, 24px) + 90px))'
        }}
        className="px-3 pt-2 pb-1 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-colors duration-200 z-20"
      >
        {/* Live Chat Button */}`;

code = code.replace(startPattern, replacement);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
