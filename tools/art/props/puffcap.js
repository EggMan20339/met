// The puffcap: the springy mushroom tile of the Puffcap Warrens that bounces Mote high.
//
// The old still (tools/art/props.js 'puffcap') is the default pose: an 18x18 tile-sized mushroom, a pale stem under a
// pink dome with three spots, drawn with its foot at the tile's bottom centre (src/render.js draws the puppet at
// px + 8, py + 16; the tile is solid and the player bounces off its top, src/player.js). Nothing about its silhouette,
// colours or size changes; the old procedural drawing's only effect, the idle squash on a sine with a per-tile phase
// from tx, is kept as the idle wobble. make(P) is a pure drawing of the parameters; control(ent, pup, info) animates:
// an idle life (the whole body breathes on the old sine, the cap tilts on two slower sines, a shiver on a random timer,
// a lone spore drifting up from the gills now and then), a telegraph (Mote dropping toward the cap: it squats and the
// cap flattens to meet them, deeper the closer they come), the bounce (found by watching the player's vy flip from
// falling to a hard rise with their feet at this cap, since player.events is cleared before the render: a big squash
// with the cap pressed flat and tilted toward the side they hit, then the spring's rebound into a tall narrow stretch
// that settles in a few wobbles; a puff of spores bursts from under the rim and rises, slowing and fading, with a
// pink halo at the rim and the spots flaring a beat after the body), a lean of the whole stalk toward Mote when they
// stand beside it, and a thump when they land hard nearby. The spores live in pup.mem and are drawn inside make()
// (tiles get no before()/after() call from the renderer). See art/ANIMATION.md.
const L = require('../lib');
const { svg, rad, path, circ, rect, stroke, g, rot, tr, glow, clamp } = L;
const W = 18, H = 18;                 // template box; the stem's foot sits on the bottom edge, as in the old still
const TILE = 16;
const BX = 9, BY = 18;                // the base (bottom centre): the pivot of the squash and of the lean
const CX = 9, CY = 9;                 // the stem top: the cap's pivot
const CAP_D = 'M1 9 C1 2 17 2 17 9 C13 7 5 7 1 9 Z';
const CAP_FILL = rad('pc', 7, 6, 8, [[0, '#ff9ad8'], [1, '#a03a90']]);
const SPOT = '#ffe0f4', SPORE = '#ffd8f0', HALO = '#ff9ad8';
const SPORES = 8, SP = 7, SO = 4;     // spores in flight: a ring of SPORES records of SP floats (x, y, vx, vy, age, life, size); SO floats each as drawn (x, y, alpha, r)
const f3 = (v) => +v.toFixed(3), q1 = (v) => Math.round(v * 10) / 10, q05 = (v) => Math.round(v * 20) / 20;
const smooth = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };

const params = {
  sx: 1, sy: 1,      // the whole body's squash and stretch about its foot (the old idle sine; the bounce's big squash and rebound)
  lean: 0,           // the whole stalk's lean in degrees about its foot, positive tips the cap to the right (toward Mote standing there)
  tilt: 0,           // the cap's tilt in degrees about the stem top, positive dips its right rim (the side Mote lands on)
  capSq: 1,          // the cap's own flatten: 1 the still, < 1 pressed flat (bracing, the impact), > 1 bloomed tall (the rebound); it widens as it flattens
  spot: 0.8,         // the spots' brightness, pulsing; flares a beat after a bounce
  puff: 0,           // the spore halo under the rim right after a bounce, 1 .. 0 (set straight from a timer)
  spores: [],        // [x, y, alpha, r, ...] the spores in flight, template units (control keeps a ring of them in pup.mem)
};
// [stiffness, damping ratio]: a loose, lively body (several visible wobbles after a bounce), a quick cap, a slow lean, a lagging glow
const springs = { sx: [300, 0.3], sy: [300, 0.26], lean: [110, 0.5], tilt: [220, 0.3], capSq: [360, 0.4], spot: [50, 1] };
// stills: default is the old art/puffcap.svg; the others are the bounce's readable moments and the lean
const poses = {
  default: {},
  brace: { sy: 0.9, sx: 1.06, capSq: 0.8 },
  squash: { sy: 0.56, sx: 1.3, capSq: 0.72, tilt: 4, puff: 1, spot: 1 },
  stretch: { sy: 1.2, sx: 0.88, capSq: 1.1, tilt: -3, puff: 0.5, spot: 0.95, spores: [5, 4, 0.8, 1, 13.5, 3, 0.7, 0.9, 9, 1, 0.6, 0.8, 2, 7, 0.5, 0.7, 16, 6.5, 0.5, 0.7] },
  lean: { lean: 10, tilt: 5 },
};

