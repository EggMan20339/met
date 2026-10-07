// Rootram: a beast grown of roots with a bark head-plate and wooden horns. It patrols on a four-leg trot whose rate
// comes from its speed, and when Mote is in range it stops, lowers its head, aims its horns, coils its weight back
// over its haunches and paws the ground (src/entities.js case 'c': 'tele' for 0.5 s), then launches into a bounding
// gallop at charge speed ('charge', 1.3 s) with its body stretched and dust flying off its hooves. Hitting a wall or
// running out of ledge drops it into 'stun' for 0.9 s: it squashes against the wall, its horns wobble, its eyes
// cross and little motes circle its head, then it shakes it off and turns. A hit rocks it on its springs. Everything
// is keyed to the entity's own timers (e.t) so the launch and the bonk land on the game's frames. See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, tr, curve, mix, clamp, lerp, num: n } = L;
const W = 34, H = 24, PX = 17.5, PY = 23.5; // template box; the body pivots (lean, squash, stretch) about the ground centre
const SCALE = 0.72; // world units per template unit (ART_SCALE.rootram): for the gait rate and the world-space dust
const SPEED = 38, CHARGE = 275; // ENEMY_DEFS.c.speed / chargeSpeed
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const LINE = '#1c110a', LEG = '#2a1a12', LEG_FAR = '#1e120c', ROOT = '#8a5a34', HORN = '#e0c8a0', PLATE = '#8a5a34', PLATE_HOT = '#a06a3a', EYE = '#ff6a4a', EYE_HOT = '#ff3a2a', EYE_DAZED = '#ffd0a0', DUST = '#c8b090';
const BODY_G = lin('rb', 6, 4, 26, 22, [[0, '#6a4a30'], [0.5, '#4a2f1e'], [1, '#2a1a12']]);
const BODY_D = 'M4 18 C3 8 10 5 18 5 L24 5 C29 5 31 9 31 14 L31 18 Z';
// four legs: [hip x, foot rest x, hock direction (- bends back, + forward), far side]; hind far, hind near, fore far, fore near
const LEGS = [[8, 7, -1, true], [13, 12, -1, false], [18, 19, 1, true], [23, 24, 1, false]];
const TROT = [Math.PI, 0, 0, Math.PI]; // diagonal pairs move together
const GALLOP = [0, 0.5, Math.PI + 0.1, Math.PI + 0.6]; // the hinds push off together, the fores land together half a cycle later
const HPX = 23, HPY = 17.5; // the head pivots about the back-bottom corner of its plate
const TAIL1 = [{ x: -2.2, y: 1.4 }, { x: -4.2, y: 3.4 }, { x: -5.4, y: 6 }], TAIL2 = [{ x: -2, y: 1.6 }, { x: -3.4, y: 4.2 }]; // loose root ends on the rump
const REST1 = [{ x: 4.6, y: 11.5 }].concat(TAIL1.map((p) => ({ x: 4.6 + p.x, y: 11.5 + p.y }))), REST2 = [{ x: 5.6, y: 15 }].concat(TAIL2.map((p) => ({ x: 5.6 + p.x, y: 15 + p.y })));

