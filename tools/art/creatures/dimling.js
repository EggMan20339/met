// Dimling: a squat beetle carrying a lantern bulb it can no longer light. It plods along ledges on six jointed legs
// (a tripod scuttle whose rate comes from its speed), turns at edges with a little hop and an antenna whip, and when
// struck it skids with its legs splayed, its head tucked and a last spark jolted out of the dead bulb. See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, circ, ell, stroke, g, rot, tr, glowEye, mix, clamp, num: n } = L;
const W = 26, H = 20, PX = 13, PY = 19; // template box; the body pivots (lean, squash) about the ground centre
const INK = '#1a1526', INK2 = '#2a2238', LINE = '#120e1c', EMBER = '#ffb347', FAR = '#241c33';
const SPEED = 34, SCALE = 0.65, STRIDE = 3, TAU = Math.PI * 2, DEG = Math.PI / 180; // SPEED: ENEMY_DEFS.e.speed, SCALE: ART_SCALE.dimling
// six legs in three stations (back, middle, front); each station has a far and a near leg half a cycle apart (tripod gait)
const LEGS = [ // [hip x, foot rest x, phase offset, knee/splay direction, colour]
  [7, 4.8, Math.PI, -1, FAR], [7, 4.8, 0, -1, INK],
  [12.4, 12.4, 0, -1, FAR], [12.4, 12.4, Math.PI, 1, INK],
  [17.8, 20, Math.PI, 1, FAR], [17.8, 20, 0, 1, INK],
];
const BODY = lin('db', 4, 4, 22, 18, [[0, '#3d3352'], [0.5, '#2a2238'], [1, '#1a1526']]);
const GLASS = rad('dg', 13, 7, 6, [[0, '#ffd27a', 0.55], [0.7, '#c08a3c', 0.3], [1, '#5a4020', 0.6]]);

const params = {
  legPhase: 0, stride: 0, splay: 0,        // gait phase (radians), stride amplitude 0..1, legs spread wide 0..1 (hurt)
  gLift: 0, gLean: 0, gHead: 0, gTilt: 0,  // walk-cycle body lift, body lean (deg), head bob, head nod (deg): written directly, no spring
  lean: 0, sx: 1, sy: 1, bob: 0,           // body tilt (deg, + nose down), squash/stretch about the feet, body lift
  headOut: 0, headBob: 0, headTilt: 0,     // head pushed forward (-1 tucked .. 1 craned), head up/down, head nod (deg, + nose down)
  antA: 0, antB: 0,                        // antenna base and tip swing (deg; negative sweeps back, positive flops forward)
  eye: 1, eyeK: 1, hurt: 0, bulb: 0.06,    // eye size (blinks dim), eye halo, hurt flare 0..1, bulb light 0..1 (dead at 0.06)
};
// [stiffness, damping ratio]; the gait values (legPhase, g*) and the sputtering bulb snap
const springs = {
  stride: [140, 0.75], splay: [260, 0.5], lean: [240, 0.45], sx: [380, 0.45], sy: [380, 0.45], bob: [300, 0.5],
  headOut: [180, 0.6], headBob: [220, 0.45], headTilt: [260, 0.4], antA: [700, 0.35], antB: [450, 0.28],
  eye: [700, 0.9], eyeK: [80, 1], hurt: [140, 1],
};
// stills: art/dimling_<pose>.svg (a and b are the old walk pair; the rest are new readable poses)
const poses = {
  a: { stride: 1, legPhase: 0, gLift: 0.3 }, b: { stride: 1, legPhase: Math.PI, gLift: 0.3 },
  idle: {},
  hurt: { splay: 1, stride: 0.3, lean: 14, sx: 1.18, sy: 0.8, headTilt: 24, headOut: -0.7, headBob: 0.8, eye: 1.4, hurt: 1, bulb: 0.9, antA: 30, antB: 40 },
  spark: { bulb: 1, eye: 1.1, eyeK: 1.3, headOut: 0.4 },
};

