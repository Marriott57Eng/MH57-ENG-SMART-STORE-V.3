const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(
  "  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);",
  "  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);\n  const [pendingQuery, setPendingQuery] = useState('');"
);

const handleAskAIAboutItemStr = `  const handleAskAIAboutItem = (item: InventoryItem) => {
    const prompt = \`ขอทราบข้อมูลและสถานะของสินค้า \${item.name} (รหัส: \${item.id}) ที่เก็บ: \${item.location} หน่อย\`;
    setActiveTab('voice');
    
    setTimeout(() => {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, userMsg]);

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, isVoice: false }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.response) {
            setChatHistory((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.response,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                suggestedItems: data.suggestedItems || [item],
                pdfReport: data.pdfReport,
              },
            ]);
          }
        });
    }, 100);
  };`;

const newHandleAskAIAboutItemStr = `  const handleAskAIAboutItem = (item: InventoryItem) => {
    const prompt = \`ขอทราบข้อมูลและสถานะของสินค้า \${item.name} (รหัส: \${item.id}) ที่เก็บ: \${item.location} หน่อย\`;
    setPendingQuery(prompt);
    setActiveTab('voice');
  };`;

const handleAskAIQueryStr = `  const handleAskAIQuery = (prompt: string) => {
    setActiveTab('voice');
    setTimeout(() => {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatHistory((prev) => [...prev, userMsg]);

      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, isVoice: false }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.response) {
            setChatHistory((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.response,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                suggestedItems: data.suggestedItems,
                pdfReport: data.pdfReport,
              },
            ]);
          }
        });
    }, 100);
  };`;

const newHandleAskAIQueryStr = `  const handleAskAIQuery = (prompt: string) => {
    setPendingQuery(prompt);
    setActiveTab('voice');
  };`;

code = code.replace(handleAskAIAboutItemStr, newHandleAskAIAboutItemStr);
code = code.replace(handleAskAIQueryStr, newHandleAskAIQueryStr);

const voiceViewStr = `<VoiceAssistantView
              items={items}
              requisitions={requisitions}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              onSelectItem={(item) => setSelectedItem(item)}
              onExecuteDbAction={handleExecuteDbAction}
              onOpenHistory={() => setActiveTab('history')}
            />`;

const newVoiceViewStr = `<VoiceAssistantView
              items={items}
              requisitions={requisitions}
              chatHistory={chatHistory}
              setChatHistory={setChatHistory}
              onSelectItem={(item) => setSelectedItem(item)}
              onExecuteDbAction={handleExecuteDbAction}
              onOpenHistory={() => setActiveTab('history')}
              pendingQuery={pendingQuery}
              clearPendingQuery={() => setPendingQuery('')}
            />`;

code = code.replace(voiceViewStr, newVoiceViewStr);

fs.writeFileSync('src/App.tsx', code, 'utf-8');
console.log("Updated App.tsx");
