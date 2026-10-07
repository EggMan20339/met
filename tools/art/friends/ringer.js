// The Bell Ringer: what the water left of the one who rang the warning. A drowned ghost, a shroud of cold light with
// two hollow eyes, an o of a mouth and a hand bell it still cannot put down.
//
// He is static decor (src/game.js: type K, drawn bottom-centre of his tile, never flipped), so all of his motion is
// his own. make(P, pup) is a pure drawing of the parameters; control(e, pup, info) reads the game every frame:
//   - the whole ghost hovers on a slow figure of eight (the old drawing bobbed +-2 world units at 1.3 rad/s; that is
//     kept as the vertical half of it) and leans into the drift; a ripple runs up the shroud like water; the four
//     tatters of the hem are one-point verlet pendulums that trail the hover, sway in a slow current and are flung by
//     gusts (a passing Mote, a toll, a shiver); the hem lengthens on a rise and shortens on a fall on a loose spring;
//   - the body is translucent (the old alpha 0.82) and its opacity breathes, flares when he rings or greets, and
//     gutters now and then like a lamp under water; the halo swells after every event; after() throws its light on
//     the world (info.glowAt) and draws the bubbles that escape his mouth;
//   - the bell hangs from the hand by its crown on a barely damped spring, the clapper lagging it on another; on his
//     own timer he rings it: the hand draws it up and back while the eyes narrow (anticipation), a flick down on the
//     hit frame (impulses on the bell, the clapper, the brightness, the halo, the hem, a shudder of the body, the mouth
//     opening in a wail) and sound rings spread from the bell's mouth while he settles; sometimes a double toll;
//   - the eye-lights drift toward Mote when they are near (the whole face slides a little with them), blink slowly,
//     glance about when alone, widen on a toll or an arrival, and lid over when he has drifted off (dim, sunk, the arm
//     drooping) after a long while with nobody by, from which he wakes with a start and a jangle of the bell;
//   - fidgets on a random timer: a bubble (the mouth puffs and one to three bubbles rise), a shiver (a tremble, the
//     brightness guttering, the hem flicking), a sway, a tremor of the bell without a toll;
//   - while he talks (info.game.ui.dialogue with game.nearInteract === him) he rises and chimes the bell in greeting,
//     dips on every new line, mouths the words as they type out, and bows to Mote at the end.
// Stills: default is the old art/ringer.svg; the rest are the readable moments. See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, path, ell, circ, stroke, g, rot, tr, glow, clamp, lerp, num: n } = L;
const W = 30, H = 36, PX = 15, PY = 34;      // the template box; the body leans and squashes about the hem centre
const TILE = 16, SCALE = 0.7;                // world units per template unit (ART_SCALE.ringer)
const SHOULDER_X = 21, SHOULDER_Y = 20, ARM_LEN = 12.54, ARM_REST = 66.5; // the arm reaches from the shoulder to the bell's crown at (26, 8.5)
const RAD = Math.PI / 180;
const TIP_X = [22, 17.5, 12.5, 8];           // the hem's tatters: tips at y 34 under anchors at y 30 (notches at 20, 15, 10)
const TIP_REST = [{ x: 0, y: 4 }];
const BUB = 6, BP = 5;                       // bubbles: a ring of BUB records of BP floats (x, y, vx, age, life), world space
const BODY_G = lin('rg', 0, 4, 0, 34, [[0, '#cfe8ff', 0.95], [0.6, '#8ec4ff', 0.6], [1, '#6aa0ff', 0]]);
const INK = '#0c1a2c', LIGHT = '#8ce0ff', PALE = '#cfe8ff', BELL = '#dbe8f0', BELL_INK = '#8aa8c0';
const q = (v) => Math.round(v * 20) / 20;    // twentieths, so the shroud's path string does not change on every sub-pixel wobble
// the toll: the bell drawn up and back with the eyes narrowing, the flick (hit frame at 0.44 s), a hold, the settle; the
// double toll flicks again at 0.86 s. The springs add the swing and the overshoot.
const TOLL = [[0, { arm: 0, bell: 0, lean: 0, eye: 1, mouth: 1 }], [0.32, { arm: 16, bell: -24, lean: -3, eye: 0.35, mouth: 0.6 }, 'inOutQuad'], [0.44, { arm: -14, bell: 10, lean: 3, eye: 1.2, mouth: 1.9 }, 'inCubic'],
  [0.72, { arm: -6, bell: 0, lean: 1, eye: 1, mouth: 1.6 }, 'outQuad'], [1.05, { arm: 0, bell: 0, lean: 0, eye: 1, mouth: 1.15 }, 'inOutQuad'], [1.5, { arm: 0, bell: 0, lean: 0, eye: 1, mouth: 1 }, 'inOutQuad']];
