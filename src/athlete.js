import { clamp, lerp, shade, rgba, TAU } from './utils.js';

export const KITS = {
  player: {
    primary: '#10264e', secondary: '#f4c84f', accent: '#fff4cf', trim: '#72e6ff',
    skin: '#9a6444', skinDark: '#6f422b', hair: '#191310', shoe: '#f5d357', sock: '#f7f3e8'
  },
  jpn: {
    primary: '#e8e7e2', secondary: '#c62d35', accent: '#f6c94b', trim: '#151a25',
    skin: '#d5a079', skinDark: '#a66b49', hair: '#171310', shoe: '#f2c544', sock: '#f5f3eb'
  },
  fra: {
    primary: '#1d3c86', secondary: '#f3f0e8', accent: '#e4493e', trim: '#8eb6ff',
    skin: '#7a4c33', skinDark: '#55311f', hair: '#17120f', shoe: '#f0d55a', sock: '#f4f0e6'
  },
  nga: {
    primary: '#0d7448', secondary: '#e8f3e6', accent: '#d7b64a', trim: '#66f0ae',
    skin: '#6d3f28', skinDark: '#4a2918', hair: '#15100d', shoe: '#e9cb4b', sock: '#f5f1e8'
  },
  ger: {
    primary: '#1b1c22', secondary: '#e0473f', accent: '#f2c848', trim: '#ff8b65',
    skin: '#c08a64', skinDark: '#8e5b3d', hair: '#6b4a2d', shoe: '#f3cf52', sock: '#f4f1e8'
  },
  bra: {
    primary: '#e9c735', secondary: '#11734c', accent: '#f7f2df', trim: '#55eaa0',
    skin: '#8e5838', skinDark: '#63371f', hair: '#241813', shoe: '#f5f0dc', sock: '#f3efe4'
  },
  ken: {
    primary: '#b7222b', secondary: '#16181e', accent: '#e8bf4c', trim: '#ff7f74',
    skin: '#68402d', skinDark: '#452618', hair: '#14100d', shoe: '#e8c94e', sock: '#f1ede2'
  },
  cro: {
    primary: '#e7e6df', secondary: '#b82b37', accent: '#1f3b7c', trim: '#f3d15a',
    skin: '#c58d67', skinDark: '#916042', hair: '#39281d', shoe: '#f3ce51', sock: '#f4f0e8'
  }
};

function legPoints(hip, phase, lean, out) {
  const thighA = 0.92 * Math.sin(phase) + 0.08 + lean * 0.12;
  const bend = 0.2 + 1.5 * Math.max(0, Math.sin(phase + 0.18));
  const calfA = thighA - bend;
  const thighLen = 27;
  const calfLen = 26;
  const knee = {
    x: hip.x + Math.sin(thighA) * thighLen,
    y: hip.y + Math.cos(thighA) * thighLen
  };
  const ankle = {
    x: knee.x + Math.sin(calfA) * calfLen,
    y: knee.y + Math.cos(calfA) * calfLen
  };
  const footA = clamp(calfA + 1.35, 0.22, 1.5);
  const toe = {
    x: ankle.x + Math.sin(footA) * 11,
    y: ankle.y + Math.cos(footA) * 11
  };
  out.hip = hip; out.knee = knee; out.ankle = ankle; out.toe = toe;
  out.thighA = thighA; out.calfA = calfA; out.footA = footA;
  return out;
}

function armPoints(shoulder, phase, out) {
  const upperA = -0.92 * Math.sin(phase) + 0.12;
  const foreA = upperA + 1.48;
  const upperLen = 17;
  const foreLen = 16;
  const elbow = {
    x: shoulder.x + Math.sin(upperA) * upperLen,
    y: shoulder.y + Math.cos(upperA) * upperLen
  };
  const hand = {
    x: elbow.x + Math.sin(foreA) * foreLen,
    y: elbow.y + Math.cos(foreA) * foreLen
  };
  out.shoulder = shoulder; out.elbow = elbow; out.hand = hand;
  out.upperA = upperA; out.foreA = foreA;
  return out;
}

