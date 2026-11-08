import { clamp, lerp, smoothstep, rand, fmtTime, fmtDist } from './utils.js';
import { drawAthlete } from './athlete.js';

const AI_LANES = [0, 1, 2, 4, 5, 6, 7];

class BaseEvent {
  constructor(game, id, options = {}) {
    this.game = game;
    this.id = id;
    this.practice = !!options.practice;
    this.world = game.world;
    this.state = 'ready';
    this.ended = false;
    this.camX = -10;
    this.meter = 45;
    this.anchor = 0.4;
    this.phase = 0;
    this.field = game.getField(id);
    this.particles = [];
    this.jumbo = { top: 'OLYMPIA', big: '100M', sub: 'FINAL', value: '0.00' };
  }
  get W() { return this.game.W; }
  get H() { return this.game.H; }
  get ctx() { return this.game.ctx; }
  setCamera(meter, anchor) {
    this.meter = meter;
    this.anchor = anchor;
  }
  updateCamera(dt, targetX, extra = 0) {
    const meter = clamp(this.W / 24, 16, 54);
    const anchor = this.W < 720 ? 0.42 : 0.4;
    this.meter = lerp(this.meter, meter, 1 - Math.exp(-2.4 * dt));
    this.anchor = lerp(this.anchor, anchor, 1 - Math.exp(-2 * dt));
    const targetCam = targetX - (this.W * this.anchor) / this.meter + extra;
    this.camX = lerp(this.camX, targetCam, 1 - Math.exp(-3.2 * dt));
    this.world.setCamera(this.camX, this.meter, this.anchor, this.id);
  }
  paint(extra = {}) {
    this.game.paintWorld(this.id, {
      jumbo: this.jumbo,
      ribbon: extra.ribbon
    });
  }
  hud(data) {
    this.game.setHUD(data);
  }
  done(mark, meta = {}) {
    if (this.ended) return;
    this.ended = true;
    this.game.completeEvent(this.id, mark, { ...meta, practice: this.practice });
  }
}

/* ================================================================== */
/*  100M SPRINT                                                        */
/* ================================================================== */
export class SprintEvent extends BaseEvent {
  constructor(game, options = {}) {
    const id = options.id || 'sprint';
    super(game, id, options);
    this.worldMode = 'sprint';
    this.board = !!options.board;
    this.spray = !!options.spray;
    this.hurdleDistances = options.hurdles || null;
    this.raceDistance = options.distance || 100;
    this.distanceScale = options.distanceScale || 1;
    this.playerLane = 3;
    this.raceTime = 0;
    this.finishDelay = 0;
    this.auto = false;
    this.player = null;
    this.runners = [];
    this.buildRunners();
    this.camX = -(this.W * 0.415) / clamp(this.W / 24, 16, 54);
    this.meter = clamp(this.W / 24, 16, 54);
    this.anchor = 0.415;
    this.jumbo = { top: 'OLYMPIA', big: this.hurdleDistances ? 'HURDLES' : this.board ? 'BOARD X' : '100M', sub: 'FINAL', value: '0.00' };
    this.lastPhase = 0;
    this.liveRank = 8;
  }

  buildRunners() {
    const roster = this.game.roster;
    let laneIndex = 0;
    this.runners = roster.map((athlete) => {
      const isPlayer = !!athlete.player;
      const lane = isPlayer ? 3 : AI_LANES[laneIndex++];
      const targetTime = isPlayer ? null : this.field[athlete.id];
      const r = {
        athlete,
        isPlayer,
        lane,
        dist: 0,
        speed: 0,
        phase: rand(0, Math.PI * 2),
        finished: false,
        time: null,
        targetTime,
        targetSpeed: targetTime ? this.raceDistance / Math.max(0.1, targetTime - 0.375) / this.distanceScale : 0,
        cleared: []
      };
      if (isPlayer) this.player = r;
      return r;
    });
  }

  start() {
    this.state = 'running';
    this.raceTime = 0;
    this.game.sound.setCrowd(0.028);
    this.hudFlash();
  }

  hudFlash() {
    this.game.setHUD({ prompt: { visible: false } });
  }

  tap(side) {
    if (this.state !== 'running' || this.player.finished) return;
    const p = this.player;
    const t = this.raceTime;
    if (t - p.lastTap < 0.055) return;
    if (t - p.lastTap > 0.32) p.speed *= 0.97;
    const valid = side !== p.lastSide;
    if (valid) {
      if (!p.started) {
        p.started = true;
        p.speed += 2.2;
        p.reaction = t;
      }
      p.auto = false;
      const boost = 0.55 * Math.max(0, 1 - p.speed / 13) + 0.08;
      p.speed += boost;
      p.taps++;
      p.lastSide = side;
      p.lastTap = t;
      this.game.sound.step(clamp(p.speed / 12, 0.2, 1));
      this.game.tapFlash(side);
      this.game.spawnParticle({
        x: this.game.W * 0.5 + rand(-60, 60),
        y: this.game.groundY(this.playerLane, 'sprint') - rand(4, 20),
        vx: rand(-30, 10), vy: rand(-20, -5), life: rand(0.2, 0.45),
        size: rand(1, 3), color: 'rgba(255,226,177,.32)', gravity: 8
      });
    } else {
      p.lastTap = t;
      p.speed *= 0.93;
    }
  }

  update(dt) {
    this.phase += dt;
    if (this.state !== 'running') return;
    this.raceTime += dt;

    const p = this.player;
    // Graceful fallback: nobody gets stuck at the start forever.
    if (!p.started && this.raceTime > 3.4) {
      p.started = true;
      p.auto = true;
      p.speed = 5.1;
      p.reaction = this.raceTime;
    }

    // Player physics: taps provide impulse, air / stride drag bleeds it away.
    if (p.started) {
      if (p.finished) {
        p.speed *= Math.exp(-2.4 * dt);
      } else {
        if (p.auto) p.speed = Math.max(p.speed, 5.1);
        p.speed *= Math.exp(-0.10 * dt);
        const prev = p.dist;
        p.dist += p.speed * this.distanceScale * dt;
        p.phase += p.speed * 1.06 * dt;
        this.checkHurdles(p, prev);
        if (p.dist >= this.raceDistance) {
          p.finished = true;
          p.time = this.raceTime - (p.dist - this.raceDistance) / Math.max(0.01, p.speed * this.distanceScale);
          p.dist = this.raceDistance;
          this.game.shake = Math.max(this.game.shake, 5);
          this.game.sound.cheer(1.1);
          this.game.toast(this.hurdleDistances ? 'CLEAN RUN' : 'FINISH', 'gold', 900);
        }
      }
    }

    for (const r of this.runners) {
      if (r.isPlayer || r.finished) continue;
      const speed = r.targetSpeed * smoothstep(0, 0.75, this.raceTime);
      r.speed = speed;
      const prev = r.dist;
      r.dist += speed * this.distanceScale * dt;
      r.phase += speed * 1.04 * dt;
      this.checkHurdles(r, prev);
      if (r.dist >= this.raceDistance) {
        r.finished = true;
        r.time = this.raceTime - (r.dist - this.raceDistance) / Math.max(0.01, speed * this.distanceScale);
        r.dist = this.raceDistance;
      }
    }

    const allDone = this.runners.every(r => r.finished);
    if (p.finished) {
      this.finishDelay += dt;
      if (allDone || this.finishDelay > 1.35) {
        this.state = 'done';
        this.done(p.time, { placeHint: this.liveRank });
        return;
      }
    }

    this.updateCamera(dt, p.dist, 1.1);
    this.updateLive(dt);
    this.spawnFootDust(dt);
  }