const TOLL2 = [[0, { arm: 0, bell: 0, lean: 0, eye: 1, mouth: 1 }], [0.32, { arm: 16, bell: -24, lean: -3, eye: 0.35, mouth: 0.6 }, 'inOutQuad'], [0.44, { arm: -14, bell: 10, lean: 3, eye: 1.2, mouth: 1.9 }, 'inCubic'],
  [0.74, { arm: 8, bell: -12, lean: -1, eye: 0.6, mouth: 1.3 }, 'inOutQuad'], [0.86, { arm: -12, bell: 8, lean: 3, eye: 1.2, mouth: 1.9 }, 'inCubic'], [1.15, { arm: -4, bell: 0, lean: 1, eye: 1, mouth: 1.5 }, 'outQuad'],
  [1.5, { arm: 0, bell: 0, lean: 0, eye: 1, mouth: 1.15 }, 'inOutQuad'], [1.9, { arm: 0, bell: 0, lean: 0, eye: 1, mouth: 1 }, 'inOutQuad']];
const STRIKES = [[0.44], [0.44, 0.86]];
const PUFF = [[0, { m: 1 }], [0.22, { m: 1.7 }, 'outBack'], [0.48, { m: 1.6 }], [0.85, { m: 1 }, 'inOutQuad']];
const BOW = [[0, { lean: 0, dip: 0 }], [0.35, { lean: 7, dip: -1.5 }, 'inOutQuad'], [0.65, { lean: 7, dip: -1.5 }], [1.2, { lean: 0, dip: 0 }, 'inOutCubic']];

