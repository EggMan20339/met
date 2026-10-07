// Snuffer: a lantern that went out and learned to hunt; its eyes are the last two flames.
//
// It drifts around its spawn point (src/entities.js case 'g') on a lazy hover, tilting into its motion like a lantern on
// an unseen hook, its two flame-eyes guttering and flaring while a wisp of smoke trails from its base. When Mote comes
// close it stops to telegraph ('tele', 0.45 s): the flames go white-hot, the halo swells, the bars bow out and rattle
// under the fire's pressure, the lid lifts and leaks light, and the whole lantern rears back away from its prey. At
// e.t > 0.45 the game hurls it at Mote ('lunge', 0.55 s): the lantern whips over cap-first into the dive, stretches
// along its line with the flames gone red and streaming back through the bars, the lid flapping, after-images behind it
// (ghosts, plus the old motion-blur discs in before()). A hit snuffs it: the flames collapse to slits, the lid clatters,
// it rolls over once, dark and dazed, then the flames catch again with a whoomp. The lantern is symmetrical and drifts
// every way, so it exports flip() = false and works in world orientation. See art/ANIMATION.md.
const L = require('../lib');
const { svg, rad, path, ell, circ, stroke, g, rot, tr, curve, mix, clamp, num: n } = L;
const W = 22, H = 22, PX = 11, PY = 11.5, EY = 11, EL = 8.6, ER = 13.4, WX = 11, WY = 18.5; // template box; the cage centre is the pivot; the flame-eyes; the wisp root
const SCALE = 0.68, SPEED = 60, LUNGE = 260, TELE_T = 0.45, LUNGE_T = 0.55; // ART_SCALE.snuffer, ENEMY_DEFS.g speed and lunge, the game's state timers
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const LINE = '#120c0c', CAP = '#3a2626', SMOKE = '#3a2626', CANDLE = '#ffd24a', WHITEHOT = '#ffe9b0', RAGE = '#ff6a3a', EMBER = '#ffb347';
const BAR_X = [-4, 0, 4];
const WISP_REST = [{ x: -0.8, y: 1.3 }, { x: 0.7, y: 2.7 }, { x: -0.2, y: 4 }];
const SPARKS = [[0, -1.2, 0], [0.37, 0.9, 2.1], [0.71, -0.2, 4.2]]; // rise-phase offset, x offset, drift phase
const LID = [path('M6 6 C7 2.5 15 2.5 16 6 Z', CAP, { stroke: LINE, strokeWidth: 0.8 }), circ(11, 2.6, 1.2, CAP)];
// paint built once: the cage interior and the halo at 11 colour temperatures (hot) x 16 halo strengths (glowK)
const CAGE = [], HALO = [];
for (let h = 0; h <= 10; h++) {
  const col = mix(CANDLE, WHITEHOT, h / 10);
  CAGE.push(rad('sc', 11, 10.5, 7.5, [[0, mix('#4a3232', '#8a6c4a', h / 10)], [0.55, mix('#2e2020', '#5a4a3a', h / 10)], [1, '#231818']]));
  HALO.push(Array.from({ length: 16 }, (_, gi) => { const gk = gi / 10, r = 9.5 + gk * 1.5; return circ(11, 11, r, rad('gl', 11, 11, r, [[0, col, 0.2 + gk * 0.35], [1, col, 0]])); }));
}

