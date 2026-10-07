// The Lightless: what is left of Sorrel, a great beetle whose shell is the Great Lantern's iron cage. The final boss.
//
// The shell, head and legs are one body carried by a transform with two pitch pivots: `rear` rears the whole beetle
// up on its hind feet (the roar, the leap, the beam) and `tip` bucks the rear end up over the front feet (the bonk
// into a wall that stuns it), on top of a squash/stretch about the feet line, a lift (`bob`), a slide of the body
// along the floor over the planted feet (`shift`: back for a coil, forward for a lunge) and a tremble (`shake`).
// The four legs are jointed and drawn in floor space from hips carried by that transform: the feet stay planted
// while the body moves, lift off when a hip rises out of reach (pawing in the roar, dangling when tipped), and cycle
// with the gait (an alternating walk that blends into a bounding gallop as the speed rises). The head nods on its
// neck, thrusts for a spit and carries two hinged mandibles that work idly, clench for a telegraph and gape for a
// roar; one antenna is a verlet chain that lags every move of the head. The lantern inside is a set of parameters
// (`lantern` light, `crack` flare, `gape` how far the cracks have split, `heat` the phase) so the shell glows hotter
// and cracks wider through the phases and flares on every attack. Everything is keyed to the boss's own state and
// e.t (src/entities.js updateLightless) so the hit frames line up with the game:
//   intro (1.2 s)          dim and folded, it wakes: the lantern kindles, the eyes snap open, the body rises
//   roar (1.1 s)           a crouch, then it rears up on its hind legs with the mandibles wide, forelegs pawing,
//                          cracks blazing, trembling; it drops back with a thump at 1.02 s (also every phase change)
//   charge_tele (0.45-0.6) it coils: nose down, weight back, legs raking the floor, eyes blazing red, a tremble that
//                          builds, mandibles snapping open just before the launch
//   charge (1.6 s)         a gallop at 300: bounding body, mandibles wide, head thrust, after-images, embers, dust
//   leap_tele (0.45 s)     a deepening crouch with a final gather; leap: a stretch, nose up then down, legs reaching
//   slam (0.7 s)           the shell slams flat on splayed legs, a shudder, dust and embers, then it rises
//   spit (fires at 0.5 s)  the head rears back and the throat glows, then it hacks forward
//   summon (fires at 0.4)  the shell lifts and the lantern blazes until embers burst from the cracks
//   beam_tele (0.85 s)     it rears and braces, light pours forward out of the cracks, the eyes go white; beam: recoil
//   stun (1.3 s)           bonk: the rear bucks up and rocks, legs dangle and twitch, eyes dim and spin, the lantern
//                          gutters; it shakes itself awake in the last 0.35 s
//   a hit                  a flinch (compress, head up, mandibles snap, the cracks flash); death is a slow collapse
//                          with the lantern guttering out and the legs twitching
// The game draws the beam, the blink and the telegraph lines itself (nothing of the puppet is drawn during the blink,
// so the pop-in on reappearing is found by the jump in position). The old world-space effects live in after() (the
// additive lantern light, the red aura of a telegraph, the beam's pouring light, embers) and before() (charge
// after-images, dust). See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, path, ell, circ, stroke, g, rot, tr, glow, curve, mix, clamp, lerp, num: n } = L;
const W = 72, H = 52, CX = 36, FY = 51; // bottom anchor; the feet line is y = 51
const SCALE = 0.7; // world units per template unit (ART_SCALE.lightless), for the chain and the world-space effects
const TAU = Math.PI * 2, RAD = Math.PI / 180;
// updateLightless timings (src/entities.js)
const INTRO = 1.2, ROAR = 1.1, LEAP_TELE = 0.45, SLAM = 0.7, SPIT_AT = 0.5, SUMMON_AT = 0.4, BEAM_TELE = 0.85, BEAM = 0.55, STUN = 1.3, DEATH = 2.5;
const HIND = 18, FRONT = 54; // the two pitch pivots on the feet line
const HIPX = [18, 29, 40, 51], FOOTX = [12, 26, 43, 57], LMAX = 15; // legs: hips on the shell's underside, feet at rest, the longest a leg stretches
const ANT_REST = [{ x: 2.6, y: -3.4 }, { x: 5.2, y: -6.6 }, { x: 7.6, y: -9.6 }]; // the antenna, off the brow at (63, 27)
const CRACK_PTS = [[22, 24], [34, 22], [46, 24], [30, 30], [52, 32], [20, 16]]; // where embers leave the shell
const SHELL_D = 'M8 42 C4 20 14 8 34 6 L44 6 C60 8 68 20 66 40 C60 48 20 48 8 42 Z';
const PLATES_D = 'M20 10 C18 20 18 32 22 44 M34 7 C32 20 32 34 36 46 M48 8 C50 20 50 32 46 44';
const CAGE_D = 'M12 24 C24 22 46 22 62 24 M14 34 C26 32 48 32 64 34';
const CRACK_D = 'M16 30 L22 24 L20 16 M30 12 L34 22 L30 30 L36 40 M50 14 L46 24 L52 32', CRACK_HI_D = 'M30 12 L34 22 M50 14 L46 24';
const CRACK2_D = 'M22 24 L27 28 M46 24 L41 28 M34 22 L39 18'; // the splits of phase 2
const CRACK3_D = 'M20 16 L24 10 M30 30 L25 35 L27 41 M52 32 L57 37 M36 40 L42 44 M16 30 L12 36'; // and of phase 3
const HEAD_D = 'M56 30 L70 26 L72 40 L58 44 Z', MAND_UP_D = 'M66 30 C76 26 78 34 72 38', MAND_LO_D = 'M66 40 C74 40 74 46 69 46';
const LEG = '#1a1214', LEG_FAR = '#261a1e', MAND = '#e8d0b0', ANT = '#d8c0a0', LINE = '#0e0a0c';
const q = (v) => Math.round(v * 20) / 20; // twentieths, so colours, gradients and paths that depend on a value are not rebuilt every frame
const sm = (v, a, b) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const params = {
  sx: 1, sy: 1,          // squash / stretch about the feet line
  bob: 0, gaitBob: 0,    // body lift (negative is up): the springy one, and the gait's own bounce
  rear: 0, gaitPitch: 0, // pitch in degrees about the hind feet, positive rears the nose up: the springy one, and the gallop's rocking
  tip: 0,                // pitch about the front feet, positive bucks the rear end up (the bonk)
  shake: 0,              // a tremble of the body, template units (set each frame)
  shift: 0,              // the body slid along the floor over the planted feet: back for a coil, forward for a lunge
  gait: 0, stride: 0, lift: 0, gallop: 0, // the leg cycle's phase, its reach 0..1, how high the feet lift 0..1, walk 0 .. gallop 1
  dig: 0, tuck: 0, splay: 0, twitch: 0,   // legs raking the floor in a coil, stretched fore and aft in a leap, flat and wide, jittering
  clock: 0,              // a free clock for the jitters and the dazed eyes
  headY: 0, headX: 0,    // head nod in degrees about the neck (positive up) and thrust along the body
  jaw: 0.04,             // mandibles 0 shut .. 1 wide
  throat: 0,             // the spore glow in the mouth before a spit
  eyeK: 1, eyeOpen: 1,   // eye halo size, lids (a dip of the glow)
  rage: 0, blaze: 0, daze: 0, // eyes toward red (telegraph, charge), white (beam), pale and spinning (stun)
  lantern: 0.5,          // the light inside 0 dark .. 2.4 blazing (0.5 / 0.75 / 1.15 by phase)
  crack: 0,              // a flare of the cracks 0..1
  gape: 0,               // how far the shell has split 0 .. 1 (phase 3)
  heat: 0,               // the phase's heat 0..2: crack colour, shell darkening, eye hue
  bristle: 0,            // the spines stand up and lean forward 0..1
  pour: 0,               // light pouring forward out of the cracks (beam telegraph) 0..1
};
// [stiffness, damping ratio] for the values that overshoot and settle; the clocks and amounts set each frame snap
const springs = {
  sx: [420, 0.5], sy: [420, 0.5], bob: [300, 0.55], rear: [180, 0.45], tip: [120, 0.32], shift: [240, 0.6], headY: [240, 0.5], headX: [300, 0.6], jaw: [330, 0.42],
  stride: [200, 0.8], lift: [200, 0.8], gallop: [60, 1], dig: [160, 0.7], tuck: [260, 0.7], splay: [160, 0.6], throat: [200, 0.8],
  eyeK: [200, 0.6], rage: [120, 1], blaze: [140, 1], daze: [80, 1], lantern: [90, 0.9], crack: [120, 0.9], gape: [40, 0.9], heat: [30, 1], bristle: [220, 0.5], pour: [160, 0.8],
};
// stills exported to art/lightless_<pose>.svg (idle, charge, leap, stun, phase2 and phase3 are the originals)
const poses = {
  idle: {},
  charge: { rear: -3, gaitPitch: 3, gaitBob: -2.5, gallop: 1, stride: 1, lift: 1, gait: 0.9, jaw: 0.85, rage: 1, eyeK: 1.5, headX: 4, headY: -5, bristle: 0.8, lantern: 1, crack: 0.6, shift: 2 },
  leap: { sy: 1.12, sx: 0.92, rear: 12, tuck: 1, jaw: 0.6, headY: 8, eyeK: 1.3, bristle: 0.6, lantern: 0.8, crack: 0.5, shift: 2 },
  stun: { tip: 14, rear: -3, daze: 1, splay: 1, headY: 2, headX: 1, jaw: 0.7, eyeK: 0.55, lantern: 0.3, bristle: 0.1, twitch: 1, clock: 1.3 },
  phase2: { heat: 1, gape: 0.5, lantern: 0.75 },
  phase3: { heat: 2, gape: 1, lantern: 1.15 },
  roar: { rear: 28, bob: -1, sy: 1.06, sx: 0.95, jaw: 1.05, headY: 14, eyeK: 1.7, lantern: 1.2, crack: 1, bristle: 1, stride: 0.5, lift: 0.6, gait: 2 },
  charge_tele: { rear: -9, bob: 3.5, sx: 1.1, sy: 0.9, dig: 1, rage: 1, eyeK: 1.8, jaw: 0.7, headY: -9, headX: -1.5, bristle: 1, lantern: 0.9, crack: 1, stride: 0.35, gait: 1, shift: -4 },
  leap_tele: { sy: 0.8, sx: 1.12, bob: 3, rear: -5, dig: 0.6, headY: 6, jaw: 0.3, eyeK: 1.3, rage: 0.35, bristle: 0.5, crack: 0.5, lantern: 0.8 },
  slam: { sy: 0.88, sx: 1.12, rear: -8, splay: 1, headY: -10, jaw: 0.9, eyeK: 1.4, lantern: 1.3, crack: 1, bristle: 0.5 },
  beam_tele: { rear: 10, bob: -1, headY: -12, headX: -1, jaw: 0.35, pour: 1, lantern: 1.6, crack: 1, gape: 0.3, blaze: 1, eyeK: 1.8, bristle: 1, dig: 0.4 },
  spit: { headY: 20, headX: -2.5, jaw: 0.9, throat: 1, rear: 4, sx: 0.96, sy: 1.05, eyeK: 1.2, bristle: 0.4 },
};
// a template point carried by the body's transform (the hips, the lantern, the neck): tip about the front feet, rear about the hind feet, squash about the feet centre, then the lift and tremble
function bodyPt(P, x, y) {
  let a = P.tip * RAD, c = Math.cos(a), s = Math.sin(a), dx = x - FRONT, dy = y - FY;
  x = FRONT + dx * c - dy * s; y = FY + dx * s + dy * c;
  a = -(P.rear + P.gaitPitch) * RAD; c = Math.cos(a); s = Math.sin(a); dx = x - HIND; dy = y - FY;
  x = HIND + dx * c - dy * s; y = FY + dx * s + dy * c;
  return { x: CX + (x - CX) * P.sx + P.shake + P.shift, y: FY + (y - FY) * P.sy + P.bob + P.gaitBob };
}
// a head point (the antenna root): the nod about the neck joint (57, 37) and the thrust, then the body
function headPt(P, x, y) {
  const a = -P.headY * RAD, c = Math.cos(a), s = Math.sin(a), dx = x - 57, dy = y - 37;
  return bodyPt(P, 57 + dx * c - dy * s + P.headX, 37 + dx * s + dy * c);
}
const spineD = (br) => [0, 1, 2].map((i) => { const x = 22 + i * 12; return `M${x} 8 L${n(x + 4 + br * 2)} ${n(2 - br * 3)} L${x + 7} 8 Z`; }).join('');
const raysD = (k) => { const l = 46 + 40 * k; return `M34 21 L${n(34 + l)} ${n(21 - l * 0.42)} L${n(34 + l)} ${n(21 - l * 0.2)} Z M46 23 L${n(46 + l)} ${n(23 - l * 0.3)} L${n(46 + l)} ${n(23 - l * 0.05)} Z M22 24 L${n(22 + l)} ${n(24 - l * 0.52)} L${n(22 + l)} ${n(24 - l * 0.36)} Z`; };

