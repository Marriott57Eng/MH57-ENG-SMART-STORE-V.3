const fs = require('fs');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // We use placeholders to avoid sequential cascading
  content = content.replace(/\btext-\[9px\]\b/g, '__SIZE_9__');
  content = content.replace(/\btext-\[10px\]\b/g, '__SIZE_10__');
  content = content.replace(/\btext-\[11px\]\b/g, '__SIZE_11__');
  content = content.replace(/\btext-\[12px\]\b/g, '__SIZE_12__');
  content = content.replace(/\btext-xs\b/g, '__SIZE_XS__');
  content = content.replace(/\btext-sm\b/g, '__SIZE_SM__');
  content = content.replace(/\btext-base\b/g, '__SIZE_BASE__');

  // Now replace placeholders with 1-2 steps up
  content = content.replace(/__SIZE_9__/g, 'text-xs');
  content = content.replace(/__SIZE_10__/g, 'text-sm');
  content = content.replace(/__SIZE_11__/g, 'text-sm');
  content = content.replace(/__SIZE_12__/g, 'text-base');
  content = content.replace(/__SIZE_XS__/g, 'text-base');
  content = content.replace(/__SIZE_SM__/g, 'text-lg');
  content = content.replace(/__SIZE_BASE__/g, 'text-xl');
  
  // Also do icons
  content = content.replace(/\bw-3 h-3\b/g, '__ICON_3__');
  content = content.replace(/\bw-3\.5 h-3\.5\b/g, '__ICON_3_5__');
  content = content.replace(/\bw-4 h-4\b/g, '__ICON_4__');
  content = content.replace(/\bw-5 h-5\b/g, '__ICON_5__');

  content = content.replace(/__ICON_3__/g, 'w-4 h-4');
  content = content.replace(/__ICON_3_5__/g, 'w-5 h-5');
  content = content.replace(/__ICON_4__/g, 'w-6 h-6');
  content = content.replace(/__ICON_5__/g, 'w-7 h-7');

  fs.writeFileSync(filePath, content, 'utf-8');
}

const files = [
  'src/App.tsx',
  'src/components/ItemCard.tsx',
  'src/components/ItemDetailModal.tsx',
  'src/components/MobileNavbar.tsx',
  'src/components/RequisitionModal.tsx',
  'src/components/RequisitionView.tsx',
  'src/components/CategoryView.tsx',
  'src/components/StatsDashboard.tsx',
  'src/components/VoiceAssistantView.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    processFile(f);
  }
});
console.log("Upsized with accurate mapping.");
