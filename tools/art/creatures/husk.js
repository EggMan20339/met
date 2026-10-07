// Lampwright Husk: an emptied lamplighter still walking its round, lamp on a pole. A mini-boss.
//
// The body is a hooded coat on two bony legs that pivots about the ground between its feet (lean, squash, stretch) and
// bends at the hips; the head nods on the neck; the lamp arm holds a long pole whose angle is a loose pendulum spring,
// with the lantern wobbling on its hook at the tip and the pole itself bowing when it is whipped. Legs are two-bone IK
// from hips that ride the body to feet that stay planted on a stride cycle driven by the entity's speed, so the walk is
// a slow, heavy tread: the body drops on every footfall, the lamp bounces a beat behind, dust puffs off the boots. The
// two attacks are clips keyed to the game's own timers (src/entities.js case 'k'): the swing telegraph (0.42 s) leans
// back and hoists the lamp high over the shoulder while the eyes go red and the body quivers, then the state change
// into 'swing' fires an impulse that whips the pole through the front with a glowing trail and a spray of embers in the
// first 0.18 s (the hitbox window) before it settles; the lunge telegraph (0.38 s) crouches and coils with the lamp
// drawn back like a lance, then 'lunge' stretches the body long and low with the feet trailing, after-images behind
// it, and the recovery skids with the lamp swinging back up. A stagger (0.9 s, from every fourth hit or a lunge into a
// wall) reels back on braced legs with the lamp flailing, the head lolling, the embers sputtering and motes circling
// the hood. Ordinary hits flinch, the eyes flare before every attack, and the lantern's light on the world is in
// after(). A cowl tail and a tattered coat hem are verlet chains. See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, ell, circ, rect, stroke, g, rot, tr, curve, mix, clamp, lerp, num: n } = L;
const W = 34, H = 36, PX = 16, PY = 34.5; // template box; the body pivots about the ground point between the feet
const HX = 16, HY = 26;                   // the hips: the torso bends here
const NX = 16, NY = 11;                   // the neck: the head nods here
const SHX = 19.6, SHY = 13.6;             // the lamp arm's shoulder
const GX = 21, GY = 17;                   // the hand's rest point: the pole pivots here
const POLE = 18, LAMP = 18.5, ARM = 6.4, THIGH = 4.6, SHIN = 4.4;
const SCALE = 0.8;                        // world units per template unit (ART_SCALE.husk)
const SPEED = 42, LUNGE_V = 250;          // ENEMY_DEFS.k.speed, the lunge speed
const T_STELE = 0.42, T_SWING = 0.6, T_LTELE = 0.38, T_LUNGE = 0.32, T_STAGGER = 0.9; // the game's state timers
const DEG = Math.PI / 180, TAU = Math.PI * 2;
const INK = '#1a1526', INK_FAR = '#141020', LINE = '#120e1c', COAT_MID = '#2c2838', HOOD = '#3a3448', COLLAR = '#5a5470', BUTTON = '#8a7a50', POLE_C = '#6a5a3a', LANTERN = '#3a3040', EMBER = '#ffb347', GLASS = '#ffd27a', EYE = '#ffd080', EYE_HOT = '#ff6a4a', EYE_DAZED = '#c88a60', DUST = '#8a7a6a';
const COAT_G = lin('hc', 8, 6, 24, 30, [[0, '#4a4460'], [0.5, COAT_MID], [1, INK]]);
const COAT_D = 'M10 27 C8 20 9 12 13 8 L19 8 C23 12 24 20 22 27 Z', COLLAR_D = 'M11 10 C13 7 19 7 21 10 L20 12 L12 12 Z', HOOD_D = 'M11 9 C11 3 21 3 21 9 C19 8 13 8 11 9 Z';
const HIPS = [[13, 12, true], [19, 20, false]]; // [hip x, foot rest x, far side]; the far leg leads the cycle by half
const HEM_REST = [{ x: -1.1, y: 2.4 }, { x: -2.3, y: 4.6 }];                              // the tattered coat tail, from the back hem
const COWL_REST = [{ x: -1.4, y: 2 }, { x: -2.3, y: 4.3 }, { x: -2.5, y: 6.8 }];          // the cowl's loose tail, from the back of the hood
const HEM_PTS = [{ x: 10, y: 27 }].concat(HEM_REST.map((p) => ({ x: 10 + p.x, y: 27 + p.y }))), COWL_PTS = [{ x: 11.4, y: 7.6 }].concat(COWL_REST.map((p) => ({ x: 11.4 + p.x, y: 7.6 + p.y })));
const SPARKS = [[0, 0.4, 0], [0.37, -0.6, 2.1], [0.71, 0.1, 4.2]];
// paint built once: eye colour at 11 heats, the glass and the lantern's halo at 9 flame levels (quantised so the gradient cache holds)
const EYE_C = Array.from({ length: 11 }, (_, i) => mix(EYE, EYE_HOT, i / 10));
const GLASS_C = Array.from({ length: 9 }, (_, i) => mix('#b07a34', '#fff2c8', i / 8));
const HALO = Array.from({ length: 9 }, (_, i) => { const r = 6.5 + i * 0.9, a = 0.26 + i * 0.05; return circ(LAMP, 0, r, rad('gl', LAMP, 0, r, [[0, GLASS, a], [1, GLASS, 0]])); });

