import { clamp, lerp, rand, ordinal, fmtTime, fmtDist, rgba, TAU } from './utils.js';
import { StadiumWorld } from './world.js';
import { drawAthlete, KITS } from './athlete.js';
import { SoundEngine } from './audio.js';
import { SprintEvent, LongJumpEvent, JavelinEvent, SkiJumpEvent, CurlingEvent } from './events.js';

const AI_DATA = [
  { id: 'nakamura', name: 'K. NAKAMURA', code: 'JPN', kit: KITS.jpn, sprint: 9.79, longjump: 8.31, javelin: 83.5, hurdles: 12.25, shotput: 22.4, skijump: 136.5, snowboard: 9.98, curling: 28 },
  { id: 'moreau', name: 'L. MOREAU', code: 'FRA', kit: KITS.fra, sprint: 9.92, longjump: 7.84, javelin: 81.8, hurdles: 12.44, shotput: 21.2, skijump: 128.2, snowboard: 10.12, curling: 64 },
  { id: 'okafor', name: 'D. OKAFOR', code: 'NGA', kit: KITS.nga, sprint: 9.98, longjump: 8.44, javelin: 86.9, hurdles: 12.31, shotput: 22.8, skijump: 134.0, snowboard: 10.04, curling: 41 },
  { id: 'voss', name: 'S. VOSS', code: 'GER', kit: KITS.ger, sprint: 9.86, longjump: 8.10, javelin: 88.4, hurdles: 12.38, shotput: 23.1, skijump: 137.5, snowboard: 10.09, curling: 52 },
  { id: 'silva', name: 'E. SILVA', code: 'BRA', kit: KITS.bra, sprint: 10.08, longjump: 7.96, javelin: 79.6, hurdles: 12.51, shotput: 20.9, skijump: 125.4, snowboard: 10.24, curling: 85 },
  { id: 'hassan', name: 'M. HASSAN', code: 'KEN', kit: KITS.ken, sprint: 10.16, longjump: 7.62, javelin: 85.1, hurdles: 12.62, shotput: 21.8, skijump: 131.8, snowboard: 10.31, curling: 110 },
  { id: 'petrov', name: 'A. PETROV', code: 'CRO', kit: KITS.cro, sprint: 10.29, longjump: 8.22, javelin: 90.6, hurdles: 12.72, shotput: 23.4, skijump: 139.2, snowboard: 10.37, curling: 37 }
];

const PLAYER = { id: 'player', name: 'YOU', code: 'AUR', kit: KITS.player, player: true };

const EVENTS = {
  sprint: {
    id: 'sprint', season: 'summer', num: '01', name: '100M SPRINT', title: '100M<br/><em>SPRINT</em>',
    record: '9.63', recordUnit: 'SECONDS', champ: 'K. NAKAMURA', champCode: 'JPN',
    desc: 'Explode from the blocks. Alternate left and right strikes to drive your cadence, then hold top speed all the way through the line.',
    controls: [
      { keys: ['A', 'D'], label: 'ALTERNATE TAPS' },
      { keys: ['GUN'], label: 'GO ON THE BANG' },
      { keys: ['CADENCE'], label: 'FAST + CLEAN' }
    ],
    unit: 's', format: 'time', lower: true, mode: 'sprint', hud: 'sprint',
    glyph: '⟶', blurb: 'Explosive power · 10 seconds'
  },
  longjump: {
    id: 'longjump', season: 'summer', num: '02', name: 'LONG JUMP', title: 'LONG<br/><em>JUMP</em>',
    record: '8.95', recordUnit: 'METRES', champ: 'D. OKAFOR', champCode: 'NGA',
    desc: 'The runway is automatic. Tap as you enter the glowing takeoff zone, then tap again at the top of the flight to stretch your landing.',
    controls: [
      { keys: ['SPACE'], label: 'TAKE OFF' },
      { keys: ['SPACE'], label: 'EXTEND AT APEX' },
      { keys: ['BOARD'], label: 'DON’T OVERSTEP' }
    ],
    unit: 'm', format: 'dist', lower: false, mode: 'longjump', hud: 'field',
    glyph: '⌁', blurb: 'Runway timing · one leap'
  },
  javelin: {
    id: 'javelin', season: 'summer', num: '03', name: 'JAVELIN', title: 'JAVE<br/><em>LIN</em>',
    record: '98.48', recordUnit: 'METRES', champ: 'A. PETROV', champCode: 'CRO',
    desc: 'Release the spear as close to the foul line as you dare. Time the tap while the arm angle is in the gold band around 36 degrees.',
    controls: [
      { keys: ['SPACE'], label: 'RELEASE' },
      { keys: ['36°'], label: 'PERFECT ANGLE' },
      { keys: ['LINE'], label: 'MAXIMUM POWER' }
    ],
    unit: 'm', format: 'dist', lower: false, mode: 'javelin', hud: 'javelin',
    glyph: '╱', blurb: 'Angle & release · big air'
  },
  hurdles: {
    id: 'hurdles', season: 'summer', num: '04', name: '100M HURDLES', title: '100M<br/><em>HURDLES</em>',
    record: '12.12', recordUnit: 'SECONDS', champ: 'M. HASSAN', champCode: 'KEN',
    desc: 'Ten barriers, no margin for error. Keep the left-right rhythm flying and carry your speed cleanly over every hurdle.',
    controls: [
      { keys: ['A', 'D'], label: 'ALTERNATE TAPS' },
      { keys: ['10'], label: 'HURDLES TO CLEAR' },
      { keys: ['PACE'], label: 'STAY TALL' }
    ],
    unit: 's', format: 'time', lower: true, mode: 'sprint', hud: 'sprint',
    glyph: '⊓', blurb: 'Ten barriers · pure rhythm'
  },
  shotput: {
    id: 'shotput', season: 'summer', num: '05', name: 'SHOT PUT', title: 'SHOT<br/><em>PUT</em>',
    record: '23.37', recordUnit: 'METRES', champ: 'S. VOSS', champCode: 'GER',
    desc: 'Build speed into the circle, then release the metal ball at the perfect 42-degree arc. Power without control goes nowhere.',
    controls: [
      { keys: ['SPACE'], label: 'PUT THE SHOT' },
      { keys: ['42°'], label: 'PERFECT ARC' },
      { keys: ['LINE'], label: 'STAY IN THE CIRCLE' }
    ],
    unit: 'm', format: 'dist', lower: false, mode: 'javelin', hud: 'field',
    glyph: '●', blurb: 'Raw power · 42-degree arc'
  },
  skijump: {
    id: 'skijump', season: 'winter', num: '01', name: 'SKI JUMP', title: 'SKI<br/><em>JUMP</em>',
    record: '142.5', recordUnit: 'METRES', champ: 'A. PETROV', champCode: 'CRO',
    desc: 'Ride the in-run, launch off the lip and hold your line in the air. Tap again at the apex to stretch the jump down the hill.',
    controls: [
      { keys: ['SPACE'], label: 'LAUNCH' },
      { keys: ['SPACE'], label: 'EXTEND AT APEX' },
      { keys: ['LIP'], label: 'PERFECT TIMING' }
    ],
    unit: 'm', format: 'dist', lower: false, mode: 'skijump', hud: 'field',
    glyph: '⛷', blurb: 'Launch, glide, fly · big air'
  },
  snowboard: {
    id: 'snowboard', season: 'winter', num: '02', name: 'SNOWBOARD X', title: 'SNOW<br/><em>BOARD X</em>',
    record: '9.84', recordUnit: 'SECONDS', champ: 'E. SILVA', champCode: 'BRA',
    desc: 'A full-gas boardercross sprint. Alternate your edges, stay low over the rollers and explode through the finish gate.',
    controls: [
      { keys: ['A', 'D'], label: 'ALTERNATE EDGES' },
      { keys: ['GUN'], label: 'GO ON THE BANG' },
      { keys: ['LOW'], label: 'STAY AERO' }
    ],
    unit: 's', format: 'time', lower: true, mode: 'sprint', hud: 'sprint',
    glyph: '⌁', blurb: 'Boardercross · edge to edge'
  },
  curling: {
    id: 'curling', season: 'winter', num: '03', name: 'CURLING', title: 'CURL<br/><em>ING</em>',
    record: '0', recordUnit: 'CENTIMETRES', champ: 'K. NAKAMURA', champCode: 'JPN',
    desc: 'Judge the weight, release the stone and sweep it into the house. The closer you finish to the button, the higher you climb.',
    controls: [
      { keys: ['SPACE'], label: 'RELEASE THE STONE' },
      { keys: ['SPACE'], label: 'SWEEP FOR EXTRA WEIGHT' },
      { keys: ['BUTTON'], label: 'FINISH ON THE CENTRE' }
    ],
    unit: 'cm', format: 'cm', lower: true, mode: 'curling', hud: 'field',
    glyph: '◎', blurb: 'Weight, line & sweep · precision'
  }
};