function makeSkeleton(pose, phase, speed) {
  const sk = { pose, legs: [], arms: [], hip: null, chest: null, head: null, neck: null };
  let lean = 0.2 + clamp(speed, 0, 1) * 0.12;
  const bob = Math.sin(phase * 2) * 1.1;
  const hip = { x: 0, y: -57 + bob };
  let chest, head, neck, shoulder;

  if (pose === 'run') {
    chest = { x: hip.x + Math.sin(lean) * 39, y: hip.y - Math.cos(lean) * 39 };
    neck = { x: chest.x + 4, y: chest.y - 7 };
    head = { x: chest.x + 9.5, y: chest.y - 22 + Math.sin(phase * 2 + 0.4) * 1.2 };
    shoulder = { x: chest.x - 1, y: chest.y + 4 };

    const l1 = legPoints(hip, phase, lean, {});
    const l2 = legPoints(hip, phase + Math.PI, lean, {});
    l1.back = l1.knee.x < l2.knee.x;
    l2.back = !l1.back;
    sk.legs = [l1, l2];

    const a1 = armPoints(shoulder, phase + Math.PI, {});
    const a2 = armPoints(shoulder, phase, {});
    a1.back = a1.elbow.x < a2.elbow.x;
    a2.back = !a1.back;
    sk.arms = [a1, a2];
    sk.throwHand = { x: chest.x - 2, y: chest.y - 34 };
  } else if (pose === 'walk') {
    lean = 0.04;
    chest = { x: hip.x + Math.sin(lean) * 38, y: hip.y - Math.cos(lean) * 38 };
    neck = { x: chest.x + 3, y: chest.y - 7 };
    head = { x: chest.x + 8, y: chest.y - 22 };
    shoulder = { x: chest.x - 1, y: chest.y + 4 };
    const l1 = legPoints(hip, phase * 0.64, lean, {});
    const l2 = legPoints(hip, phase * 0.64 + Math.PI, lean, {});
    l1.back = l1.knee.x < l2.knee.x; l2.back = !l1.back;
    sk.legs = [l1, l2];
    const a1 = armPoints(shoulder, phase * 0.6 + Math.PI, {});
    const a2 = armPoints(shoulder, phase * 0.6, {});
    a1.back = true; a2.back = false;
    sk.arms = [a1, a2];
  } else if (pose === 'idle') {
    lean = 0.045;
    chest = { x: hip.x + Math.sin(lean) * 39, y: hip.y - Math.cos(lean) * 39 };
    neck = { x: chest.x + 3, y: chest.y - 7 };
    head = { x: chest.x + 8.5, y: chest.y - 22 };
    shoulder = { x: chest.x - 1, y: chest.y + 4 };
    const breathe = Math.sin(phase * 0.8) * 0.8;
    hip.y += breathe * 0.25;
    chest.y += breathe;
    head.y += breathe;
    sk.legs = [
      { hip, knee: { x: -6, y: -31 }, ankle: { x: -9, y: -3 }, toe: { x: 3, y: -1 }, back: true },
      { hip, knee: { x: 7, y: -31 }, ankle: { x: 10, y: -3 }, toe: { x: 22, y: -1 }, back: false }
    ];
    sk.arms = [
      { shoulder, elbow: { x: shoulder.x - 10, y: shoulder.y + 15 }, hand: { x: shoulder.x - 5, y: shoulder.y + 27 }, back: true },
      { shoulder, elbow: { x: shoulder.x + 8, y: shoulder.y + 16 }, hand: { x: shoulder.x + 4, y: shoulder.y + 29 }, back: false }
    ];
  } else if (pose === 'victory') {
    lean = -0.04;
    hip.y = -58;
    chest = { x: hip.x + Math.sin(lean) * 40, y: hip.y - Math.cos(lean) * 40 };
    neck = { x: chest.x + 2, y: chest.y - 7 };
    head = { x: chest.x + 7, y: chest.y - 23 };
    shoulder = { x: chest.x - 1, y: chest.y + 4 };
    sk.legs = [
      { hip, knee: { x: -10, y: -31 }, ankle: { x: -15, y: -2 }, toe: { x: -3, y: 0 }, back: true },
      { hip, knee: { x: 9, y: -31 }, ankle: { x: 13, y: -2 }, toe: { x: 24, y: 0 }, back: false }
    ];
    sk.arms = [
      { shoulder, elbow: { x: shoulder.x + 12, y: shoulder.y - 13 }, hand: { x: shoulder.x + 17, y: shoulder.y - 29 }, back: true },
      { shoulder, elbow: { x: shoulder.x - 10, y: shoulder.y - 16 }, hand: { x: shoulder.x - 7, y: shoulder.y - 33 }, back: false }
    ];
    sk.medal = true;
  } else if (pose === 'crouch' || pose === 'set') {
    const set = pose === 'set';
    hip.x = set ? 1 : 0;
    hip.y = set ? -47 : -39;
    lean = set ? 1.04 : 0.94;
    chest = { x: hip.x + Math.sin(lean) * 36, y: hip.y - Math.cos(lean) * 36 };
    neck = { x: chest.x + 7, y: chest.y - 5 };
    head = { x: chest.x + 15, y: chest.y - 16 };
    shoulder = { x: chest.x - 2, y: chest.y + 3 };
    sk.legs = [
      { hip, knee: { x: -23, y: hip.y + 16 }, ankle: { x: -46, y: -4 }, toe: { x: -34, y: -1 }, back: true, start: true },
      { hip, knee: { x: 17, y: hip.y + 13 }, ankle: { x: 13, y: -3 }, toe: { x: 26, y: -1 }, back: false, start: true }
    ];
    sk.arms = [
      { shoulder, elbow: { x: shoulder.x + 8, y: shoulder.y + 22 }, hand: { x: 41, y: -2 }, back: true, start: true },
      { shoulder, elbow: { x: shoulder.x + 17, y: shoulder.y + 20 }, hand: { x: 52, y: -1 }, back: false, start: true }
    ];
  } else if (pose === 'jump') {
    lean = 0.05;
    hip.y = -66;
    chest = { x: 2, y: -102 };
    neck = { x: 5, y: -109 };
    head = { x: 12, y: -124 };
    shoulder = { x: 1, y: -98 };
    sk.legs = [
      { hip, knee: { x: 26, y: -57 }, ankle: { x: 41, y: -39 }, toe: { x: 51, y: -34 }, back: false },
      { hip, knee: { x: -17, y: -50 }, ankle: { x: -30, y: -66 }, toe: { x: -35, y: -51 }, back: true }
    ];
    sk.arms = [
      { shoulder, elbow: { x: -14, y: -115 }, hand: { x: -5, y: -129 }, back: true },
      { shoulder, elbow: { x: 16, y: -118 }, hand: { x: 30, y: -126 }, back: false }
    ];
  } else if (pose === 'land') {
    lean = 0.65;
    hip.y = -43;
    chest = { x: 18, y: -75 };
    neck = { x: 23, y: -81 };
    head = { x: 33, y: -93 };
    shoulder = { x: 16, y: -71 };
    sk.legs = [
      { hip, knee: { x: -9, y: -24 }, ankle: { x: -20, y: -3 }, toe: { x: -10, y: -1 }, back: true },
      { hip, knee: { x: 24, y: -24 }, ankle: { x: 31, y: -3 }, toe: { x: 42, y: -1 }, back: false }
    ];
    sk.arms = [
      { shoulder, elbow: { x: 34, y: -59 }, hand: { x: 48, y: -55 }, back: true },
      { shoulder, elbow: { x: 2, y: -54 }, hand: { x: -6, y: -44 }, back: false }
    ];
  } else if (pose === 'throw') {
    lean = -0.11;
    hip.y = -58;
    chest = { x: 7, y: -95 };
    neck = { x: 10, y: -102 };
    head = { x: 18, y: -116 };
    shoulder = { x: 7, y: -91 };
    sk.legs = [
      { hip, knee: { x: -18, y: -35 }, ankle: { x: -27, y: -3 }, toe: { x: -15, y: -1 }, back: true },
      { hip, knee: { x: 19, y: -34 }, ankle: { x: 27, y: -3 }, toe: { x: 39, y: -1 }, back: false }
    ];
    sk.arms = [
      { shoulder, elbow: { x: -8, y: -112 }, hand: { x: -19, y: -126 }, back: true },
      { shoulder, elbow: { x: 28, y: -102 }, hand: { x: 40, y: -90 }, back: false }
    ];
    sk.throwHand = { x: -19, y: -126 };
  } else if (pose === 'release') {
    lean = 0.16;
    hip.y = -60;
    chest = { x: 7, y: -98 };
    neck = { x: 9, y: -105 };
    head = { x: 17, y: -119 };
    shoulder = { x: 7, y: -94 };
    sk.legs = [
      { hip, knee: { x: -20, y: -37 }, ankle: { x: -31, y: -3 }, toe: { x: -19, y: -1 }, back: true },
      { hip, knee: { x: 23, y: -32 }, ankle: { x: 31, y: -2 }, toe: { x: 43, y: 0 }, back: false }
    ];
    sk.arms = [
      { shoulder, elbow: { x: 23, y: -108 }, hand: { x: 38, y: -117 }, back: true },
      { shoulder, elbow: { x: 17, y: -80 }, hand: { x: 9, y: -68 }, back: false }
    ];
    sk.throwHand = { x: 38, y: -117 };
  } else {
    return makeSkeleton('idle', phase, speed);
  }

  sk.legs.forEach(l => { l.thighA = Math.atan2(l.knee.x - l.hip.x, l.knee.y - l.hip.y); l.calfA = Math.atan2(l.ankle.x - l.knee.x, l.ankle.y - l.knee.y); });
  sk.hip = hip; sk.chest = chest; sk.head = head; sk.neck = neck; sk.shoulder = shoulder;
  sk.lean = lean;
  return sk;
}

