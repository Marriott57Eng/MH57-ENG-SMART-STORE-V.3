const fs = require('fs');
let code = fs.readFileSync('src/components/MobileNavbar.tsx', 'utf-8');

const oldNav = `<button
        onClick={() => setActiveTab('voice')}
        className={\`relative -top-6 flex flex-col items-center justify-center transition-transform active:scale-95\`}
      >
        <div
          className={\`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all \${
            activeTab === 'voice'
              ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/40 ring-[6px] ring-blue-100'
              : 'bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-blue-500/30 hover:scale-105 ring-4 ring-white'
          }\`}
        >
          <Bot className="w-8 h-8" />
        </div>
        <span
          className={\`font-black mt-1.5 drop-shadow-sm \${
            activeTab === 'voice' ? 'text-blue-600' : 'text-slate-800'
          }\`}
          style={{ fontSize: '20px', letterSpacing: '0.5px' }}
        >
          ถาม AI
        </span>
      </button>`;

const newNav = `<button
        onClick={() => setActiveTab('voice')}
        className={\`relative -top-2 flex flex-col items-center justify-center transition-transform active:scale-95\`}
      >
        <div
          className={\`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all \${
            activeTab === 'voice'
              ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/30 ring-4 ring-blue-100'
              : 'bg-slate-900 text-white shadow-slate-300 hover:bg-slate-800'
          }\`}
        >
          <Bot className="w-6 h-6" />
        </div>
        <span
          className={\`text-xs font-bold mt-0.5 \${
            activeTab === 'voice' ? 'text-blue-600' : 'text-slate-600'
          }\`}
        >
          ถาม AI
        </span>
      </button>`;

code = code.replace(oldNav, newNav);
fs.writeFileSync('src/components/MobileNavbar.tsx', code);