const params = {
  hover: 0,             // the whole ghost's height above the tile bottom, template units (set straight from the figure of eight)
  drift: 0,             // its sideways drift (the other half of the figure of eight)
  lift: 0,              // an extra rise on events: a notice, a greeting, a dip on a nod
  lean: 0,              // body tilt in degrees about the hem centre; positive tips the crown toward +x
  sx: 1, sy: 1,         // squash / stretch about the hem centre
  shake: 0,             // a side-to-side shiver of the body (set each frame from the tremble)
  fade: 0.82,           // the ghost's opacity (set from the pulse; the old drawing used 0.82)
  flare: 0,             // a brightening on top of fade: a toll, a greeting, a startle
  halo: 1,              // the halo's size and brightness, 1 = the still
  wave: 0,              // phase of the ripple running up the shroud, radians (keeps growing)
  waveA: 0.5,           // the ripple's amplitude in template units
  breath: 0,            // 0..1 the slow swell of the body (set from a phase)
  hem: 0,               // the tatters' stretch: positive lengthens them (a rise), negative shortens (a fall)
  eyeOpen: 1,           // 1 open .. 0 shut (snaps: the blink envelope)
  wide: 0,              // 0..1 the hollows widen: alert, a toll, a startle
  lookX: 0, lookY: 0,   // where the eye-lights drift, -1..1; the face slides a little with them
  mouth: 1,             // the o of the mouth: 0 shut .. 1 the still .. 2 a wail
  arm: 0,               // the arm's lift in degrees from its rest (positive raises the hand up and back)
  bell: 0,              // the bell's swing in degrees about its crown (positive swings the lip toward the body)
  clap: 0,              // the clapper's lag, template units across the bell
  ringK: 0,             // the sound rings' spread: 0 none .. 1.4 gone (set from the toll timer)
  doze: 0,              // 0 awake .. 1 drifted off: dim, sunk, lidded, the arm drooping (set from a slow timer)
};
// [stiffness, damping ratio] for the values that overshoot and settle; the rest snap to their target
const springs = {
  lift: [90, 0.5], lean: [110, 0.45], sx: [300, 0.5], sy: [300, 0.5], flare: [60, 1], halo: [40, 1], waveA: [30, 1], hem: [120, 0.35],
  wide: [220, 0.5], lookX: [16, 0.85], lookY: [16, 0.85], mouth: [260, 0.55], arm: [200, 0.5], bell: [170, 0.16], clap: [320, 0.1],
};
// stills exported to art/ringer_<pose>.svg; default is the old art/ringer.svg (its rings sit at r 5 and 8)
const poses = {
  default: { ringK: 0.889, waveA: 0 },
  lift: { arm: 16, bell: -24, lean: -3, eyeOpen: 0.4, mouth: 0.6, halo: 0.9, hem: -0.4 },
  ring: { arm: 2, bell: 12, clap: -2.5, ringK: 0.45, mouth: 1.9, wide: 1, lean: 3, flare: 0.15, halo: 1.5, hem: 0.8, waveA: 1.2, hover: 2, sx: 1.04, sy: 0.96 },
  greet: { lean: -4, lookX: -0.9, lookY: 0.4, wide: 0.6, lift: 2, halo: 1.3, mouth: 1.2, hem: 0.5, flare: 0.08, bell: -8, clap: 1 },
  talk: { lookX: -0.8, lookY: 0.5, mouth: 1.7, lean: -2, waveA: 1.2, halo: 1.2, sy: 1.02, bell: 4 },
  bubble: { mouth: 1.65, lookY: -0.3, eyeOpen: 0.7, hover: 1 },
  blink: { eyeOpen: 0, mouth: 0.8, bell: -3 },
  doze: { doze: 1, fade: 0.6, arm: -10, hover: -2, lean: 2, mouth: 0.6, halo: 0.6 },
};

