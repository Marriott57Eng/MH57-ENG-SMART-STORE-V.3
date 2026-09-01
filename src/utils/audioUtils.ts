// Audio & Speech Synthesis utility for Engineering Store App

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    console.warn('AudioContext initialization error:', e);
    return null;
  }
}

/**
 * Plays a warm, melodic two-tone success chime (D5 -> A5)
 */
export const playSuccessChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1 - D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.14, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Tone 2 - A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.09);
    gain2.gain.setValueAtTime(0.20, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.45);
  } catch (e) {
    console.warn('Chime playback error:', e);
  }
};

/**
 * Speaks text in Thai using browser Web Speech API
 */
export const speakThai = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = 1.02; // natural pace
    utterance.pitch = 1.05;
    utterance.volume = 1.0;

    const executeSpeak = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        const thaiVoice = voices.find(
          (v) => v.lang === 'th-TH' || v.lang.startsWith('th') || v.name.toLowerCase().includes('thai')
        );
        if (thaiVoice) {
          utterance.voice = thaiVoice;
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('SpeechSynthesis speak error:', err);
      }
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      executeSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        executeSpeak();
      };
      // Fallback timeout in case onvoiceschanged does not fire
      setTimeout(executeSpeak, 120);
    }
  } catch (e) {
    console.warn('Speech synthesis error:', e);
  }
};

/**
 * Plays chime + speaks text in Thai
 */
export const playSuccessSoundAndSpeak = (
  speechText: string = 'ทำรายการเรียบร้อยแล้วค่ะ'
) => {
  playSuccessChime();
  // Delay speech slightly so chime finishes initial attack
  setTimeout(() => {
    speakThai(speechText);
  }, 120);
};