const params = {
  bobX: 0, bobY: 0, shakeX: 0,           // hover offset and telegraph jitter (template units), written straight from control
  lean: 0, spin: 0,                      // body tilt (deg, + tips the cap toward +x) on a pendulum spring; the dazed roll (deg), keyed to the hit clock
  sx: 1, sy: 1,                          // squash / stretch about the cage centre
  stretch: 1, stretchA: 0,               // elongation along the travel line (1 = none) and that line's angle (deg, world)
  cageOpen: 0, rattle: 0, ph: 0,         // bars bowed outward by the fire (-1 pinched .. 1.5 bulging), rattle amplitude 0..1 and its clock
  capLift: 0, capTilt: 0,                // the lid lifted (template units) and tilted (deg); light leaks out under a lifted lid
  eyeK: 1, eyeOpen: 1, lookX: 0, lookY: 0, // flame-eye size, lid (a blink is a gutter), gaze (-1..1)
  tongueL: 0.65, tongueR: 0.65, flameLean: 0, // flame tongue heights (1 = tall) and the way they stream (deg, + toward +x)
  hot: 0, rage: 0, glowK: 0.2,           // colour temperature (candle .. white-hot), hunting red, halo strength 0..1.5
  spark: 0, sparkPh: 0,                  // embers escaping past the lid: amount and their rise phase 0..1
  hover: 1,                              // hover amplitude (eases to 0 when it stops to telegraph); read back by control, not by make
};
// [stiffness, damping ratio] for the values that overshoot and settle; the rest (hover offsets, clocks, flicker, gaze slits) snap
const springs = {
  lean: [170, 0.4], sx: [380, 0.5], sy: [380, 0.5], stretch: [260, 0.55], cageOpen: [520, 0.28], capLift: [480, 0.35], capTilt: [360, 0.3],
  eyeK: [420, 0.55], lookX: [160, 0.8], lookY: [160, 0.8], flameLean: [220, 0.5], hot: [110, 1], rage: [140, 1], glowK: [100, 1], hover: [30, 1],
};
// stills exported to art/snuffer_<pose>.svg (idle and tele are the originals; lunge and hurt are new)
const poses = {
  idle: {},
  tele: { hot: 1, glowK: 1.3, eyeK: 1.3, tongueL: 1.6, tongueR: 1.5, cageOpen: 1.1, capLift: 0.7, capTilt: 4, lean: -18, sx: 1.08, sy: 0.9, spark: 0.9, sparkPh: 0.3, lookX: 1, rattle: 0.8, ph: 1.3, flameLean: 24 },
  lunge: { lean: 52, stretch: 1.32, stretchA: 0, hot: 0.6, rage: 1, glowK: 0.9, eyeK: 1.15, eyeOpen: 0.75, flameLean: -42, tongueL: 1.3, tongueR: 1.2, capLift: 1.1, capTilt: -14, cageOpen: 0.5, spark: 1, sparkPh: 0.6, lookX: 1 },
  hurt: { spin: 48, eyeOpen: 0.25, eyeK: 0.7, glowK: 0.04, tongueL: 0.15, tongueR: 0.2, capLift: 1.6, capTilt: 24, cageOpen: -0.6, sx: 1.1, sy: 0.9, spark: 0.4, sparkPh: 0.8 },
};

// where a template point of the body ends up after the body's transform (hover, stretch along the travel line, tilt, squash),
// so the wisp can hang from the cage's base wherever it has swung to
function bodyPoint(P, lx, ly) {
  const th = (P.lean + P.spin) * DEG, A = P.stretchA * DEG, S = Math.max(0.6, P.stretch), Sy = 1 / Math.sqrt(S);
  let x = (lx - PX) * P.sx, y = (ly - PY) * P.sy, c = Math.cos(th), s = Math.sin(th);
  const x2 = x * c - y * s, y2 = x * s + y * c;
  c = Math.cos(A); s = Math.sin(A); x = (x2 * c + y2 * s) * S; y = (-x2 * s + y2 * c) * Sy;
  return [PX + P.bobX + P.shakeX + x * c - y * s, PY + P.bobY + x * s + y * c];
}
// the tilt that points the cap along the velocity (it dives head first), taken part of the way; straight down is ambiguous so it keeps its side
const diveLean = (vx, vy, cur) => { if (Math.hypot(vx, vy) < 20) return cur; let th = Math.atan2(vy, vx) / DEG + 90; if (th > 180) th -= 360; if (Math.abs(th) > 150) th = Math.abs(th) * (Math.sign(cur) || 1); return th * 0.6; };

