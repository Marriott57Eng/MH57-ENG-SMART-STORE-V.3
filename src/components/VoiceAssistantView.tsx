import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { InventoryItem, ChatMessage, RequisitionRecord, ReportAction, DbActionPayload } from '../types';
import {  
  Mic, MicOff, Send, Sparkles, 
  RotateCcw, Bot, User, ArrowRight, Loader2, FileDown, FileText, 
  ArrowDownRight, ArrowUpRight, Sliders, Trash2, ExternalLink, AlertCircle, Headset, Radio,
  CheckCircle2, XCircle, Check, X, Clock, Package, MapPin, Layers, Volume2
} from 'lucide-react';
import { generateAndDownloadPdf } from '../utils/pdfGenerator';
import { generateAndDownloadExcel } from '../utils/excelGenerator';
import { formatRecordTimestamp } from '../utils/dateUtils';
import { useLiveAudio } from '../hooks/useLiveAudio';
import { EngLogo } from './EngLogo';

// Helper to play confirmation chime and Thai speech synthesis
const playSuccessSoundAndSpeak = (speechText: string = 'ยืนยันเรียบร้อยแล้วค่ะ') => {
  // 1. Web Audio API gentle confirmation chime
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      
      // Note 1 (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Note 2 (A5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.08);
      gain2.gain.setValueAtTime(0.18, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    }
  } catch (e) {
    console.warn('Audio chime error:', e);
  }

  // 2. Speech Synthesis in Thai
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'th-TH';
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const speak = () => {
        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang === 'th-TH' || v.lang.startsWith('th'));
        if (thaiVoice) {
          utterance.voice = thaiVoice;
        }
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          speak();
        };
        setTimeout(speak, 150);
      }
    }
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
};

interface VoiceAssistantViewProps {
  items: InventoryItem[];
  requisitions: RequisitionRecord[];
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentUser: { name: string; username?: string; role?: string };
  onSelectItem: (item: InventoryItem) => void;
  onExecuteDbAction?: (action: DbActionPayload) => void;
  onOpenHistory?: () => void;
  pendingQuery?: string;
  clearPendingQuery?: () => void;
  onLiveStateChange?: (connected: boolean) => void;
}

