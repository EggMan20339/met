// The pickups: the glowbloom petal (H), heartwood (S), the four gifts (1 windstep, 2 rootgrip, 3 skyleaf, 4 cinder)
// and the Great Lantern's heart (*): one module keyed by ent.type (P.kind), one puppet per pickup.
//
// src/game.js: a pickup is { type, x, y, t (its own clock, started at a random phase), visible, taken }; the game draws
// each at (x, y) through this module (src/sprites.js drawPickup: control, update, before, draw) and then pushes its own
// light. make(P) is a pure drawing of the parameters: at rest it is the old still of each kind (tools/art/props.js: the
// same shapes, colours and box), and its life sits on top. control(ent, pup, info) animates:
//  - the petal flutters like a petal falling through still air: it rocks on a sine (a loose spring, so the swings carry
//    and overshoot), drifts in a small slow loop with a quicker bob on top, and every few seconds turns over about its
//    midrib (flip): its two cupped halves foreshorten at different rates (curl), so one crosses the midrib before the
//    other, then the back shows, a deeper pink with the veins hidden, until it turns again. Two pollen twinkles orbit it.
//  - heartwood turns slowly (a rock about its centre and a roll about its long axis that foreshortens the lit face), a
//    glint sweeps along the grain, ember flecks rise off its top edge, the grain breathes warm; now and then it crackles
//    (a flash of warmth, a shiver, a pop).
//  - the gifts: the orb breathes; the dashed ring rotates; the symbol turns about the orb's vertical axis (its width is
//    the cosine of the turn) and lives its ability: windstep's lines streak sideways, rootgrip's bars clench, skyleaf's
//    chevrons hop one after the other, cinder's flame flickers and leans; three motes orbit on tilted ellipses, passing
//    behind the orb (small, dim, hidden by it) and in front (bright); a sparkle now and then pops the orb.
//  - the heart beats, lub-dub, on a stiff barely damped spring (each thump overshoots and settles); a ring spreads from
//    each thump (before(), in world space: the old drawing's rings); the inner ring and the halo swell a beat behind the
//    body; the flame flickers on sines, leans in a breeze with gusts on a timer, and bends toward Mote. Three sparks orbit.
// All of them notice Mote (info.game, or window.game when the game exposes it; nothing changes when it does not): within
// NEAR world units they grow eager (faster flutter, glint, spin and beat; a brighter halo; the petal and the flame lean
// toward them) and hop once as Mote arrives. before() paints the halo under the body with a lighter radial gradient, as
// the old drawPickup did, following the hover and breathing with glowK, plus the heart's rings and the gifts' thin
// breathing ring. Pickups never flip. See art/ANIMATION.md.
// Stills: the old names under this module's name (pickups_petal, pickups_heart...) plus a few live moments.
// Filmstrip aid: `cue` on the pickup (--set '{"cue":"near"}') plays it as if Mote stood close by.
const L = require('../lib');
const { svg, lin, rad, path, circ, stroke, g, rot, tr, glow, shade, mix, clamp } = L;
const W = 28, H = 28;                       // the module's box: the heart's; the smaller kinds draw their own still's box centred in it
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const NEAR = 72;                            // world units: Mote this close makes a pickup eager (4.5 tiles)
const RING_LIFE = 0.8;                      // seconds a heartbeat's ring takes to spread and fade
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
const frac = (v) => v - Math.floor(v);
const hash = (v) => frac(Math.sin(v * 12.9898) * 43758.5453);                 // a deterministic 0..1 per integer, for the flecks' start points
const rgbOf = (h) => `${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)}`;
const at = (x, y) => (x || y ? { transform: tr(x, y) } : undefined);          // a translate only when it moves anything (keeps the stills clean)

