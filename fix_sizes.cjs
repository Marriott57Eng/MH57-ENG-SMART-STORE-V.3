const fs = require('fs');

function fix(filePath) {
  let c = fs.readFileSync(filePath, 'utf-8');
  
  // First, revert the catastrophic w-7 h-7 and w-12 h-12
  c = c.replace(/w-7 h-7/g, 'w-4 h-4'); // most small icons
  c = c.replace(/w-12 h-12/g, 'w-6 h-6'); // most large icons

  // text-xl reverting
  // Replace text-xl with text-sm as a baseline
  c = c.replace(/text-xl/g, 'text-sm');
  
  // Re-increase specific things based on context
  // App.tsx header icons:
  
  fs.writeFileSync(filePath, c, 'utf-8');
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
  if (fs.existsSync(f)) fix(f);
});

console.log("Restored sizes approximately.");
