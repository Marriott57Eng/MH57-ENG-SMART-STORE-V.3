const fs = require('fs');
let code = fs.readFileSync('src/hooks/useLiveAudio.ts', 'utf-8');
code = code.replace(
  'const stream = await navigator.mediaDevices.getUserMedia({ audio: true });',
  'const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });'
);
fs.writeFileSync('src/hooks/useLiveAudio.ts', code);
