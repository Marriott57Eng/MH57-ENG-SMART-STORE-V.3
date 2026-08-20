const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

// 1. Add out of stock warning
const oldDetails = `                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 mb-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-lg">
                              <span className="font-bold text-slate-800 truncate pr-1">
                                {msg.dbAction.item.name}
                              </span>
                              <span className="font-mono text-xs text-slate-500 shrink-0">
                                {msg.dbAction.item.id}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 block">{msg.dbAction.item.category}</span>
                          </div>
                        </div>

                        {typeof msg.dbAction.previousQty === 'number' && typeof msg.dbAction.newQty === 'number' && (
                          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-slate-100">
                            <span className="text-slate-500">จำนวนสต็อกคงเหลือ:</span>
                            <span className="font-extrabold text-slate-900">
                              <span className="line-through text-slate-400 mr-1.5">{msg.dbAction.previousQty}</span>
                              ➔ <span className="text-blue-600 font-bold ml-1">{msg.dbAction.newQty}</span> {msg.dbAction.item.unit}
                            </span>
                          </div>
                        )}
                      </div>
                    )}`;

const newDetails = `                      <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 mb-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-lg">
                              <span className="font-bold text-slate-800 truncate pr-1">
                                {msg.dbAction.item.name}
                              </span>
                              <span className="font-mono text-xs text-slate-500 shrink-0">
                                {msg.dbAction.item.id}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 block">{msg.dbAction.item.category}</span>
                          </div>
                        </div>

                        {typeof msg.dbAction.previousQty === 'number' && typeof msg.dbAction.newQty === 'number' && (
                          <div className="flex items-center justify-between text-sm pt-1.5 border-t border-slate-100">
                            <span className="text-slate-500">จำนวนสต็อกคงเหลือ:</span>
                            <span className="font-extrabold text-slate-900">
                              <span className="line-through text-slate-400 mr-1.5">{msg.dbAction.previousQty}</span>
                              ➔ <span className="text-blue-600 font-bold ml-1">{msg.dbAction.newQty}</span> {msg.dbAction.item.unit}
                            </span>
                          </div>
                        )}
                        
                        {/* Out of Stock Warning inside details */}
                        {msg.dbAction.newQty <= 0 && (
                          <div className="mt-2 bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg flex items-start gap-2 shadow-xs">
                            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                            <div>
                              <p className="font-bold text-[13.5px]">สินค้าหมดสต็อก!</p>
                              <p className="text-xs mt-0.5 text-red-700">แจ้งเตือน: การทำรายการนี้ทำให้สินค้าหมดจากคลัง</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}`;

code = code.replace(oldDetails, newDetails);

// 2. Remove suggested items
const oldSuggestedItems = `              {/* Suggested items if returned by AI */}
              {msg.suggestedItems && msg.suggestedItems.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    สินค้าที่เกี่ยวข้อง:
                  </span>
                  {msg.suggestedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className="bg-slate-50 hover:bg-blue-50 border border-slate-200/80 rounded-xl p-2 flex items-center justify-between cursor-pointer transition-colors gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="min-w-0 pr-1">
                          <p className="font-bold text-slate-800 text-lg truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.id} • คงเหลือ <span className="font-bold text-slate-700">{item.qty} {item.unit}</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-600 shrink-0 bg-white border border-blue-100 px-1.5 py-0.5 rounded">ดู &gt;</span>
                    </div>
                  ))}
                </div>
              )}`;

code = code.replace(oldSuggestedItems, "");

fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
