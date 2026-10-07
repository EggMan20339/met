// Springfoot: a frog-thing with a puffcap growing on its back, all legs. It sits and breathes, its throat pulsing, and
// hops in arcs toward Mote (src/entities.js case 'j'): on the ground it waits ('wait'), crouching deeper as the hop
// nears (the game hops at e.t > 0.55 when Mote is near, 1.6 otherwise: the crouch gathers toward 0.55, and if no hop
// comes it eases up to a ready stance and gathers again toward 1.6), then springs ('air': the body stretches, the legs
// kick straight down and swing up over its head, then reach for the ground as it falls) and lands ('land', 0.35 s: a
// deep squash with the legs folded wide, the cap whipping forward and puffing spores, a bounce back up and a settle).
// A hit flattens it sideways, knocks the trailing foot off the ground and leaves it dazed for a moment, eyes
// wandering. Idle fidgets: a croak that balloons the throat, a weight shift, a cap shake that sheds spores, a glance.
// Everything is keyed to the entity's own timers (e.t, vy) so the hop and the landing land on the game's frames; the
// springs do the in-betweens. The body (squash, stretch, roll) pivots about the ground centre between its feet, and
// the legs are solved from the body's hips to planted feet so no pose ever detaches them. See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, tr, clamp, lerp, num: n } = L;
const W = 26, H = 22, CX = 13, CY = 21; // template box; the body transform pivots about the ground centre
const SCALE = 0.68; // world units per template unit (ART_SCALE.springfoot), for the world-space dust and spores
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const LEG = '#1f3428', LEG_HL = '#4a7a56', LINE = '#142018', BELLY = '#9fd0a0', CAP = '#c86a9a', SPORE = '#ffd0e8', EYE = '#ffe66a', PUPIL = '#1a1a1a', DUST = '#8fb090';
const BODY_G = lin('sf', 6, 4, 20, 20, [[0, '#5a8a62'], [0.5, '#2f4a3a'], [1, '#1c2c24']]);
const CAP_D = 'M9 8 C9 4 17 4 17 8 C15 7 11 7 9 8 Z';
const L1 = 5.66, L2 = 4.47, REACH = L1 + L2 - 0.08; // thigh and shin lengths (from the original still) and the longest a leg can be
const HIPS = [[7, 15, -1], [19, 15, 1]]; // hip x, y on the body, and which side the knee bows to (away from the body)
const MOTES = [[0, -2, 0.8], [0.38, 1.6, 0.7], [0.71, -0.3, 0.6]]; // ambient spore motes: phase offset, x offset from the cap top, radius
const EYES = [[9.5, 0], [16.5, 2.1]]; // eye x and the phase offset of its dazed wander
// the cap's pore glow at 11 brightness steps, built once so the paint is not rebuilt for every flicker
const CAP_GLOWS = Array.from({ length: 11 }, (_, i) => (i ? circ(13, 6.3, 4.5 + i * 0.25, rad('sg', 13, 6.3, 4.5 + i * 0.25, [[0, '#ff9ad8', 0.55 * i / 10], [1, '#ff9ad8', 0]])) : null));

