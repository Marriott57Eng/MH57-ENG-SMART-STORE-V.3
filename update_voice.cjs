const fs = require('fs');
let code = fs.readFileSync('src/components/VoiceAssistantView.tsx', 'utf-8');

code = code.replace(
  "  onOpenHistory?: () => void;",
  "  onOpenHistory?: () => void;\n  pendingQuery?: string;\n  clearPendingQuery?: () => void;"
);

code = code.replace(
  "  onOpenHistory,\n}) => {",
  "  onOpenHistory,\n  pendingQuery,\n  clearPendingQuery,\n}) => {"
);

const effectStr = `  useEffect(() => {
    if (pendingQuery && pendingQuery.trim() !== '') {
      sendQuery(pendingQuery);
      if (clearPendingQuery) clearPendingQuery();
    }
  }, [pendingQuery]);

  // Download PDF handler`;

code = code.replace("  // Download PDF handler", effectStr);

fs.writeFileSync('src/components/VoiceAssistantView.tsx', code, 'utf-8');
console.log("Updated VoiceAssistantView.tsx");
