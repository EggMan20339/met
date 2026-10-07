// Old Bramble: a hermit made of hedge. A ball of moss and twigs with two patient glowing eyes and a cane on his left.
// He breathes slowly; his twig ring rustles on five tuft springs (small random jitters, and gusts that run round the
// ring one tuft at a time) and lags whatever the body does; the moss and two leaves bob; his eyes blink, glance about,
// droop when he has been alone a while and slowly follow the player when they are near (he perks up when they
// arrive); a berry glints now and then; every few seconds he shifts his weight off the cane (lifting it and tapping it
// down) and back onto it; and while he talks (info.game.ui.dialogue) he rocks, mouths the words and rustles, with a
// little shudder at the start of every line. Decor never flips, so the cane stays on his left. See art/ANIMATION.md.
const L = require('../lib');
const { svg, rad, path, ell, circ, stroke, g, rot, tr, clamp, lerp, num: n } = L;
const W = 34, H = 34, PX = 17, PY = 31.5; // template box; the body breathes, leans and bobs about the base of the hedge
const CX = 17, CY = 20;                   // the hedge ball's centre (radius 11.5)
const SCALE = 0.7;                        // world units per template unit (ART_SCALE.bramble)
const DEG = Math.PI / 180;
const TWIG = '#3e4a2a', MOSS = '#b8c86a', BERRY = '#d04a5a', EYE = '#ffe9b0', INK = '#1c2a16', CANE = '#6a5a3a';
const BALL = rad('bb', 15, 17, 12, [[0, '#7a9a4a'], [0.6, '#4a6a34'], [1, '#22361c']], 13, 14);
// the twig ring: 14 twigs from his left round the top to his right, in five tufts (tw0 left .. tw4 right) that each
// swing on their own spring; a twig between two tufts takes a blend of both so a gust rolls round the ring smoothly
const TWIGS = []; for (let i = 0; i < 14; i++) { const a = -Math.PI + i * (Math.PI * 1.15 / 13), u = i * 4 / 13, k = Math.min(3, Math.floor(u)); TWIGS.push({ a, k, f: u - k, sub: i % 3 === 1, leaf: i === 4 ? 1 : i === 10 ? -0.7 : 0 }); }

const params = {
  sx: 1, sy: 1, bob: 0, lean: 0,              // breathing squash/stretch and lift about the base; body tilt in degrees (negative tips him onto the cane)
  tw0: 0, tw1: 0, tw2: 0, tw3: 0, tw4: 0,     // tuft angles in degrees (positive swings the twigs clockwise, as a wind from his left would)
  leaf: 0, moss: 0,                           // leaf flutter in degrees; moss bob -1..1
  eyeOpen: 1, lid: 1, wide: 0, eyeK: 1,       // blink envelope (snaps), slow lid droop 0.5..1, startled widening 0..1, halo pulse
  lookX: 0, lookY: 0,                         // where the eyes look, -1..1
  mouth: 0, smile: 1,                         // mouth open 0..1; smile width and curl (1 = the still)
  caneA: 0, caneLift: 0,                      // cane tilt in degrees about its tip (positive leans its top toward him) and how far it is lifted off the ground
  glint: 0, glintB: 0,                        // berry sparkle 0..1 (snaps) on berry 0 (low left) or 1 (high right)
};
// [stiffness, damping ratio]: a heavy slow body, bouncy twigs and leaves, lazy eyes and lids
const springs = {
  sx: [420, 0.5], sy: [420, 0.5], bob: [300, 0.6], lean: [120, 0.45],
  tw0: [260, 0.22], tw1: [260, 0.22], tw2: [260, 0.22], tw3: [260, 0.22], tw4: [260, 0.22], leaf: [320, 0.18], moss: [50, 0.7],
  lid: [60, 0.6], wide: [220, 0.5], eyeK: [80, 1], lookX: [14, 1], lookY: [14, 1],
  mouth: [600, 0.8], smile: [60, 0.8], caneA: [200, 0.5], caneLift: [260, 0.6],
};
// stills: default is the old art/bramble.svg; the rest are the readable moments of his day
const poses = {
  default: {},
  greet: { wide: 1, lookX: -0.8, lookY: 0.3, smile: 1.2, bob: 1, lean: -1.5, tw0: 9, tw1: 12, tw2: 8, tw3: 5, tw4: 3, leaf: 18, mouth: 0.25 },
  lean: { lean: -4.5, caneA: 4, sy: 0.98, sx: 1.02, tw0: -3, tw1: -2, moss: 0.8 },
  tap: { lean: 2.5, caneA: 11, caneLift: 2.6, bob: 1.4, sy: 1.02, tw0: 6, tw1: 4, leaf: -10 },
  talk: { mouth: 0.7, smile: 1.15, lean: 1.8, lookX: 0.9, lookY: 0.4, tw0: -4, tw1: 6, tw2: -5, tw3: 7, tw4: -3, leaf: 12 },
  blink: { eyeOpen: 0.05, moss: -0.8 },
  doze: { lid: 0.4, sy: 1.03, sx: 0.97, lean: -4, caneA: 3 },
  glint: { glint: 1, glintB: 1, lookX: 0.5, lookY: -0.3 },
};