function make(P, pup) {
  const hq = Math.round(clamp(P.hot, 0, 1) * 10), gq = Math.round(clamp(P.glowK, 0, 1.5) * 10); // paint quantised so the gradient caches hold
  const fl = P.rage > 0.01 ? mix(mix(CANDLE, WHITEHOT, hq / 10), RAGE, clamp(P.rage, 0, 1)) : mix(CANDLE, WHITEHOT, hq / 10);
  const open = clamp(P.eyeOpen, 0, 1), ek = Math.max(0.2, P.eyeK), ratt = clamp(P.rattle, 0, 1.5);
  // the halo: world-aligned (outside the body's tilt), riding the hover
  const halo = g([HALO[hq][gq]], { transform: tr(P.bobX + P.shakeX, P.bobY) });
  // the cage: lit from inside, its bars bowing outward under the fire's pressure and rattling loose
  const cage = ell(11, 11.5, 6.5, 7.5, CAGE[hq], { stroke: LINE, strokeWidth: 0.9 });
  const bars = BAR_X.map((bx, i) => { const wob = Math.sin(P.ph + i * 2.1) * ratt * 0.8, bow = bx * (1.2 + P.cageOpen * 0.32) + wob; return stroke(`M${n(11 + bx)} 5 C${n(11 + bow)} 9 ${n(11 + bow)} 14 ${n(11 + bx)} 18`, LINE, 0.7, { opacity: 0.8 }); });
  // the lid: lifts (and bounces on the rattling cage), tilts, and leaks light when it is open
  const lift = Math.max(0, P.capLift) + Math.abs(Math.sin(P.ph * 0.7)) * ratt * 0.5;
  const leak = lift > 0.06 ? ell(11, 5.3, 4.4, 0.45 + lift * 0.4, fl, { opacity: clamp(lift * 0.55, 0, 0.9) }) : null;
  const lid = g(LID, { transform: `${tr(0, -lift)} ${rot(P.capTilt, 11, 6)}` });
  // embers escaping past the lid, rising and drifting the way the flames stream
  const a = clamp(P.flameLean, -65, 65) * DEG, sa = Math.sin(a), ca = Math.cos(a), sk = clamp(P.spark, 0, 1);
  const sparks = sk > 0.03 ? SPARKS.map(([o, px, dp]) => { const f = (P.sparkPh + o) % 1; return circ(11 + px + Math.sin(f * 9 + dp) * 1.2 + sa * f * 4, 4.4 - lift - f * 7.5, 0.6 * (1 - f * 0.5), EMBER, { opacity: sk * (1 - f) * 0.9 }); }) : null;
  // the flame-eyes: a halo, a tongue that gutters, flares and streams, the bright core (a slit when it blinks) and a glint
  const flame = (ex, tongue) => {
    const h = Math.max(0, 3.2 * tongue * ek * (0.25 + 0.75 * open)), w = 1.15 * ek, tx = ex + sa * h, ty = EY - ca * h;
    const px = ex + P.lookX * 0.45, py = EY + P.lookY * 0.35;
    const tongueD = (w, h, tx, ty) => `M${n(ex - w)} ${n(EY)} C${n(ex - w * 1.15)} ${n(EY - h * 0.4)} ${n(tx - w * 0.45)} ${n(ty + h * 0.35)} ${n(tx)} ${n(ty)} C${n(tx + w * 0.45)} ${n(ty + h * 0.35)} ${n(ex + w * 1.15)} ${n(EY - h * 0.4)} ${n(ex + w)} ${n(EY)} Z`;
    return [
      circ(ex, EY, 2.34 * ek, fl, { opacity: 0.25 }),
      h > 0.3 ? path(tongueD(w, h, tx, ty), fl, { opacity: 0.85 }) : null,
      h > 1.4 ? path(tongueD(w * 0.5, h * 0.62, ex + sa * h * 0.62, EY - ca * h * 0.62), '#fff6d8', { opacity: 0.75 }) : null,
      ell(px, py, 1.3 * ek, 1.3 * ek * Math.max(0.12, open), fl),
      open > 0.5 ? circ(px - 0.45 * ek, py - 0.58 * ek * open, 0.585 * ek, '#ffffff', { opacity: 0.8 }) : null,
    ];
  };
  // the smoke wisp hangs from the cage's base in world-aligned space: a verlet rope when animated, its rest curve for the stills
  let wp; if (pup && pup.chains.wisp) wp = pup.chains.wisp.points(); else { const [ax, ay] = bodyPoint(P, WX, WY); wp = [{ x: ax, y: ay }].concat(WISP_REST.map((q) => ({ x: ax + q.x, y: ay + q.y }))); }
  const tip = wp[wp.length - 1];
  const wd = curve(wp);
  const wisp = [stroke(wd, SMOKE, 1.3), stroke(wd, '#6a4a44', 0.5, { opacity: 0.35 + 0.3 * clamp(P.glowK, 0, 1) }), gq > 3 ? circ(tip.x, tip.y, 0.5, EMBER, { opacity: 0.25 * clamp(P.glowK - 0.3, 0, 1) }) : null];
  const S = Math.max(0.6, P.stretch);
  const body = g([cage, bars, leak, flame(EL, P.tongueL), flame(ER, P.tongueR), lid, sparks],
    { transform: `${tr(PX + P.bobX + P.shakeX, PY + P.bobY)}${Math.abs(S - 1) > 0.004 ? ` ${rot(P.stretchA)} scale(${n(S)} ${n(1 / Math.sqrt(S))}) ${rot(-P.stretchA)}` : ''} ${rot(P.lean + P.spin)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-PX, -PY)}` });
  return svg(W, H, [halo, wisp, body]);
}

