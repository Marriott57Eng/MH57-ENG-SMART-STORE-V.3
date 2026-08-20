import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  actionText?: string;
  onClick?: () => void;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    error: <AlertCircle className="w-6 h-6 text-red-500" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    info: <AlertCircle className="w-6 h-6 text-blue-500" />
  };

  const bgs = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200'
  };

  return (
    <div className={`flex items-start gap-3 p-4 mb-3 border rounded-xl shadow-lg w-full max-w-sm mx-auto backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-5 ${bgs[toast.type]}`}>
      <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-[13.5px] leading-tight">{toast.title}</h4>
        {toast.message && <p className="text-slate-600 text-xs mt-1 leading-snug">{toast.message}</p>}
        {toast.actionText && toast.onClick && (
          <button 
            onClick={() => { toast.onClick!(); onClose(toast.id); }} 
            className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-200"
          >
            {toast.actionText}
          </button>
        )}
      </div>
      <button onClick={() => onClose(toast.id)} className="text-slate-400 hover:text-slate-600 active:scale-95 transition-transform">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