function make(P, pup) {
  const hq = q(clamp(P.heat, 0, 2) / 2), hq3 = q(clamp(P.heat - 1, 0, 1)), lan = clamp(P.lantern, 0, 2.4), ga = clamp(P.gape, 0, 1.4), ck = clamp(P.crack, 0, 1.5), br = q(clamp(P.bristle, 0, 1.3));
  const jaw = clamp(P.jaw, -0.1, 1.3), pour = q(clamp(P.pour, 0, 1.2)), ek = clamp(P.eyeK, 0, 2.6), open = clamp(P.eyeOpen, 0, 1), dz = clamp(P.daze, 0, 1), thr = clamp(P.throat, 0, 1.2);
  const shellG = lin('lsh', 10, 6, 60, 44, [[0, mix('#5a4a5c', '#3a2a34', hq3)], [0.5, mix('#3a2a3a', '#22181f', hq3)], [1, '#15100f']]);
  const glowCol = mix('#ffd080', '#fff0c0', hq), crackCol = mix(mix('#ff8a3c', '#fff4d0', hq), '#ffffff', q(ck * 0.5)), spineCol = mix('#3a2a3a', '#241620', hq3);
  const lq = q(Math.min(lan, 2) / 2), legHi = mix('#5a4650', '#b08060', lq * 0.5), legHiFar = mix('#3a2c34', '#6a5040', lq * 0.5); // a ridge of lantern light along each leg, so the joints read against the dark floor
  // ---- legs, in floor space: hips carried by the body, feet planted unless the gait, a stretch, a splay or a twitch moves them, pulled after a hip that rises out of reach
  const gal = clamp(P.gallop, 0, 1), st = clamp(P.stride, 0, 1.3), lf = clamp(P.lift, 0, 1.3), dig = clamp(P.dig, 0, 1.2), tk = clamp(P.tuck, 0, 1.2), sp = clamp(P.splay, 0, 1.2), tw = clamp(P.twitch, 0, 1);
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const hip = bodyPt(P, HIPX[i], 40), bow = i < 2 ? -1 : 1;
    const phW = P.gait + (i % 2) * Math.PI, phG = P.gait + (i < 2 ? 0 : 2.2) + (i % 2) * 0.35;
    const sw = lerp(Math.cos(phW), Math.cos(phG), gal), up = lerp(Math.max(0, -Math.sin(phW)), Math.max(0, -Math.sin(phG)), gal) * st;
    let fx = FOOTX[i] + sw * (3.5 + 3.5 * gal) * st + dig * (i < 2 ? 2 : 4) + bow * (sp * 5 + tk * 6) + tw * Math.sin(P.clock * 31 + i * 2.1) * 2.2;
    let fy = FY - up * (2.5 + 4 * lf) - tk * (i < 2 ? 2 : 4) - tw * Math.max(0, Math.sin(P.clock * 23 + i * 1.7)) * 3.2;
    const dx = fx - hip.x, dy = fy - hip.y, d = Math.hypot(dx, dy); if (d > LMAX) { fx = hip.x + dx / d * LMAX; fy = hip.y + dy / d * LMAX; }
    const kx = hip.x + bow * (5 + up * 2 + dig * 1.5 + sp * 2) + (fx - hip.x) * 0.2, ky = Math.min(fy - 1, hip.y + 6.5 - up * 2.5 - dig * 2 + sp * 1.5);
    const ld = `M${n(hip.x)} ${n(hip.y)} L${n(kx)} ${n(ky)} L${n(fx)} ${n(fy)} l${n(bow * 2.4)} 0.6`;
    legs.push(stroke(ld, i % 2 ? LEG_FAR : LEG, 3.2), stroke(ld, i % 2 ? legHiFar : legHi, 1, { opacity: 0.85 }));
  }
  // ---- the shell: the lantern's glow bleeding around it, the iron cage, cracks that widen and multiply with the phases and flare on attacks
  const inner = glow(34, 24, 22 + lan * 2, glowCol, q(0.3 + lan * 0.3));
  const shell = path(SHELL_D, shellG, { stroke: LINE, strokeWidth: 1.6 });
  const seams = ga > 0.5 ? stroke(PLATES_D, glowCol, 2.4, { opacity: q((ga - 0.5) * 0.8 * Math.min(1, lan)) }) : null;
  const plates = stroke(PLATES_D, LINE, 1.1, { opacity: 0.7 });
  const cage = stroke(CAGE_D, '#7a6a80', 1, { opacity: 0.35 });
  const crackGlow = stroke(CRACK_D, glowCol, 4.5 + ga * 3 + ck * 2, { opacity: q(0.12 + lan * 0.1 + ck * 0.15) });
  const cracks = stroke(CRACK_D, crackCol, 1.2 + ga * 1.1 + ck * 0.5);
  const crackHi = stroke(CRACK_HI_D, '#ffe0a0', 0.8, { opacity: 0.8 });
  const cr2 = ga > 0.05 ? stroke(CRACK2_D, crackCol, 0.8 + ga, { opacity: q(Math.min(1, ga * 2)) }) : null;
  const cr3 = ga > 0.55 ? stroke(CRACK3_D, crackCol, 0.6 + ga, { opacity: q(Math.min(1, (ga - 0.5) * 2)) }) : null;
  const spines = path(spineD(br), spineCol);
  const rays = pour > 0.02 ? path(raysD(pour), '#fff0c0', { opacity: q(0.22 * pour) }) : null;
  // ---- the head on its neck: hinged mandibles, the spore glow of a spit, two glowing eyes (halo, iris, a glint that orbits when dazed)
  const head = path(HEAD_D, mix('#2a1f28', '#1c1218', hq3), { stroke: LINE, strokeWidth: 1.2 });
  const throat = thr > 0.03 ? [circ(69, 36, 5 * thr, '#c8ff5a', { opacity: q(0.3 * thr) }), circ(69, 36, 2.6 * thr, '#e8ffb0', { opacity: 0.9 })] : null;
  const mandU = stroke(MAND_UP_D, MAND, 3.2, { transform: rot(-jaw * 30, 66, 31) }), mandL = stroke(MAND_LO_D, MAND, 2.6, { transform: rot(jaw * 28, 66, 40) });
  let eyeC = hq < 0.5 ? mix('#ffb347', '#ff6a3a', hq * 2) : mix('#ff6a3a', '#ffffff', (hq - 0.5) * 2);
  const rq = q(clamp(P.rage, 0, 1)), bq = q(clamp(P.blaze, 0, 1)), dq = q(dz); if (rq) eyeC = mix(eyeC, '#ff3a2a', rq); if (bq) eyeC = mix(eyeC, '#ffffff', bq); if (dq) eyeC = mix(eyeC, '#ffe0b0', dq);
  const th = P.clock * 9;
  const eye = (cx, cy, r) => [ek > 0.05 ? circ(cx, cy, r * 1.8 * ek, eyeC, { opacity: q(0.25 * Math.min(1, ek)) }) : null, ell(cx, cy, r, Math.max(0.15, r * open), eyeC),
    open > 0.35 ? circ(cx + dz * Math.cos(th) * r * 0.4, cy + dz * Math.sin(th) * r * 0.4 * open, r * 0.45, '#ffffff', { opacity: 0.8 }) : null];
  const headG = g([head, throat, mandU, mandL, eye(64, 34, 3), eye(59, 30, 1.8)], { transform: `${tr(P.headX, 0)} ${rot(-P.headY, 57, 37)}` });
  const body = g([inner, shell, seams, plates, cage, crackGlow, cracks, crackHi, cr2, cr3, spines, rays, headG],
    { transform: `${tr(CX + P.shake + P.shift, FY + P.bob + P.gaitBob)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-CX, -FY)} ${rot(-(P.rear + P.gaitPitch), HIND, FY)} ${rot(P.tip, FRONT, FY)}` });
  // ---- the antenna: a chain off the brow when animated, its rest curve for the stills; the far one is the same curve set back
  const base = headPt(P, 63, 27);
  const pts = pup && pup.chains.ant ? pup.chains.ant.points() : [base].concat(ANT_REST.map((p) => ({ x: base.x + p.x, y: base.y + p.y })));
  const ad = curve(pts), tipP = pts[pts.length - 1];
  const ant = [stroke(ad, ANT, 1.1, { transform: tr(-3.2, 1.6), opacity: 0.55 }), circ(tipP.x - 3.2, tipP.y + 1.6, 1.2, ANT, { opacity: 0.55 }), stroke(ad, ANT, 1.2), circ(tipP.x, tipP.y, 1.4, ANT)];
  return svg(W, H, [legs, body, ant]);
}

