const fs = require('fs');
let code = fs.readFileSync('src/components/Toast.tsx', 'utf-8');

code = code.replace(/message\?: string;\n  duration\?: number;/, "message?: string;\n  duration?: number;\n  actionText?: string;\n  onClick?: () => void;");

const renderBlock = `        {toast.message && <p className="text-slate-600 text-xs mt-1 leading-snug">{toast.message}</p>}
      </div>`;
      
const newRenderBlock = `        {toast.message && <p className="text-slate-600 text-xs mt-1 leading-snug">{toast.message}</p>}
        {toast.actionText && toast.onClick && (
          <button 
            onClick={() => { toast.onClick!(); onClose(toast.id); }} 
            className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-200"
          >
            {toast.actionText}
          </button>
        )}
      </div>`;
code = code.replace(renderBlock, newRenderBlock);

fs.writeFileSync('src/components/Toast.tsx', code);
