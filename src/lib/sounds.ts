/**
 * Subtle UI sounds using Web Audio API.
 * Generates soft, pleasant tones programmatically — no audio files needed.
 */

let audioCtx: AudioContext | null = null;
let enabled = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => { });
  }
  return audioCtx;
}

export function setSoundsEnabled(value: boolean) {
  enabled = value;
  if (typeof window !== 'undefined') {
    localStorage.setItem('shonya-sounds', value ? '1' : '0');
  }
}

export function getSoundsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('shonya-sounds');
  if (stored !== null) {
    enabled = stored === '1';
  }
  return enabled;
}

function playTone(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  detune = 0,
) {
  if (!enabled) return;
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detune;

  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

/** Soft click — very subtle, like a gentle tap */
export function playClick() {
  playTone(800, 0.06, 0.04, 'sine');
}

/** Hover — barely audible soft blip */
export function playHover() {
  playTone(600, 0.04, 0.015, 'sine', 5);
}

/** Success — two ascending tones */
export function playSuccess() {
  playTone(523, 0.12, 0.035, 'sine');
  setTimeout(() => playTone(659, 0.15, 0.035, 'sine'), 80);
}

/** Navigation — soft whoosh-like tone */
export function playNavigate() {
  playTone(440, 0.1, 0.03, 'triangle');
}

/** Toggle on — gentle ascending blip */
export function playToggleOn() {
  playTone(480, 0.08, 0.03, 'sine');
  setTimeout(() => playTone(640, 0.08, 0.025, 'sine'), 50);
}

/** Toggle off — gentle descending blip */
export function playToggleOff() {
  playTone(640, 0.08, 0.03, 'sine');
  setTimeout(() => playTone(480, 0.08, 0.025, 'sine'), 50);
}

/** Spin/roulette tick — like a ratchet click */
export function playTick() {
  playTone(1200, 0.025, 0.025, 'square');
}

/** Roulette win — celebratory ascending melody */
export function playWin() {
  playTone(523, 0.15, 0.04, 'sine');
  setTimeout(() => playTone(659, 0.15, 0.04, 'sine'), 100);
  setTimeout(() => playTone(784, 0.2, 0.045, 'sine'), 200);
}

/** Error — low soft buzz */
export function playError() {
  playTone(220, 0.15, 0.03, 'triangle');
}