function limb(ctx, a, b, width, color, dark, light) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = dark;
  ctx.lineWidth = width + 1.9;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  if (light) {
    ctx.strokeStyle = light;
    ctx.lineWidth = Math.max(1, width * 0.2);
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x + width * 0.2, a.y - width * 0.18);
    ctx.lineTo(b.x + width * 0.18, b.y - width * 0.16);
    ctx.stroke();
    ctx.globalAlpha /= 0.8;
  }
}

function drawShoe(ctx, leg, kit, alpha = 1) {
  const { ankle, toe, footA } = leg;
  const dx = Math.sin(footA), dy = Math.cos(footA);
  const nx = -dy, ny = dx;
  const heel = { x: ankle.x - dx * 4.5, y: ankle.y - dy * 4.5 };
  const tip = { x: toe.x + dx * 1.8, y: toe.y + dy * 1.8 };
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.moveTo(heel.x + nx * 4.3, heel.y + ny * 4.3);
  ctx.quadraticCurveTo(tip.x + nx * 3.2, tip.y + ny * 3.2, tip.x, tip.y);
  ctx.lineTo(heel.x - nx * 3.4, heel.y - ny * 3.4);
  ctx.closePath();
  ctx.fillStyle = kit.shoe;
  ctx.fill();
  ctx.strokeStyle = shade(kit.shoe, -0.48);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(heel.x + nx * 2.2, heel.y + ny * 2.2);
  ctx.quadraticCurveTo(tip.x + nx * 2.2, tip.y + ny * 2.2, tip.x, tip.y);
  ctx.strokeStyle = 'rgba(255,255,255,.82)';
  ctx.lineWidth = 1.15;
  ctx.stroke();
  ctx.globalAlpha /= alpha;
}

