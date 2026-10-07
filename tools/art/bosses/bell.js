// The Drowned Bell: a jelly shaped like the warning bell it swallowed, ringing itself.
//
// The body is a glass bell pivoting at its rim centre (28, 40): it breathes like a jelly (a slow pulse of sx/sy and
// the rim), sways on a figure of eight and leans into its drift after Mote, with a clapper that hangs under the core
// on a barely damped spring and swings whenever the body moves. Seven tentacles are verlet chains anchored to the rim
// (the anchors follow the body's transform every frame), so they stream behind the motion, curl up when the bell
// gathers itself, splay out on the slam and lie on the floor while it is stunned. Everything is keyed to the entity's
// own state and e.t (src/entities.js updateBell) so the hit frames line up with the game:
//   toll_tele (0.7 s): the dome compresses, the core brightens, the clapper is drawn back, a tremble builds;
//   toll: the body snaps back and overshoots, the clapper swings, the bell vibrates (shake + rim ripple) and sound
//         rings spread as the ring projectile is spawned; slam_tele: it rises, stretches, opens its mouth and a target
//         glows on the floor; slam: it stretches with its fall and leaves a trail; the impact squashes it flat, it
//         topples, the core goes dark and the drowned faces surface, the tentacles are flung out and settle flat;
//   stunned: deflated, tilted, dim, bubbles; it gathers itself in the last 0.4 s; rise: a snap upright with overshoot;
//   rain_tele: it lifts, brightens and flickers, drips form under the rim and the tentacles float up; rain: the drops
//   let go; summon (phase 2): the mouth yawns open and the faces drift toward the rim, a puff on the summon frame.
// Phase 2 (b.phase === 2): hot pink haunted faces with halos, faster pulsing everywhere. A hit flinches the body and
// kicks the clapper; death is a long deflation with a flickering core while the drowned float up out of the glass.
// See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, tr, curve, mix, clamp, lerp, num: n } = L;
const W = 56, H = 64, CX = 28, CY = 32, RIM = 40; // centre anchor; the body pivots at the rim centre
const SCALE = 0.75; // world units per template unit (ART_SCALE.bell), for feeding world velocities to the chains and placing world-space effects
const TAU = Math.PI * 2;
// updateBell timings (src/entities.js): the toll fires when toll_tele passes 0.7 s (x0.75 in phase 2), the dive after 0.55 s of slam_tele,
// the stun lasts 1.5 s (1.1 in phase 2), the rain is marked for 0.8 s, the summon happens 0.4 s into its 0.9 s, the intro descends for 1.8 s
const TOLL_TELE = 0.7, TOLL = 0.9, SLAM_TELE = 0.55, RAIN_TELE = 0.8, RAIN = 1.0, SUMMON = 0.9, SUMMON_AT = 0.4, INTRO = 1.8, DEATH = 2.5;
const PINK = '#ff8ab0', DROWN = '#20406a', GLASS = '#8ce0ff', LIGHT = '#dff6ff';
const BODY_G = lin('bbo', 8, 6, 48, 40, [[0, '#c8ecff', 0.92], [0.5, '#5aa0e0', 0.82], [1, '#2a4a9a', 0.9]]);
const FACES = [[19, 18, 1.5, 2.2, 0.8], [24, 17, 1.4, 2, 0.6], [35, 19, 1.5, 2.2, 0.8], [40, 17.5, 1.3, 1.9, 0.6]]; // the drowned, faint in the glass
const IDX = [-3, -2, -1, 0, 1, 2, 3]; // tentacle slots along the rim
const REST = {}; IDX.forEach((i) => { const len = 22 - Math.abs(i) * 2; REST[i] = [1, 2, 3, 4].map((k) => ({ x: Math.sin(i * 0.9 + k * 1.1) * 2 * k / 4 + i * 0.6 * k / 4, y: k * len / 4 })); });
const q = (v) => Math.round(v * 20) / 20; // twentieths, so gradients and paths that depend on a value are not rebuilt every frame

