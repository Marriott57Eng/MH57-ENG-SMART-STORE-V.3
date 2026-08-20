const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Icon sizes
  content = content.replace(/\bw-3 h-3\b/g, 'w-4 h-4');
  content = content.replace(/\bw-3\.5 h-3\.5\b/g, 'w-5 h-5');
  content = content.replace(/\bw-4 h-4\b/g, 'w-5 h-5');
  content = content.replace(/\bw-5 h-5\b/g, 'w-6 h-6');
  content = content.replace(/\bw-6 h-6\b/g, 'w-7 h-7');
  content = content.replace(/\bw-8 h-8\b/g, 'w-10 h-10');
  content = content.replace(/\bw-10 h-10\b/g, 'w-12 h-12');

  // Text sizes
  content = content.replace(/\btext-\[9px\]\b/g, 'text-[11px]');
  content = content.replace(/\btext-\[10px\]\b/g, 'text-xs');
  content = content.replace(/\btext-\[11px\]\b/g, 'text-sm');
  content = content.replace(/\btext-xs\b/g, 'text-sm');
  content = content.replace(/\btext-sm\b/g, 'text-base');
  content = content.replace(/\btext-base\b/g, 'text-lg');
  content = content.replace(/\btext-lg\b/g, 'text-xl');

  // Specific adjustments for inputs so they don't look weird when scaled up
  // The iOS zoom issue is best prevented with CSS in index.css, so we'll do both.
  
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

console.log("Upsized text and icons successfully.");
