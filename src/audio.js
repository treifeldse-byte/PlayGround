import { clamp, rand } from './utils.js';

/**
 * Tiny procedural broadcast-audio engine. No assets, no downloads.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.crowdGain = null;
    this.crowdFilter = null;
    this.enabled = true;
    this.started = false;
    this.lastStep = 0;
    this.muted = localStorage.getItem('olympia-muted') === '1';
  }

  init() {
    if (this.started) {
      if (this.ctx?.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.82;
    this.master.connect(this.ctx.destination);
    this.started = true;
    this.createCrowd();
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('olympia-muted', muted ? '1' : '0');
    if (!this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.82, this.ctx.currentTime, 0.08);
  }

  createCrowd() {
    const ctx = this.ctx;
    const seconds = 7;
    const rate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      data[i] = last;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 720;
    filter.Q.value = 0.42;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1900;
    this.crowdFilter = filter;
    const gain = ctx.createGain();
    gain.gain.value = 0.026;
    src.connect(filter).connect(low).connect(gain).connect(this.master);
    src.start();
    this.crowdGain = gain;

    // A second, higher layer gives the murmur some air.
    const src2 = ctx.createBufferSource();
    src2.buffer = buffer;
    src2.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 1650;
    hp.Q.value = 0.7;
    const g2 = ctx.createGain();
    g2.gain.value = 0.006;
    src2.connect(hp).connect(g2).connect(this.master);
    src2.start();
  }

  setCrowd(level = 0.02) {
    if (!this.crowdGain) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(clamp(level, 0.005, 0.09), t, 0.35);
  }

  tone(freq = 440, dur = 0.18, vol = 0.12, type = 'sine', slide = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  noise(dur = 0.2, vol = 0.12, type = 'lowpass', freq = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    if (type === 'bandpass') filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  ui() {
    this.init();
    this.tone(520, 0.06, 0.045, 'triangle', 720);
  }
  uiBack() {
    this.tone(340, 0.08, 0.035, 'triangle', 250);
  }
  countBeep(high = false) {
    this.tone(high ? 880 : 620, 0.12, 0.07, 'sine', high ? 960 : 650);
  }
  gun() {
    this.init();
    this.noise(0.32, 0.55, 'highpass', 280);
    this.noise(0.18, 0.38, 'lowpass', 560);
    this.tone(84, 0.3, 0.38, 'sine', 38);
    this.tone(180, 0.06, 0.2, 'square', 90);
    for (let i = 0; i < 5; i++) this.noise(0.04, 0.06, 'bandpass', 1800 + i * 500, 0.01 * i);
  }
  falseStart() {
    this.noise(0.25, 0.24, 'bandpass', 1300);
    this.tone(210, 0.42, 0.14, 'square', 155);
    this.tone(205, 0.42, 0.11, 'square', 150, 0.1);
  }
  step(intensity = 0.5) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (now - this.lastStep < 62) return;
    this.lastStep = now;
    this.noise(0.045, 0.018 + intensity * 0.022, 'lowpass', 240 + Math.random() * 160);
  }
  whoosh(power = 1) {
    if (!this.ctx || this.muted) return;
    this.noise(0.28, 0.1 * power, 'bandpass', 700 + power * 300);
    this.tone(150, 0.22, 0.06, 'sine', 600);
  }
  jump() {
    this.whoosh(0.65);
    this.tone(220, 0.14, 0.045, 'triangle', 380);
  }
  sand(power = 1) {
    this.noise(0.34, 0.13 * power, 'lowpass', 1300);
    this.tone(95, 0.18, 0.06, 'sine', 50);
  }
  javelinThrow() {
    this.whoosh(1.3);
    this.noise(0.4, 0.08, 'bandpass', 2300);
  }
  javelinLand() {
    this.tone(80, 0.22, 0.11, 'sine', 40);
    this.noise(0.25, 0.12, 'lowpass', 900);
    this.sand(0.5);
  }
  cheer(strength = 1) {
    if (!this.ctx) return;
    this.setCrowd(0.03 + strength * 0.035);
    this.noise(1.2, 0.06 * strength, 'bandpass', 900);
    this.noise(0.8, 0.035 * strength, 'highpass', 1800, 0.08);
    for (let i = 0; i < 7; i++) {
      this.noise(0.08, 0.012 + Math.random() * 0.018, 'bandpass', 1000 + Math.random() * 1800, Math.random() * 0.9);
    }
  }
  fanfare() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.55, 0.06, 'triangle', f * 1.001, i * 0.11);
      this.tone(f / 2, 0.6, 0.035, 'sine', f / 2, i * 0.11);
    });
    this.cheer(1.4);
  }
  record() {
    [880, 1108.7, 1318.5, 1760].forEach((f, i) => this.tone(f, 0.28, 0.05, 'sine', f, 0.08 * i));
  }
}
