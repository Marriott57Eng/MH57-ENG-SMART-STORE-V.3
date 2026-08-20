const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

// Make the mic button larger
code = code.replace(/w-16 h-16 rounded-full/g, 'w-20 h-20 rounded-full'); // mic button wrapper
// But wait, there are Mic/MicOff icons. Let's just find them exactly.
code = code.replace(/<MicOff className="w-8 h-8" \/>/g, '<MicOff className="w-10 h-10" />');
code = code.replace(/<Mic className="w-8 h-8" \/>/g, '<Mic className="w-10 h-10" />');

// Send button
code = code.replace(/w-8 h-8 rounded-xl bg-blue-600/g, 'w-14 h-14 rounded-xl bg-blue-600');
code = code.replace(/<Send className="w-8 h-8" \/>/g, '<Send className="w-6 h-6" />');

fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
console.log("Patched VoiceAssistantView");
