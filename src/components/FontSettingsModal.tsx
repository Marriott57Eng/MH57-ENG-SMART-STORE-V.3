import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Type, Check, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';

export interface FontOption {
  id: string;
  name: string;
  thaiName: string;
  previewClass: string;
  description: string;
  recommendedTag?: string;
  vibe: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans Thai',
    thaiName: 'ไอบีเอ็ม เพล็กซ์',
    previewClass: 'font-preview-ibm-plex',
    recommendedTag: 'ฟอนต์หลักประจำระบบ (แม่นยำ สไตล์วิศวกรรม)',
    description: 'ออกแบบโดยทีม IBM Typography เพื่อระบบซอฟต์แวร์และข้อมูลโดยเฉพาะ รูปร่างแม่นยำสูง ตัวเลขและรหัสอะไหล่อ่านง่ายชัดเจนมาก เหมาะกับงานช่างและวิศวกรรม',
    vibe: 'แม่นยำ • วิศวกรรม • เทคโนโลยี'
  },
  {
    id: 'prompt',
    name: 'Prompt',
    thaiName: 'พร้อมท์',
    previewClass: 'font-preview-prompt',
    recommendedTag: 'โมเดิร์นยอดนิยม',
    description: 'ฟอนต์โมเดิร์นแบบไม่มีหัว สไตล์แอปพลิเคชันยุคใหม่ สะอาดตา โครงสร้างตัวอักษรสมส่วน อ่านสบายตาทั้งบนมือถือและจอคอม',
    vibe: 'ล้ำสมัย • มืออาชีพ • สากล'
  },
  {
    id: 'kanit',
    name: 'Kanit',
    thaiName: 'คณิต',
    previewClass: 'font-preview-kanit',
    recommendedTag: 'ยอดนิยมในไทย',
    description: 'ฟอนต์ไร้หัวที่มีน้ำหนักเส้นคมชัด เส้นสายเรขาคณิตชัดเจน ตัวเลขสวยงาม ให้ความรู้สึกกระฉับกระเฉงและทันสมัย',
    vibe: 'มีพลัง • โดดเด่น • ทันสมัย'
  },
  {
    id: 'chakra-petch',
    name: 'Chakra Petch',
    thaiName: 'จักรเพชร',
    previewClass: 'font-preview-chakra-petch',
    recommendedTag: 'สไตล์ช่าง ENG',
    description: 'ฟอนต์สไตล์เหลี่ยมมุมกึ่งอุตสาหกรรม (Industrial Tech) เอกลักษณ์เฉพาะตัวสูงมาก เข้ากับธีมงานช่างและโลโก้ ENG STORE',
    vibe: 'ช่างเทคนิค • ไซไฟ • หนักแน่น'
  },
  {
    id: 'mitr',
    name: 'Mitr',
    thaiName: 'มิตร',
    previewClass: 'font-preview-mitr',
    description: 'ฟอนต์ไร้หัวแนวอบอุ่น นุ่มนวล ดูสะอาดสะอ้านและเป็นมิตร เส้นสายโค้งมนกำลังดี สบายตา',
    vibe: 'นุ่มนวล • เป็นมิตร • สบายตา'
  },
  {
    id: 'sarabun',
    name: 'Sarabun',
    thaiName: 'สารบรรณ',
    previewClass: 'font-preview-sarabun',
    description: 'ฟอนต์แบบมีหัวมาตรฐาน เป็นทางการ เรียบร้อย เหมาะสำหรับผู้ที่ชอบตัวหนังสือมีหัวแบบดั้งเดิม อ่านง่าย ชัดถ้อยชัดคำ',
    vibe: 'ทางการ • มีหัว • คุ้นเคย'
  },
  {
    id: 'system',
    name: 'System Default',
    thaiName: 'ฟอนต์ระบบเดิม',
    previewClass: 'font-preview-system',
    description: 'ฟอนต์เริ่มต้นของระบบปฏิบัติการ (San Francisco / Segoe UI / Noto Sans Thai)',
    vibe: 'ค่าเริ่มต้นเครื่อง'
  }
];

interface FontSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFont: string;
  onSelectFont: (fontId: string) => void;
}

export const FontSettingsModal: React.FC<FontSettingsModalProps> = ({
  isOpen,
  onClose,
  currentFont,
  onSelectFont
}) => {
  useScrollLock(isOpen);
  const [testText, setTestText] = useState('ENG SMART STORE ระบบคลังอะไหล่และอุปกรณ์ Store FL.6');
  const [justSelected, setJustSelected] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = (fontId: string) => {
    onSelectFont(fontId);
    setJustSelected(fontId);
    setTimeout(() => {
      setJustSelected(null);
    }, 1500);
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[150] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[24px] sm:rounded-[28px] border border-slate-200/90 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[92dvh] max-h-[92dvh] sm:h-[88vh] sm:max-h-[88vh] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 sm:px-6 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner shrink-0">
              <Type className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
                  เลือกรูปแบบตัวอักษร (App Fonts)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-xs">
                  {FONT_OPTIONS.length} แบบ
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                เลือกและทดลองเปลี่ยนฟอนต์ของแอปพลิเคชันได้ทันทีตามความชอบ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Test Input Sandbox */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
            ✍️ พิมพ์ข้อความเพื่อทดสอบการแสดงผลสดของทุกฟอนต์:
          </label>
          <input
            type="text"
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="พิมพ์ข้อความที่ต้องการทดสอบ..."
            className="w-full liquid-glass-input rounded-xl px-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/30 font-medium"
          />
        </div>

        {/* Scrollable List of Font Cards */}
        <div 
          className="p-4 sm:p-6 overflow-y-auto overscroll-y-contain flex-1 min-h-0 space-y-3.5 text-slate-800 dark:text-slate-100 touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {FONT_OPTIONS.map((font) => {
            const isCurrent = currentFont === font.id;
            const isJustPicked = justSelected === font.id;

            return (
              <div
                key={font.id}
                onClick={() => handleApply(font.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                  isCurrent
                    ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                    : 'bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-blue-400/60 hover:shadow-sm'
                }`}
              >
                {/* Top Row: Name, Tags, Active Status */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-base sm:text-lg font-bold ${font.previewClass} text-slate-900 dark:text-white`}>
                      {font.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      ({font.thaiName})
                    </span>
                    {font.recommendedTag && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs">
                        {font.recommendedTag}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrent ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>กำลังใช้งาน</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(font.id);
                        }}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-blue-500/10 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      >
                        {isJustPicked ? 'เปลี่ยนแล้ว!' : 'คลิกเพื่อเลือก'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Description & Vibe */}
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                  {font.description}
                </p>

                {/* Live Font Sample Preview Box */}
                <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 ${font.previewClass}`}>
                  <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {testText || font.name}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2 flex-wrap">
                    <span>A000000166 • หลอดไฟ LED 18W (แสงขาว)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">คงเหลือ 24 หลอด</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    0 1 2 3 4 5 6 7 8 9 | Aa Bb Cc Dd Ee Ff Gg
                  </div>
                </div>

                {/* Style Vibe Badge */}
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                  <span>โทนฟอนต์: <strong className="text-slate-600 dark:text-slate-400 font-medium">{font.vibe}</strong></span>
                  {isCurrent && (
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3 h-3" /> ใช้งานอยู่ทั้งระบบ
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
            * ฟอนต์จะถูกบันทึกไว้ในอุปกรณ์นี้ และมีผลกับทุกหน้าจอของระบบ
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs sm:text-sm hover:opacity-90 transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