const params = {
  sx: 1, sy: 1, bob: 0, lean: 0, shift: 0,  // body squash/stretch about the ground centre, lift, roll (deg, + tips the top toward the side it faces), sideways shove
  bfx: 7, bfy: 21, ffx: 19, ffy: 21,       // where the back (left) and front (right) feet are, template units; the legs solve to them from the hips
  capTilt: 0, capSy: 1, spotGlow: 0,       // the puffcap's tilt (deg about its base) and squash, and its pores' glow 0..1 (the telegraph)
  throat: 0,                               // throat sac inflation 0..1.2 (the belly swells up into a vocal sac)
  eyeOpen: 1, look: 1, lookY: 0,           // lids, pupil slide (+ toward the side it faces), pupil lift (+ down)
  wide: 0, squint: 0, eyeK: 1, daze: 0,    // eyes widened, narrowed, halo size, pupils wandering after a hit
  shake: 0, ph: 0,                         // telegraph quiver amplitude and a free clock (also drives the dazed wander)
  spore: 0.35, sph: 0,                     // ambient spores drifting off the cap: amount 0..1.5 and their drift phase
  ground: 1,                               // 1 standing (contact shadow) .. 0 in the air
};
// [stiffness, damping ratio] for the values that overshoot and settle; the clocks, lids and amounts snap
const springs = {
  sx: [380, 0.45], sy: [380, 0.45], bob: [300, 0.5], lean: [240, 0.5], shift: [220, 0.5],
  bfx: [420, 0.65], bfy: [420, 0.65], ffx: [420, 0.65], ffy: [420, 0.65],
  capTilt: [240, 0.28], capSy: [320, 0.4], spotGlow: [90, 1], throat: [160, 0.6],
  look: [180, 0.8], lookY: [180, 0.8], wide: [220, 0.8], squint: [220, 0.8], eyeK: [120, 1], daze: [100, 1], spore: [120, 1], ground: [220, 1],
};
// stills exported to art/springfoot_<pose>.svg (idle, crouch and air are the originals; the rest are new readable poses)
const poses = {
  idle: {},
  crouch: { sy: 0.8, sx: 1.08, bfx: 5.5, ffx: 20.5, eyeK: 1.5, squint: 0.3, capTilt: 6, spotGlow: 0.7, throat: 0.05 },
  air: { sy: 1.15, sx: 0.95, bfx: 1.2, bfy: 5, ffx: 24.8, ffy: 5, lean: 6, lookY: -0.5, ground: 0, capTilt: -8, spore: 0.7, eyeK: 1.2 },
  fall: { sy: 1.06, sx: 0.97, bfx: 3.5, bfy: 20, ffx: 22.5, ffy: 20, wide: 1, lookY: 0.7, ground: 0, lean: -3, capTilt: 3 },
  land: { sy: 0.7, sx: 1.28, bfx: 3.5, ffx: 22.5, eyeOpen: 0, capSy: 0.72, capTilt: 12, spore: 1.3, sph: 0.4, lean: 3 },
  hurt: { sx: 1.12, sy: 0.9, lean: -12, shift: -1.5, bfy: 17.5, bfx: 6, daze: 1, eyeOpen: 0.6, capTilt: -22, throat: 0, ph: 0.3 },
  croak: { throat: 1.1, sy: 1.04, squint: 0.45, capSy: 1.06, look: 0.4 },
};

