const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');
code = code.replace('{.* Live Chat Button */', '{/* Live Chat Button */}');
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