// ---- animation: from the boss's state and timers to parameter targets, impulses, the antenna chain and the ember/dust pools, every frame
function control(b, pup, info) {
  const dt = info.dt, m = pup.mem, s = pup.scale || SCALE, P = pup.P;
  if (m.init === undefined) {
    m.init = true; m.state = b.state; m.t = b.t; m.hp = b.hp; m.flash = 0; m.phase = b.phase || 1; m.alive = b.alive; m.facing = b.facing;
    m.gait = 0; m.vib = 0; m.t0 = Math.random() * 10; m.aura = 0; m.jolt = 0; m.hitT = 9; m.shuffle = 0; m.chew = 0; m.ghostT = 0; m.emberT = 0; m.bound = 1; m.sparkI = 0; m.twitchT = 0;
    m.blink = 2 + Math.random() * 3; m.blinkT = 0; m.glance = 1 + Math.random() * 2; m.lookTo = 2; m.fidget = 1.5 + Math.random() * 3;
    m.sparks = []; for (let i = 0; i < 14; i++) m.sparks.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, g: 0 });
    m.dust = []; for (let i = 0; i < 8; i++) m.dust.push({ x: 0, y: 0, vx: 0, r: 1, life: 0, max: 1 });
  }
  const ant = pup.chain('ant', 63, 27, ANT_REST);
  const fac = b.facing < 0 ? -1 : 1, cx = b.x + b.w / 2, bottom = b.y + b.h;
  const vxT = (b.vx || 0) * fac / s, vyT = (b.vy || 0) / s, speedT = Math.abs(vxT);
  const wx = (tx) => cx + (tx - CX) * s * fac, wy = (ty) => bottom + (ty - H) * s; // template point to world
  // ember and dust pools (fixed size, reused): template positions in, world velocities with +x forward
  const slot = (pool) => { let best = pool[0]; for (const k of pool) { if (k.life <= 0) return k; if (k.life < best.life) best = k; } return best; };
  const spark = (tx, ty, vx, vy, life, grav) => { const k = slot(m.sparks); k.x = wx(tx); k.y = wy(ty); k.vx = vx * fac; k.vy = vy; k.life = k.max = life; k.g = grav; };
  const emitCracks = (count, vx, vy, spread, life, grav) => { for (let i = 0; i < count; i++) { const c = CRACK_PTS[m.sparkI++ % CRACK_PTS.length], p = bodyPt(P, c[0], c[1]); spark(p.x, p.y, vx + (Math.random() - 0.5) * spread, vy + (Math.random() - 0.5) * spread, life * (0.6 + Math.random() * 0.7), grav); } };
  const dust = (tx, ty, vx, r, life) => { const d = slot(m.dust); d.x = wx(tx); d.y = wy(ty); d.vx = vx * fac; d.r = r; d.life = d.max = life; };
  // ---- events, found by watching the entity: a state change, a timer crossing, a hit, a phase change, a turn, death
  const st = b.state, prev = m.state, entered = st !== prev, pt = m.t, p = b.phase || 1;
  const hit = b.alive && (b.hp < m.hp || (b.flash > 0 && m.flash <= 0)), died = !b.alive && m.alive, phased = p !== m.phase, turned = b.facing !== m.facing;
  const warped = m.x !== undefined && Math.abs(b.x - m.x) > 60; // it reappeared somewhere else: the game draws nothing for the blink itself, so this is how the pop-in is found
  const crossed = (at) => !entered && pt < at && b.t >= at;
  m.state = st; m.t = b.t; m.hp = b.hp; m.flash = b.flash || 0; m.alive = b.alive; m.phase = p; m.facing = b.facing; m.x = b.x;
  const lanP = p === 3 ? 1.15 : p === 2 ? 0.75 : 0.5, gapeP = p === 3 ? 1 : p === 2 ? 0.5 : 0, heatP = p - 1, hot = p >= 2 ? 1.25 : 1;
  // ---- locomotion: the leg cycle runs from the speed (a slow heavy walk, a gallop past ~100 world units/s)
  const moving = speedT > 6;
  let rate = moving ? Math.min(5.2, 0.9 + speedT / 70) : 0, stride = moving ? clamp(speedT / 110, 0.4, 1) : 0, lift = moving ? clamp(speedT / 240, 0.35, 1) : 0;
  if (m.shuffle > 0) { m.shuffle -= dt; rate = Math.max(rate, 3); stride = Math.max(stride, 0.45); lift = Math.max(lift, 0.4); }
  // ---- idle life: the eyes dip, glances, and a fidget now and then (a chew, a shuffle, a head tilt, an antenna flick)
  const t = pup.time + m.t0;
  m.blink -= dt; if (m.blink < 0) { m.blink = 2.5 + Math.random() * 4; m.blinkT = 0.13; } if (m.blinkT > 0) m.blinkT -= dt;
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.2 + Math.random() * 2.5; m.lookTo = -3 + Math.random() * 9; }
  m.fidget -= dt; if (m.fidget < 0) { m.fidget = (2 + Math.random() * 3.5) / hot; const r = Math.random(); if (r < 0.4) m.chew = 0.5 + Math.random() * 0.6; else if (r < 0.6) m.shuffle = 0.18; else if (r < 0.8) pup.impulse('headY', Math.random() < 0.5 ? 90 : -90); else { const tp = ant.pts[ant.pts.length - 1]; tp.px += 1.6; tp.py += 1; } }
  if (m.chew > 0) m.chew -= dt;
  const brth = Math.sin(t * 2.1 * hot);
  const T = { clock: pup.time, shake: 0, shift: 0, twitch: 0, eyeOpen: 1, gait: m.gait, gaitBob: 0, gaitPitch: 0, stride, lift, gallop: sm(speedT, 140, 330),
    sx: 1 - brth * 0.008, sy: 1 + brth * 0.014, bob: Math.sin(t * 0.9) * 0.4, rear: Math.sin(t * 0.6) * 0.8, tip: 0,
    headX: 0, headY: m.lookTo + Math.sin(t * 1.3) * 1.5, jaw: m.chew > 0 ? 0.14 + Math.sin(t * 13) * 0.13 : 0.04 + Math.pow(Math.max(0, Math.sin(t * 1.4)), 3) * 0.2,
    eyeK: 1 + Math.sin(t * 4) * 0.08, rage: 0, blaze: 0, daze: 0, throat: 0, pour: 0, dig: 0, tuck: 0, splay: 0, bristle: 0.08 + Math.max(0, Math.sin(t * 0.5)) * 0.1,
    lantern: lanP + Math.sin(t * 3) * 0.06 + (p === 3 ? Math.sin(t * 11) * 0.05 : 0), crack: 0, gape: gapeP, heat: heatP };
  let auraT = 0, antGrav = 8, antStiff = 9, shake = 0, ghosting = false;
  switch (st) {
    case 'intro': { const k = clamp(b.t / INTRO, 0, 1), rise = sm(k, 0.55, 1);
      Object.assign(T, { bob: 4 * (1 - rise), sy: 0.9 + 0.1 * rise, sx: 1.06 - 0.06 * rise, rear: -3 * (1 - rise), headY: -16 + 18 * sm(k, 0.4, 0.85), jaw: 0.05 * rise, dig: 0.8 * (1 - rise), eyeK: k < 0.45 ? 0.05 : 1.4, eyeOpen: k < 0.45 ? 0 : 1,
        lantern: 0.08 + 0.5 * sm(k, 0.15, 0.9) + Math.abs(Math.sin(t * 17)) * 0.12 * sm(k, 0.2, 0.5) * (1 - sm(k, 0.6, 0.9)), crack: 0, bristle: 0 });
      antGrav = 50; antStiff = 3;
      if (crossed(0.54)) { pup.impulse('eyeK', 14).impulse('headY', 120); emitCracks(3, 0, -40, 50, 0.6, 40); }
      if (crossed(0.66)) { pup.impulse('bob', -45).impulse('sy', 1.6).impulse('bristle', 3); dust(12, 51, -20, 2, 0.5); dust(57, 51, 20, 2, 0.5); }
      break; }
    case 'roar': { // a crouch, the rear-up, a trembling hold, the drop
      if (b.t < 0.18) Object.assign(T, { rear: -6, bob: 3, sy: 0.9, sx: 1.06, jaw: 0.15, headY: -8, bristle: 0.3, eyeK: 1.2, dig: 0.5, lantern: lanP + 0.3, crack: 0.3 });
      else if (b.t < 0.88) { Object.assign(T, { rear: 28 + Math.sin(t * 9) * 1.5, bob: -1, sy: 1.06, sx: 0.95, jaw: 1.05 + Math.sin(t * 11) * 0.06, headY: 14, headX: 1, eyeK: 1.7, lantern: lanP + 0.7, crack: 1, bristle: 1 }); shake = 1.3; rate = 2.6; stride = 0.55; lift = 0.6; }
      else { const k = clamp((b.t - 0.88) / 0.22, 0, 1); Object.assign(T, { rear: 28 * (1 - k * k), bob: 0, jaw: 0.5, headY: 4, bristle: 0.6, crack: 0.5, lantern: lanP + 0.3, eyeK: 1.3 }); }
      auraT = 1; antGrav = 0;
      if (entered) m.jolt = Math.max(m.jolt, 0.8);
      if (crossed(0.18)) { pup.impulse('rear', 420).impulse('sy', 3).impulse('bob', -50).impulse('jaw', 14).impulse('headY', 300).impulse('bristle', 10); emitCracks(8, 0, -80, 120, 0.8, 100); m.jolt = 1.5; }
      if (crossed(1.02)) { pup.impulse('sy', -4.5).impulse('sx', 3).impulse('rear', -150).impulse('headY', -220); dust(44, 51, -25, 2.5, 0.5); dust(60, 51, 30, 2.5, 0.5); m.jolt = 1; }
      break; }
    case 'charge_tele': { const dur = p >= 2 ? 0.45 : 0.6, k = clamp(b.t / dur, 0, 1), e = k * k, last = sm(k, 0.82, 1);
      Object.assign(T, { rear: -4 - 4 * e - 2 * last, bob: 1 + 2 * e + 1 * last, sx: 1.04 + 0.06 * e, sy: 0.96 - 0.06 * e, shift: -2.5 - 2.5 * e, dig: 0.3 + 0.7 * k, rage: 1, eyeK: 1.3 + 0.5 * k, jaw: k < 0.75 ? 0.05 : 0.7, headY: -6 - 4 * e, headX: -1.5 * e, bristle: 0.6 + 0.4 * k, lantern: lanP + 0.45 * k, crack: 0.4 + 0.6 * k });
      shake = 0.3 + 1.4 * e; rate = 3.2; stride = 0.35; lift = 0.3; auraT = 1;
      if (warped) { pup.snap({ sx: 0.6, sy: 1.45, bob: -6, lantern: 2.2 }); pup.impulse('sx', 3).impulse('sy', -4); emitCracks(10, 0, -40, 160, 0.6, 90); ant.reset(); for (const k of m.sparks) if (k.life > 0 && Math.abs(k.x - cx) > 120) k.life = 0; }
      if (crossed(dur * 0.75)) { pup.impulse('jaw', 10).impulse('headY', -120); emitCracks(2, -30, -50, 60, 0.5, 120); }
      break; }
    case 'charge': { // the gallop: the body is set by the gait below; here the head, the eyes and the trail
      Object.assign(T, { rear: -3, jaw: 0.85, headX: 4, headY: -5, rage: 1, eyeK: 1.5, bristle: 0.8, lantern: lanP + 0.5, crack: 0.6 + Math.sin(t * 20) * 0.2, bob: 0, sx: 1, sy: 1, shift: 2 }); shake = 0.25; ghosting = true; antStiff = 4;
      if (entered) { pup.impulse('rear', 260).impulse('sy', 3.5).impulse('sx', -2.5).impulse('bob', -70).impulse('jaw', 6).impulse('shift', 140); emitCracks(8, -90, -40, 120, 0.6, 150); dust(12, 51, -40, 3, 0.6); dust(26, 51, -30, 2.5, 0.6); m.ghostT = 0; }
      m.emberT += dt; if (m.emberT > 0.06) { m.emberT = 0; emitCracks(1, -120, -30, 60, 0.45, 100); }
      break; }
    case 'leap_tele': { const k = clamp(b.t / LEAP_TELE, 0, 1), c = sm(k, 0, 0.7), last = sm(k, 0.8, 1);
      Object.assign(T, { sy: 1 - 0.2 * c - 0.05 * last, sx: 1 + 0.12 * c + 0.03 * last, bob: 3 * c + 1.5 * last, rear: -5 * c, shift: -2 * c, dig: 0.6, headY: 6, jaw: 0.3, eyeK: 1.3, rage: 0.35, bristle: 0.5, crack: 0.5, lantern: lanP + 0.3 }); shake = 0.4 * last; antGrav = 30;
      break; }
    case 'leap': { const vk = clamp(b.vy / 560, -1, 1), up = b.vy < 0;
      Object.assign(T, { sy: 1.12 - 0.1 * Math.max(0, vk), sx: 0.92 + 0.08 * Math.max(0, vk), rear: clamp(-vk * 12, -8, 14), bob: 0, shift: up ? 2 : 0, tuck: up ? 1 : 0.35, splay: up ? 0 : 0.5, headY: up ? 8 : -10, jaw: 0.6, eyeK: 1.3, bristle: 0.6, lantern: lanP + 0.3, crack: 0.5 }); antGrav = -10; antStiff = 3;
      if (entered) { pup.impulse('sy', 7).impulse('sx', -4).impulse('rear', 300).impulse('bob', -90).impulse('tuck', 12).impulse('shift', 90); dust(10, 51, -30, 3, 0.6); dust(30, 51, -10, 2.5, 0.6); dust(44, 51, 10, 2.5, 0.6); dust(60, 51, 30, 3, 0.6); emitCracks(4, 0, 60, 80, 0.5, -40); }
      break; }
    case 'slam': { const k = clamp(b.t / SLAM, 0, 1);
      Object.assign(T, { sy: 0.9 + 0.1 * sm(k, 0.15, 0.6), sx: 1.1 - 0.1 * sm(k, 0.15, 0.6), rear: -8 * (1 - sm(k, 0.3, 0.8)), bob: 1.5 * (1 - sm(k, 0.2, 0.7)), splay: 1 - 0.7 * sm(k, 0.35, 0.9), headY: -10 + 10 * sm(k, 0.3, 0.8), jaw: 0.9 - 0.7 * sm(k, 0.2, 0.7), lantern: lanP + 0.8 * (1 - sm(k, 0, 0.5)), crack: 1 - sm(k, 0, 0.6), eyeK: 1.4, bristle: 0.8 * (1 - k) });
      shake = 1.6 * (1 - sm(k, 0, 0.35)); antGrav = 60; antStiff = 3;
      if (entered) { pup.impulse('sy', -8).impulse('sx', 5).impulse('rear', -320).impulse('bob', 30).impulse('headY', -200).impulse('jaw', 10).impulse('splay', 8); for (let i = 0; i < 3; i++) { dust(8 - i * 4, 51, -50 - i * 25, 3 + i, 0.7 + i * 0.1); dust(64 + i * 4, 51, 50 + i * 25, 3 + i, 0.7 + i * 0.1); } emitCracks(6, 0, -100, 160, 0.7, 180); m.jolt = 2; for (const pt2 of ant.pts) pt2.py += 2.5; }
      break; }
    case 'spit': { const tt = b.t;
      if (tt < SPIT_AT) Object.assign(T, { headY: 4 + 16 * sm(tt, 0, 0.45), headX: -2.5 * sm(tt, 0, 0.45), jaw: 0.1 + 0.8 * sm(tt, 0.1, 0.45), throat: sm(tt, 0.15, 0.5), rear: 4 * sm(tt, 0, 0.4), sx: 1 - 0.04 * sm(tt, 0, 0.45), sy: 1 + 0.05 * sm(tt, 0, 0.45), eyeK: 1.2, bristle: 0.4, lantern: lanP + 0.2 * sm(tt, 0, 0.5) });
      else Object.assign(T, { headY: -8 + 8 * sm(tt, 0.6, 1), headX: 3 * (1 - sm(tt, 0.55, 1)), jaw: 0.6 * (1 - sm(tt, 0.6, 0.95)), throat: 0, rear: -2 * (1 - sm(tt, 0.55, 1)), sx: 1 + 0.03 * (1 - sm(tt, 0.5, 0.9)), sy: 1 - 0.03 * (1 - sm(tt, 0.5, 0.9)), eyeK: 1.2, bristle: 0.3 });
      if (crossed(SPIT_AT)) { pup.impulse('headX', 90).impulse('headY', -260).impulse('jaw', 9).impulse('sx', 2.2).impulse('sy', -1.6).impulse('rear', -100); pup.snap({ throat: 0 }); m.jolt = 0.5; }
      break; }
    case 'summon': { const tt = b.t;
      if (tt < SUMMON_AT) { const c = sm(tt, 0, 0.35); Object.assign(T, { rear: 8 * c, bob: -2 * c, bristle: c, lantern: lanP + 1.0 * sm(tt, 0, 0.4), crack: sm(tt, 0, 0.4), gape: gapeP + 0.4 * sm(tt, 0.1, 0.4), eyeK: 1.4, jaw: 0.3, headY: 10 * c, sy: 1 + 0.04 * c, sx: 1 - 0.03 * c }); shake = 0.9 * c; }
      else { const d = sm(tt, 0.45, 1), f = 1 - sm(tt, 0.4, 0.9); Object.assign(T, { rear: 8 * (1 - d), lantern: lanP + 1.2 * f, crack: f, gape: gapeP + 0.4 * f, bristle: 1 - d, jaw: 0.5 * (1 - d), headY: 10 * (1 - d), eyeK: 1.4 - 0.3 * d }); }
      if (crossed(SUMMON_AT)) { pup.snap({ lantern: 2.4 }); pup.impulse('sy', 4).impulse('sx', -2).impulse('bob', -40).impulse('rear', 120).impulse('bristle', 8); emitCracks(10, 0, -130, 120, 1.1, 60); m.jolt = 1.2; }
      break; }
    case 'beam_tele': { const k = clamp(b.t / BEAM_TELE, 0, 1);
      Object.assign(T, { rear: 10 * sm(k, 0, 0.7), bob: -1 * sm(k, 0, 0.7), headY: -12 * sm(k, 0, 0.5), headX: -1, jaw: 0.35 * sm(k, 0.4, 1), pour: k * k, lantern: lanP + 1.1 * k, crack: 0.3 + 0.7 * k, gape: gapeP + 0.3 * k, blaze: k, eyeK: 1.2 + 0.6 * k, bristle: 0.5 + 0.5 * k, dig: 0.4, sx: 1.03, sy: 0.98 });
      shake = 0.2 + 1.3 * k * k; auraT = 1;
      m.emberT += dt; if (m.emberT > 0.09) { m.emberT = 0; emitCracks(1, 40, -50, 50, 0.5, -30); }
      break; }
    case 'beam': { const k = clamp(b.t / BEAM, 0, 1);
      Object.assign(T, { rear: 6 * (1 - sm(k, 0.5, 1)), headY: -10 + 10 * sm(k, 0.5, 1), jaw: 1 - 0.6 * sm(k, 0.6, 1), pour: k < 0.55 ? 1 : 1 - sm(k, 0.55, 0.85), lantern: lanP + 1.4 * (1 - sm(k, 0.3, 1)), crack: 1 - 0.6 * sm(k, 0.4, 1), gape: gapeP + 0.3 * (1 - sm(k, 0.5, 1)), blaze: 1 - sm(k, 0.5, 1), eyeK: 1.8 - 0.6 * sm(k, 0.4, 1), bristle: 1 - 0.5 * sm(k, 0.5, 1), dig: 0.4 * (1 - k) });
      shake = 2.2 * (1 - sm(k, 0, 0.6));
      if (entered) { pup.impulse('rear', -200).impulse('bob', 30).impulse('sx', 3).impulse('sy', -2).impulse('jaw', 10).impulse('headY', 150); pup.snap({ lantern: 2.6 }); emitCracks(8, 160, -60, 100, 0.6, -20); m.jolt = 1.5; }
      m.emberT += dt; if (k < 0.5 && m.emberT > 0.05) { m.emberT = 0; emitCracks(1, 180, -40, 80, 0.4, -10); }
      break; }
    case 'stun': { const k = clamp(b.t / STUN, 0, 1), wake = sm(k, 0.72, 1), off = Math.sin(wake * Math.PI);
      Object.assign(T, { tip: lerp(14 + Math.sin(t * 2.3) * 2.5, 0, wake), rear: lerp(-3, 0, wake), bob: lerp(2, 0, wake), sy: lerp(0.95, 1, wake), sx: lerp(1.05, 1, wake), headY: lerp(2 + Math.sin(t * 2.7) * 5, 0, wake) + Math.sin(t * 26) * 7 * off, headX: lerp(1, 0, wake),
        jaw: lerp(0.7 + Math.sin(t * 3.1) * 0.2, 0.1, wake), daze: 1 - wake, eyeK: lerp(0.55 + Math.sin(t * 5) * 0.1, 1, wake), splay: 1 - wake, twitch: 1 - wake, lantern: lerp(0.22 + Math.abs(Math.sin(t * 17)) * 0.15, lanP, wake), crack: 0, bristle: lerp(0.1, 0.3, wake), rage: 0 });
      antGrav = lerp(70, 8, wake); antStiff = lerp(2, 9, wake); shake = off * 0.6;
      if (entered) { pup.impulse('sx', -5).impulse('sy', 3).impulse('tip', 520).impulse('headY', 260).impulse('jaw', 12).impulse('rear', -120).impulse('bob', 40); m.jolt = 2; dust(58, 51, -30, 3, 0.6); dust(66, 46, -45, 2.5, 0.6); dust(50, 51, -20, 2, 0.5);
        const hp = headPt(P, 70, 34); for (let i = 0; i < 6; i++) spark(hp.x, hp.y, 40 + Math.random() * 60, -90 + Math.random() * 90, 0.4 + Math.random() * 0.3, 200); for (const pt2 of ant.pts) pt2.px -= 3; }
      break; }
    case 'dead': { const k = clamp((b.deathT || 0) / DEATH, 0, 1);
      Object.assign(T, { sy: 0.92 - 0.12 * k, sx: 1.06 + 0.1 * k, bob: 2 + 2 * k, rear: -4 + Math.sin(t * 2) * (1 - k), tip: 3 * (1 - k), headY: -14 - 6 * k, headX: 0, jaw: 0.6 + Math.sin(t * 1.5) * 0.2, daze: 1, eyeK: (0.5 + Math.abs(Math.sin(t * 9)) * 0.2) * (1 - k), eyeOpen: 1 - k * 0.8,
        splay: 0.9, twitch: 0.8 * (1 - k), lantern: (0.25 + Math.abs(Math.sin(t * 23)) * 0.3) * (1 - k), crack: 0, bristle: 0, heat: heatP * (1 - k), rage: 0, blaze: 0 });
      antGrav = 80; antStiff = 1.5;
      m.twitchT -= dt; if (m.twitchT < 0) { m.twitchT = 0.3 + Math.random() * 0.6; pup.impulse('tip', 60 * (1 - k)).impulse('jaw', 3); }
      break; }
    default: { // idle (and anything unknown): breathing, a slow sway, working mandibles, glances; the walk while it is still rolling
      if (entered && prev === 'charge') { pup.impulse('rear', -180).impulse('sx', 2.5).impulse('headY', -120); dust(12, 51, -30, 2.5, 0.5); dust(44, 51, 10, 2, 0.5); }
      if (entered && prev === 'stun') pup.impulse('sy', 2).impulse('bob', -25).impulse('bristle', 4);
      T.tip = Math.sin(t * 0.45 + 1) * 0.5; // a slow shift of weight between the front and hind feet
      if (p === 3) { T.bristle += 0.15; T.eyeK += 0.15; m.emberT += dt; if (m.emberT > 0.3) { m.emberT = 0; emitCracks(1, 0, -25, 20, 1.0, -8); } }
      break; }
  }
  // ---- the gait: the phase runs at the leg rate; the gallop bounds and rocks the body once per cycle, the walk dips twice
  m.gait += rate * TAU * dt; if (m.gait > 1e4) m.gait -= Math.floor(m.gait / TAU) * TAU;
  const gal = P.gallop; T.gait = m.gait; T.stride = stride; T.lift = lift;
  T.gaitBob = -((Math.sin(m.gait + 0.6) * 0.5 + 0.5) * 3 * gal + (1 - gal) * Math.max(0, Math.sin(2 * m.gait)) * 0.9) * stride;
  T.gaitPitch = (gal * Math.sin(m.gait + 1.3) * 5 + (1 - gal) * Math.sin(m.gait) * 1.6) * stride; // the gallop rocks once per bound, the walk once per step
  const sb = Math.sin(m.gait); if (st === 'charge' && m.bound < 0 && sb >= 0) { dust(12, 51, -60, 2.5, 0.45); dust(26, 51, -40, 2, 0.4); pup.impulse('sy', -1.2); } m.bound = sb >= 0 ? 1 : -1;
  // ---- reactions: a hit, a phase change, a turn, death
  if (hit) { m.hitT = 0; pup.impulse('sx', -3).impulse('sy', 1.8).impulse('headY', 170).impulse('jaw', 7).impulse('eyeK', 10).impulse('rear', -90); emitCracks(4, -40, -70, 90, 0.5, 160); for (const pt2 of ant.pts) pt2.px -= 1.5; }
  m.hitT += dt; if (m.hitT < 0.3) T.crack = Math.max(T.crack, 0.9 * (1 - m.hitT / 0.3));
  if (phased && b.alive) { pup.snap({ lantern: 2.4 }); pup.impulse('gape', 2.5).impulse('crack', 6).impulse('bristle', 8); emitCracks(12, 0, -90, 160, 0.9, 120); m.jolt = 1.5; }
  if (died) { pup.impulse('sy', -3).impulse('sx', 2).impulse('rear', -160).impulse('headY', -220).impulse('jaw', 8).impulse('tip', 120); emitCracks(10, 0, -60, 140, 1.2, 60); m.jolt = 1.2; }
  if (turned && !entered && st !== 'charge' && st !== 'leap') { pup.impulse('bob', -35).impulse('sy', 1.2); m.shuffle = 0.2; }
  // the tremble: a telegraph's own, or a decaying jolt from an event
  m.jolt = Math.max(0, m.jolt - dt * 4.5); m.vib += dt * 115;
  T.shake = (Math.sin(m.vib) * 0.7 + Math.sin(m.vib * 1.73 + 1) * 0.3) * Math.max(shake, m.jolt) * 1.2;
  if (m.blinkT > 0 && T.eyeOpen > 0.5) T.eyeOpen = 0.1;
  m.aura += clamp(auraT - m.aura, -dt * 7, dt * 7);
  pup.target(T);
  // ---- after-images while it charges, the ember and dust pools, the antenna streaming after the head
  if (ghosting) { m.ghostT += dt; if (m.ghostT > 0.05) { m.ghostT = 0; pup.ghost(cx, bottom, 0.22, 0.35); } }
  for (const k of m.sparks) if (k.life > 0) { k.life -= dt; k.x += k.vx * dt; k.y += k.vy * dt; k.vy += k.g * dt; k.vx *= 1 - dt * 1.5; }
  for (const d of m.dust) if (d.life > 0) { d.life -= dt; d.x += d.vx * dt; d.r += dt * 14; }
  const a = headPt(P, 63, 27); ant.ax = a.x; ant.ay = a.y;
  ant.update(dt, { vx: vxT * 0.35, vy: vyT * 0.3, facing: 1, gravity: antGrav, drag: 0.5, stiff: antStiff, damp: 0.86, wind: { x: Math.sin(t * 2.3) * 3 + (moving ? 0 : Math.sin(t * 5.1) * 1.5), y: Math.cos(t * 1.7) * 2 } });
}