const params = {
  legPhase: 0, stride: 0,                  // gait phase (radians) and amplitude 0..1
  stance: 0, legShift: 0,                  // feet braced apart (+ near foot forward, far foot back) and both feet slid fore/aft under the body (- trailing)
  lean: 0, bend: 0, shift: 0, bob: 0,      // whole-body tilt about the feet (deg, + forward), torso bend at the hips (deg, + forward), fore/aft slide, lift (- crouch)
  sx: 1, sy: 1, shake: 0, ph: 0,           // squash / stretch about the feet, telegraph quiver amplitude, a free clock
  headTilt: 0, headX: 0, headY: 0,         // head nod about the neck (deg, + forward), thrust, drop
  eyeK: 1, eyeHot: 0, eyeOpen: 1, look: 0, daze: 0, // ember halo size, heat (amber .. red), ember strength (a blink is a gutter), gaze (+ forward), swimming eyes
  handX: 0, handY: 0,                      // the lamp hand's offset from its rest (template units)
  poleA: -25, poleBend: 0, lampSwing: 0,   // pole angle (deg, + tip down), the pole's bow (perpendicular, template units), the lantern's wobble on its hook (deg)
  flame: 1, glowK: 1,                      // the lantern's flame (0 dark .. 1.6 blazing) and the strength of its light
  trail: 0, trailA: -25,                   // the swing's glowing arc: amount and the angle it trails from
  sparks: 0, sparkPh: 0, stars: 0, rush: 0, // embers off the lantern, their flight phase, dazed motes, lunge streaks
};
// [stiffness, damping ratio] for the values that overshoot and settle; the gait phase, clocks, flicker and gaze slits snap
const springs = {
  stride: [120, 0.8], stance: [200, 0.6], legShift: [220, 0.6], lean: [220, 0.5], bend: [260, 0.5], shift: [240, 0.55], bob: [300, 0.5], sx: [400, 0.45], sy: [400, 0.45],
  headTilt: [280, 0.4], headX: [260, 0.6], headY: [300, 0.5], eyeK: [300, 0.5], eyeHot: [120, 1], look: [160, 0.8], daze: [100, 1],
  handX: [300, 0.55], handY: [300, 0.55], poleA: [330, 0.42], poleBend: [600, 0.18], lampSwing: [260, 0.15], glowK: [90, 1], trail: [260, 1], sparks: [160, 1], stars: [90, 1], rush: [120, 1],
};
// stills exported to art/husk_<pose>.svg (walk_a, walk_b, idle, swing_tele, swing, lunge and stagger are the originals; lunge_tele, bonk and hurt are new)
const poses = {
  walk_a: { stride: 1, legPhase: Math.PI, bob: 0.4, lean: 3, headTilt: 4 }, walk_b: { stride: 1, legPhase: 0, bob: 0.4, lean: 3, headTilt: 4 },
  idle: {},
  swing_tele: { lean: -8, bend: -7, shift: -1.5, stance: 0.6, handX: -2, handY: -3, poleA: -54, eyeHot: 1, eyeK: 1.6, flame: 1.4, glowK: 1.3, headTilt: -8, sy: 1.03, sx: 0.98 },
  swing: { lean: 12, bend: 14, shift: 1.5, stance: 0.5, handX: 2.5, handY: 1.5, poleA: 42, poleBend: 1.2, lampSwing: 12, eyeHot: 0.7, eyeK: 1.4, flame: 1.5, glowK: 1.4, headTilt: 8, trail: 1, trailA: -40, sparks: 1, sparkPh: 0.4, sx: 1.06, sy: 0.96 },
  lunge_tele: { lean: -11, bend: -5, shift: -2.8, bob: -2.8, stance: 0.95, handX: -5, handY: 0.8, poleA: -3, eyeHot: 1, eyeK: 1.6, flame: 1.4, glowK: 1.3, headTilt: 13, headX: 1.4, sx: 1.06, sy: 0.92 },
  lunge: { lean: 20, bend: 12, shift: 3, legShift: -4, stance: 0.3, sx: 1.16, sy: 0.9, handX: 3, handY: -1, poleA: 8, poleBend: -0.8, lampSwing: -10, eyeHot: 1, eyeK: 1.5, flame: 1.4, glowK: 1.3, headTilt: 12, headX: 1.5, rush: 1, ph: 0.3 },
  stagger: { lean: -18, bend: -10, bob: -1, stance: 0.9, sx: 1.05, sy: 0.95, handX: -1, handY: 2, poleA: -58, lampSwing: 18, poleBend: 0.6, headTilt: -16, headY: 0.5, eyeK: 0.7, eyeOpen: 0.5, daze: 1, stars: 1, flame: 0.7, glowK: 0.6, ph: 0.4 },
  bonk: { lean: 10, bend: 16, bob: -0.5, stance: 0.8, sx: 0.86, sy: 1.1, handX: 1.5, handY: 1, poleA: 58, lampSwing: -24, poleBend: 1.6, headTilt: 20, headX: 1, eyeOpen: 0.3, eyeK: 0.6, flame: 0.5, glowK: 0.5 },
  hurt: { lean: -12, bend: -6, sx: 1.06, sy: 0.94, handY: -1.5, poleA: -46, lampSwing: 14, headTilt: -12, eyeK: 1.4, eyeHot: 0.4, flame: 1.2 },
};

// where a torso-space point ends up in the template after the torso's bend and the body's transform (hips ride the body; after() finds the lamp)
function bodyPoint(P, x, y, bend) {
  if (bend) { const c = Math.cos(P.bend * DEG), s = Math.sin(P.bend * DEG), dx = x - HX, dy = y - HY; x = HX + dx * c - dy * s; y = HY + dx * s + dy * c; }
  const c = Math.cos(P.lean * DEG), s = Math.sin(P.lean * DEG), qx = (x - PX) * P.sx, qy = (y - PY - P.bob) * P.sy;
  return [PX + P.shift + quiver(P) + qx * c - qy * s, PY + qx * s + qy * c];
}
const quiver = (P) => (P.shake > 0.001 ? P.shake * (Math.sin(P.ph * 67) * 0.8 + Math.sin(P.ph * 43) * 0.5) : 0);
// the lamp hand, kept within the arm's reach of the shoulder so the arm never detaches
function handPoint(P) {
  let hx = GX + P.handX, hy = GY + P.handY; const dx = hx - SHX, dy = hy - SHY, d = Math.hypot(dx, dy);
  if (d > ARM) { hx = SHX + dx * ARM / d; hy = SHY + dy * ARM / d; }
  return [hx, hy];
}
// two-bone IK: the joint between a (root) and b (end) with bones la, lb, bending to the side given by sgn; the end is pulled in if out of reach
function joint(ax, ay, bx, by, la, lb, sgn) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1e-6; const max = la + lb - 0.05;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const along = clamp((la * la - lb * lb + d * d) / (2 * d), -la, la), h = Math.sqrt(Math.max(0, la * la - along * along));
  const ux = dx / d, uy = dy / d;
  return [ax + ux * along + uy * h * sgn, ay + uy * along - ux * h * sgn, ax + dx, ay + dy];
}
// the lantern's centre in template space, for after()
function lampPoint(P) { const [hx, hy] = handPoint(P); const a = P.poleA * DEG; return bodyPoint(P, hx + Math.cos(a) * LAMP, hy + Math.sin(a) * LAMP, true); }

