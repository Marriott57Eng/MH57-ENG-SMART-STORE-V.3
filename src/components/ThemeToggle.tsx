import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '',
  showLabel = false 
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl border transition-all active:scale-95 cursor-pointer ${
        isDark
          ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-750 hover:border-amber-400/50 hover:text-amber-300 shadow-xs'
          : 'bg-white border-slate-200/90 text-slate-600 hover:text-blue-600 hover:bg-slate-50 shadow-2xs'
      } ${className}`}
      title={isDark ? 'เปลี่ยนเป็นธีมสว่าง (Light Mode)' : 'เปลี่ยนเป็นธีมมืด (Dark Mode)'}
      aria-label="สลับธีม สว่าง/มืด"
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-5 h-5 transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Moon className="w-5 h-5 transition-transform duration-300 rotate-0 scale-100" />
        )}
      </div>
      {showLabel && (
        <span className="ml-2 text-xs font-semibold">
          {isDark ? 'โหมดมืด' : 'โหมดสว่าง'}
        </span>
      )}
    </button>
  );
};