function make(P, pup) {
  const fade = clamp(P.fade + P.flare, 0.05, 1), dz = clamp(P.doze, 0, 1), br = clamp(P.breath, 0, 1);
  const wA = P.waveA; const w1 = q(Math.sin(P.wave) * wA), w2 = q(Math.sin(P.wave + 1.7) * wA), w3 = q(Math.sin(P.wave + 3.4) * wA * 0.5);
  // ---- the shroud: its sides ripple with the wave and swell with the breath; the hem's four tatters hang from the chains
  const tip = (i) => { const c = pup && pup.chains['h' + i]; return c ? [q(TIP_X[i] + c.pts[0].x - c.ax), q(30 + c.pts[0].y - c.ay + P.hem)] : [TIP_X[i], q(34 + P.hem)]; };
  const t0 = tip(0), t1 = tip(1), t2 = tip(2), t3 = tip(3); const cx = q(15 + w3), cy = q(6 - br * 0.6);
  const shroud = path(`M${t3[0]} ${t3[1]} C${q(6 - w1 - br * 0.4)} 24 ${q(6 - w2 - br * 0.6)} 14 ${cx} ${cy} C${q(24 + w2 + br * 0.6)} 14 ${q(24 + w1 + br * 0.4)} 24 ${t0[0]} ${t0[1]} L20 30 L${t1[0]} ${t1[1]} L15 30 L${t2[0]} ${t2[1]} L10 30 Z`, BODY_G);
  const rim = stroke(`M${q(8.5 - w1 * 0.5)} 28 C${q(8 - w1 * 0.8)} 20 ${q(9 - w2 * 0.8)} 12 ${q(15 + w3 * 0.9)} ${q(7 - br * 0.6)}`, '#e8f6ff', 0.9, { opacity: 0.8 });
  // ---- the face slides with the look and sinks when he dozes; hollow eyes with a drifting light, the o of the mouth
  const fx = P.lookX * 1.1, fy = P.lookY * 0.6 + dz * 0.6; const open = clamp(P.eyeOpen, 0, 1) * (1 - 0.5 * dz), wd = clamp(P.wide, 0, 1.5);
  const rx = 1.4 * (1 + 0.2 * wd), ry = 2.2 * open * (1 + 0.25 * wd);
  const eyeAt = (ex, ey) => { ex += fx; ey += fy;
    if (open < 0.12) return stroke(`M${n(ex - rx)} ${n(ey + 0.3)} L${n(ex + rx)} ${n(ey + 0.3)}`, INK, 0.9, { opacity: 0.9 });
    return [ell(ex, ey, rx, ry, INK), circ(ex - 0.2 + P.lookX * 0.45, ey - 0.7 * open + P.lookY * 0.5, 0.5 + 0.15 * wd, LIGHT)]; };
  const mo = clamp(P.mouth, 0, 2.2) * (1 - 0.4 * dz);
  const mouth = ell(15 + fx * 0.8, 20 + fy * 0.7, 0.4 + 0.8 * mo, 0.3 + 1.5 * mo, INK, { opacity: 0.8 });
  // ---- the arm reaches from the shoulder to the hand; the bell hangs from the hand by its crown and swings about it
  const a = (ARM_REST + P.arm) * RAD; const hx = SHOULDER_X + Math.cos(a) * ARM_LEN, hy = SHOULDER_Y - Math.sin(a) * ARM_LEN;
  const arm = stroke(`M${SHOULDER_X} ${SHOULDER_Y} L${n(hx)} ${n(hy)}`, PALE, 1.8, { opacity: 0.9 });
  const bell = g([circ(0, 0, 0.8, BELL), path('M-3 5.5 C-3 -0.5 3 -0.5 3 5.5 L4 7.5 L-4 7.5 Z', BELL, { stroke: BELL_INK, strokeWidth: 0.7 }), circ(clamp(P.clap, -3, 3), 8, 0.9, BELL_INK)], { transform: `${tr(hx, hy)} ${rot(P.bell)}` });
  // ---- sound rings spreading from the bell's mouth after a toll (the still's rings are a toll caught at k 0.889)
  const k = P.ringK; let rings = null;
  if (k > 0.03 && k < 1.4) { const b = P.bell * RAD; const mx = hx - 6.5 * Math.sin(b), my = hy + 6.5 * Math.cos(b); const op = Math.min(0.6, 0.685 * (1.4 - k)) / Math.max(fade, 0.35);
    rings = [circ(mx, my, 9 * k, 'none', { stroke: LIGHT, strokeWidth: 0.6, opacity: Math.min(1, op) }), k > 0.34 ? circ(mx, my, 9 * k - 3, 'none', { stroke: LIGHT, strokeWidth: 0.6, opacity: Math.min(1, op) }) : null]; }
  const body = g([shroud, rim, eyeAt(12.2, 15), eyeAt(17.8, 15), mouth, arm, bell, rings], { transform: `${tr(PX + P.shake, PY)} ${rot(P.lean)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-PX, -PY)}`, opacity: fade });
  const halo = glow(15, 14, 9 + 4 * P.halo, LIGHT, 0.35 * clamp(P.halo, 0, 2) * fade / 0.82);
  return svg(W, H, [g([halo, body], { transform: tr(P.drift, -(P.hover + P.lift)) })]);
}

// a template point in world units through the hover (the lean and the squash are small and ignored), written to out
function worldPt(e, P, s, x, y, out) { out[0] = e.tx * TILE + 8 + (x - PX + P.drift) * s; out[1] = e.ty * TILE + TILE + (y - H - P.hover - P.lift) * s; }

