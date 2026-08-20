const fs = require('fs');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/text-\[9px\]/g, 'text-[11px]');
  content = content.replace(/text-\[10px\]/g, 'text-xs');
  content = content.replace(/text-\[11px\]/g, 'text-sm');
  content = content.replace(/text-\[12px\]/g, 'text-sm');
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
    fixFile(f);
  }
});