function make(P) {
  const sx = clamp(P.sx, 0.5, 1.8), sy = clamp(P.sy, 0.3, 1.8), cs = clamp(P.capSq, 0.4, 1.5), cw = 1 + (1 - cs) * 0.45;
  const spot = clamp(P.spot, 0.3, 1), sr = 1.2 * clamp(0.75 + 0.3 * P.spot, 0.8, 1.4), puff = clamp(P.puff, 0, 1);
  // ---- the cap: the old dome, a rim light on its upper left, the three spots; it flattens (and widens) and tilts about the stem top
  const cap = g([
    path(CAP_D, CAP_FILL, { stroke: '#6a2a60', strokeWidth: 0.7 }),
    stroke('M2.7 6.8 C3.6 5.4 5.8 4.3 8.6 4.2', '#ffd6ee', 0.8, { opacity: 0.45 }),
    circ(5, 5.5, sr, SPOT, { opacity: spot }), circ(9, 4, sr, SPOT, { opacity: spot }), circ(13, 5.5, sr, SPOT, { opacity: spot }),
  ], { transform: `${tr(CX, CY)} ${rot(clamp(P.tilt, -40, 40))} scale(${f3(cw)} ${f3(cs)}) ${tr(-CX, -CY)}` });
  // ---- the stem with its shadow side; the whole body squashes and leans about its foot
  const stem = [rect(7, 9, 4, 9, '#d8d0e8', { rx: 1.5 }), rect(9.4, 10.5, 1.2, 7, '#b4a8cc', { rx: 0.6, opacity: 0.45 })];
  const body = g([stem, cap], { transform: `${tr(BX, BY)} ${rot(clamp(P.lean, -30, 30))} scale(${f3(sx)} ${f3(sy)}) ${tr(-BX, -BY)}` });
  // ---- the spore halo at the rim (wherever the squash has put it) and the spores in flight, free of the body's transform
  const halo = puff > 0.02 ? glow(9, q1(BY - (BY - CY) * sy), q1(6 + 5 * (1 - puff)), HALO, q05(0.5 * puff)) : null;
  const sp = P.spores, spores = [];
  for (let i = 0; i + 3 < sp.length; i += SO) if (sp[i + 2] > 0.03) spores.push(circ(sp[i], sp[i + 1], sp[i + 3], SPORE, { opacity: Math.min(1, sp[i + 2]) }));
  return svg(W, H, [halo, body, spores]);
}

// a spore set going from (x, y) in template units
function spore(m, x, y, vx, vy, life, size) {
  const o = m.si * SP; m.si = (m.si + 1) % SPORES;
  m.sp[o] = x; m.sp[o + 1] = y; m.sp[o + 2] = vx; m.sp[o + 3] = vy; m.sp[o + 4] = 0; m.sp[o + 5] = life; m.sp[o + 6] = size;
}