  checkHurdles(r, prevDist) {
    if (!this.hurdleDistances) return;
    for (let i = 0; i < this.hurdleDistances.length; i++) {
      const h = this.hurdleDistances[i];
      if (r.cleared[i] || prevDist >= h || r.dist < h) continue;
      r.cleared[i] = true;
      if (r.isPlayer) {
        if (r.speed < 10.2) {
          r.speed *= 0.86;
          this.game.shake = Math.max(this.game.shake, 3);
          this.game.toast('CLIPPED HURDLE', 'red', 760);
          this.game.sound.noise(0.14, 0.14, 'bandpass', 420);
        } else {
          this.game.burst(this.world.sx(h), this.game.groundY(this.playerLane, 'sprint') - 26, 5, 'rgba(255,232,190,.45)', 40, 0.35);
        }
        if (this.practice && i === 4) this.game.toast('HALFWAY — KEEP THE RHYTHM', 'gold', 700);
      }
    }
  }

  updateLive(dt) {
    const order = [...this.runners].sort((a, b) => {
      if (a.finished && b.finished) return a.time - b.time;
      return b.dist - a.dist;
    });
    this.liveRank = order.findIndex(r => r.isPlayer) + 1;
    this.game.setMiniBoard(
      order.map(r => ({
        id: r.athlete.id,
        name: r.athlete.name,
        code: r.athlete.code,
        player: r.isPlayer,
        value: r.finished ? fmtTime(r.time) : `${r.dist.toFixed(1)}m`
      })),
      'LIVE ORDER'
    );
    const next = this.player.lastSide === 'left' ? (this.game.touch ? 'R' : 'D') : (this.game.touch ? 'L' : 'A');
    const cadence = this.player.started ? clamp((this.player.speed - 4) / 8, 0, 1) : 0;
    this.hud({
      clock: fmtTime(this.raceTime),
      clockUnit: 's',
      clockLabel: 'RACE TIME',
      place: this.player.finished ? String(this.liveRank) : String(this.liveRank),
      meter: this.player.speed,
      meterMax: 13.2,
      meterUnit: 'M/S',
      meterLabel: 'VELOCITY',
      prompt: this.player.finished ? { visible: false } : {
        visible: true,
        key: next,
        title: this.player.started ? 'KEEP THE CADENCE' : 'EXPLODE FROM THE BLOCKS',
        sub: this.game.touch
          ? `Alternate ${this.player.lastSide === 'left' ? 'R' : 'L'} / ${next} — ${Math.round(this.player.speed * 10) / 10} m/s`
          : `Alternate ${this.player.lastSide === 'left' ? 'D' : 'A'} / ${next} — ${Math.round(this.player.speed * 10) / 10} m/s`,
        pulse: true
      },
      cadence,
      action: false
    });
  }

  spawnFootDust() {
    const p = this.player;
    if (!p.started || p.speed < 3.5) return;
    const crossed = Math.floor(p.phase / Math.PI);
    if (crossed !== this.lastPhase) {
      this.lastPhase = crossed;
      const x = this.world.sx(p.dist) - 12;
      const y = this.game.groundY(this.playerLane, 'sprint');
      for (let i = 0; i < 2; i++) {
        this.game.spawnParticle({
          x: x + rand(-12, 12), y: y - rand(0, 5),
          vx: rand(-50, -8), vy: rand(-34, -6), life: rand(0.28, 0.6),
          size: rand(1.4, 4.2),
          color: this.spray ? `rgba(220,244,255,${rand(0.2, 0.42)})` : `rgba(255,214,154,${rand(0.12, 0.27)})`,
          gravity: 26, drag: 0.5
        });
      }
    }
  }

  render(ctx) {
    this.world.playerLane = this.playerLane;
    this.paint();
    const order = [...this.runners].sort((a, b) => a.lane - b.lane);
    for (const r of order) {
      const x = this.world.sx(r.dist);
      if (x < -100 || x > this.W + 130) continue;
      const y = this.game.groundY(r.lane, 'sprint');
      const scale = this.world.laneScale(r.lane, 'sprint') * (r.isPlayer ? 1.03 : 1);
      let pose = 'run';
      if (this.state === 'ready' || this.game.state === 'countdown') pose = 'set';
      if (this.game.state === 'false-start') pose = 'set';
      if (r.finished && r.speed < 1.5) pose = 'idle';
      const nearHurdle = this.hurdleDistances?.some(h => Math.abs(r.dist - h) < 0.75 && !r.finished);
      if (nearHurdle) pose = 'jump';
      drawAthlete(ctx, {
        x, y, scale,
        phase: r.phase,
        pose,
        speed: clamp(r.speed / 12, 0, 1),
        kit: r.athlete.kit,
        glow: r.isPlayer ? 0.18 : 0.04,
        shadow: r.isPlayer ? 1.15 : 0.9,
        number: r.isPlayer ? 7 : 7,
        board: this.board
      });
      if (r.isPlayer && this.state !== 'ready') {
        this.drawPlayerTag(ctx, x, y, scale, r);
      }
    }
    this.drawHurdles(ctx);
    // Motion streaks for top speed.
    if (this.player.speed > 8.5) {
      const p = this.player;
      const x = this.world.sx(p.dist);
      const y = this.game.groundY(this.playerLane, 'sprint');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 7; i++) {
        const yy = y - 20 - i * 11 - rand(0, 8);
        const len = 28 + rand(0, 55) + p.speed * 2;
        const a = 0.018 + (p.speed - 8.5) * 0.013;
        const grad = ctx.createLinearGradient(x - len, yy, x + 12, yy);
        grad.addColorStop(0, 'rgba(255,236,185,0)');
        grad.addColorStop(0.7, `rgba(255,218,148,${a})`);
        grad.addColorStop(1, 'rgba(255,245,216,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1 + rand(0, 1.7);
        ctx.beginPath(); ctx.moveTo(x - len, yy); ctx.lineTo(x + 20, yy); ctx.stroke();
      }
      ctx.restore();
    }
    this.drawFinishAtmosphere(ctx);
  }