// per kind: the still's box (w) and centre (c), ART_SCALE (s), and the halo's colour, radius (world units) and alpha from the old drawPickup
const KIND = {
  H: { w: 18, c: 9, s: 0.8, halo: '#ff8ab0', gr: 18, ga: 0.45 },
  S: { w: 18, c: 9, s: 0.8, halo: '#ffbe5a', gr: 18, ga: 0.45 },
  1: { w: 24, c: 12, s: 0.8, halo: '#5ad8ff', gr: 18, ga: 0.45, col: '#5ad8ff', name: 'windstep', dir: 1 },
  2: { w: 24, c: 12, s: 0.8, halo: '#8cff9a', gr: 18, ga: 0.45, col: '#8cff9a', name: 'rootgrip', dir: -1 },
  3: { w: 24, c: 12, s: 0.8, halo: '#d49aff', gr: 18, ga: 0.45, col: '#d49aff', name: 'skyleaf', dir: 1 },
  4: { w: 24, c: 12, s: 0.8, halo: '#ffb347', gr: 18, ga: 0.45, col: '#ffb347', name: 'cinder', dir: -1 },
  '*': { w: 28, c: 14, s: 0.9, halo: '#ffd060', gr: 28, ga: 0.6 },
};
for (const k in KIND) { const K = KIND[k]; K.rgb = rgbOf(K.halo); if (K.col) { K.orb = rad('go' + K.name, 10, 10, 8, [[0, '#ffffff'], [0.35, K.col], [1, shade(K.col, -0.45)]]); K.rim = shade(K.col, 0.3); K.mote = mix(K.col, '#ffffff', 0.55); K.glow = glow(12, 12, 12, K.col, 0.5); } }
// the fixed parts of the old stills (shared op objects: nothing mutates ops)
const PETAL_GLOW = glow(9, 9, 9, '#ff8ab0', 0.4);
const PETAL_FRONT = lin('pt', 9, 2, 9, 16, [[0, '#ffe2ec'], [1, '#ff6fa0']]), PETAL_BACK = lin('pb', 9, 2, 9, 16, [[0, '#ffc2d6'], [1, '#e2548a']]);
const PETAL_L = 'M9 2 C3 6 3 12 9 16', PETAL_R = 'M9 2 C15 6 15 12 9 16';   // the two halves' outer edges; closed along the midrib for the fills
const PETAL_LZ = PETAL_L + ' Z', PETAL_RZ = PETAL_R + ' Z';
const HW_GLOW = glow(9, 9, 9, '#ffb347', 0.4);
const HEART_GLOW = glow(14, 14, 14, '#ffd060', 0.6), HEART_CORE = rad('hc', 12, 12, 9, [[0, '#fff7e0'], [0.5, '#ffd060'], [1, '#c8781a']]);
const FLAME = 'M14 8 C16 11 17 13 14 20 C11 13 12 11 14 8 Z';
const MW = [1.5, -2.0, 1.15], MO = [0, 2.2, 4.1], MT = [-0.35, 0.3, 1.1];   // the orbiting motes: angular speed (rad/s, signed), phase, orbit tilt (rad)
const FLECK = [0, 0.37, 0.71];                                             // the ember flecks' cycle offsets