function make(P, pup) {
  const q = quiver(P), lean = P.lean, bx = PX + P.shift + q;
  const bodyT = `${tr(bx, PY)} ${rot(lean)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-PX, -PY - P.bob)}`;
  // legs: hips ride the body; feet stay on the ground on the stride cycle (the swinging foot lifts), braced wide by stance, slid by legShift; a knee bends forward
  const reach = 5.5 * P.stride, hop = 2.6 * P.stride;
  const legs = HIPS.map(([hx0, fx0, far], i) => {
    const p = P.legPhase + (far ? Math.PI : 0); const lift = Math.max(0, -Math.sin(p)) * hop;
    const [hx, hy] = bodyPoint(P, hx0, HY, false);
    const fx = fx0 + Math.cos(p) * reach + P.legShift + P.stance * (far ? -2.6 : 2.6) + q * 0.3, fy = PY - lift;
    const [kx, ky, ex, ey] = joint(hx, hy, fx, fy, THIGH, SHIN, 1);
    return stroke(`M${n(hx)} ${n(hy)} L${n(kx)} ${n(ky)} L${n(ex)} ${n(ey)} L${n(ex + 1.5)} ${n(ey)}`, far ? INK_FAR : INK, 2.6);
  });
  const shadow = ell(bx, PY + 0.6, 9 - clamp(P.bob, -1, 3) * 0.5, 1.1, '#000000', { opacity: clamp(0.18 - P.bob * 0.02, 0.06, 0.2) });
  // the coat and its tattered tail (a verlet chain when animated, its rest curve for the stills)
  const hemPts = pup && pup.chains.hem ? pup.chains.hem.points() : HEM_PTS;
  const hem = stroke(curve(hemPts), '#241e30', 1.8);
  const coat = path(COAT_D, COAT_G, { stroke: LINE, strokeWidth: 1 });
  const collar = path(COLLAR_D, COLLAR);
  const buttons = [circ(16, 15, 0.7, BUTTON), circ(16, 19, 0.7, BUTTON), circ(16, 23, 0.7, BUTTON)];
  // the head: hood, the dark inside it (lit red when the embers heat), two ember eyes that swell, redden, gutter and swim; the cowl's loose tail
  const hq = Math.round(clamp(P.eyeHot, 0, 1) * 10), open = clamp(P.eyeOpen, 0, 1), dz = clamp(P.daze, 0, 1);
  const eyeCol = dz > 0.3 ? EYE_DAZED : EYE_C[hq], ek = Math.max(0.3, P.eyeK) * (0.6 + 0.4 * open);
  const eye = (ex, i) => { const x = ex + P.look * 0.6 + dz * Math.sin(P.ph * 9 + i * 2.1) * 0.5, y = 8.4 + dz * Math.cos(P.ph * 7 + i) * 0.4, r = 0.9 * (0.35 + 0.65 * open);
    return [circ(x, y, 1.62 * ek, eyeCol, { opacity: 0.25 }), circ(x, y, r, eyeCol), open > 0.4 ? circ(x, y, r * 0.45, '#ffffff', { opacity: 0.8 }) : null]; };
  const cowlPts = pup && pup.chains.cowl ? pup.chains.cowl.points() : COWL_PTS;
  const head = g([
    stroke(curve(cowlPts), '#4a4460', 1.7),
    path(HOOD_D, HOOD, { stroke: LINE, strokeWidth: 0.9 }),
    ell(16, 8.4, 3.4, 2.6, hq > 2 ? mix('#0c0a14', '#3a1410', hq / 10 * 0.7) : '#0c0a14'),
    hq > 1 ? circ(16, 8.4, 4 + hq * 0.35, EYE_HOT, { opacity: 0.025 * hq }) : null,
    eye(14.6, 0), eye(17.6, 1),
  ], { transform: `${tr(P.headX, P.headY)} ${rot(P.headTilt, NX, NY)}` });
  // the lamp arm: shoulder -> elbow (bending back) -> the hand on the pole; the pole bows when whipped; the lantern wobbles on its hook
  const [hx, hy] = handPoint(P); const [elx, ely, hdx, hdy] = joint(SHX, SHY, hx, hy, 3.4, 3.4, -1);
  const arm = stroke(`M${n(SHX)} ${n(SHY)} L${n(elx)} ${n(ely)} L${n(hdx)} ${n(hdy)}`, COAT_MID, 2.8);
  const fq = Math.round(clamp(P.flame, 0, 1.6) * 5), tongue = clamp(P.flame, 0, 1.6);
  const sk = clamp(P.sparks, 0, 1);
  const sparks = sk > 0.03 ? SPARKS.map(([o, py, dp]) => { const f = (P.sparkPh + o) % 1; return circ(LAMP - 2 - f * 9, py - f * 5 + Math.sin(f * 9 + dp) * 1.3, 0.65 * (1 - f * 0.5), EMBER, { opacity: sk * (1 - f) * 0.9 }); }) : null;
  const lantern = g([
    HALO[fq],
    rect(16, -3.5, 5, 7, LANTERN, { rx: 1 }),
    rect(17.2, -2.2, 2.6, 4.4, GLASS_C[fq], { opacity: 0.9 }),
    tongue > 0.15 ? ell(LAMP, 0.9 - tongue * 0.7, 0.6 + tongue * 0.15, 0.5 + tongue * 0.9, '#fff6dc', { opacity: 0.55 + tongue * 0.25 }) : null,
    sparks,
  ], { transform: rot(P.lampSwing, POLE, 0) });
  const pole = g([stroke(`M0 0 Q9 ${n(P.poleBend)} ${POLE} 0`, POLE_C, 1.8), lantern], { transform: `${tr(hdx, hdy)} ${rot(P.poleA)}` });
  const hand = stroke(`M${n(hdx - Math.cos(P.poleA * DEG) * 1.6)} ${n(hdy - Math.sin(P.poleA * DEG) * 1.6)} L${n(hdx + Math.cos(P.poleA * DEG) * 2)} ${n(hdy + Math.sin(P.poleA * DEG) * 2)}`, HOOD, 2.4);
  // the swing's trail: a glowing arc the lantern has just swept through
  const tk = clamp(P.trail, 0, 1), da = P.poleA - P.trailA;
  const trail = tk > 0.03 && Math.abs(da) > 4 ? (() => { const a0 = P.trailA * DEG, a1 = P.poleA * DEG, r = LAMP; const d = `M${n(hdx + Math.cos(a0) * r)} ${n(hdy + Math.sin(a0) * r)} A${r} ${r} 0 ${Math.abs(da) > 180 ? 1 : 0} ${da > 0 ? 1 : 0} ${n(hdx + Math.cos(a1) * r)} ${n(hdy + Math.sin(a1) * r)}`;
    return [stroke(d, GLASS, 6, { opacity: 0.22 * tk }), stroke(d, '#fff0c0', 2.2, { opacity: 0.4 * tk })]; })() : null;
  const torso = g([hem, coat, collar, buttons, head, arm, trail, pole, hand], { transform: rot(P.bend, HX, HY) });
  const body = g([torso], { transform: bodyT });
  // dazed motes circling the hood; speed streaks behind the body in a lunge
  const stk = clamp(P.stars, 0, 1);
  const stars = stk > 0.03 ? [0, 1, 2].map((i) => { const a = P.ph * 6 + i * 2.1; const [sx, sy] = bodyPoint(P, 16 + Math.cos(a) * 5.5, 3 + Math.sin(a) * 1.4, true); return circ(sx, sy, 0.65 + (Math.sin(a) + 1) * 0.15, '#ffe0b0', { opacity: stk * (0.55 + Math.sin(a) * 0.3) }); }) : null;
  const ru = clamp(P.rush, 0, 1), k0 = (P.ph * 40) % 6;
  const rush = ru > 0.03 ? stroke(`M${n(bx - 9)} ${n(14 - P.bob)} L${n(bx - 15 - k0)} ${n(13.5 - P.bob)} M${n(bx - 10)} ${n(19 - P.bob)} L${n(bx - 18 - ((k0 + 2.5) % 6))} ${n(19.5 - P.bob)} M${n(bx - 8)} ${n(24 - P.bob)} L${n(bx - 14 - ((k0 + 4) % 6))} ${n(24.4 - P.bob)}`, '#ffffff', 0.9, { opacity: 0.35 * ru }) : null;
  return svg(W, H, [shadow, rush, legs, body, stars]);
}

