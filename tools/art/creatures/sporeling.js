// Sporeling: a puffball on a stalk that spits what it swallowed.
//
// It never moves (src/entities.js case 's'): it stands, breathes, sways on its stalk and sheds spores from the top of
// its cap until Mote is in range, then holds 'charge' for 0.6 s and at e.t > 0.6 the game spawns the spore and drops it
// back to 'idle'. make(P) is a pure drawing of the parameters; control() reads the entity every frame: the charge is a
// clip keyed to e.t (the cap swells and brightens, the mouth gapes and lights up, the stalk rears back, the spores above
// are sucked in, a quiver builds), the charge->idle transition is the spit frame (the cap lunges forward on impulses,
// deflates with a snap, puffs dust from the mouth and settles on its springs), a hit whips the stalk and sets the eye
// wandering, and with one petal of health left it droops. See art/ANIMATION.md.
const L = require('../lib');
const { svg, rad, path, ell, circ, stroke, g, rot, tr, mix, clamp, lerp, num: n } = L;
const W = 24, H = 28, SX = 12, SY = 15, BX = 12, BY = 27; // template box; the stalk top (the cap pivots and inflates about it) and the stalk root
const SCALE = 0.7; // world units per template unit (ART_SCALE.sporeling), for the world-space glows in before()
const TAU = Math.PI * 2;
const CAP = '#243a1e', MOUTH = '#1a2612', SPORE = '#c8ff5a', DUST = '#dfffa0', LEAF = '#3d6a2f';
const SPOTS = [[7, 7, 1.3], [15.5, 6, 1.1], [17, 12, 0.9], [9, 14, 0.8]];
const SPORES = [[0, -3.6, 1], [0.37, 1.4, 0.85], [0.66, -0.6, 0.75], [0.19, 3.8, 0.7], [0.83, -2, 0.65]]; // phase offset, x offset from the cap top, radius
const LEAF_L = 'M12 25 C7 25 4 22 3 19 C7 19 10 21 12 25 Z', LEAF_R = 'M12 25 C17 25 20 22 21 19 C17 19 14 21 12 25 Z';
// the cap's paint at 21 brightness steps, built once: the gradient, the pore colour and the halo behind the cap
const GLOWS = Array.from({ length: 21 }, (_, i) => { const gk = i / 20; return {
  cap: rad('sc', 10, 9, 9, [[0, mix('#a8c86a', '#e6ff9a', gk)], [0.6, mix('#5f8a3a', '#9ac84a', gk)], [1, mix('#2f4a26', '#3f6a2e', gk)]]),
  spot: mix('#dff5b0', '#f4ffcc', gk), halo: gk > 0.2 ? circ(0, -4.5, 9 + gk * 5, rad('sh', 0, -4.5, 9 + gk * 5, [[0, SPORE, 0.2 * (gk - 0.2)], [1, SPORE, 0]])) : null,
}; });

const params = {
  bend: 0, tilt: 0, lift: 0,      // stalk top pushed sideways (template units, + toward the side it faces), cap tilt (deg, + nods the mouth forward and down), stalk stretch
  sx: 1, sy: 1,                   // cap inflation about its base (the stalk top)
  leaf: 0,                        // leaf lift in degrees (+ tips up, bracing; - flopped)
  mouth: 0, mouthGlow: 0,         // mouth gape 0..1 and the light inside it 0..1
  glowK: 0.12,                    // cap brightness 0..1: colour, spots, eye halo, rim light, the halo behind the cap
  eyeOpen: 1, look: 0.7, squint: 0, dizzy: 0, // eye lid, glance (+ forward, toward the player it faces), narrowing, a wandering stare after a hit
  spore: 0.5, inhale: 0, sph: 0,  // spore shedding 0..1.5, spores drawn back into the cap 0..1, the spores' drift phase
  shake: 0, ph: 0,                // telegraph quiver amplitude and a free clock for it
  puff: 0,                        // dust puffed from the mouth, 1 fresh .. 0 gone
};
// [stiffness, damping ratio] for the values that overshoot and settle; the rest (clocks, blinks, cloud amounts) snap
const springs = {
  bend: [130, 0.32], tilt: [210, 0.38], lift: [260, 0.5], sx: [320, 0.45], sy: [320, 0.45], leaf: [230, 0.33],
  mouth: [380, 0.5], mouthGlow: [120, 1], glowK: [90, 1], look: [160, 0.8], squint: [220, 0.8], dizzy: [120, 1],
};
// stills exported to art/sporeling_<pose>.svg (idle and charge are the originals; spit and hurt are new)
const poses = {
  idle: {},
  charge: { sx: 1.18, sy: 1.24, mouth: 1, mouthGlow: 1, glowK: 1, bend: -2.4, tilt: -12, lift: 1.2, leaf: 24, inhale: 0.8, squint: 0.5, look: 0.9, spore: 1.2 },
  spit: { bend: 3.5, tilt: 16, sx: 1.06, sy: 0.9, mouth: 0.9, mouthGlow: 0.3, glowK: 0.5, puff: 0.75, spore: 1.4, leaf: -22, eyeOpen: 0.2, lift: -1 },
  hurt: { bend: -4, tilt: -20, sx: 1.12, sy: 0.84, leaf: -30, eyeOpen: 0.3, squint: 0.5, dizzy: 1, lift: -2.2, spore: 1.1 },
};