const params = {
  kind: 'H',          // which pickup: H petal, S heartwood, 1 windstep, 2 rootgrip, 3 skyleaf, 4 cinder, * the heart
  bob: 0, dx: 0,      // the hover, template units (positive down / right); before() follows it
  sx: 1, sy: 1,       // squash and stretch about the centre (impulses: the hop as Mote arrives, the pops)
  rot: 0,             // the body's tilt in degrees on top of the still's (the petal's -25, heartwood's 18)
  flip: 0,            // petal: its turn about the midrib, degrees (0 face up, 180 back up); heartwood: its roll about the long axis
  curl: 0,            // petal: how cupped it is, 0 flat .. 1 (the halves foreshorten at different rates in a turn)
  glint: 0,           // heartwood: the glint's place along the grain, 0..1, invisible at both ends
  warm: 1,            // heartwood: the grain's warmth, 1 the still, below it dimmer, above it a flash
  core: 0,            // gifts and the heart: a white brightening at the orb's core, 0..1
  pulse: 1,           // gifts and the heart: the orb's size factor
  beat: 0,            // the heart's thump, 0 .. ~1 (impulses on a stiff spring)
  ring: 0,            // gifts: the dashed ring's angle in degrees; the heart: the inner ring's swell, 0..1 (follows beat)
  spin: 0,            // gifts: the symbol's turn about the orb's vertical axis, degrees (its width is the cosine)
  lean: 0, tall: 1,   // the heart's flame: its lean in degrees about the base, and its height factor
  life: 0,            // 0 the still .. 1 alive: the clock-driven details (twinkles, flecks, orbiting motes, the symbols' life)
  ft: 0,              // the clock those details run on, seconds (set straight from control; eager pickups run it faster)
  near: 0,            // 0..1 Mote is near: the orbits tighten (before() reads it too)
  glowK: 1,           // the halo's strength, a beat behind the body (before() reads it)
};
// [stiffness, damping ratio]: a loose rock, a slow turn with a little overshoot, a stiff ringing heartbeat, a light that lags
const springs = {
  sx: [320, 0.4], sy: [320, 0.4], rot: [45, 0.5], flip: [38, 0.62], curl: [30, 0.9], warm: [50, 0.8], core: [40, 0.8],
  pulse: [140, 0.45], beat: [190, 0.33], ring: [45, 0.7], lean: [110, 0.3], tall: [190, 0.4], glowK: [30, 0.9], near: [14, 1], life: [20, 1],
};
// stills: the old ones (art/petal.svg, heartwood, gift_*, heart), now as pickups_<name>.svg, and a few live moments
const poses = {
  petal: { kind: 'H' }, heartwood: { kind: 'S' },
  gift_windstep: { kind: '1' }, gift_rootgrip: { kind: '2' }, gift_skyleaf: { kind: '3' }, gift_cinder: { kind: '4' },
  heart: { kind: '*' },
  petal_turn: { kind: 'H', flip: 62, curl: 0.4, rot: 14, bob: -1, life: 1, ft: 1.3 },
  petal_back: { kind: 'H', flip: 180, rot: -10, life: 1, ft: 2.6 },
  heartwood_glint: { kind: 'S', glint: 0.5, warm: 1.15, flip: 25, rot: -6, life: 1, ft: 1.7 },
  gift_eager: { kind: '3', ring: 40, spin: 55, core: 0.5, pulse: 1.05, life: 1, ft: 2.2, near: 1 },
  heart_beat: { kind: '*', beat: 1, ring: 0.7, core: 0.8, lean: 14, tall: 1.15, life: 1, ft: 1.1 },
};