const params = {
  legPhase: 0, stride: 0, gallop: 0,          // gait phase (radians), stride amplitude 0..1, trot -> gallop blend 0..1
  gLift: 0, gLean: 0, gStretch: 0, gHead: 0,  // gait-cycle body lift, pitch (deg), stretch (+ long and low), head bob: written directly, no spring
  lean: 0, sx: 1, sy: 1, bob: 0, shift: 0,    // body pitch (deg, + nose down), squash/stretch about the ground centre, lift, fore/aft shift (- coiled back over the haunches)
  splay: 0,                                   // legs braced wide 0..1 (stun, a hit)
  headPitch: 0, headDrop: 0, headOut: 0,      // head lowered (deg, + horns down and forward), pushed down, pushed forward (template units)
  hornA: 0, hornB: 0,                         // upper / lower horn swing about their roots (deg)
  eyeOpen: 1, eyeK: 1, look: 0, hot: 0, daze: 0, // lid, halo size, glint slide (+ forward), eye and plate heat 0..1 (tele/charge), crossed eyes 0..1 (stun)
  shake: 0, ph: 0,                            // telegraph quiver amplitude and a free clock (also drives streaks, dust and the stun motes)
  paw: 0, pawPh: 0,                           // the fore hoof pawing the ground: amplitude 0..1 and its own phase
  rush: 0, dust: 0, stars: 0, snort: 0, rootFlex: 0, // speed streaks, hoof dust, stun motes, a snort from the nose (1 fresh .. 0 gone), the body roots' breathing
};
// [stiffness, damping ratio] for the values that overshoot and settle; the gait values, clocks and effect amounts snap
const springs = {
  stride: [140, 0.75], gallop: [70, 1], lean: [240, 0.5], sx: [380, 0.45], sy: [380, 0.45], bob: [300, 0.5], shift: [200, 0.5], splay: [260, 0.6],
  headPitch: [260, 0.42], headDrop: [300, 0.5], headOut: [220, 0.55], hornA: [520, 0.16], hornB: [460, 0.18],
  eyeOpen: [700, 0.9], eyeK: [90, 1], look: [160, 0.8], hot: [110, 1], daze: [110, 1], rush: [120, 1], dust: [120, 1], stars: [90, 1],
};
// stills exported to art/rootram_<pose>.svg (a, b and charge are the originals; the rest are new readable poses)
const poses = {
  a: { stride: 1, legPhase: 0, gLift: 0.4 }, b: { stride: 1, legPhase: Math.PI, gLift: 0.4 },
  charge: { stride: 1, gallop: 1, legPhase: 1.2, sx: 1.08, sy: 0.94, lean: 4, shift: -2, headPitch: 16, headDrop: 0.8, headOut: 0.5, hot: 1, eyeK: 1.5, look: 1, rush: 1, dust: 1, ph: 0.3 },
  idle: {},
  tele: { shift: -2.6, sx: 0.9, sy: 1.06, lean: 3, headPitch: 26, headDrop: 1.4, headOut: -1, hornA: -8, hornB: -4, hot: 0.8, eyeK: 1.6, look: 1, paw: 1, pawPh: 2.4, snort: 0.6 },
  stun: { lean: -5, bob: -0.8, sx: 1.06, sy: 0.94, headPitch: -6, headDrop: 0.6, hornA: 24, hornB: -16, daze: 1, splay: 0.6, stars: 1, ph: 0.4 },
  hurt: { lean: -9, sx: 1.1, sy: 0.9, shift: -1, headPitch: -18, hornA: 14, hornB: -10, eyeOpen: 0.25, splay: 0.5 },
};