const params = {
  sx: 1, sy: 1,       // squash / stretch about the rim centre
  tilt: 0,            // body rotation in degrees about the rim centre, positive leans the dome toward +x (Mote's side)
  bob: 0, drop: 0,    // body lift (negative is up) and the sink to the floor when stunned
  shake: 0, lip: 0,   // the ringing: a side-to-side vibration of the body and a ripple of the rim (set each frame from the tremble)
  flare: 0,           // the mouth: negative narrows the rim, 1 yawns it wide (also spreads the tentacle roots)
  core: 0.85,         // brightness of the swallowed light 0 dark .. 2 white-out
  ringK: 0,           // sound rings spreading from the core, 0 none .. 1 faded out
  clap: 0,            // the clapper's swing, x offset of its ball (hangs from under the core)
  look: 0,            // the faces drift toward +x (Mote) 0..1
  faceA: 0.8,         // how visible the drowned are
  pink: 1,            // their hue: 1 the pink of the stills, 0 the dark drowned surfacing when the bell is down
  haunt: 0,           // phase 2: halos and a swell on the faces
  faceY: 0,           // the faces float up (negative) or sink toward the mouth
  drip: 0,            // drops forming under the rim before the rain
  tip: 0.6,           // the beads on the tentacle tips, 0 dark .. 1 lit
};
// [stiffness, damping ratio] for the values that overshoot and settle; the rest snap to their target
const springs = {
  sx: [420, 0.5], sy: [420, 0.5], tilt: [160, 0.4], bob: [220, 0.55], drop: [200, 0.7], flare: [300, 0.45], core: [90, 1],
  clap: [200, 0.12], look: [150, 0.8], faceA: [160, 1], pink: [40, 1], haunt: [60, 1], faceY: [80, 0.8], drip: [120, 0.7], tip: [80, 1],
};
// stills exported to art/bell_<pose>.svg (hover, toll and stunned are the originals)
const poses = {
  hover: {},
  toll: { sy: 0.92, sx: 1.05, core: 1.5, ringK: 0.35, clap: 4.5, flare: 0.2, lip: 1.2, faceA: 0.9, tip: 1 },
  stunned: { tilt: 22, sy: 0.8, sx: 1.12, drop: 13, core: 0.2, pink: 0, faceA: 1, flare: 0.35, clap: 3, tip: 0.2 },
  toll_tele: { sy: 0.84, sx: 1.1, core: 1.4, clap: -6, flare: -0.12, shake: 1.5, faceA: 1 },
  slam_tele: { sy: 1.1, sx: 0.95, bob: -3, core: 1.3, flare: 0.3, faceY: 2, faceA: 1 },
  dive: { sy: 1.32, sx: 0.86, core: 1.2, flare: -0.1, faceY: 3, clap: -3 },
  rain_tele: { bob: -6, sy: 1.08, sx: 0.96, core: 1.5, flare: 0.25, drip: 1, faceA: 1, tip: 1 },
  summon: { flare: 0.85, sy: 0.9, sx: 1.1, core: 1.3, pink: 1, haunt: 1, faceA: 1, faceY: 4 },
  phase2: { core: 1.05, haunt: 0.8, faceA: 1 },
};
// a template point carried by the body's transform (the rim anchors of the tentacles, the core for the world-space glow)
function bodyPt(P, x, y) {
  const a = P.tilt * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); const dx = (x - CX) * P.sx, dy = (y - RIM) * P.sy;
  return { x: CX + P.shake + dx * c - dy * s, y: RIM + P.bob + P.drop + dx * s + dy * c };
}
const rootX = (fl, i) => CX + i * 6 * (1 + fl * 0.2); // where tentacle i leaves the rim, before the body transform