// three motes on tilted elliptical orbits about (c, c): the ones behind (sin < 0) go in `back`, the rest in `front`
function motes(back, front, c, rx, ry0, P, life, color) {
  for (let i = 0; i < 3; i++) {
    const a = P.ft * MW[i] + MO[i], ca = Math.cos(a), sa = Math.sin(a), ry = ry0 + 0.9 * i, ct = Math.cos(MT[i]), st = Math.sin(MT[i]);
    const ex = rx * ca, ey = ry * sa, x = c + ex * ct - ey * st, y = c + ex * st + ey * ct;
    (sa > 0 ? front : back).push(circ(r1(x), r1(y), r2(0.75 + 0.4 * sa), color, { opacity: r2(life * (0.5 + 0.5 * sa)) }));
  }
}
// ---- the petal: two cupped halves about the midrib, each foreshortened by its own turn; the back shows when a half has crossed over
function petal(P, body, life) {
  const f = P.flip * DEG, cf = Math.cos(f), sf = Math.sin(f) * clamp(P.curl, 0, 1);
  const half = (edge, edgeZ, vein, k) => { const sc = Math.abs(k) < 0.1 ? (k < 0 ? -0.1 : 0.1) : r2(k), back = k < 0;
    return g([path(edgeZ, back ? PETAL_BACK : PETAL_FRONT), stroke(edge, '#ff9ac0', 0.6), stroke(vein, '#ffffff', 0.5, { opacity: back ? 0.12 : 0.5 })], sc === 1 ? undefined : { transform: `${tr(9, 0)} scale(${sc} 1) ${tr(-9, 0)}` }); };
  const tw = []; if (life > 0.02) for (let i = 0; i < 2; i++) { const a = P.ft * (1.1 + i * 0.4) + i * 2.4, x = 9 + 7.4 * Math.cos(a), y = 9 + 5.6 * Math.sin(a * 0.7 + i * 1.5), al = life * (0.3 + 0.7 * Math.max(0, Math.sin(P.ft * 4.3 + i * 2))); tw.push(circ(r1(x), r1(y), r2(0.45 + 0.45 * al), '#fff0f6', { opacity: r2(al) })); }
  return [PETAL_GLOW, tw, g([half(PETAL_L, PETAL_LZ, 'M9 7 L6.5 9.5', cf + sf), half(PETAL_R, PETAL_RZ, 'M9 10 L11.5 12', cf - sf), stroke('M9 4 L9 14', '#ffffff', 0.8, { opacity: 0.7 })], { transform: body + rot(-25 + P.rot, 9, 9) })];
}
// ---- heartwood: the bark and the lit face roll about the long axis; the glint rides the grain; flecks rise off the top edge
function heartwood(P, body, life) {
  const cr = Math.cos(clamp(P.flip, -60, 60) * DEG), warm = clamp(P.warm, 0, 2), k = clamp(P.glint, 0, 1), ga = Math.pow(Math.sin(Math.PI * k), 1.5);
  const gx = r1(4.8 + 9.6 * k), gy = r1(9.9 - 1.6 * k);
  const face = g([
    path('M4.5 8 L14 6.4 L14.8 10.2 L5 11.6 Z', '#c8803a'),
    stroke('M6 9.5 L8 8.6 L10 9.4 L12 8.4', '#ffd080', 0.9, warm < 1 ? { opacity: r2(0.45 + 0.55 * warm) } : undefined),
    stroke('M5.5 10.8 L13.5 9.2', '#e8a050', 0.5, { opacity: 0.8 }),
    warm > 1.02 ? stroke('M6 9.5 L8 8.6 L10 9.4 L12 8.4', '#fff2c8', 1.4, { opacity: r2(Math.min(1, (warm - 1) * 0.9)) }) : null,
    ga > 0.02 ? [circ(gx, gy, 2.8, '#ffd080', { opacity: r2(0.4 * ga) }), circ(gx, gy, 1, '#fff6dc', { opacity: r2(0.95 * ga) })] : null,
  ], cr === 1 ? undefined : { transform: `${tr(9.5, 9)} scale(1 ${r2(cr)}) ${tr(-9.5, -9)}` });
  const bark = path('M3 7 L15 5 L16 11 L4 13 Z', '#7a4a24', cr === 1 ? { stroke: '#3a2010', strokeWidth: 0.7 } : { stroke: '#3a2010', strokeWidth: 0.7, transform: `${tr(9.5, 9)} scale(1 ${r2(0.8 + 0.2 * cr)}) ${tr(-9.5, -9)}` });
  const wood = g([bark, face], { transform: body + rot(18 + P.rot, 9, 9) });
  const flecks = []; if (life > 0.02) for (let i = 0; i < 3; i++) {
    const u = P.ft * 0.7 + FLECK[i], cyc = Math.floor(u), p = u - cyc, h = hash(cyc * 3 + i), x0 = 4.5 + 10 * h;
    const x = x0 + Math.sin(p * 6 + h * 9) * 0.8, y = 5.4 + (x0 - 3.9) * 0.15 - 6.5 * p, a = life * (1 - p) * Math.min(1, p * 6);
    flecks.push(circ(r1(x), r1(y), r2(0.9 - 0.4 * p), p < 0.4 ? '#ffd080' : '#ff7a30', { opacity: r2(a) }));
  }
  return [HW_GLOW, wood, flecks.length ? g(flecks, body ? { transform: body } : undefined) : null];
}
// ---- a gift's symbol, living its ability (life scales it all so the still is the old one)
function symbol(P, K, life) {
  const t = P.ft;
  if (K.name === 'windstep') { const s1 = r1(0.9 * life * Math.sin(t * 4.2)), s2 = r1(0.9 * life * Math.sin(t * 4.2 - 1.1)); return [stroke('M7 12 L17 12', '#ffffff', 1.6, at(s1, 0)), stroke('M9 9 L13 9 M9 15 L13 15', '#ffffff', 1.6, at(s2, 0))]; }
  if (K.name === 'rootgrip') { const q = Math.max(0, Math.sin(t * 2.4)), d = r1(1.1 * life * q * q); return [stroke('M8 8 L8 16', '#ffffff', 1.8, at(d, 0)), stroke('M16 8 L16 16', '#ffffff', 1.8, at(-d, 0)), circ(12, 12, r2(1.3 + 0.5 * d), '#ffffff')]; }
  if (K.name === 'skyleaf') { const p = frac(t * 0.8), h1 = Math.sin(Math.PI * clamp(p * 2.2, 0, 1)) * life, h2 = Math.sin(Math.PI * clamp(p * 2.2 - 0.6, 0, 1)) * life; return [stroke('M8 16 L12 12 L16 16', '#ffffff', 1.6, at(0, r1(-1.4 * h1))), stroke('M8 12 L12 8 L16 12', '#ffffff', 1.6, at(0, r1(-1.4 * h2)))]; }
  const fl = r2(1 + life * (0.1 * Math.sin(t * 9) + 0.06 * Math.sin(t * 15.7))), ln = r1(life * (5 * Math.sin(t * 6.3) + 3 * Math.sin(t * 11)));
  return [path('M12 6.5 C15.5 10 15 14 12 17 C9 14 8.5 10 12 6.5 Z', '#ffffff', fl === 1 && ln === 0 ? undefined : { transform: `${tr(12, 17)} ${rot(ln)} scale(1 ${fl}) ${tr(-12, -17)}` }),
    path('M12 11 C13.5 12.6 13.3 14.5 12 15.5 C10.7 14.5 10.5 12.6 12 11 Z', '#ffb347', fl === 1 && ln === 0 ? undefined : { transform: `${tr(12, 15.5)} ${rot(r1(ln * 0.6))} scale(1 ${r2(1 + (fl - 1) * 1.5)}) ${tr(-12, -15.5)}` })];
}
// ---- a gift: the orb (breathing, its symbol turning inside), the dashed ring turning, motes orbiting behind and in front
function gift(P, K, body, life) {
  const cs = Math.cos(P.spin * DEG), sym = Math.abs(cs) < 0.08 ? (cs < 0 ? -0.08 : 0.08) : r2(cs), pulse = r2(P.pulse), core = clamp(P.core, 0, 1.2);
  const back = [], front = []; if (life > 0.02) motes(back, front, 12, 10.6 - 2 * clamp(P.near, 0, 1), 3, P, life, K.mote);
  const orb = g([
    circ(12, 12, 7.2, K.orb, { stroke: K.rim, strokeWidth: 0.8 }),
    core > 0.02 ? circ(10.5, 10.5, r2(2.5 + 2.5 * core), '#ffffff', { opacity: r2(0.45 * Math.min(1, core)) }) : null,
    g(symbol(P, K, life), sym === 1 ? undefined : { transform: `${tr(12, 12)} scale(${sym} 1) ${tr(-12, -12)}` }),
  ], pulse === 1 ? undefined : { transform: `${tr(12, 12)} scale(${pulse}) ${tr(-12, -12)}` });
  const ring = circ(12, 12, 10, 'none', P.ring ? { stroke: K.col, strokeWidth: 0.7, opacity: 0.6, strokeDasharray: '2 2.5', transform: rot(r1(P.ring), 12, 12) } : { stroke: K.col, strokeWidth: 0.7, opacity: 0.6, strokeDasharray: '2 2.5' });
  return [K.glow, g([back, ring, orb, front], body ? { transform: body } : undefined)];
}
// ---- the heart: the core thumps with the beat, the flame leans and flickers about its base, the inner ring swells after the body
function heart(P, body, life) {
  const beat = clamp(P.beat, -0.4, 1.5), pulse = r2(P.pulse * (1 + 0.13 * beat)), core = clamp(P.core, 0, 1.2), lean = r1(clamp(P.lean, -40, 40)), tall = r2(clamp(P.tall, 0.4, 1.6));
  const back = [], front = []; if (life > 0.02) motes(back, front, 14, 12.4 - 2 * clamp(P.near, 0, 1), 3.6, P, life, '#fff0b0');
  const orb = g([
    circ(14, 14, 8, HEART_CORE, { stroke: '#ffe9b0', strokeWidth: 0.8 }),
    core > 0.02 ? circ(12.5, 12.5, r2(3 + 2.5 * core), '#ffffff', { opacity: r2(0.4 * Math.min(1, core)) }) : null,
    path(FLAME, '#ffffff', lean === 0 && tall === 1 ? { opacity: 0.85 } : { opacity: 0.85, transform: `${tr(14, 20)} ${rot(lean)} scale(1 ${tall}) ${tr(-14, -20)}` }),
  ], pulse === 1 ? undefined : { transform: `${tr(14, 14)} scale(${pulse}) ${tr(-14, -14)}` });
  const ring = circ(14, 14, r2(11 + 1.8 * clamp(P.ring, -0.3, 1.5)), 'none', { stroke: '#ffe0a0', strokeWidth: 0.8, opacity: r2(clamp(0.6 + 0.25 * P.ring, 0.3, 0.9)) });
  return [HEART_GLOW, g([back, ring, orb, front], body ? { transform: body } : undefined)];
}

