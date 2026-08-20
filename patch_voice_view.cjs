const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

const oldEffect = `  useEffect(() => {
    if (pendingQuery && pendingQuery.trim() !== '') {
      sendQuery(pendingQuery);
      if (clearPendingQuery) clearPendingQuery();
    }
  }, [pendingQuery]);`;

const newEffect = `  const lastProcessedQueryRef = useRef<string | null>(null);

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
  }, [pendingQuery, clearPendingQuery]);`;

code = code.replace(oldEffect, newEffect);
fs.writeFileSync('src/components/VoiceAssistantView.tsx', code);