// ---- animation: from the enemy's state (idle / walk / swing_tele / swing / lunge_tele / lunge / stagger, see updateEnemy case 'k') to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, P = pup.P, V = pup.V;
  if (m.init === undefined) {
    m.init = true; m.state = e.state; m.hp = e.hp; m.flash = e.flash || 0; m.facing = e.facing; m.vx = e.vx; m.ax = 0; m.t0 = Math.random() * 10; m.phase = Math.random() * TAU;
    m.lift = [0, 0]; m.blink = 2 + Math.random() * 4; m.blinkT = 0; m.glance = 2 + Math.random() * 3; m.lookTo = 0.2; m.fidget = 2 + Math.random() * 4; m.backT = 0;
    m.hitT = 9; m.flareT = 0; m.gutterT = 9; m.endT = 9; m.lostT = 9; m.alertT = 9; m.vPole = 0; m.ghostT = 0; m.sparkPh = Math.random(); m.burst = 0; m.staggerK = 0;
    m.puffs = []; for (let i = 0; i < 8; i++) m.puffs.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 1 });
  }
  const s = pup.scale || SCALE, t = pup.time + m.t0, vx = e.vx, st = e.state, fac = e.facing;
  const hem = pup.chain('hem', 10, 27, HEM_REST), cowl = pup.chain('cowl', 11.4, 7.6, COWL_REST);
  const cx = e.x + e.w / 2, feet = e.y + e.h;
  // ---- events, found by watching the state, the health and the facing change
  const was = m.state;
  const alert = st === 'walk' && was === 'idle', lost = st === 'idle' && was === 'walk';
  const swingTele = st === 'swing_tele' && was !== 'swing_tele', swing = st === 'swing' && was !== 'swing';
  const lungeTele = st === 'lunge_tele' && was !== 'lunge_tele', lunge = st === 'lunge' && was !== 'lunge', lungeEnd = was === 'lunge' && st === 'walk';
  const stagger = st === 'stagger' && was !== 'stagger', bonk = stagger && was === 'lunge', recovered = was === 'stagger' && st !== 'stagger';
  const hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0), turned = fac !== m.facing;
  const ax = dt > 0 ? (vx - m.vx) / dt / s : 0; m.ax = lerp(m.ax, Math.abs(ax) > 2500 ? 0 : ax, Math.min(1, dt * 10)); // smoothed acceleration (the lunge launch is an impulse instead)
  m.state = st; m.hp = e.hp; m.flash = e.flash || 0; m.facing = fac; m.vx = vx;
  const puff = (x, y, r, pvx, pvy, life) => { let q = m.puffs[0]; for (const p of m.puffs) if (p.life < q.life) q = p; q.x = x; q.y = y; q.r = r; q.vx = pvx; q.vy = pvy; q.life = q.max = life; };
  if (alert) { m.alertT = 0; m.flareT = 0.5; pup.impulse('headTilt', -420).impulse('headY', -24).impulse('eyeK', 9).impulse('handY', -60).impulse('poleA', -320).impulse('lampSwing', 240).impulse('sy', 2.4).impulse('lean', -90); } // it notices: the head snaps up, the embers flare, the lamp lifts
  if (lost) { m.lostT = 0; pup.impulse('headTilt', 140).impulse('handY', 30).impulse('poleA', 120).impulse('sy', -1.2); }
  if (swingTele) { m.flareT = 0.45; pup.impulse('eyeK', 10).impulse('handY', -90).impulse('poleA', -700).impulse('lean', -160).impulse('lampSwing', 300).impulse('sy', 2); }
  if (swing) { // the release: the pole whips through the front, the body throws itself after it, embers spray off the lantern
    m.burst = 1.1; pup.impulse('poleA', 2600).impulse('poleBend', -70).impulse('lampSwing', -500).impulse('lean', 340).impulse('bend', 320).impulse('shift', 50).impulse('sx', 4).impulse('sy', -2.5).impulse('handX', 50).impulse('handY', 70).impulse('headTilt', 300).impulse('eyeK', 6);
    for (let i = 0; i < 3; i++) puff(cx + fac * (3 + i * 2) * s, feet - 1, (1.6 + i * 0.5) * s, fac * (8 + i * 8), -8 - i * 6, 0.35);
  }
  if (lungeTele) { m.flareT = 0.45; pup.impulse('eyeK', 10).impulse('bob', -34).impulse('sy', -3).impulse('sx', 2).impulse('headTilt', 280).impulse('poleA', 300).impulse('handX', -80).impulse('lampSwing', -300); } // it drops into a crouch and levels the lamp like a lance
  if (lunge) { // the launch: long and low, the lamp thrust out ahead, dust off the back foot
    m.ghostT = 0; pup.impulse('lean', 520).impulse('bend', 260).impulse('shift', 70).impulse('sx', 6).impulse('sy', -3.5).impulse('bob', 14).impulse('poleA', 360).impulse('poleBend', -40).impulse('lampSwing', -400).impulse('handX', 110).impulse('legShift', -50).impulse('headX', 30).impulse('eyeK', 5);
    for (let i = 0; i < 4; i++) puff(cx - fac * (5 + i * 3) * s, feet - 1, (1.8 + i * 0.6) * s, -fac * (18 + i * 14), -12 - i * 7, 0.4 + i * 0.05);
  }
  if (lungeEnd) { m.endT = 0; pup.impulse('lean', -300).impulse('bend', -200).impulse('sx', -3).impulse('sy', 2.5).impulse('poleA', -520).impulse('lampSwing', 300).impulse('handY', -30).impulse('stance', 6).impulse('headTilt', -200); for (let i = 0; i < 3; i++) puff(cx + fac * (3 + i * 3) * s, feet - 1, (1.8 + i * 0.5) * s, fac * (10 + i * 8), -10, 0.4); }
  if (stagger) {
    m.staggerK = 0; m.blinkT = 0.2; m.gutterT = 0;
    if (bonk) { // into a wall: a squash from the front, the lamp clatters forward, then the reel back below takes over
      pup.impulse('lean', 520).impulse('bend', 420).impulse('sx', -9).impulse('sy', 5).impulse('shift', 40).impulse('poleA', 700).impulse('poleBend', 60).impulse('lampSwing', -700).impulse('handX', 50).impulse('handY', 40).impulse('headTilt', 600).impulse('headX', 40).impulse('bob', 16);
      for (let i = 0; i < 5; i++) puff(cx + fac * (7 + i * 2) * s, feet - 2 - i * 3 * s, (1.6 + i * 0.5) * s, -fac * (6 + i * 10), -10 - i * 12, 0.4 + i * 0.05);
    } else pup.impulse('lean', -420).impulse('bend', -260).impulse('sx', 4).impulse('sy', -4).impulse('poleA', -800).impulse('poleBend', -50).impulse('lampSwing', 600).impulse('handY', -60).impulse('headTilt', -500).impulse('bob', 10);
  }
  if (recovered) { m.flareT = 0.35; pup.impulse('headTilt', -360).impulse('headY', -16).impulse('eyeK', 8).impulse('lean', 120).impulse('poleA', -260).impulse('handY', -40); } // it shakes it off: the head snaps up, the embers catch
  if (hit && !stagger) { // a flinch, shoved back from the front; the flame gutters for a moment
    m.hitT = 0; m.gutterT = 0; m.blinkT = 0.1;
    pup.impulse('lean', -340).impulse('bend', -220).impulse('shift', -20).impulse('sx', 3).impulse('sy', -3).impulse('headTilt', -400).impulse('headY', 10).impulse('poleA', 300).impulse('lampSwing', 450).impulse('poleBend', 30).impulse('handY', -30).impulse('eyeK', 5);
  }
  if (turned && st !== 'stagger') { pup.impulse('poleA', -360).impulse('lampSwing', 320).impulse('lean', -140).impulse('headTilt', -120).impulse('sx', -2).impulse('sy', 1.5); }
  m.hitT += dt; m.flareT -= dt; m.gutterT += dt; m.endT += dt; m.lostT += dt; m.alertT += dt; m.backT -= dt;
  // ---- the lantern wobbles on its hook and the pole bows from the pole's own acceleration (secondary motion from the primary)
  const dvp = (V.poleA || 0) - m.vPole; m.vPole = V.poleA || 0;
  if (dt > 0 && Math.abs(dvp) > 1) pup.impulse('lampSwing', -dvp * 0.16).impulse('poleBend', -dvp * 0.012);
  // ---- legs: the cycle advances with distance covered (feet stay planted); a footfall is a thud that drops the body and bounces the lamp
  const sp = Math.abs(vx) / s, fwd = (Math.sign(vx) || 1) * fac;
  const walking = (st === 'walk' || st === 'idle') && sp > 4 && m.hitT > 0.25;
  if (walking) { m.phase += fwd * Math.min(sp / 22, 4) * TAU * dt; if (m.phase > TAU) m.phase -= TAU; if (m.phase < 0) m.phase += TAU; }
  for (let i = 0; i < 2; i++) {
    const lift = Math.max(0, -Math.sin(m.phase + (i ? 0 : Math.PI)));
    if (walking && m.lift[i] > 0.02 && lift <= 0.02 && P.stride > 0.5) { // that foot has just come down: a thud
      pup.impulse('bob', -11).impulse('sy', -2).impulse('sx', 1).impulse('poleA', 170).impulse('lampSwing', i ? 220 : -180).impulse('headTilt', 140).impulse('handY', 22).impulse('bend', 60);
      puff(cx + fac * ((i ? 4 : -4) + Math.cos(m.phase + (i ? 0 : Math.PI)) * 5.5) * s, feet - 0.5, 1.5 * s, -fac * 8, -9, 0.3);
    }
    m.lift[i] = lift;
  }
  // ---- idle life: the embers gutter and glance, the flame flickers, fidgets on a random timer (hitching the lamp, a shudder, a look back, a gutter)
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.4 : 3 + Math.random() * 4; m.blinkT = 0.12; }
  let open = 1; if (m.blinkT > 0) { m.blinkT -= dt; open = m.blinkT > 0.06 ? 1 - (0.12 - m.blinkT) / 0.06 : m.blinkT / 0.06; open = 0.15 + 0.85 * clamp(open, 0, 1); }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.5 + Math.random() * 3.5; m.lookTo = Math.random() < 0.5 ? 0.5 : -0.4 + Math.random() * 0.8; }
  m.fidget -= dt;
  if (m.fidget < 0 && (st === 'idle' || (st === 'walk' && !walking)) && m.hitT > 1) {
    m.fidget = 1.8 + Math.random() * 3; const r = Math.random();
    if (r < 0.38) pup.impulse('handY', -110).impulse('handX', -30).impulse('poleA', -420).impulse('lampSwing', 320).impulse('sy', 2).impulse('bend', -60); // hitches the lamp up
    else if (r < 0.6) pup.impulse('sx', 3).impulse('sy', -2.5).impulse('headTilt', 320).impulse('lean', -110).impulse('bend', 140).impulse('poleA', 120); // a hollow shudder
    else if (r < 0.82) { m.backT = 1.4; m.lookTo = -0.8; m.glance = 1.7; pup.impulse('headTilt', -200).impulse('headY', -8); }                                // a look back over the shoulder
    else m.gutterT = -0.15;                                                                                                                                 // the lantern gutters and flares back
  }
  const gut = m.gutterT < 0.5 ? (m.gutterT < 0.12 ? 0.3 : m.gutterT < 0.3 ? 0.3 + (m.gutterT - 0.12) / 0.18 * 1.3 : 1.6 - (m.gutterT - 0.3) / 0.2 * 0.6) : 1;
  const flick = 0.86 + Math.sin(t * 12) * 0.09 + Math.sin(t * 7.3 + 1) * 0.05 + Math.sin(t * 23.1) * 0.04;
  const flare = m.flareT > 0 ? clamp(m.flareT / 0.45, 0, 1) : 0;
  const br = Math.sin(t * 1.6), aggro = st !== 'idle';
  const T = {
    legPhase: m.phase, stride: walking ? 1 : 0, stance: 0, legShift: 0, lean: Math.sin(t * 0.9) * 2 + br * 0.6, bend: br * 1.8 + Math.sin(t * 0.5 + 2) * 1.2, shift: 0, bob: 0, sx: 1 + br * 0.012, sy: 1 + br * 0.025, shake: 0, ph: t,
    headTilt: 3 + Math.sin(t * 0.7) * 4 + br * 2 + (m.backT > 0 ? -9 : 0), headX: 0, headY: br * 0.35, eyeK: 1 + Math.sin(t * 2.3) * 0.12 + flare * 0.5, eyeHot: flare * 0.5, look: aggro ? 0.7 : m.lookTo, daze: 0,
    handX: Math.sin(t * 1.3 + 1) * 0.4, handY: Math.sin(t * 1.6) * 0.8 - br * 0.3, poleA: -25 + Math.sin(t * 1.1) * 4 + Math.sin(t * 0.37) * 3.5 + br * 1.5, flame: flick * gut * (1 + flare * 0.4), glowK: 1 + flare * 0.4,
    trail: 0, trailA: P.poleA, sparks: 0, sparkPh: m.sparkPh, stars: 0, rush: 0,
  };
  if (m.lostT < 1.2) { const k = 1 - m.lostT / 1.2; T.headTilt += 6 * k; T.handY += 1.5 * k; T.poleA -= 6 * k; } // it loses interest: the head droops, the lamp sinks
  if (st === 'swing_tele') {
    // the wind-up, keyed to the game's 0.42 s timer so the whip lands on the frame the swing starts: it leans back, hoists the lamp high
    // over its shoulder, braces its feet wide, the embers go red and the whole body quivers harder and harder
    const k = clamp(e.t / T_STELE, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { lean: -2, bend: -2, shift: -0.5, stance: 0.2, handX: 0, handY: -1, poleA: -40, eyeHot: 0.4, eyeK: 1.5, flame: 1.1, glowK: 1.1, headTilt: -2, sx: 1, sy: 1 }],
      [0.4, { lean: -9, bend: -9, shift: -1.6, stance: 0.6, handX: -2.5, handY: -7, poleA: -98, eyeHot: 0.85, eyeK: 1.6, flame: 1.35, glowK: 1.3, headTilt: -9, sx: 0.98, sy: 1.03 }, 'outBack'],
      [0.85, { lean: -12, bend: -13, shift: -2.2, stance: 0.7, handX: -3.2, handY: -8, poleA: -112, eyeHot: 1, eyeK: 1.8, flame: 1.5, glowK: 1.45, headTilt: -11, sx: 0.97, sy: 1.05 }, 'inOutQuad'],
      [1, { lean: -14, bend: -15, shift: -2.8, stance: 0.75, handX: -3.6, handY: -8.4, poleA: -120, eyeHot: 1, eyeK: 1.95, flame: 1.6, glowK: 1.6, headTilt: -12, sx: 0.96, sy: 1.07 }, 'inQuad'],
    ]));
    T.shake = 0.3 + k * 0.9; T.look = 1; T.stride = 0; T.flame *= flick; T.ph = t;
  } else if (st === 'swing') {
    // the swing, keyed to the 0.6 s timer: the pole has already been kicked by the impulse; the target leads it through the front during the hitbox
    // window (the first 0.18 s) with a glowing trail and embers, the body follows through, then everything settles back into the guard
    const k = clamp(e.t / T_SWING, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { lean: -10, bend: -10, shift: -2, stance: 0.75, handX: -3, handY: -7, poleA: 60, eyeHot: 1, eyeK: 1.9, flame: 1.6, glowK: 1.6, headTilt: -6, sx: 1, sy: 1.04, trail: 1 }],
      [0.12, { lean: 14, bend: 18, shift: 2, stance: 0.6, handX: 3, handY: 2, poleA: 62, eyeHot: 0.9, eyeK: 1.6, flame: 1.5, glowK: 1.5, headTilt: 10, sx: 1.06, sy: 0.96, trail: 1 }, 'outCubic'],
      [0.35, { lean: 10, bend: 12, shift: 1.2, stance: 0.5, handX: 2.5, handY: 1.5, poleA: 48, eyeHot: 0.6, eyeK: 1.3, flame: 1.3, glowK: 1.3, headTilt: 6, sx: 1.02, sy: 0.99, trail: 0 }, 'outQuad'],
      [1, { lean: 0, bend: 0, shift: 0, stance: 0, handX: 0, handY: 0, poleA: -25, eyeHot: 0.15, eyeK: 1.05, flame: 1, glowK: 1, headTilt: 3, sx: 1, sy: 1, trail: 0 }, 'inOutQuad'],
    ]));
    T.trailA = lerp(P.trailA, P.poleA, Math.min(1, dt * 6)); T.stride = 0; T.look = 1; T.flame *= flick;
  } else if (st === 'lunge_tele') {
    // the coil, keyed to the 0.38 s timer: it drops into a crouch and draws its weight back over the rear foot, the lamp hand pulled in to the chest
    // so the pole levels at Mote like a lance, the head low and thrust toward its prey, embers red, a quiver building (distinct from the swing's high hoist)
    const k = clamp(e.t / T_LTELE, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { lean: -2, bend: -1, shift: -0.5, bob: -0.6, stance: 0.3, handX: -1, handY: 0, poleA: -20, eyeHot: 0.4, eyeK: 1.5, flame: 1.1, glowK: 1.1, headTilt: 4, headX: 0.3, sx: 1, sy: 1 }],
      [0.45, { lean: -10, bend: -4, shift: -2.4, bob: -2.4, stance: 0.9, handX: -4.6, handY: 0.6, poleA: -4, eyeHot: 0.85, eyeK: 1.6, flame: 1.35, glowK: 1.3, headTilt: 12, headX: 1.2, sx: 1.05, sy: 0.93 }, 'outBack'],
      [0.85, { lean: -12, bend: -5, shift: -3, bob: -3, stance: 1, handX: -5.2, handY: 0.8, poleA: -2, eyeHot: 1, eyeK: 1.8, flame: 1.5, glowK: 1.45, headTilt: 14, headX: 1.5, sx: 1.06, sy: 0.91 }, 'inOutQuad'],
      [1, { lean: -14, bend: -6, shift: -3.6, bob: -3.4, stance: 1.05, handX: -5.6, handY: 1, poleA: 0, eyeHot: 1, eyeK: 1.95, flame: 1.6, glowK: 1.6, headTilt: 15, headX: 1.8, sx: 1.07, sy: 0.9 }, 'inQuad'],
    ]));
    T.shake = 0.25 + k * 0.8; T.look = 1; T.stride = 0; T.flame *= flick; T.ph = t;
  } else if (st === 'lunge') {
    // the lunge, keyed to the 0.32 s timer at 250: stretched long and low, feet trailing, the lamp out ahead, streaks and after-images behind it
    const k = clamp(e.t / T_LUNGE, 0, 1), sk = clamp(Math.abs(vx) / LUNGE_V, 0, 1.2);
    Object.assign(T, Anim.keys(k, [
      [0, { lean: 22, bend: 14, shift: 3, bob: -1, legShift: -4, stance: 0.3, handX: 3.5, handY: -1, poleA: 6, eyeHot: 1, eyeK: 1.6, flame: 1.5, glowK: 1.5, headTilt: 14, headX: 1.8, sx: 1.18, sy: 0.9, rush: 1 }],
      [0.7, { lean: 20, bend: 12, shift: 2.5, bob: -0.6, legShift: -3.5, stance: 0.35, handX: 3, handY: -0.6, poleA: 10, eyeHot: 1, eyeK: 1.5, flame: 1.4, glowK: 1.4, headTilt: 12, headX: 1.5, sx: 1.15, sy: 0.91, rush: 1 }, 'outQuad'],
      [1, { lean: 16, bend: 8, shift: 1.5, bob: 0, legShift: -2.5, stance: 0.4, handX: 2, handY: 0, poleA: 14, eyeHot: 0.9, eyeK: 1.4, flame: 1.3, glowK: 1.3, headTilt: 10, headX: 1, sx: 1.1, sy: 0.94, rush: 0.8 }, 'inQuad'],
    ]));
    T.stride = 0; T.look = 1; T.rush *= sk; T.flame *= flick; T.ph = t;
    m.ghostT += dt; if (sk > 0.4 && m.ghostT > 0.034) { m.ghostT = 0; pup.ghost(cx, feet, 0.22, 0.32); }
  } else if (st === 'stagger') {
    // the reel, keyed to the 0.9 s timer: knocked back onto braced legs, the lamp flailing on its spring, the head lolling, the embers sputtering
    // and dim with motes circling the hood; near the end it gathers itself, just before the game sends it walking again
    const k = clamp(e.t / T_STAGGER, 0, 1), w = Math.sin(t * 7.5) * (1 - k) * k * 5;
    Object.assign(T, Anim.keys(k, [
      [0, { lean: -18, bend: -10, bob: -0.6, stance: 0.7, sx: 1.04, sy: 0.96, handX: -1, handY: 1, poleA: -48, headTilt: -16, headY: 0.4, daze: 0.5, stars: 0, eyeK: 0.8, glowK: 0.7, shift: -1 }],
      [0.2, { lean: -32, bend: -16, bob: -1.8, stance: 1, sx: 1.07, sy: 0.93, handX: -2, handY: 3, poleA: -64, headTilt: -24, headY: 0.8, daze: 1, stars: 1, eyeK: 0.7, glowK: 0.55, shift: -2.5 }, 'outBack'],
      [0.62, { lean: -16, bend: -7, bob: -1.4, stance: 0.9, sx: 1.04, sy: 0.96, handX: -0.5, handY: 2, poleA: -40, headTilt: -8, headY: 0.5, daze: 1, stars: 1, eyeK: 0.75, glowK: 0.6, shift: -1 }, 'inOutQuad'],
      [0.86, { lean: -5, bend: 0, bob: -0.4, stance: 0.4, sx: 1.01, sy: 0.99, handX: 0, handY: 0.5, poleA: -30, headTilt: 2, headY: 0.2, daze: 0.5, stars: 0.4, eyeK: 1, glowK: 0.85, shift: 0 }, 'inQuad'],
      [1, { lean: 2, bend: 2, bob: 0.3, stance: 0, sx: 1, sy: 1, handX: 0, handY: 0, poleA: -25, headTilt: 0, headY: 0, daze: 0, stars: 0, eyeK: 1.1, glowK: 1, shift: 0 }, 'outBack'],
    ]));
    T.lean += w * 2.2; T.bend += w * 1.5; T.headTilt += w * 4; T.poleA += Math.sin(t * 6.3) * 32 * (1 - k * k); T.handY += Math.sin(t * 6.3 + 1) * 1.8 * (1 - k * k); T.handX += Math.sin(t * 4.8) * 1.2 * (1 - k);
    T.look = 0; T.eyeHot = 0; T.flame = flick * (0.55 + 0.3 * k) * (0.7 + 0.3 * Math.sin(t * 31)); T.ph = t;
    // the feet scrabble backwards under the reeling body for the first half: the stride cycle runs in reverse at a stumble's pace
    if (k < 0.5) { m.phase -= 2.6 * TAU * dt; if (m.phase < 0) m.phase += TAU; T.legPhase = m.phase; T.stride = 0.45 * (1 - k * 2); } else T.stride = 0;
    open = Math.min(open, k < 0.8 ? 0.45 + 0.4 * Math.sin(t * 27) * Math.sin(t * 13) : open);
    if (k > 0.86 && k < 0.95) { T.headTilt += Math.sin(t * 42) * 7; T.handX += Math.sin(t * 42) * 0.6; } // the shake-off
  } else if (walking) {
    // the tread: heavy, the body lifting as each leg passes under it and dropping on the footfalls (those are impulses), rocking fore and aft,
    // hunched into the direction of travel, the lamp held a little ahead and bouncing a beat behind the body
    const ph = m.phase, k = clamp(sp / (SPEED / s), 0, 1.3);
    T.bob = (0.5 - 0.5 * Math.cos(2 * ph)) * 1.3 * k; T.lean += (4 + Math.cos(2 * ph + 0.4) * 2) * fwd * k; T.bend += (3 + Math.cos(2 * ph + 1) * 2.5) * fwd * k;
    T.headTilt += (5 + Math.sin(2 * ph - 1) * 2.5) * k; T.poleA += (3 + Math.sin(2 * ph - 1.4) * 5) * k; T.handX += 0.6 * fwd * k; T.handY += Math.sin(2 * ph - 0.8) * 0.5 * k;
    if (m.endT < 0.8) { const r = 1 - m.endT / 0.8; T.lean -= 9 * r; T.bend -= 5 * r; T.stance = 0.6 * r; T.headTilt -= 8 * r; T.eyeHot = Math.max(T.eyeHot, 0.7 * r); T.eyeK = Math.max(T.eyeK, 1.5 - 0.4 * (1 - r)); T.rush = 0; T.stride = 0.4 + 0.6 * (1 - r); } // skidding out of a lunge
  } else {
    if (m.endT < 0.8) { const r = 1 - m.endT / 0.8; T.lean -= 9 * r; T.stance = 0.6 * r; T.headTilt -= 8 * r; T.eyeHot = Math.max(T.eyeHot, 0.7 * r); }
    if (m.hitT < 0.5) { const r = 1 - m.hitT / 0.5; T.stance = Math.max(T.stance, 0.5 * r); T.lean -= 4 * r; }
  }
  if (m.hitT < 0.6 && st !== 'stagger') { const r = 1 - m.hitT / 0.6; T.eyeHot = Math.max(T.eyeHot, 0.6 * r); T.eyeK = Math.max(T.eyeK, 1.3); T.look = -0.3 * r + T.look * (1 - r); }
  if (m.alertT < 0.5) { const r = 1 - m.alertT / 0.5; T.eyeHot = Math.max(T.eyeHot, 0.6 * r); }
  // weight: lean into acceleration and back on braking (the launches are impulses, so the filter ignores jolts)
  if (st === 'walk' || st === 'idle') T.lean += clamp(m.ax * fwd / 500, -1, 1) * 6;
  T.eyeOpen = open;
  m.sparkPh = (m.sparkPh + dt * (1.2 + T.flame * 0.6)) % 1; T.sparkPh = m.sparkPh; m.burst = Math.max(0, m.burst - dt * 3.2); T.sparks = clamp(m.burst, 0, 1);
  pup.target(T);
  // ---- secondary motion: the coat tail streams behind the body, the cowl tail whips with the head; both hang still when it stands
  const vxs = vx / s; const angular = ((V.lean || 0) + (V.bend || 0)) * 0.08;
  hem.update(dt, { vx: vxs * 0.5, vy: 0, facing: fac, gravity: 44, drag: 0.5, stiff: walking ? 4 : 7, damp: 0.86, wind: { x: Math.sin(t * 2.1) * 3 * (walking ? 0 : 1) - angular * 2 - (V.shift || 0) * 1.5, y: Math.cos(t * 1.7) * 2 } });
  cowl.update(dt, { vx: vxs * 0.45, vy: 0, facing: fac, gravity: 40, drag: 0.5, stiff: walking ? 4 : 6, damp: 0.86, wind: { x: Math.sin(t * 2.4 + 1) * 3 * (walking ? 0 : 1) - angular * 3 - (V.headTilt || 0) * 0.12, y: Math.cos(t * 1.9) * 2 - (V.headY || 0) * 2 } });
  for (const p of m.puffs) if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, dt * 3); p.vy -= dt * 5; }
}

