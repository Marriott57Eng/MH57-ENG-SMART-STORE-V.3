const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');
content = content.replace('w-full max-w-md', 'w-full max-w-2xl');
fs.writeFileSync('src/App.tsx', content);