// ---- animation: the player's approach, the bounce and their company, plus the tile's own life, turned into targets every frame
function control(e, pup, info) {
  const dt = Math.min(info.dt || 0, 0.1), m = pup.mem, P = pup.P, game = info.game;
  const tx = e.tx || 0, ty = e.ty || 0;
  if (m.init === undefined) {
    m.init = true; m.ph = tx; m.ph2 = ty * 0.7 + tx * 1.3; m.pvy = 0; m.pAir = false; m.puffT = 0; m.fidget = 2 + Math.random() * 5; m.drift = 1.5 + Math.random() * 3;
    m.sp = new Float32Array(SPORES * SP); m.out = new Float32Array(SPORES * SO); m.si = 0;
    pup.snap({ spores: m.out });
  }
  const t = pup.time, top = ty * TILE, bottom = top + TILE, cx = tx * TILE + 8, rimY = BY - (BY - CY) * P.sy;
  const pl = game && game.player; let brace = 0, leanT = 0, nod = 0;
  if (pl && !pl.dead) {
    const feet = pl.y + pl.h, dx = pl.x + pl.w / 2 - cx, adx = Math.abs(dx);
    const overX = pl.x + pl.w - 2 > tx * TILE && pl.x + 2 < tx * TILE + TILE;   // the feet span the game tests against bouncers
    // ---- the bounce: the player's fall turned into a hard rise with their feet at this cap (a pogo off it is a softer one); the game
    // clears player.events before the render, so the vy flip is what finds it, but the event counts too should it ever reach us
    const bounced = !!pl.events && pl.events.indexOf('bounce') >= 0;
    if (overX && feet < top + 3 && feet > top - 48 && ((m.pvy > 40 && pl.vy < -300) || bounced)) {
      const k = clamp(-pl.vy / 640, 0.5, 1.2), side = clamp(dx / 8, -1, 1);
      pup.impulse('sy', -10 * k).impulse('sx', 5.5 * k).impulse('capSq', -5 * k).impulse('tilt', side * 280 * k).impulse('spot', 6 * k);
      m.puffT = 0.5; const n = k > 0.9 ? 8 : 6;
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n - 0.5 + (Math.random() - 0.5) * 0.15; spore(m, 9 + u * 13, rimY + 0.5, u * 30 + side * 6 + (Math.random() - 0.5) * 6, -(14 + Math.random() * 22) * k, 0.55 + Math.random() * 0.4, 0.8 + Math.random() * 0.7); }
    }
    // ---- the telegraph: Mote dropping toward the cap, it squats and flattens to meet them, deeper the closer they come
    if (pl.vy > 40 && feet <= top + 2 && adx < 16) brace = smooth(1 - (top - feet - 6) / 100);
    // ---- Mote standing beside it: the whole stalk leans toward them, like a flower to the light; a hard landing nearby thumps the ground
    const onFloor = pl.onGround && feet > top - 4 && feet < bottom + 8;
    if (onFloor && adx < 60 && adx > 6) { const k = smooth(1 - (adx - 6) / 54); leanT = Math.sign(dx) * 11 * k; nod = Math.sign(dx) * 5 * k; }
    if (onFloor && m.pAir && m.pvy > 240 && adx < 64) { const k = 1 - adx / 64; pup.impulse('sy', -2.5 * k).impulse('sx', 1.4 * k).impulse('tilt', -Math.sign(dx) * 200 * k).impulse('lean', -Math.sign(dx) * 70 * k); }
    m.pvy = pl.vy; m.pAir = !pl.onGround;
  }
  // ---- idle life: a shiver on a random timer, a lone spore drifting up from the gills now and then
  m.fidget -= dt; if (m.fidget < 0) { m.fidget = 3 + Math.random() * 6; pup.impulse('tilt', (Math.random() < 0.5 ? -1 : 1) * (100 + Math.random() * 80)).impulse('sy', 0.5); }
  m.drift -= dt; if (m.drift < 0) { m.drift = 2.5 + Math.random() * 4; spore(m, 9 + (Math.random() < 0.5 ? -1 : 1) * (3.5 + Math.random() * 3), rimY + 0.3, (Math.random() - 0.5) * 4, -(4 + Math.random() * 5), 1.2 + Math.random() * 0.8, 0.45 + Math.random() * 0.35); }
  // ---- spores in flight: they burst out, slow in the air, wander and keep drifting up (lighter than air), growing a little as they fade
  const sp = m.sp, out = m.out;
  for (let i = 0; i < SPORES; i++) {
    const o = i * SP, q = i * SO, life = sp[o + 5]; if (life <= 0 || sp[o + 4] >= life) { out[q + 2] = 0; continue; }
    sp[o + 4] += dt; const age = sp[o + 4], k = age / life, dr = Math.max(0, 1 - 2.6 * dt);
    sp[o] += (sp[o + 2] + Math.sin(age * 7 + i * 1.9) * 2.5) * dt; sp[o + 1] += sp[o + 3] * dt; sp[o + 2] *= dr; sp[o + 3] = sp[o + 3] * dr - 7 * dt;
    if (sp[o + 1] < -30) { sp[o + 4] = life; out[q + 2] = 0; continue; }
    out[q] = sp[o]; out[q + 1] = sp[o + 1]; out[q + 2] = Math.min(1, (1 - k) * 1.8) * 0.9; out[q + 3] = sp[o + 6] * (0.7 + 0.5 * k);
  }
  m.puffT = Math.max(0, m.puffT - dt); const pf = m.puffT / 0.5;
  // ---- targets: the old idle sine (with its per-tile phase) on the body, slower sines on the cap and the stalk, the brace and the lean on top
  const s5 = Math.sin(t * 5 + m.ph);
  pup.target({
    sx: 1 - s5 * 0.03 + brace * 0.08, sy: 1 + s5 * 0.05 - brace * 0.14,
    tilt: nod + 3.2 * Math.sin(t * 1.7 + m.ph2) + 1.6 * Math.sin(t * 0.53 + m.ph),
    lean: leanT + 1.8 * Math.sin(t * 0.8 + m.ph2),
    capSq: 1 - s5 * 0.03 - brace * 0.25,
    spot: 0.8 + 0.1 * Math.sin(t * 2.9 + m.ph2),
    puff: pf * pf,
  });
}

module.exports = { name: 'puffcap', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control };
