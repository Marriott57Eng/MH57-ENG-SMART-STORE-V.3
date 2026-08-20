const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const oldParseBlock = `                      try {
                          const data = JSON.parse(part.slice(6));
                          if (data.type === 'chunk') {
                              textBuffer += data.text;
                              let displayableText = textBuffer;
                              let blockStart = displayableText.indexOf('\`\`\`json:action');
                              if (blockStart === -1) blockStart = displayableText.indexOf('\`\`\`json');
                              if (blockStart === -1) blockStart = displayableText.indexOf('\`\`\`');
                              
                              if (blockStart !== -1 && textBuffer.includes('"action":')) {
                                displayableText = displayableText.substring(0, blockStart);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: displayableText } : msg));
                          } else if (data.type === 'done') {
                              if (data.dbAction && onExecuteDbAction) {
                                  onExecuteDbAction(data.dbAction);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? {
                                  ...msg,
                                  suggestedItems: data.suggestedItems,
                                  fileReport: data.fileReport || data.pdfReport,
                                  dbAction: data.dbAction
                              } : msg));
                          } else if (data.type === 'error') {
                              throw new Error(data.message);
                          }
                      } catch (e) {
                          // JSON parsing error on incomplete chunk
                      }`;

const newParseBlock = `                      let serverError = null;
                      try {
                          const data = JSON.parse(part.slice(6));
                          if (data.type === 'chunk') {
                              textBuffer += data.text;
                              let displayableText = textBuffer;
                              let blockStart = displayableText.indexOf('\`\`\`json:action');
                              if (blockStart === -1) blockStart = displayableText.indexOf('\`\`\`json');
                              if (blockStart === -1) blockStart = displayableText.indexOf('\`\`\`');
                              
                              if (blockStart !== -1 && textBuffer.includes('"action":')) {
                                displayableText = displayableText.substring(0, blockStart);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: displayableText } : msg));
                          } else if (data.type === 'done') {
                              if (data.dbAction && onExecuteDbAction) {
                                  onExecuteDbAction(data.dbAction);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? {
                                  ...msg,
                                  suggestedItems: data.suggestedItems,
                                  fileReport: data.fileReport || data.pdfReport,
                                  dbAction: data.dbAction
                              } : msg));
                          } else if (data.type === 'error') {
                              serverError = new Error(data.message);
                          }
                      } catch (e) {
                          // JSON parsing error on incomplete chunk
                      }
                      if (serverError) throw serverError;`;

code = code.replace(oldParseBlock, newParseBlock);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
