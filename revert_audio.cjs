const fs = require('fs');
let code = fs.readFileSync('src/hooks/useLiveAudio.ts', 'utf-8');

const target = `    try {
      // Synchronously initialize AudioContext to bypass browser autoplay restrictions
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputCtx.resume();
      outputCtx.resume();
      
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        } 
      });
      mediaStreamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(\`\${protocol}//\${window.location.host}/live\`);
      if (userName) url.searchParams.set('userName', userName);
      if (userRole) url.searchParams.set('userRole', userRole);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = async () => {
        isConnectingRef.current = false;
        setIsLiveConnected(true);
        onStatusChange?.(true);

        // Instantly send init payload with real-time inventory snapshot to server session
        ws.send(JSON.stringify({ 
          type: 'init', 
          userName, 
          userRole, 
          items: Array.isArray(currentItems) ? currentItems : [] 
        }));`;

const replacement = `    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(\`\${protocol}//\${window.location.host}/live\`);
      if (userName) url.searchParams.set('userName', userName);
      if (userRole) url.searchParams.set('userRole', userRole);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onopen = async () => {
        isConnectingRef.current = false;
        setIsLiveConnected(true);
        onStatusChange?.(true);

        // Instantly send init payload with real-time inventory snapshot to server session
        ws.send(JSON.stringify({ 
          type: 'init', 
          userName, 
          userRole, 
          items: Array.isArray(currentItems) ? currentItems : [] 
        }));

        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        inputAudioCtxRef.current = inputCtx;
        outputAudioCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;`;

code = code.replace(target, replacement);
fs.writeFileSync('src/hooks/useLiveAudio.ts', code);