function make(P, pup) {
  const fl = q(clamp(P.flare, -0.3, 1)), lip = q(P.lip), hw = 20 + fl * 4, ck = q(clamp(P.core, 0, 2)), pk = q(clamp(P.pink, 0, 1)), ha = clamp(P.haunt, 0, 1), fa = clamp(P.faceA, 0, 1);
  // tentacles: verlet chains hanging from the rim when animated, their rest curves for the stills; a lit bead on each tip.
  // The odd and even slots are drawn as one path each (two strokes, two new paths per frame instead of seven)
  let odd = '', even = ''; const beads = []; const tipA = q(clamp(0.25 + P.tip * 0.6, 0, 1));
  for (const i of IDX) {
    const ch = pup && pup.chains['t' + i]; let pts;
    if (ch) pts = ch.points(); else { const a = bodyPt(P, rootX(fl, i), RIM); pts = [a].concat(REST[i].map((p) => ({ x: a.x + p.x, y: a.y + p.y }))); }
    const e = pts[pts.length - 1], d = curve(pts);
    if (i % 2) odd += d; else even += d;
    beads.push(circ(e.x, e.y, 1.1, LIGHT, { opacity: tipA }));
  }
  const tent = [stroke(even, '#a0b8ff', 1.8, { opacity: 0.8 }), stroke(odd, '#7fd7ff', 1.8, { opacity: 0.8 })];
  // the bell: its mouth widens with flare, the rim and the flanks ripple with lip while it rings
  const body = path(`M${n(CX - hw)} 40 C${n(6 - fl * 4 - lip * 0.8)} 12 20 4 28 4 C36 4 ${n(50 + fl * 4 + lip * 0.8)} 12 ${n(CX + hw)} 40 C${n(40 + fl * 2)} ${n(46 + lip)} ${n(16 - fl * 2)} ${n(46 - lip)} ${n(CX - hw)} 40 Z`, BODY_G, { stroke: '#e8f6ff', strokeWidth: 1.2 });
  const lipHi = stroke(`M14 34 C22 ${n(40 + lip * 0.5)} 34 ${n(40 - lip * 0.5)} 42 34`, '#ffffff', 1, { opacity: 0.4 });
  const domeHi = stroke('M12 20 C14 12 20 8 26 7', '#ffffff', 1.2, { opacity: 0.7 });
  // the swallowed light: a core whose glow swells and whitens with core, and the sound rings of a toll
  const cr = 12 * (0.75 + ck * 0.3);
  const core = circ(CX, 24, cr, rad('bco', CX, 24, cr, [[0, '#ffffff', clamp(0.5 + ck * 0.4, 0, 1)], [0.5, GLASS, clamp(0.28 + ck * 0.25, 0, 1)], [1, GLASS, 0]]));
  const hot = ck > 0.95 ? circ(CX, 24, 3 + ck * 2, '#ffffff', { opacity: q(clamp((ck - 0.9) * 0.8, 0, 0.9)) }) : null;
  const rk = q(clamp(P.ringK, 0, 1));
  const rings = rk > 0 && rk < 1 ? [10, 16, 22].map((r, j) => circ(CX, 24, r * (0.5 + rk * 0.9), 'none', { stroke: GLASS, strokeWidth: 1.6 - j * 0.4, opacity: q((0.55 - j * 0.12) * (1 - rk)) })) : null;
  // the clapper: a ball on a short stalk under the core, swinging on a true arc
  const cl = clamp(P.clap, -8.5, 8.5), cy = 21 + Math.sqrt(Math.max(0, 81 - cl * cl));
  const clapper = [stroke(`M28 21 Q${n(28 + cl * 0.45)} ${n(21 + (cy - 21) * 0.55)} ${n(28 + cl)} ${n(cy)}`, '#bfe6ff', 1, { opacity: 0.7 }), circ(28 + cl, cy, 4, LIGHT), circ(28 + cl - 0.6, cy - 0.6, 1.8, '#ffffff')];
  // the drowned: faint pink shapes that drift in the glass, dark and larger when they surface, haunted with halos in phase 2
  const fc = mix(DROWN, PINK, pk), fs = 1 + ha * 0.25 + (1 - pk) * 0.3, lx = P.look * 1.4, fy = P.faceY;
  const faces = FACES.map(([x, y, rx, ry, a]) => ell(x + lx, y + fy, rx * fs, ry * fs, fc, { opacity: q(a * fa) }));
  const halos = ha > 0.05 ? FACES.map(([x, y]) => circ(x + lx, y + fy, 3.4 * fs, PINK, { opacity: q(0.28 * ha * fa) })) : null;
  const crown = circ(28, 4.5, 2.2, LIGHT, { stroke: '#8ec4ff', strokeWidth: 0.7 });
  // drops gathering under the rim before the rain
  const drips = P.drip > 0.05 ? [18, 28, 38].map((x, j) => { const k = clamp(P.drip - j * 0.12, 0, 1); return k > 0 ? ell(x + (j - 1) * fl * 2, 45.5 + k * 5.5, 1.3 + k * 0.6, 1.6 + k * 3, GLASS, { opacity: q(0.85 * k) }) : null; }) : null;
  const bell = g([body, lipHi, domeHi, core, hot, rings, clapper, faces, halos, crown, drips], { transform: `${tr(CX + P.shake, RIM + P.bob + P.drop)} ${rot(P.tilt)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-CX, -RIM)}` });
  return svg(W, H, [tent, beads, bell]);
}

