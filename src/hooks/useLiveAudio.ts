import { useState, useRef, useCallback, useEffect } from 'react';

function pcmToBase64(pcmData: Float32Array): string {
  const pcm16 = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    let s = Math.max(-1, Math.min(1, pcmData[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const buffer = new ArrayBuffer(pcm16.buffer.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(pcm16.buffer));
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useLiveAudio(
  onToolCall?: (toolCall: any) => void,
  onTranscript?: (text: string, isDone?: boolean) => void,
  onStatusChange?: (connected: boolean) => void
) {
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0); // 0.0 to 1.0
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);

  const isConnectingRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animFrameRef = useRef<number | null>(null);
  const currentVolumeRef = useRef<number>(0);
  const inputLevelRef = useRef<number>(0);

  // Volume animation loop to track voice activity from both User and AI
  const startVolumeTracker = useCallback(() => {
    const update = () => {
      let targetVol = 0;
      let aiActive = false;
      let userActive = false;

      // 1. Check AI output volume via AnalyserNode
      if (outputAnalyserRef.current && activeSourcesRef.current.size > 0) {
        const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length; // 0 to 255
        const norm = Math.min(1, avg / 128);
        if (norm > 0.05) {
          targetVol = Math.max(targetVol, norm);
          aiActive = true;
        }
      }

      // 2. Check User mic input volume
      if (inputLevelRef.current > 0.02) {
        targetVol = Math.max(targetVol, Math.min(1, inputLevelRef.current * 4.0));
        userActive = true;
        // Slowly decay user mic level
        inputLevelRef.current *= 0.85;
      }

      // Smooth volume interpolation
      currentVolumeRef.current = currentVolumeRef.current * 0.65 + targetVol * 0.35;
      if (currentVolumeRef.current < 0.01) currentVolumeRef.current = 0;

      setAudioVolume(currentVolumeRef.current);
      setIsAiSpeaking(aiActive);
      setIsUserSpeaking(userActive);

      animFrameRef.current = requestAnimationFrame(update);
    };

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const playAudioChunk = (ctx: AudioContext, base64: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const buffer = bytes.buffer;
    const int16Array = new Int16Array(buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    
    const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
    audioBuffer.getChannelData(0).set(float32Array);
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Connect source -> analyser -> destination
    if (outputAnalyserRef.current) {
      source.connect(outputAnalyserRef.current);
    } else {
      source.connect(ctx.destination);
    }
    
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };

    activeSourcesRef.current.add(source);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
  };

  const stopLive = useCallback(() => {
    isConnectingRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try { inputAudioCtxRef.current.close(); } catch (e) {}
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      try { outputAudioCtxRef.current.close(); } catch (e) {}
      outputAudioCtxRef.current = null;
    }
    outputAnalyserRef.current = null;
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    setAudioVolume(0);
    setIsAiSpeaking(false);
    setIsUserSpeaking(false);
    setIsLiveConnected(false);
    onStatusChange?.(false);
  }, [onStatusChange]);

  const sendMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ text }));
    }
  }, []);

  const syncInventory = useCallback((items: any[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && Array.isArray(items)) {
      wsRef.current.send(JSON.stringify({ type: 'sync_inventory', items }));
    }
  }, []);

  const startLive = useCallback(async (userName?: string, userRole?: string, currentItems?: any[]) => {
    if (isConnectingRef.current || isLiveConnected) return;
    isConnectingRef.current = true;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(`${protocol}//${window.location.host}/live`);
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
        
        // Setup output Analyser for live speech wave animations
        const analyser = outputCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        analyser.connect(outputCtx.destination);
        outputAnalyserRef.current = analyser;

        inputAudioCtxRef.current = inputCtx;
        outputAudioCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        mediaStreamRef.current = stream;
        
        const source = inputCtx.createMediaStreamSource(stream);
        // Using 2048 samples (~128ms at 16kHz) for ultra-low latency response
        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        
        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const channelData = e.inputBuffer.getChannelData(0);
            
            // Fast mic input volume calculation
            let sum = 0;
            const step = 4;
            for (let i = 0; i < channelData.length; i += step) {
              sum += channelData[i] * channelData[i];
            }
            const rms = Math.sqrt(sum / (channelData.length / step));
            inputLevelRef.current = Math.max(inputLevelRef.current, rms);

            const base64 = pcmToBase64(channelData);
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };

        startVolumeTracker();
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.audio && outputAudioCtxRef.current) {
          playAudioChunk(outputAudioCtxRef.current, msg.audio);
        }
        if (msg.text && onTranscript) {
          onTranscript(msg.text, false);
        }
        if (msg.turnComplete && onTranscript) {
          onTranscript('', true);
        }
        if (msg.interrupted) {
          // Instantly stop all currently playing chunks
          activeSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) {}
          });
          activeSourcesRef.current.clear();
          nextStartTimeRef.current = outputAudioCtxRef.current?.currentTime || 0;
        }
        if (msg.toolCall && onToolCall) {
          onToolCall(msg.toolCall);
        }
      };

      ws.onclose = () => {
        stopLive();
      };
      
      ws.onerror = () => {
        stopLive();
      };

    } catch (e) {
      console.error("Live Audio failed", e);
      stopLive();
    }
  }, [stopLive, onToolCall, onTranscript, onStatusChange, isLiveConnected, startVolumeTracker]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return { 
    isLiveConnected, 
    isConnecting: isConnectingRef.current, 
    audioVolume,
    isAiSpeaking,
    isUserSpeaking,
    startLive, 
    stopLive, 
    sendMessage, 
    syncInventory 
  };
}