function drawMedal(ctx, kit) {
  ctx.save();
  ctx.translate(10, -84);
  ctx.strokeStyle = 'rgba(255,210,80,.72)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(2, 10, 0, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.quadraticCurveTo(2, 9, 0, 14); ctx.stroke();
  const grad = ctx.createRadialGradient(-1, 13, 0, 0, 15, 6);
  grad.addColorStop(0, '#fff3b1'); grad.addColorStop(0.5, '#f0c84d'); grad.addColorStop(1, '#a87518');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 16, 5.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.restore();
}

function drawJavelin(ctx, hand, angle, kit) {
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(angle);
  const grad = ctx.createLinearGradient(0, -30, 0, 30);
  grad.addColorStop(0, '#e8d4a2'); grad.addColorStop(0.5, '#a68a58'); grad.addColorStop(1, '#e4cd98');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(50, 0); ctx.stroke();
  ctx.strokeStyle = '#6c542f'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(10, 0); ctx.stroke();
  ctx.fillStyle = '#e9edf1';
  ctx.beginPath(); ctx.moveTo(50, 0); ctx.lineTo(39, -3.3); ctx.lineTo(39, 3.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTorso(ctx, sk, kit) {
  const hip = sk.hip, chest = sk.chest;
  const dx = chest.x - hip.x, dy = chest.y - hip.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const hipW = 7.3, chestW = 11.5;
  const hipL = { x: hip.x + nx * hipW, y: hip.y + ny * hipW };
  const hipR = { x: hip.x - nx * hipW, y: hip.y - ny * hipW };
  const chestL = { x: chest.x + nx * chestW, y: chest.y + ny * chestW };
  const chestR = { x: chest.x - nx * chestW, y: chest.y - ny * chestW };

  // shorts
  ctx.beginPath();
  ctx.moveTo(hipL.x - 1, hipL.y - 1);
  ctx.quadraticCurveTo(hip.x - 11, hip.y + 8, hipL.x - 4, hip.y + 15);
  ctx.lineTo(hipL.x + 7, hip.y + 16);
  ctx.quadraticCurveTo(hip.x + 7, hip.y + 6, hipR.x + 7, hipR.y + 1);
  ctx.closePath();
  ctx.fillStyle = kit.primary;
  ctx.fill();

  // jersey
  ctx.beginPath();
  ctx.moveTo(hipR.x, hipR.y);
  ctx.quadraticCurveTo(hip.x - 10, (hip.y + chest.y) / 2, chestR.x - 2, chestR.y + 3);
  ctx.quadraticCurveTo(chest.x - 2, chest.y - 6, chestL.x + 1, chestL.y);
  ctx.quadraticCurveTo(chest.x + 12, (hip.y + chest.y) / 2, hipL.x + 2, hipL.y + 2);
  ctx.closePath();
  ctx.fillStyle = kit.primary;
  ctx.fill();
  ctx.strokeStyle = shade(kit.primary, -0.4);
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // chest stripe
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = kit.secondary;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(chest.x - 18, chest.y + 7);
  ctx.lineTo(chest.x + 18, chest.y - 5);
  ctx.stroke();
  ctx.strokeStyle = rgba(kit.accent, 0.9);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(chest.x - 18, chest.y + 10);
  ctx.lineTo(chest.x + 18, chest.y - 2);
  ctx.stroke();
  ctx.restore();

  // side stripe
  ctx.strokeStyle = rgba(kit.secondary, 0.85);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hipR.x - 1, hipR.y - 1);
  ctx.quadraticCurveTo(hip.x - 7, (hip.y + chest.y) / 2, chestR.x - 1, chestR.y + 4);
  ctx.stroke();

  // bib
  ctx.save();
  ctx.translate(chest.x + 2, chest.y + 14);
  ctx.rotate(sk.lean * 0.7);
  ctx.fillStyle = 'rgba(247,244,234,.92)';
  ctx.fillRect(-5.5, -4, 11, 8.5);
  ctx.fillStyle = '#101828';
  ctx.font = '600 6.5px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('7', 0, 0.4);
  ctx.restore();

  // shorts trim
  ctx.strokeStyle = rgba(kit.accent, 0.88);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(hipL.x - 3, hip.y + 8);
  ctx.quadraticCurveTo(hip.x, hip.y + 13, hipR.x + 3, hip.y + 7);
  ctx.stroke();

  // rim light along back/upper torso
  ctx.strokeStyle = rgba(kit.trim || '#ffffff', 0.62);
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(chestL.x, chestL.y + 2);
  ctx.quadraticCurveTo(chest.x + 11, chest.y + 12, hipL.x - 1, hip.y - 2);
  ctx.stroke();

  // subtle chest shadow
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(chestR.x + 3, chestR.y + 7);
  ctx.quadraticCurveTo(chest.x - 4, (hip.y + chest.y) / 2, hipR.x + 3, hipR.y - 2);
  ctx.stroke();
}

function drawHead(ctx, sk, kit, phase) {
  const head = sk.head;
  const r = 9.2;
  // neck
  ctx.strokeStyle = kit.skinDark;
  ctx.lineWidth = 5.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sk.neck.x, sk.neck.y + 1);
  ctx.lineTo(head.x - 3, head.y + r * 0.7);
  ctx.stroke();
  ctx.strokeStyle = kit.skin;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(sk.neck.x, sk.neck.y);
  ctx.lineTo(head.x - 3, head.y + r * 0.6);
  ctx.stroke();

  // ear
  ctx.fillStyle = kit.skinDark;
  ctx.beginPath(); ctx.ellipse(head.x - 4.5, head.y + 1, 2.4, 3.2, -0.2, 0, TAU); ctx.fill();

  // head shape (slight forward jaw)
  ctx.beginPath();
  ctx.ellipse(head.x, head.y, r * 0.94, r, 0.08, 0, TAU);
  ctx.fillStyle = kit.skin;
  ctx.fill();

  // jaw shading
  ctx.beginPath();
  ctx.ellipse(head.x + 1.5, head.y + 3.4, 6.7, 6.1, 0.1, 0.2, Math.PI * 1.02);
  ctx.fillStyle = rgba(kit.skinDark, 0.25);
  ctx.fill();

  // nose
  ctx.beginPath();
  ctx.moveTo(head.x + 7.6, head.y - 1.5);
  ctx.quadraticCurveTo(head.x + 10, head.y + 1.6, head.x + 7.3, head.y + 3.2);
  ctx.lineTo(head.x + 6.4, head.y + 2.2);
  ctx.closePath();
  ctx.fillStyle = kit.skin;
  ctx.fill();

  // hair
  ctx.beginPath();
  ctx.arc(head.x - 1, head.y - 1.2, r * 1.02, Math.PI * 0.68, Math.PI * 2.02);
  ctx.quadraticCurveTo(head.x + 2, head.y - 8.2, head.x + 4, head.y - 5.2);
  ctx.quadraticCurveTo(head.x - 1, head.y - 5.7, head.x - 7.2, head.y + 3.3);
  ctx.closePath();
  ctx.fillStyle = kit.hair;
  ctx.fill();
  // hair sheen
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(head.x - 2, head.y - 2.2, r * 0.78, Math.PI * 0.9, Math.PI * 1.5);
  ctx.stroke();

  // headband
  if (kit.trim) {
    ctx.strokeStyle = rgba(kit.trim, 0.9);
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.arc(head.x - 0.5, head.y - 1.2, r * 0.87, Math.PI * 1.08, Math.PI * 1.87);
    ctx.stroke();
  }

  // features
  ctx.fillStyle = '#15100e';
  ctx.beginPath();
  ctx.ellipse(head.x + 4.6, head.y - 0.8, 1.15, 0.9, 0.15, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(36,18,10,.75)';
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(head.x + 2.6, head.y - 3.4);
  ctx.lineTo(head.x + 6.9, head.y - 2.7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,35,25,.6)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(head.x + 6.2, head.y + 5.1);
  ctx.quadraticCurveTo(head.x + 7.5, head.y + 5.4, head.x + 7.8, head.y + 4.7);
  ctx.stroke();
}

function drawStartBlocks(ctx, sk, kit) {
  // miniature block pedals behind the athlete's feet
  ctx.fillStyle = 'rgba(11,20,34,.95)';
  ctx.strokeStyle = 'rgba(247,201,80,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-54, -1); ctx.lineTo(-31, -7); ctx.lineTo(-27, -2); ctx.lineTo(-50, 4); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4, -1); ctx.lineTo(18, -7); ctx.lineTo(22, -2); ctx.lineTo(0, 4); ctx.closePath();
  ctx.fill(); ctx.stroke();
}

/**
 * Draw a stylised side-view athlete.
 */
function drawSnowboard(ctx, sk, kit) {
  const feet = (sk.legs || []).map(l => l.ankle);
  if (!feet.length) return;
  const y = Math.max(...feet.map(f => f.y)) + 4;
  const cx = feet.reduce((a, f) => a + f.x, 0) / feet.length;
  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(-0.045 + Math.sin((sk.phase || 0) * 0.9) * 0.02);
  const len = 46, h = 5;
  const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
  g.addColorStop(0, '#111d31');
  g.addColorStop(0.35, kit.accent || '#49b9e6');
  g.addColorStop(0.7, '#2b7196');
  g.addColorStop(1, '#0b1422');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-len / 2, -h / 2);
  ctx.quadraticCurveTo(-len / 2 - 5, -h / 2 - 3, -len / 2 - 4, -1);
  ctx.quadraticCurveTo(-len / 2 - 2, h / 2 + 2, -len / 2 + 4, h / 2);
  ctx.lineTo(len / 2 - 3, h / 2);
  ctx.quadraticCurveTo(len / 2 + 5, h / 2 + 1, len / 2 + 5, -1);
  ctx.quadraticCurveTo(len / 2 + 3, -h / 2 - 3, len / 2 - 4, -h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,246,255,.55)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.fillRect(-len * 0.22, -h / 2 + 1, len * 0.44, 1);
  ctx.restore();
}