const SUMMER_EVENTS = ['sprint', 'longjump', 'javelin', 'hurdles', 'shotput'];
const WINTER_EVENTS = ['skijump', 'snowboard', 'curling'];
const seasonEvents = season => season === 'winter' ? WINTER_EVENTS : SUMMER_EVENTS;

class Particles {
  constructor() { this.list = []; }
  spawn(o) {
    if (this.list.length > 900) this.list.shift();
    const life = o.life ?? 0.7;
    this.list.push({
      x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0,
      life, maxLife: life, size: o.size ?? 2, color: o.color ?? '#fff',
      gravity: o.gravity ?? 0, drag: o.drag ?? 0, shape: o.shape ?? 'circle',
      rot: o.rot ?? 0, vr: o.vr ?? 0, alpha: o.alpha ?? 1
    });
  }
  burst(x, y, count, color, speed = 120, life = 0.7, gravity = 160) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const v = speed * rand(0.25, 1);
      this.spawn({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(0, 45),
        life: life * rand(0.55, 1.2), size: rand(1, 3.5), color,
        gravity, drag: 0.8, alpha: rand(0.35, 0.9)
      });
    }
  }
  confetti(n = 60, W, H) {
    const colors = ['#f7c950', '#f7f1dc', '#80e5ff', '#d9a42c', '#ff7766', '#75e3a4'];
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: rand(0, W), y: rand(-H * 0.2, H * 0.1),
        vx: rand(-45, 45), vy: rand(50, 190), life: rand(2.5, 5),
        size: rand(2, 5.5), color: colors[Math.floor(rand(0, colors.length))],
        gravity: 28, drag: 0.1, shape: 'confetti', rot: rand(0, TAU), vr: rand(-8, 8), alpha: rand(0.6, 1)
      });
    }
  }
  clear() { this.list.length = 0; }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      if (p.drag) {
        const d = Math.exp(-p.drag * dt);
        p.vx *= d; p.vy *= d;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      const a = clamp(p.life / p.maxLife, 0, 1) * p.alpha;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      if (p.shape === 'confetti') {
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 1.4, p.size, p.size * 2.8);
      } else if (p.shape === 'streak') {
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size * 2.5, -p.size * 0.4, p.size * 5, p.size * 0.8);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.3, p.size * (0.4 + a * 0.6)), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.world = new StadiumWorld();
    this.sound = new SoundEngine();
    this.particles = new Particles();
    this.roster = [PLAYER, ...AI_DATA.map(a => ({ ...a }))];
    this.playerKit = KITS.player;
    this.state = 'menu';
    this.paused = false;
    this.season = localStorage.getItem('olympia-season') === 'winter' ? 'winter' : 'summer';
    this.forceTouch = new URLSearchParams(location.search).get('touch') === '1';
    this.touch = this.forceTouch || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
    this.isTablet = false;
    this.menuT = 0;
    this.shake = 0;
    this.hudData = null;
    this.miniData = null;
    this.miniMeta = '';
    this.miniTimer = 0;
    this.countdown = null;
    this.falseStartTimer = 0;
    this.goHideTimer = 0;
    this.currentEvent = null;
    this.currentEventId = null;
    this.series = null;
    this.fields = null;
    this.pending = null;
    this.lastEvent = null;
    this.resultsMode = null;
    this.ceremonyT = 0;
    this.lastFirework = 0;
    this.miniPulse = 0;
    this.toastTimer = null;
    this.flashTimer = null;
    this.hideTimer = null;
    this.bests = this.loadBests();
    this.scoreBest = Number(localStorage.getItem('olympia-best-score') || 0) || 0;
    this.bind();
    this.resize();
    this.setSoundUi();
    this.updateSeasonUi();
    this.updateMenuBest();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    // A gentle trail of dust makes the opening frame feel alive immediately.
    this.menuSpawnAcc = 0;
  }

  /* ---------------------------------------------------------------- */
  loadBests() {
    try {
      return JSON.parse(localStorage.getItem('olympia-bests') || '{}') || {};
    } catch { return {}; }
  }
  saveBests() {
    localStorage.setItem('olympia-bests', JSON.stringify(this.bests));
  }
  markLabel(id, value) {
    const meta = EVENTS[id];
    if (!meta) return '—';
    if (meta.format === 'time') return `${fmtTime(value)}s`;
    if (meta.format === 'cm') return `${Math.round(value)}cm`;
    return `${fmtDist(value)}m`;
  }
  updateMenuBest() {
    for (const id of Object.keys(EVENTS)) {
      const el = document.getElementById(`pb-${id}`);
      if (!el) continue;
      const v = this.bests[id];
      el.textContent = v ? `PB ${this.markLabel(id, v)}` : 'PB —';
    }
    const best = document.getElementById('menuBest');
    if (best) best.textContent = this.scoreBest ? `${this.scoreBest} PTS` : '—';
  }

  updateSeasonUi() {
    const winter = this.season === 'winter';
    document.body.classList.toggle('season-winter', winter);
    const label = document.getElementById('seasonLabel');
    const alt = document.getElementById('seasonAlt');
    if (label) label.textContent = winter ? 'WINTER GAMES' : 'SUMMER GAMES';
    if (alt) alt.textContent = winter ? 'SWITCH TO SUMMER ☀' : 'SWITCH TO WINTER ❄';
    const sub = document.querySelector('.subword');
    if (sub) sub.innerHTML = winter ? '<b>SNOW</b><i>&amp;</i><b>ICE</b>' : '<b>TRACK</b><i>&amp;</i><b>FIELD</b>';
    const tagline = document.querySelector('.tagline');
    if (tagline) tagline.innerHTML = winter
      ? 'Three winter finals. Eight athletes. One shot at the podium.<br/>Chase gold on snow and ice.'
      : 'Five events. Eight athletes. One shot at the podium.<br/>Chase gold under the lights.';
    const hero = document.querySelector('.eyebrow');
    if (hero) hero.innerHTML = `<span>2026</span> THE GOLDEN SERIES <i></i> ${winter ? 'WINTER SESSION' : 'NIGHT SESSION'}`;
    const topCenter = document.querySelector('.topbar-center');
    if (topCenter) topCenter.innerHTML = `<span class="live-dot"></span> WORLD OLYMPIC GAMES <span class="slash">/</span> ${winter ? 'SAPPORO 2026' : 'PARIS 2026'}`;
    const startLabel = document.querySelector('[data-action="start-series"] .btn-label');
    if (startLabel) startLabel.innerHTML = `<small>BEGIN THE</small>${winter ? 'WINTER CAMPAIGN' : 'OLYMPIC CAMPAIGN'}`;
    const practiceLabel = document.querySelector('[data-action="practice"] .btn-label');
    if (practiceLabel) practiceLabel.innerHTML = `<small>MASTER THE</small>EVENT PRACTICE`;
    const facts = document.querySelector('.campaign-facts');
    if (facts) {
      const evs = seasonEvents(this.season);
      facts.innerHTML = `<div><b>${String(evs.length).padStart(2, '0')}</b><span>EVENTS</span></div>
        <div><b>08</b><span>ATHLETES</span></div>
        <div><b>${evs.length * 8}</b><span>POINTS MAX</span></div>
        <div class="pb-fact"><b id="menuBest">${this.scoreBest ? `${this.scoreBest} PTS` : '—'}</b><span>YOUR BEST</span></div>`;
    }
    const ticker = document.querySelector('.ticker-track');
    if (ticker) ticker.innerHTML = winter
      ? '<span>WELCOME TO OLYMPIA WINTER PARK</span><span>SKI JUMP • SNOWBOARD X • CURLING</span><span>THE WINTER SESSION BEGINS</span><span>CHASE THE GOLD</span>'
      : '<span>WELCOME TO OLYMPIA STADIUM</span><span>100M • LONG JUMP • JAVELIN • HURDLES • SHOT PUT</span><span>THE NIGHT SESSION BEGINS</span><span>CHASE THE GOLD</span>';
    this.refreshEventLists();
  }

  refreshEventLists() {
    const list = seasonEvents(this.season);
    const programme = document.getElementById('programmeList');
    if (programme) {
      programme.innerHTML = list.map(id => {
        const e = EVENTS[id];
        return `<button class="programme-row" data-action="programme" data-event="${id}">
          <span class="prog-num">${e.num}</span>
          <span class="prog-icon">${e.glyph}</span>
          <span class="prog-copy"><b>${e.name}</b><small>${e.blurb}</small></span>
          <span class="prog-best" id="pb-${id}">PB —</span>
          <span class="prog-arrow">↗</span>
        </button>`;
      }).join('');
    }
    const grid = document.getElementById('practiceGrid');
    if (grid) {
      grid.innerHTML = list.map(id => {
        const e = EVENTS[id];
        return `<button class="practice-card" data-action="practice-event" data-event="${id}">
          <span class="practice-index">${e.num}</span>
          <span class="practice-glyph">${e.glyph}</span>
          <b>${e.name}</b>
          <small>${e.blurb}</small>
          <span class="practice-go">ENTER EVENT <i>↗</i></span>
        </button>`;
      }).join('');
    }
    const status = document.querySelector('.programme-status');
    if (status) status.textContent = this.season === 'winter' ? 'WINTER FINAL' : 'FINAL';
    const foot = document.querySelector('.programme-foot');
    if (foot) foot.innerHTML = `<span>${this.season === 'winter' ? 'WINTER SESSION' : 'NIGHT SESSION'}</span><span>${this.season === 'winter' ? 'SAPPORO 2026' : 'PARIS 2026'}</span>`;
    const pfoot = document.querySelector('.practice-panel .panel-sub');
    if (pfoot) pfoot.textContent = this.season === 'winter'
      ? 'Snow, ice and a little bit of nerve.'
      : 'No pressure. Just you, the crowd, and the clock.';
    this.updateMenuBest();
  }

  toggleSeason() {
    this.sound.init();
    this.season = this.season === 'winter' ? 'summer' : 'winter';
    localStorage.setItem('olympia-season', this.season);
    this.sound.ui();
    if (this.state !== 'menu' && this.state !== 'guide') this.showMenu();
    this.updateSeasonUi();
    this.toast(this.season === 'winter' ? 'WINTER GAMES — SNOW & ICE' : 'SUMMER GAMES — TRACK & FIELD', 'gold', 1600);
  }

  /* ---------------------------------------------------------------- */
  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.world.resize(this.W, this.H);
    this.isTablet = this.touch && this.W >= 821;
    document.body.classList.toggle('is-touch', this.touch);
    document.body.classList.toggle('is-tablet', this.isTablet);
  }

  /* ---------------------------------------------------------------- */
  bind() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 80));
    window.addEventListener('keydown', e => this.onKey(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'running' && !this.paused) this.openPause();
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.preventDefault();
      this.sound.init();
      this.onAction(btn.dataset.action, btn.dataset.event, btn);
    });

    document.querySelectorAll('[data-tap]').forEach(btn => {
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.sound.init();
        this.handleDirectional(btn.dataset.tap);
      });
    });

    const actionBtn = document.getElementById('actionBtn');
    if (actionBtn) {
      actionBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        this.sound.init();
        this.handleAction();
      });
    }

    document.addEventListener('contextmenu', e => {
      if (e.target.closest('#app')) e.preventDefault();
    });
  }

  onAction(action, eventId) {
    switch (action) {
      case 'start-series':
        this.sound.ui();
        this.startSeries();
        break;
      case 'toggle-season':
        this.toggleSeason();
        break;
      case 'practice':
        this.sound.ui();
        this.openPractice();
        break;
      case 'close-practice':
        this.sound.uiBack();
        document.getElementById('practiceMenu').classList.remove('is-active');
        break;
      case 'practice-event':
        this.sound.ui();
        this.startPractice(eventId);
        break;
      case 'enter-event':
        this.sound.ui();
        this.enterEvent();
        break;
      case 'pause':
        this.openPause();
        break;
      case 'resume':
        this.resume();
        break;
      case 'restart-event':
        this.restartEvent();
        break;
      case 'quit-event':
        this.quitEvent();
        break;
      case 'guide':
        this.openGuide();
        break;
      case 'close-guide':
        this.closeGuide();
        break;
      case 'sound':
        this.toggleSound();
        break;
      case 'results-next':
        this.onResultsNext();
        break;
      case 'results-replay':
        this.onResultsReplay();
        break;
      case 'to-menu':
        this.showMenu();
        break;
      case 'restart-series':
        this.sound.ui();
        this.startSeries();
        break;
      case 'programme':
        this.sound.ui();
        this.startPractice(eventId);
        break;
      default:
        break;
    }
  }

  onKey(e) {
    const key = e.key;
    const lower = key.toLowerCase();
    this.sound.init();
    if (key === 'Escape') {
      if (document.getElementById('guide').classList.contains('is-active')) { this.closeGuide(); return; }
      if (this.paused) { this.resume(); return; }
      if (this.state === 'running') { this.openPause(); return; }
      if (document.getElementById('practiceMenu').classList.contains('is-active')) {
        document.getElementById('practiceMenu').classList.remove('is-active');
      }
      return;
    }
    if (this.paused && (lower === 'r')) { this.restartEvent(); return; }
    if (this.state === 'running' && this.currentEvent) {
      if (EVENTS[this.currentEventId]?.hud === 'sprint') {
        if (lower === 'a' || key === 'ArrowLeft') { e.preventDefault(); this.handleDirectional('left'); }
        if (lower === 'd' || key === 'ArrowRight') { e.preventDefault(); this.handleDirectional('right'); }
      } else if (key === ' ' || lower === 'j') {
        e.preventDefault();
        if (!e.repeat) this.handleAction();
      }
    } else if (this.state === 'countdown') {
      if (EVENTS[this.currentEventId]?.hud === 'sprint' && (lower === 'a' || lower === 'd' || key === 'ArrowLeft' || key === 'ArrowRight' || key === ' ')) {
        e.preventDefault();
        this.onFalseStartInput();
      }
    }
    if (key === ' ' && this.state === 'countdown') e.preventDefault();
  }

  toggleSound() {
    this.sound.init();
    this.sound.setMuted(!this.sound.muted);
    this.setSoundUi();
    if (!this.sound.muted) this.sound.ui();
  }
  setSoundUi() {
    const btn = document.getElementById('soundBtn');
    if (!btn) return;
    btn.classList.toggle('is-muted', this.sound.muted);
    btn.setAttribute('aria-label', this.sound.muted ? 'Enable sound' : 'Mute sound');
  }

  /* ---------------------------------------------------------------- */
  startSeries() {
    this.closeAllOverlays();
    this.sound.init();
    this.fields = null;
    this.ensureFields();
    this.series = {
      index: 0,
      season: this.season,
      list: [...seasonEvents(this.season)],
      totals: Object.fromEntries(this.roster.map(a => [a.id, 0])),
      golds: Object.fromEntries(this.roster.map(a => [a.id, 0])),
      silvers: Object.fromEntries(this.roster.map(a => [a.id, 0])),
      bronzes: Object.fromEntries(this.roster.map(a => [a.id, 0])),
      events: []
    };
    this.pending = { type: 'series' };
    this.showIntro(this.series.list[0]);
  }

  startPractice(id) {
    this.closeAllOverlays();
    this.sound.init();
    this.fields = null;
    this.ensureFields();
    this.series = null;
    this.pending = { type: 'practice', id };
    this.showIntro(id);
  }

  openPractice() {
    if (this.state !== 'menu') return;
    document.getElementById('practiceMenu').classList.add('is-active');
  }

  showIntro(id) {
    this.state = 'intro';
    this.currentEventId = id;
    this.paused = false;
    this.sound.setCrowd(0.018);
    this.hideScreens();
    const intro = document.getElementById('eventIntro');
    intro.classList.add('is-active');
    const meta = EVENTS[id];
    const list = seasonEvents(meta.season);
    const isPractice = this.pending?.type === 'practice';
    document.getElementById('introNumber').textContent = meta.num;
    document.getElementById('introKicker').textContent = `EVENT ${meta.num} / ${String(list.length).padStart(2, '0')} · ${isPractice ? 'PRACTICE' : 'FINAL'}`;
    document.getElementById('introTitle').innerHTML = meta.title;
    document.getElementById('introDesc').textContent = meta.desc;
    document.getElementById('introRecord').textContent = meta.record;
    document.getElementById('introChamp').textContent = meta.champ;
    document.getElementById('introControls').innerHTML = meta.controls.map(c => `
      <div class="intro-control"><span>${c.keys.map(k => `<kbd>${k}</kbd>`).join('')}</span>${c.label}</div>
    `).join('');
    document.getElementById('introBtnLabel').textContent = isPractice ? 'START PRACTICE' : 'TAKE YOUR POSITION';
    this.setHudMode(id, isPractice);
    this.currentEvent = this.makeEvent(id);
  }

  makeEvent(id) {
    this.ensureFields();
    const options = { practice: this.pending?.type === 'practice' };
    if (id === 'sprint') return new SprintEvent(this, options);
    if (id === 'hurdles') return new SprintEvent(this, { ...options, id: 'hurdles', hurdles: [13, 23, 33, 43, 53, 63, 73, 83, 93, 99], distanceScale: 0.82 });
    if (id === 'snowboard') return new SprintEvent(this, { ...options, id: 'snowboard', board: true, spray: true });
    if (id === 'longjump') return new LongJumpEvent(this, options);
    if (id === 'javelin') return new JavelinEvent(this, options);
    if (id === 'shotput') return new JavelinEvent(this, { ...options, id: 'shotput', optAngle: 42, angleAmp: 9, base: 12.4, span: 11.7, max: 24.1 });
    if (id === 'skijump') return new SkiJumpEvent(this, options);
    return new CurlingEvent(this, options);
  }

  enterEvent() {
    if (this.state !== 'intro') return;
    this.hideScreens();
    this.sound.init();
    this.state = 'countdown';
    const id = this.currentEventId;
    const isDash = EVENTS[id].hud === 'sprint';
    this.countdown = {
      t: 0,
      step: 0,
      id,
      sprint: isDash,
      done: false
    };
    const cd = document.getElementById('countdown');
    cd.classList.add('is-active');
    const stage = document.getElementById('countdownStage');
    stage.classList.add('is-on');
    if (isDash) {
      this.setCountdown('ON YOUR MARKS', 'WAIT FOR THE GUN', '');
    } else if (id === 'curling') {
      this.setCountdown('ON THE HACK', 'JUDGE THE WEIGHT', '');
    } else {
      this.setCountdown('READY', id === 'skijump' ? 'THE IN-RUN IS YOURS' : 'THE RUNWAY IS YOURS', '');
    }
    this.sound.countBeep(false);
  }

  setCountdown(word, sub, cls = '') {
    const w = document.getElementById('countdownWord');
    const s = document.getElementById('countdownSub');
    if (!w) return;
    w.textContent = word;
    w.className = `countdown-word ${cls}`;
    s.textContent = sub;
  }

  updateCountdown(dt) {
    const c = this.countdown;
    if (!c) return;
    c.t += dt;
    if (c.sprint) {
      if (c.step === 0 && c.t > 1.02) {
        c.step = 1;
        this.setCountdown('SET', 'STEADY · DO NOT JUMP THE GUN', 'set');
        this.sound.countBeep(true);
      } else if (c.step === 1 && c.t > 1.95) {
        c.step = 2;
        this.fireGun();
      }
    } else {
      if (c.step === 0 && c.t > 0.88) {
        c.step = 1;
        this.setCountdown('SET', 'EYES ON THE LINE', 'set');
        this.sound.countBeep(true);
      } else if (c.step === 1 && c.t > 1.58) {
        c.step = 2;
        this.fireGo();
      }
    }
  }

  fireGun() {
    this.sound.gun();
    this.flashScreen(0.85);
    this.shake = 12;
    this.setCountdown('GO', 'DRIVE OUT OF THE BLOCKS', 'go');
    this.startRunning();
    this.goHideTimer = 0.5;
  }

  fireGo() {
    this.sound.tone(740, 0.18, 0.07, 'sine', 1050);
    this.setCountdown('GO', this.currentEventId === 'curling' ? 'SEND THE STONE' : this.currentEventId === 'skijump' ? 'DROP INTO THE IN-RUN' : 'ATTACK THE RUNWAY', 'go');
    this.flashScreen(0.28);
    this.shake = 5;
    this.startRunning();
    this.goHideTimer = 0.42;
  }

  startRunning() {
    if (!this.currentEvent) return;
    this.state = 'running';
    this.showHUD();
    this.currentEvent.start();
    this.sound.setCrowd(0.027);
  }

  onFalseStartInput() {
    if (this.state !== 'countdown' || !this.countdown || this.countdown.step < 1) return;
    this.state = 'false-start';
    this.falseStartTimer = 0;
    this.setCountdown('FALSE START', 'RESETTING THE BLOCKS · STAY STILL', 'false');
    this.sound.falseStart();
    this.flashScreen(0.35);
    this.shake = 8;
    document.getElementById('countdown').classList.add('is-hot');
    setTimeout(() => document.getElementById('countdown').classList.remove('is-hot'), 420);
  }

  updateFalseStart(dt) {
    this.falseStartTimer += dt;
    if (this.falseStartTimer > 1.65) {
      this.state = 'countdown';
      this.countdown = { t: 0, step: 0, id: this.currentEventId, sprint: true, done: false };
      this.setCountdown('ON YOUR MARKS', 'WAIT FOR THE GUN', '');
      this.sound.countBeep(false);
    }
  }

  hideCountdown() {
    document.getElementById('countdown').classList.remove('is-active');
    document.getElementById('countdownStage').classList.remove('is-on');
  }

  /* ---------------------------------------------------------------- */
  handleDirectional(side) {
    if (this.state === 'countdown' && EVENTS[this.currentEventId]?.hud === 'sprint') {
      this.onFalseStartInput();
      return;
    }
    if (this.state !== 'running' || !this.currentEvent) return;
    if (EVENTS[this.currentEventId]?.hud !== 'sprint') return;
    this.currentEvent.tap(side);
  }

  handleAction() {
    if (this.state !== 'running' || !this.currentEvent) return;
    if (EVENTS[this.currentEventId]?.hud === 'sprint') return;
    this.currentEvent.tap();
  }

  tapFlash(side) {
    const btn = document.querySelector(`.tap-btn[data-tap="${side}"]`);
    if (btn) {
      btn.classList.add('is-hit');
      setTimeout(() => btn.classList.remove('is-hit'), 90);
    }
  }

  /* ---------------------------------------------------------------- */
  paintWorld(mode, opts = {}) {
    const ctx = this.ctx;
    const w = this.world;
    w.season = this.season;
    const viewMode = this.currentEvent?.worldMode || mode;
    w.mode = viewMode;
    if (mode === 'ceremony') {
      // Camera is owned by renderCeremony; do not overwrite it with the event.
    } else if (this.currentEvent) {
      w.setCamera(this.currentEvent.camX, this.currentEvent.meter, this.currentEvent.anchor, viewMode);
    } else if (mode === 'menu') {
      w.setCamera(8 + Math.sin(this.menuT * 0.07) * 1.4, clamp(this.W / 24, 16, 54), 0.42, mode);
    } else {
      w.setCamera(12, clamp(this.W / 24, 16, 54), 0.42, viewMode);
    }
    w.playerLane = this.currentEvent?.playerLane ?? 3;
    w.drawSky(ctx, { mode });
    w.drawCity(ctx);
    w.drawRoof(ctx);
    w.drawCrowd(ctx);
    w.drawJumbotron(ctx, { ...(opts.jumbo || {}), mode });
    w.drawLedRibbon(ctx, { ribbon: opts.ribbon });
    w.drawGround(ctx, { mode });
    w.drawFloodlights(ctx);
    w.drawAtmosphere(ctx);
  }

  render() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    const shake = this.shake;
    ctx.save();
    if (shake > 0.15) {
      ctx.translate(rand(-shake, shake) * 0.55, rand(-shake, shake) * 0.4);
    }

    if (this.state === 'menu' || (this.state === 'guide')) {
      this.renderMenu();
    } else if (this.state === 'intro') {
      if (this.currentEvent) this.currentEvent.render(ctx);
    } else if (this.state === 'countdown' || this.state === 'false-start' || this.state === 'running' || this.state === 'results' || this.paused) {
      if (this.currentEvent) this.currentEvent.render(ctx);
    } else if (this.state === 'ceremony') {
      this.renderCeremony();
    } else {
      this.renderMenu();
    }
    ctx.restore();

    this.particles.draw(ctx);

    if (this.state === 'ceremony') {
      this.world.drawFireworks(ctx);
    }
    if (!this.wasAnimating) this.wasAnimating = true;
  }

  renderMenu() {
    const ctx = this.ctx;
    this.paintWorld('menu', {
      jumbo: { top: 'OLYMPIA', big: 'OLYMPIA', sub: this.season === 'winter' ? 'WINTER SESSION' : 'NIGHT SESSION', value: this.season === 'winter' ? 'SAPPORO' : '20:26' }
    });
    const portrait = this.W < 760;
    const hx = this.W * (portrait ? 0.75 : 0.61);
    const gy = this.H * (portrait ? 0.80 : 0.815);
    const scale = clamp(this.H * (portrait ? 0.00205 : 0.00255), 1.2, 2.45);
    this.world.drawSpotlight(ctx, hx, gy - this.H * 0.22, this.H * (portrait ? 0.32 : 0.42), 1.05);
    // eclipse ring
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ring = ctx.createRadialGradient(hx, gy - this.H * 0.24, this.H * 0.12, hx, gy - this.H * 0.24, this.H * 0.34);
    ring.addColorStop(0, 'rgba(255,214,122,0)');
    ring.addColorStop(0.82, 'rgba(255,205,100,.022)');
    ring.addColorStop(1, 'rgba(255,205,100,0)');
    ctx.fillStyle = ring;
    ctx.fillRect(hx - this.H * 0.4, gy - this.H * 0.62, this.H * 0.8, this.H * 0.8);
    ctx.restore();
    drawAthlete(ctx, {
      x: hx, y: gy, scale,
      phase: this.menuT * 0.78,
      pose: 'victory',
      speed: 0,
      kit: KITS.player,
      flip: true,
      glow: 0.4,
      shadow: 1.15
    });
    // A slim golden light rim on the floor.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const floor = ctx.createRadialGradient(hx, gy + 4, 0, hx, gy + 4, 110 * scale);
    floor.addColorStop(0, 'rgba(247,201,80,.12)');
    floor.addColorStop(1, 'rgba(247,201,80,0)');
    ctx.fillStyle = floor;
    ctx.beginPath(); ctx.ellipse(hx, gy + 4, 110 * scale, 13 * scale, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  renderCeremony() {
    const ctx = this.ctx;
    this.world.setCamera(16 + Math.sin(this.ceremonyT * 0.06) * 1.2, clamp(this.W / 24, 16, 54), 0.42, 'ceremony');
    this.paintWorld('ceremony', {
      jumbo: { top: 'OLYMPIA', big: 'PODIUM', sub: this.series?.season === 'winter' ? 'THE WINTER SESSION' : 'THE NIGHT SESSION', value: `${this.standings?.[0]?.total ?? 0} PTS` }
    });
    this.world.drawCeremonyPodium(ctx, this.standings || [], 'player', this.ceremonyT);
    this.world.drawFireworks(ctx);
    // extra stage glow
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(this.W * 0.46, this.H * 0.7, 0, this.W * 0.46, this.H * 0.7, this.W * 0.3);
    g.addColorStop(0, 'rgba(255,215,125,.10)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  loop(now) {
    const dt = Math.min(0.1, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.menuT += dt;
    this.world.update(dt * (this.paused ? 0.22 : 1));
    this.particles.update(dt);
    this.shake *= Math.exp(-7.5 * dt);
    if (this.miniTimer > 0) this.miniTimer -= dt;

    switch (this.state) {
      case 'menu':
      case 'guide':
        break;
      case 'intro':
        if (this.currentEvent) this.currentEvent.phase += dt * 0.55;
        break;
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'false-start':
        this.updateFalseStart(dt);
        break;
      case 'running':
        if (this.currentEvent) this.currentEvent.update(dt);
        if (this.goHideTimer > 0) {
          this.goHideTimer -= dt;
          if (this.goHideTimer <= 0) this.hideCountdown();
        }
        if (this.miniTimer <= 0) this.renderMiniBoard();
        this.applyHud();
        break;
      case 'results':
        if (this.miniTimer <= 0) this.renderMiniBoard();
        break;
      case 'ceremony':
        this.ceremonyT += dt;
        this.lastFirework -= dt;
        if (this.lastFirework <= 0) {
          this.lastFirework = rand(0.8, 1.7);
          this.world.addFirework(rand(this.W * 0.15, this.W * 0.85), rand(this.H * 0.12, this.H * 0.4));
          this.sound.setCrowd(0.035);
        }
        break;
      default:
        break;
    }
    if (this.state !== 'running' && this.miniTimer <= 0) this.renderMiniBoard();
  }

  /* ---------------------------------------------------------------- */
  ensureFields() {
    if (this.fields) return;
    const jitter = {
      sprint: [0.055, 2], longjump: [0.09, 2], javelin: [1.1, 1], hurdles: [0.07, 2],
      shotput: [0.3, 1], skijump: [1.6, 1], snowboard: [0.06, 2], curling: [9, 0]
    };
    const f = {};
    for (const id of Object.keys(EVENTS)) {
      const [j, digits] = jitter[id] || [0.1, 1];
      f[id] = {};
      for (const a of AI_DATA) {
        const base = a[id] ?? 10;
        f[id][a.id] = Number((base + rand(-j, j)).toFixed(digits));
      }
    }
    this.fields = f;
  }
  getField(id) {
    this.ensureFields();
    return this.fields[id];
  }
  fieldRank(id, mark) {
    if (!mark || mark <= 0) return 8;
    const field = this.getField(id);
    const lower = EVENTS[id].lower;
    let rank = 1;
    for (const a of AI_DATA) {
      if (lower ? field[a.id] < mark : field[a.id] > mark) rank++;
    }
    return rank;
  }
  fieldBoard(id, live) {
    const field = this.getField(id);
    const meta = EVENTS[id];
    const lower = meta.lower;
    const rows = this.roster.map(a => ({
      id: a.id,
      name: a.name,
      code: a.code,
      player: !!a.player,
      value: a.player ? (live || this.bests[id] || 0) : field[a.id]
    })).sort((a, b) => lower ? a.value - b.value : b.value - a.value);
    return rows.map(r => ({
      ...r,
      value: r.value ? this.markLabel(id, r.value) : '—'
    }));
  }

  /* ---------------------------------------------------------------- */
  setHudMode(id, practice = false) {
    const hud = document.getElementById('hud');
    const meta = EVENTS[id];
    hud.classList.remove('is-sprint', 'is-field', 'is-javelin', 'is-curling');
    hud.classList.add(meta.hud === 'sprint' ? 'is-sprint' : 'is-field');
    if (id === 'javelin') hud.classList.add('is-javelin');
    if (id === 'curling') hud.classList.add('is-curling');
    document.getElementById('hudEventNum').textContent = meta.num;
    document.getElementById('hudEventName').textContent = meta.name;
    document.getElementById('hudEventRound').textContent = practice
      ? 'PRACTICE RUN'
      : meta.season === 'winter' ? 'WINTER OLYMPIC FINAL' : 'OLYMPIC FINAL';
    const hints = document.getElementById('keyHints');
    if (hints) {
      const dash = meta.hud === 'sprint';
      const key = dash ? '<kbd>A</kbd><kbd>D</kbd> ALTERNATE TAPS' : `<kbd>SPACE</kbd> ${id === 'curling' ? 'RELEASE / SWEEP' : 'ACTION'}`;
      hints.innerHTML = `<span>${key}</span><span><kbd>ESC</kbd> PAUSE</span>`;
    }
    const jc = document.getElementById('javelinCluster');
    if (jc) jc.classList.toggle('is-on', id === 'javelin');
    const ac = document.getElementById('actionControls');
    if (ac) ac.classList.toggle('is-on', meta.hud !== 'sprint');
    this.resetHud();
  }

  resetHud() {
    document.getElementById('hudClock').innerHTML = '0.00<span>s</span>';
    document.getElementById('clockLabel').textContent = 'RACE TIME';
    document.getElementById('hudPlace').textContent = '—';
    document.getElementById('meterFill').style.width = '0%';
    document.getElementById('meterValue').textContent = '0.0';
    document.getElementById('meterLabel').textContent = 'VELOCITY';
    const prompt = document.getElementById('hudPrompt');
    prompt.classList.remove('is-on');
    const action = document.getElementById('actionBtn');
    if (action) { action.disabled = false; action.classList.remove('is-hot'); }
    this.miniData = null;
    this.renderMiniBoard();
  }

  showHUD() {
    document.getElementById('hud').classList.add('is-active');
  }
  hideHUD() {
    document.getElementById('hud').classList.remove('is-active');
  }

  setHUD(data) {
    this.hudData = { ...(this.hudData || {}), ...data };
  }

  applyHud() {
    if (!this.hudData) return;
    const d = this.hudData;
    if (d.clock !== undefined) {
      const unit = d.clockUnit ? `<span>${d.clockUnit}</span>` : '';
      const next = `${d.clock}${unit}`;
      const el = document.getElementById('hudClock');
      if (el.innerHTML !== next) el.innerHTML = next;
    }
    if (d.clockLabel) document.getElementById('clockLabel').textContent = d.clockLabel;
    if (d.place !== undefined) {
      const n = Number(String(d.place).replace(/\D/g, ''));
      const next = n ? ordinal(n) : '—';
      const el = document.getElementById('hudPlace');
      if (el.textContent !== next) el.textContent = next;
    }
    if (d.meter !== undefined) {
      const pct = clamp((d.meter / (d.meterMax || 12)) * 100, 0, 100);
      document.getElementById('meterFill').style.width = `${pct.toFixed(1)}%`;
      document.getElementById('meterValue').textContent = (Math.round(d.meter * 10) / 10).toFixed(1);
    }
    if (d.meterUnit) document.querySelector('.meter-head small').textContent = d.meterUnit;
    if (d.meterLabel) document.getElementById('meterLabel').textContent = d.meterLabel;
    if (d.cadence !== undefined) {
      const dots = document.querySelectorAll('#cadenceOrbit i');
      dots.forEach((dot, i) => dot.classList.toggle('on', i < Math.round(d.cadence * 3)));
    }
    if (d.prompt) {
      const prompt = document.getElementById('hudPrompt');
      prompt.classList.toggle('is-on', !!d.prompt.visible);
      prompt.classList.toggle('pulse', !!d.prompt.pulse);
      if (d.prompt.visible) {
        if (d.prompt.key) {
          document.getElementById('promptKey').textContent = d.prompt.key;
          document.getElementById('promptKey').classList.toggle('is-tap', String(d.prompt.key).length > 2);
        }
        if (d.prompt.title) document.getElementById('promptTitle').textContent = d.prompt.title;
        if (d.prompt.sub) document.getElementById('promptSub').textContent = d.prompt.sub;
      }
    }
    if (d.action !== undefined) {
      const action = document.getElementById('actionBtn');
      if (action) {
        action.classList.toggle('is-hot', !!d.actionHot);
        action.disabled = !!d.actionDisabled;
        if (d.actionLabel) document.getElementById('actionBtnLabel').textContent = d.actionLabel;
        if (d.actionSub) document.getElementById('actionBtnSub').textContent = d.actionSub;
      }
    }
    if (d.javelin) {
      this.updateAngleDial(d.angle ?? 36);
    }
  }

  updateAngleDial(value) {
    const knob = document.getElementById('angleKnob');
    if (!knob) return;
    const t = clamp((value - 15) / 42, 0, 1);
    const angle = (200 + t * 140) * Math.PI / 180;
    const cx = 90 + Math.cos(angle) * 92;
    const cy = 142 + Math.sin(angle) * 92;
    knob.setAttribute('cx', cx.toFixed(1));
    knob.setAttribute('cy', cy.toFixed(1));
    const read = document.getElementById('angleValue');
    if (read) read.textContent = `${Math.round(value)}°`;
  }

  setMiniBoard(rows, meta = '') {
    this.miniData = rows;
    this.miniMeta = meta;
    if (this.miniTimer <= 0) this.renderMiniBoard();
  }

  renderMiniBoard() {
    this.miniTimer = 0.18;
    const board = document.getElementById('miniBoard');
    if (!board) return;
    if (!this.miniData || !this.miniData.length || this.state === 'results' || this.state === 'ceremony') {
      board.classList.remove('is-on');
      return;
    }
    board.classList.add('is-on');
    document.getElementById('miniBoardMeta').textContent = this.miniMeta || '8 ATHLETES';
    const rows = this.miniData.slice(0, 8);
    document.getElementById('miniBoardRows').innerHTML = rows.map((r, i) => `
      <div class="mini-row ${r.player ? 'is-player' : ''} ${i === 0 ? 'is-leader' : ''}">
        <span class="pos">${i + 1}</span>
        <span class="who"><span class="flag">${r.code}</span><span class="name">${r.name}</span></span>
        <span class="score">${r.value}</span>
      </div>
    `).join('');
  }

  /* ---------------------------------------------------------------- */
  completeEvent(id, mark, meta = {}) {
    const isPractice = this.pending?.type === 'practice';
    const rows = this.buildEventRows(id, mark);
    const playerIndex = rows.findIndex(r => r.player);
    const playerPlace = playerIndex + 1;
    const playerPoints = rows[playerIndex].points;
    const result = {
      id,
      mark,
      rows,
      place: playerPlace,
      points: playerPoints,
      practice: isPractice,
      meta
    };
    this.recordBest(id, mark);
    if (this.series) {
      this.series.totals.player += playerPoints;
      this.series.events.push(result);
      for (const r of rows) {
        if (r.place === 1) this.series.golds[r.id]++;
        if (r.place === 2) this.series.silvers[r.id]++;
        if (r.place === 3) this.series.bronzes[r.id]++;
      }
    }
    this.lastEvent = result;
    this.resultsMode = isPractice ? 'practice' : 'series';
    this.state = 'results';
    this.paused = false;
    this.hideHUD();
    this.hideCountdown();
    this.miniData = null;
    this.renderMiniBoard();
    this.showResults(result);
    this.particles.confetti(isPractice ? 18 : 38, this.W, this.H);
    this.flashScreen(0.2);
    this.sound.cheer(isPractice ? 0.5 : 0.9);
  }

  buildEventRows(id, mark) {
    const field = this.getField(id);
    const raw = this.roster.map(a => ({
      id: a.id,
      name: a.name,
      code: a.code,
      athlete: a,
      player: !!a.player,
      mark: a.player ? mark : field[a.id]
    }));
    const meta = EVENTS[id];
    raw.sort((a, b) => meta.lower ? a.mark - b.mark : b.mark - a.mark);
    return raw.map((r, i) => ({
      ...r,
      place: i + 1,
      points: 8 - i,
      display: meta.format === 'time' ? `${fmtTime(r.mark)} s`
        : meta.format === 'cm' ? `${Math.round(r.mark)} cm` : `${fmtDist(r.mark)} m`,
      displayShort: this.markLabel(id, r.mark).replace(/[a-z]+$/, '')
    }));
  }

  recordBest(id, mark) {
    const old = this.bests[id];
    const lower = EVENTS[id].lower;
    const better = !old || (lower ? mark < old : mark > old);
    if (better) {
      this.bests[id] = mark;
      this.saveBests();
      this.updateMenuBest();
      setTimeout(() => this.toast(`NEW PERSONAL BEST — ${this.markLabel(id, mark).toUpperCase()}`, 'gold', 1500), 650);
    }
  }

  showResults(result) {
    this.hideScreens();
    const el = document.getElementById('results');
    el.classList.add('is-active');
    const meta = EVENTS[result.id];
    document.getElementById('resultsKicker').textContent = `EVENT ${meta.num} · ${result.practice ? 'PRACTICE' : 'FINAL'}`;
    document.getElementById('resultsTitle').textContent = meta.name;
    document.getElementById('resultsMark').textContent = meta.format === 'time' ? fmtTime(result.mark)
      : meta.format === 'cm' ? String(Math.round(result.mark)) : fmtDist(result.mark);
    document.getElementById('resultsUnit').textContent = meta.format === 'time' ? 'SECONDS' : meta.format === 'cm' ? 'CENTIMETRES' : 'METRES';
    const medal = document.getElementById('verdictMedal');
    medal.textContent = result.place;
    medal.className = `verdict-medal ${result.place === 1 ? '' : result.place === 2 ? 'silver' : result.place === 3 ? 'bronze' : 'plain'}`;
    document.getElementById('verdictPlace').textContent = `${ordinal(result.place).toUpperCase()} PLACE`;
    document.getElementById('verdictPoints').textContent = `+${result.points} POINTS`;
    document.getElementById('resultRows').innerHTML = result.rows.map(r => `
      <div class="result-row ${r.player ? 'is-player' : ''}">
        <span class="pos">${r.place}</span>
        <span class="athlete"><span class="code">${r.code}</span><span class="name">${r.name}</span></span>
        <span class="mark">${r.display}</span>
        <span class="pts">${r.points}</span>
      </div>
    `).join('');
    document.getElementById('resultNote').innerHTML = this.resultNote(result);
    document.getElementById('seriesMini').innerHTML = this.seriesMiniMarkup(result);
    const replay = document.querySelector('[data-action="results-replay"]');
    if (replay) replay.style.display = result.practice ? '' : 'none';
    const next = document.getElementById('resultsNextLabel');
    if (result.practice) next.textContent = 'TRY AGAIN';
    else if (this.series && this.series.events.length >= this.series.list.length) next.textContent = 'THE MEDAL CEREMONY';
    else next.textContent = 'NEXT EVENT';
    setTimeout(() => {
      const panel = document.querySelector('.results-panel');
      if (panel) panel.scrollTop = 0;
    }, 30);
    this.sound.ui();
  }

  resultNote(result) {
    const name = EVENTS[result.id].name;
    if (result.practice) {
      return `<b>Practice run complete.</b> Your ${name.toLowerCase()} mark is in the books. Run it again to build the rhythm before the championship.`;
    }
    if (result.place === 1) {
      const notes = {
        sprint: '<b>Untouchable.</b> A devastating final 30 metres. The field is chasing shadows and the stadium is roaring.',
        longjump: '<b>Gold-standard flight.</b> The board, the arc, the landing — everything clicked when it mattered.',
        javelin: '<b>A spear from the gods.</b> The angle was pure and the crowd rose before it even landed.',
        hurdles: '<b>Poetry over the barriers.</b> Ten hurdles, zero hesitation. The rhythm never broke.',
        shotput: '<b>Heavy metal, heavier statement.</b> The circle erupted and the shot sailed beyond the field.',
        skijump: '<b>Airborne perfection.</b> The lip, the glide, the landing — the hill belonged to you.',
        snowboard: '<b>Edges on fire.</b> You owned every roller and shut the door through the final gate.',
        curling: '<b>Dead on the button.</b> The weight was pure and the sweepers brought it home.'
      };
      return notes[result.id];
    }
    if (result.place <= 3) {
      return `<b>On the podium.</b> A composed ${name.toLowerCase()} performance. There are more points on the table — and one event left to chase.`;
    }
    if (result.place <= 5) {
      return `<b>In the hunt.</b> The mark is respectable, but the leaders have opened a gap. A big next event can turn the campaign.`;
    }
    return `<b>Tough night.</b> The field is deep at this level. Reset, find the rhythm, and attack the next event with nothing to lose.`;
  }

  seriesMiniMarkup(result) {
    if (!this.series) {
      return '<div class="series-mini-head">PRACTICE SESSION</div><div class="series-mini-row current"><i></i>NO SERIES POINTS<B>—</B></div>';
    }
    const current = this.series.events.length;
    return `
      <div class="series-mini-head">CAMPAIGN · ${this.series.totals.player} PTS</div>
      ${this.series.list.map((id, i) => {
        const done = this.series.events.find(e => e.id === id);
        const cls = done ? 'done' : current === i ? 'current' : '';
        return `<div class="series-mini-row ${cls}"><i></i>${EVENTS[id].name}<b>${done ? `+${done.points}` : current === i ? 'NEXT' : '—'}</b></div>`;
      }).join('')}
    `;
  }

  onResultsNext() {
    this.sound.ui();
    const result = this.lastEvent;
    if (!result) return;
    if (result.practice) {
      this.restartPractice();
      return;
    }
    if (this.series && this.series.events.length >= this.series.list.length) {
      this.showCeremony();
    } else {
      this.series.index = this.series.events.length;
      this.showIntro(this.series.list[this.series.index]);
    }
  }

  onResultsReplay() {
    if (!this.lastEvent?.practice) return;
    this.restartPractice();
  }

  restartPractice() {
    const id = this.lastEvent?.id || this.currentEventId || 'sprint';
    this.startPractice(id);
  }

  /* ---------------------------------------------------------------- */
  buildStandings() {
    if (!this.series) return [];
    return this.roster.map(a => ({
      ...a,
      total: this.series.totals[a.id],
      golds: this.series.golds[a.id],
      silvers: this.series.silvers[a.id],
      bronzes: this.series.bronzes[a.id]
    })).sort((a, b) =>
      b.total - a.total ||
      b.golds - a.golds ||
      b.silvers - a.silvers ||
      b.bronzes - a.bronzes ||
      a.name.localeCompare(b.name)
    );
  }

  showCeremony() {
    if (!this.series) return;
    this.state = 'ceremony';
    this.paused = false;
    this.hideHUD();
    this.hideCountdown();
    this.hideScreens();
    this.standings = this.buildStandings();
    const playerIndex = this.standings.findIndex(a => a.player);
    const place = playerIndex + 1;
    const isMedal = place <= 3;
    const medalName = place === 1 ? 'GOLD' : place === 2 ? 'SILVER' : place === 3 ? 'BRONZE' : null;
    document.getElementById('ceremony').classList.add('is-active');
    const title = document.getElementById('ceremonyTitle');
    title.innerHTML = medalName ? `${medalName}<br/><em>MEDAL</em>` : `${ordinal(place).toUpperCase()}<br/><em>PLACE</em>`;
    const sub = document.getElementById('ceremonySub');
    const winter = this.series.season === 'winter';
    if (place === 1) sub.textContent = winter ? 'Champion of the winter session. Snow and ice belong to you.' : 'Champion of the night session. The stadium belongs to you.';
    else if (place === 2) sub.textContent = 'Olympic silver. One brilliant session, one relentless rival.';
    else if (place === 3) sub.textContent = 'Olympic bronze. A place on the podium and a night to remember.';
    else sub.textContent = `You finish ${ordinal(place)} overall. The podium was close — the next campaign starts now.`;
    const total = this.series.totals.player;
    if (total > this.scoreBest) {
      this.scoreBest = total;
      localStorage.setItem('olympia-best-score', String(total));
      this.updateMenuBest();
    }
    document.getElementById('finalBoard').innerHTML = `
      <div class="final-board-head"><span>FINAL STANDINGS</span><span>${total} PTS · YOU</span></div>
      ${this.standings.map((a, i) => `
        <div class="final-row ${a.player ? 'is-player' : ''}">
          <span class="place">${i + 1}</span>
          <span class="who"><span class="code">${a.code}</span><span class="name">${a.name}</span></span>
          <span class="total">${a.total}</span>
          <span class="medal-mini">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}</span>
        </div>
      `).join('')}
    `;
    this.ceremonyT = 0;
    this.lastFirework = 0;
    this.particles.clear();
    this.particles.confetti(110, this.W, this.H);
    if (isMedal) {
      this.sound.fanfare();
      this.world.addFirework(this.W * 0.35, this.H * 0.25);
      this.world.addFirework(this.W * 0.65, this.H * 0.19);
      setTimeout(() => this.toast(`${medalName} MEDAL — ${total} POINTS`, 'gold', 2200), 500);
    } else {
      this.sound.cheer(0.8);
    }
  }

  /* ---------------------------------------------------------------- */
  openPause() {
    if (this.state !== 'running' || this.paused) return;
    this.paused = true;
    document.getElementById('pause').classList.add('is-active');
    this.sound.ui();
  }
  resume() {
    this.paused = false;
    document.getElementById('pause').classList.remove('is-active');
    this.sound.uiBack();
  }
  restartEvent() {
    const id = this.currentEventId;
    if (!id) return;
    this.paused = false;
    document.getElementById('pause').classList.remove('is-active');
    this.hideScreens();
    this.currentEvent = this.makeEvent(id);
    this.setHudMode(id, this.pending?.type === 'practice');
    this.state = 'countdown';
    const isDash = EVENTS[id].hud === 'sprint';
    this.countdown = { t: 0, step: 0, id, sprint: isDash, done: false };
    document.getElementById('countdown').classList.add('is-active');
    document.getElementById('countdownStage').classList.add('is-on');
    this.setCountdown(isDash ? 'ON YOUR MARKS' : id === 'curling' ? 'ON THE HACK' : 'READY', isDash ? 'WAIT FOR THE GUN' : 'THE RUNWAY IS YOURS', '');
    this.sound.countBeep(false);
  }
  quitEvent() {
    this.paused = false;
    document.getElementById('pause').classList.remove('is-active');
    this.showMenu();
  }

  openGuide() {
    this.sound.ui();
    document.getElementById('guide').classList.add('is-active');
    if (this.state === 'menu') this.state = 'guide';
  }
  closeGuide() {
    document.getElementById('guide').classList.remove('is-active');
    if (this.state === 'guide') this.state = 'menu';
  }

  showMenu() {
    this.state = 'menu';
    this.paused = false;
    this.series = null;
    this.fields = null;
    this.currentEvent = null;
    this.currentEventId = null;
    this.lastEvent = null;
    this.hudData = null;
    this.miniData = null;
    this.particles.clear();
    this.closeAllOverlays();
    this.hideScreens();
    document.getElementById('menu').classList.add('is-active');
    this.updateMenuBest();
    this.sound.setCrowd(0.018);
  }

  hideScreens() {
    ['menu', 'eventIntro', 'results', 'ceremony'].forEach(id => document.getElementById(id).classList.remove('is-active'));
    this.hideHUD();
    this.hideCountdown();
    document.getElementById('practiceMenu').classList.remove('is-active');
    document.getElementById('readyOverlay')?.classList.remove('is-active');
  }

  closeAllOverlays() {
    ['pause', 'guide', 'practiceMenu'].forEach(id => document.getElementById(id).classList.remove('is-active'));
  }

  /* ---------------------------------------------------------------- */
  spawnParticle(o) { this.particles.spawn(o); }
  burst(x, y, count, color, speed, life) { this.particles.burst(x, y, count, color, speed, life); }
  flashScreen(strength = 0.3) {
    const el = document.getElementById('flash');
    if (!el) return;
    el.style.opacity = String(clamp(strength, 0, 0.9));
    el.classList.remove('fire');
    void el.offsetWidth;
    el.classList.add('fire');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => { el.classList.remove('fire'); el.style.opacity = '0'; }, 360);
  }
  toast(message, type = '', ms = 1300) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `toast is-on ${type || ''}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
  }
  groundY(lane, mode) { return this.world.groundY(lane, mode); }
}

const game = new Game();
window.__olympia = game;