function make(P) {
  const K = KIND[P.kind] || KIND.H, c = K.c, life = clamp(P.life, 0, 1);
  const body = P.dx || P.bob || P.sx !== 1 || P.sy !== 1 ? `${tr(c + P.dx, c + P.bob)} scale(${r2(P.sx)} ${r2(P.sy)}) ${tr(-c, -c)} ` : '';   // the hover and the squash, a prefix for the kinds that rotate on top
  const ops = P.kind === 'S' ? heartwood(P, body, life) : P.kind === '*' ? heart(P, body, life) : K.col ? gift(P, K, body, life) : petal(P, body, life);
  const off = W / 2 - c;   // every kind draws in its own still's box, centred in the module's (same centre anchor, same size on screen)
  return svg(W, H, off ? [g(ops, { transform: tr(off, off) })] : ops);
}

// a heartbeat's ring: the free slot, or the oldest one, starts over at age 0 with strength s
function emitRing(m, s) { let j = 0; for (let i = 0; i < 3; i++) { if (m.rings[i] < 0) { j = i; break; } if (m.rings[i] > m.rings[j]) j = i; } m.rings[j] = 0; m.ringS[j] = s; }

// ---- animation: the pickup's own clock (e.t) and Mote's nearness turned into targets and impulses every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, P = pup.P; const kind = KIND[e.type] ? e.type : 'H', K = KIND[kind];
  if (m.init === undefined) {
    m.init = true; m.ph = frac((e.t || 0) * 0.137) * TAU; m.ft = e.t || 0; m.gl = Math.random(); m.ringA = Math.random() * 360; m.spin = Math.random() * 360;
    m.fidget = 1.5 + Math.random() * 3; m.flipTo = 0; m.flipT = 2 + Math.random() * 4; m.beatT = 0.4; m.dubT = -1; m.gustT = 1 + Math.random() * 3; m.boost = 0;
    m.rings = [-1, -1, -1]; m.ringS = [0, 0, 0]; m.near = 0; m.cue = null; m.cueT = -1; m.simNear = false; m.pre = false;
    pup.snap({ kind });
    if (K.col || kind === '*') pup.impulse('pulse', 3).impulse('glowK', 4).impulse('core', 10);   // a gift or the heart is revealed (or first seen): a flourish
  }
  const t = e.t === undefined ? pup.time : e.t;
  // ---- Mote: how near, and on which side (the game does not pass itself to pickups; window.game is the same object when it exists)
  const gm = info.game || (typeof window !== 'undefined' ? window.game : null), pl = gm && gm.player; let near = 0, side = 0;
  if (pl && !pl.dead) { const ddx = pl.x + pl.w / 2 - e.x, ddy = pl.y + pl.h / 2 - e.y, d = Math.hypot(ddx, ddy); near = clamp((NEAR - d) / 28, 0, 1); side = clamp(ddx / 48, -1, 1); }
  // ---- a cue set on the pickup (filmstrips) plays one beat a moment later: near (Mote stands close from then on), flip, crackle, sparkle, beat, gust
  if (e.cue !== m.cue) { m.cue = e.cue; if (e.cue) m.cueT = 0.25; }
  let cue = null; if (m.cueT >= 0) { m.cueT -= dt; if (m.cueT < 0) cue = m.cue; }
  if (cue === 'near') m.simNear = true; else if (cue === 'flip') m.flipT = -1; else if (cue === 'crackle' || cue === 'sparkle') m.fidget = -1; else if (cue === 'beat') m.beatT = -1; else if (cue === 'gust') m.gustT = -1;
  if (m.simNear) { near = 1; side = 1; }
  const arrive = near > 0.4 && m.near <= 0.4; m.near = near;
  if (arrive) { pup.impulse('sy', 3).impulse('sx', -2).impulse('glowK', 2.5); m.boost = 1; }   // a hop and a flare of light as Mote comes close
  if (m.boost > 0) m.boost = Math.max(0, m.boost - dt * 1.2);
  const eager = 1 + 0.8 * near + 2 * m.boost;
  const T = { kind, near, life: 1, sx: 1, sy: 1 };
  if (kind === 'H') {
    // ---- the petal: the flutter clock runs faster when eager; a turn over the midrib every few seconds, sooner back from the back
    m.ft += dt * eager; const w = m.ft;
    m.flipT -= dt * eager;
    if (m.flipT < 0) { m.flipTo += 180; const back = (m.flipTo / 180) % 2 === 1; m.flipT = back ? 1 + Math.random() * 2 : 2.5 + Math.random() * 4; pup.impulse('rot', (Math.random() < 0.5 ? -1 : 1) * 70).impulse('sy', -1); }
    if (m.flipTo >= 360 && Math.abs(P.flip - m.flipTo) < 0.5) { m.flipTo -= 360; pup.snap({ flip: P.flip - 360 }); }
    Object.assign(T, { rot: 16 * Math.sin(w * 1.5 + m.ph) + 5 * Math.sin(w * 3.7 + 1) + 12 * near * side, flip: m.flipTo, curl: 0.3 + 0.15 * Math.sin(w * 0.9 + m.ph),
      dx: 2.6 * Math.sin(w * 0.75 + m.ph), bob: 1.8 * Math.cos(w * 0.75 + m.ph) + 1.2 * Math.sin(w * 2.1 + 0.7), ft: w, glowK: 1 + 0.12 * Math.sin(w * 2.6 + m.ph) + 0.5 * near });
  } else if (kind === 'S') {
    // ---- heartwood: a slow rock and roll, the glint's sweep, warm breathing, a crackle now and then
    m.ft += dt * eager; const w = m.ft; m.gl += dt * 0.42 * eager;
    m.fidget -= dt * eager; if (m.fidget < 0) { m.fidget = 2 + Math.random() * 4; pup.impulse('warm', 7).impulse('rot', (Math.random() < 0.5 ? -1 : 1) * 150).impulse('sy', 1.6).impulse('sx', -1).impulse('glowK', 1.5); }
    Object.assign(T, { rot: 9 * Math.sin(w * 0.8 + m.ph) + 3 * Math.sin(w * 2.1), flip: 34 * Math.sin(w * 0.5 + m.ph * 0.7), glint: frac(m.gl), warm: 0.9 + 0.25 * Math.sin(t * 4 + m.ph) + 0.3 * near,
      bob: 2.4 * Math.sin(t * 2.2 + m.ph), dx: 0.6 * Math.sin(w * 0.9), ft: w, glowK: 0.95 + 0.1 * Math.sin(t * 4 + m.ph) + 0.4 * near });
  } else if (kind !== '*') {
    // ---- a gift: the ring and the symbol turn (faster when eager), the orb breathes, a sparkle pops it now and then
    m.ft += dt * eager; m.ringA += dt * 24 * eager * K.dir; m.spin = (m.spin + dt * 60 * (1 + 0.6 * near + m.boost)) % 360;
    const sa = m.spin * DEG, spin = (sa - 0.45 * Math.sin(2 * sa)) / DEG;   // the turn lingers face-on and flips quickly through edge-on, a slow coin flip
    if (Math.abs(m.ringA) > 720) { const w = 720 * Math.sign(m.ringA); m.ringA -= w; pup.snap({ ring: P.ring - w }); }   // keep the angle small (the spring follows it)
    m.fidget -= dt * eager; if (m.fidget < 0) { m.fidget = 2.5 + Math.random() * 4; pup.impulse('pulse', 2.6).impulse('sx', 1.2).impulse('sy', -1.2).impulse('core', 8).impulse('glowK', 3); }
    Object.assign(T, { pulse: 1 + 0.05 * Math.sin(t * 3 + m.ph), ring: m.ringA, spin, core: 0.3 * near, bob: 2.5 * Math.sin(t * 2.2 + m.ph), ft: m.ft, glowK: 1 + 0.08 * Math.sin(t * 3 + m.ph) + 0.4 * near });
  } else {
    // ---- the heart: lub-dub on a timer (quicker when Mote is near, and once more as they arrive), a ring per thump, gusts at the flame
    m.ft += dt * eager;
    m.beatT -= dt; if (m.beatT < 0.12 && !m.pre) { m.pre = true; pup.impulse('beat', -6).impulse('tall', -1.5); }   // the squeeze before the thump
    if (m.beatT < 0 || arrive) { m.beatT = 1.5 - 0.6 * near; m.pre = false; m.dubT = 0.17; pup.impulse('beat', 26).impulse('tall', 4).impulse('lean', (Math.random() - 0.5) * 100); emitRing(m, 1); }
    if (m.dubT >= 0) { m.dubT -= dt; if (m.dubT < 0) { pup.impulse('beat', 13); emitRing(m, 0.5); } }
    for (let i = 0; i < 3; i++) if (m.rings[i] >= 0) { m.rings[i] += dt; if (m.rings[i] > RING_LIFE) m.rings[i] = -1; }
    m.gustT -= dt; if (m.gustT < 0) { m.gustT = 1.5 + Math.random() * 3.5; pup.impulse('lean', (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 120)).impulse('tall', -2.5); }
    const b = clamp(P.beat, 0, 1.2);
    Object.assign(T, { beat: 0, ring: b, pulse: 1 + 0.03 * Math.sin(t * 1.3 + m.ph), lean: 6 * Math.sin(t * 1.1 + m.ph) + 3 * Math.sin(t * 2.7) + 16 * near * side,
      tall: 1 + 0.07 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 12.1 + 1) + 0.12 * b, core: 0.25 + 0.5 * b + 0.3 * near, bob: 2.2 * Math.sin(t * 2.2 + m.ph), ft: m.ft, glowK: 1 + 0.6 * b + 0.3 * near });
  }
  pup.target(T);
}