function drawSkis(ctx, sk, kit) {
  for (const leg of sk.legs || []) {
    ctx.save();
    ctx.translate(leg.ankle.x, leg.ankle.y + 4);
    ctx.rotate(-0.05);
    const len = 46, h = 3.4;
    const g = ctx.createLinearGradient(-len / 2, 0, len / 2, 0);
    g.addColorStop(0, '#d8e8f4');
    g.addColorStop(0.4, kit.primary || '#e33a4a');
    g.addColorStop(1, '#f4f9ff');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-len / 2, -h / 2);
    ctx.lineTo(len / 2 - 6, -h / 2);
    ctx.quadraticCurveTo(len / 2 + 7, -h / 2 - 3, len / 2 + 8, -h / 2 - 7);
    ctx.lineTo(len / 2 + 6, -h / 2 - 1);
    ctx.lineTo(-len / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,32,48,.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // binding
    ctx.fillStyle = '#101a28';
    ctx.fillRect(-3, -h / 2 - 2, 6, 3);
    ctx.restore();
  }
}

export function drawAthlete(ctx, opts) {
  const {
    x = 0, y = 0, scale = 1, phase = 0, pose = 'run', speed = 0.6,
    kit = KITS.player, flip = false, alpha = 1, shadow = 1, javelin = null,
    glow = 0, medal = false, skis = false, board = false
  } = opts;
  const sk = makeSkeleton(pose, phase, speed);
  const s = scale * (flip ? -1 : 1);
  const bob = pose === 'run' ? Math.sin(phase * 2 + 0.15) : 0;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (shadow) {
    ctx.save();
    ctx.translate(0, 1.5);
    ctx.scale(1, 0.24);
    const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 32);
    grad.addColorStop(0, 'rgba(0,0,0,.42)');
    grad.addColorStop(0.65, 'rgba(0,0,0,.19)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 32 * shadow, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.scale(s, scale);
  ctx.translate(0, bob);
  if (glow > 0) {
    ctx.shadowColor = rgba(kit.trim || '#f6cc58', 0.7 * glow);
    ctx.shadowBlur = 18 * glow;
  }

  if (sk.medal || medal) drawMedal(ctx, kit);

  if (board) drawSnowboard(ctx, sk, kit);
  if (skis) drawSkis(ctx, sk, kit);

  // Back limbs
  const backLeg = sk.legs.find(l => l.back) || sk.legs[0];
  const frontLeg = sk.legs.find(l => !l.back) || sk.legs[1];
  const backArm = sk.arms.find(a => a.back) || sk.arms[0];
  const frontArm = sk.arms.find(a => !a.back) || sk.arms[1];

  if (backLeg) {
    limb(ctx, backLeg.hip, backLeg.knee, 10, shade(kit.skin, -0.18), shade(kit.skinDark, -0.22), rgba('#ffffff', 0.1));
    limb(ctx, backLeg.knee, backLeg.ankle, 6.7, shade(kit.skin, -0.12), shade(kit.skinDark, -0.18), null);
    // sock
    const sockA = { x: lerp(backLeg.knee.x, backLeg.ankle.x, 0.72), y: lerp(backLeg.knee.y, backLeg.ankle.y, 0.72) };
    limb(ctx, sockA, backLeg.ankle, 7.2, shade(kit.sock, -0.12), 'rgba(20,25,36,.4)', null);
    drawShoe(ctx, backLeg, kit, 0.88);
  }
  if (backArm) {
    limb(ctx, backArm.shoulder, backArm.elbow, 6.4, shade(kit.skin, -0.18), shade(kit.skinDark, -0.2), null);
    limb(ctx, backArm.elbow, backArm.hand, 4.8, shade(kit.skin, -0.12), shade(kit.skinDark, -0.16), null);
    // sleeve
    limb(ctx, backArm.shoulder, { x: lerp(backArm.shoulder.x, backArm.elbow.x, 0.28), y: lerp(backArm.shoulder.y, backArm.elbow.y, 0.28) }, 8.2, shade(kit.primary, -0.1), shade(kit.primary, -0.4), null);
    ctx.fillStyle = shade(kit.skin, -0.14);
    ctx.beginPath(); ctx.arc(backArm.hand.x, backArm.hand.y, 3, 0, TAU); ctx.fill();
  }

  drawTorso(ctx, sk, kit);

  if (frontLeg) {
    limb(ctx, frontLeg.hip, frontLeg.knee, 10.5, kit.skin, kit.skinDark, rgba('#ffffff', 0.22));
    limb(ctx, frontLeg.knee, frontLeg.ankle, 7, kit.skin, kit.skinDark, rgba('#ffffff', 0.12));
    const sockA = { x: lerp(frontLeg.knee.x, frontLeg.ankle.x, 0.72), y: lerp(frontLeg.knee.y, frontLeg.ankle.y, 0.72) };
    limb(ctx, sockA, frontLeg.ankle, 7.5, kit.sock, 'rgba(30,35,48,.35)', null);
    drawShoe(ctx, frontLeg, kit, 1);
  }

  if (frontArm) {
    limb(ctx, frontArm.shoulder, frontArm.elbow, 6.7, kit.skin, kit.skinDark, rgba('#ffffff', 0.18));
    limb(ctx, frontArm.elbow, frontArm.hand, 5, kit.skin, kit.skinDark, rgba('#ffffff', 0.1));
    limb(ctx, frontArm.shoulder, { x: lerp(frontArm.shoulder.x, frontArm.elbow.x, 0.3), y: lerp(frontArm.shoulder.y, frontArm.elbow.y, 0.3) }, 8.4, kit.primary, shade(kit.primary, -0.42), null);
    // wristband
    const wrist = { x: lerp(frontArm.elbow.x, frontArm.hand.x, 0.78), y: lerp(frontArm.elbow.y, frontArm.hand.y, 0.78) };
    limb(ctx, wrist, { x: lerp(frontArm.elbow.x, frontArm.hand.x, 0.9), y: lerp(frontArm.elbow.y, frontArm.hand.y, 0.9) }, 5.4, kit.accent, shade(kit.accent, -0.3), null);
    ctx.fillStyle = kit.skin;
    ctx.beginPath(); ctx.arc(frontArm.hand.x, frontArm.hand.y, 3.15, 0, TAU); ctx.fill();
  }

  drawHead(ctx, sk, kit, phase);

  if (javelin) {
    const hand = sk.throwHand || (frontArm ? frontArm.hand : { x: 18, y: -112 });
    drawJavelin(ctx, hand, javelin.angle ?? -0.16, kit);
  }

  ctx.restore();
}

export function drawAthleteShadow(ctx, x, y, scale = 1, width = 38) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.23);
  const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, width * scale);
  grad.addColorStop(0, 'rgba(0,0,0,.42)');
  grad.addColorStop(0.6, 'rgba(0,0,0,.15)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, width * scale, 0, TAU); ctx.fill();
  ctx.restore();
}