// ---- animation: from the game (Mote's whereabouts, the dialogue) and his own timers to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, game = info.game, P = pup.P;
  if (m.init === undefined) {
    m.init = true; m.t0 = Math.random() * 10; m.ph = Math.random() * 6.3; m.wph = Math.random() * 6.3; m.bph = Math.random() * 6.3;
    m.blink = 2 + Math.random() * 4; m.blinkT = 0; m.blinkLen = 0.22; m.glance = 2 + Math.random() * 3; m.gx = 0.3; m.gy = 0.2;
    m.near = false; m.far = 0; m.doze = 0; m.dlg = false; m.dlgI = -1; m.lineT = 9; m.endT = 9; m.bowDir = 1;
    m.ringNext = 3 + Math.random() * 4; m.ringT = 9; m.strikes = 0; m.struck = 9; m.amp = 1; m.ringK = 2; m.vib = 0; m.trem = 0;
    m.gutter = 3 + Math.random() * 5; m.gutT = 0; m.fidget = 2 + Math.random() * 3; m.kind = ''; m.fidT = 9; m.puffed = true; m.side = 1;
    m.gustCd = 0; m.gustT = 0; m.gustV = 0; m.px = 0; m.py = 0; m.pv = false; m.bub = new Float32Array(BUB * BP); m.bi = 0; m.wp = [0, 0];
  }
  const t = pup.time + m.t0, s = pup.scale || SCALE;
  const ch = [pup.chain('h0', TIP_X[0], 30, TIP_REST), pup.chain('h1', TIP_X[1], 30, TIP_REST), pup.chain('h2', TIP_X[2], 30, TIP_REST), pup.chain('h3', TIP_X[3], 30, TIP_REST)];
  const wx = e.tx * TILE + 8, wy = e.ty * TILE + TILE; // the tile bottom, in world units
  // ---- Mote: where they are relative to his eyes, and how much of his attention they get
  const pl = game && game.player; let dx = 0, dy = 0, dist = 1e9, pvx = 0;
  if (pl && !pl.dead) { dx = pl.x + pl.w / 2 - wx; dy = pl.y + pl.h / 2 - (wy - (H - 15 + 4.3) * s); dist = Math.hypot(dx, dy); pvx = pl.vx; }
  const att = Anim.smooth(dist, 170, 70), near = dist < 130, side = dx < 0 ? -1 : 1;
  // ---- the conversation: ui.dialogue is set while one runs, nearInteract is the friend it was opened on
  const dlg = game && game.ui ? game.ui.dialogue : null; const talking = !!dlg && game.nearInteract === e;
  const line = talking ? dlg.lines[dlg.i] : null; const typing = !!line && dlg.shown < line.text.length;
  // ---- events, found by watching the state change
  const arrive = near && !m.near; m.near = near;
  const talkStart = talking && !m.dlg, talkEnd = !talking && m.dlg; m.dlg = talking;
  const newLine = talking && !talkStart && dlg.i !== m.dlgI; m.dlgI = talking ? dlg.i : -1;
  // ---- drifting off: a long while with nobody by (time out of view counts) dims and sinks him; being come upon wakes him with a start
  const gap = m.lastT === undefined ? 0 : info.t - m.lastT; m.lastT = info.t;
  if (gap > 0.5) m.pv = false; if (gap > 1.5) { m.far += gap; m.doze = Math.max(m.doze, clamp((m.far - 16) / 6, 0, 1)); }
  m.far = near || talking ? 0 : m.far + dt; const dozeTo = clamp((m.far - 16) / 6, 0, 1); m.doze += clamp(dozeTo - m.doze, -dt * 3, dt * 0.2);
  const startle = near && m.doze > 0.25; const doze = m.doze;
  const toll = (amp, strikes, from) => { m.ringT = from; m.strikes = strikes; m.struck = 0; m.amp = amp; m.ringNext = 6 + Math.random() * 8; };
  if (startle || arrive) {
    const k = startle ? 1 + 2 * doze : 1; m.glance = 9; m.blink = Math.max(m.blink, 1.2); m.fidget = Math.max(m.fidget, 2);
    pup.impulse('lift', 28 * k).impulse('wide', 7 * k).impulse('halo', 8 * k).impulse('flare', 2.5 * k).impulse('lean', 30 * k * side).impulse('hem', 10 * k).impulse('bell', 90 * k);
    m.gustT = 0.14; m.gustV = -260 * k * side; // a flinch: the hem swept away from them
    if (startle) { m.doze = 0; m.far = 0; toll(0.8, 1, 0.3); } // the bell jangles in his hand
  }
  if (talkStart) { m.lineT = 0; m.endT = 9; m.kind = ''; m.fidT = 9; pup.impulse('lift', 40).impulse('flare', 4).impulse('halo', 10).impulse('wide', 5).impulse('waveA', 10); if (m.ringT > 1.9) toll(0.65, 1, 0.12); }
  if (newLine) { m.lineT = 0; pup.impulse('lift', -70).impulse('lean', 120 * side).impulse('halo', 8).impulse('hem', -12).impulse('sy', -0.7); }
  if (talkEnd) { m.endT = 0; m.bowDir = side; pup.impulse('halo', 4).impulse('lift', 10); }
  m.lineT += dt; m.endT += dt;
  // ---- the hover: a slow figure of eight (sunk and slower when dozing); the body leans into its drift
  m.ph += dt * 1.3 * (1 - 0.3 * doze); m.wph += dt * (1.9 + 0.8 * att + (typing ? 1.5 : 0)); m.bph += dt * 0.9;
  const hover = 4.3 + Math.sin(m.ph) * 2.9 * (1 - 0.35 * doze) - 3.2 * doze, drift = Math.sin(m.ph * 0.5 + 0.7) * 1.6;
  const bx = drift, by = -(hover + P.lift); let vx = 0, vy = 0;
  if (dt > 0 && m.pv) { vx = (bx - m.px) / dt; vy = (by - m.py) / dt; } m.px = bx; m.py = by; m.pv = true; // (no velocity on the first frame or after a gap)
  // ---- his own toll: anticipation, the flick on the hit frame, the settle; keyed to his timer, sometimes a double
  m.ringNext -= dt;
  if (m.ringNext < 0 && m.ringT > 1.9 && !talking && doze < 0.3 && m.fidT > 1) toll(1, Math.random() < 0.3 ? 2 : 1, 0);
  m.ringT += dt; const clip = Anim.keys(m.ringT, m.strikes === 2 ? TOLL2 : TOLL); const at = STRIKES[m.strikes === 2 ? 1 : 0];
  if (m.struck < at.length && m.ringT >= at[m.struck]) {
    const amp = m.amp * (m.struck ? 0.75 : 1); m.struck++; m.ringK = 0; m.trem = Math.max(m.trem, amp);
    pup.impulse('bell', 380 * amp).impulse('clap', -60 * amp).impulse('flare', 4 * amp).impulse('halo', 11 * amp).impulse('sy', -1.3 * amp).impulse('sx', 0.9 * amp).impulse('wide', 6 * amp).impulse('hem', 14 * amp).impulse('waveA', 9 * amp);
    m.gustT = 0.12; m.gustV = 300 * amp;
  }
  m.ringK = Math.min(2, m.ringK + dt * 2.6); m.trem *= Math.exp(-dt * 4.5); m.vib += dt * 55;
  // ---- idle life: blinks (slow, sometimes doubled), glances, the gutter of his light, fidgets on a random timer
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.35 : 3 + Math.random() * 4; m.blinkT = m.blinkLen = Math.random() < 0.3 ? 0.4 : 0.22; }
  let open = 1; if (m.blinkT > 0) { m.blinkT -= dt; const h = m.blinkLen / 2; open = m.blinkT > h ? 1 - (m.blinkLen - m.blinkT) / h : m.blinkT / h; }
  m.glance -= dt; if (m.glance < 0) { m.glance = 2 + Math.random() * 4; m.gx = (Math.random() - 0.5) * 1.4; m.gy = (Math.random() - 0.6) * 0.8; }
  m.gutter -= dt; if (m.gutter < 0) { m.gutter = 3 + Math.random() * 6; m.gutT = 0.4; }
  let gut = 0; if (m.gutT > 0) { m.gutT -= dt; gut = Math.sin(clamp(1 - m.gutT / 0.4, 0, 1) * Math.PI) * 0.28; }
  m.fidget -= dt;
  if (m.fidget < 0 && m.ringT > 1.6 && !talking && m.endT > 1.3 && doze < 0.5) {
    m.fidget = 3 + Math.random() * 4; m.fidT = 0; m.puffed = false; m.side = Math.random() < 0.5 ? -1 : 1; const r = Math.random();
    m.kind = r < 0.4 ? 'bubble' : r < 0.6 ? 'shiver' : r < 0.8 ? 'sway' : 'tremor';
    if (m.kind === 'shiver') { m.trem = Math.max(m.trem, 0.55); m.gutT = 0.5; m.blinkT = m.blinkLen = 0.3; pup.impulse('sx', -0.8).impulse('hem', -8); }
    if (m.kind === 'sway') pup.impulse('lean', 55 * m.side).impulse('lift', 12).impulse('waveA', 5);
    if (m.kind === 'tremor') pup.impulse('bell', 110 * m.side).impulse('clap', -30 * m.side).impulse('halo', 3);
  }
  m.fidT += dt; let mouth = clip.mouth, lookOff = 0;
  if (m.kind === 'bubble' && m.fidT < 0.85) {
    mouth = Math.max(mouth, Anim.keys(m.fidT, PUFF).m); lookOff = -0.35;
    if (!m.puffed && m.fidT > 0.26) { m.puffed = true; const nb = 1 + Math.floor(Math.random() * 3); worldPt(e, P, s, 15 + P.lookX * 0.9, 19.5, m.wp);
      for (let i = 0; i < nb; i++) { const o = m.bi * BP; m.bi = (m.bi + 1) % BUB; m.bub[o] = m.wp[0] + (Math.random() - 0.5) * 2; m.bub[o + 1] = m.wp[1] + i * 1.5; m.bub[o + 2] = (Math.random() - 0.5) * 6; m.bub[o + 3] = 0; m.bub[o + 4] = 1.1 + Math.random() * 0.9; } }
  }
  // ---- Mote passing at speed stirs the hem and tips him
  m.gustCd -= dt; m.gustT -= dt;
  if (m.gustCd < 0 && dist < 60 && Math.abs(pvx) > 250) { m.gustCd = 0.7; m.gustT = 0.2; m.gustV = pvx / s * 0.3; pup.impulse('lean', pvx > 0 ? 40 : -40).impulse('waveA', 6).impulse('hem', 6).impulse('bell', pvx > 0 ? -80 : 80); }
  // ---- eyes: glances when alone, a steady drift to Mote when they are near; the talk holds them there
  const toX = clamp(dx / 50, -1, 1), toY = clamp(dy / 50, -1, 1);
  const lookX = talking ? toX : lerp(m.gx, toX, att), lookY = talking ? toY * 0.8 : lerp(m.gy, toY * 0.8, att) + lookOff;
  // ---- the body: breath, lean into the drift and toward Mote, the toll's recoil, the talk's bob and the bow
  const br = 0.5 + 0.5 * Math.sin(m.bph); let lean = vx * 3.5 + toX * 2.5 * att + clip.lean + 1.5 * doze, sy = 1 + 0.015 * br, sx = 1 - 0.008 * br, arm = clip.arm - 10 * doze, halo = 1 + 0.25 * att + 0.12 * Math.sin(t * 1.1) - 0.45 * doze, waveA = 0.5 + 0.3 * att - 0.3 * doze, lift = 0;
  if (talking) {
    lean += side * (typing ? 2 : 1.2); halo += typing ? 0.25 : 0.12; waveA += typing ? 0.7 : 0.2;
    if (typing) { const syl = Math.max(0, Math.sin(t * 13)) * (0.55 + 0.45 * Math.sin(t * 5.3 + 1)); mouth = Math.max(mouth, 0.45 + 1.3 * syl); sy += 0.02 * Math.sin(t * 8.5); lift = 1 + 0.8 * Math.sin(t * 8.5); lean += Math.sin(t * 4.2) * 1.2; }
    else mouth = Math.max(mouth, 0.85);
  } else if (m.endT < 1.2) { const b = Anim.keys(m.endT, BOW); lean += b.lean * m.bowDir; lift += b.dip; }
  const fade = 0.82 + 0.06 * Math.sin(t * 0.9) + 0.03 * Math.sin(t * 2.3 + 1) - gut - 0.25 * doze;
  pup.target({ hover, drift, lift, lean, sx, sy, shake: Math.sin(m.vib) * m.trem * 1.1, fade, flare: 0, halo, wave: m.wph, waveA, breath: br, eyeOpen: clamp(open * clip.eye, 0, 1), lookX, lookY, mouth, arm, ringK: m.ringK, doze });
  // ---- secondary motion: the tatters trail the hover, sway in a slow current, shiver with the tremble, are flung by gusts
  if (dt > 0) {
    const env = { vx: vx * 42, vy: vy * 12, facing: 1, gravity: 26, drag: 0.6, stiff: 2.2, damp: 0.9, wind: { x: 0, y: 0 } };
    const gust = (m.gustT > 0 ? m.gustV : 0) + Math.sin(t * 40) * 170 * m.trem;
    for (let i = 0; i < 4; i++) { env.wind.x = Math.sin(t * 2.1 + i * 1.9) * (34 + 10 * att) + gust; env.wind.y = Math.cos(t * 1.7 + i) * 6; ch[i].update(dt, env); }
    pup.target({ hem: clamp(-vy * 0.18, -1.6, 1.6) - 0.2 * doze });
  }
  // ---- bubbles: rise, wobble and go out (drawn by after())
  const b = m.bub;
  for (let i = 0; i < BUB; i++) { const o = i * BP; if (b[o + 4] <= 0 || b[o + 3] >= b[o + 4]) continue; b[o + 3] += dt; b[o] += (b[o + 2] + Math.sin(b[o + 3] * 7 + i) * 5) * dt; b[o + 1] -= (9 + 3 * i) * dt; }
}