// world-space dust under the boots: puffs left where the feet came down and where it launched or hit the wall
function before(ctx, e, pup) {
  const ps = pup.mem.puffs; if (!ps) return;
  let any = false; for (const p of ps) if (p.life > 0) { any = true; break; } if (!any) return;
  ctx.save();
  for (const p of ps) { if (p.life <= 0) continue; const k = p.life / p.max; ctx.globalAlpha = 0.36 * k; ctx.fillStyle = DUST; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.3 - k * 0.6) + (1 - k) * 2.2, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// the lantern's light on the world, following the lamp wherever the pole has swung, breathing with the flame (the old 12 Hz flicker lives in P.flame)
function after(ctx, e, pup) {
  const P = pup.P, s = pup.scale || SCALE, fl = clamp(P.flame, 0, 1.6) * clamp(P.glowK, 0, 1.6); if (fl < 0.03) return;
  const [lx, ly] = lampPoint(P); const flip = e.facing < 0 ? -1 : 1;
  const wx = e.x + e.w / 2 + (lx - W / 2) * s * flip, wy = e.y + e.h + (ly - H) * s; const r = (9 + 5 * fl) * s;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(wx, wy, 0, wx, wy, r); gr.addColorStop(0, `rgba(255,179,71,${(0.3 * Math.min(1.5, fl)).toFixed(3)})`); gr.addColorStop(0.5, `rgba(255,179,71,${(0.1 * Math.min(1.5, fl)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,179,71,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(wx, wy, r, 0, TAU); ctx.fill();
  ctx.restore();
}

module.exports = { name: 'husk', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, before, after };