function make(P, pup) {
  const lift = P.bob + P.gLift, lean = P.lean + P.gLean, sx = P.sx * (1 + P.gStretch), sy = P.sy * (1 - P.gStretch * 0.45);
  const c = Math.cos(lean * DEG), s = Math.sin(lean * DEG);
  const bx = PX + P.shift + P.shake * Math.sin(P.ph * 67), by = PY + P.shake * 0.4 * Math.cos(P.ph * 47); // where the body pivot is (the quiver shakes it)
  // where a point of the body ends up after the body's own transform, so the hips stay attached while the feet stay on the ground
  const hipX = (x, y) => bx + (x - PX) * sx * c - (y - PY - lift) * sy * s, hipY = (x, y) => by + (x - PX) * sx * s + (y - PY - lift) * sy * c;
  // legs: hip (under the body) -> hock -> hoof; the hoof swings on the gait cycle and lifts on its forward swing; the fore hoof paws
  const reach = (2.8 + P.gallop * 1.8) * P.stride, hop = (2.2 + P.gallop * 1.6) * P.stride;
  const legs = LEGS.map(([hx0, fx0, kd, far], i) => {
    const p = P.legPhase + lerp(TROT[i], GALLOP[i], P.gallop); const sn = Math.sin(p);
    const hx = hipX(hx0, 18), hy = hipY(hx0, 18); const pawing = i === 3 ? P.paw : 0;
    let fl = Math.max(0, -sn) * hop + Math.max(0, -Math.sin(P.pawPh)) * 1.8 * pawing;
    const fx = fx0 + Math.cos(p) * reach + P.shift * 0.3 + P.splay * (kd * 2.4) + Math.cos(P.pawPh) * 2.6 * pawing, fy = PY - fl - P.splay * 0.4;
    const kx = (hx + fx) / 2 + kd * (1.2 + fl * 0.6 + P.splay * 1.2), ky = (hy + fy) / 2 - 0.4;
    return stroke(`M${n(hx)} ${n(hy)} L${n(kx)} ${n(ky)} L${n(fx)} ${n(fy)}`, far ? LEG_FAR : LEG, 2.4);
  });
  const shadow = ell(bx, PY, 13 - lift * 0.6, 1.2, '#000000', { opacity: clamp(0.2 - lift * 0.02, 0.08, 0.2) });
  // the rump's loose root ends: verlet chains when animated, their rest curves for the stills
  const t1 = pup && pup.chains.tail1 ? pup.chains.tail1.points() : REST1, t2 = pup && pup.chains.tail2 ? pup.chains.tail2.points() : REST2;
  const tails = [stroke(curve(t1), ROOT, 1.3), stroke(curve(t2), '#6e4628', 1.1)];
  // the body: a loaf of bark with root ridges that breathe
  const f = P.rootFlex;
  const roots = [stroke(`M8 17 C6 15 5 12 ${n(7 + f)} 9`, ROOT, 1), stroke(`M14 18 C13 14 ${n(15 + f)} 11 14 7`, ROOT, 1), stroke(`M20 18 C21 14 ${n(19 - f)} 10 21 6`, ROOT, 1)];
  const rim = stroke('M6 10 C8.5 6.6 12.5 5.6 17.5 5.5', '#8a6a48', 0.9, { opacity: 0.45 });
  // the head: bark plate, grain, two wooden horns on their own springs, one glowing eye (two crossed ones when dazed), a snort
  const hq = Math.round(clamp(P.hot, 0, 1) * 20) / 20, plateCol = hq ? mix(PLATE, PLATE_HOT, hq) : PLATE, eyeCol = P.daze > 0.3 ? EYE_DAZED : hq ? mix(EYE, EYE_HOT, hq) : EYE;
  const open = clamp(P.eyeOpen, 0, 1), ek = 1.8 * P.eyeK + hq * 0.8;
  const eyes = P.daze > 0.3 ? [ // crossed: two eyes, each glint slid toward the nose bridge, wobbling with the daze
    circ(27.9 + Math.sin(P.ph * 9) * 0.3, 13.4, 1, eyeCol), circ(28.35, 13.2, 0.42, '#ffffff', { opacity: 0.85 }),
    circ(30.3 + Math.cos(P.ph * 11) * 0.3, 12.7, 1, eyeCol), circ(29.85, 12.5, 0.42, '#ffffff', { opacity: 0.85 }),
  ] : [
    circ(29, 13, 1.2 * ek, eyeCol, { opacity: 0.25 }),
    open < 0.15 ? stroke('M27.9 13.1 L30.1 12.8', eyeCol, 0.8) : [ell(29, 13, 1.2, 1.2 * open, eyeCol), open > 0.45 ? circ(29 + P.look * 0.4, 13 - 0.3 * open, 0.54, '#ffffff', { opacity: 0.8 }) : null],
  ];
  const glowOp = hq > 0.1 ? circ(29, 13, 4.5 + hq * 4, rad('rg', 29, 13, 4.5 + hq * 4, [[0, EYE_HOT, 0.32 * hq], [1, EYE_HOT, 0]])) : null;
  const sn = clamp(P.snort, 0, 1), e1 = 1 - sn;
  const snort = sn > 0.03 ? [circ(35.5 + e1 * 3, 15.5 - e1 * 1.5, 1 + e1 * 2.2, DUST, { opacity: sn * 0.5 }), circ(34.5 + e1 * 4.5, 17 + e1 * 0.5, 0.7 + e1 * 1.5, DUST, { opacity: sn * 0.4 })] : null;
  const head = g([
    glowOp,
    path('M22 6 L32 9 L33 18 L23 18 Z', plateCol, { stroke: '#3a2416', strokeWidth: 0.9 }),
    stroke('M25 8 L31 11', '#c48a5a', 0.6, { opacity: 0.6 }), stroke('M25 14 L31 15.5', '#c48a5a', 0.6, { opacity: 0.6 }),
    stroke('M30 7 C34 3 36 8 33 10', HORN, 2.2, { transform: rot(P.hornA, 30, 7) }),
    stroke('M30 12 C34 11 35 14 32 15', HORN, 1.8, { transform: rot(P.hornB, 30, 12) }),
    eyes, snort,
  ], { transform: `${tr(P.headOut, P.headDrop)} ${rot(P.headPitch, HPX, HPY)}` });
  const body = g([tails, path(BODY_D, BODY_G, { stroke: LINE, strokeWidth: 1 }), roots, rim, head], { transform: `${tr(bx, by)} ${rot(lean)} scale(${n(sx)} ${n(sy)}) ${tr(-PX, -PY - lift)}` });
  // speed streaks behind the body and dust off the hind hooves while it charges; motes circling the head while it is dazed
  const ru = clamp(P.rush, 0, 1), k0 = (P.ph * 40) % 6;
  const rush = ru > 0.03 ? stroke(`M${n(bx - 13)} ${n(13 - lift)} L${n(bx - 19 - k0)} ${n(12.4 - lift)} M${n(bx - 14)} ${n(16.5 - lift)} L${n(bx - 22 - ((k0 + 2.5) % 6))} ${n(17 - lift)} M${n(bx - 13.5)} ${n(20 - lift)} L${n(bx - 18 - ((k0 + 4) % 6))} ${n(20.6 - lift)}`, '#ffffff', 0.9, { opacity: 0.4 * ru }) : null;
  const du = clamp(P.dust, 0, 1), dk = (P.ph * 7) % 1;
  const dust = du > 0.03 ? [circ(bx - 11 - dk * 6, PY - 1 - dk * 3, 1.6 + dk * 2.4, DUST, { opacity: du * 0.4 * (1 - dk) }), circ(bx - 8 - ((dk + 0.5) % 1) * 7, PY - 0.5 - ((dk + 0.5) % 1) * 2.5, 1.2 + ((dk + 0.5) % 1) * 2, DUST, { opacity: du * 0.35 * (1 - ((dk + 0.5) % 1)) })] : null;
  const stk = clamp(P.stars, 0, 1);
  const stars = stk > 0.03 ? [0, 1, 2].map((i) => { const a = P.ph * 6 + i * 2.1; return circ(bx + 9 + Math.cos(a) * 5, 4.5 + Math.sin(a) * 1.5 - lift, 0.7 + (Math.sin(a) + 1) * 0.15, '#ffe0b0', { opacity: stk * (0.55 + Math.sin(a) * 0.3) }); }) : null;
  return svg(W, H, [shadow, rush, dust, legs, body, stars]);
}