// ---- world-space effects under the body: charge after-images, dust
function before(ctx, b, pup) {
  const m = pup.mem; if (!m.dust) return;
  if (pup.ghosts.length) pup.drawGhosts(ctx, { flip: b.facing < 0 });
  for (const d of m.dust) if (d.life > 0) { const f = d.life / d.max; ctx.fillStyle = `rgba(150,130,140,${(0.28 * f).toFixed(3)})`; ctx.beginPath(); ctx.arc(d.x, d.y - (1 - f) * 6, d.r, 0, TAU); ctx.fill(); }
}
// ---- world-space effects over the body (additive, as the old drawing had them): the lantern's light, the red aura of a telegraph, the light pouring out before the beam, embers
function after(ctx, b, pup, info) {
  const s = pup.scale || SCALE, P = pup.P, m = pup.mem, fac = b.facing < 0 ? -1 : 1, cx = b.x + b.w / 2, bottom = b.y + b.h; if (!m.sparks) return;
  const wx = (tx) => cx + (tx - CX) * s * fac, wy = (ty) => bottom + (ty - H) * s;
  const lp = bodyPt(P, 34, 24), gx = wx(lp.x), gy = wy(lp.y), lan = clamp(P.lantern, 0, 2.4), col = P.heat > 1.2 ? '255,240,192' : '255,208,128';
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = 12 + lan * 9, a = clamp(0.06 + lan * 0.2, 0, 0.7);
  if (a > 0.01) { const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, r); gr.addColorStop(0, `rgba(${col},${a.toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, r, 0, TAU); ctx.fill(); }
  if (m.aura > 0.01) { ctx.fillStyle = `rgba(255,58,42,${((0.18 + Math.sin(info.t * 30) * 0.08) * m.aura).toFixed(3)})`; ctx.beginPath(); ctx.ellipse(cx, bottom - 18, 34, 26, 0, 0, TAU); ctx.fill(); }
  const pour = clamp(P.pour, 0, 1.2);
  if (pour > 0.02) { const px = wx(lp.x + 6), py = wy(lp.y - 6), len = 40 + 50 * pour; const gr = ctx.createLinearGradient(px, py, px + fac * len, py); gr.addColorStop(0, `rgba(255,240,192,${(0.35 * pour).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,240,192,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.lineTo(px + fac * len, py - 24 * pour); ctx.lineTo(px + fac * len, py + 8); ctx.closePath(); ctx.fill(); }
  for (const k of m.sparks) if (k.life > 0) { const f = k.life / k.max; ctx.fillStyle = f > 0.5 ? `rgba(255,240,200,${(0.9 * f).toFixed(3)})` : `rgba(255,140,60,${(0.9 * f).toFixed(3)})`; ctx.beginPath(); ctx.arc(k.x, k.y, 0.6 + 1.3 * f, 0, TAU); ctx.fill(); }
  ctx.restore();
}

module.exports = { name: 'lightless', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, before, after };