// ---- animation: from the enemy's state (idle / tele / lunge, see updateEnemy case 'g') to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, P = pup.P;
  if (m.init === undefined) {
    m.init = true; m.state = 'idle'; m.hp = e.hp; m.flash = e.flash || 0; m.t0 = Math.random() * 10; m.dirX = e.facing || 1; m.dirY = 0;
    m.hitT = 9; m.endT = 9; m.flareT = 0; m.rattleT = 0; m.burst = 0; m.relit = true; m.kdir = 1; m.ph = 0; m.sparkPh = Math.random(); m.ghostT = 0;
    m.blink = 1.5 + Math.random() * 3; m.blinkT = 0; m.fidget = 2 + Math.random() * 3; m.gx = 0; m.gy = 0;
  }
  const t = pup.time + m.t0, st = e.state, vx = e.vx, vy = e.vy, speed = Math.hypot(vx, vy);
  const wisp = pup.chain('wisp', WX, WY, WISP_REST);
  // ---- events, found by watching the state and the health change
  const teleStart = st === 'tele' && m.state !== 'tele', lungeStart = st === 'lunge' && m.state !== 'lunge', lungeEnd = m.state === 'lunge' && st !== 'lunge';
  const hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0);
  m.state = st; m.hp = e.hp; m.flash = e.flash || 0;
  if (teleStart) { // it spots its prey (it was closing on it, so its velocity says where): the flames jump, the lid pops, the cage bulges, it rears back
    if (speed > 8) { m.dirX = vx / speed; m.dirY = vy / speed; } else { m.dirX = e.facing || 1; m.dirY = 0; }
    pup.impulse('eyeK', 7).impulse('glowK', 5).impulse('sy', 3).impulse('sx', -2).impulse('capLift', 14).impulse('cageOpen', 8).impulse('lean', -m.dirX * 260); m.flareT = 0.25; m.burst = 0.8;
  }
  if (lungeStart) { // the strike: whip over into the dive, stretch, the lid flies open, embers burst out
    const Ld = diveLean(vx, vy, P.lean);
    pup.impulse('lean', (Ld - P.lean) * 2.6).impulse('stretch', 3).impulse('capLift', 40).impulse('capTilt', -480 * (Math.sign(vx) || 1)).impulse('cageOpen', 16).impulse('glowK', 9).impulse('eyeK', 5).impulse('sx', 3);
    m.burst = 1.2; m.ghostT = 0;
  }
  if (lungeEnd) { m.endT = 0; pup.impulse('sy', -3.5).impulse('sx', 2.6).impulse('capLift', -28).impulse('capTilt', 320).impulse('cageOpen', -10).impulse('stretch', -4); } // the lid slams, the body squashes as it brakes
  if (hit) { // struck: the light goes out, the lid clatters, the cage pinches, and it rolls over the way it was shoved
    m.hitT = 0; m.relit = false; m.kdir = Math.sign(vx) || 1; m.rattleT = 0.4;
    pup.impulse('capLift', 44).impulse('capTilt', -700 * m.kdir).impulse('cageOpen', -14).impulse('sx', 3.5).impulse('sy', -3).impulse('eyeK', -6).impulse('glowK', -6).impulse('lean', -600 * m.kdir).impulse('flameLean', 500 * m.kdir);
  }
  m.hitT += dt; m.endT += dt; m.flareT -= dt; m.rattleT -= dt; m.burst = Math.max(0, m.burst - dt * 1.8);
  const dazed = m.hitT < 0.55, dark = m.hitT < 0.42;
  if (!m.relit && !dark) { m.relit = true; m.flareT = 0.4; m.burst = 1; pup.impulse('eyeK', 10).impulse('glowK', 8).impulse('capLift', 14).impulse('cageOpen', 9).impulse('sy', 2.5); } // the flames catch again
  // ---- idle life: the flames gutter on their own (worse once it burns low), a blink is a gutter that nearly dies, fidgets on a random timer
  const low = e.hp < e.def.hp ? 1 : 0;
  const gutL = 1 + (0.28 + 0.3 * low) * (Math.sin(t * 23) * Math.sin(t * 7.3) * 0.7 + Math.sin(t * 41.7) * 0.3) + Math.sin(t * 3.1) * 0.08;
  const gutR = 1 + (0.28 + 0.3 * low) * (Math.sin(t * 19.3 + 1) * Math.sin(t * 8.1) * 0.7 + Math.sin(t * 37.3) * 0.3) + Math.sin(t * 2.7 + 2) * 0.08;
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.35 : 2.5 + Math.random() * 4; m.blinkT = 0.14; }
  let open = 1; if (m.blinkT > 0) { m.blinkT -= dt; open = m.blinkT > 0.07 ? 1 - (0.14 - m.blinkT) / 0.07 : m.blinkT / 0.07; }
  m.fidget -= dt;
  if (m.fidget < 0 && st === 'idle' && !dazed) {
    m.fidget = 2 + Math.random() * 4; const r = Math.random();
    if (r < 0.35) { m.flareT = 0.4; pup.impulse('eyeK', 3).impulse('glowK', 3); }                                   // a flare-up
    else if (r < 0.6) { m.rattleT = 0.3; pup.impulse('cageOpen', 7).impulse('sx', -1.5); }                           // a shiver of the cage
    else if (r < 0.8) { pup.impulse('capLift', 18).impulse('capTilt', (Math.random() - 0.5) * 600); m.burst = 0.7; } // the lid clatters and sheds an ember
    else { m.gx = (Math.random() - 0.5) * 2; m.gy = (Math.random() - 0.5) * 1.6; }                                   // a glance
  }
  const flare = m.flareT > 0 ? clamp(m.flareT / 0.4, 0, 1) : 0;
  // ---- the base pose: a lazy hover, a tilt into the drift with a pendulum sway, flames streaming back from its own motion, a stare down its line when it hunts
  const hunting = st === 'idle' && speed > 42; const hv = clamp(P.hover, 0, 1);
  const th = (P.lean + P.spin) * DEG; const vlx = vx * Math.cos(th) + vy * Math.sin(th); // forward speed in the lantern's own frame
  const baseT = 0.65 - 0.17 * low;
  const T = {
    bobX: Math.sin(t * 1.3) * 2.4 * hv, bobY: Math.sin(t * 2.6) * 1.7 * hv, shakeX: 0, spin: 0, hover: 1,
    stretch: 1 + clamp(speed / LUNGE, 0, 1) * 0.12, stretchA: speed > 20 ? Math.atan2(vy, vx) / DEG : P.stretchA,
    lean: clamp(vx / SPEED, -1.3, 1.3) * 18 + Math.sin(t * 1.1) * 4.5 * hv, sx: 1 + Math.sin(t * 2.2) * 0.012, sy: 1 + Math.sin(t * 2.2) * 0.018,
    cageOpen: flare * 0.3, rattle: m.rattleT > 0 ? 0.6 : 0, capLift: flare * 0.3, capTilt: 0, eyeK: 1 + flare * 0.15,
    lookX: hunting ? clamp(vx / 40, -1, 1) : m.gx, lookY: hunting ? clamp(vy / 40, -1, 1) : m.gy,
    tongueL: baseT * gutL * (1 + flare * 0.9), tongueR: baseT * gutR * (1 + flare * 0.8), flameLean: -clamp(vlx / 110, -1, 1) * 42,
    hot: hunting ? 0.3 : 0, rage: 0, glowK: 0.2 - 0.06 * low + Math.sin(t * 3.1) * 0.04 + (hunting ? 0.15 : 0) + flare * 0.45, spark: (hunting ? 0.3 : 0.08) + flare * 0.5,
  };
  if (st === 'tele') {
    // the telegraph, keyed to the game's 0.45 s timer: it stops and rears back from its prey, the flames go white and reach for it, the halo
    // swells, the bars bow and rattle harder and harder, the lid lifts, embers pour out; at the end it crouches for the leap
    const k = clamp(e.t / TELE_T, 0, 1);
    const c = Anim.keys(k, [
      [0, { lean: 6, rise: 0, sx: 1, sy: 1, hot: 0.5, glowK: 0.7, eyeK: 1.25, tongue: 1.1, cageOpen: 0.4, rattle: 0.25, capLift: 0.25, spark: 0.4 }],
      [0.6, { lean: 22, rise: 1.6, sx: 1.07, sy: 0.92, hot: 1, glowK: 1.25, eyeK: 1.3, tongue: 1.6, cageOpen: 1, rattle: 0.6, capLift: 0.55, spark: 0.8 }, 'outQuad'],
      [1, { lean: 28, rise: 1, sx: 1.12, sy: 0.84, hot: 1, glowK: 1.5, eyeK: 1.35, tongue: 1.9, cageOpen: 1.3, rattle: 1, capLift: 0.9, spark: 1 }, 'inQuad'],
    ]);
    Object.assign(T, { hover: 0, lean: -m.dirX * c.lean, bobY: -c.rise, sx: c.sx, sy: c.sy, hot: c.hot, glowK: c.glowK, eyeK: c.eyeK, cageOpen: c.cageOpen, rattle: c.rattle, capLift: c.capLift, spark: c.spark,
      tongueL: c.tongue * gutL, tongueR: c.tongue * gutR, flameLean: m.dirX * 30, lookX: m.dirX, lookY: m.dirY * 0.7, shakeX: (Math.sin(t * 71) * 0.55 + Math.sin(t * 113) * 0.35) * c.rattle });
    open = 1;
  } else if (st === 'lunge') {
    // the dive, keyed to the 0.55 s lunge: tipped over cap-first along its line, stretched, flames red and streaming back through the bars, the lid flapping
    const k = clamp(e.t / LUNGE_T, 0, 1), sk = clamp(speed / LUNGE, 0, 1.2);
    Object.assign(T, { hover: 0, lean: diveLean(vx, vy, P.lean), stretch: 1 + sk * 0.38, hot: 0.6, rage: 1 - k * 0.3, glowK: 0.9 + sk * 0.2, eyeK: 1.15, cageOpen: 0.45, rattle: 0.3,
      capLift: 0.8 + Math.abs(Math.sin(t * 38)) * 0.35 * sk, capTilt: -12 * (Math.sign(vx) || 1), tongueL: 1.35 * gutL, tongueR: 1.25 * gutR, spark: 1, lookX: speed > 1 ? vx / speed : 0, lookY: speed > 1 ? vy / speed : 0, sx: 0.98, sy: 1.04 });
    open = Math.min(open, 0.72);
    m.ghostT += dt; if (sk > 0.35 && m.ghostT > 0.03) { m.ghostT = 0; pup.ghost(e.x + e.w / 2, e.y + e.h / 2, 0.26, 0.4); }
  } else if (m.endT < 0.8) {
    // the recovery after a lunge: it pants, the glow pulsing and the flames shivering while the rage drains
    const r = 1 - m.endT / 0.8; T.glowK += r * (0.25 + Math.sin(m.endT * 28) * 0.2); T.tongueL *= 1 + r * 0.5; T.tongueR *= 1 + r * 0.45; T.hot = 0.3 * r; T.spark += r * 0.4; T.eyeK += r * 0.1;
  }
  if (dazed) {
    // snuffed: a full roll the way it was shoved, flames down to a slit and the halo gone until they catch again; the eyes swim
    T.spin = Anim.keys(m.hitT / 0.55, [[0, { s: 0 }], [0.85, { s: 360 * m.kdir }, 'outCubic'], [1, { s: 360 * m.kdir }]]).s;
    if (dark) { const d = m.hitT / 0.42; open = Math.min(open, 0.25); Object.assign(T, { tongueL: 0.12 * gutL, tongueR: 0.15 * gutR, hot: 0, rage: 0, glowK: 0.04, eyeK: 0.75, cageOpen: -0.5, spark: 0.5 * (1 - d), lookX: Math.sin(m.hitT * 26) * 0.9, lookY: Math.cos(m.hitT * 26) * 0.6, rattle: 0.5 }); }
  }
  T.eyeOpen = open;
  m.ph += (T.rattle > 0.01 ? 48 : 0) * dt; T.ph = m.ph;
  m.sparkPh = (m.sparkPh + dt * (0.8 + T.hot * 1.4 + T.spark * 0.6)) % 1; T.sparkPh = m.sparkPh; T.spark = clamp(T.spark + m.burst, 0, 1.2);
  pup.target(T);
  // ---- secondary motion: the smoke wisp hangs from the cage's base wherever the body has swung, streams behind its motion and whips when it rolls
  const [ax, ay] = bodyPoint(P, WX, WY); wisp.ax = ax; wisp.ay = ay;
  wisp.update(dt, { vx: vx / SCALE * 0.45, vy: vy / SCALE * 0.45, facing: 1, gravity: 34, drag: 0.5, stiff: dazed ? 3 : 7, damp: 0.86, wind: { x: Math.sin(t * 2.4) * 4 + (dazed ? Math.sin(m.hitT * 40) * 40 : 0), y: Math.cos(t * 1.9) * 2 } });
}