function make(P) {
  const c = Math.cos(P.lean * DEG), s = Math.sin(P.lean * DEG), sx = P.sx, sy = P.sy;
  const bx = CX + P.shift + P.shake * Math.sin(P.ph * 67), by = CY + P.shake * 0.4 * Math.cos(P.ph * 47); // where the body pivot is (the quiver shakes it)
  // where a point of the body ends up after the body's own transform, so the hips stay attached while the feet stay planted
  const tx = (x, y) => bx + (x - CX) * sx * c - (y - CY - P.bob) * sy * s, ty = (x, y) => by + (x - CX) * sx * s + (y - CY - P.bob) * sy * c;
  // legs: hip -> knee -> foot, the knee found by two-bone IK and bowed away from the body; a foot out of reach pulls the leg straight
  const legs = HIPS.map(([hx0, hy0, side], i) => {
    const hx = tx(hx0, hy0), hy = ty(hx0, hy0); let fx = i ? P.ffx : P.bfx, fy = i ? P.ffy : P.bfy;
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy) || 1e-3;
    if (d > REACH) { dx *= REACH / d; dy *= REACH / d; fx = hx + dx; fy = hy + dy; d = REACH; }
    const ux = dx / d, uy = dy / d, a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const ox = uy * h, oy = -ux * h, out = ox * side >= 0 ? 1 : -1; const kx = hx + ux * a + ox * out, ky = hy + uy * a + oy * out;
    // toes: flat on the ground when the foot is planted, trailing along the leg when it is in the air
    const airy = clamp((20.2 - fy) / 3, 0, 1); const tdx = lerp(side, ux, airy), tdy = lerp(0.15, uy, airy), tl = 1.9 / (Math.hypot(tdx, tdy) || 1);
    const legD = `M${n(hx)} ${n(hy)} L${n(kx)} ${n(ky)} L${n(fx)} ${n(fy)}`;
    return [stroke(legD, LEG, 2.6), stroke(legD, LEG_HL, 0.9, { opacity: 0.55 }), stroke(`M${n(fx)} ${n(fy)} L${n(fx + tdx * tl)} ${n(fy + tdy * tl)}`, LEG, 2)];
  });
  const shadow = ell(bx, CY + 0.4, 8 * sx, 1.1, '#000000', { opacity: 0.18 * clamp(P.ground, 0, 1) });
  // the belly swells up into a throat sac
  const th = clamp(P.throat, 0, 1.2);
  const belly = ell(13, 15 - th * 0.7, 5 + th * 1.4, 2.6 + th * 1.7, BELLY, { opacity: 0.8 + th * 0.1 });
  const throatHl = th > 0.25 ? ell(11.6, 13.4 - th * 0.9, 1.4 + th, 0.7 + th * 0.5, '#dcf4d8', { opacity: 0.35 * th }) : null;
  // the puffcap: tilts and squashes on its own springs, its pores glow as the hop nears
  const csy = P.capSy, csx = 1 + (1 - csy) * 0.6, gi = Math.round(clamp(P.spotGlow, 0, 1) * 10), gl = gi / 10;
  const cap = g([CAP_GLOWS[gi], path(CAP_D, CAP), circ(11, 6.2, 0.8 + gl * 0.35, SPORE), circ(14.5, 5.6, 0.7 + gl * 0.35, SPORE)], { transform: `${tr(13, 8.2)} ${rot(P.capTilt)} scale(${n(csx)} ${n(csy)}) ${tr(-13, -8.2)}` });
  // spores drifting up off the cap and fading
  const sp = clamp(P.spore, 0, 1.5);
  const motes = sp > 0.03 ? MOTES.map(([o, ox, r]) => { const k = (P.sph + o) % 1; return circ(13 + ox + Math.sin(k * 6.3 + o * 9) * 1.3, 4.3 - k * 6.5, r * (0.6 + sp * 0.4), SPORE, { opacity: sp * (1 - k) * Math.min(1, k * 5) * 0.8 }); }) : null;
  // eyes: a glowing halo, a lidded disc with a glint, and a pupil that glances, widens, narrows and wanders when dazed
  const open = clamp(P.eyeOpen * (1 - clamp(P.squint, 0, 1) * 0.6), 0, 1), ew = 1 + clamp(P.wide, 0, 1) * 0.18, dz = clamp(P.daze, 0, 1), ek = Math.max(0.3, P.eyeK);
  const eyes = EYES.map(([ex, o]) => { const ey = 9.5, lim = 1.5 * ew - 0.65; const px = ex + clamp(P.look * 0.4 + Math.sin(P.ph * 9 + o) * 0.6 * dz, -lim, lim), py = ey + clamp(P.lookY * 0.35 + Math.cos(P.ph * 9 + o) * 0.4 * dz, -lim * open, lim * open);
    return [circ(ex, ey, 2.7 * ek, EYE, { opacity: 0.25 * Math.min(1.6, ek) }),
      open < 0.12 ? stroke(`M${n(ex - 1.5)} ${n(ey)} L${n(ex + 1.5)} ${n(ey)}`, EYE, 0.9)
        : [ell(ex, ey, 1.5 * ew, 1.5 * ew * open, EYE), circ(ex - 0.2, ey - 0.3 * open * ew, 0.6, '#ffffff', { opacity: 0.8 }), ell(px, py, 0.7, 0.7 * Math.min(1, open * 1.3), PUPIL)]]; });
  const body = g([
    ell(13, 13, 8.5, 6.5, BODY_G, { stroke: LINE, strokeWidth: 0.9 }),
    stroke('M6.2 10.6 C7.4 8 9.6 6.8 12.6 6.6', '#8cc094', 0.9, { opacity: 0.35 }),
    belly, throatHl, cap, motes, eyes,
  ], { transform: `${tr(bx, by)} ${rot(P.lean)} scale(${n(sx)} ${n(sy)}) ${tr(-CX, -CY - P.bob)}` });
  return svg(W, H, [shadow, legs, body]);
}