function make(P) {
  const lift = P.bob + P.gLift, lean = P.lean + P.gLean; const c = Math.cos(lean * DEG), s = Math.sin(lean * DEG);
  // where a point of the body ends up after the body's own transform, so the hips stay attached while the feet stay on the ground
  const hipX = (x, y) => PX + (x - PX) * P.sx * c - (y - PY - lift) * P.sy * s, hipY = (x, y) => PY + (x - PX) * P.sx * s + (y - PY - lift) * P.sy * c;
  // legs: hip (hidden under the shell) -> knee just outside the shell's rim -> foot; the foot swings on a cycle and lifts on its
  // forward swing, splayed legs spread outward and the knees come up
  const legs = LEGS.map(([hx0, rx, po, sd, col]) => {
    const p = P.legPhase + po; const hx = hipX(hx0, 15.4), hy = hipY(hx0, 15.4);
    const fx = rx + STRIDE * P.stride * Math.cos(p) + P.splay * sd * 3.4, fy = PY - Math.max(0, -Math.sin(p)) * 2.6 * P.stride - P.splay * 1.6;
    const kx = hx + sd * (1.6 + P.splay * 2.6) + (fx - hx) * 0.35, ky = hy + 2.2 - P.splay * 2.4 - (PY - fy) * 0.5;
    return stroke(`M${n(hx)} ${n(hy)} L${n(kx)} ${n(ky)} L${n(fx)} ${n(fy)}`, col, 1.6);
  });
  const shadow = ell(13, 19.2, 8.5, 1.1, LINE, { opacity: 0.16 });
  // the bulb: its glass, a filament that is barely there and a light that only shows when it sputters (quantised so the
  // gradient cache is not thrashed by every flicker value)
  const b = Math.round(clamp(P.bulb, 0, 1) * 20) / 20;
  const glass = path('M8.5 9 C9 4 17 4 17.5 9 Z', GLASS, { stroke: '#6a5028', strokeWidth: 0.7 });
  const filament = circ(13, 7.9, 0.55 + b * 0.9, '#fff1c8', { opacity: 0.25 + b * 0.75 });
  const light = b > 0.06 ? circ(13, 7.6, 4.5 + b * 3, rad('dl', 13, 7.6, 4.5 + b * 3, [[0, '#ffd27a', 0.7 * b], [0.5, EMBER, 0.3 * b], [1, EMBER, 0]])) : null;
  // the head: glowing pupil-less eyes that dim to blink and flare when hurt, and a two-joint antenna
  const ec = P.hurt > 0.01 ? mix(EMBER, '#fff0c8', P.hurt * 0.7) : EMBER; const ek = P.eyeK * (0.6 + P.eye * 0.4) + P.hurt * 0.8;
  const a1 = (-58 + P.antA) * DEG, a2 = a1 + (-42 + P.antB) * DEG;
  const mx = 23.4 + Math.cos(a1) * 3.3, my = 10.6 + Math.sin(a1) * 3.3, tx = mx + Math.cos(a2) * 2.8, ty = my + Math.sin(a2) * 2.8;
  const head = g([
    circ(22, 13.5, 3.4, INK2, { stroke: LINE, strokeWidth: 0.8 }),
    glowEye(23.2, 12.6, 0.9 * P.eye, ec, ek), glowEye(21.2, 14.2, 0.7 * P.eye, ec, ek),
    stroke(`M23.4 10.6 Q${n(mx)} ${n(my)} ${n(tx)} ${n(ty)}`, INK2, 0.8),
  ], { transform: `${tr(P.headOut * 1.3, P.headBob + P.gHead)} ${rot(P.headTilt + P.gTilt, 19.6, 13.8)}` });
  const body = g([
    ell(13, 12, 10, 6, BODY, { stroke: LINE, strokeWidth: 0.9 }),
    stroke('M13 6.5 L13 17.5', LINE, 0.8, { opacity: 0.7 }),
    glass, filament, light,
    stroke('M5 9.5 C7 6.5 10 5.6 12 5.6', '#6a5c86', 0.9, { opacity: 0.8 }),
    head,
  ], { transform: `${tr(PX, PY)} ${rot(lean)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-PX, -PY - lift)}` });
  return svg(W, H, [shadow, legs, body]);
}

