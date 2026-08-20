const fs = require('fs');

// Patch App.tsx
let appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
appTsx = appTsx.replace(/Google Sheet backend/g, 'Store backend');
appTsx = appTsx.replace(/Google Sheets/g, 'Store Data');
appTsx = appTsx.replace(/Google Sheet/g, 'Store Data');
fs.writeFileSync('src/App.tsx', appTsx);

// Patch StatsDashboard.tsx
let statsTsx = fs.readFileSync('src/components/StatsDashboard.tsx', 'utf-8');
statsTsx = statsTsx.replace(/Google Sheet Database/g, 'Store Database');
statsTsx = statsTsx.replace(/Google Sheet/g, 'Store Data');
fs.writeFileSync('src/components/StatsDashboard.tsx', statsTsx);
console.log("Patched text successfully");
