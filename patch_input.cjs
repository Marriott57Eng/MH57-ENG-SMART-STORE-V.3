const fs = require('fs');
let content = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

// Make the input bar taller/bigger
content = content.replace('w-14 h-14', 'w-16 h-16'); // Mic button bigger
content = content.replace(/w-6 h-6/g, 'w-8 h-8'); // Icons bigger in the Voice View? No, wait, if I do global 12px, icons might look too big if I do w-8.

fs.writeFileSync('src/components/VoiceAssistantView.tsx', content);