// ---- animation: from the enemy's state (idle / tele / charge / stun, see updateEnemy case 'c') to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.state = e.state; m.hp = e.hp; m.flash = e.flash || 0; m.facing = e.facing; m.vx = e.vx; m.ax = 0; m.t0 = Math.random() * 10; m.phase = Math.random() * TAU;
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.glance = 2 + Math.random() * 3; m.lookTo = 0.3; m.fidget = 2 + Math.random() * 4;
    m.hitT = 9; m.kn = -1; m.snortT = 9; m.snortK = 0; m.pawPh = 0; m.pawDown = false; m.puffT = 0; m.launchT = 9; m.endT = 9;
    m.puffs = []; for (let i = 0; i < 14; i++) m.puffs.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 1 });
  }
  const s = pup.scale || SCALE, t = pup.time + m.t0, vx = e.vx, st = e.state, fac = e.facing;
  const tail1 = pup.chain('tail1', 4.6, 11.5, TAIL1), tail2 = pup.chain('tail2', 5.6, 15, TAIL2);
  // ---- events, found by watching the state change: the alert, the launch, the bonk, the end of a charge, a turn, a hit
  const alert = st === 'tele' && m.state !== 'tele', launch = st === 'charge' && m.state !== 'charge', bonk = st === 'stun' && m.state !== 'stun', ended = m.state === 'charge' && st === 'idle';
  const turned = fac !== m.facing, hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0);
  const ax = dt > 0 ? (vx - m.vx) / dt / s : 0; m.ax = lerp(m.ax, Math.abs(ax) > 2000 ? 0 : ax, Math.min(1, dt * 10)); // smoothed acceleration in template units/s^2 (the charge launch is an impulse instead)
  m.state = st; m.hp = e.hp; m.flash = e.flash || 0; m.facing = fac; m.vx = vx;
  const puff = (x, y, r, pvx, pvy, life) => { let q = m.puffs[0]; for (const p of m.puffs) if (p.life < q.life) q = p; q.x = x; q.y = y; q.r = r; q.vx = pvx; q.vy = pvy; q.life = q.max = life; };
  const cx = e.x + e.w / 2, feet = e.y + e.h;
  if (alert) { pup.impulse('bob', 14).impulse('sy', 2.5).impulse('headPitch', -260).impulse('hornA', -500).impulse('hornB', 300).impulse('eyeK', 6); m.snortT = 0; m.snortK = 1; m.pawPh = 0; m.pawDown = false; }
  if (launch) { // the release: the body snaps long and low, the horns whip, dust kicks off the hind hooves
    m.launchT = 0; pup.impulse('shift', 70).impulse('sx', 5).impulse('sy', -3).impulse('lean', 120).impulse('headOut', 40).impulse('hornA', 600).impulse('hornB', 400).impulse('bob', 6);
    for (let i = 0; i < 4; i++) puff(cx - fac * (6 + i * 3) * s, feet - 1, (2 + i) * s, -fac * (20 + i * 15), -14 - i * 8, 0.45 + i * 0.06);
  }
  if (bonk) { // the wall: a squash from the front, the rump comes up, the head snaps back and the horns clatter
    pup.impulse('sx', -9).impulse('sy', 5).impulse('lean', -520).impulse('shift', 30).impulse('headPitch', -900).impulse('headDrop', -20).impulse('hornA', 1400).impulse('hornB', -1100).impulse('splay', 9).impulse('bob', 20);
    m.blinkT = 0.18; m.snortT = 0; m.snortK = 0.5;
    for (let i = 0; i < 5; i++) puff(cx + fac * (8 + i * 2) * s, feet - 2 - i * 3 * s, (1.6 + i * 0.6) * s, -fac * (6 + i * 10), -10 - i * 12, 0.4 + i * 0.05);
  }
  if (ended) { m.endT = 0; pup.impulse('lean', -200).impulse('sx', 2).impulse('headPitch', -200).impulse('hornA', 500).impulse('hornB', -400); for (let i = 0; i < 3; i++) puff(cx + fac * (4 + i * 3) * s, feet - 1, (2 + i * 0.5) * s, fac * (10 + i * 8), -10, 0.4); }
  if (hit) { // which way it is being shoved, relative to the way it faces: -1 backwards (from the front), +1 forwards (from behind)
    m.hitT = 0; m.kn = (Math.sign(vx) || -1) * fac; m.blinkT = 0.16;
    pup.impulse('lean', 300 * m.kn).impulse('sx', 3.5).impulse('sy', -3.5).impulse('shift', 25 * m.kn).impulse('headPitch', 600 * m.kn).impulse('hornA', -800 * m.kn).impulse('hornB', 600 * m.kn).impulse('splay', 7);
  }
  if (turned && st !== 'stun') { pup.impulse('sx', -3).impulse('sy', 2).impulse('bob', 10).impulse('headPitch', -160).impulse('hornA', 450).impulse('hornB', -350).impulse('shift', -15); if (m.state === 'idle' && m.hitT > 1) { m.snortT = 0; m.snortK = 0.45; } }
  m.hitT += dt; m.snortT += dt; m.launchT += dt; m.endT += dt;
  // ---- legs: the cycle advances with distance covered (hooves stay planted); the trot lengthens into a gallop at charge speed
  const sp = Math.abs(vx) / s, stunned = st === 'stun', shoved = m.hitT < 0.3;
  const moving = sp > 6 && !stunned && !shoved && st !== 'tele', fwd = (Math.sign(vx) || 1) * fac;
  const gal = pup.P.gallop, cycle = 14 + gal * 30; const rate = Math.min(sp / cycle, 5.5);
  if (moving) m.phase += fwd * rate * TAU * dt; if (m.phase > TAU) m.phase -= TAU; if (m.phase < 0) m.phase += TAU;
  const ph = m.phase, gait = pup.P.stride;
  // ---- idle life: blinks, glances, fidgets (a horn toss, a sniff, a glance back, a snort), the roots' slow breathing
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.3 : 2 + Math.random() * 4; m.blinkT = 0.13; }
  let eyeOpen = 1; if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = clamp(m.blinkT > 0.065 ? 1 - (0.13 - m.blinkT) / 0.065 : m.blinkT / 0.065, 0, 1); }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.5 + Math.random() * 3; m.lookTo = Math.random() < 0.6 ? 0.5 : -0.5 + Math.random() * 0.8; }
  m.fidget -= dt; if (m.fidget < 0 && st === 'idle' && !shoved) {
    m.fidget = 2.5 + Math.random() * 4; const r = Math.random();
    if (r < 0.35) pup.impulse('hornA', 700).impulse('hornB', -400).impulse('headPitch', -140);
    else if (r < 0.65) pup.impulse('headPitch', 220).impulse('headDrop', 14);
    else if (r < 0.85) { m.snortT = 0; m.snortK = 0.5; pup.impulse('headPitch', -120).impulse('sy', 1.5); }
    else { m.lookTo = -0.6; m.glance = 1; pup.impulse('headPitch', -200).impulse('hornA', 300); }
  }
  const br = Math.sin(t * 1.9);
  const T = {
    legPhase: ph, stride: moving ? 1 : 0, gallop: st === 'charge' ? 1 : 0, gLift: 0, gLean: 0, gStretch: 0, gHead: 0,
    lean: 0, sx: 1 + br * 0.012, sy: 1 + br * 0.022, bob: 0, shift: 0, splay: 0,
    headPitch: Math.sin(t * 1.3) * 2.5 + br * 1.5, headDrop: 0, headOut: Math.sin(t * 1.3 + 0.8) * 0.4, hornA: Math.sin(t * 2.3) * 2, hornB: Math.sin(t * 2.1 + 1) * 1.5,
    eyeK: 1 + Math.sin(t * 2.7) * 0.15, look: m.lookTo, hot: 0, daze: 0, shake: 0, ph: t, paw: 0, pawPh: m.pawPh, rush: 0, dust: 0, stars: 0,
    snort: m.snortK * Math.max(0, 1 - m.snortT / 0.4), rootFlex: br * 0.5,
  };
  if (st === 'tele') {
    // the wind-up, keyed to the game's 0.5 s timer so the launch lands on the frame the charge starts: the head drops and the horns
    // level at Mote, the weight coils back over the haunches, the fore hoof paws the ground twice, the eye heats and a quiver builds
    const k = clamp(e.t / 0.5, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { shift: 0, sx: 1, sy: 1, lean: 0, headPitch: -4, headDrop: 0, headOut: 0.5, hornA: 0, hornB: 0, hot: 0.2, eyeK: 1.3 }],
      [0.3, { shift: -1.6, sx: 0.95, sy: 1.03, lean: 2, headPitch: 24, headDrop: 1.2, headOut: -0.6, hornA: -7, hornB: -4, hot: 0.55, eyeK: 1.5 }, 'outBack'],
      [0.85, { shift: -2.8, sx: 0.9, sy: 1.06, lean: 3, headPitch: 27, headDrop: 1.5, headOut: -1.2, hornA: -9, hornB: -5, hot: 0.85, eyeK: 1.7 }, 'inOutQuad'],
      [1, { shift: -3.6, sx: 0.86, sy: 1.09, lean: 4, headPitch: 29, headDrop: 1.7, headOut: -1.6, hornA: -10, hornB: -6, hot: 1, eyeK: 1.9 }, 'inQuad'],
    ]));
    T.shake = 0.35 + k * 0.75; T.look = 1; T.stride = 0; T.paw = Anim.smooth(k, 0.1, 0.3) * (1 - Anim.smooth(k, 0.9, 1));
    m.pawPh = Anim.smooth(k, 0.12, 0.95) * TAU * 2 + 0.8; T.pawPh = m.pawPh; // two scrapes
    const down = Math.sin(m.pawPh) > 0.2; if (down && !m.pawDown && k > 0.15) puff(cx + fac * 7 * s, feet - 1, 1.6 * s, -fac * 18, -16, 0.35); m.pawDown = down;
  } else if (st === 'charge') {
    // the gallop: long and low, horns leading, body stretching in flight and gathering under it on the landing; streaks and hoof dust
    const lo = Anim.smooth(m.launchT, 0, 0.2);
    Object.assign(T, { lean: 4 + (1 - lo) * 2, sx: 1.1, sy: 0.94, shift: 1, headPitch: 17 + (1 - lo) * 8, headDrop: 0.8, headOut: 1.6, hornA: -4, hornB: -2, hot: 1, eyeK: 1.6 + Math.sin(t * 9) * 0.2, look: 1, rush: 1, dust: 1, stride: 1 });
    T.gLift = Math.max(0, Math.sin(ph + 0.6)) * 1.9 * gal * gait; T.gStretch = Math.sin(ph + 0.6) * 0.07 * gal * gait; T.gLean = -Math.sin(ph + 1.3) * 3.5 * gal * gait; T.gHead = -Math.sin(ph + 0.2) * 0.9 * gal * gait;
    T.shake = 0.25 * lo; T.ph = t;
    m.puffT += dt; if (m.puffT > 0.055) { m.puffT = 0; puff(cx - fac * 9 * s, feet - 1, (1.4 + Math.random() * 1.2) * s, -fac * (10 + Math.random() * 20), -12 - Math.random() * 16, 0.3 + Math.random() * 0.15); }
  } else if (stunned) {
    // the daze, keyed to the game's 0.9 s timer: squashed against the wall, then rocking on braced legs with crossed eyes and motes
    // circling, the head sagging lower, then a shake of the head as it comes round, just before the game turns it
    const k = clamp(e.t / 0.9, 0, 1), w = Math.sin(t * 9) * (1 - k) * k * 7;
    Object.assign(T, Anim.keys(k, [
      [0, { lean: -14, bob: 1, sx: 0.84, sy: 1.12, shift: 1.5, headPitch: -28, headDrop: -0.5, headOut: -1, splay: 0.3, daze: 0, stars: 0, hot: 0.6 }],
      [0.15, { lean: -4, bob: -0.6, sx: 1.06, sy: 0.94, shift: 0, headPitch: -8, headDrop: 0.4, headOut: 0, splay: 0.6, daze: 1, stars: 1, hot: 0 }, 'outQuad'],
      [0.7, { lean: -2, bob: -1.2, sx: 1.04, sy: 0.95, shift: -0.5, headPitch: 6, headDrop: 1, headOut: -0.4, splay: 0.6, daze: 1, stars: 1, hot: 0 }, 'inOutQuad'],
      [0.88, { lean: 0, bob: -0.3, sx: 1, sy: 1, shift: 0, headPitch: 14, headDrop: 1.2, headOut: 0.2, splay: 0.3, daze: 0.6, stars: 0.4, hot: 0 }, 'inQuad'],
      [1, { lean: 1, bob: 0.4, sx: 1, sy: 1, shift: 0, headPitch: -6, headDrop: 0, headOut: 0.4, splay: 0, daze: 0, stars: 0, hot: 0 }, 'outBack'],
    ]));
    T.lean += w * 0.8; T.shift += w * 0.3; T.headPitch += w * 2.2; T.hornA = w * 2.5; T.hornB = -w * 2; T.eyeK = 0.8; T.look = 0; T.stride = 0;
    if (k > 0.78 && k < 0.9) { T.headPitch += Math.sin(t * 40) * 6; T.hornA += Math.sin(t * 40) * 8; T.hornB -= Math.sin(t * 40) * 6; } // the shake-off
    eyeOpen = k < 0.12 ? 0.1 : eyeOpen;
  } else if (moving) {
    // the trot: diagonal pairs, the body rising twice a cycle as each pair passes under it, the nose leading; the head bobs a beat behind
    const g2 = gait * (1 - gal), s2 = Math.cos(2 * ph);
    T.gLift = (0.5 - 0.5 * s2) * 1.1 * g2; T.gLean = -Math.sin(2 * ph + 0.5) * 2.2 * fwd * g2; T.gHead = -Math.sin(2 * ph - 0.7) * 0.9 * g2;
    T.lean = 1.5 * fwd; T.headOut = 0.8 * fwd + T.headOut; T.hornA = T.hornA - 2 * fwd; T.hornB = T.hornB - 1.5 * fwd;
    if (m.endT < 0.9) { // skidding out of a charge: forelegs braced, leaning back, the heat draining from the eye
      const k = m.endT / 0.9; T.lean += -7 * (1 - k); T.splay = 0.5 * (1 - k); T.headPitch += -10 * (1 - k); T.hot = 0.8 * (1 - k); T.dust = 0.6 * (1 - k); T.rush = 0; T.eyeK = 1.3; T.look = 1; T.stride = 0.3 + 0.7 * k;
    }
  } else if (shoved) { T.splay = 0.6; T.stride = 0; }
  if (m.hitT < 0.5 && !stunned) { const k = m.hitT / 0.5; T.hot = Math.max(T.hot, 0.5 * (1 - k)); T.eyeK = Math.max(T.eyeK, 1.6 - k * 0.6); T.look = m.kn * -0.7 * (1 - k) + T.look * k; }
  // weight: lean into acceleration and back on braking (the charge launch and the bonk are impulses, so the filter ignores jolts)
  T.lean += clamp(m.ax * fwd / 420, -1, 1) * 5;
  T.eyeOpen = eyeOpen;
  pup.target(T);
  // ---- secondary motion: the root ends stream behind the body in the charge, swing on stops and settle to a hang
  const vxs = vx / s * 0.7; const env = { vx: vxs, vy: 0, facing: fac, gravity: 40, drag: 0.5, stiff: st === 'idle' && !moving ? 7 : 4, damp: 0.86, wind: { x: Math.sin(t * 2.1) * 4 * (moving ? 0 : 1) - (pup.V.shift || 0) * 2, y: Math.cos(t * 1.7) * 3 } };
  tail1.update(dt, env); tail2.update(dt, env);
  for (const p of m.puffs) if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, dt * 3); p.vy -= dt * 6; }
}

// world-space dust under the body: puffs left on the ground where the hooves were (they stay behind while the beast moves on)
function before(ctx, e, pup) {
  const ps = pup.mem.puffs; if (!ps) return;
  let any = false; for (const p of ps) if (p.life > 0) { any = true; break; } if (!any) return;
  ctx.save();
  for (const p of ps) { if (p.life <= 0) continue; const k = p.life / p.max; ctx.globalAlpha = 0.42 * k; ctx.fillStyle = DUST; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.3 - k * 0.6) + (1 - k) * 2.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

module.exports = { name: 'rootram', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, before };
