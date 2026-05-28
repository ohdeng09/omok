const STORAGE_KEY = 'omok:sound-muted';

export function createSoundEngine(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const AudioContextClass = options.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
  let context = null;
  let muted = storage?.getItem(STORAGE_KEY) === 'true';

  async function unlock() {
    if (muted || !AudioContextClass) return;
    if (!context) context = new AudioContextClass();
    if (context.state === 'suspended') await context.resume();
  }

  function playStone() {
    if (!canPlay()) return;
    const now = context.currentTime;
    playNoise(now, 0.035, 0.16);
    playTone({ frequency: 156, start: now, duration: 0.09, type: 'triangle', peak: 0.38 });
    playTone({ frequency: 540, start: now + 0.006, duration: 0.035, type: 'square', peak: 0.06 });
  }

  function playWin() {
    if (!canPlay()) return;
    playSequence([392, 523, 659, 784, 1046], 0.105, 0.22, 'triangle');
  }

  function playLose() {
    if (!canPlay()) return;
    playSequence([392, 330, 262, 196], 0.14, 0.18, 'sine');
  }

  function toggleMuted() {
    muted = !muted;
    storage?.setItem(STORAGE_KEY, String(muted));
    return muted;
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    storage?.setItem(STORAGE_KEY, String(muted));
  }

  function isMuted() {
    return muted;
  }

  function canPlay() {
    if (muted || !AudioContextClass) return false;
    if (!context) context = new AudioContextClass();
    return context.state !== 'suspended';
  }

  function playTone({ frequency, start, duration, type, peak }) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playNoise(start, duration, peak) {
    if (!context.createBufferSource) return;
    const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(start + duration);
  }

  function playSequence(notes, step, peak, type) {
    const start = context.currentTime;
    notes.forEach((frequency, index) => {
      playTone({
        frequency,
        start: start + index * step,
        duration: step * 0.9,
        type,
        peak: peak * Math.max(0.5, 1 - index * 0.08)
      });
    });
  }

  return {
    unlock,
    playStone,
    playWin,
    playLose,
    toggleMuted,
    setMuted,
    isMuted
  };
}
