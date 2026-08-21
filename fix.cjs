const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const brokenBlock = `                          <span>กำลังสร้างไฟล์...</span          className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-2xl p-1.5 shadow-sm transition-colors"
        >
          {/* Normal Dictation Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isProcessing}
            className={\`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center transition-all shadow-sm cursor-pointer active:scale-95 shrink-0 \${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
            }\`}
          >
            {isListening ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="พิมพ์ หรือสั่งพิมพ์ด้วยเสียง..."
            disabled={isProcessing}
            className="flex-1 bg-transparent px-3 py-2 text-base sm:text-lg text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white flex items-center justify-center transition-all shadow-sm cursor-pointer active:scale-95 shrink-0"
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
          </button> className="px-3 pt-2 pb-1 bg-white dark:bg-slate-900 border-t border-slate-200/90 dark:border-slate-800 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-colors duration-200 z-20"
      >
        {/* Live Chat Button */}`;

const fixBlock = `                          <span>กำลังสร้างไฟล์...</span>
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

code = code.replace(brokenBlock, fixBlock);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