// world-space light over the body: the halo's glow on its surroundings, the bell's glint as it rings, and the bubbles
function after(ctx, e, pup, info) {
  const P = pup.P, m = pup.mem; if (!m.bub) return; const s = pup.scale || SCALE, wp = m.wp;
  const fade = clamp(P.fade + P.flare, 0, 1) / 0.82;
  if (info.glowAt) {
    worldPt(e, P, s, 15 + P.lookX * 0.5, 14, wp); info.glowAt(wp[0], wp[1], 12 + 10 * clamp(P.halo, 0, 2), LIGHT, (0.07 + 0.09 * clamp(P.halo, 0, 2)) * fade);
    if (m.ringK < 1.2) { const a = (ARM_REST + P.arm) * RAD, bl = P.bell * RAD; worldPt(e, P, s, SHOULDER_X + Math.cos(a) * ARM_LEN - 6.5 * Math.sin(bl), SHOULDER_Y - Math.sin(a) * ARM_LEN + 6.5 * Math.cos(bl), wp); info.glowAt(wp[0], wp[1], 7 + 9 * m.ringK, '#dff6ff', 0.32 * (1 - m.ringK / 1.2)); }
  }
  const b = m.bub; let any = false; for (let i = 0; i < BUB; i++) if (b[i * BP + 4] > 0 && b[i * BP + 3] < b[i * BP + 4]) { any = true; break; }
  if (!any) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 0.5;
  for (let i = 0; i < BUB; i++) {
    const o = i * BP; const life = b[o + 4], age = b[o + 3]; if (life <= 0 || age >= life) continue;
    const k = age / life, pop = k > 0.9 ? (k - 0.9) / 0.1 : 0; const r = 0.7 + 0.5 * k + pop * 1.2, x = b[o], y = b[o + 1];
    ctx.strokeStyle = `rgba(200,240,255,${(0.75 * (1 - pop)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
    if (!pop) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, 0.25, 0, 6.2832); ctx.fill(); }
  }
  ctx.restore();
}

module.exports = { name: 'ringer', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
