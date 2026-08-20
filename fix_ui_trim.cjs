const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const oldTrim = `                              let displayableText = textBuffer;
                              const blockStart = displayableText.indexOf('\`\`\`json:action');
                              if (blockStart !== -1) {
                                displayableText = displayableText.substring(0, blockStart);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: displayableText } : msg));`;

const newTrim = `                              let displayableText = textBuffer;
                              let blockStart = displayableText.indexOf('\`\`\`json:action');
                              if (blockStart === -1) blockStart = displayableText.indexOf('\`\`\`json');
                              if (blockStart === -1) blockStart = displayableText.indexOf('\`\`\`');
                              
                              if (blockStart !== -1 && textBuffer.includes('"action":')) {
                                displayableText = displayableText.substring(0, blockStart);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: displayableText } : msg));`;

code = code.replace(oldTrim, newTrim);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code, 'utf-8');
console.log("Patched UI Trim logic");