export const VoiceAssistantView: React.FC<VoiceAssistantViewProps> = ({
  items,
  requisitions,
  chatHistory,
  setChatHistory,
  currentUser,
  onSelectItem,
  onExecuteDbAction,
  onOpenHistory,
  pendingQuery,
  clearPendingQuery,
  onLiveStateChange,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const liveMessageIdRef = useRef<string | null>(null);

  // Download handler for PDF & Excel
  const handleDownloadReport = useCallback(async (report: any, msgId: string, isExcel: boolean = false) => {
    try {
      setGeneratingPdfId(msgId);
      if (isExcel || report.format === 'excel') {
        await generateAndDownloadExcel({
          type: report.type,
          title: report.title,
          categoryFilter: report.categoryFilter,
          items,
          requisitions,
        });
      } else {
        await generateAndDownloadPdf({
          type: report.type,
          title: report.title,
          categoryFilter: report.categoryFilter,
          items,
          requisitions,
        });
      }
    } catch (err) {
      console.error('Error generating report:', err);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์');
    } finally {
      setGeneratingPdfId(null);
    }
  }, [items, requisitions]);

  const handleLiveToolCall = useCallback((toolCall: any) => {
    if (!toolCall) return;

    // 1. Stock Action (Stock In / Stock Out / Requisition)
    if (toolCall.name === 'prepare_stock_action') {
      const { action, itemId, quantity, purpose, note } = toolCall.args || {};
      const targetItem = items.find(i => 
        i.id === itemId || 
        i.name.toLowerCase() === (itemId || '').toLowerCase() ||
        i.name.toLowerCase().includes((itemId || '').toLowerCase())
      );
      
      if (!targetItem) {
         setChatHistory(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            source: 'live',
            text: `ไม่พบสินค้าที่มีรหัสหรือชื่อ "${itemId}" ในคลัง Store FL.6 กรุณาตรวจสอบชื่อสินค้าอีกครั้ง`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
         }]);
         return;
      }

      const isStockIn = action === 'stock_in';
      const actionQty = Math.max(1, Number(quantity) || 1);
      const prevQty = targetItem.qty;
      const newQty = isStockIn ? prevQty + actionQty : Math.max(0, prevQty - actionQty);
      let newStatus = 'normal';
      if (newQty <= 0) newStatus = 'out'; else if (newQty <= targetItem.minStock) newStatus = 'low';

      const updatedItem = { ...targetItem, qty: newQty, status: newStatus as any };
      const recordData = {
          id: `${Date.now().toString().slice(-6)}`,
          type: isStockIn ? 'in' as const : 'out' as const,
          itemId: targetItem.id,
          itemName: targetItem.name,
          category: targetItem.category,
          unit: targetItem.unit,
          qty: actionQty,
          user: currentUser?.name || 'ผู้ใช้งาน',
          requestedBy: currentUser?.name || 'ผู้ใช้งาน',
          purpose: purpose || note || (isStockIn ? 'รับเข้าสต็อก' : 'เบิกไปใช้งาน'),
          isoDate: new Date().toISOString(),
          timestamp: new Date().toLocaleString('th-TH', { 
            timeZone: 'Asia/Bangkok',
            day: 'numeric', month: 'short', year: 'numeric', 
            hour: '2-digit', minute: '2-digit',
            hour12: false
          }) + ' น.',
          note: note || 'บันทึกผ่านเสียงพูด Live Speech'
      };

      const dbAction: DbActionPayload = {
          action: (isStockIn ? 'stock_in' : 'requisition') as 'stock_in' | 'requisition',
          status: 'success' as const,
          message: `บันทึกรายการสำเร็จ`,
          item: updatedItem,
          previousQty: prevQty,
          newQty: newQty,
          record: recordData
      };

      // Set pending confirmation (requires user to tap confirm button before executing DB update)
      setChatHistory(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          source: 'live',
          text: `กรุณาตรวจสอบข้อมูลและกดยืนยันการทำรายการ: ${isStockIn ? 'รับเข้า' : 'เบิก'} ${targetItem.name} จำนวน ${actionQty} ${targetItem.unit}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isPendingConfirmation: true,
          dbAction: dbAction
      }]);
    }

    // 2. Export Report (PDF / Excel)
    else if (toolCall.name === 'export_report') {
      const { format, reportType, title, categoryFilter } = toolCall.args || {};
      const isExcel = (format || '').toLowerCase() === 'excel';
      const defaultTitle = isExcel 
        ? (reportType === 'low_stock' ? 'รายงานสินค้าใกล้หมดและหมดสต็อก (Excel)' : reportType === 'requisition_history' ? 'รายงานประวัติการเบิกและรับเข้า (Excel)' : 'รายงานสต็อกสินค้าคงคลังทั้งหมด (Excel)')
        : (reportType === 'low_stock' ? 'รายงานสินค้าใกล้หมดและหมดสต็อก (PDF)' : reportType === 'requisition_history' ? 'รายงานประวัติการเบิกและรับเข้า (PDF)' : 'รายงานสต็อกสินค้าคงคลังทั้งหมด (PDF)');
      
      const reportAction: ReportAction = {
        format: isExcel ? 'excel' : 'pdf',
        type: reportType || 'inventory_all',
        title: title || defaultTitle,
        categoryFilter: categoryFilter
      };

      const msgId = Date.now().toString();

      // Trigger instant download
      handleDownloadReport(reportAction, msgId, isExcel);

      // Display in Chat
      setChatHistory(prev => [...prev, {
        id: msgId,
        role: 'assistant',
        source: 'live',
        text: `📄 AI ได้สร้างและดาวน์โหลดรายงาน "${reportAction.title}" (${isExcel ? 'EXCEL' : 'PDF'}) ให้เรียบร้อยแล้ว ท่านสามารถกดดาวน์โหลดซ้ำได้จากการ์ดด้านล่างนี้`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fileReports: [reportAction]
      }]);
    }

    // 3. Inquire Item Info & Check Stock
    else if (toolCall.name === 'inquire_item_info' || toolCall.name === 'check_stock') {
      const { searchTerm } = toolCall.args || {};
      const term = (searchTerm || '').trim().toLowerCase();
      const tokens = term.split(/\s+/).filter((t: string) => t.length > 0);
      let matched = items.filter(i => {
        const n = (i.name || '').toLowerCase();
        const id = (i.id || '').toLowerCase();
        const c = (i.category || '').toLowerCase();
        return tokens.length === 0 || tokens.every((t: string) => n.includes(t) || id.includes(t) || c.includes(t));
      }).slice(0, 6);

      let textOutput = `📦 พบรายการอะไหล่ตรงกับ "${searchTerm || 'คำค้นหา'}" (${matched.length} รายการ):`;
      if (matched.length === 1) {
        const target = matched[0];
        const qty = Number(target.qty) || 0;
        const minStock = Number(target.minStock) || 1;
        const isOut = qty <= 0 || target.status === 'out';
        const isLow = !isOut && (qty <= minStock || target.status === 'low');
        
        if (isOut) {
          textOutput = `⛔ ข้อมูล **${target.name}** (\`${target.id}\`): สินค้า**หมดสต็อก** (คงเหลือ 0 ${target.unit})`;
        } else if (isLow) {
          textOutput = `⚠️ ข้อมูล **${target.name}** (\`${target.id}\`): สินค้า**ใกล้หมดสต็อก** (เหลือ ${qty} ${target.unit} / เกณฑ์สั่งซื้อ ${minStock} ${target.unit})`;
        } else {
          textOutput = `✅ ข้อมูล **${target.name}** (\`${target.id}\`): มีสต็อก**พร้อมใช้งาน** (คงเหลือ ${qty} ${target.unit})`;
        }
      } else if (matched.length === 0) {
        textOutput = `🔍 ไม่พบรายการอะไหล่ตรงกับ "${searchTerm || 'คำค้นหา'}" ในคลัง Store FL.6`;
      }

      setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        source: 'live',
        text: textOutput,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedItems: matched.length > 0 ? matched : undefined
      }]);
    }

    // 4. Out of stock items
    else if (toolCall.name === 'get_out_of_stock_items') {
      const outItems = items.filter(i => (Number(i.qty) || 0) <= 0 || i.status === 'out');
      setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        source: 'live',
        text: outItems.length > 0 
          ? `⛔ พบรายการสินค้าหมดสต็อกทั้งหมด ${outItems.length} รายการ ดังนี้:`
          : `✅ ยอดเยี่ยมมาก ขณะนี้ไม่มีรายการสินค้าหมดสต็อกในคลัง ทุกรายการพร้อมใช้งาน`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedItems: outItems.length > 0 ? outItems : undefined
      }]);
    }

    // 5. Low stock items
    else if (toolCall.name === 'get_low_stock_items') {
      const lowItems = items.filter(i => ((Number(i.qty) || 0) > 0 && (Number(i.qty) || 0) <= (Number(i.minStock) || 1)) || (i.status === 'low' && (Number(i.qty) || 0) > 0));
      setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        source: 'live',
        text: lowItems.length > 0 
          ? `⚠️ พบรายการสินค้าใกล้หมดสต็อก ${lowItems.length} รายการ ดังนี้:`
          : `✅ ขณะนี้ไม่มีสินค้าใกล้หมดสต็อก ปริมาณสินค้าส่วนใหญ่เกินเกณฑ์ความปลอดภัย`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedItems: lowItems.length > 0 ? lowItems : undefined
      }]);
    }

    // 6. Extremes (min/max stock)
    else if (toolCall.name === 'get_stock_extremes') {
      const sorted = [...items].sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0));
      const extremeItems: InventoryItem[] = [];
      if (sorted.length > 0) {
        extremeItems.push(sorted[0]);
        if (sorted.length > 1 && sorted[sorted.length - 1].id !== sorted[0].id) {
          extremeItems.push(sorted[sorted.length - 1]);
        }
      }
      setChatHistory(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        source: 'live',
        text: `📊 ข้อมูลสินค้าที่มีจำนวนน้อยที่สุดและมากที่สุดในคลัง:`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedItems: extremeItems.length > 0 ? extremeItems : undefined
      }]);
    }
  }, [items, currentUser, setChatHistory, handleDownloadReport]);

  // Handle live spoken transcripts from Gemini
  const handleTranscript = useCallback((textChunk: string, isDone?: boolean) => {
    if (isDone) {
      liveMessageIdRef.current = null;
      return;
    }
    if (!textChunk) return;

    if (!liveMessageIdRef.current) {
      const newId = `live-${Date.now()}`;
      liveMessageIdRef.current = newId;
      setChatHistory(prev => [...prev, {
        id: newId,
        role: 'assistant',
        source: 'live',
        text: textChunk,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } else {
      const currentId = liveMessageIdRef.current;
      setChatHistory(prev => prev.map(msg => 
        msg.id === currentId ? { ...msg, text: msg.text + textChunk } : msg
      ));
    }
  }, [setChatHistory]);

  const { 
    isLiveConnected, 
    isConnecting, 
    audioVolume,
    isAiSpeaking,
    isUserSpeaking,
    startLive, 
    stopLive, 
    sendMessage, 
    syncInventory 
  } = useLiveAudio(
    handleLiveToolCall,
    handleTranscript,
    onLiveStateChange
  );

  // Sync real-time inventory to active Live Speech server session on changes
  useEffect(() => {
    if (isLiveConnected && items && items.length > 0) {
      syncInventory(items);
    }
  }, [items, isLiveConnected, syncInventory]);

  const isAdmin = currentUser?.role === 'admin';

  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Suggested quick prompts including DB operations & PDF generation
  const suggestedPrompts = isAdmin ? [
    '📦 เบิกแอลกอฮอล์ 2 แกลลอน เอาไปซ่อมแอร์ชั้น 4',
    '📥 รับเข้าน้ำยาประสานท่อ 3 กระป๋อง จากโฮมโปร',
    '🔄 ปรับสต็อก เทปพันสายไฟ ให้เหลือ 15 ม้วน',
    '📄 สร้าง PDF ประวัติการเบิก/รับเข้า',
  ] : [
    '📦 เบิกแอลกอฮอล์ 2 แกลลอน เอาไปซ่อมแอร์ชั้น 4',
    '📥 รับเข้าน้ำยาประสานท่อ 3 กระป๋อง จากโฮมโปร',
    '🔍 สอบถามจำนวนคงเหลือของ ท่อ PVC',
    '📄 สร้าง PDF ประวัติการเบิก/รับเข้า',
  ];

  const lastProcessedQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (pendingQuery && pendingQuery.trim() !== '') {
      if (lastProcessedQueryRef.current !== pendingQuery) {
        lastProcessedQueryRef.current = pendingQuery;
        sendQuery(pendingQuery);
        if (clearPendingQuery) clearPendingQuery();
      }
    } else {
      lastProcessedQueryRef.current = null;
    }
  }, [pendingQuery, clearPendingQuery]);

  // Initialize Speech Recognition (Microphone input)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'th-TH';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSpeechSupported(false);
      }
    }
  }, []);

  // When transcript updates and recognition ends, auto-send query
  const handleStopAndSend = (textToSend?: string) => {
    const text = textToSend || transcript || inputText;
    if (!text.trim()) return;

    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    sendQuery(text.trim());
    setTranscript('');
    setInputText('');
  };

  // Toggle Voice Input
  const toggleListening = () => {
    if (!speechSupported) {
      alert('เบราว์เซอร์นี้ไม่รองรับไมโครโฟน กรุณาพิมพ์ข้อความแทน หรือเปิดผ่าน Google Chrome/Safari');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      if (transcript.trim()) {
        sendQuery(transcript.trim());
        setTranscript('');
      }
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start recognition:', err);
      }
    }
  };

  // Send query to AI
  const sendQuery = async (queryText: string) => {
    if (!queryText.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    const aiMessageId = (Date.now() + 1).toString();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryText,
          history: chatHistory.slice(-4),
          items, // Pass live inventory state
          requisitions, // Pass live requisition history
          currentUser, // Pass current user to AI
          isVoice: false,
        }),
      });

      if (!res.ok) throw new Error('Network response was not ok');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');
      
      const decoder = new TextDecoder();
      let done = false;
      let textBuffer = '';
      let jsonBuffer = '';
      
      const aiMessage: ChatMessage = {
          id: aiMessageId,
          role: 'assistant',
          text: '',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      setChatHistory(prev => [...prev, aiMessage]);

      while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
              const chunk = decoder.decode(value, { stream: true });
              jsonBuffer += chunk;
              
              const parts = jsonBuffer.split('\n\n');
              // keep the last part if it doesn't end with \n\n
              jsonBuffer = parts.pop() || '';
              
              for (const part of parts) {
                  if (part.startsWith('data: ')) {
                      let serverError = null;
                      try {
                          const data = JSON.parse(part.slice(6));
                          if (data.type === 'chunk') {
                              textBuffer += data.text;
                              let displayableText = textBuffer;
                              let blockStart = displayableText.indexOf('```json:action');
                              if (blockStart === -1) blockStart = displayableText.indexOf('```json');
                              if (blockStart === -1) blockStart = displayableText.indexOf('```');
                              
                              if (blockStart !== -1 && textBuffer.includes('"action":')) {
                                displayableText = displayableText.substring(0, blockStart);
                              }
                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? { ...msg, text: displayableText } : msg));
                          } else if (data.type === 'done') {
                              let isPending = false;
                              if (data.dbAction && (data.dbAction.action === 'requisition' || data.dbAction.action === 'stock_in' || data.dbAction.action === 'update_stock')) {
                                  isPending = true;
                              } else if (data.dbAction && data.dbAction.action !== 'error' && onExecuteDbAction) {
                                  onExecuteDbAction(data.dbAction);
                              }

                              setChatHistory(prev => prev.map(msg => msg.id === aiMessageId ? {
                                  ...msg,
                                  suggestedItems: data.suggestedItems,
                                  fileReport: data.fileReport || data.pdfReport,
                                  fileReports: data.fileReports,
                                  dbAction: data.dbAction,
                                  isPendingConfirmation: isPending
                              } : msg));
                          } else if (data.type === 'error') {
                              serverError = new Error(data.message);
                          }
                      } catch (e) {
                          // JSON parsing error on incomplete chunk
                      }
                      if (serverError) throw serverError;
                  }
              }
          }
      }
    } catch (err: any) {
      let errorText = 'ขออภัยครับ เกิดข้อผิดพลาดในการดึงข้อมูลจาก AI กรุณาลองใหม่อีกครั้ง';
      if (err.message === 'QUOTA_EXCEEDED') {
         errorText = 'ขณะนี้มีผู้ใช้งาน AI จำนวนมากจนเกินโควต้าที่กำหนดไว้ กรุณารอสักครู่ (ประมาณ 1 นาที) แล้วลองส่งคำสั่งใหม่อีกครั้งครับ';
      }
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory(prev => {
        const filtered = prev.filter(msg => msg.id !== aiMessageId);
        return [...filtered, errorMessage];
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Scroll to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isListening, transcript]);

  // Handle user confirming a DB action (Stock in / Stock out / update)
  const handleConfirmDbAction = useCallback((messageId: string, action: DbActionPayload) => {
    if (!action) return;

    // 1. Execute DB Action to Firestore / state
    if (onExecuteDbAction) {
      onExecuteDbAction(action);
    }

    // 2. Mark as confirmed in chat history
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          isPendingConfirmation: false,
          isCancelled: false
        };
      }
      return msg;
    }));

    // 3. Audio / Speech Feedback
    if (isLiveConnected) {
      // If active in Live Speech session, let Live Speech AI speak instead of browser TTS
      const actionName = action.action === 'stock_in' ? 'รับเข้าสินค้า' : 'เบิกสินค้า';
      const itemName = action.item?.name || action.record?.itemName || 'สินค้า';
      const itemQty = action.record?.qty || 1;
      const itemUnit = action.item?.unit || action.record?.unit || 'หน่วย';
      sendMessage(`ผู้ใช้กดยืนยันการทำรายการ${actionName} ${itemName} จำนวน ${itemQty} ${itemUnit} เรียบร้อยแล้ว กรุณาแจ้งยืนยันด้วยเสียงสั้นๆ`);
    } else {
      // For typed / text chat requisition, speak using browser Thai SpeechSynthesis
      const textToSpeak = action.action === 'stock_in' 
        ? 'ยืนยันรับเข้าสินค้าเรียบร้อยแล้วค่ะ'
        : action.action === 'requisition'
        ? 'ยืนยันการเบิกสินค้าเรียบร้อยแล้วค่ะ'
        : 'ยืนยันเรียบร้อยแล้วค่ะ';
      playSuccessSoundAndSpeak(textToSpeak);
    }
  }, [onExecuteDbAction, setChatHistory, isLiveConnected, sendMessage]);

  // Handle user cancelling a DB action
  const handleCancelDbAction = useCallback((messageId: string) => {
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === messageId) {
        return {
          ...msg,
          isPendingConfirmation: false,
          isCancelled: true
        };
      }
      return msg;
    }));

    if (isLiveConnected) {
      // If active in Live Speech, inform Live Speech AI to respond
      sendMessage('ผู้ใช้กดยกเลิกรายการแล้ว กรุณาแจ้งรับทราบการยกเลิกด้วยเสียงสั้นๆ');
    } else {
      // For typed chat, play TTS sound
      playSuccessSoundAndSpeak('ยกเลิกรายการแล้วค่ะ');
    }
  }, [setChatHistory, isLiveConnected, sendMessage]);

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      {/* Top Bar */}
      <div className="bg-white dark:bg-slate-900 px-3.5 pt-safe-header pb-1.5 border-b border-slate-300 dark:border-slate-750 flex items-center justify-between shrink-0 shadow-2xs transition-colors duration-200 z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles className="w-3 h-3" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">AI ผู้ช่วยคลังสินค้า</h2>
              <span className="text-[9px] sm:text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded border border-blue-300 dark:border-blue-700">
                Gemini 3.5 Flash Lite
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 leading-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              {isAdmin 
                ? 'โหมด Admin: สั่งเบิก/รับเข้า/แก้ไขสต็อก/แก้ไขชื่ออะไหล่' 
                : 'โหมด Staff: สั่งเบิก/รับเข้าสินค้า/ดูสต็อก/ออกรายงาน'}
            </span>
          </div>
        </div>

        {/* Reset Chat */}
        {chatHistory.length > 0 && (
          <button
            onClick={() => setChatHistory([])}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
            title="ล้างข้อความ"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="text-[11px]">ล้างแชท</span>
          </button>
        )}
      </div>

      {/* Messages List Area (Scrolls internally while bottom controls remain locked) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 space-y-2.5">
        {chatHistory.length === 0 && (
          <div className="text-center py-2 sm:py-3 px-2">
            <div className="w-full max-w-[240px] h-20 mx-auto mb-2 flex items-center justify-center overflow-hidden rounded-xl">
              <EngLogo alt="ENG Smart Store" className="object-contain max-h-20" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg mb-0.5">ENG AI ผู้ช่วยคลังสินค้า</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3 max-w-xs mx-auto leading-relaxed">
              แตะไมค์พูดสั่ง หรือพิมพ์คำสั่งด้านล่างได้ทันที
            </p>

            {/* Quick Prompts */}
            <div className="space-y-1.5 max-w-sm mx-auto text-left">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1">
                ตัวอย่างคำสั่งที่ AI ดำเนินการได้:
              </span>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => sendQuery(prompt.replace(/^[^\s]+\s/, ''))}
                  className="w-full text-left bg-white dark:bg-slate-900 hover:bg-blue-50/60 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700/60 rounded-xl p-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium transition-all shadow-xs flex items-center justify-between group active:scale-[0.99] cursor-pointer"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[96%] sm:max-w-[86%] rounded-2xl p-3 shadow-xs text-base sm:text-lg leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
              }`}
            >
              {/* Message Header */}
              <div className="flex items-center gap-1.5 mb-1 opacity-75 text-xs">
                {msg.role === 'user' ? (
                  <>
                    <User className="w-3.5 h-3.5" />
                    <span>คุณ</span>
                  </>
                ) : (
                  <>
                    {msg.source === 'live' ? (
                      <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                        AI Live Speech
                      </span>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-blue-600 dark:text-blue-400">AI Assistant</span>
                      </>
                    )}
                  </>
                )}
                <span>• {msg.timestamp}</span>
              </div>

              {/* Text content */}
              <div className="font-sans text-base sm:text-lg leading-relaxed">
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg leading-relaxed space-y-2 prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:font-extrabold prose-strong:text-slate-900 dark:prose-strong:text-white prose-code:text-white prose-code:bg-slate-950 dark:prose-code:bg-black prose-code:border prose-code:border-slate-800 prose-code:px-2 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Database Action Confirmation Card */}
              {msg.dbAction && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                  <div className={`p-3 sm:p-3.5 rounded-xl border shadow-xs transition-all ${
                    msg.isCancelled
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 opacity-80'
                      : msg.isPendingConfirmation
                      ? 'border-amber-300 dark:border-amber-600 bg-gradient-to-b from-amber-50/60 to-white dark:from-amber-950/20 dark:to-slate-900 ring-2 ring-amber-400/20'
                      : msg.dbAction.action === 'stock_in'
                      ? 'border-emerald-200 dark:border-emerald-800/70 bg-white dark:bg-slate-900'
                      : msg.dbAction.action === 'requisition'
                      ? 'border-blue-200 dark:border-blue-800/70 bg-white dark:bg-slate-900'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs ${
                          msg.isCancelled
                            ? 'bg-slate-400 dark:bg-slate-600'
                            : msg.isPendingConfirmation
                            ? 'bg-amber-500 animate-pulse'
                            : msg.dbAction.action === 'stock_in'
                            ? 'bg-emerald-500'
                            : 'bg-blue-600'
                        }`}>
                          {msg.isCancelled ? (
                            <XCircle className="w-5 h-5" />
                          ) : msg.isPendingConfirmation ? (
                            <Clock className="w-5 h-5" />
                          ) : msg.dbAction.action === 'stock_in' ? (
                            <ArrowDownRight className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-[17px] text-slate-900 dark:text-slate-100 leading-tight">
                            {msg.isCancelled ? (
                              <>
                                <span className="text-red-500">❌</span>
                                <span>ยกเลิกรายการแล้ว</span>
                              </>
                            ) : msg.isPendingConfirmation ? (
                              <>
                                <span className="text-amber-500">⏳</span>
                                <span>รอการยืนยัน: {msg.dbAction.action === 'stock_in' ? 'รับเข้าสินค้า (Stock In)' : 'เบิกสินค้า (Stock Out)'}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-emerald-500">✅</span>
                                <span>{msg.dbAction.action === 'stock_in' ? 'บันทึกรับเข้าสินค้า (Stock In) สำเร็จ' : 'บันทึกการเบิกสินค้า (Stock Out) สำเร็จ'}</span>
                              </>
                            )}
                          </div>
                          <span className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 block">
                            {msg.isCancelled
                              ? 'ไม่มีการเปลี่ยนแปลงสต็อกสินค้า'
                              : msg.isPendingConfirmation
                              ? 'กรุณาตรวจสอบข้อมูลและกดปุ่มยืนยันด้านล่าง'
                              : 'อัปเดตฐานข้อมูลคลังสินค้าเรียบร้อยแล้ว'}
                          </span>
                        </div>
                      </div>

                      {msg.dbAction.record && (
                        <div className="font-mono text-sm font-semibold bg-slate-950 dark:bg-black px-2.5 py-1 rounded-lg border border-slate-700 dark:border-slate-800 text-white shadow-xs">
                          {msg.dbAction.record.id}
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    {msg.dbAction.item && (
                      <div className="space-y-3 mt-1 bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        {/* Item Name & ID */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-[17px] text-slate-800 dark:text-slate-100">
                              {msg.dbAction.item.name}
                            </div>
                            <div className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
                              {msg.dbAction.item.category}
                            </div>
                          </div>
                          <div className="font-mono text-xs font-bold text-white bg-slate-950 dark:bg-black px-2 py-0.5 rounded border border-slate-700 dark:border-slate-800 text-right shadow-2xs">
                            {msg.dbAction.item.id}
                          </div>
                        </div>

                        {/* Stock Quantity */}
                        <div className="flex justify-between items-center py-2 border-y border-slate-200/60 dark:border-slate-700/60 border-dashed">
                          <span className="text-slate-500 dark:text-slate-400 text-sm">
                            {msg.isPendingConfirmation ? 'จำนวนที่จะเปลี่ยนแปลง:' : 'จำนวนสต็อกคงเหลือ:'}
                          </span>
                          <div className="flex items-center gap-2 text-[15px]">
                            <span className="text-slate-400 font-semibold line-through decoration-slate-300">
                              {msg.dbAction.previousQty}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className={`font-bold ${msg.dbAction.action === 'stock_in' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                              {msg.dbAction.newQty}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              {msg.dbAction.item.unit}
                            </span>
                          </div>
                        </div>

                        {/* Record Details */}
                        {msg.dbAction.record && (
                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 dark:text-slate-400 text-sm">ผู้ทำรายการ:</span>
                              <span className="text-slate-800 dark:text-slate-200 text-sm font-medium">
                                {msg.dbAction.record.requestedBy}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 dark:text-slate-400 text-sm">งาน/สถานที่นำไปใช้:</span>
                              <span className="text-slate-700 dark:text-slate-300 text-sm bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                {msg.dbAction.record.purpose || (msg.dbAction.action === 'stock_in' ? 'รับเข้าสต็อก' : 'เบิกไปใช้งาน')}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 dark:text-slate-400 text-sm">เวลา:</span>
                              <span className="text-slate-700 dark:text-slate-300 text-sm">
                                {msg.dbAction.record.timestamp || formatRecordTimestamp(new Date().toISOString(), new Date().toISOString())}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons: Pending Confirmation vs Confirmed vs Cancelled */}
                        {msg.isPendingConfirmation ? (
                          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-2">
                            <button
                              onClick={() => handleConfirmDbAction(msg.id, msg.dbAction!)}
                              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white py-3 px-4 rounded-xl text-base font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              <span>กดยืนยันรายการ</span>
                            </button>
                            <button
                              onClick={() => handleCancelDbAction(msg.id)}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                              <span>ยกเลิก</span>
                            </button>
                          </div>
                        ) : !msg.isCancelled ? (
                          <div className="flex gap-2 mt-4 pt-2">
                            <button
                              onClick={() => onOpenHistory && onOpenHistory()}
                              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <ExternalLink className="w-4 h-4" />
                              ดูในหน้าประวัติ
                            </button>
                            <button
                              onClick={() => onSelectItem(msg.dbAction!.item!)}
                              className="flex-1 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer shadow-sm"
                            >
                              ดูข้อมูลสินค้านี้
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Item Cards List (Shown when inquiring stock or checking parts) */}
              {msg.suggestedItems && msg.suggestedItems.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-0.5">
                    <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                      <Package className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      การ์ดข้อมูลอะไหล่/สินค้า ({msg.suggestedItems.length} รายการ):
                    </span>
                    <span className="text-[10px] sm:text-xs text-slate-400">แตะเพื่อดูรายละเอียดหรือเบิก</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {msg.suggestedItems.map((rawItem) => {
                      const item = items.find(i => i.id === rawItem.id) || rawItem;
                      const qty = Number(item.qty) || 0;
                      const minStock = Number(item.minStock) || 1;
                      const isOut = qty <= 0 || item.status === 'out';
                      const isLow = !isOut && (qty <= minStock || item.status === 'low');

                      return (
                        <div 
                          key={item.id}
                          className={`rounded-xl border p-2.5 sm:p-3 shadow-xs transition-all flex flex-col justify-between ${
                            isOut
                              ? 'bg-gradient-to-b from-red-50/80 to-white dark:from-red-950/30 dark:to-slate-900 border-red-200 dark:border-red-900/60'
                              : isLow
                              ? 'bg-gradient-to-b from-amber-50/80 to-white dark:from-amber-950/30 dark:to-slate-900 border-amber-200 dark:border-amber-900/60'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                        >
                          {/* Item Details (Without Image) */}
                          <div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-snug">
                                  {item.name}
                                </h4>
                                <span className="font-mono text-[11px] font-bold text-white bg-slate-950 dark:bg-black border border-slate-700 dark:border-slate-800 px-2 py-0.5 rounded shadow-2xs shrink-0">
                                  {item.id}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-medium">
                                  {item.category}
                                </span>
                                {item.location && (
                                  <div className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{item.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Stock Status Badge */}
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">สถานะคงเหลือ:</span>
                              <div>
                                {isOut ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                    หมดสต็อก (0 {item.unit})
                                  </span>
                                ) : isLow ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    ใกล้หมด (เหลือ {qty}/{minStock} {item.unit})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    มีสต็อก {qty} {item.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => onSelectItem(item)}
                              className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-1 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              ดูอะไหล่
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isLiveConnected) {
                                  sendMessage(`ต้องการเบิก ${item.name} รหัส ${item.id} จำนวน 1 ${item.unit}`);
                                } else {
                                  sendQuery(`ขอเบิก ${item.name} จำนวน 1 ${item.unit}`);
                                }
                              }}
                              disabled={isOut}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                            >
                              <ArrowUpRight className="w-3 h-3" />
                              เบิกทันที
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Interactive PDF / Excel Generation Download Card */}
              {(msg.fileReports || (msg.fileReport ? [msg.fileReport] : [])).map((report, idx) => (
                <div key={idx} className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className={`border rounded-xl p-3 shadow-xs ${report.format === 'excel' ? 'bg-gradient-to-r from-green-50/80 to-emerald-50/60 dark:from-green-950/40 dark:to-emerald-950/30 border-green-200/90 dark:border-green-800/80' : 'bg-gradient-to-r from-red-50/80 to-orange-50/60 dark:from-red-950/40 dark:to-orange-950/30 border-red-200/90 dark:border-red-800/80'}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg text-white flex items-center justify-center shadow-xs shrink-0 ${report.format === 'excel' ? 'bg-green-600' : 'bg-red-600'}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">{report.title}</span>
                            <span className={`text-sm font-extrabold px-1.5 py-0.2 rounded ${report.format === 'excel' ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'}`}>
                              {report.format === 'excel' ? 'EXCEL' : 'PDF'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">เอกสารรายงานพร้อมดาวน์โหลด</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownloadReport(report, msg.id + idx, report.format === 'excel')}
                      disabled={generatingPdfId === (msg.id + idx)}
                      className={`w-full active:scale-[0.98] disabled:opacity-75 text-white py-2 px-3 rounded-lg text-lg font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${report.format === 'excel' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {generatingPdfId === (msg.id + idx) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>กำลังสร้างไฟล์...</span>
                        </>
                      ) : (
                        <>
                          <FileDown className="w-4 h-4" />
                          <span>ดาวน์โหลดไฟล์ {report.format === 'excel' ? 'Excel' : 'PDF'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Live Interim Transcript Bubble while Listening */}
        {isListening && transcript && (
          <div className="flex flex-col items-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-none p-3 bg-blue-500/80 text-white text-lg shadow-xs animate-pulse">
              <span className="text-xs block opacity-80 mb-0.5">กำลังฟังเสียง...</span>
              {transcript}
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-3 shadow-xs w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-lg">AI กำลังวิเคราะห์คำสั่งและปรับปรุงฐานข้อมูล...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Voice Control & Input Area (Permanently locked above bottom navigation bar) */}
      <div 
        style={{
          paddingBottom: 'max(108px, calc(env(safe-area-inset-bottom, 24px) + 90px))'
        }}
        className="px-3 pt-2 pb-1 bg-white dark:bg-slate-900 border-t border-slate-300 dark:border-slate-750 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.4)] transition-colors duration-200 z-20"
      >
        {/* Live Chat Button & Voice Reactive Controls */}
        <div className="flex flex-col items-center justify-center mb-2">
          <div className="relative flex items-center justify-center">
            {/* Dynamic Soundwave Ripple Rings */}
            {isLiveConnected && (
              <>
                {/* Outer dynamic ring */}
                <div 
                  className={`absolute rounded-full transition-all duration-75 pointer-events-none ${
                    isAiSpeaking 
                      ? 'bg-purple-400/30 border border-purple-400/40' 
                      : 'bg-emerald-400/25 border border-emerald-400/40'
                  }`}
                  style={{
                    width: '68px',
                    height: '68px',
                    transform: `scale(${1.15 + (audioVolume * 0.85)})`,
                    opacity: 0.2 + (audioVolume * 0.7)
                  }}
                />

                {/* Mid dynamic ring */}
                <div 
                  className={`absolute rounded-full transition-all duration-75 pointer-events-none ${
                    isAiSpeaking 
                      ? 'bg-purple-500/35' 
                      : 'bg-emerald-500/30'
                  }`}
                  style={{
                    width: '60px',
                    height: '60px',
                    transform: `scale(${1.08 + (audioVolume * 0.5)})`,
                    opacity: 0.4 + (audioVolume * 0.6)
                  }}
                />
              </>
            )}

            <button
              type="button"
              onClick={() => isLiveConnected ? stopLive() : startLive(currentUser?.name, currentUser?.role, items)}
              disabled={isProcessing || isConnecting}
              style={{
                transform: isLiveConnected 
                  ? `scale(${1 + Math.min(0.24, audioVolume * 0.36)})` 
                  : undefined
              }}
              className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-xl transition-transform duration-75 active:scale-95 cursor-pointer ${
                isLiveConnected
                  ? isAiSpeaking
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white ring-4 ring-purple-200 dark:ring-purple-950 shadow-purple-500/50'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white ring-4 ring-emerald-200 dark:ring-emerald-950 shadow-emerald-500/50'
                  : isConnecting
                  ? 'bg-indigo-600 text-white animate-pulse'
                  : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-500/40 hover:scale-105'
              }`}
            >
              {isConnecting ? (
                <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin" />
              ) : isLiveConnected ? (
                isAiSpeaking ? (
                  <Volume2 className="w-6 h-6 sm:w-8 sm:h-8 animate-bounce" />
                ) : (
                  <Mic className="w-6 h-6 sm:w-8 sm:h-8" />
                )
              ) : (
                <Headset className="w-6 h-6 sm:w-8 sm:h-8" />
              )}
            </button>
          </div>

          {/* Voice-reactive Equalizer Bars (shown when connected) */}
          {isLiveConnected && (
            <div className="flex items-center gap-1 h-3.5 mt-1.5">
              {[0.5, 0.9, 1.2, 0.8, 0.6].map((multiplier, i) => (
                <div 
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isAiSpeaking 
                      ? 'bg-purple-500' 
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    height: `${Math.max(3, Math.min(16, (audioVolume * 18 * multiplier) + 3))}px`
                  }}
                />
              ))}
            </div>
          )}

          {/* Voice Status Description */}
          <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 text-center">
            {isConnecting ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 justify-center">
                <Loader2 className="w-3 h-3 animate-spin" />
                กำลังเชื่อมต่อ Live Speech...
              </span>
            ) : isLiveConnected ? (
              isAiSpeaking ? (
                <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1 justify-center">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                  🔊 AI กำลังตอบด้วยเสียง...
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  🎙️ กำลังฟังเสียงของคุณ... (พูดโต้ตอบได้เลย)
                </span>
              )
            ) : (
              'แตะเพื่อเปิดโหมดคุยสดกับ AI แบบเรียลไทม์'
            )}
          </p>
        </div>

        {/* Text input bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleStopAndSend();
          }}
          className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus-within:border-blue-500 dark:focus-within:border-blue-500 rounded-xl p-1 shadow-2xs transition-colors"
        >
          {/* Normal Dictation Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isProcessing}
            className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 border border-slate-300 dark:border-slate-650 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse border-red-400'
                : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="พิมพ์ หรือสั่งพิมพ์ด้วยเสียง..."
            disabled={isProcessing}
            className="flex-1 bg-transparent px-2 py-1 text-sm sm:text-base text-slate-800 dark:text-slate-100 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 min-w-0"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 border border-blue-500"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
