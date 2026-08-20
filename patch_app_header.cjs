const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    <img 
                      src="/logo.png" 
                      alt="Logo" 
                      className="w-full h-full object-contain drop-shadow-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/100x100/2563eb/ffffff.png?text=Store';
                      }}
                    />
                  </div>
                  <div>
                    <h1 className="font-bold text-slate-900 text-lg tracking-tight leading-none">
                      Store FL.6 System
                    </h1>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-slate-500 font-medium">Store FL.6</span>
                    </div>
                  </div>
                </div>`;

const replacement = `<div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-12 sm:h-16 flex items-center justify-center shrink-0">
                    <img 
                      src="/logo.png" 
                      alt="Logo" 
                      className="h-full object-contain drop-shadow-sm"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://placehold.co/200x60/2563eb/ffffff.png?text=Store';
                      }}
                    />
                  </div>
                </div>`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', code);
  console.log("Header patched successfully.");
} else {
  console.log("Target not found!");
}