function make(P) {
  const gi = Math.round(clamp(P.glowK, 0, 1) * 20), gk = gi / 20, G = GLOWS[gi]; // quantised so the paint is not rebuilt for every flicker
  const tx = SX + P.bend, ty = SY - P.lift; // where the stalk top is
  const shadow = ell(BX, BY + 0.2, 7, 1.1, '#000000', { opacity: 0.16 });
  const leaves = [path(LEAF_L, LEAF, { transform: rot(P.leaf, 12, 25) }), path(LEAF_R, LEAF, { transform: rot(-P.leaf, 12, 25) })];
  // the stalk bows toward wherever the top has been pushed
  const stalkD = `M${BX} ${BY} C${n(BX + P.bend * 0.15)} ${n(BY - 5)} ${n(tx - P.bend * 0.35)} ${n(ty + 4)} ${n(tx)} ${n(ty)}`;
  const stalk = [stroke(stalkD, '#4f7a3a', 3.2), stroke(stalkD, '#7fae5a', 1.2, { opacity: 0.6 })];
  // the cap: a gradient ball that brightens as it charges, pores that glow, a mouth that gapes and lights up, one glowing eye
  const mo = clamp(P.mouth, 0, 1.3), open = clamp(P.eyeOpen * (1 - clamp(P.squint, 0, 1) * 0.65), 0, 1), dz = clamp(P.dizzy, 0, 1);
  const ex = 13.6 + P.look * 0.45 + Math.sin(P.ph * 13) * 0.5 * dz, ey = 8.6 + Math.cos(P.ph * 13) * 0.4 * dz;
  const eye = [circ(ex, ey, 2 + gk * 1.2, SPORE, { opacity: 0.22 + gk * 0.25 }),
    open < 0.15 ? stroke(`M${n(ex - 1.2)} ${n(ey)} L${n(ex + 1.2)} ${n(ey)}`, SPORE, 0.8) : [ell(ex, ey, 1.1, 1.1 * open, SPORE), open > 0.45 ? circ(ex + 0.25, ey - 0.3 * open, 0.48, '#ffffff', { opacity: 0.85 }) : null]];
  const mouth = [ell(15, 12.5, 2.2 + mo * 1.9, 1.3 + mo * 2.5, MOUTH), P.mouthGlow > 0.02 ? [circ(15, 12.5, 0.5 + mo * 1.3, SPORE, { opacity: 0.85 * P.mouthGlow }), circ(15, 12.5, 0.25 + mo * 0.55, '#f4ffd0', { opacity: P.mouthGlow })] : null];
  const spots = SPOTS.map(([x, y, r]) => circ(x, y, r * (1 + gk * 0.3), G.spot, { opacity: 0.7 + gk * 0.2 }));
  const qx = P.shake * Math.sin(P.ph * 71), qy = P.shake * Math.cos(P.ph * 53); // the telegraph quiver
  const cap = g([
    ell(12, 11, 8, 7, G.cap, { stroke: CAP, strokeWidth: 0.9 }),
    stroke('M6.2 8.2 C7.2 5.4 9.8 4.2 12.6 4.1', '#ffffff', 1, { opacity: 0.14 + gk * 0.3 }),
    spots, mouth, eye,
  ], { transform: `${tr(tx + qx, ty + qy)} ${rot(P.tilt)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-SX, -SY)}` });
  // spores: they drift up off the top of the cap and fade, or are drawn back down into it while it charges
  const top = -11 * P.sy - 0.5, inh = clamp(P.inhale, 0, 1), sp = clamp(P.spore, 0, 1.6);
  const spores = sp > 0.03 ? SPORES.map(([o, ox, r]) => { const k = (P.sph + o) % 1; const y = lerp(top - k * 7.5, top - 8.5 + k * 8.5, inh), x = ox * (1 - inh * k) + Math.sin(k * 6.3 + o * 9) * 1.3 * (1 - inh);
    return circ(x, y, r * (0.7 + sp * 0.3), SPORE, { opacity: sp * (1 - k) * Math.min(1, k * 5) * 0.85 }); }) : null;
  // the puff of dust that leaves the mouth with the spore: a ring and a few motes flying forward, fading
  const pf = clamp(P.puff, 0, 1), e1 = 1 - pf, mx = 3 * P.sx, my = -2.5 * P.sy;
  const puff = pf > 0.02 ? [circ(mx + 2 + e1 * 6, my, 1 + e1 * 3.5, 'none', { stroke: DUST, strokeWidth: 0.7, opacity: pf * 0.5 }), circ(mx + 1 + e1 * 4, my - 0.5 - e1 * 1, 1.2 + e1 * 1.8, DUST, { opacity: pf * 0.3 }),
    circ(mx + 2.5 + e1 * 7, my - 2 - e1 * 3, 0.8, SPORE, { opacity: pf * 0.8 }), circ(mx + 2 + e1 * 6, my + 1.5 + e1 * 2.5, 0.65, SPORE, { opacity: pf * 0.8 })] : null;
  return svg(W, H, [shadow, G.halo ? g([G.halo], { transform: tr(tx, ty) }) : null, leaves, stalk, cap, g([spores, puff], { transform: tr(tx, ty) })]);
}

