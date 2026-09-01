import { useState, useRef, useCallback, useEffect } from 'react';

// High performance Int16 PCM to Base64 conversion without memory thrashing
function pcmToBase64(pcmData: Float32Array): string {
  const pcm16 = new Int16Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function useLiveAudio(
  onToolCall?: (toolCall: any) => void,
  onTranscript?: (text: string, isDone?: boolean) => void,
  onStatusChange?: (connected: boolean) => void,
  onUserTranscript?: (text: string) => void
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
  const duckingGainRef = useRef<GainNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animFrameRef = useRef<number | null>(null);
  const currentVolumeRef = useRef<number>(0);
  const inputLevelRef = useRef<number>(0);

  // Volume animation loop to track voice activity and apply smooth audio ducking
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
      if (inputLevelRef.current > 0.015) {
        targetVol = Math.max(targetVol, Math.min(1, inputLevelRef.current * 4.5));
        userActive = true;
        // Slowly decay user mic level
        inputLevelRef.current *= 0.85;
      }

      // 3. Audio Ducking Control: When sound is heard on the mic, gently lower AI output volume so user is heard
      if (outputAudioCtxRef.current && duckingGainRef.current) {
        const now = outputAudioCtxRef.current.currentTime;
        if (userActive || inputLevelRef.current > 0.018) {
          // Duck AI output volume down to 35% softly instead of abruptly cutting off
          duckingGainRef.current.gain.setTargetAtTime(0.35, now, 0.08);
        } else {
          // Smoothly ramp back up to 100% volume
          duckingGainRef.current.gain.setTargetAtTime(1.0, now, 0.18);
        }
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
    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
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

      // Connect source -> duckingGain -> analyser -> destination
      if (duckingGainRef.current) {
        source.connect(duckingGainRef.current);
      } else if (outputAnalyserRef.current) {
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
    } catch (e) {
      console.warn('Error playing audio chunk:', e);
    }
  };

  const stopLive = useCallback(() => {
    isConnectingRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      } catch (e) {}
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
    duckingGainRef.current = null;
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

  const startLive = useCallback(async (userName?: string, userRole?: string, currentItems?: any[], currentRequisitions?: any[], userNickname?: string) => {
    if (isConnectingRef.current || isLiveConnected) return;
    isConnectingRef.current = true;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(`${protocol}//${window.location.host}/live`);
      if (userName) url.searchParams.set('userName', userName);
      if (userRole) url.searchParams.set('userRole', userRole);
      if (userNickname) url.searchParams.set('userNickname', userNickname);

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
          userNickname,
          items: Array.isArray(currentItems) ? currentItems : [],
          requisitions: Array.isArray(currentRequisitions) ? currentRequisitions : [] 
        }));

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const inputCtx = new AudioContextClass({ sampleRate: 16000 });
        const outputCtx = new AudioContextClass({ sampleRate: 24000 });
        
        // Resume immediately to avoid suspended state on mobile/Chrome
        if (inputCtx.state === 'suspended') {
          await inputCtx.resume().catch(() => {});
        }
        if (outputCtx.state === 'suspended') {
          await outputCtx.resume().catch(() => {});
        }

        // Setup output Analyser for live speech wave animations & Ducking Gain Control
        const analyser = outputCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        
        const duckingGain = outputCtx.createGain();
        duckingGain.gain.setValueAtTime(1.0, outputCtx.currentTime);
        
        duckingGain.connect(analyser);
        analyser.connect(outputCtx.destination);
        
        outputAnalyserRef.current = analyser;
        duckingGainRef.current = duckingGain;

        inputAudioCtxRef.current = inputCtx;
        outputAudioCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        // Enhanced getUserMedia constraints with Auto Gain Control & Noise Suppression
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000
          } 
        });
        mediaStreamRef.current = stream;
        
        // Audio filtering for human vocal clarity:
        // 1. High-pass filter at 65Hz (cuts extreme low frequency rumble, preserves deep voices)
        const highpass = inputCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(65, inputCtx.currentTime);

        // 2. Low-pass filter at 7500Hz (allows high-frequency consonants like s, f, th which are crucial for Thai speech)
        const lowpass = inputCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(7500, inputCtx.currentTime);

        const source = inputCtx.createMediaStreamSource(stream);
        // Using 2048 samples (~128ms at 16kHz) for low latency response
        const processor = inputCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        
        source.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(processor);
        processor.connect(inputCtx.destination);

        // Smart Voice Activity & Noise Gate Parameters
        let lastVoiceTime = 0;
        let clearVoiceCount = 0;
        const NOISE_FLOOR_THRESHOLD = 0.008; // More sensitive RMS threshold to capture soft Thai speech
        const CLEAR_COMMAND_THRESHOLD = 0.025; // Distinct clear command threshold for instant interruption
        const HANGOVER_DURATION_MS = 650; // Keep gate open longer (650ms) to preserve Thai tone endings and trailing consonants

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const rawChannelData = e.inputBuffer.getChannelData(0);
            
            // Fast mic input volume calculation (RMS)
            let sum = 0;
            const step = 4;
            for (let i = 0; i < rawChannelData.length; i += step) {
              sum += rawChannelData[i] * rawChannelData[i];
            }
            const rms = Math.sqrt(sum / (rawChannelData.length / step));
            
            const now = Date.now();
            const isSpeaking = rms >= NOISE_FLOOR_THRESHOLD;
            if (isSpeaking) {
              lastVoiceTime = now;
              inputLevelRef.current = Math.max(inputLevelRef.current, rms);
            }

            // Detect clear, intentional spoken command (not soft noise)
            if (rms >= CLEAR_COMMAND_THRESHOLD) {
              clearVoiceCount++;
              // If user is clearly speaking a new command while AI is still talking, stop old speech immediately
              if (clearVoiceCount >= 2 && activeSourcesRef.current.size > 0) {
                activeSourcesRef.current.forEach(source => {
                  try { source.stop(); } catch (err) {}
                });
                activeSourcesRef.current.clear();
                if (outputAudioCtxRef.current) {
                  nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
                }
              }
            } else {
              clearVoiceCount = 0;
            }

            const isGateOpen = isSpeaking || (now - lastVoiceTime < HANGOVER_DURATION_MS);
            
            // If background room noise is below threshold and user isn't actively speaking,
            // send silence buffer so Gemini's VAD can promptly detect end of turn and reply
            let outputBuffer = rawChannelData;
            if (!isGateOpen) {
              outputBuffer = new Float32Array(rawChannelData.length);
            }

            const base64 = pcmToBase64(outputBuffer);
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };

        startVolumeTracker();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio && outputAudioCtxRef.current) {
            playAudioChunk(outputAudioCtxRef.current, msg.audio);
          }
          if (msg.userTranscript && onUserTranscript) {
            onUserTranscript(msg.userTranscript);
          }
          if (msg.text && onTranscript) {
            onTranscript(msg.text, false);
          }
          if (msg.turnComplete && onTranscript) {
            onTranscript('', true);
          }
          if (msg.interrupted) {
            // When Gemini detects the user interrupted with a new command, immediately clear all playing chunks
            activeSourcesRef.current.forEach(source => {
              try { source.stop(); } catch (e) {}
            });
            activeSourcesRef.current.clear();
            if (outputAudioCtxRef.current) {
              nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
              if (duckingGainRef.current) {
                duckingGainRef.current.gain.setValueAtTime(1.0, outputAudioCtxRef.current.currentTime);
              }
            }
          }
          if (msg.toolCall && onToolCall) {
            onToolCall(msg.toolCall);
          }
        } catch (err) {
          console.warn('Error parsing WS message:', err);
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
  }, [stopLive, onToolCall, onTranscript, onStatusChange, onUserTranscript, isLiveConnected, startVolumeTracker]);

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