// ---- animation: from the enemy's state (walk / hurt, see updateEnemy case 'e') to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.facing = e.facing; m.state = e.state; m.hp = e.hp; m.phase = Math.random() * TAU; m.t0 = Math.random() * 10; m.knock = -1;
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.fidget = 1.5 + Math.random() * 3; m.lookT = 0; m.lookA = 0; m.sput = 2 + Math.random() * 5; m.sputT = 0; m.sputK = 0;
  }
  const t = pup.time + m.t0, vx = e.vx, hurt = e.state === 'hurt';
  // ---- events, found by watching the state change
  const turned = e.facing !== m.facing, hurtStart = hurt && m.state !== 'hurt', hit = e.hp < m.hp;
  m.facing = e.facing; m.state = e.state; m.hp = e.hp;
  if (hurtStart || hit) { // which way it is being shoved, relative to the way it faces: -1 backwards (the usual), +1 forwards
    const kn = m.knock = (Math.sign(vx) || -1) * e.facing;
    pup.impulse('lean', -420 * kn).impulse('sy', -5).impulse('sx', 3.5).impulse('splay', 10).impulse('headTilt', -500 * kn).impulse('antA', -700 * kn).impulse('antB', -900 * kn);
    m.sputT = 0.45; m.sputK = 1; m.blinkT = 0; // the jolt knocks a spark out of the dead bulb
  }
  if (turned && !hurt) pup.impulse('sx', -4).impulse('sy', 3).impulse('bob', 16).impulse('antA', 520).impulse('antB', 600).impulse('headTilt', 260).impulse('stride', -5);
  // ---- legs: the cycle advances with distance covered (feet stay planted); hurt, it scrabbles in the air
  const walking = !hurt && Math.abs(vx) > 4;
  m.phase += (walking ? Math.abs(vx) / SCALE / (4 * STRIDE) * TAU : hurt ? 38 : 0) * dt; if (m.phase > TAU) m.phase -= TAU;
  const ph = m.phase, gait = pup.P.stride, fwd = turned ? 1 : Math.sign(vx) * e.facing || 1;
  // ---- idle life: blinks, bulb sputters, fidgets (an antenna twitch, a look around, a small hop)
  m.blink -= dt; if (m.blink < 0) { m.blink = 2 + Math.random() * 4; m.blinkT = 0.13; }
  if (m.blinkT > 0) m.blinkT -= dt;
  m.sput -= dt; if (m.sput < 0) { m.sput = 2.5 + Math.random() * 6; m.sputT = 0.25 + Math.random() * 0.4; m.sputK = 0.35 + Math.random() * 0.5; }
  let bulb = 0.06 + Math.sin(t * 1.7) * 0.03;
  if (m.sputT > 0) { m.sputT -= dt; bulb += m.sputK * clamp(0.35 + Math.sin(t * 57) * Math.sin(t * 23) + Math.sin(t * 131) * 0.5, 0, 1); }
  m.fidget -= dt; if (m.fidget < 0) {
    m.fidget = 1.5 + Math.random() * 4; const r = Math.random();
    if (r < 0.45) pup.impulse('antB', 800).impulse('antA', -250); else if (r < 0.8 || walking) { m.lookT = 0.6 + Math.random() * 0.6; m.lookA = -10 + Math.random() * 24; } else pup.impulse('bob', 9).impulse('sy', 1.5);
  }
  if (m.lookT > 0) m.lookT -= dt;
  const T = { legPhase: ph, bulb, hurt: 0, splay: 0, stride: walking ? 1 : 0, eye: m.blinkT > 0 ? 0.15 : 1, eyeK: 1 + Math.sin(t * 3.1) * 0.25, headTilt: m.lookT > 0 ? m.lookA : 0, gLift: 0, gLean: 0, gHead: 0, gTilt: 0 };
  if (hurt) {
    // the flinch clip is keyed to the game's own hurt timer (0.3 s) so the recovery lands when it starts walking again
    const kn = m.knock, k = clamp((e.t2 || 0) / 0.3, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { splay: 1, lean: -18 * kn, sx: 1.24, sy: 0.76, headTilt: -26 * kn, headOut: -0.8, headBob: 1, bob: 0, eye: 1.5, hurt: 1 }],
      [0.55, { splay: 0.9, lean: -10 * kn, sx: 1.12, sy: 0.86, headTilt: -14 * kn, headOut: -0.4, headBob: 0.5, bob: 0, eye: 0.5, hurt: 1 }, 'outQuad'],
      [1, { splay: 0, lean: 0, sx: 1, sy: 1, headTilt: 0, headOut: 0.3, headBob: 0, bob: 0.4, eye: 1, hurt: 0 }, 'outBack'],
    ]));
    T.stride = 0.3; T.antA = -30 * kn + Math.sin(t * 40) * 6; T.antB = -40 * kn;
  } else if (walking) {
    // the plod: the body rides up when the legs pass under it, dips as they spread, and the nose leads; the head bobs a beat behind
    const sp = Math.sin(ph), s2 = Math.cos(2 * ph);
    Object.assign(T, { lean: 2 * fwd, bob: 0.6, sx: 1, sy: 1, headOut: 1, headBob: 0, antA: -10 * fwd + Math.sin(t * 2.3) * 3, antB: -8 * fwd,
      gLift: (0.5 - 0.5 * s2 + 0.3 * sp) * gait, gLean: (1.2 - 1.8 * s2) * fwd * gait, gHead: -0.6 * Math.sin(ph - 0.7) * gait, gTilt: 5 * Math.sin(ph - 1.1) * fwd * gait });
  } else {
    Object.assign(T, { lean: 0, bob: Math.sin(t * 2.4) * 0.15, sx: 1 + Math.sin(t * 2.4) * 0.012, sy: 1 + Math.sin(t * 2.4) * 0.02, headOut: 0.2, headBob: Math.sin(t * 2.4 + 0.8) * 0.2, antA: Math.sin(t * 1.9) * 5, antB: Math.sin(t * 2.7 + 1) * 6 });
  }
  // ---- secondary motion: the antenna swings against whatever the head and body are doing, and lags on its soft springs
  T.antA += -(pup.V.headBob || 0) * 0.25 - (pup.V.lean || 0) * 0.06 - T.gHead * 10; T.antB += -(pup.V.headBob || 0) * 0.4 - (pup.V.headTilt || 0) * 0.08 - T.gTilt * 1.5;
  pup.target(T);
}

// world-space lantern light: only when the bulb sputters (a hit, or its own rare flicker); drawn under the body with 'lighter'
function before(ctx, e, pup) {
  const b = pup.P.bulb; if (b < 0.12) return;
  const s = pup.scale || SCALE; const x = e.x + e.w / 2, y = e.y + e.h - (PY - 7.6 + pup.P.bob + pup.P.gLift) * s, r = (12 + b * 12) * s;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gg = ctx.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(255,210,122,${(0.45 * b).toFixed(3)})`); gg.addColorStop(1, 'rgba(255,210,122,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}

module.exports = { name: 'dimling', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, before };