// ---- animation: from the enemy's state (idle / charge, see updateEnemy case 's') to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.state = e.state; m.hp = e.hp; m.flash = e.flash || 0; m.facing = e.facing; m.t0 = Math.random() * 10; m.sph = Math.random();
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.glance = 2 + Math.random() * 3; m.lookTo = 0.7; m.fidget = 2 + Math.random() * 4;
    m.spitT = 9; m.hitT = 9; m.kn = -1; m.puffT = 9; m.puffK = 0; m.burstT = 0;
  }
  const t = pup.time + m.t0, charging = e.state === 'charge', low = e.hp <= 1 ? 1 : 0;
  // ---- events, found by watching the state change: the spit (charge -> idle: the game just spawned the spore), the wind-up start, a hit, a turn
  const spit = m.state === 'charge' && !charging, wound = charging && m.state !== 'charge';
  const hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0), turned = e.facing !== m.facing;
  m.state = e.state; m.hp = e.hp; m.flash = e.flash || 0; m.facing = e.facing;
  if (spit) { m.spitT = 0; m.puffT = 0; m.puffK = 1; m.burstT = 0.5; m.blinkT = 0.12; pup.impulse('bend', 95).impulse('tilt', 500).impulse('sy', -4.5).impulse('sx', 2.5).impulse('mouth', 5).impulse('leaf', -600).impulse('lift', -30); }
  if (wound) pup.impulse('lift', 12).impulse('tilt', -80).impulse('leaf', 90);
  if (hit) { // which way it is being shoved, relative to the way it faces: -1 backwards (the usual), +1 forwards
    m.hitT = 0; m.kn = (Math.sign(e.vx) || -1) * e.facing; m.burstT = Math.max(m.burstT, 0.4); m.blinkT = 0.14;
    pup.impulse('bend', 95 * m.kn).impulse('tilt', 420 * m.kn).impulse('sx', 3).impulse('sy', -3.5).impulse('leaf', -480).impulse('lift', -40);
  }
  if (turned && !charging) pup.impulse('tilt', -180).impulse('bend', -20).impulse('leaf', 120);
  m.spitT = Math.min(9, m.spitT + dt); m.hitT = Math.min(9, m.hitT + dt); m.puffT = Math.min(9, m.puffT + dt); m.burstT = Math.max(0, m.burstT - dt);
  // ---- idle life: blinks, glances, and fidgets (a hiccup of spores, a shiver of the stalk, a glance back over its shoulder)
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.3 : 2 + Math.random() * 4; m.blinkT = 0.13; }
  let eyeOpen = 1; if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = clamp(m.blinkT > 0.065 ? 1 - (0.13 - m.blinkT) / 0.065 : m.blinkT / 0.065, 0, 1); }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.5 + Math.random() * 3; m.lookTo = Math.random() < 0.6 ? 0.7 : -0.4 + Math.random() * 0.8; }
  m.fidget -= dt; if (m.fidget < 0 && !charging) {
    m.fidget = 2.5 + Math.random() * 5; const r = Math.random();
    if (r < 0.4) { m.puffT = 0; m.puffK = 0.45; m.burstT = 0.5; pup.impulse('sy', 3).impulse('sx', -2).impulse('mouth', 3).impulse('lift', 14); }
    else if (r < 0.75) pup.impulse('bend', (Math.random() < 0.5 ? 1 : -1) * 28).impulse('leaf', 160);
    else { m.lookTo = -0.5; m.glance = 0.8; pup.impulse('tilt', -120); }
  }
  // ---- the resting pose: breathing, a slow sway, a pulse in the glow; with one petal left it sags and breathes fast and shallow
  const br = Math.sin(t * (2.2 + low * 1.4));
  const T = {
    sx: 1 - br * 0.025, sy: 1 + br * (0.045 - low * 0.018), lift: br * 0.6 - low * 1.2,
    bend: Math.sin(t * 1.1) * 1.6 + Math.sin(t * 1.9 + 1) * 0.6, tilt: Math.sin(t * 1.1 + 0.7) * 4 + low * 7,
    leaf: Math.sin(t * 1.3) * 4 - low * 9, mouth: 0.08 + Math.sin(t * 2.2 + 1) * 0.05, mouthGlow: 0,
    glowK: 0.12 + Math.sin(t * 1.7) * 0.06 - low * 0.05, spore: 0.5 + Math.sin(t * 0.7) * 0.2 + m.burstT * 2, inhale: 0, shake: 0,
    look: m.lookTo, squint: 0, dizzy: 0, puff: m.puffK * Math.max(0, 1 - m.puffT / 0.35), ph: t,
  };
  if (charging) {
    // the wind-up, keyed to the game's own 0.6 s timer so the spit lands on the frame the spore appears: the cap swells and brightens,
    // the mouth gapes and lights up, the stalk rears back, the eye narrows on its target, the spores are drawn in and a quiver builds
    const k = clamp(e.t / 0.6, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { sx: 1, sy: 1, mouth: 0.15, glowK: 0.25, bend: 0, lift: 0, tilt: 0, leaf: 0 }],
      [0.3, { sx: 1.06, sy: 1.08, mouth: 0.35, glowK: 0.45, bend: -1, lift: 0.5, tilt: -5, leaf: 10 }, 'outQuad'],
      [0.85, { sx: 1.17, sy: 1.22, mouth: 0.85, glowK: 0.92, bend: -2.3, lift: 1.2, tilt: -12, leaf: 26 }, 'inOutQuad'],
      [1, { sx: 1.21, sy: 1.27, mouth: 1, glowK: 1, bend: -2.8, lift: 1.5, tilt: -14, leaf: 30 }, 'inQuad'],
    ]));
    T.mouthGlow = k; T.inhale = Anim.smooth(k, 0.05, 0.6); T.shake = k * k * 0.7; T.look = 0.9; T.squint = k * 0.55; T.spore = 0.9 + k * 0.6;
  } else if (m.spitT < 0.3) { const k = m.spitT / 0.3; T.mouth = 0.7 * (1 - k); T.mouthGlow = 0.6 * (1 - k); T.glowK += 0.4 * (1 - k); T.look = 0.9; } // the mouth stays open a beat, the light drains
  if (m.hitT < 0.6) { const k = m.hitT / 0.6; T.dizzy = 1 - k; T.squint = Math.max(T.squint, 0.5 * (1 - k)); T.look *= k; } // dazed: a wandering stare
  // ---- secondary motion: the leaves flap against the stalk's motion, the cap lags the stalk; the spores drift faster when inhaled or shaken loose
  const vb = pup.V.bend || 0; T.leaf += -vb * 0.35; T.tilt += -vb * 0.12;
  m.sph = (m.sph + dt * (0.3 + T.inhale * 1.6 + m.burstT * 1.5)) % 1; T.sph = m.sph;
  T.eyeOpen = eyeOpen;
  pup.target(T);
}