// world-space effects under the body: the motion blur (dark discs of the body behind it along its line, and the flames' light smeared
// after them in a dive) and the lantern's light on the world when it burns high
function before(ctx, e, pup) {
  const P = pup.P, s = pup.scale || SCALE; const cx = e.x + e.w / 2 + (P.bobX + P.shakeX) * s, cy = e.y + e.h / 2 + P.bobY * s;
  const sp = Math.hypot(e.vx, e.vy), k = clamp(sp / LUNGE, 0, 1);
  if (k > 0.06) {
    const ux = e.vx / sp, uy = e.vy / sp, len = 1.5 + 3 * k;
    for (let i = 1; i <= 4; i++) { ctx.fillStyle = `rgba(62,38,38,${((0.3 - i * 0.06) * (0.3 + 0.7 * k)).toFixed(3)})`; ctx.beginPath(); ctx.arc(cx - ux * i * len, cy - uy * i * len, 6 - i * 0.9, 0, TAU); ctx.fill(); }
    const lit = clamp(P.glowK, 0, 1.5) * clamp((k - 0.3) / 0.5, 0, 1);
    if (lit > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(255,179,71,${((0.2 - i * 0.05) * lit).toFixed(3)})`; ctx.beginPath(); ctx.arc(cx - ux * i * len * 1.4, cy - uy * i * len * 1.4, 4 - i * 0.7, 0, TAU); ctx.fill(); } ctx.restore(); }
  }
  const gk = clamp(P.glowK - 0.3, 0, 1.2);
  if (gk > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = (9 + 9 * gk) * s; const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(255,220,130,${(0.2 * gk).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,220,130,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.restore(); }
}

module.exports = { name: 'snuffer', w: W, h: H, anchor: 'center', params, springs, poses, make, control, before, flip: () => false };
