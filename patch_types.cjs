const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

if (!code.includes('activeDeviceId')) {
  code = code.replace(/sessionToken\?: string;/g, "sessionToken?: string;\n  activeDeviceId?: string;");
  fs.writeFileSync('src/types.ts', code);
  console.log('Types patched.');
} else {
  console.log('Types already patched.');
}