// ---- animation: from the enemy's state (wait / air / land, see updateEnemy case 'j') to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.state = e.state; m.hp = e.hp; m.flash = e.flash || 0; m.facing = e.facing; m.t0 = Math.random() * 10; m.sph = Math.random();
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.glance = 1 + Math.random() * 3; m.lookTo = 0.8; m.fidget = 1.5 + Math.random() * 3;
    m.airT = 0; m.inAir = e.state === 'air'; m.hitT = 9; m.kn = -1; m.croakT = 9; m.shuffleT = 9; m.shuffleSide = 1; m.sporeT = 9; m.sporeK = 0;
    m.puffs = []; for (let i = 0; i < 16; i++) m.puffs.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 1, kind: 0 });
  }
  const s = pup.scale || SCALE, t = pup.time + m.t0, st = e.state, fac = e.facing;
  const air = st === 'air' || e.vy > 80; // a hop, or a fall off a ledge (the game keeps 'wait' for those, so the fall speed tells)
  // ---- events, found by watching the state change: the hop, the landing, a wall mid-hop (the game turns it), a hit
  const hop = st === 'air' && m.state !== 'air', land = !air && m.inAir, hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0), bonk = fac !== m.facing && air && !hop;
  m.state = st; m.inAir = air; m.hp = e.hp; m.flash = e.flash || 0; m.facing = fac;
  const cx = e.x + e.w / 2, feet = e.y + e.h;
  const puff = (kind, x, y, r, pvx, pvy, life) => { let q = m.puffs[0]; for (const p of m.puffs) if (p.life < q.life) q = p; q.kind = kind; q.x = x; q.y = y; q.r = r; q.vx = pvx; q.vy = pvy; q.life = q.max = life; };
  const burst = (k, nSpores) => { m.sporeK = Math.max(m.sporeK * Math.max(0, 1 - m.sporeT / 0.5), k); m.sporeT = 0; for (let i = 0; i < nSpores; i++) puff(1, cx + (Math.random() - 0.5) * 7 * s, feet - (16 - Math.random() * 2) * s * pup.P.sy, (0.6 + Math.random() * 0.6) * s, (Math.random() - 0.5) * 44, -14 - Math.random() * 30, 0.55 + Math.random() * 0.45); };
  if (hop) { // the release: the body snaps tall, the legs straighten under it, the cap lags back, dust kicks off the feet
    m.airT = 0; pup.snap({ sy: 1.1, sx: 0.94, bfx: 4, bfy: 22, ffx: 22, ffy: 22 }); pup.impulse('sy', 3).impulse('sx', -1.6).impulse('capTilt', -480).impulse('capSy', 3.5).impulse('throat', -3).impulse('bob', 8);
    for (let i = 0; i < 2; i++) puff(0, cx + (i ? 5 : -5) * s, feet - 1, 1.8 * s, (i ? 22 : -22), -10, 0.35);
  }
  if (land) { // the impact: a flat squash on folded legs, the cap whips forward and sheds its spores, dust spreads from the feet
    pup.snap({ sy: 0.7, sx: 1.28, bfx: 3.5, ffx: 22.5, bfy: 21, ffy: 21 }); pup.impulse('sy', -1.2).impulse('sx', 1).impulse('capTilt', 650).impulse('capSy', -6).impulse('lean', 140).impulse('ground', 12); m.blinkT = 0.1;
    burst(1, 5); for (let i = 0; i < 4; i++) puff(0, cx + (i - 1.5) * 4 * s, feet - 1, (1.6 + (i % 2) * 0.8) * s, (i - 1.5) * 26, -6 - (i % 2) * 6, 0.4 + i * 0.03);
  }
  if (hit) { // which way it is being shoved, relative to the way it faces: +1 toward its front (hit from behind), -1 backwards
    m.hitT = 0; m.kn = (Math.sign(e.vx) || -1) * fac; m.blinkT = 0.14; burst(0.5, 2);
    pup.impulse('sx', 4.5).impulse('sy', -4.5).impulse('lean', 430 * m.kn).impulse('shift', 44 * m.kn).impulse('capTilt', -800 * m.kn).impulse('capSy', -4).impulse('bob', 10).impulse('throat', -4);
  }
  if (bonk) { pup.impulse('sx', -4).impulse('sy', 3).impulse('lean', -260).impulse('capTilt', -600).impulse('capSy', -3); m.blinkT = 0.12; burst(0.4, 2); }
  m.airT += dt; m.hitT = Math.min(9, m.hitT + dt); m.croakT = Math.min(9, m.croakT + dt); m.shuffleT = Math.min(9, m.shuffleT + dt); m.sporeT = Math.min(9, m.sporeT + dt);
  // ---- idle life: blinks, glances
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.3 : 2 + Math.random() * 4; m.blinkT = 0.13; }
  let eyeOpen = 1; if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = clamp(m.blinkT > 0.065 ? 1 - (0.13 - m.blinkT) / 0.065 : m.blinkT / 0.065, 0, 1); }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.2 + Math.random() * 3; m.lookTo = Math.random() < 0.6 ? 0.8 : -0.6 + Math.random() * 1.2; }
  // ---- the resting pose: breathing, a throat that pulses, a slow sway of the cap, spores drifting off it
  const br = Math.sin(t * 2.4), pulse = Math.pow(Math.sin(t * 4.2) * 0.5 + 0.5, 3);
  const T = {
    sx: 1 - br * 0.012, sy: 1 + br * 0.022, bob: 0, lean: 0, shift: 0, bfx: 7, bfy: 21, ffx: 19, ffy: 21,
    capTilt: Math.sin(t * 1.3) * 2.5, capSy: 1 + br * 0.03, spotGlow: 0.1 + Math.sin(t * 1.7) * 0.08, throat: 0.18 + pulse * 0.62,
    look: m.lookTo, lookY: 0, wide: 0, squint: 0, eyeK: 1 + Math.sin(t * 2.1) * 0.1, daze: 0, shake: 0, ph: t, spore: 0.35 + Math.sin(t * 0.6) * 0.15, sph: m.sph, ground: 1,
  };
  let cr = 0;
  if (air) {
    // the hop, keyed to the air time and the fall speed: legs kick straight down on the push, swing up over the head on the rise,
    // then come down and spread to catch the ground; the body stretches with speed, tips into the leap and rights itself to land
    const vk = clamp(e.vy / 300, -1, 1), up = Anim.smooth(m.airT, 0.04, 0.2) * (1 - Anim.smooth(vk, 0.1, 0.75)), down = Anim.smooth(vk, 0.1, 0.9);
    const fx = lerp(lerp(4, 1.2, up), 3.5, down), fy = lerp(lerp(22, 5, up), 20.5, down);
    Object.assign(T, { bfx: fx, bfy: fy, ffx: 26 - fx, ffy: fy, sy: 1 + Math.abs(vk) * 0.1, sx: 1 - Math.abs(vk) * 0.06, lean: 8 * (1 - down) - 3 * down, look: 1, lookY: vk * 0.7, wide: down, eyeK: 1.2, throat: 0, ground: 0, spore: 0.7, capTilt: -4 * (1 - down) + 3 * down, spotGlow: 0.2 });
  } else if (st === 'land') {
    // the landing, keyed to the game's 0.35 s timer: squashed flat with the eyes shut, a bounce back up past rest, a settle
    const k = clamp(e.t / 0.35, 0, 1);
    const c = Anim.keys(k, [
      [0, { sy: 0.68, sx: 1.3, fx: 3.5, eo: 0, capSy: 0.7, lean: 4, bob: 0 }],
      [0.3, { sy: 1.07, sx: 0.96, fx: 5, eo: 1, capSy: 1.1, lean: -2, bob: 0.4 }, 'outCubic'],
      [0.65, { sy: 0.97, sx: 1.02, fx: 6, eo: 1, capSy: 0.98, lean: 0.5, bob: 0 }, 'inOutQuad'],
      [1, { sy: 1, sx: 1, fx: 6.6, eo: 1, capSy: 1, lean: 0, bob: 0 }, 'outQuad'],
    ]);
    Object.assign(T, { sy: c.sy, sx: c.sx, bfx: c.fx, ffx: 26 - c.fx, capSy: c.capSy, lean: c.lean, bob: c.bob, look: 1, throat: 0.1, eyeK: 1.1, spore: 1.2 - k * 0.8 }); eyeOpen = Math.min(eyeOpen, c.eo);
  } else if (st === 'wait') {
    // the wait, keyed to the game's timer: it gathers into a crouch toward the near hop (0.55 s); if none comes it eases up to a
    // ready stance, holds, and gathers again toward the far hop (1.6 s). Knees spread, eyes narrow on the target, the cap's pores
    // glow brighter and a quiver builds at the deepest crouch
    cr = Anim.keys(e.t, [[0, { cr: 0 }], [0.2, { cr: 0.04 }], [0.5, { cr: 0.93 }, 'inOutQuad'], [0.55, { cr: 1 }, 'inQuad'], [0.85, { cr: 0.12 }, 'outQuad'], [1.15, { cr: 0.1 }, 'inOutQuad'], [1.6, { cr: 1 }, 'inOutQuad']]).cr;
    Object.assign(T, { sy: lerp(T.sy, 0.78, cr), sx: lerp(T.sx, 1.09, cr), bfx: 7 - cr * 1.8, ffx: 19 + cr * 1.8, eyeK: lerp(T.eyeK, 1.6, cr), squint: cr * 0.35, throat: lerp(T.throat, 0.05, cr),
      look: lerp(T.look, 1, cr), lookY: cr * 0.25, capTilt: T.capTilt + cr * 7, spotGlow: lerp(T.spotGlow, 0.95, cr * cr), spore: T.spore + cr * 0.4, shake: Math.max(0, cr - 0.85) / 0.15 * 0.45 });
  }
  // ---- fidgets while it waits: a croak, a weight shift, a cap shake that sheds spores, a glance back over its shoulder
  m.fidget -= dt;
  if (m.fidget < 0 && !air && st !== 'land' && cr < 0.5 && m.hitT > 1) {
    m.fidget = 2 + Math.random() * 3.5; const r = Math.random();
    if (r < 0.4) { m.croakT = 0; pup.impulse('sy', 1.4).impulse('capSy', 2); }
    else if (r < 0.7) { m.shuffleT = 0; m.shuffleSide = Math.random() < 0.5 ? -1 : 1; }
    else if (r < 0.88) { pup.impulse('capTilt', (Math.random() < 0.5 ? -1 : 1) * 420).impulse('capSy', 3); burst(0.6, 2); }
    else { m.lookTo = -0.7; m.glance = 0.9; pup.impulse('lean', -70); }
  }
  if (m.croakT < 0.5) { const k = Math.sin(m.croakT / 0.5 * Math.PI); T.throat = Math.max(T.throat, k * 1.15); T.squint = Math.max(T.squint, k * 0.5); T.sy += k * 0.04; T.bob += k * 0.5; T.capSy += k * 0.06; }
  if (m.shuffleT < 0.4) { const k = m.shuffleT / 0.4, lift = Math.sin(k * Math.PI) * 3; if (m.shuffleSide < 0) { T.bfy -= lift; T.bfx -= k * 1.2; } else { T.ffy -= lift; T.ffx += k * 1.2; } T.lean += -m.shuffleSide * lift * 1.3; T.bob += lift * 0.15; }
  // ---- the daze after a hit: pupils wander, lids droop, the halo dims, the trailing foot is knocked off the ground and re-plants
  if (m.hitT < 0.7) {
    const k = m.hitT / 0.7, w = Math.sin(Math.min(1, m.hitT / 0.32) * Math.PI);
    T.daze = 1 - k; T.eyeK = 0.75 + 0.25 * k; T.squint = Math.max(T.squint, 0.45 * (1 - k)); T.look = lerp(-m.kn * 0.5, T.look, k); T.throat = Math.min(T.throat, 0.1 + k * 0.3); T.spotGlow *= k;
    if (!air) { if (m.kn > 0) { T.bfy -= w * 4.5; T.bfx -= w * 1.5; } else { T.ffy -= w * 4.5; T.ffx += w * 1.5; } }
  }
  T.spore += m.sporeK * Math.max(0, 1 - m.sporeT / 0.5) * 1.2;
  m.sph = (m.sph + dt * (0.3 + T.spore * 0.4)) % 1; T.sph = m.sph;
  T.eyeOpen = eyeOpen;
  pup.target(T);
  // ---- the world-space dust and spores left behind where it landed
  for (const p of m.puffs) if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - Math.min(1, dt * 2.5); if (p.kind) p.vy -= dt * 12; else p.vy *= 1 - Math.min(1, dt * 4); }
}