// ---- world-space light under the body: the old drawPickup's halo (lighter, following the hover, breathing with glowK),
// the heart's rings spreading from each thump, and the gifts' thin breathing ring
function before(ctx, e, pup) {
  const P = pup.P, K = KIND[P.kind] || KIND.H, s = pup.scale || K.s, x = e.x + P.dx * s, y = e.y + P.bob * s, gk = clamp(P.glowK, 0.3, 2.5);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = K.gr * (0.85 + 0.15 * gk); const gd = ctx.createRadialGradient(x, y, 0, x, y, gr);
  gd.addColorStop(0, `rgba(${K.rgb},${Math.min(0.85, K.ga * (0.55 + 0.45 * gk)).toFixed(3)})`); gd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gd; ctx.fillRect(x - gr - 4, y - gr - 4, gr * 2 + 8, gr * 2 + 8);
  if (P.kind === '*') {
    const m = pup.mem; ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffe8a0';
    if (m.rings) for (let i = 0; i < 3; i++) { const age = m.rings[i]; if (age < 0) continue; const k = age / RING_LIFE; ctx.globalAlpha = 0.6 * (1 - k) * m.ringS[i]; ctx.beginPath(); ctx.arc(x, y, 8 + 18 * k, 0, TAU); ctx.stroke(); }
  } else if (K.col) {
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${K.rgb},${(0.4 + 0.2 * clamp(P.near, 0, 1)).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 11 + Math.sin((e.t || 0) * 2) * 1.5, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

const scale = (e) => (KIND[e.type] || KIND.H).s;   // world units per template unit per kind (ART_SCALE.petal/heartwood/gift/heart)
module.exports = { name: 'pickups', w: W, h: H, anchor: 'center', scale, params, springs, poses, make, control, before };
