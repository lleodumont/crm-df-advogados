let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

// Desbloqueia o AudioContext no primeiro gesto do usuário
export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    const ctx = getAudioContext();
    ctx.resume().then(() => { audioUnlocked = true; });
  } catch (e) {
    // ignore
  }
}

// Registra listeners globais para desbloquear no primeiro gesto
export function setupAudioUnlock() {
  const unlock = () => {
    unlockAudio();
    document.removeEventListener('click', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('click', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock);
}

export function playNotificationSound(type: 'message' | 'lead' = 'message') {
  try {
    const ctx = getAudioContext();

    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();

    resume.then(() => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'message') {
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.05);
      } else {
        oscillator.frequency.setValueAtTime(660, ctx.currentTime);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.2);
      }

      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    });
  } catch (e) {
    console.warn('Notification sound blocked:', e);
  }
}
