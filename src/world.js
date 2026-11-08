import {
  clamp, lerp, rand, seeded, TAU
} from './utils.js';
import { drawAthlete, KITS } from './athlete.js';

const CROWD_COLORS = [
  '#26324a', '#39405a', '#614b49', '#7b4d42', '#283d3b', '#4f4f5d',
  '#8b6a45', '#b99146', '#d5c197', '#2e4666', '#5c3440', '#46556d',
  '#b65543', '#d9a637', '#5e7b91', '#e4d6ae', '#84495a', '#1e2a42'
];

const FLASH_COLORS = ['#f8f4e2', '#f8d87b', '#ffffff', '#8cd9ff'];

export class StadiumWorld {
  constructor() {
    this.t = 0;
    this.W = 0;
    this.H = 0;
    this.crowd = null;
    this.trackNoise = null;
    this.stars = [];
    this.motes = [];
    this.flashes = [];
    this.beamPhase = 0;
    this.camX = 0;
    this.meter = 50;
    this.anchor = 0.42;
    this.mode = 'menu';
    this.season = 'summer';
    this.layoutData = null;
    this.fireworks = [];
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(w, h) {
    this.W = w;
    this.H = h;
    this.u = clamp(h / 900, 0.62, 1.35);
    this.buildCrowd();
    this.buildTrackNoise();
    this.buildStars();
    this.buildMotes();
    this.layoutData = null;
  }

  buildStars() {
    const r = seeded(41);
    this.stars = Array.from({ length: Math.floor(70 + this.W / 36) }, () => ({
      x: r() * this.W,
      y: r() * this.H * 0.26,
      s: r() * 1.45 + 0.25,
      a: 0.18 + r() * 0.62,
      tw: r() * TAU
    }));
  }

  buildMotes() {
    const r = seeded(77);
    this.motes = Array.from({ length: Math.min(90, Math.floor(this.W / 16)) }, () => ({
      x: r() * this.W,
      y: this.H * (0.25 + r() * 0.62),
      s: 0.4 + r() * 1.8,
      vx: (r() - 0.5) * 3.5,
      vy: -2 - r() * 6,
      a: 0.05 + r() * 0.3,
      ph: r() * TAU
    }));
  }

  buildCrowd() {
    const W = this.W, H = this.H;
    const cw = Math.ceil(W * 1.7);
    const ch = Math.ceil(H * 0.31);
    const c = document.createElement('canvas');
    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    c.width = Math.ceil(cw * scale);
    c.height = Math.ceil(ch * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    const r = seeded(129);
    ctx.clearRect(0, 0, cw, ch);

    // Back rows are dimmer and denser.
    const rows = 18;
    for (let row = 0; row < rows; row++) {
      const ry = (row / rows) * ch + r() * 2;
      const depth = row / rows;
      const count = Math.floor(cw / (5.2 + depth * 1.8));
      for (let i = 0; i < count; i++) {
        const x = r() * cw;
        const y = ry + (r() - 0.5) * 3.2;
        const color = CROWD_COLORS[Math.floor(r() * CROWD_COLORS.length)];
        const a = 0.34 + r() * 0.56;
        const size = 1.4 + depth * 2.1 + r() * 0.9;
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.58, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = a * 0.7;
        ctx.fillRect(x - size * 0.62, y + size * 0.55, size * 1.25, size * 1.4);
      }
    }

    // Occasional phone camera lights.
    for (let i = 0; i < 34; i++) {
      const x = r() * cw;
      const y = r() * ch;
      ctx.globalAlpha = 0.5 + r() * 0.5;
      ctx.fillStyle = r() > 0.35 ? '#fff8db' : '#a9e7ff';
      ctx.beginPath(); ctx.arc(x, y, 0.7 + r() * 1.1, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.crowd = c;
    this.crowdW = cw;
    this.crowdH = ch;

    this.flashes = Array.from({ length: 11 }, () => ({
      x: r() * W,
      y: H * (0.28 + r() * 0.2),
      next: 1 + r() * 7,
      life: 0
    }));
  }

  buildTrackNoise() {
    const c = document.createElement('canvas');
    c.width = 180;
    c.height = 180;
    const ctx = c.getContext('2d');
    const r = seeded(313);
    for (let i = 0; i < 1700; i++) {
      const g = 80 + r() * 90;
      ctx.fillStyle = `rgba(${g + r() * 35},${g * 0.65},${g * 0.55},${0.04 + r() * 0.09})`;
      ctx.fillRect(r() * 180, r() * 180, 0.5 + r() * 1.4, 0.5 + r() * 1.4);
    }
    this.trackNoise = c;
  }

  update(dt) {
    this.t += dt;
    this.beamPhase += dt;
    for (const m of this.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < this.H * 0.15) { m.y = this.H * 0.88; m.x = rand(0, this.W); }
      if (m.x < -4) m.x = this.W + 4;
      if (m.x > this.W + 4) m.x = -4;
    }
    for (const f of this.flashes) {
      f.next -= dt;
      if (f.next <= 0) {
        f.life = 0.26;
        f.next = 2.8 + rand() * 8;
      }
      f.life = Math.max(0, f.life - dt);
    }
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      fw.life += dt;
      if (fw.life > fw.dur) this.fireworks.splice(i, 1);
    }
  }

  getLayout(mode = this.mode) {
    const W = this.W, H = this.H;
    if (mode === 'sprint') {
      const top = H * 0.585;
      const bottom = H * 0.975;
      const laneCount = 8;
      return { top, bottom, laneCount, laneH: (bottom - top) / laneCount, anchor: 0.415, runway: false };
    }
    if (mode === 'longjump' || mode === 'javelin' || mode === 'skijump' || mode === 'curling') {
      const top = H * (mode === 'curling' ? 0.60 : 0.635);
      const bottom = H * (mode === 'curling' ? 0.86 : 0.82);
      return { top, bottom, laneCount: 3, laneH: (bottom - top) / 3, anchor: 0.36, runway: true };
    }
    if (mode === 'ceremony') {
      return { top: H * 0.705, bottom: H * 0.99, laneCount: 5, laneH: H * 0.057, anchor: 0.42, runway: false };
    }
    // menu
    return { top: H * 0.665, bottom: H * 1.04, laneCount: 5, laneH: H * 0.075, anchor: 0.42, runway: false };
  }

  groundY(lane = 3, mode = this.mode) {
    const L = this.getLayout(mode);
    if (L.runway) return L.top + L.laneH * 1.62;
    return L.top + (lane + 0.72) * L.laneH;
  }

  laneScale(lane = 3, mode = this.mode) {
    const L = this.getLayout(mode);
    if (L.runway) return 0.92;
    return 0.75 + (lane / Math.max(1, L.laneCount - 1)) * 0.28;
  }

  sx(worldX) {
    return (worldX - this.camX) * this.meter;
  }

  setCamera(camX, meter, anchor = 0.42, mode = this.mode) {
    this.camX = camX;
    this.meter = meter;
    this.anchor = anchor;
    this.mode = mode;
  }

  /* ------------------------------------------------------------------ */
  /*  SKY + STADIUM                                                      */
  /* ------------------------------------------------------------------ */
  drawSky(ctx, opts = {}) {
    const W = this.W, H = this.H;
    const mode = opts.mode || this.mode;
    const menu = mode === 'menu' || mode === 'ceremony';

    const winter = this.season === 'winter';
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.58);
    if (winter) {
      sky.addColorStop(0, '#020711');
      sky.addColorStop(0.36, '#082036');
      sky.addColorStop(0.7, '#12384e');
      sky.addColorStop(1, '#35586a');
    } else if (menu) {
      sky.addColorStop(0, '#030713');
      sky.addColorStop(0.36, '#09142a');
      sky.addColorStop(0.66, '#1a2740');
      sky.addColorStop(1, '#4a3c3d');
    } else {
      sky.addColorStop(0, '#020611');
      sky.addColorStop(0.42, '#071226');
      sky.addColorStop(0.72, '#16243a');
      sky.addColorStop(1, '#4b3b39');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H * 0.62);

    // Haze glow on the horizon.
    const hg = ctx.createRadialGradient(W * 0.58, H * 0.47, 0, W * 0.58, H * 0.47, W * 0.55);
    if (winter) {
      hg.addColorStop(0, 'rgba(132,215,255,.16)');
      hg.addColorStop(0.45, 'rgba(70,150,200,.07)');
      hg.addColorStop(1, 'rgba(40,60,90,0)');
    } else {
      hg.addColorStop(0, 'rgba(255,164,91,.16)');
      hg.addColorStop(0.45, 'rgba(220,98,58,.065)');
      hg.addColorStop(1, 'rgba(40,40,60,0)');
    }
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, W, H * 0.58);

    // Stars.
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(this.t * 1.3 + s.tw);
      ctx.globalAlpha = s.a * tw * (menu ? 0.9 : 0.78);
      ctx.fillStyle = '#d9e8ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // A low moon hanging over the west stand.
    const mx = W * 0.155, my = H * 0.052, mr = Math.max(9, H * 0.020);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const moonGlow = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 6);
    moonGlow.addColorStop(0, 'rgba(255,240,198,.22)');
    moonGlow.addColorStop(0.4, 'rgba(220,214,190,.07)');
    moonGlow.addColorStop(1, 'rgba(190,200,230,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath(); ctx.arc(mx, my, mr * 6, 0, TAU); ctx.fill();
    ctx.restore();
    const moon = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, '#fffdf2');
    moon.addColorStop(0.7, '#eee7cd');
    moon.addColorStop(1, '#c9c4ae');
    ctx.globalAlpha = menu ? 0.82 : 0.7;
    ctx.fillStyle = moon;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#8b8a7c';
    ctx.beginPath(); ctx.arc(mx + mr * 0.26, my + mr * 0.18, mr * 0.28, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - mr * 0.32, my + mr * 0.34, mr * 0.16, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // Thin clouds, low-lit by the stadium.
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const y = H * (0.12 + i * 0.072);
      const x = W * (0.15 + i * 0.22) + Math.sin(this.t * 0.02 + i) * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.3);
      g.addColorStop(0, `rgba(118,132,164,${0.035 + i * 0.008})`);
      g.addColorStop(1, 'rgba(118,132,164,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, W * 0.3, H * 0.055, -0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCity(ctx) {
    const W = this.W, H = this.H;
    const base = H * 0.505;
    const r = seeded(88);
    if (this.season === 'winter') {
      this.drawMountains(ctx, base);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < 34; i++) {
      const bw = 9 + r() * 32;
      const bh = 15 + r() * H * 0.09;
      const x = r() * W;
      const y = base - bh;
      ctx.fillStyle = i % 4 === 0 ? '#0a1526' : '#07101f';
      ctx.fillRect(x, y, bw, bh);
      if (r() > 0.35) {
        ctx.fillStyle = 'rgba(255,191,104,.36)';
        for (let wy = y + 5; wy < base - 4; wy += 7) {
          if (r() > 0.58) ctx.fillRect(x + 3 + r() * Math.max(1, bw - 7), wy, 1.3, 1.3);
        }
      }
    }
    ctx.restore();
    const haze = ctx.createLinearGradient(0, base - 90, 0, base + 15);
    haze.addColorStop(0, 'rgba(4,10,20,0)');
    haze.addColorStop(1, 'rgba(5,11,21,.86)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, base - 100, W, 115);
  }

  drawMountains(ctx, base) {
    const W = this.W, H = this.H;
    // Aurora curtains.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i++) {
      const top = H * (0.055 + i * 0.042);
      const amp = H * (0.03 + i * 0.012);
      const g = ctx.createLinearGradient(0, top, 0, top + H * 0.2);
      g.addColorStop(0, 'rgba(90,255,205,0)');
      g.addColorStop(0.35, `rgba(84,236,204,${0.085 - i * 0.018})`);
      g.addColorStop(0.66, `rgba(88,170,255,${0.055 - i * 0.012})`);
      g.addColorStop(1, 'rgba(80,140,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-20, top);
      for (let x = -20; x <= W + 20; x += 24) {
        const y = top + Math.sin(x * 0.006 + this.t * 0.22 + i * 1.7) * amp + Math.sin(x * 0.021 - this.t * 0.14 + i) * amp * 0.35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W + 20, top + H * 0.22);
      for (let x = W + 20; x >= -20; x -= 24) {
        const y = top + H * 0.2 + Math.sin(x * 0.005 - this.t * 0.2 + i * 2.2) * amp * 0.8;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Layered snow mountains.
    const layers = [
      { base: base + 6, amp: H * 0.13, color: '#0b2234', cap: 'rgba(214,240,255,.5)', seed: 31, n: 9 },
      { base: base + 12, amp: H * 0.085, color: '#0a1a2a', cap: 'rgba(228,246,255,.66)', seed: 77, n: 12 },
      { base: base + 18, amp: H * 0.05, color: '#071322', cap: 'rgba(240,250,255,.8)', seed: 19, n: 16 }
    ];
    for (const layer of layers) {
      const r = seeded(layer.seed);
      const peaks = [];
      for (let i = 0; i < layer.n; i++) {
        const x = -W * 0.08 + (i / (layer.n - 1)) * W * 1.16 + (r() - 0.5) * W * 0.03;
        const y = layer.base - layer.amp * (0.5 + r() * 0.7);
        peaks.push({ x, y });
      }
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(-30, layer.base);
      ctx.lineTo(-30, peaks[0].y + layer.amp * 0.3);
      for (let i = 0; i < peaks.length; i++) {
        const p = peaks[i];
        ctx.lineTo(p.x, p.y);
        const next = peaks[i + 1];
        if (next) {
          const vx = (p.x + next.x) / 2 + (r() - 0.5) * W * 0.02;
          ctx.lineTo(vx, layer.base - layer.amp * 0.12);
        }
      }
      ctx.lineTo(W + 30, peaks[peaks.length - 1].y + layer.amp * 0.3);
      ctx.lineTo(W + 30, layer.base + 6);
      ctx.closePath();
      ctx.fill();
      // summit caps
      ctx.fillStyle = layer.cap;
      for (const p of peaks) {
        const h = layer.amp * 0.26;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - h * 0.8, p.y + h);
        ctx.lineTo(p.x - h * 0.28, p.y + h * 0.7);
        ctx.lineTo(p.x + h * 0.12, p.y + h * 1.02);
        ctx.lineTo(p.x + h * 0.82, p.y + h);
        ctx.closePath();
        ctx.fill();
      }
    }
    const haze = ctx.createLinearGradient(0, base - 70, 0, base + 16);
    haze.addColorStop(0, 'rgba(6,18,30,0)');
    haze.addColorStop(1, 'rgba(7,18,30,.9)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, base - 80, W, 100);
  }

  drawRoof(ctx) {
    const W = this.W, H = this.H;
    const topY = H * 0.105;
    const botY = H * 0.212;

    // A suspended canopy band: sky stays visible above the stadium.
    const canopy = ctx.createLinearGradient(0, topY, 0, botY);
    canopy.addColorStop(0, '#0b1625');
    canopy.addColorStop(0.58, '#07111f');
    canopy.addColorStop(1, '#030810');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.moveTo(-20, topY);
    ctx.lineTo(W + 20, topY - H * 0.014);
    ctx.lineTo(W + 20, botY - H * 0.016);
    ctx.quadraticCurveTo(W * 0.78, botY + H * 0.003, W * 0.56, botY - H * 0.006);
    ctx.quadraticCurveTo(W * 0.32, botY - H * 0.015, W * 0.12, botY + H * 0.004);
    ctx.quadraticCurveTo(W * 0.03, botY + H * 0.01, -20, botY - H * 0.002);
    ctx.closePath();
    ctx.fill();

    // leading edge highlight
    ctx.strokeStyle = 'rgba(137,169,205,.2)';
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(0, botY - H * 0.002);
    ctx.quadraticCurveTo(W * 0.12, botY + H * 0.008, W * 0.3, botY - H * 0.008);
    ctx.quadraticCurveTo(W * 0.56, botY - H * 0.012, W * 0.78, botY + H * 0.003);
    ctx.quadraticCurveTo(W * 0.92, botY + H * 0.008, W, botY - H * 0.014);
    ctx.stroke();

    // roof trusses and diagonal lattice
    ctx.strokeStyle = 'rgba(111,141,181,.12)';
    ctx.lineWidth = 0.75;
    for (let i = 0; i < 13; i++) {
      const x = (i / 12) * W;
      const yTop = topY - (x / W) * H * 0.014;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, botY - H * 0.012);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(123,153,191,.055)';
    for (let i = 0; i < 7; i++) {
      const y = topY + i * H * 0.019;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y - H * 0.014);
      ctx.stroke();
    }
    // warm service lights under the canopy
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 10; i++) {
      const x = W * (0.06 + i * 0.1);
      const y = botY - H * 0.017;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, 'rgba(255,235,184,.35)');
      g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawFloodlights(ctx) {
    const W = this.W, H = this.H;
    const towers = [
      { x: W * 0.075, h: H * 0.085, scale: 1.05 },
      { x: W * 0.925, h: H * 0.075, scale: 1.0 },
      { x: W * 0.52, h: H * 0.07, scale: 0.74, faint: true }
    ];
    for (const tw of towers) {
      const topY = tw.h;
      const bankY = H * 0.16;
      const bankW = 58 * tw.scale * this.u / 0.9;
      const bankH = 25 * tw.scale * this.u / 0.9;
      // mast
      ctx.strokeStyle = 'rgba(126,150,183,.24)';
      ctx.lineWidth = 1.3 * tw.scale;
      ctx.beginPath(); ctx.moveTo(tw.x - 7, bankY); ctx.lineTo(tw.x - 2, topY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tw.x + 7, bankY); ctx.lineTo(tw.x + 2, topY); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const yy = lerp(bankY, topY, i / 6);
        const spread = lerp(7, 2, i / 6);
        ctx.beginPath(); ctx.moveTo(tw.x - spread, yy); ctx.lineTo(tw.x + spread, yy); ctx.stroke();
      }
      // light bank
      const bx = tw.x - bankW / 2, by = bankY - bankH;
      ctx.save();
      ctx.globalAlpha = tw.faint ? 0.56 : 0.9;
      ctx.fillStyle = '#111b2a';
      ctx.strokeStyle = 'rgba(190,208,232,.27)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bankW, bankH, 2) : ctx.rect(bx, by, bankW, bankH);
      ctx.fill(); ctx.stroke();
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 5; col++) {
          const lx = bx + 7 + col * (bankW - 14) / 4;
          const ly = by + 7 + row * 10;
          const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5.5);
          lg.addColorStop(0, 'rgba(255,252,226,1)');
          lg.addColorStop(0.3, 'rgba(255,225,166,.72)');
          lg.addColorStop(1, 'rgba(255,205,120,0)');
          ctx.fillStyle = lg;
          ctx.beginPath(); ctx.arc(lx, ly, 5.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#fff9de';
          ctx.beginPath(); ctx.arc(lx, ly, 1.35, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();

      // beams of light
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const beamAlpha = tw.faint ? 0.032 : 0.062;
      const beam = ctx.createLinearGradient(tw.x, bankY, tw.x + (W * 0.5 - tw.x) * 0.34, H * 0.63);
      beam.addColorStop(0, `rgba(255,247,215,${beamAlpha})`);
      beam.addColorStop(0.5, `rgba(255,225,165,${beamAlpha * 0.35})`);
      beam.addColorStop(1, 'rgba(255,220,160,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(bx, by + bankH);
      ctx.lineTo(bx + bankW, by + bankH);
      ctx.lineTo(tw.x + bankW * 2.4, H * 0.69);
      ctx.lineTo(tw.x - bankW * 2.4, H * 0.69);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawCrowd(ctx) {
    const W = this.W, H = this.H;
    if (!this.crowd) return;
    const top = H * 0.245;
    const bottom = H * 0.53;
    const height = bottom - top;

    // Concrete fascia between the canopy and the stands, with a live LED strip.
    const fasciaTop = H * 0.214;
    const fasciaH = top - fasciaTop;
    const fascia = ctx.createLinearGradient(0, fasciaTop, 0, top);
    fascia.addColorStop(0, '#0a1526');
    fascia.addColorStop(0.55, '#060d19');
    fascia.addColorStop(1, '#030810');
    ctx.fillStyle = fascia;
    ctx.fillRect(0, fasciaTop, W, fasciaH);
    ctx.strokeStyle = 'rgba(141,171,207,.16)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, fasciaTop + 0.5); ctx.lineTo(W, fasciaTop + 0.5); ctx.stroke();
    // scrolling stadium name on the fascia
    const fasciaFont = `600 ${Math.max(7, fasciaH * 0.38)}px "Barlow Condensed", sans-serif`;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, fasciaTop, W, fasciaH); ctx.clip();
    ctx.font = fasciaFont;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(247,201,80,.55)';
    ctx.shadowColor = 'rgba(247,201,80,.5)';
    ctx.shadowBlur = 6;
    const fasciaMsg = this.season === 'winter'
      ? 'OLYMPIA STADIUM   •   WINTER OLYMPIC GAMES   •   SAPPORO 2026   •   '
      : 'OLYMPIA STADIUM   •   WORLD OLYMPIC GAMES   •   PARIS 2026   •   ';
    const fw = ctx.measureText(fasciaMsg).width;
    const foff = -((this.t * 16) % fw);
    for (let x = foff; x < W + fw; x += fw) ctx.fillText(fasciaMsg, x, fasciaTop + fasciaH * 0.55);
    ctx.restore();
    ctx.fillStyle = 'rgba(247,201,80,.28)';
    ctx.fillRect(0, top - 1.5, W, 1.2);

    const cw = this.crowdW * (W / this.W);
    const offset = -((this.camX * 2.1) % cw + cw) % cw;
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, 'rgba(8,16,30,.34)');
    grad.addColorStop(0.34, 'rgba(9,17,31,.06)');
    grad.addColorStop(1, 'rgba(3,8,17,.46)');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, top + H * 0.012);
    ctx.quadraticCurveTo(W * 0.22, top - H * 0.01, W * 0.46, top + H * 0.004);
    ctx.quadraticCurveTo(W * 0.72, top + H * 0.016, W, top - H * 0.006);
    ctx.lineTo(W, bottom + H * 0.012);
    ctx.lineTo(0, bottom + H * 0.022);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.96;
    for (let i = -1; i < 3; i++) {
      ctx.drawImage(this.crowd, offset + i * cw, top, cw, height);
    }
    ctx.globalAlpha = 1;
    // warm wash from the floodlights over the near stand
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const warm = ctx.createRadialGradient(W * 0.52, top + height * 0.12, 0, W * 0.52, top + height * 0.12, W * 0.62);
    warm.addColorStop(0, this.season === 'winter' ? 'rgba(160,224,255,.14)' : 'rgba(255,183,108,.15)');
    warm.addColorStop(0.55, this.season === 'winter' ? 'rgba(110,190,240,.05)' : 'rgba(255,154,92,.05)');
    warm.addColorStop(1, this.season === 'winter' ? 'rgba(90,170,230,0)' : 'rgba(255,140,90,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, top, W, height);
    ctx.restore();
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, W, height);
    ctx.restore();

    // tier ledges and stair aisles
    ctx.save();
    for (let row = 0; row < 7; row++) {
      const y = top + (row / 7) * height;
      ctx.strokeStyle = `rgba(131,151,177,${0.075 + row * 0.006})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y + 7);
      ctx.quadraticCurveTo(W * 0.5, y + 1, W, y + 7);
      ctx.stroke();
    }
    for (let i = 1; i < 12; i++) {
      const x = (i / 12) * W;
      ctx.strokeStyle = 'rgba(2,6,14,.3)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x, top + 4);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }
    // dark rail at the bottom of the stands
    ctx.fillStyle = 'rgba(3,8,17,.72)';
    ctx.fillRect(0, bottom - H * 0.008, W, H * 0.02);
    ctx.strokeStyle = 'rgba(178,198,220,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, bottom - H * 0.006); ctx.lineTo(W, bottom - H * 0.002); ctx.stroke();
    ctx.restore();

    // phone flashes
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const f of this.flashes) {
      if (f.life > 0) {
        const a = f.life / 0.26;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 11);
        g.addColorStop(0, `rgba(255,250,226,${0.9 * a})`);
        g.addColorStop(0.25, `rgba(255,240,195,${0.45 * a})`);
        g.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();

    // A handful of supporter flags along the front rail.
    const flags = ['#e9c94f', '#79e2ff', '#ff6d60', '#7ef0a9', '#f3ede0'];
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const fx = W * (0.055 + i * 0.145);
      const fy = bottom - H * 0.004;
      const fh = H * (0.022 + (i % 3) * 0.003);
      const wave = Math.sin(this.t * 2.1 + i * 1.7) * fh * 0.14;
      ctx.strokeStyle = 'rgba(175,196,220,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - fh * 1.6); ctx.stroke();
      ctx.fillStyle = flags[i % flags.length];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(fx, fy - fh * 1.6);
      ctx.quadraticCurveTo(fx + fh * 0.7, fy - fh * 1.5 + wave, fx + fh * 1.22, fy - fh * 1.3 + wave);
      ctx.lineTo(fx, fy - fh * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawLedRibbon(ctx, opts = {}) {
    const W = this.W, H = this.H;
    const y = H * 0.528;
    const h = H * 0.022;
    ctx.fillStyle = '#030810';
    ctx.fillRect(0, y, W, h);
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + h); ctx.lineTo(W, y + h); ctx.stroke();

    const msg = opts.ribbon || (this.season === 'winter'
      ? 'OLYMPIA 2026  •  WINTER SESSION  •  SNOW & ICE  •  CHASE THE GOLD  •  '
      : 'OLYMPIA 2026  •  NIGHT SESSION  •  100M FINAL  •  CHASE THE GOLD  •  ');
    const font = `600 ${Math.round(h * 0.48)}px "Barlow Condensed", sans-serif`;
    ctx.font = font;
    const textW = ctx.measureText(msg).width;
    const offset = -((this.t * 28) % textW);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y, W, h); ctx.clip();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(247,201,80,.9)';
    ctx.shadowColor = 'rgba(247,201,80,.6)';
    ctx.shadowBlur = 8;
    for (let x = offset; x < W + textW; x += textW) {
      ctx.fillText(msg, x, y + h * 0.54);
    }
    ctx.shadowBlur = 0;
    // panel seams
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    for (let x = 80; x < W; x += 150) ctx.fillRect(x, y, 1, h);
    ctx.restore();
  }

  drawJumbotron(ctx, opts = {}) {
    const W = this.W, H = this.H;
    const mode = opts.mode || this.mode;
    if (mode === 'menu') {
      const bw = Math.min(W * 0.18, 255);
      const bh = bw * 0.57;
      const x = W * 0.73 - bw / 2;
      const y = H * 0.12;
      this.drawBoardBox(ctx, x, y, bw, bh, 'OLYMPIA', '26', this.season === 'winter' ? 'WINTER SESSION' : 'NIGHT SESSION', this.season === 'winter' ? 'SAPPORO' : '20:26');
      return;
    }
    if (mode === 'ceremony') {
      const bw = Math.min(W * 0.2, 280);
      const bh = bw * 0.55;
      this.drawBoardBox(ctx, W * 0.71 - bw / 2, H * 0.115, bw, bh, 'OLYMPIA', '26', 'THE PODIUM', 'GOLD');
      return;
    }
    const bw = Math.min(W * 0.2, 270);
    const bh = bw * 0.52;
    this.drawBoardBox(
      ctx, W * 0.74 - bw / 2, H * 0.13, bw, bh,
      opts.top ?? opts.boardTop ?? 'OLYMPIA',
      opts.big ?? opts.boardBig ?? '100M',
      opts.sub ?? opts.boardSub ?? 'FINAL',
      opts.value ?? opts.boardValue ?? '0.00'
    );
  }

  drawBoardBox(ctx, x, y, w, h, top, big, sub, value) {
    ctx.save();
    // support cables
    ctx.strokeStyle = 'rgba(120,143,172,.24)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + w * 0.18, y); ctx.lineTo(x + w * 0.13, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.82, y); ctx.lineTo(x + w * 0.87, 0); ctx.stroke();
    // frame
    ctx.fillStyle = '#050a12';
    ctx.strokeStyle = 'rgba(150,175,205,.3)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 3); else ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
    // screen
    const pad = Math.max(4, w * 0.025);
    const sx = x + pad, sy = y + pad, sw = w - pad * 2, sh = h - pad * 2;
    const bg = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    bg.addColorStop(0, '#102f3d');
    bg.addColorStop(0.5, '#071b2b');
    bg.addColorStop(1, '#030c16');
    ctx.fillStyle = bg;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#65e3ff';
    for (let yy = sy; yy < sy + sh; yy += 3) ctx.fillRect(sx, yy, sw, 0.5);
    ctx.globalAlpha = 1;
    // scan glow
    const glow = ctx.createLinearGradient(sx, sy, sx, sy + sh);
    glow.addColorStop(0, 'rgba(83,205,255,.1)');
    glow.addColorStop(1, 'rgba(15,82,130,.02)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx, sy, sw, sh);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(247,201,80,.9)';
    ctx.font = `700 ${Math.max(7, w * 0.042)}px "Barlow Condensed", sans-serif`;
    ctx.fillText(top, x + w / 2, sy + sh * 0.14);
    ctx.fillStyle = '#f3ead3';
    ctx.font = `800 ${Math.max(22, w * 0.24)}px "Barlow Condensed", sans-serif`;
    ctx.fillText(big, x + w / 2, sy + sh * 0.43);
    ctx.fillStyle = 'rgba(144,229,255,.9)';
    ctx.font = `600 ${Math.max(7, w * 0.052)}px "Barlow Condensed", sans-serif`;
    ctx.fillText(sub, x + w / 2, sy + sh * 0.68);
    ctx.fillStyle = '#f7c950';
    ctx.font = `600 ${Math.max(9, w * 0.075)}px "Barlow Condensed", sans-serif`;
    ctx.fillText(value, x + w / 2, sy + sh * 0.87);
    // screen glare
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(sx, sy); ctx.lineTo(sx + sw * 0.72, sy); ctx.lineTo(sx, sy + sh * 0.6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  GROUND                                                             */
  /* ------------------------------------------------------------------ */
  drawGround(ctx, opts = {}) {
    const W = this.W, H = this.H;
    const mode = opts.mode || this.mode;
    const L = this.getLayout(mode);
    const winter = this.season === 'winter';

    // infield / grass behind the track
    const grassTop = H * 0.545;
    const grassBottom = L.top + 2;
    const grass = ctx.createLinearGradient(0, grassTop, 0, grassBottom);
    if (winter) {
      grass.addColorStop(0, '#0a1a2c');
      grass.addColorStop(0.55, '#163448');
      grass.addColorStop(1, '#24536a');
    } else {
      grass.addColorStop(0, '#061a17');
      grass.addColorStop(0.55, '#0a2c24');
      grass.addColorStop(1, '#0d3528');
    }
    ctx.fillStyle = grass;
    ctx.fillRect(0, grassTop, W, Math.max(0, grassBottom - grassTop));
    // mowing stripes
    ctx.save();
    ctx.beginPath(); ctx.rect(0, grassTop, W, Math.max(0, grassBottom - grassTop)); ctx.clip();
    const stripeW = Math.max(50, W * 0.075);
    for (let i = -2; i < W / stripeW + 2; i++) {
      if (i % 2 === 0) {
        ctx.fillStyle = winter ? 'rgba(196,238,255,.035)' : 'rgba(74,158,109,.045)';
        ctx.fillRect(i * stripeW + (this.camX * 3) % (stripeW * 2), grassTop, stripeW, grassBottom - grassTop);
      }
    }
    // little mow arrows / snow drifts
    ctx.globalAlpha = winter ? 0.07 : 0.05;
    ctx.strokeStyle = winter ? '#dff4ff' : '#b8ffd9';
    ctx.lineWidth = 1;
    for (let x = -100; x < W + 100; x += 170) {
      const y = grassTop + (grassBottom - grassTop) * 0.55;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 60, y); ctx.stroke();
    }
    ctx.restore();

    // banner boards at the back of the track
    this.drawAdBoards(ctx, mode, L);

    if (winter && mode === 'curling') {
      this.drawCurlingSheet(ctx, L);
      return;
    }
    if (winter && mode === 'skijump') {
      this.drawSkiJumpHill(ctx, L);
      return;
    }
    if (mode === 'longjump') {
      this.drawRunway(ctx, L, 'longjump');
      return;
    }
    if (mode === 'javelin') {
      this.drawRunway(ctx, L, 'javelin');
      this.drawJavelinField(ctx, L);
      return;
    }
    this.drawSprintTrack(ctx, L, mode);
  }

  drawAdBoards(ctx, mode, L) {
    const W = this.W;
    const y = H_(this.H, 0.575);
    const h = Math.max(16, this.H * 0.024);
    const labels = this.season === 'winter'
      ? ['OLYMPIA', 'WINTER SERIES', 'SNOW & ICE', 'SAPPORO 26', 'NIGHT SESSION', 'OLYMPIA']
      : ['OLYMPIA', 'GOLD SERIES', 'TRACK & FIELD', 'PARIS 26', 'NIGHT SESSION', 'OLYMPIA'];
    const panelW = 155 * this.u;
    const startWorld = Math.floor((this.camX - 20) / 20) * 20;
    for (let xw = startWorld; xw < this.camX + (W / this.meter) + 40; xw += 20) {
      const idx = Math.abs(Math.round(xw / 20)) % labels.length;
      const x = this.sx(xw);
      const yTop = y - h;
      ctx.save();
      ctx.globalAlpha = 0.9;
      const g = ctx.createLinearGradient(x, yTop, x, yTop + h);
      g.addColorStop(0, 'rgba(12,23,40,.92)');
      g.addColorStop(1, 'rgba(4,9,17,.97)');
      ctx.fillStyle = g;
      ctx.fillRect(x, yTop, panelW, h);
      ctx.strokeStyle = 'rgba(118,153,190,.22)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(x, yTop, panelW, h);
      // lit sponsor strip
      ctx.fillStyle = idx % 3 === 0 ? 'rgba(247,201,80,.06)' : 'rgba(104,219,255,.045)';
      ctx.fillRect(x, yTop, panelW, h);
      ctx.fillStyle = idx % 3 === 0 ? 'rgba(247,201,80,.86)' : 'rgba(239,244,250,.72)';
      ctx.font = `700 ${Math.max(7, h * 0.38)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[idx], x + panelW / 2, yTop + h * 0.54);
      ctx.fillStyle = 'rgba(247,201,80,.55)';
      ctx.fillRect(x, yTop + h - 2, panelW, 1.2);
      ctx.restore();
    }
  }

  drawSprintTrack(ctx, L, mode) {
    const W = this.W, H = this.H;
    const top = L.top, bottom = L.bottom;
    const winter = this.season === 'winter';
    const base = ctx.createLinearGradient(0, top, 0, bottom);
    if (winter) {
      base.addColorStop(0, '#9fc7d8');
      base.addColorStop(0.18, '#c4e0ec');
      base.addColorStop(0.5, '#dbedf4');
      base.addColorStop(0.82, '#b7d8e6');
      base.addColorStop(1, '#7fa8bd');
    } else {
      base.addColorStop(0, '#5a221d');
      base.addColorStop(0.18, '#7d3025');
      base.addColorStop(0.58, '#9c3c2a');
      base.addColorStop(1, '#6e271f');
    }
    ctx.fillStyle = base;
    ctx.fillRect(0, top, W, bottom - top);

    // Broad pools of floodlight sheen running across the rubber.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const sheen = ctx.createLinearGradient(0, top, 0, bottom);
    if (winter) {
      sheen.addColorStop(0, 'rgba(210,244,255,.04)');
      sheen.addColorStop(0.5, 'rgba(235,252,255,.16)');
      sheen.addColorStop(1, 'rgba(190,235,255,.03)');
    } else {
      sheen.addColorStop(0, 'rgba(255,213,168,.02)');
      sheen.addColorStop(0.5, 'rgba(255,225,185,.11)');
      sheen.addColorStop(1, 'rgba(255,190,140,.02)');
    }
    ctx.fillStyle = sheen;
    for (let i = -1; i < 4; i++) {
      const x = ((W * (0.14 + i * 0.27) - this.camX * this.meter * 0.22) % (W * 1.1)) - W * 0.2;
      ctx.beginPath();
      ctx.ellipse(x, top + (bottom - top) * 0.58, W * 0.16, (bottom - top) * 0.52, -0.06, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    const playerLane = this.playerLane ?? 3;
    for (let i = 0; i < L.laneCount; i++) {
      const y = top + i * L.laneH;
      if (i === playerLane && (mode === 'sprint')) {
        ctx.fillStyle = winter ? 'rgba(143,228,255,.1)' : 'rgba(247,201,80,.045)';
        ctx.fillRect(0, y, W, L.laneH);
      } else if (i % 2 === 0) {
        ctx.fillStyle = winter ? 'rgba(255,255,255,.05)' : 'rgba(255,150,110,.028)';
        ctx.fillRect(0, y, W, L.laneH);
      }
      // lane line
      ctx.strokeStyle = winter ? 'rgba(58,96,120,.42)' : 'rgba(240,232,214,.6)';
      ctx.lineWidth = Math.max(0.7, 1.2 * this.u);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      // inner shadow on the line
      ctx.strokeStyle = winter ? 'rgba(255,255,255,.35)' : 'rgba(60,10,8,.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y + 1.6); ctx.lineTo(W, y + 1.6); ctx.stroke();
      // lane number painted on the rubber near the start
      if (mode === 'sprint' && !winter) {
        const nx = this.sx(2.6);
        if (nx > -30 && nx < W + 30) {
          ctx.save();
          ctx.globalAlpha = 0.34;
          ctx.fillStyle = '#f8efdb';
          ctx.font = `700 ${Math.max(8, L.laneH * 0.3)}px "Barlow Condensed", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(i + 1), nx, y + L.laneH * 0.52);
          ctx.restore();
        }
      }
    }
    // outer edge
    ctx.strokeStyle = winter ? 'rgba(46,84,108,.45)' : 'rgba(240,232,214,.5)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(0, bottom); ctx.lineTo(W, bottom); ctx.stroke();

    // noise + light pools
    ctx.save();
    ctx.globalAlpha = winter ? 0.12 : 0.32;
    const pattern = ctx.createPattern(this.trackNoise, 'repeat');
    ctx.fillStyle = pattern;
    ctx.fillRect(0, top, W, bottom - top);
    ctx.restore();

    if (winter) {
      // snow banks framing the course
      for (const edge of [top, bottom]) {
        const bank = ctx.createLinearGradient(0, edge - 12, 0, edge + 12);
        bank.addColorStop(0, 'rgba(226,245,255,0)');
        bank.addColorStop(0.5, 'rgba(230,247,255,.5)');
        bank.addColorStop(1, 'rgba(180,219,236,0)');
        ctx.fillStyle = bank;
        ctx.fillRect(0, edge - 12, W, 24);
      }
      this.drawSnowboardGates(ctx, L, mode);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = W * (0.1 + i * 0.28) + Math.sin(this.t * 0.1 + i) * 25;
      const g = ctx.createRadialGradient(x, top + (bottom - top) * 0.55, 0, x, top + (bottom - top) * 0.55, W * 0.22);
      g.addColorStop(0, winter ? 'rgba(198,241,255,.07)' : 'rgba(255,213,157,.035)');
      g.addColorStop(1, 'rgba(255,213,157,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, bottom - top);
    }
    ctx.restore();

    // world markings
    this.drawTrackMarks(ctx, L, mode);

    // start blocks
    if (!winter) for (let i = 0; i < L.laneCount; i++) {
      const x = this.sx(-1.5);
      const y = this.groundY(i, mode) + 1;
      const w = Math.max(16, this.meter * 1.15);
      const bs = 0.82 + (i / Math.max(1, L.laneCount - 1)) * 0.24;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(bs, bs);
      // ground shadow
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(-w * 0.05, 1.5, w * 0.85, 3.2, 0, 0, TAU); ctx.fill();
      // base rail
      ctx.fillStyle = '#101a29';
      ctx.strokeStyle = 'rgba(190,208,232,.22)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-w * 0.62, 0); ctx.lineTo(w * 0.34, 0);
      ctx.lineTo(w * 0.28, -3); ctx.lineTo(-w * 0.58, -3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // pedal one
      ctx.fillStyle = '#182436';
      ctx.strokeStyle = 'rgba(247,201,80,.62)';
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -2); ctx.lineTo(-w * 0.16, -13);
      ctx.lineTo(-w * 0.06, -9); ctx.lineTo(-w * 0.4, 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // pedal two
      ctx.beginPath();
      ctx.moveTo(-w * 0.02, -2); ctx.lineTo(w * 0.32, -17);
      ctx.lineTo(w * 0.42, -13); ctx.lineTo(w * 0.1, 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // grip stripes
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 0.7;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.13 + k * 8, -11 + k * 2.2);
        ctx.lineTo(-w * 0.02 + k * 8, -8 + k * 2.2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawSnowboardGates(ctx, L, mode) {
    if (mode !== 'sprint') return;
    const gates = [18, 37, 56, 75, 92];
    for (let gi = 0; gi < gates.length; gi++) {
      const x = this.sx(gates[gi]);
      if (x < -30 || x > this.W + 30) continue;
      const warm = gi % 2 === 0;
      for (let lane = 0; lane < L.laneCount; lane++) {
        const y = this.groundY(lane, mode);
        const s = 0.8 + lane / L.laneCount * 0.3;
        ctx.save();
        ctx.globalAlpha = lane === this.playerLane ? 1 : 0.7;
        ctx.fillStyle = warm ? '#ff6a4d' : '#59c8ff';
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x, y - 18 * s);
        ctx.lineTo(x + 11 * s, y - 12 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x - 1, y - 20 * s, 1.4, 20 * s);
        ctx.restore();
      }
    }
  }

  drawSkiJumpHill(ctx, L) {
    const W = this.W, H = this.H;
    const top = L.top - L.laneH * 0.1;
    const bottom = L.bottom;
    const gy = this.groundY(1, 'skijump');
    const snow = ctx.createLinearGradient(0, top, 0, bottom);
    snow.addColorStop(0, '#c6e3ef');
    snow.addColorStop(0.45, '#e6f5fb');
    snow.addColorStop(1, '#a8cde0');
    ctx.fillStyle = snow;
    ctx.fillRect(0, top, W, bottom - top + H * 0.16);

    // distance arcs across the outrun
    ctx.save();
    for (let m = 50; m <= 150; m += 10) {
      const x = this.sx(40.5 + m);
      if (x < -30 || x > W + 30) continue;
      ctx.strokeStyle = m % 50 === 0 ? 'rgba(43,113,150,.4)' : 'rgba(43,113,150,.18)';
      ctx.lineWidth = m % 50 === 0 ? 1.3 : 0.7;
      ctx.beginPath();
      ctx.moveTo(x, gy - 4);
      ctx.lineTo(x, bottom + H * 0.1);
      ctx.stroke();
      if (m % 50 === 0) {
        ctx.fillStyle = 'rgba(28,78,104,.6)';
        ctx.font = `700 ${Math.max(7, H * 0.011)}px "Barlow Condensed", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${m}M`, x, bottom + H * 0.055);
      }
    }
    ctx.restore();

    // inrun ramp and takeoff lip
    const lipX = this.sx(40.5);
    const startX = this.sx(30);
    ctx.save();
    const ramp = ctx.createLinearGradient(0, gy - 18, 0, gy + 4);
    ramp.addColorStop(0, '#f2fbff');
    ramp.addColorStop(1, '#9cc4d6');
    ctx.fillStyle = ramp;
    ctx.beginPath();
    ctx.moveTo(startX, gy + 2);
    ctx.lineTo(lipX, gy - 5);
    ctx.lineTo(lipX, gy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,60,84,.5)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // takeoff markers
    ctx.fillStyle = '#f7c950';
    ctx.fillRect(lipX - 2, gy - 9, 4, 12);
    ctx.strokeStyle = 'rgba(247,201,80,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lipX, gy - 12); ctx.lineTo(lipX, gy + 8); ctx.stroke();
    ctx.fillStyle = 'rgba(28,78,104,.7)';
    ctx.font = `700 ${Math.max(7, H * 0.012)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('TAKE-OFF', lipX, gy - 18);
    // landing slope sheen
    const slope = ctx.createLinearGradient(lipX, 0, lipX + W * 0.55, 0);
    slope.addColorStop(0, 'rgba(255,255,255,.28)');
    slope.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = slope;
    ctx.fillRect(lipX, gy, W, bottom - gy);
    ctx.restore();

    // start gate
    const gateX = this.sx(29);
    if (gateX > -40 && gateX < W + 40) {
      ctx.save();
      ctx.fillStyle = '#17364c';
      ctx.fillRect(gateX - 2, gy - 34, 2.2, 34);
      ctx.fillStyle = '#ff6a4d';
      ctx.fillRect(gateX - 8, gy - 34, 14, 5);
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = `700 ${Math.max(6, H * 0.01)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('START', gateX, gy - 41);
      ctx.restore();
    }
  }

  drawCurlingSheet(ctx, L) {
    const W = this.W, H = this.H;
    const top = L.top - L.laneH * 0.08;
    const bottom = L.bottom;
    const gy = this.groundY(1, 'curling');
    const ice = ctx.createLinearGradient(0, top, 0, bottom);
    ice.addColorStop(0, '#b9dcea');
    ice.addColorStop(0.4, '#d8edf6');
    ice.addColorStop(0.72, '#c3e0ee');
    ice.addColorStop(1, '#8fb9cd');
    ctx.fillStyle = ice;
    ctx.fillRect(0, top, W, bottom - top + H * 0.09);
    // frost streaks
    ctx.save();
    ctx.globalAlpha = 0.16;
    const r = seeded(611);
    for (let i = 0; i < 60; i++) {
      const x = r() * W;
      const y = top + r() * (bottom - top);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.6 + r() * 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 + r() * 26, y - 1.5); ctx.stroke();
    }
    ctx.restore();
    // sheet edges
    ctx.strokeStyle = 'rgba(28,78,104,.55)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, bottom); ctx.lineTo(W, bottom); ctx.stroke();
    // centre line
    ctx.save();
    ctx.setLineDash([7, 7]);
    ctx.strokeStyle = 'rgba(28,78,104,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, gy + 2); ctx.lineTo(W, gy + 2); ctx.stroke();
    ctx.restore();
    // hog lines
    for (const hx of [9.5, 24]) {
      const x = this.sx(hx);
      if (x < -20 || x > W + 20) continue;
      ctx.strokeStyle = 'rgba(194,58,54,.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.lineTo(x, bottom - 4); ctx.stroke();
    }
    // hack at the near end
    const hackX = this.sx(2.2);
    if (hackX > -20 && hackX < W + 20) {
      ctx.save();
      ctx.fillStyle = '#20384a';
      ctx.fillRect(hackX - 4, gy - 4, 9, 6);
      ctx.fillStyle = '#33566e';
      ctx.fillRect(hackX - 2, gy - 8, 5, 5);
      ctx.restore();
    }
    // house rings at the far end
    const cx = this.sx(27.5);
    if (cx > -120 && cx < W + 120) {
      const rx = 2.3 * this.meter;
      const ry = Math.max(4, 0.62 * this.meter);
      const rings = [
        { k: 1, c: 'rgba(57,120,176,.85)' },
        { k: 0.72, c: 'rgba(246,250,253,.95)' },
        { k: 0.5, c: 'rgba(199,62,58,.9)' },
        { k: 0.28, c: 'rgba(246,250,253,.96)' },
        { k: 0.12, c: 'rgba(199,62,58,.95)' }
      ];
      ctx.save();
      for (const ring of rings) {
        ctx.fillStyle = ring.c;
        ctx.beginPath();
        ctx.ellipse(cx, gy + 2, rx * ring.k, ry * ring.k, 0, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(20,55,78,.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(cx, gy + 2, rx, ry, 0, 0, TAU); ctx.stroke();
      // target glow
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(cx, gy + 2, 0, cx, gy + 2, rx * 1.5);
      g.addColorStop(0, 'rgba(143,228,255,.16)');
      g.addColorStop(1, 'rgba(143,228,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(cx, gy + 2, rx * 1.5, ry * 1.8, 0, 0, TAU); ctx.fill();
      ctx.restore();
      // button marker
      ctx.fillStyle = 'rgba(246,250,253,.9)';
      ctx.beginPath(); ctx.ellipse(cx, gy + 2, 2.5, 1.4, 0, 0, TAU); ctx.fill();
    }
  }

  drawTrackMarks(ctx, L, mode) {
    const top = L.top, bottom = L.bottom;
    const W = this.W;
    const worldStart = Math.floor((this.camX - W / this.meter) / 5) * 5;
    const worldEnd = this.camX + W / this.meter + 5;
    for (let xw = worldStart; xw <= worldEnd; xw += 5) {
      if (xw < -10 || xw > 120) continue;
      const x = this.sx(xw);
      const major = xw % 10 === 0;
      if (!major && this.meter < 18) continue;
      ctx.strokeStyle = major ? 'rgba(246,239,222,.28)' : 'rgba(246,239,222,.12)';
      ctx.lineWidth = major ? 1.1 : 0.6;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      if (major && xw > 0 && xw < 100) {
        ctx.save();
        ctx.globalAlpha = 0.44;
        ctx.fillStyle = '#f5eddc';
        ctx.font = `600 ${Math.max(7, this.H * 0.011)}px "Barlow Condensed", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${xw}`, x, top + 5);
        ctx.restore();
      }
    }

    // start & finish
    const startX = this.sx(0);
    if (startX > -80 && startX < W + 80) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const sg = ctx.createLinearGradient(startX - 22, 0, startX + 22, 0);
      sg.addColorStop(0, 'rgba(255,247,220,0)');
      sg.addColorStop(0.5, 'rgba(255,247,220,.16)');
      sg.addColorStop(1, 'rgba(255,247,220,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(startX - 22, top, 44, bottom - top);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(startX, top); ctx.lineTo(startX, bottom); ctx.stroke();

    const finishX = this.sx(100);
    if (finishX > -50 && finishX < W + 50) {
      const cell = (bottom - top) / 10;
      for (let i = 0; i < 10; i++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (i + c) % 2 === 0 ? 'rgba(245,240,226,.82)' : 'rgba(14,20,30,.8)';
          ctx.fillRect(finishX - cell * 0.5 + c * cell * 0.5, top + i * cell, cell * 0.5, cell);
        }
      }
      ctx.save();
      ctx.fillStyle = 'rgba(247,201,80,.94)';
      ctx.font = `700 ${Math.max(10, this.H * 0.018)}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(247,201,80,.65)';
      ctx.shadowBlur = 12;
      ctx.fillText('FINISH', finishX, top + 18);
      ctx.restore();
    }
  }

  drawRunway(ctx, L, type) {
    const W = this.W;
    const top = L.top - L.laneH * 0.1;
    const bottom = L.bottom;
    const base = ctx.createLinearGradient(0, top, 0, bottom);
    base.addColorStop(0, '#4d1c1b');
    base.addColorStop(0.5, '#832f24');
    base.addColorStop(1, '#5f211b');
    ctx.fillStyle = base;
    ctx.fillRect(0, top, W, bottom - top);

    // runway lane lines
    for (let i = 0; i <= L.laneCount; i++) {
      const y = top + (i / L.laneCount) * (bottom - top);
      ctx.strokeStyle = 'rgba(244,238,225,.6)';
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = ctx.createPattern(this.trackNoise, 'repeat');
    ctx.fillRect(0, top, W, bottom - top);
    ctx.restore();

    // markings / distances
    const worldStart = Math.floor((this.camX - W / this.meter) / 5) * 5;
    const worldEnd = this.camX + W / this.meter + 8;
    for (let xw = worldStart; xw <= worldEnd; xw += 5) {
      if (xw < -5) continue;
      if (xw > 55) continue;
      const x = this.sx(xw);
      ctx.strokeStyle = xw % 10 === 0 ? 'rgba(246,239,222,.3)' : 'rgba(246,239,222,.14)';
      ctx.lineWidth = xw % 10 === 0 ? 1.1 : 0.65;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
      if (xw % 10 === 0 && xw <= 40) {
        ctx.save();
        ctx.globalAlpha = 0.58;
        ctx.fillStyle = '#f7efdd';
        ctx.font = `600 ${Math.max(7, this.H * 0.011)}px "Barlow Condensed", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`${xw}M`, x, top + 4);
        ctx.restore();
      }
    }

    if (type === 'longjump') {
      this.drawLongJumpPit(ctx, L);
    } else {
      this.drawJavelinRunway(ctx, L);
    }
  }

  drawLongJumpPit(ctx, L) {
    const W = this.W;
    const top = L.top - L.laneH * 0.1;
    const bottom = L.bottom;
    const boardX = this.sx(40);
    const pitEnd = this.sx(49);

    // takeoff zone before the board
    const zoneStart = this.sx(38.2);
    const zoneEnd = this.sx(39.8);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const zg = ctx.createLinearGradient(zoneStart, 0, zoneEnd, 0);
    zg.addColorStop(0, 'rgba(89,255,178,.02)');
    zg.addColorStop(0.35, 'rgba(89,255,178,.2)');
    zg.addColorStop(1, 'rgba(89,255,178,.32)');
    ctx.fillStyle = zg;
    ctx.fillRect(zoneStart, top, zoneEnd - zoneStart, bottom - top);
    ctx.strokeStyle = 'rgba(126,255,198,.65)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(zoneStart, top, zoneEnd - zoneStart, bottom - top);
    // chevrons
    ctx.strokeStyle = 'rgba(157,255,211,.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = zoneStart + (zoneEnd - zoneStart) * (0.18 + i * 0.2);
      ctx.beginPath(); ctx.moveTo(x - 5, top + 8); ctx.lineTo(x + 3, (top + bottom) / 2); ctx.lineTo(x - 5, bottom - 8); ctx.stroke();
    }
    ctx.restore();

    // sand pit
    const sand = ctx.createLinearGradient(0, top, 0, bottom);
    sand.addColorStop(0, '#7c6037');
    sand.addColorStop(0.4, '#b18b4e');
    sand.addColorStop(1, '#8f6c3b');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(boardX, top);
    ctx.lineTo(pitEnd, top + 3);
    ctx.lineTo(pitEnd, bottom + 2);
    ctx.lineTo(boardX, bottom);
    ctx.closePath();
    ctx.fill();
    // sand speckles
    const r = seeded(402);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(boardX, top); ctx.lineTo(pitEnd, top + 3); ctx.lineTo(pitEnd, bottom + 2); ctx.lineTo(boardX, bottom); ctx.closePath(); ctx.clip();
    for (let i = 0; i < 340; i++) {
      const x = boardX + r() * (pitEnd - boardX);
      const y = top + r() * (bottom - top);
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,222,157,.2)' : 'rgba(74,46,21,.24)';
      ctx.fillRect(x, y, 1 + r() * 2, 0.8 + r());
    }
    // light shadow at the front lip
    const lip = ctx.createLinearGradient(0, top, 0, bottom);
    lip.addColorStop(0, 'rgba(0,0,0,.18)');
    lip.addColorStop(0.15, 'rgba(0,0,0,0)');
    lip.addColorStop(1, 'rgba(0,0,0,.15)');
    ctx.fillStyle = lip;
    ctx.fillRect(boardX, top, pitEnd - boardX, bottom - top);
    ctx.restore();

    // board
    ctx.save();
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(boardX - 4 * this.u, top, 8 * this.u, bottom - top);
    ctx.fillStyle = 'rgba(247,201,80,.9)';
    ctx.fillRect(boardX - 1.2 * this.u, top, 2.4 * this.u, bottom - top);
    ctx.shadowColor = 'rgba(247,201,80,.85)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(255,236,170,.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(boardX, top); ctx.lineTo(boardX, bottom); ctx.stroke();
    ctx.restore();

    // pit edge lines
    ctx.strokeStyle = 'rgba(245,239,226,.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boardX, top, pitEnd - boardX, bottom - top);
  }

  drawJavelinRunway(ctx, L) {
    const top = L.top - L.laneH * 0.1;
    const bottom = L.bottom;
    const lineX = this.sx(36);
    // grass beyond the foul line (only in the ground area, never over the sky)
    ctx.fillStyle = '#0a3327';
    ctx.fillRect(lineX, top, this.W - lineX, this.H - top);
    // mowing stripes in the sector
    ctx.save();
    ctx.beginPath(); ctx.rect(lineX, this.H * 0.52, this.W, this.H * 0.46); ctx.clip();
    for (let i = -2; i < 10; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(70,152,103,.05)' : 'rgba(10,42,30,.03)';
      ctx.fillRect(lineX + i * 80 + (this.camX * 2) % 160, this.H * 0.52, 80, this.H * 0.46);
    }
    ctx.restore();
    // foul line
    ctx.save();
    ctx.shadowColor = 'rgba(255,90,70,.9)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = 'rgba(255,99,88,.95)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(lineX, top - 8); ctx.lineTo(lineX, bottom + 4); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,99,88,.65)';
    ctx.font = `700 ${Math.max(7, this.H * 0.012)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('FOUL LINE', lineX, top - 12);
    // distance arcs on the grass (subtle)
    ctx.save();
    ctx.strokeStyle = 'rgba(219,240,226,.1)';
    ctx.lineWidth = 1;
    for (let m = 40; m <= 90; m += 10) {
      const x = this.sx(m);
      ctx.beginPath();
      ctx.moveTo(x, this.H * 0.60);
      ctx.lineTo(x - 25, this.H * 0.82);
      ctx.stroke();
      ctx.fillStyle = 'rgba(219,240,226,.18)';
      ctx.font = `500 ${Math.max(6, this.H * 0.009)}px "Barlow Condensed", sans-serif`;
      ctx.fillText(`${m}M`, x - 14, this.H * 0.815);
    }
    ctx.restore();
  }

  drawJavelinField(ctx, L) {
    // javelin throw sector edge, behind the runner
    const W = this.W, H = this.H;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = '#d8f3e5';
    ctx.lineWidth = 1.2;
    const x = this.sx(36);
    ctx.beginPath();
    ctx.moveTo(x, H * 0.58);
    ctx.lineTo(x + W * 0.4, H * 0.56);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, H * 0.58);
    ctx.lineTo(x + W * 0.36, H * 0.84);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /*  FOREGROUND                                                         */
  /* ------------------------------------------------------------------ */
  drawAtmosphere(ctx) {
    const W = this.W, H = this.H;
    const winter = this.season === 'winter';
    // Warm haze around the track.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const haze = ctx.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, W * 0.6);
    if (winter) {
      haze.addColorStop(0, 'rgba(150,221,255,.055)');
      haze.addColorStop(0.5, 'rgba(110,180,230,.022)');
      haze.addColorStop(1, 'rgba(90,160,220,0)');
    } else {
      haze.addColorStop(0, 'rgba(255,175,110,.045)');
      haze.addColorStop(0.5, 'rgba(255,148,88,.018)');
      haze.addColorStop(1, 'rgba(255,130,80,0)');
    }
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Motes in the floodlight.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const m of this.motes) {
      const a = m.a * (0.55 + 0.45 * Math.sin(this.t * 0.8 + m.ph));
      ctx.fillStyle = winter ? `rgba(214,246,255,${a * 0.9})` : `rgba(255,225,177,${a})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y + Math.sin(this.t * 0.5 + m.ph) * 4, m.s, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (winter) {
      // Falling snow.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const count = this.W < 700 ? 34 : 62;
      for (let i = 0; i < count; i++) {
        const seed = i * 12.9898;
        const speed = 14 + (i % 7) * 5;
        const x = ((seed * 78.233 + this.t * (6 + (i % 5) * 4)) % (W + 60)) - 30;
        const y = ((seed * 31.17 + this.t * speed) % (H + 40)) - 20 + Math.sin(this.t * 0.9 + i) * 8;
        const s = 0.8 + (i % 4) * 0.55;
        ctx.fillStyle = `rgba(232,250,255,${0.22 + (i % 3) * 0.14})`;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // Foreground rail / blurred track edge.
    const bottom = this.H * 0.985;
    const fg = ctx.createLinearGradient(0, bottom - 22, 0, this.H);
    fg.addColorStop(0, 'rgba(3,7,14,0)');
    fg.addColorStop(0.5, 'rgba(3,7,14,.46)');
    fg.addColorStop(1, 'rgba(2,5,11,.92)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, bottom - 22, W, this.H - bottom + 22);
  }

  drawSpotlight(ctx, x, y, radius, strength = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(255,223,159,${0.19 * strength})`);
    g.addColorStop(0.25, `rgba(255,201,114,${0.095 * strength})`);
    g.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawMenuTouches(ctx) {
    // Sweeping ring of light behind the hero.
    const W = this.W, H = this.H;
    const x = W * 0.625, y = H * 0.47;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(x, y, 0, x, y, H * 0.43);
    g.addColorStop(0, 'rgba(255,205,105,.11)');
    g.addColorStop(0.33, 'rgba(255,185,85,.04)');
    g.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // orbital lines
    ctx.strokeStyle = 'rgba(247,201,80,.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, H * 0.77, H * 0.28, H * 0.035, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  drawCeremonyPodium(ctx, standings, playerId, t) {
    const W = this.W, H = this.H;
    const baseY = H * 0.875;
    const cx = W * 0.46;
    const totalW = Math.min(W * 0.48, 650 * this.u);
    const stepW = totalW / 3;
    const stepH = [H * 0.085, H * 0.13, H * 0.10];
    const order = [1, 0, 2]; // silver, gold, bronze on screen
    const byPlace = [standings[0], standings[1], standings[2]];
    const stepHeights = [H * 0.13, H * 0.09, H * 0.07];

    // glow behind podium
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glow = ctx.createRadialGradient(cx, baseY - H * 0.15, 0, cx, baseY - H * 0.15, W * 0.27);
    glow.addColorStop(0, 'rgba(255,216,130,.12)');
    glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // steps
    const stepOrder = [1, 0, 2];
    for (let k = 0; k < 3; k++) {
      const place = stepOrder[k]; // 1 silver left, 0 gold middle, 2 bronze right
      const sw = stepW * 0.94;
      const sh = stepHeights[place];
      const x = cx - totalW / 2 + k * stepW + (stepW - sw) / 2;
      const y = baseY - sh;
      const grad = ctx.createLinearGradient(x, y, x, baseY);
      if (place === 0) {
        grad.addColorStop(0, '#d8b452'); grad.addColorStop(0.25, '#7e6427'); grad.addColorStop(1, '#2d2515');
      } else if (place === 1) {
        grad.addColorStop(0, '#9aa5b4'); grad.addColorStop(0.3, '#566172'); grad.addColorStop(1, '#232a34');
      } else {
        grad.addColorStop(0, '#b8774d'); grad.addColorStop(0.3, '#6b3e29'); grad.addColorStop(1, '#2e1c15');
      }
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.lineWidth = 1;
      ctx.fillRect(x, y, sw, sh);
      ctx.strokeRect(x, y, sw, sh);
      ctx.fillStyle = 'rgba(255,255,255,.11)';
      ctx.fillRect(x + 5, y + 5, sw - 10, 2);
      // number
      ctx.fillStyle = 'rgba(255,255,255,.42)';
      ctx.font = `700 ${H * 0.028}px "Barlow Condensed", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(place + 1, x + sw / 2, y + sh * 0.5);
      // athlete
      const athlete = byPlace[place];
      if (athlete) {
        const scale = (place === 0 ? 1.55 : 1.38) * this.u;
        drawAthlete(ctx, {
          x: x + sw / 2,
          y: y + 1,
          scale,
          pose: place === 0 ? 'victory' : 'idle',
          phase: t * 0.9 + place,
          kit: athlete.kit,
          flip: false,
          shadow: 0.7,
          glow: place === 0 ? 0.2 : 0
        });
      }
    }
    // front lip
    ctx.fillStyle = 'rgba(2,6,12,.5)';
    ctx.fillRect(cx - totalW / 2, baseY, totalW, H - baseY);
    // gold confetti flecks on steps
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 20; i++) {
      const x = cx - totalW / 2 + ((i * 193 + 37) % totalW);
      const y = baseY - ((i * 53) % (H * 0.17));
      ctx.fillStyle = `rgba(247,201,80,${0.1 + (i % 5) * 0.04})`;
      ctx.fillRect(x, y, 2, 5);
    }
    ctx.restore();
  }

  addFirework(x, y) {
    this.fireworks.push({ x, y, life: 0, dur: 2.2 + rand() * 1.2, seed: Math.random() * 999 });
  }

  drawFireworks(ctx) {
    const W = this.W, H = this.H;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const fw of this.fireworks) {
      const p = fw.life / fw.dur;
      if (p > 1) continue;
      const r = seeded(Math.floor(fw.seed));
      const rad = (0.05 + p * 0.33) * Math.min(W, H);
      const alpha = Math.max(0, 1 - p);
      for (let i = 0; i < 18; i++) {
        const a = r() * TAU;
        const d = rad * (0.65 + r() * 0.35);
        const x = fw.x + Math.cos(a) * d;
        const y = fw.y + Math.sin(a) * d + p * p * H * 0.08;
        ctx.fillStyle = i % 3 === 0
          ? `rgba(247,201,80,${alpha * 0.8})`
          : `rgba(126,228,255,${alpha * 0.55})`;
        ctx.beginPath(); ctx.arc(x, y, 1.2 + r() * 1.6, 0, TAU); ctx.fill();
      }
      const core = ctx.createRadialGradient(fw.x, fw.y, 0, fw.x, fw.y, rad * 0.4);
      core.addColorStop(0, `rgba(255,245,200,${alpha * 0.22})`);
      core.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(fw.x, fw.y, rad * 0.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function H_(H, v) { return H * v; }
