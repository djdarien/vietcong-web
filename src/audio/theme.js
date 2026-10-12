// Original procedural menu theme — NOT the Vietcong theme.
// Clean-room homage: slow minor-pentatonic plucks + low drone + shaker.
// No copyrighted melody, no sampled game audio. WebAudio only.

export const THEME = {
  bpm: 72,
  // A-minor pentatonic across 2 octaves (Hz). Original pattern, not transcribed.
  scale: [110, 130.81, 146.83, 164.81, 196, 220, 261.63, 293.66, 329.63, 392],
  // 16-step pattern (indexes into scale, -1 = rest). Loops every 4 bars of 4/4 at 72bpm.
  pattern: [0, -1, 2, -1, 4, -1, 3, 2, 0, -1, 5, 4, 2, -1, 1, -1],
  droneFreq: 55, // A1
};

export function stepDuration(bpm = THEME.bpm) {
  return 60 / bpm / 2; // 8th notes
}

export function patternFreq(stepIndex) {
  const idx = THEME.pattern[stepIndex % THEME.pattern.length];
  return idx < 0 ? null : THEME.scale[idx % THEME.scale.length];
}

export class ProceduralTheme {
  constructor(audioCtx = null) {
    this.ctx = audioCtx;
    this.master = null;
    this.muted = false;
    this.timer = null;
    this.step = 0;
    this.localEl = null;
  }

  attach(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);
    return this.master;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  start() {
    if (!this.ctx || this.timer) return;
    // Drone: two detuned sines through lowpass, always on.
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.08;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 300;
    droneGain.connect(filt).connect(this.master);
    for (const detune of [-4, 3]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = THEME.droneFreq;
      o.detune.value = detune;
      o.connect(droneGain);
      o.start();
    }
    const dur = stepDuration();
    const tick = () => {
      const f = patternFreq(this.step);
      if (f !== null && !this.muted) this.pluck(f);
      if (this.step % 2 === 0) this.shaker();
      this.step = (this.step + 1) % THEME.pattern.length;
    };
    tick();
    this.timer = setInterval(tick, dur * 1000);
  }

  pluck(freq) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.65);
  }

  shaker() {
    // Filtered noise burst, very quiet.
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.08;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