// ---- animation: from the boss's state and timers to parameter targets, impulses and the tentacle chains, every frame
let LAST = null; // the puppet that animated the bell last frame (see the death note below)
function control(b, pup, info) {
  // While the bell is dead the game draws it through a fresh copy of the entity every frame (drawBell's fade + flash), which gets a brand
  // new puppet each time: adopt the previous puppet's state so the springs and chains carry on through the death instead of resetting
  if (pup.mem.init === undefined && !b.alive && LAST && LAST !== pup) { pup.P = LAST.P; pup.V = LAST.V; pup.T = LAST.T; pup.chains = LAST.chains; pup.mem = LAST.mem; pup.time = LAST.time; }
  LAST = pup;
  const dt = info.dt, m = pup.mem, s = pup.scale || SCALE, P = pup.P;
  if (m.init === undefined) {
    m.init = true; m.state = b.state; m.t = b.t; m.hp = b.hp; m.flash = 0; m.facing = b.facing; m.phase = b.phase; m.alive = b.alive;
    m.px = b.x; m.py = b.y; m.vx = 0; m.vy = 0; m.vib = 0; m.ring = 0; m.hitT = 9; m.t0 = Math.random() * 10;
    m.blink = 2 + Math.random() * 3; m.blinkT = 0; m.twitch = 1 + Math.random() * 2;
  }
  for (const i of IDX) pup.chain('t' + i, CX + i * 6, RIM, REST[i]);
  // the game mirrors the whole scene when the bell faces left: mirror the template-space state too, so the world pose stays continuous
  if (m.facing !== b.facing) {
    m.facing = b.facing; const V = pup.V, T = pup.T;
    for (const k of ['tilt', 'clap', 'look', 'shake']) { P[k] = -P[k]; V[k] = -(V[k] || 0); T[k] = -T[k]; }
    for (let i = 1; i <= 3; i++) { const a = pup.chains['t' + i]; pup.chains['t' + i] = pup.chains['t' + -i]; pup.chains['t' + -i] = a; }
    for (const i of IDX) { const ch = pup.chains['t' + i]; ch.ax = 2 * CX - ch.ax; for (const p of ch.pts) { p.x = 2 * CX - p.x; p.px = 2 * CX - p.px; } for (const r of ch.rest) r.x = -r.x; }
  }
  // the body's world velocity, measured (the game moves it by position in most states), in template units per second with +x toward Mote
  const fac = b.facing < 0 ? -1 : 1;
  if (dt > 0) { const dx = b.x - m.px, dy = b.y - m.py; m.vx = Math.abs(dx) > 60 ? 0 : clamp(dx / dt, -900, 900); m.vy = Math.abs(dy) > 60 ? 0 : clamp(dy / dt, -900, 900); }
  m.px = b.x; m.py = b.y; const vxT = m.vx * fac / s, vyT = m.vy / s;
  // ---- events, found by watching the entity: state changes, the summon frame, a phase change, a hit, death
  const st = b.state, prev = m.state, entered = st !== prev, pt = m.t;
  const hit = b.alive && (b.hp < m.hp || (b.flash > 0 && m.flash <= 0)); const died = !b.alive && m.alive; const phased = b.phase !== m.phase;
  const summoned = st === 'summon' && pt < SUMMON_AT && b.t >= SUMMON_AT;
  m.state = st; m.t = b.t; m.hp = b.hp; m.flash = b.flash || 0; m.alive = b.alive; m.phase = b.phase;
  // fling the tentacles: a velocity (template units/s) for every point, growing toward the tips, plus an outward spread
  const kick = (vx, vy, spread) => { for (const i of IDX) { const ch = pup.chains['t' + i], sg = Math.sign(i); for (let k = 0; k < ch.pts.length; k++) { const p = ch.pts[k], f = (k + 1) / ch.pts.length; p.px -= (vx + sg * spread * (1 + Math.abs(i) * 0.3)) * f / 60; p.py -= vy * f / 60; } } };
  if (entered) {
    if (st === 'toll') { m.ring = 1; pup.snap({ core: 1.8 }); pup.impulse('sy', 5.5).impulse('sx', -3.5).impulse('clap', 420).impulse('flare', 7).impulse('bob', -50); kick(0, -50, 90); }
    else if (st === 'slam') { pup.impulse('sy', 3).impulse('sx', -1.5).impulse('bob', -30); kick(0, -120, 20); }
    else if (st === 'stunned') { m.ring = 0.6; pup.impulse('sy', -8).impulse('sx', 5).impulse('tilt', 320).impulse('clap', -350).impulse('drop', 60); kick(0, -80, 260); }
    else if (st === 'rise') { pup.impulse('sy', 4).impulse('sx', -3).impulse('tilt', -260).impulse('bob', -40); kick(0, 160, -40); }
    else if (st === 'rain') { pup.snap({ drip: 0, core: 1.6 }); pup.impulse('sy', -3).impulse('sx', 2).impulse('bob', 60); kick(0, 200, 0); }
    else if (st === 'hover' && prev === 'intro') { m.ring = 0.7; pup.snap({ core: 1.5 }); pup.impulse('sy', -3).impulse('sx', 2).impulse('bob', 40).impulse('clap', 300); kick(0, 60, 40); }
    else if (st === 'slam_tele') pup.impulse('sy', 2).impulse('bob', -20);
    else if (st === 'rain_tele') pup.impulse('bob', -40).impulse('sy', 1.5);
    else if (st === 'summon') pup.impulse('flare', 4).impulse('sy', -1.5);
  }
  if (summoned) { m.ring = Math.max(m.ring, 0.5); pup.snap({ core: 1.9 }); pup.impulse('sx', 4).impulse('sy', -3).impulse('flare', 10).impulse('bob', 30); kick(0, 40, 160); }
  if (phased) { m.ring = 1; pup.snap({ core: 2 }); pup.impulse('sy', 5).impulse('sx', -3).impulse('clap', 500).impulse('tilt', 200); kick(0, -60, 140); }
  if (hit) { m.hitT = 0; m.ring = Math.max(m.ring, 0.6); pup.impulse('sx', 4.5).impulse('sy', -4).impulse('tilt', -300).impulse('clap', 320).impulse('bob', 30).impulse('flare', 4); kick(-60, -50, 50); }
  if (died) { m.ring = 1; pup.impulse('sy', -4).impulse('sx', 3).impulse('tilt', 300).impulse('clap', 400).impulse('drop', 30); kick(0, -40, 120); }
  m.hitT += dt;
  // ---- idle life: the drowned blink out now and then, a tentacle twitches on its own
  const t = pup.time + m.t0, p2 = b.phase >= 2, fast = p2 ? 0.75 : 1, rate = p2 ? 1.6 : 1;
  m.blink -= dt; if (m.blink < 0) { m.blink = 2.5 + Math.random() * 3.5; m.blinkT = 0.18; } if (m.blinkT > 0) m.blinkT -= dt;
  m.twitch -= dt; if (m.twitch < 0) { m.twitch = 0.8 + Math.random() * 2.5; const ch = pup.chains['t' + IDX[Math.floor(Math.random() * 7)]]; const p = ch.pts[ch.pts.length - 1]; p.px -= (Math.random() - 0.5) * 2.4; p.py += 0.8; }
  // ---- base pose by state; the tentacle environment (gravity, stiffness, spread) goes with it
  const pulse = Math.sin(t * 2.4 * rate), cpulse = Math.sin(t * 3 * rate);
  const T = { shake: 0, lip: 0, ringK: 0, drip: 0, drop: 0, faceY: Math.sin(t * 0.9) * 0.8, haunt: p2 ? 0.6 + Math.sin(t * 5) * 0.3 : 0, pink: 1, faceA: 0.8, look: 0.5 + Math.sin(t * 0.6) * 0.5, tip: 0.6 + cpulse * 0.2 };
  let ringS = 0, grav = 55, stiff = 4, drag = 0.55, damp = 0.9, spread = 0, windX = 0, wobble = 1;
  switch (st) {
    case 'intro': { const k = clamp(b.t / INTRO, 0, 1); Object.assign(T, { sy: 1.12 - 0.12 * k, sx: 0.94 + 0.06 * k, tilt: Math.sin(t * 1.5) * 3, bob: 0, core: 0.3 + 0.6 * k, faceA: 0.3 + 0.5 * k, flare: -0.1 + 0.2 * k, clap: 0 }); grav = 40; stiff = 2; break; }
    case 'toll_tele': { const k = clamp(b.t / (TOLL_TELE * fast), 0, 1), e = k * k; Object.assign(T, { sy: 1 - 0.26 * e, sx: 1 + 0.18 * e, tilt: 0, bob: -2 * e, core: 0.9 + 0.9 * e, clap: -7 * k, flare: -0.16 * e, faceA: 1, look: 0.9, tip: 0.6 + 0.4 * e }); ringS = 0.55 * e; grav = 55 - 210 * e; stiff = 7; spread = -28 * e; wobble = 1 - e; break; }
    case 'toll': { const k = clamp(b.t / TOLL, 0, 1); Object.assign(T, { sy: 1, sx: 1, tilt: 0, bob: 0, core: 1.5 - 0.6 * k, clap: 0, flare: 0.25 * (1 - k), faceA: 1, look: 0.9, ringK: clamp(b.t / 0.75, 0, 1), tip: 1 - 0.4 * k }); ringS = 1 - k; spread = 30 * (1 - k); windX = Math.sin(t * 40) * ringS * 35; stiff = 5; break; }
    case 'slam_tele': { const k = clamp(b.t / SLAM_TELE, 0, 1); Object.assign(T, { sy: 1 + 0.12 * k, sx: 1 - 0.07 * k, tilt: 0, bob: -3 * k, core: 0.9 + 0.6 * k, flare: 0.35 * k, clap: 0, faceY: 2 * k, faceA: 1, look: 0.9 }); ringS = 0.3 * k; grav = 80; stiff = 2; break; }
    case 'slam': { const vk = clamp(m.vy / 640, 0, 1); Object.assign(T, { sy: 1 + 0.32 * vk, sx: 1 - 0.16 * vk, tilt: 0, bob: 0, core: 1.2, flare: -0.12, clap: -3, faceY: 3, faceA: 1 }); grav = 30; stiff = 1; drag = 0.6; wobble = 0; break; }
    case 'stunned': { const dur = p2 ? 1.1 : 1.5, wake = Anim.smooth(b.t, dur - 0.4, dur);
      Object.assign(T, { sy: lerp(0.78 + Math.sin(t * 3) * 0.02, 0.96, wake), sx: lerp(1.14 - Math.sin(t * 3) * 0.02, 1.02, wake), tilt: lerp(22 + Math.sin(t * 2.1) * 3, 8, wake), drop: lerp(13, 6, wake), bob: 0, core: lerp(0.2 + Math.sin(t * 2) * 0.05, 1, wake), pink: wake, faceA: 1, faceY: -1 + Math.sin(t * 1.5) * 1.5, look: 0.9, flare: lerp(0.35, 0.1, wake), clap: lerp(4, 0, wake), haunt: 0, tip: 0.2 + 0.6 * wake });
      grav = 140; stiff = 0.8 + wake * 4; spread = 30 * (1 - wake); damp = 0.85; wobble = 0.3; break; }
    case 'rise': Object.assign(T, { sy: 1.06, sx: 0.96, tilt: 0, bob: 0, core: 0.9, flare: 0.1, clap: 0, faceA: 0.9 }); grav = 90; stiff = 3; break;
    case 'rain_tele': { const k = clamp(b.t / RAIN_TELE, 0, 1); Object.assign(T, { bob: -10 * k, sy: 1 + 0.13 * k, sx: 1 - 0.07 * k, tilt: 0, core: 0.9 + 0.7 * k + Math.sin(t * 18) * 0.15 * k, flare: 0.3 * k, drip: k, clap: 0, faceA: 1, look: 0.9, tip: 0.6 + 0.4 * k }); ringS = 0.3 * k; grav = 55 - 190 * k; stiff = 6; spread = 30 * k; break; }
    case 'rain': { const k = clamp(b.t / RAIN, 0, 1); Object.assign(T, { bob: 0, sy: 1, sx: 1, tilt: Math.sin(t * 1.1) * 3, core: 1.3 - 0.45 * k, flare: 0.1, clap: -P.tilt * 0.35, faceA: 0.9 }); break; }
    case 'summon': { const op = Anim.smooth(b.t, 0, SUMMON_AT); Object.assign(T, { flare: 0.85 * op, sy: 1 - 0.1 * op, sx: 1 + 0.1 * op, tilt: 0, bob: -2 * op, core: 1.1 + Math.sin(t * 12) * 0.25, pink: 1, haunt: 1, faceA: 1, faceY: 4 * op, clap: 0, look: 0.5 }); grav = 20; stiff = 5; spread = 50 * op; break; }
    case 'dead': { const k = clamp((b.deathT || 0) / DEATH, 0, 1);
      Object.assign(T, { sy: 0.9 - 0.35 * k, sx: 1.05 + 0.12 * k, tilt: (14 + Math.sin(t * 6) * 6) * (1 - k), drop: 8 * k, bob: 0, core: (0.35 + Math.abs(Math.sin(t * 25)) * 0.5) * (1 - k), faceY: -16 * k, faceA: 1 - k * 0.6, pink: 1 - k, haunt: 0, flare: 0.5 * k, clap: Math.sin(t * 8) * 4 * (1 - k), tip: 0 });
      ringS = 0.5 * (1 - k); grav = 110; stiff = 0.5; damp = 0.88; wobble = 0.2; break; }
    default: // hover (and anything unknown): the jelly breathes, sways and leans into its drift, the clapper lags the sway
      Object.assign(T, { sx: 1 - pulse * 0.02, sy: 1 + pulse * 0.035, flare: 0.08 + pulse * 0.1, core: 0.85 + cpulse * 0.15, tilt: Math.sin(t * 1.1) * 5.5 + clamp(vxT / 80, -1, 1) * 12, bob: Math.sin(t * 0.7) * 1.5, clap: -P.tilt * 0.4 });
  }
  if (m.hitT < 0.25) T.core += 0.6 * (1 - m.hitT / 0.25); // the light jumps when struck
  if (m.blinkT > 0) T.faceA *= 0.15;
  // the tremble and the ringing: the body shivers side to side and the rim ripples, amplitude from the state or a decaying event
  m.ring = Math.max(0, m.ring - dt * 2.2); const ring = Math.max(ringS, m.ring); m.vib += dt * 95;
  T.shake = Math.sin(m.vib) * ring * 3.4; T.lip = Math.sin(m.vib * 0.7 + 1) * ring * 3;
  pup.target(T);
  // ---- tentacles: anchored to the rim as the body carries it, streaming behind the motion, undulating, kept above the floor when the bell is down
  const floorT = CY + (b.floorY - (b.y + b.h / 2)) / s, onFloor = floorT < 72, fl = clamp(P.flare, -0.3, 1);
  for (const i of IDX) {
    const ch = pup.chains['t' + i], a = bodyPt(P, rootX(fl, i), RIM); ch.ax = a.x; ch.ay = a.y;
    ch.update(dt, { vx: vxT * 0.5, vy: vyT * 0.5, facing: 1, gravity: grav, drag, stiff, damp, wind: { x: windX + Math.sign(i) * spread + Math.sin(t * 1.8 * rate + i * 0.9) * 9 * wobble, y: Math.cos(t * 1.3 * rate + i) * 5 * wobble } });
    if (onFloor) for (const p of ch.pts) if (p.y > floorT - 0.8) { p.y = floorT - 0.8; p.py = p.y; p.px = p.x - (p.x - p.px) * 0.5; }
  }
}

