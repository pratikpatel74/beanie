// audio.js — Web Audio API synthesis for Beanie
// All sounds are generated programmatically — no audio files needed.
// A single AudioContext is shared across the app.

let _actx = null;

async function _audio() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === 'suspended') await _actx.resume();
  return _actx;
}

export function isMuted() {
  try { return localStorage.getItem('beanie_muted') === 'true'; } catch { return false; }
}

/** Card slap + low pitch-drop thud on discard */
export async function playThwack(muted) {
  if (muted) return;
  try {
    const ctx = await _audio(); const now = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(lpf); lpf.connect(g); g.connect(ctx.destination); src.start(now);
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.28, now); og.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(og); og.connect(ctx.destination); osc.start(now); osc.stop(now + 0.1);
  } catch {}
}

/** Ascending shimmer chord when a set is laid */
export async function playShimmer(muted) {
  if (muted) return;
  try {
    const ctx = await _audio(); const now = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.45);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.5);
    });
  } catch {}
}

/** Soft tick on turn change */
export async function playTick(muted) {
  if (muted) return;
  try {
    const ctx = await _audio(); const now = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now); osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g); g.connect(ctx.destination); osc.start(now); osc.stop(now + 0.07);
  } catch {}
}

/** Soft descending two-note interval on round draw */
export async function playDraw(muted) {
  if (muted) return;
  try {
    const ctx = await _audio(); const now = ctx.currentTime;
    [523, 392].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.2, now + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.45);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.09); osc.stop(now + i * 0.09 + 0.5);
    });
  } catch {}
}

/** Rising 3-note fanfare + sustained chord on round win */
export async function playFanfare(muted) {
  if (muted) return;
  try {
    const ctx = await _audio(); const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + i * 0.07);
      g.gain.linearRampToValueAtTime(0.22, now + i * 0.07 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.18);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now + i * 0.07); osc.stop(now + i * 0.07 + 0.2);
    });
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
      const g = ctx.createGain(); const t = now + 0.21;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(i === 0 ? 0.22 : 0.16, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 0.75);
    });
  } catch {}
}

/** Short whoosh per card dealt */
export async function playWhoosh(muted, delay = 0) {
  if (muted) return;
  try {
    const ctx = await _audio();
    const now = ctx.currentTime + delay;
    const n = Math.floor(ctx.sampleRate * 0.07);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.1, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    src.connect(lpf); lpf.connect(g); g.connect(ctx.destination); src.start(now);
  } catch {}
}
