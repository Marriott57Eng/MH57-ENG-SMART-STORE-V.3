const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

// Replace gemini-3.6-flash with gemini-3.5-flash
code = code.replace(/tryGenerate\('gemini-3\.6-flash'\)/g, "tryGenerate('gemini-3.5-flash')");
code = code.replace(/Gemini 3\.6 is unavailable\. Falling back to Gemini 3\.5\./g, "Model is unavailable, retrying...");

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts for speed");