// ---- world-space effects under the body: the slam's floor target, the dive's trail
function before(ctx, b, pup, info) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, m = pup.mem;
  if (b.state === 'slam_tele') {
    const k = clamp(b.t / SLAM_TELE, 0, 1), y = b.floorY - 2;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(140,224,255,${(0.08 + 0.3 * k).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(cx, y, 10 + 22 * k, 3 + 3 * k, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${(0.15 + 0.4 * k).toFixed(3)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, y, (30 - 18 * k) * (1 + Math.sin(info.t * 30) * 0.03), 5 - 2.5 * k, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  } else if (b.state === 'slam' && m.vy > 120) {
    const vk = clamp(m.vy / 640, 0, 1); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(140,224,255,${(0.2 - i * 0.05).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(cx, cy - i * 11 * vk, 15 - i * 2.5, 19, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}
// ---- world-space effects over the body: the core's light (additive, as the old drawing had it), bubbles while it lies stunned or dies
function after(ctx, b, pup, info) {
  const s = pup.scale || SCALE, P = pup.P, cx = b.x + b.w / 2, cy = b.y + b.h / 2, fac = b.facing < 0 ? -1 : 1;
  const c = bodyPt(P, CX, 24), gx = cx + (c.x - CX) * s * fac, gy = cy + (c.y - CY) * s; const ck = clamp(P.core, 0, 2), r = 12 + ck * 5, a = clamp(0.08 + (ck - 0.4) * 0.35, 0, 0.75);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (a > 0.01) { const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`); gr.addColorStop(0.5, `rgba(140,224,255,${(a * 0.5).toFixed(3)})`); gr.addColorStop(1, 'rgba(140,224,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill(); }
  if (b.state === 'stunned' || b.state === 'dead') {
    const tt = b.state === 'dead' ? (b.deathT || 0) : b.t; ctx.lineWidth = 0.8;
    for (let i = 0; i < 4; i++) { const ph = (tt * 0.9 + i * 0.27) % 1; const bx = cx + Math.sin(tt * 2.5 + i * 2) * 7 + (i - 1.5) * 5, by = cy + 4 - ph * 34; ctx.strokeStyle = `rgba(200,240,255,${(0.5 * (1 - ph)).toFixed(3)})`; ctx.beginPath(); ctx.arc(bx, by, 1.2 + i * 0.3, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
}

module.exports = { name: 'bell', w: W, h: H, anchor: 'center', params, springs, poses, make, control, before, after };