// world-space dust under the body: puffs spreading from where the feet hit the ground (they stay behind while it hops on)
function before(ctx, e, pup) {
  const ps = pup.mem.puffs; if (!ps) return;
  let any = false; for (const p of ps) if (p.life > 0 && !p.kind) { any = true; break; } if (!any) return;
  ctx.save();
  for (const p of ps) { if (p.life <= 0 || p.kind) continue; const k = p.life / p.max; ctx.globalAlpha = 0.28 * k; ctx.fillStyle = DUST; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.1 - k * 0.4) + (1 - k) * 1.8, 0, TAU); ctx.fill(); }
  ctx.restore();
}
// world-space spores over the body: the cap's puff drifting up and fading where it landed
function after(ctx, e, pup) {
  const ps = pup.mem.puffs; if (!ps) return;
  let any = false; for (const p of ps) if (p.life > 0 && p.kind) { any = true; break; } if (!any) return;
  ctx.save(); ctx.fillStyle = SPORE;
  for (const p of ps) { if (p.life <= 0 || !p.kind) continue; const k = p.life / p.max; ctx.globalAlpha = 0.85 * Math.min(1, k * 2.5); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.7 + k * 0.5), 0, TAU); ctx.fill(); }
  ctx.restore();
}

module.exports = { name: 'springfoot', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, before, after };
