const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  '```json:action\n{\n  "action": "search",\n  "itemIds": ["A000000001", "A000000002"]\n}\n```',
  '\\`\\`\\`json:action\n{\n  "action": "search",\n  "itemIds": ["A000000001", "A000000002"]\n}\n\\`\\`\\`'
);

fs.writeFileSync('server.ts', content);