// a small leaf hanging off a twig end, pointing along ang (radians)
const leafAt = (x, y, ang) => { const c = Math.cos(ang), s = Math.sin(ang); const rp = (px, py) => `${n(x + px * c - py * s)} ${n(y + px * s + py * c)}`; return path(`M${rp(0, 0)} C${rp(0.9, -1)} ${rp(2.1, -1)} ${rp(2.9, 0)} C${rp(2.1, 1)} ${rp(0.9, 1)} ${rp(0, 0)} Z`, MOSS, { opacity: 0.92 }); };

function make(P) {
  const lc = Math.cos(P.lean * DEG), ls = Math.sin(P.lean * DEG);
  // where a point of the body ends up after the body's own transform (the arm starts on the leaning, breathing hedge)
  const bodyX = (x, y) => PX + (x - PX) * P.sx * lc - (y - PY - P.bob) * P.sy * ls, bodyY = (x, y) => PY + (x - PX) * P.sx * ls + (y - PY - P.bob) * P.sy * lc;
  // ---- the twig ring, as one path for the twigs and one for their side shoots; two shoots carry a leaf
  const tw = [P.tw0, P.tw1, P.tw2, P.tw3, P.tw4]; let td = '', sd = ''; const leaves = [];
  for (let i = 0; i < 14; i++) {
    const q = TWIGS[i]; const ta = q.a + (tw[q.k] * (1 - q.f) + tw[q.k + 1] * q.f) * DEG; const ca = Math.cos(ta), sa = Math.sin(ta);
    const bx = CX + Math.cos(q.a) * 11, by = CY + Math.sin(q.a) * 11; // the base sits just inside the rim, so the twig pivots there
    td += `M${n(bx)} ${n(by)} L${n(bx + ca * 4.5)} ${n(by + sa * 4.5 - 0.5)} `;
    if (q.sub) { const x0 = bx + ca * 2.5, y0 = by + sa * 2.5, a2 = ta + 0.9; const ex = x0 + Math.cos(a2) * 3, ey = y0 + Math.sin(a2) * 3; sd += `M${n(x0)} ${n(y0)} L${n(ex)} ${n(ey)} `; if (q.leaf) leaves.push(leafAt(ex, ey, a2 + q.leaf * P.leaf * DEG)); }
  }
  const twigs = [stroke(td, TWIG, 1.4), stroke(sd, TWIG, 1), leaves];
  // ---- the hedge: ball, moss that bobs against the breath, berries, one of which may be glinting
  const ball = circ(CX, CY, 11.5, BALL, { stroke: INK, strokeWidth: 1 });
  const moss = [ell(12, 14 + P.moss * 0.35, 3 + P.moss * 0.12, 1.8 - P.moss * 0.06, MOSS, { opacity: 0.85 }), ell(22, 26 - P.moss * 0.3, 2.6, 1.5, MOSS, { opacity: 0.75 }), circ(21, 12 - P.moss * 0.25, 1.3, '#e0ffa0', { opacity: 0.8 })];
  const berries = [circ(10, 24, 1.1, BERRY), circ(24, 15, 1, BERRY)];
  let glint = null;
  if (P.glint > 0.02) { const gx = P.glintB ? 24 : 10, gy = P.glintB ? 15 : 24, r = 1.1 + P.glint * 1.1, q = r * 0.28;
    glint = [circ(gx, gy, 1.1 + 0.3 * P.glint, '#ff8aa0', { opacity: 0.6 * P.glint }), path(`M${n(gx)} ${n(gy - r)} L${n(gx + q)} ${n(gy - q)} L${n(gx + r)} ${n(gy)} L${n(gx + q)} ${n(gy + q)} L${n(gx)} ${n(gy + r)} L${n(gx - q)} ${n(gy + q)} L${n(gx - r)} ${n(gy)} L${n(gx - q)} ${n(gy - q)} Z`, '#ffffff', { opacity: 0.95 * P.glint })]; }
  // ---- eyes: a glowing disc with its halo and glint; they close to a dark line, droop with the lid and drift with the look
  const open = clamp(P.eyeOpen * P.lid, 0, 1), er = 1.4 * (1 + 0.22 * P.wide);
  const eyeAt = (cx, cy) => { const ex = cx + P.lookX * 0.9, ey = cy + P.lookY * 0.7 + er * (1 - open) * 0.4; // the lid comes down from above
    if (open < 0.12) return stroke(`M${n(ex - er - 0.3)} ${n(ey)} C${n(ex - er * 0.4)} ${n(ey + 0.5)} ${n(ex + er * 0.4)} ${n(ey + 0.5)} ${n(ex + er + 0.3)} ${n(ey)}`, INK, 0.9);
    return [circ(ex, ey, er * 1.8 * P.eyeK * (1 + 0.25 * P.wide), EYE, { opacity: 0.25 * open }), ell(ex, ey, er, er * open, EYE), open > 0.5 ? circ(ex + P.lookX * 0.45, ey + P.lookY * 0.35, er * 0.45, '#ffffff', { opacity: 0.8 }) : null]; };
  // ---- the mouth: his smile widens and curls with smile, and opens into a dark hollow when he talks
  const sw = (P.smile - 1) * 1.5, sy0 = 24.5 - (P.smile - 1) * 0.6, cy0 = 24.5 + 1.5 * P.smile + P.mouth * 1.2;
  const mouth = [P.mouth > 0.05 ? ell(17.25, 25.3 + P.mouth * 0.5, 2 + P.mouth * 0.6, P.mouth * 1.3, INK) : null, stroke(`M${n(14.5 - sw)} ${n(sy0)} C16 ${n(cy0)} 18.5 ${n(cy0)} ${n(20 + sw)} ${n(sy0)}`, INK, 1)];
  const body = g([twigs, ball, moss, berries, glint, eyeAt(13.5, 19.5), eyeAt(20.5, 19.5), mouth], { transform: `${tr(PX, PY)} ${rot(P.lean)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-PX, -PY - P.bob)}` });
  // ---- the cane, pivoting about its tip and lifted for a tap, and the twig arm that holds it mid-shaft
  const cane = stroke('M4 33 L4 16 C3 12 6 11 7 13', CANE, 1.8, { transform: `${tr(0, -P.caneLift)} ${rot(P.caneA, 4, 33)}` });
  const cc = Math.cos(P.caneA * DEG), cs = Math.sin(P.caneA * DEG); const hx = 4 + cc + 14 * cs, hy = 33 + cs - 14 * cc - P.caneLift;
  const arm = stroke(`M${n(bodyX(7, 22))} ${n(bodyY(7, 22))} L${n(hx)} ${n(hy)}`, TWIG, 2);
  return svg(W, H, [cane, body, arm]);
}