// world-space light under the body (drawn with 'lighter'): the charge glow that swells with the cap, and the flash of the spit
function before(ctx, e, pup) {
  const P = pup.P, gk = clamp(P.glowK, 0, 1), pf = clamp(P.puff, 0, 1); if (gk < 0.25 && pf < 0.03) return;
  const s = pup.scale || SCALE, flip = e.facing < 0 ? -1 : 1; const cx = e.x + e.w / 2 + P.bend * s * flip, cy = e.y + e.h - (13 + P.lift + 4 * P.sy) * s;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (gk >= 0.25) { const k = (gk - 0.25) / 0.75, r = (9 + k * 6) * s; const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); gg.addColorStop(0, `rgba(200,255,90,${(0.06 + k * 0.18).toFixed(3)})`); gg.addColorStop(1, 'rgba(200,255,90,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  if (pf >= 0.03) { const mx = cx + (3 + (1 - pf) * 4) * s * flip, my = cy + 1.5 * s, r = (3 + (1 - pf) * 4) * s; const gg = ctx.createRadialGradient(mx, my, 0, mx, my, r); gg.addColorStop(0, `rgba(223,255,160,${(0.3 * pf).toFixed(3)})`); gg.addColorStop(1, 'rgba(223,255,160,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

module.exports = { name: 'sporeling', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, before };
