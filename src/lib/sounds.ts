let _ac: AudioContext | null = null;

function getAc(): AudioContext {
  if (!_ac) {
    _ac = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _ac;
}

function playTone(ac: AudioContext, type: OscillatorType, freq: number, startTime: number, duration: number, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Ping suave — nova mensagem WhatsApp
export function playNewMessageSound() {
  try {
    const ac = getAc();
    ac.resume().then(() => {
      playTone(ac, 'sine', 880, ac.currentTime, 0.4, 0.3);
    });
  } catch {}
}

// Acorde C-E-G — novo lead
export function playNewLeadSound() {
  try {
    const ac = getAc();
    ac.resume().then(() => {
      const now = ac.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        playTone(ac, 'triangle', freq, now + i * 0.13, 0.3, 0.35);
      });
    });
  } catch {}
}

// Chama uma vez para inicializar o AudioContext junto à primeira interação
export function unlockAudio() {
  const unlock = () => {
    try { getAc().resume(); } catch {}
  };
  document.addEventListener('click', unlock, { once: true });
  document.addEventListener('touchstart', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}