// ---- animation: idle life, the player's whereabouts and the dialogue box, turned into parameter targets every frame
function control(ent, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.t0 = Math.random() * 10; m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.dbl = false; m.greetBlink = 0;
    m.jit = 0.3; m.gust = 2 + Math.random() * 4; m.gustI = 5; m.gustNext = 0; m.gustK = 1; m.gustS = 1;
    m.glance = 2 + Math.random() * 3; m.gx = 0; m.gy = 0; m.glint = 2 + Math.random() * 4; m.glintT = 0; m.glintB = 0;
    m.onCane = true; m.shift = 2.5 + Math.random() * 3; m.clipT = -1; m.clip = 'off'; m.tapped = false;
    m.near = false; m.away = 0; m.greetT = 0; m.line = -1; m.shakeS = 1; m.talkJit = 0;
  }
  const t = pup.time + m.t0;
  const gust = (k, s) => { m.gustI = 0; m.gustNext = pup.time; m.gustK = k; m.gustS = s; }; // a wave through the tufts, 50 ms apart
  // ---- where the player is, in world units from his eyes
  const game = info.game, p = game && game.player; const tile = typeof TILE === 'number' ? TILE : 16;
  const ex = ent.tx * tile + 8, ey = ent.ty * tile + tile - (H - 19.5) * SCALE;
  const dx = p ? p.x + p.w / 2 - ex : 1e4, dy = p ? p.y + p.h / 2 - ey : 0; const dist = Math.hypot(dx, dy);
  const nearK = Anim.smooth(dist, 150, 80); // 0 far .. 1 near: how much the eyes care about the player
  // ---- the dialogue box: his own lines shake him, and he mouths them as they are typed out
  const d = game && game.ui && game.ui.dialogue; const line = d && d.lines && d.lines[d.i]; const mine = !!(line && line.who === 'Old Bramble');
  const li = mine ? d.i : -1;
  if (li !== m.line) {
    if (li >= 0) { m.shakeS = -m.shakeS; pup.impulse('lean', 70 * m.shakeS).impulse('bob', 16).impulse('wide', 3).impulse('sx', 2.4).impulse('sy', -2); gust(0.9, m.shakeS); m.blink = Math.max(m.blink, 0.5); }
    else { pup.impulse('bob', 10); gust(0.5, 1); } // the talk is over: a small settle
    m.line = li;
  }
  const typing = mine && d.shown < line.text.length;
  // ---- noticing the player: a perk-up when they arrive, a slow droop of the lids once they have been gone a while
  if (dist < 64 && !m.near) { m.near = true; m.greetT = 0.7; pup.impulse('wide', 12).impulse('bob', 36).impulse('lean', dx > 0 ? 60 : -60).impulse('lid', 4); gust(1.6, dx > 0 ? 1 : -1); m.greetBlink = 0.6; m.glance = 2.5 + Math.random() * 2; }
  else if (dist > 150 && m.near) m.near = false;
  if (m.greetT > 0) m.greetT -= dt;
  m.away = m.near ? 0 : m.away + dt; const doze = Anim.smooth(m.away, 6, 11);
  // ---- idle life: blinks (sometimes doubled), glances, twig jitters, gusts, a berry glint
  m.blink -= dt; if (m.blink < 0) { m.blink = m.dbl ? 0.3 : 2.5 + Math.random() * 4; m.dbl = !m.dbl && Math.random() < 0.25; m.blinkT = 0.16; }
  if (m.greetBlink > 0) { m.greetBlink -= dt; if (m.greetBlink <= 0) m.blinkT = 0.16; }
  let eyeOpen = 1; if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = m.blinkT > 0.08 ? 1 - (0.16 - m.blinkT) / 0.08 : m.blinkT / 0.08; }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.5 + Math.random() * 4; m.gx = (Math.random() - 0.5) * 1.2; m.gy = (Math.random() - 0.6) * 0.6; }
  m.jit -= dt; if (m.jit < 0) { m.jit = 0.25 + Math.random() * 0.7; pup.impulse('tw' + Math.floor(Math.random() * 5), (Math.random() - 0.5) * 260); if (Math.random() < 0.3) pup.impulse('leaf', (Math.random() - 0.5) * 500); }
  m.gust -= dt; if (m.gust < 0) { m.gust = 3 + Math.random() * 6; gust(0.8 + Math.random() * 0.8, Math.random() < 0.5 ? 1 : -1); }
  while (m.gustI < 5 && pup.time >= m.gustNext) { pup.impulse('tw' + (m.gustS > 0 ? m.gustI : 4 - m.gustI), m.gustS * (160 + Math.random() * 120) * m.gustK); if (m.gustI === 1 || m.gustI === 3) pup.impulse('leaf', m.gustS * 400 * m.gustK); m.gustI++; m.gustNext += 0.05; }
  m.glint -= dt; if (m.glint < 0) { m.glint = 2.5 + Math.random() * 5; m.glintT = 0.5; m.glintB = m.glintB ? 0 : 1; }
  let glint = 0; if (m.glintT > 0) { m.glintT -= dt; glint = Math.sin(clamp(1 - m.glintT / 0.5, 0, 1) * Math.PI); }
  // ---- weight: he leans on the cane, then straightens up (lifting the cane and tapping it down), then leans again;
  // each change is a short clip on his own timer, with a press-down before the push-off and an overshoot on the settle
  m.shift -= dt;
  if (m.shift < 0 && m.clipT < 0 && !mine) { m.shift = 3 + Math.random() * 4; m.clipT = 0; m.clip = m.onCane ? 'off' : 'on'; m.onCane = !m.onCane; m.tapped = false; }
  let lean = m.onCane ? -4 : 2, caneA = m.onCane ? 3 : 0, caneLift = 0, bob = 0, syK = m.onCane ? -0.01 : 0;
  if (m.clipT >= 0) {
    m.clipT += dt; const k = m.clipT / 0.9;
    const c = m.clip === 'off'
      ? Anim.keys(k, [[0, { lean: -4, caneA: 3, caneLift: 0, bob: 0, sy: -0.01 }], [0.22, { lean: -6, caneA: 5, caneLift: 0, bob: 0, sy: -0.03 }, 'inOutQuad'], [0.5, { lean: 3, caneA: 14, caneLift: 3.2, bob: 1.6, sy: 0.02 }, 'outCubic'], [0.68, { lean: 2, caneA: 1, caneLift: 0, bob: 0.3, sy: 0 }, 'inQuad'], [1, { lean: 2, caneA: 0, caneLift: 0, bob: 0, sy: 0 }, 'outQuad']])
      : Anim.keys(k, [[0, { lean: 2, caneA: 0, caneLift: 0, bob: 0, sy: 0 }], [0.3, { lean: 3, caneA: -1, caneLift: 0, bob: 0.5, sy: 0.01 }, 'inOutQuad'], [0.75, { lean: -5, caneA: 4, caneLift: 0, bob: 0, sy: -0.02 }, 'inOutCubic'], [1, { lean: -4, caneA: 3, caneLift: 0, bob: 0, sy: -0.01 }, 'outQuad']]);
    lean = c.lean; caneA = c.caneA; caneLift = c.caneLift; bob = c.bob; syK = c.sy;
    if (m.clip === 'off' && !m.tapped && k >= 0.68) { m.tapped = true; pup.impulse('sy', -1.4).impulse('caneA', -90).impulse('tw0', 220).impulse('tw1', 160).impulse('leaf', 300).impulse('bob', -6); } // the tap
    if (k >= 1) m.clipT = -1;
  }
  // ---- talking: rocks and mouths the words while the text types, then holds a warmer smile toward the player
  let mouth = 0, smile = 1, wide = m.greetT > 0 ? 0.6 : 0;
  let lookX = lerp(m.gx, clamp(dx / 40, -1, 1), nearK), lookY = lerp(m.gy, clamp(dy / 40, -1, 1), nearK);
  if (mine) {
    smile = 1.15; lookX = clamp(dx / 30, -1, 1); lookY = clamp(dy / 30, -1, 1); lean += dx > 0 ? 1.2 : -1.2; wide = 0.12;
    if (typing) { const syl = Math.max(0, Math.sin(t * 13)) * (0.55 + 0.45 * Math.sin(t * 5.3 + 1)); mouth = 0.15 + 0.55 * syl; lean += Math.sin(t * 8.5) * 1.1;
      m.talkJit -= dt; if (m.talkJit < 0) { m.talkJit = 0.1 + Math.random() * 0.15; pup.impulse('tw' + Math.floor(Math.random() * 5), (Math.random() - 0.5) * 160); } }
  } else if (m.near) smile = 1.06;
  // ---- breathing (slower and deeper when dozing), the moss a beat behind it, the twigs in a slow wind and lagging the body's rocking
  const br = Math.sin(t * lerp(1.6, 1.1, doze)) * lerp(0.03, 0.04, doze);
  const T = { sx: 1 - br, sy: 1 + br + syK, bob, lean, caneA, caneLift, mouth, smile, lookX, lookY, wide, lid: 1 - doze * 0.6, eyeK: 1 + Math.sin(t * 2.1) * 0.15, moss: Math.sin(t * 1.6 - 0.7), eyeOpen, glint, glintB: m.glintB, leaf: Math.sin(t * 2.3) * 5 };
  const vl = -(pup.V.lean || 0) * 0.05; for (let k = 0; k < 5; k++) T['tw' + k] = Math.sin(t * 0.9 + k * 0.8) * 1.5 + vl;
  pup.target(T);
}

module.exports = { name: 'bramble', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control };
