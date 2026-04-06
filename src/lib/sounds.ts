// Notification sounds using Web Audio API
// AudioContext is created once and resumed on first user interaction

let _ac: AudioContext | null = null;

function getAc(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!_ac) {
      _ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser policy requires user gesture first)
    if (_ac.state === 'suspended') {
      _ac.resume();
    }
    return _ac;
  } catch {
    return null;
  }
}

// Unlock AudioContext on first user interaction (call once on app mount)
export function unlockAudio() {
  const unlock = () => {
    getAc();
    document.removeEventListener('click', unlock);
    document.removeEventListener('touchstart', unlock);
    document.removeEventListener('keydown', unlock);
  };
  document.addEventListener('click', unlock);
  document.addEventListener('touchstart', unlock);
  document.addEventListener('keydown', unlock);
}

// Soft single ping — nova mensagem WhatsApp
export function playNewMessageSound() {
  const ac = getAc();
  if (!ac || ac.state !== 'running') return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ac.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.4);
  } catch {}
}

// Acorde ascendente C-E-G — novo lead
export function playNewLeadSound() {
  const ac = getAc();
  if (!ac || ac.state !== 'running') return;
  try {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ac.currentTime + i * 0.13;
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {}
}