  drawHurdles(ctx) {
    if (!this.hurdleDistances) return;
    for (const dist of this.hurdleDistances) {
      const x = this.world.sx(dist);
      if (x < -40 || x > this.W + 40) continue;
      for (let lane = 0; lane < 8; lane++) {
        const y = this.game.groundY(lane, 'sprint');
        const scale = this.world.laneScale(lane, 'sprint');
        const h = 30 * scale;
        const w = 15 * scale;
        ctx.save();
        ctx.globalAlpha = lane === this.playerLane ? 0.95 : 0.72;
        ctx.strokeStyle = lane === this.playerLane ? 'rgba(247,201,80,.9)' : 'rgba(226,236,248,.7)';
        ctx.lineWidth = 1.4 * scale;
        ctx.fillStyle = 'rgba(238,243,250,.82)';
        ctx.fillRect(x - w / 2, y - h, w, h * 0.72);
        ctx.strokeRect(x - w / 2, y - h, w, h * 0.72);
        ctx.strokeStyle = 'rgba(89,122,158,.9)';
        ctx.lineWidth = 1.1 * scale;
        ctx.beginPath();
        ctx.moveTo(x - w / 2 - 2 * scale, y - h);
        ctx.lineTo(x - w / 2 - 5 * scale, y - h * 0.35);
        ctx.moveTo(x + w / 2 + 2 * scale, y - h);
        ctx.lineTo(x + w / 2 + 5 * scale, y - h * 0.35);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawPlayerTag(ctx, x, y, scale, r) {
    const top = y - 132 * scale;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = 'rgba(4,10,20,.72)';
    ctx.strokeStyle = 'rgba(247,201,80,.38)';
    ctx.lineWidth = 1;
    const text = 'YOU';
    ctx.font = '700 8px "Barlow Condensed", sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, top - 16, w, 13, 2); else ctx.rect(x - w / 2, top - 16, w, 13);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f7c950';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, top - 9.5);
    ctx.restore();
  }

  drawFinishAtmosphere(ctx) {
    const x = this.world.sx(this.raceDistance);
    if (x < -60 || x > this.W + 60) return;
    const grad = ctx.createRadialGradient(x, this.H * 0.77, 0, x, this.H * 0.77, this.H * 0.27);
    grad.addColorStop(0, 'rgba(247,201,80,.07)');
    grad.addColorStop(1, 'rgba(247,201,80,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, this.H * 0.77, this.H * 0.27, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/* ================================================================== */
/*  LONG JUMP                                                          */
/* ================================================================== */
export class LongJumpEvent extends BaseEvent {
  constructor(game, options = {}) {
    super(game, 'longjump', options);
    this.meter = clamp(this.W / 24, 16, 52);
    this.anchor = 0.37;
    this.camX = -(this.W * 0.37) / this.meter;
    this.x = 0;
    this.runTime = 0;
    this.speed = 0;
    this.phase = rand(0, 6);
    this.state = 'ready';
    this.quality = 0;
    this.baseDistance = 0;
    this.extension = 0;
    this.extended = false;
    this.flightT = 0;
    this.flightDur = 1;
    this.takeoffX = 0;
    this.landingX = 0;
    this.result = 0;
    this.peak = 0;
    this.landTimer = 0;
    this.jumbo = { top: 'OLYMPIA', big: 'JUMP', sub: 'FINAL', value: '0.00' };
    this.lastPhase = 0;
    this.liveRank = 8;
  }

  start() {
    this.state = 'run';
    this.runTime = 0;
    this.game.sound.setCrowd(0.024);
  }

  tap() {
    if (this.state === 'run') {
      this.jump();
    } else if (this.state === 'flight' && !this.extended) {
      const u = this.flightT / this.flightDur;
      if (u > 0.35 && u < 0.7) {
        this.extended = true;
        this.extension = 0.42;
        this.game.sound.tone(760, 0.12, 0.05, 'sine', 1040);
        this.game.toast('EXTENDED — +0.42 M', 'gold', 1100);
        const sx = this.world.sx(this.x);
        const sy = this.game.groundY(1, 'longjump') - this.peak * Math.sin(Math.PI * u);
        this.game.burst(sx, sy, 10, '#f7c950', 120, 0.5);
      } else {
        this.extended = true;
        this.game.toast(u <= 0.35 ? 'TOO EARLY TO EXTEND' : 'TOO LATE TO EXTEND', 'red', 900);
      }
    }
  }

  jump(auto = false) {
    if (this.state !== 'run') return;
    const x = this.x;
    let q;
    if (x >= 38.1 && x <= 39.9) {
      q = 1 - Math.abs(x - 39.0) / 1.3 * 0.12;
    } else if (x < 38.1) {
      q = clamp(0.22 + Math.max(0, x - 31) / 7.1 * 0.55, 0.22, 0.77);
    } else if (x <= 40.6) {
      q = 0.58;
    } else {
      q = 0.34;
    }
    if (auto) q = Math.min(q, 0.32);
    this.quality = q;
    this.takeoffX = x;
    this.baseDistance = 3.65 + this.speed * 0.337 + q * 1.18;
    this.result = this.baseDistance;
    const visual = Math.max(3.6, this.baseDistance);
    this.landingX = 40 + visual + 0.42;
    this.peak = this.H * (0.055 + clamp(this.speed / 12, 0, 1) * 0.04);
    this.flightDur = clamp(0.62 + this.baseDistance * 0.038, 0.86, 1.1);
    this.flightT = 0;
    this.state = 'flight';
    this.game.sound.jump();
    this.game.shake = Math.max(this.game.shake, 2.5);
    this.game.toast(x < 38.1 ? 'EARLY TAKEOFF' : x > 40.3 ? 'OVERSTEP' : 'CLEAN TAKEOFF', x < 38.1 || x > 40.3 ? 'red' : 'gold', 700);
  }

  update(dt) {
    this.phase += dt;
    if (this.state === 'ready') return;
    if (this.state === 'run') {
      this.runTime += dt;
      this.speed = 10.7 * smoothstep(0, 3.7, this.runTime);
      this.x += this.speed * dt;
      this.phase += this.speed * 0.96 * dt;
      if (this.x > 40.9) this.jump(true);
      this.updateCamera(dt, this.x, 3.2);
      this.spawnDust();
    } else if (this.state === 'flight') {
      this.flightT += dt;
      const u = clamp(this.flightT / this.flightDur, 0, 1);
      this.x = lerp(this.takeoffX, this.landingX, u);
      this.phase += 2.4 * dt;
      this.updateCamera(dt, this.x, 2.5);
      if (u >= 1) this.land();
    } else if (this.state === 'landed') {
      this.landTimer += dt;
      this.updateCamera(dt, this.landingX, 1.8);
      if (this.landTimer > 1.55) {
        this.state = 'done';
        this.done(this.result, { quality: this.quality, extended: this.extended });
      }
    }

    this.liveRank = 1 + this.game.fieldRank('longjump', this.state === 'landed' ? this.result : this.baseDistance);
    this.jumbo.value = this.state === 'landed' ? `${this.result.toFixed(2)}` : this.state === 'flight' ? 'AIR' : '0.00';
    this.hudState();
  }

  hudState() {
    const toBoard = Math.max(0, 40 - this.x);
    const clockValue = this.state === 'landed'
      ? fmtDist(this.result)
      : toBoard > 0 ? toBoard.toFixed(1) : 'BOARD';
    const clockUnit = this.state === 'landed' ? 'm' : toBoard > 0 ? 'm' : '';
    let prompt;
    const tap = this.game.touch ? 'TAP' : '↑';
    if (this.state === 'run') {
      if (this.x < 30) prompt = { key: tap, title: 'BUILD SPEED', sub: 'Stay relaxed — the board is coming', pulse: false };
      else if (this.x < 37.6) prompt = { key: tap, title: 'FIND THE BOARD', sub: 'Tap as you enter the glowing zone', pulse: false };
      else prompt = { key: tap, title: 'TAKE OFF NOW', sub: 'Hit the board cleanly', pulse: true };
    } else if (this.state === 'flight') {
      prompt = this.extended
        ? { key: '✓', title: 'EXTENSION LOCKED', sub: 'Ride the arc into the sand', pulse: false }
        : { key: tap, title: 'TAP TO EXTEND', sub: 'Strike at the top of the flight', pulse: true };
    } else if (this.state === 'landed') {
      prompt = { key: '✓', title: 'MARK SET', sub: `${this.result.toFixed(2)} metres`, pulse: false };
    } else {
      prompt = { visible: false };
    }
    this.hud({
      clock: clockValue,
      clockUnit,
      clockLabel: this.state === 'landed' ? 'MEASURED' : 'TO BOARD',
      place: `${this.game.fieldRank('longjump', this.state === 'landed' ? this.result : this.baseDistance)}`,
      meter: this.speed,
      meterMax: 11.5,
      meterUnit: 'M/S',
      meterLabel: 'RUNWAY SPEED',
      prompt: { visible: true, ...prompt },
      action: true,
      actionLabel: this.state === 'flight' ? (this.extended ? 'LOCKED' : 'EXTEND') : 'JUMP',
      actionSub: this.game.touch ? 'TAP HERE' : (this.state === 'flight' ? 'SPACE / TAP' : 'TAKE OFF'),
      actionHot: this.state === 'run' ? (this.x > 37.5 && this.x < 40.1) : (this.state === 'flight' && !this.extended && this.flightT / this.flightDur > 0.3 && this.flightT / this.flightDur < 0.72),
      actionDisabled: this.state === 'landed' || (this.state === 'flight' && this.extended)
    });
    this.game.setMiniBoard(
      this.game.fieldBoard('longjump', this.state === 'landed' ? this.result : null),
      'FIELD ORDER'
    );
  }

  spawnDust() {
    if (this.speed < 3) return;
    const crossed = Math.floor(this.phase / Math.PI);
    if (crossed !== this.lastPhase) {
      this.lastPhase = crossed;
      const x = this.world.sx(this.x) - 10;
      const y = this.game.groundY(1, 'longjump');
      this.game.spawnParticle({
        x, y: y - 2, vx: rand(-45, -10), vy: rand(-25, -5), life: rand(0.3, 0.6),
        size: rand(1.2, 3.5), color: 'rgba(255,216,160,.26)', gravity: 30
      });
    }
  }

  land() {
    this.state = 'landed';
    this.result = this.baseDistance + this.extension;
    this.x = this.landingX;
    this.landTimer = 0;
    this.game.sound.sand(1);
    this.game.sound.cheer(0.8);
    this.game.shake = Math.max(this.game.shake, 4);
    const sx = this.world.sx(this.landingX);
    const gy = this.game.groundY(1, 'longjump');
    this.game.burst(sx, gy - 5, 26, '#cba465', 170, 0.8);
    this.game.burst(sx, gy - 5, 12, '#f7dfaa', 120, 0.55);
  }

  render(ctx) {
    this.paint();
    const ground = this.game.groundY(1, 'longjump');
    const scale = this.world.laneScale(1, 'longjump');
    const sx = this.world.sx(this.x);
    let y = ground;
    let pose = 'run';
    let height = 0;
    let alpha = 1;
    if (this.state === 'ready') { pose = 'idle'; }
    if (this.state === 'flight') {
      const u = clamp(this.flightT / this.flightDur, 0, 1);
      height = this.peak * Math.sin(Math.PI * u);
      y = ground - height;
      pose = 'jump';
    } else if (this.state === 'landed') {
      pose = 'land';
    }

    // shadow shrinks in the air
    if (height > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - height / (this.H * 0.25), 0.15, 0.6);
    }
    drawAthlete(ctx, {
      x: sx, y: y, scale, phase: this.phase, pose,
      speed: clamp(this.speed / 11, 0, 1), kit: this.game.playerKit,
      glow: 0.16, shadow: height > 0 ? 0.5 : 1
    });
    if (height > 0) ctx.restore();

    if (this.state === 'flight') {
      this.drawTrajectory(ctx, ground, scale);
    }
    if (this.state === 'landed') {
      this.drawMeasurement(ctx, ground, scale);
    }
    this.drawAthleteAura(ctx, sx, y, scale);
  }

  drawAthleteAura(ctx, x, y, scale) {
    const g = ctx.createRadialGradient(x, y - 60 * scale, 0, x, y - 60 * scale, 95 * scale);
    g.addColorStop(0, 'rgba(255,213,130,.045)');
    g.addColorStop(1, 'rgba(255,213,130,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(x - 120 * scale, y - 190 * scale, 240 * scale, 200 * scale);
    ctx.restore();
  }

  drawTrajectory(ctx, ground, scale) {
    const start = this.world.sx(this.takeoffX);
    const end = this.world.sx(this.landingX);
    ctx.save();
    ctx.globalAlpha = 0.33;
    ctx.strokeStyle = 'rgba(247,201,80,.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const x = lerp(start, end, u);
      const y = ground - this.peak * Math.sin(Math.PI * u) - 50 * scale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawMeasurement(ctx, ground, scale) {
    const boardX = this.world.sx(40);
    const landX = this.world.sx(40 + this.result);
    const y = ground + 12;
    ctx.save();
    ctx.strokeStyle = 'rgba(247,201,80,.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(boardX, y); ctx.lineTo(landX, y); ctx.stroke();
    ctx.fillStyle = 'rgba(247,201,80,.8)';
    for (let x = boardX; x <= landX; x += 12) ctx.fillRect(x, y - 3, 1, 6);
    ctx.fillStyle = 'rgba(5,11,22,.86)';
    ctx.strokeStyle = 'rgba(247,201,80,.55)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(landX - 25, y - 25, 50, 17, 2); else ctx.rect(landX - 25, y - 25, 50, 17);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f7c950';
    ctx.font = '700 10px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.result.toFixed(2)}m`, landX, y - 16.5);
    ctx.restore();
  }
}

/* ================================================================== */
/*  JAVELIN                                                            */
/* ================================================================== */
export class JavelinEvent extends BaseEvent {
  constructor(game, options = {}) {
    const id = options.id || 'javelin';
    super(game, id, options);
    this.worldMode = 'javelin';
    this.optAngle = options.optAngle ?? 36;
    this.angleAmp = options.angleAmp ?? 16;
    this.baseResult = options.base ?? 62;
    this.spanResult = options.span ?? 31;
    this.maxResult = options.max ?? 93.4;
    this.isShot = id === 'shotput';
    this.meter = clamp(this.W / 24, 16, 52);
    this.anchor = 0.37;
    this.camX = -(this.W * 0.37) / this.meter;
    this.x = 0;
    this.throwerX = 0;
    this.runTime = 0;
    this.speed = 0;
    this.phase = rand(0, 6);
    this.angle = this.optAngle;
    this.angleTime = 0;
    this.state = 'ready';
    this.result = 0;
    this.flightT = 0;
    this.flightDur = 3.6;
    this.startX = 0;
    this.landX = 36;
    this.peak = 0;
    this.landTimer = 0;
    this.releaseScore = 1;
    this.angleScore = 1;
    this.jumbo = { top: 'OLYMPIA', big: this.isShot ? 'SHOT PUT' : 'JAVELIN', sub: 'FINAL', value: '0.00' };
    this.lastPhase = 0;
    this.trail = [];
    this.liveRank = 8;
  }

  start() {
    this.state = 'run';
    this.runTime = 0;
    this.game.sound.setCrowd(0.023);
  }

  tap() {
    if (this.state === 'run') this.throwSpear();
  }

  throwSpear(auto = false) {
    if (this.state !== 'run') return;
    const x = this.x;
    this.releaseScore = 1 - clamp((36 - x) / 13, 0, 1) * 0.6;
    this.angleScore = 1 - clamp(Math.abs(this.angle - this.optAngle) / 28, 0, 1) * 0.7;
    const precision = Math.max(0, 1 - Math.abs(this.angle - this.optAngle) / 4) * (this.isShot ? 0.35 : 0.8)
      + Math.max(0, 1 - Math.abs(36 - x) / 1.6) * (this.isShot ? 0.25 : 0.5);
    const speedFactor = clamp(this.speed / 10.9, 0, 1);
    if (auto) this.angleScore = 0.68;
    this.result = this.baseResult + this.spanResult * this.releaseScore * this.angleScore * (0.8 + 0.2 * speedFactor) + precision + rand(-0.35, 0.35);
    if (auto) this.result *= 0.9;
    this.result = clamp(this.result, this.maxResult * 0.48, this.maxResult);
    this.throwerX = this.x;
    this.startX = x + 1.2;
    this.landX = 36 + this.result;
    this.peak = this.H * (0.12 + this.result / 450);
    this.flightDur = 3.1 + this.result * 0.007;
    this.flightT = 0;
    this.state = 'flight';
    this.trail = [];
    this.game.sound.javelinThrow();
    this.game.shake = Math.max(this.game.shake, 6);
    this.game.flashScreen(0.22);
    this.game.toast(
      auto ? 'LATE RELEASE' : Math.abs(this.angle - this.optAngle) < 4 ? (this.isShot ? 'PERFECT ARC' : 'PERFECT ANGLE') : (this.isShot ? 'SHOT AWAY' : 'SPEAR AWAY'),
      Math.abs(this.angle - this.optAngle) < 4 ? 'gold' : '', 850
    );
    // Camera expands to follow the whole throw.
    this.camX = (this.startX + this.landX) / 2 - (this.W * 0.5) / this.meter;
  }

  update(dt) {
    this.phase += dt;
    if (this.state === 'ready') return;
    if (this.state === 'run') {
      this.runTime += dt;
      this.angleTime += dt;
      this.angle = this.optAngle + this.angleAmp * Math.sin(this.angleTime * 3.55 - 0.9);
      this.speed = 10.9 * smoothstep(0, 3.5, this.runTime);
      this.x += this.speed * dt;
      this.phase += this.speed * 0.92 * dt;
      if (this.x >= 36.35) {
        this.x = 36.2;
        this.throwSpear(true);
      }
      this.updateCamera(dt, this.x, 3.8);
      this.spawnDust();
    } else if (this.state === 'flight') {
      this.flightT += dt;
      const u = clamp(this.flightT / this.flightDur, 0, 1);
      this.x = lerp(this.startX, this.landX, u);
      const targetMeter = clamp(this.W / 102, 8.2, 18);
      this.meter = lerp(this.meter, targetMeter, 1 - Math.exp(-1.4 * dt));
      const targetCam = (this.startX + this.landX) / 2 - (this.W * 0.5) / this.meter;
      this.camX = lerp(this.camX, targetCam, 1 - Math.exp(-1.8 * dt));
      this.anchor = lerp(this.anchor, 0.5, 1 - Math.exp(-1.6 * dt));
      this.world.setCamera(this.camX, this.meter, this.anchor, 'javelin');
      if (u >= 1) this.land();
    } else if (this.state === 'landed') {
      this.landTimer += dt;
      const targetCam = (this.startX + this.landX) / 2 - (this.W * 0.5) / this.meter;
      this.camX = lerp(this.camX, targetCam, 1 - Math.exp(-1.2 * dt));
      this.world.setCamera(this.camX, this.meter, this.anchor, 'javelin');
      if (this.landTimer > 1.8) {
        this.state = 'done';
        this.done(this.result, { angle: this.angle, release: this.releaseScore });
        return;
      }
    }
    this.liveRank = 1 + this.game.fieldRank(this.id, this.state === 'landed' ? this.result : 0);
    this.jumbo.value = this.state === 'landed' ? this.result.toFixed(1) : this.state === 'flight' ? `${this.angle.toFixed(0)}°` : '0.00';
    this.hudState();
  }

  hudState() {
    const toLine = Math.max(0, 36 - this.x);
    const flying = this.state === 'flight';
    const clockValue = this.state === 'landed'
      ? fmtDist(this.result, 1)
      : flying ? fmtDist(this.result, 1) : toLine.toFixed(1);
    const clockUnit = this.state === 'landed' || flying ? 'm' : 'm';
    const clockLabel = this.state === 'landed' ? 'MEASURED' : flying ? 'PROJECTED' : this.isShot ? 'TO THE CIRCLE' : 'TO FOUL LINE';
    let prompt;
    const tap = this.game.touch ? 'TAP' : '↑';
    if (this.state === 'run') {
      prompt = {
        key: tap, title: this.isShot ? 'PUT AT THE LINE' : 'RELEASE AT THE LINE',
        sub: `Arm angle ${this.angle.toFixed(0)}° — find the gold band`,
        pulse: Math.abs(this.angle - this.optAngle) < 5
      };
    } else if (this.state === 'flight') {
      prompt = { key: '✓', title: this.isShot ? 'THE SHOT IS FLYING' : 'THE SPEAR IS FLYING', sub: 'The stadium is watching', pulse: false };
    } else if (this.state === 'landed') {
      prompt = { key: '✓', title: 'DISTANCE MEASURED', sub: `${this.result.toFixed(2)} metres`, pulse: false };
    } else {
      prompt = { visible: false };
    }
    this.hud({
      clock: clockValue,
      clockUnit,
      clockLabel,
      place: `${this.game.fieldRank(this.id, this.state === 'landed' ? this.result : 0)}`,
      meter: this.speed,
      meterMax: 11.5,
      meterUnit: 'M/S',
      meterLabel: 'APPROACH',
      prompt: { visible: true, ...prompt },
      action: true,
      actionLabel: this.state === 'flight' || this.state === 'landed' ? 'FLY' : this.isShot ? 'PUT' : 'THROW',
      actionSub: this.game.touch ? 'TAP HERE' : 'SPACE / TAP',
      actionHot: this.state === 'run' && this.x > 29,
      actionDisabled: this.state !== 'run',
      javelin: !this.isShot,
      angle: this.angle,
      angleValue: this.angle
    });
    this.game.setMiniBoard(
      this.game.fieldBoard(this.id, this.state === 'landed' ? this.result : null),
      'FIELD ORDER'
    );
  }

  spawnDust() {
    if (this.speed < 3) return;
    const crossed = Math.floor(this.phase / Math.PI);
    if (crossed !== this.lastPhase) {
      this.lastPhase = crossed;
      const x = this.world.sx(this.x) - 10;
      const y = this.game.groundY(1, 'javelin');
      this.game.spawnParticle({
        x, y: y - 2, vx: rand(-40, -8), vy: rand(-24, -4), life: rand(0.3, 0.55),
        size: rand(1.2, 3.2), color: 'rgba(255,216,160,.23)', gravity: 28
      });
    }
  }

  land() {
    this.state = 'landed';
    this.x = this.landX;
    this.landTimer = 0;
    this.game.sound.javelinLand();
    this.game.sound.cheer(1.1);
    this.game.shake = Math.max(this.game.shake, 5);
    const sx = this.world.sx(this.landX);
    const gy = this.game.groundY(1, 'javelin');
    this.game.burst(sx, gy - 5, 28, '#d6c393', 150, 0.75);
    this.game.burst(sx, gy - 5, 18, '#f8e2ad', 100, 0.5);
    this.game.toast(`${this.result.toFixed(2)} M`, 'gold', 1300);
    this.trail = [];
  }

  render(ctx) {
    this.paint();
    const ground = this.game.groundY(1, 'javelin');
    const baseScale = this.world.laneScale(1, 'javelin');
    const zoomScale = clamp(this.meter / clamp(this.W / 24, 16, 52), 0.16, 1);
    const scale = (this.state === 'flight' || this.state === 'landed') ? baseScale * zoomScale : baseScale;
    const athleteX = (this.state === 'flight' || this.state === 'landed') ? this.throwerX : this.x;
    const sx = this.world.sx(athleteX);

    if (this.state === 'run' || this.state === 'ready') {
      const pose = this.state === 'ready' ? 'idle' : 'run';
      drawAthlete(ctx, {
        x: sx, y: ground, scale, phase: this.phase, pose,
        speed: clamp(this.speed / 11, 0, 1), kit: this.game.playerKit,
        glow: 0.18, shadow: 1,
        javelin: this.isShot ? null : { angle: -0.52 }
      });
    } else if (this.state === 'flight') {
      const pose = this.flightT < 0.35 ? 'release' : 'idle';
      drawAthlete(ctx, {
        x: sx, y: ground, scale, phase: this.phase, pose,
        speed: 0.2, kit: this.game.playerKit, glow: 0.2, shadow: 1
      });
    } else {
      drawAthlete(ctx, {
        x: sx, y: ground, scale, phase: this.phase, pose: 'idle',
        speed: 0.1, kit: this.game.playerKit, glow: 0.15, shadow: 1
      });
    }

    if (this.state === 'flight') this.drawSpearFlight(ctx, ground, scale);
    if (this.state === 'landed') this.drawJavelinMeasurement(ctx, ground, scale);
  }

  drawShotFlight(ctx, ground) {
    const u = clamp(this.flightT / this.flightDur, 0, 1);
    const x = this.world.sx(this.x);
    const shoulder = 2 * this.meter;
    const y = ground - shoulder * (1 - u) - this.peak * Math.sin(Math.PI * u);
    const r = clamp(0.42 * this.meter, 5, 15);
    ctx.save();
    // trail
    for (let i = 1; i < 8; i++) {
      const uu = clamp(u - i * 0.018, 0, 1);
      const tx = this.world.sx(lerp(this.startX, this.landX, uu));
      const ty = ground - shoulder * (1 - uu) - this.peak * Math.sin(Math.PI * uu);
      ctx.fillStyle = `rgba(214,222,235,${0.16 * (1 - i / 8)})`;
      ctx.beginPath(); ctx.arc(tx, ty, r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
    g.addColorStop(0, '#f4f7fb');
    g.addColorStop(0.45, '#aeb9c8');
    g.addColorStop(1, '#4f5b6c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  drawSpearFlight(ctx, ground, scale) {
    if (this.isShot) return this.drawShotFlight(ctx, ground);
    const u = clamp(this.flightT / this.flightDur, 0, 1);
    const x = this.world.sx(this.x);
    const shoulder = 2.2 * this.meter;
    const y = ground - shoulder * (1 - u) - this.peak * Math.sin(Math.PI * u);
    const x2 = this.world.sx(lerp(this.startX, this.landX, clamp(u + 0.008, 0, 1)));
    const y2 = ground - shoulder * (1 - clamp(u + 0.008, 0, 1)) - this.peak * Math.sin(Math.PI * clamp(u + 0.008, 0, 1));
    const angle = Math.atan2(y2 - y, x2 - x);
    const len = clamp(2.7 * this.meter, 18, 110);
    const thick = clamp(0.08 * this.meter, 1.1, 3.2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    grad.addColorStop(0, '#6f5733');
    grad.addColorStop(0.45, '#e1c484');
    grad.addColorStop(0.8, '#f7ecc8');
    grad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = grad;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
    ctx.fillStyle = '#f5f8fa';
    const tip = clamp(0.3 * this.meter, 3, 12);
    ctx.beginPath(); ctx.moveTo(len / 2 + tip, 0); ctx.lineTo(len / 2 - tip * 0.7, -tip * 0.55); ctx.lineTo(len / 2 - tip * 0.7, tip * 0.55); ctx.closePath(); ctx.fill();
    ctx.restore();

    // speed trail
    for (let i = 0; i < 7; i++) {
      const uu = clamp(u - i * 0.012, 0, 1);
      const tx = this.world.sx(lerp(this.startX, this.landX, uu));
      const ty = ground - shoulder * (1 - uu) - this.peak * Math.sin(Math.PI * uu);
      ctx.fillStyle = `rgba(255,231,164,${0.13 * (1 - i / 7)})`;
      ctx.beginPath(); ctx.arc(tx, ty, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawJavelinMeasurement(ctx, ground, scale) {
    const lineX = this.world.sx(36);
    const landX = this.world.sx(this.landX);
    const y = ground + 16;
    ctx.save();
    ctx.strokeStyle = 'rgba(247,201,80,.82)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(lineX, y); ctx.lineTo(landX, y); ctx.stroke();
    ctx.fillStyle = 'rgba(247,201,80,.75)';
    for (let x = lineX; x <= landX; x += 10) ctx.fillRect(x, y - 3, 1, 6);
    ctx.fillStyle = 'rgba(5,11,22,.88)';
    ctx.strokeStyle = 'rgba(247,201,80,.55)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(landX - 28, y - 28, 56, 18, 2); else ctx.rect(landX - 28, y - 28, 56, 18);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f7c950';
    ctx.font = '700 11px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.result.toFixed(2)}m`, landX, y - 19);
    ctx.restore();
  }
}

/* ================================================================== */
/*  SKI JUMP                                                           */
/* ================================================================== */
export class SkiJumpEvent extends BaseEvent {
  constructor(game, options = {}) {
    super(game, 'skijump', options);
    this.worldMode = 'skijump';
    this.meter = clamp(this.W / 25, 16, 50);
    this.anchor = 0.36;
    this.camX = -(this.W * 0.36) / this.meter;
    this.x = 0;
    this.runTime = 0;
    this.speed = 0;
    this.phase = rand(0, 6);
    this.state = 'ready';
    this.quality = 0;
    this.result = 0;
    this.extension = 0;
    this.extensionAt = 0;
    this.extended = false;
    this.flightT = 0;
    this.flightDur = 3.4;
    this.takeoffX = 0;
    this.landingX = 0;
    this.peak = 0;
    this.landTimer = 0;
    this.jumbo = { top: 'OLYMPIA', big: 'SKI JUMP', sub: 'WINTER FINAL', value: '0.0' };
    this.liveRank = 8;
  }

  start() {
    this.state = 'run';
    this.runTime = 0;
    this.game.sound.setCrowd(0.024);
  }

  tap() {
    if (this.state === 'run') {
      this.jump();
    } else if (this.state === 'flight' && !this.extended) {
      const u = this.flightT / this.flightDur;
      if (u > 0.32 && u < 0.72) {
        this.extended = true;
        this.extensionAt = u;
        this.extension = 2.4 + (1 - Math.abs(u - 0.5) * 2) * 2.2;
        this.result += this.extension;
        this.landingX += this.extension;
        this.game.sound.tone(820, 0.14, 0.06, 'sine', 1180);
        this.game.toast(`EXTENDED — +${this.extension.toFixed(1)} M`, 'gold', 1000);
        this.game.burst(this.world.sx(this.x), this.game.groundY(1, 'skijump') - this.height(), 12, '#dfefff', 90, 0.6);
      } else {
        this.extended = true;
        this.game.toast(u <= 0.32 ? 'TOO EARLY' : 'TOO LATE', 'red', 800);
      }
    }
  }

  height() {
    if (this.state !== 'flight') return 0;
    return this.peak * Math.sin(Math.PI * clamp(this.flightT / this.flightDur, 0, 1));
  }

  jump(auto = false) {
    if (this.state !== 'run') return;
    const x = this.x;
    let q;
    if (x >= 37.4 && x <= 40.8) q = 1 - Math.abs(x - 39.1) / 3.4 * 0.28;
    else if (x < 37.4) q = clamp(0.24 + Math.max(0, x - 30) / 7.4 * 0.6, 0.24, 0.82);
    else q = 0.4;
    if (auto) q = Math.min(q, 0.34);
    const sf = clamp(this.speed / 13.2, 0, 1);
    this.quality = q;
    this.takeoffX = 40.5;
    this.result = 87 + q * 35 + sf * 9 + rand(-0.8, 0.8);
    if (auto) this.result *= 0.9;
    this.result = clamp(this.result, 78, 143);
    this.landingX = this.takeoffX + this.result;
    this.peak = this.H * (0.16 + sf * 0.08);
    this.flightDur = 2.9 + this.result * 0.012;
    this.flightT = 0;
    this.state = 'flight';
    this.game.sound.whoosh(1);
    this.game.sound.cheer(0.7);
    this.game.shake = Math.max(this.game.shake, 4);
    this.game.toast(x < 37.4 ? 'EARLY LIP' : x > 40.8 ? 'LATE LIP' : 'CLEAN LAUNCH', x < 37.4 || x > 40.8 ? 'red' : 'gold', 760);
  }

  update(dt) {
    this.phase += dt;
    if (this.state === 'ready') return;
    if (this.state === 'run') {
      this.runTime += dt;
      this.speed = 13.2 * smoothstep(0, 3.4, this.runTime);
      this.x += this.speed * dt;
      this.phase += this.speed * 0.8 * dt;
      if (this.x > 41.4) this.jump(true);
      this.updateCamera(dt, this.x, 3.4);
      this.spawnSpray();
    } else if (this.state === 'flight') {
      this.flightT += dt;
      const u = clamp(this.flightT / this.flightDur, 0, 1);
      const baseLandingX = this.landingX - this.extension;
      this.x = lerp(this.takeoffX, baseLandingX, u) + this.extension * smoothstep(this.extensionAt, 1, u);
      const targetMeter = clamp(this.W / 155, 3.4, 10);
      this.meter = lerp(this.meter, targetMeter, 1 - Math.exp(-1.5 * dt));
      const targetCam = (this.takeoffX + this.landingX) / 2 - (this.W * 0.5) / this.meter;
      this.camX = lerp(this.camX, targetCam, 1 - Math.exp(-1.9 * dt));
      this.anchor = lerp(this.anchor, 0.5, 1 - Math.exp(-1.6 * dt));
      this.world.setCamera(this.camX, this.meter, this.anchor, 'skijump');
      if (u >= 1) this.land();
    } else if (this.state === 'landed') {
      this.landTimer += dt;
      this.updateCamera(dt, this.landingX, 2);
      if (this.landTimer > 2.1) {
        this.state = 'done';
        this.done(this.result, { quality: this.quality, extended: this.extended });
        return;
      }
    }
    this.liveRank = 1 + this.game.fieldRank('skijump', this.state === 'landed' ? this.result : 0);
    this.jumbo.value = this.state === 'landed' ? this.result.toFixed(1) : this.state === 'flight' ? 'AIR' : '0.0';
    this.hudState();
  }

  hudState() {
    const toLip = Math.max(0, 40.5 - this.x);
    const flying = this.state === 'flight';
    const clock = this.state === 'landed' ? fmtDist(this.result, 1) : flying ? fmtDist(this.result, 1) : toLip.toFixed(1);
    const label = this.state === 'landed' ? 'MEASURED' : flying ? 'PROJECTED' : 'TO THE LIP';
    const tap = this.game.touch ? 'TAP' : '↑';
    let prompt;
    if (this.state === 'run') {
      prompt = {
        key: tap, title: this.x > 34 ? 'LAUNCH AT THE LIP' : 'BUILD THE IN-RUN',
        sub: this.x > 34 ? 'Tap as you reach the edge' : `${toLip.toFixed(1)}m to the lip — stay tucked`,
        pulse: this.x > 36.6
      };
    } else if (flying) {
      prompt = this.extended
        ? { key: '✓', title: 'PERFECT EXTENSION', sub: 'Hold the line all the way down', pulse: false }
        : { key: tap, title: 'TAP AT THE APEX', sub: 'Stretch the jump for extra metres', pulse: true };
    } else if (this.state === 'landed') {
      prompt = { key: '✓', title: 'JUMP MEASURED', sub: `${this.result.toFixed(1)} metres`, pulse: false };
    } else {
      prompt = { visible: false };
    }
    this.hud({
      clock, clockUnit: this.state === 'landed' || flying ? 'm' : 'm', clockLabel: label,
      place: `${this.game.fieldRank('skijump', this.state === 'landed' ? this.result : 0)}`,
      meter: this.speed, meterMax: 13.5, meterUnit: 'M/S', meterLabel: 'IN-RUN SPEED',
      prompt: { visible: true, ...prompt },
      action: true,
      actionLabel: flying ? (this.extended ? 'LOCKED' : 'EXTEND') : 'LAUNCH',
      actionSub: this.game.touch ? 'TAP HERE' : 'SPACE / TAP',
      actionHot: this.state === 'run' ? this.x > 36.5 : (flying && !this.extended && this.flightT / this.flightDur > 0.3 && this.flightT / this.flightDur < 0.72),
      actionDisabled: this.state === 'landed' || (flying && this.extended)
    });
    this.game.setMiniBoard(this.game.fieldBoard('skijump', this.state === 'landed' ? this.result : null), 'FIELD ORDER');
  }

  spawnSpray() {
    if (this.speed < 4) return;
    const crossed = Math.floor(this.phase / 2.2);
    if (crossed !== this.lastPhase) {
      this.lastPhase = crossed;
      this.game.spawnParticle({
        x: this.world.sx(this.x) - 8, y: this.game.groundY(1, 'skijump') - 2,
        vx: rand(-55, -12), vy: rand(-28, -6), life: rand(0.3, 0.65),
        size: rand(1.5, 4), color: `rgba(226,246,255,${rand(0.2, 0.4)})`, gravity: 24, drag: 0.4
      });
    }
  }

  land() {
    this.state = 'landed';
    this.x = this.landingX;
    this.landTimer = 0;
    this.game.sound.sand(1);
    this.game.sound.cheer(1);
    this.game.shake = Math.max(this.game.shake, 5);
    const sx = this.world.sx(this.landingX);
    const gy = this.game.groundY(1, 'skijump');
    this.game.burst(sx, gy - 6, 34, '#e4f3ff', 170, 0.9);
    this.game.burst(sx, gy - 6, 16, '#ffffff', 120, 0.6);
    this.game.toast(`${this.result.toFixed(1)} M`, 'gold', 1400);
  }

  render(ctx) {
    this.paint();
    const ground = this.game.groundY(1, 'skijump');
    const zoomScale = clamp(this.meter / clamp(this.W / 25, 16, 50), 0.2, 1);
    const scale = this.world.laneScale(1, 'skijump') * zoomScale;
    const sx = this.world.sx(this.x);
    const height = this.height();
    let pose = this.state === 'ready' ? 'idle' : 'run';
    if (this.state === 'flight') pose = 'jump';
    if (this.state === 'landed') pose = 'land';
    drawAthlete(ctx, {
      x: sx, y: ground - height, scale, phase: this.phase, pose,
      speed: clamp(this.speed / 13, 0, 1), kit: this.game.playerKit,
      glow: 0.18, shadow: height > 0 ? 0.45 : 1, skis: true,
      flip: false
    });
    if (this.state === 'landed') this.drawMeasurement(ctx, ground);
  }

  drawMeasurement(ctx, ground) {
    const lineX = this.world.sx(this.takeoffX);
    const landX = this.world.sx(this.landingX);
    const y = ground + 16;
    ctx.save();
    ctx.strokeStyle = 'rgba(143,228,255,.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(lineX, y); ctx.lineTo(landX, y); ctx.stroke();
    ctx.fillStyle = 'rgba(143,228,255,.7)';
    for (let x = lineX; x <= landX; x += 12) ctx.fillRect(x, y - 3, 1, 6);
    ctx.fillStyle = 'rgba(5,11,22,.9)';
    ctx.strokeStyle = 'rgba(143,228,255,.6)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(landX - 30, y - 28, 60, 18, 2); else ctx.rect(landX - 30, y - 28, 60, 18);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bdeaff';
    ctx.font = '700 11px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.result.toFixed(1)}m`, landX, y - 19);
    ctx.restore();
  }
}

/* ================================================================== */
/*  CURLING                                                            */
/* ================================================================== */
export class CurlingEvent extends BaseEvent {
  constructor(game, options = {}) {
    super(game, 'curling', options);
    this.worldMode = 'curling';
    this.meter = clamp(this.W / 36, 14, 34);
    this.anchor = 0.5;
    this.camX = 1.5;
    this.x = 3.2;
    this.state = 'ready';
    this.aimT = 0;
    this.power = 0;
    this.v = 0;
    this.sweeps = 0;
    this.result = 0;
    this.stopTimer = 0;
    this.target = 27.5;
    this.jumbo = { top: 'OLYMPIA', big: 'CURLING', sub: 'WINTER FINAL', value: '—' };
    this.trail = [];
  }

  start() {
    this.state = 'aim';
    this.aimT = 0;
    this.game.sound.setCrowd(0.02);
    this.game.toast('JUDGE THE WEIGHT', 'gold', 1000);
  }

  tap() {
    if (this.state === 'aim') {
      this.power = clamp(0.5 - 0.5 * Math.cos(this.aimT * 2.3), 0.05, 1);
      this.v = 8.2 + this.power * 4.9;
      this.state = 'slide';
      this.sweeps = 0;
      this.game.sound.whoosh(0.8);
      this.game.shake = Math.max(this.game.shake, 2);
      this.game.toast(`RELEASED — ${Math.round(this.power * 100)}% WEIGHT`, 'gold', 850);
    } else if (this.state === 'slide' && this.sweeps < 5) {
      this.sweeps++;
      this.v += 0.28;
      this.game.sound.step(0.45);
      this.game.burst(this.world.sx(this.x - 0.6), this.game.groundY(1, 'curling') - 3, 3, 'rgba(214,246,255,.55)', 50, 0.35);
    }
  }

  update(dt) {
    this.phase += dt;
    if (this.state === 'ready') return;
    if (this.state === 'aim') {
      this.aimT += dt;
      this.power = clamp(0.5 - 0.5 * Math.cos(this.aimT * 2.3), 0.05, 1);
      this.updateCamera(dt, 14, 11);
      this.hudState();
      return;
    }
    if (this.state === 'slide') {
      this.x += this.v * dt;
      this.v = Math.max(0, this.v - 2.35 * dt);
      const targetCam = clamp(this.x - 7, 2, 22);
      this.camX = lerp(this.camX, targetCam, 1 - Math.exp(-1.6 * dt));
      this.world.setCamera(this.camX, this.meter, this.anchor, 'curling');
      if (this.v <= 0.08) {
        this.v = 0;
        this.state = 'stopped';
        this.stopTimer = 0;
        this.result = clamp(Math.abs(this.x - this.target) * 100 + rand(-3, 3), 1, 420);
        this.game.sound.sand(0.6);
        this.game.sound.cheer(this.result < 40 ? 1.1 : 0.45);
        this.game.toast(this.result < 8 ? 'ON THE BUTTON!' : this.result < 40 ? 'IN THE HOUSE' : 'TOO HEAVY / LIGHT', this.result < 40 ? 'gold' : 'red', 1200);
        this.game.burst(this.world.sx(this.x), this.game.groundY(1, 'curling') - 3, 16, '#dff5ff', 90, 0.6);
      }
      this.hudState();
      return;
    }
    if (this.state === 'stopped') {
      this.stopTimer += dt;
      this.hudState();
      if (this.stopTimer > 2.1) {
        this.state = 'done';
        this.done(this.result, { sweeps: this.sweeps });
        return;
      }
    }
  }

  hudState() {
    const aiming = this.state === 'aim';
    const sliding = this.state === 'slide';
    const stopped = this.state === 'stopped' || this.state === 'done';
    const remaining = Math.abs(this.target - this.x);
    const clock = stopped ? String(Math.round(this.result)) : sliding ? `${remaining.toFixed(1)}` : `${Math.round(this.power * 100)}`;
    const unit = stopped ? 'cm' : sliding ? 'm' : '%';
    const label = stopped ? 'FROM THE BUTTON' : sliding ? 'TO THE BUTTON' : 'STONE WEIGHT';
    const tap = this.game.touch ? 'TAP' : 'SPACE';
    let prompt;
    if (aiming) prompt = { key: tap, title: 'FIND THE WEIGHT', sub: `${Math.round(this.power * 100)}% — tap to release at the button`, pulse: this.power > 0.62 && this.power < 0.86 };
    else if (sliding) prompt = { key: tap, title: 'SWEEP IT HOME', sub: this.sweeps < 5 ? `Tap to sweep · ${5 - this.sweeps} left` : 'The stone is running', pulse: this.sweeps < 5 };
    else prompt = { key: '✓', title: this.result < 40 ? 'IN THE HOUSE' : 'STONE AT REST', sub: `${Math.round(this.result)} cm from the button`, pulse: false };
    this.hud({
      clock, clockUnit: unit, clockLabel: label,
      place: stopped ? `${this.game.fieldRank('curling', this.result)}` : '—',
      meter: aiming ? this.power * 100 : this.v * 10, meterMax: aiming ? 100 : 140,
      meterUnit: aiming ? '%' : 'KM/H', meterLabel: aiming ? 'STONE WEIGHT' : 'SLIDE SPEED',
      prompt: { visible: true, ...prompt },
      action: true,
      actionLabel: aiming ? 'SLIDE' : sliding ? 'SWEEP' : 'SETTLED',
      actionSub: this.game.touch ? 'TAP HERE' : 'SPACE / TAP',
      actionHot: aiming ? (this.power > 0.62 && this.power < 0.86) : sliding,
      actionDisabled: stopped || (sliding && this.sweeps >= 5)
    });
    this.jumbo.value = stopped ? `${Math.round(this.result)}cm` : sliding ? fmtDist(this.x, 1) : `${Math.round(this.power * 100)}%`;
    this.game.setMiniBoard(this.game.fieldBoard('curling', stopped ? this.result : null), 'HOUSE ORDER');
  }

  render(ctx) {
    this.paint();
    const ground = this.game.groundY(1, 'curling');
    const scale = this.world.laneScale(1, 'curling');
    const sxStone = this.world.sx(this.x);
    // athlete at the hack with a broom
    const athleteX = this.world.sx(2.2);
    drawAthlete(ctx, {
      x: athleteX, y: ground, scale: scale * 0.95, phase: this.phase * 0.5,
      pose: 'idle', speed: 0.1, kit: this.game.playerKit, glow: 0.15, shadow: 1
    });
    // released stone
    this.drawStone(ctx, sxStone, ground - 0.08 * this.meter, this.meter);
    // aim guide
    if (this.state === 'aim') {
      ctx.save();
      ctx.strokeStyle = 'rgba(143,228,255,.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      const tx = this.world.sx(this.x + 4 + this.power * 24);
      ctx.beginPath(); ctx.moveTo(sxStone, ground - 2); ctx.lineTo(tx, ground - 2); ctx.stroke();
      ctx.restore();
    }
    if (this.state === 'stopped' || this.state === 'done') this.drawMeasure(ctx, ground);
  }

  drawStone(ctx, x, y, meter) {
    const r = clamp(0.42 * meter, 5, 15);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 2, r * 1.05, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, '#8d96a5');
    g.addColorStop(0.45, '#4c5666');
    g.addColorStop(1, '#252d3a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(230,244,255,.42)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#b93b34';
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.08, r * 0.32, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath(); ctx.moveTo(x - r * 0.28, y - r * 0.5); ctx.lineTo(x + r * 0.3, y - r * 0.9); ctx.stroke();
    ctx.restore();
  }

  drawMeasure(ctx, ground) {
    const sx = this.world.sx(this.x);
    const bx = this.world.sx(this.target);
    const y = ground + 14;
    ctx.save();
    ctx.strokeStyle = 'rgba(143,228,255,.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(sx, y); ctx.stroke();
    ctx.fillStyle = 'rgba(5,11,22,.9)';
    ctx.strokeStyle = 'rgba(143,228,255,.6)';
    const mid = (sx + bx) / 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(mid - 28, y - 26, 56, 17, 2); else ctx.rect(mid - 28, y - 26, 56, 17);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bdeaff';
    ctx.font = '700 10px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(this.result)} cm`, mid, y - 17.5);
    ctx.restore();
  }
}
