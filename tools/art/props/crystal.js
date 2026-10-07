// The chime crystal cluster of Chimeglass Reach: three shards of lavender glass that ring when the air moves and hum
// when Mote is near.
//
// src/game.js: a crystal is static decor (tx, ty, type '+') and counts as warmth: rekindling runs twice as fast within
// 70 world units of it. make(P, pup) is a pure drawing of the parameters; control(ent, pup, info) animates. Idle life:
// an inner light that breathes slowly (the old sprites.js pulse, period ~3 s: the under-glow swells, the cores of the
// shards brighten, a pool of light grows at their feet), a glint that travels up each shard's lit edge on its own
// period, and now and then a chime (one shard flicks and rings down on a barely damped spring, like a struck chime,
// its tip alight). When Mote comes within 40 world units the cluster hums: a ring of brightness fades in around it,
// ripples spread from its heart, the shards quiver, the light swells and the glints hurry; it all fades when they
// leave. While Mote rekindles beside it the inner light charges with the player's own focus timer and flashes on each
// heal (a burst ring, a bloom, every tip alight), so the crystal visibly feeds the rekindling. A dash past, a sprint
// past, a hard landing or a strike nearby jolt it and set it ringing. after() throws the halo on the world
// (info.glowAt, the old drawing's, following the light a beat behind and leaning a little toward Mote) plus the
// additive ring of brightness and the heal's bloom. Decor never flips. See art/ANIMATION.md.
// Filmstrip aid: `cue` on the decor entity (--set '{"cue":"near"}') plays one beat a moment later: near, rekindle,
// dash, land, strike, chime.
const L = require('../lib');
const { svg, path, ell, circ, rect, g, rot, tr, glow, clamp, num: n } = L;
const W = 20, H = 22, GY = 22, HX = 10, HY = 11;   // template box; the shards stand on the bottom edge; the cluster's heart is at (10, 11)
const TILE = 16, SCALE = 0.8;                      // world units per template unit (ART_SCALE.crystal)
const NEAR = 40, LEAVE = 46, WARM = 70;            // world units: the hum radius (with hysteresis) and the game's own warmth radius
const FOCUS_TIME = 0.9;                            // PHYS.FOCUS_TIME: the player's focus timer wraps at this on a heal
// the three shards, as in the old still: outline and fill, the lit facet, a core that glows from within, the lit edge the
// glint rides (base corner bx .. apex ax, ay; h the height), the pivot px on the ground, and the quiver's frequency w (rad/s) and phase o
const SHARDS = [
  { d: 'M2 22 L4 12 L7 22 Z', fill: '#a070e0', facet: null, facetFill: null, facetA: 0, core: 'M3.3 21.3 L4 13.8 L5.2 21.3 Z', bx: 2, ax: 4, ay: 12, h: 10, px: 4.5, w: 57, o: 0 },
  { d: 'M5 22 L8 3 L12 22 Z', fill: '#c9a0ff', facet: 'M5 22 L8 3 L9 22 Z', facetFill: '#e6d3ff', facetA: 0.8, core: 'M6.8 21.3 L8 6.2 L9.8 21.3 Z', bx: 5, ax: 8, ay: 3, h: 19, px: 8.5, w: 44, o: 2.1 },
  { d: 'M11 22 L14 8 L17 22 Z', fill: '#b088f0', facet: 'M11 22 L14 8 L15 22 Z', facetFill: '#f3e0ff', facetA: 0.7, core: 'M12.7 21.3 L14 10.6 L15.4 21.3 Z', bx: 11, ax: 14, ay: 8, h: 14, px: 14, w: 66, o: 4 },
];
const GLINT_PER = [3.1, 4.4, 3.7];                 // seconds per pass of each shard's glint, base to apex
const qz = (v) => Math.round(v * 50) / 50;         // gradient numbers quantised so the canvas gradient cache hits

const params = {
  inner: 0,                 // the inner light: 0 the trough of its breath (the old still) .. 1 full, up to ~1.5 while it feeds a rekindling
  halo: 0,                  // the halo's strength, following inner on a slower spring (the light swells after the shards)
  hum: 0,                   // 0..1 Mote is near: the ring of brightness, the ripples, the quiver, the hurried glints
  ring: 0,                  // the ripples' phase, cycling 0..1 while humming (set straight from a clock in pup.mem)
  burst: 0,                 // a heal's flash ring: 1 just fired .. 0 gone (a clip in pup.mem)
  quiver: 0, qt: 0,         // the hum's vibration: its amplitude in degrees, and the clock it runs on (both set straight from control)
  sway1: 0, sway2: 0, sway3: 0,   // each shard's tilt about its base, degrees, positive clockwise (impulses set them ringing)
  tip1: 0, tip2: 0, tip3: 0,      // a sparkle at each apex, 0..1 (impulses)
  glint1: 0, glint2: 0.7105, glint3: 1, // each glint's place along its shard's lit edge, 0 the base .. 1 the apex; at rest the old still's glint sits on the tall shard and the others are faded out at their ends
  sx: 1, sy: 1,             // the cluster's squash and stretch about its base (jolts)
  hx: 0,                    // the halo's lean toward Mote in template units (read by after(), not make)
};
// [stiffness, damping ratio]: a slow light and a slower halo; a hum that rises and fades over a second; shards that ring
// like chimes (each at its own pitch, barely damped); quick sparkles; a stiff jolt
const springs = {
  inner: [40, 0.85], halo: [20, 1], hum: [18, 0.75], hx: [25, 1],
  sway1: [620, 0.09], sway2: [330, 0.07], sway3: [460, 0.08],
  tip1: [160, 0.5], tip2: [160, 0.5], tip3: [160, 0.5], sx: [520, 0.3], sy: [520, 0.3],
};
// stills: default is the old art/crystal.svg; the rest are the readable moments of its life
const poses = {
  default: {},
  breathe: { inner: 0.7, halo: 0.7, glint1: 0.3, glint2: 0.55, glint3: 0.8 },
  chime: { sway2: 3.2, tip2: 1, inner: 0.5, halo: 0.4, glint1: 0.5, glint2: 0.85, glint3: 0.35 },
  hum: { hum: 1, inner: 0.9, halo: 0.9, ring: 0.3, quiver: 0.9, qt: 0.37, glint1: 0.2, glint2: 0.62, glint3: 0.45, tip1: 0.4, tip3: 0.7 },
  rekindle: { hum: 1, inner: 1.4, halo: 1.3, ring: 0.65, burst: 0.6, quiver: 1.2, qt: 0.11, tip1: 1, tip2: 1, tip3: 1, glint1: 0.5, glint2: 0.5, glint3: 0.5, sy: 1.02 },
  jolt: { sx: 1.05, sy: 0.95, sway1: -4, sway2: 3, sway3: -3.5, tip2: 0.6, inner: 0.4, halo: 0.3, glint1: 0.45, glint2: 0.3, glint3: 0.6 },
};

function make(P) {
  const inner = clamp(P.inner, 0, 1.5), lit = Math.min(inner, 1), hum = clamp(P.hum, 0, 1.2), burst = clamp(P.burst, 0, 1), qv = P.quiver, qt = P.qt;
  // ---- the glow under everything (the old still's, breathing) and the pool of light at the shards' feet
  const gl = glow(HX, HY, qz(10 + 2.5 * lit + 2 * hum), '#c9a0ff', qz(Math.min(0.72, 0.4 + 0.2 * inner + 0.08 * hum)));
  const pool = inner > 0.03 ? ell(HX, 21.7, n(6.5 + 2 * lit), n(0.9 + 0.3 * lit), '#e6c8ff', { opacity: n(0.35 * lit) }) : null;
  // ---- a shard: tilts about its base (its sway plus the hum's quiver); the facet and the core brighten with the inner light;
  // the glint rides up the lit edge, fading in at the base and out at the apex; the apex sparkles
  const shard = (S, sway, tip, k) => {
    const kk = clamp(k, 0, 1), gx = S.bx + (S.ax - S.bx) * kk + 0.65 + 0.75 * (1 - kk), gy = GY + (S.ay - GY) * kk, gh = (2.55 + 1.55 * (1 - kk)) * Math.sqrt(S.h / 19);
    const ga = 0.8 * clamp(1.3 * Math.sin(Math.PI * kk), 0, 1), tp = clamp(tip, 0, 1);
    return g([
      path(S.d, S.fill),
      S.facet ? path(S.facet, S.facetFill, { opacity: n(Math.min(1, S.facetA + 0.15 * lit)) }) : null,
      inner > 0.02 ? path(S.core, '#fff6ff', { opacity: n(0.5 * Math.min(inner, 1.2)) }) : null,
      ga > 0.02 ? rect(n(gx - 0.5), n(gy - gh / 2), 1, n(gh), '#ffffff', { opacity: n(ga) }) : null,
      tp > 0.03 ? [circ(S.ax, S.ay + 0.6, n(2.2 * tp), '#ffffff', { opacity: n(0.3 * tp) }), circ(S.ax, S.ay + 0.6, n(0.75 * tp), '#ffffff', { opacity: n(Math.min(1, tp * 1.2)) })] : null,
    ], { transform: rot(sway + qv * Math.sin(qt * S.w + S.o), S.px, GY) });
  };
  const shards = g([shard(SHARDS[0], P.sway1, P.tip1, P.glint1), shard(SHARDS[1], P.sway2, P.tip2, P.glint2), shard(SHARDS[2], P.sway3, P.tip3, P.glint3)],
    { transform: `${tr(HX, GY)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-HX, -GY)}` });
  // ---- the ring of brightness and the ripples spreading from the heart while it hums; the burst ring of a heal
  const ring = hum > 0.02 ? [circ(HX, HY, n(10.5 + 0.35 * Math.sin(6.2832 * P.ring)), 'none', { stroke: '#f4e8ff', strokeWidth: 0.5, opacity: n(0.35 * hum) })] : null;
  if (ring) for (let j = 0; j < 2; j++) { const ph = (P.ring + j * 0.5) % 1, r = 3 + 8.5 * ph; ring.push(ell(HX, HY, n(r), n(Math.min(r, 10.6)), 'none', { stroke: '#e8d4ff', strokeWidth: n(1 - 0.6 * ph), opacity: n(0.45 * hum * Math.pow(1 - ph, 1.5)) })); }
  const flash = burst > 0.02 ? circ(HX, HY, n(4 + 15 * (1 - burst)), 'none', { stroke: '#fff4ff', strokeWidth: n(0.3 + 1.4 * burst), opacity: n(0.9 * burst) }) : null;
  return svg(W, H, [gl, pool, shards, ring, flash]);
}

// ---- animation: Mote's nearness and doings, the crystal's own life, turned into targets and impulses every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, P = pup.P, game = info.game;
  if (m.init === undefined) {
    m.init = true; m.ph = ((e.tx || 0) * 1.7 + (e.ty || 0) * 0.9) % 6.283; m.gT = [Math.random() * 3, Math.random() * 4, Math.random() * 3.5];
    m.chimeT = 1.5 + Math.random() * 4; m.near = false; m.pAir = false; m.pvy = 0; m.kick = 0; m.passCd = 0; m.attackT = 0; m.focusT = 0;
    m.cue = null; m.cueT = -1; m.simNear = 0; m.simFeed = 0; m.simFT = 0; m.rip = 0; m.burstT = -1; m.gk = [0, 0, 0];
  }
  const t = pup.time, humK = clamp(P.hum, 0, 1.2);
  // ---- a cue set on the entity (filmstrips) plays one beat a moment later
  if (e.cue !== m.cue) { m.cue = e.cue; if (e.cue) m.cueT = 0.25; }
  let cue = null; if (m.cueT >= 0) { m.cueT -= dt; if (m.cueT < 0) cue = m.cue; }
  if (cue === 'near') m.simNear = 2.4; else if (cue === 'rekindle') { m.simNear = 3.2; m.simFeed = 3.2; m.simFT = 0; }
  // ---- Mote: how near they are (from the point the game measures warmth from), and what they are doing
  const pl = game && game.player; const cx = e.tx * TILE + 8, cy = e.ty * TILE + 4; let dx = 0, dist = 1e9;
  if (pl && !pl.dead) { dx = pl.x + pl.w / 2 - cx; const dy = pl.y + pl.h / 2 - cy; dist = Math.hypot(dx, dy); }
  const warmK = clamp((WARM - dist) / 30, 0, 1);
  let near = dist < (m.near ? LEAVE : NEAR); if (m.simNear > 0) { m.simNear -= dt; near = true; }
  // rekindling beside it: the light charges with the player's own focus timer and flashes when it wraps on a heal
  let feeding = false, feedK = 0, healed = false;
  if (pl && pl.focusing && dist < WARM) { feeding = true; feedK = clamp(pl.focusTimer / FOCUS_TIME, 0, 1); healed = pl.focusTimer < m.focusT - 0.3; }
  m.focusT = pl ? pl.focusTimer : 0;
  if (m.simFeed > 0) { m.simFeed -= dt; feeding = true; m.simFT += dt * 2; if (m.simFT >= FOCUS_TIME) { m.simFT -= FOCUS_TIME; healed = true; } feedK = clamp(m.simFT / FOCUS_TIME, 0, 1); }
  // ---- events: Mote arrives (the hum leaps up and every shard answers), dashes or sprints past, lands hard or strikes nearby
  const entered = near && !m.near; m.near = near;
  if (entered) { pup.impulse('hum', 4).impulse('inner', 2.5).impulse('sway1', 45).impulse('sway2', -32).impulse('sway3', 40).impulse('tip2', 8); m.rip = 0; }
  let dir = 0, k = 0;
  if (pl && !pl.dead) {
    if (pl.dashing > 0) { const kk = Math.max(0, 1 - dist / 72); if (kk > m.kick) { dir = pl.dashDir || (pl.vx < 0 ? -1 : 1); k = kk - m.kick; m.kick = kk; } } else m.kick = 0;
    m.passCd -= dt;
    if (!(pl.dashing > 0) && m.passCd < 0 && Math.abs(pl.vx) > 110 && dist < 30) { m.passCd = 1; const sd = pl.vx > 0 ? 1 : -1; pup.impulse('sway1', sd * 50).impulse('sway2', sd * 36).impulse('sway3', sd * 44).impulse('inner', 1.5); }
    const landed = !!pl.onGround && m.pAir && m.pvy > 220 && dist < 60; m.pAir = !pl.onGround; m.pvy = pl.vy;
    if (landed || cue === 'land') { const sd = dx < 0 ? 1 : -1, kk = landed ? Math.max(0.35, 1 - dist / 60) : 1; pup.impulse('sy', -3.5 * kk).impulse('sx', 1.6 * kk).impulse('sway1', sd * 70 * kk).impulse('sway2', -sd * 50 * kk).impulse('sway3', sd * 60 * kk).impulse('tip1', 10 * kk).impulse('tip3', 10 * kk).impulse('inner', 2 * kk); }
    const struck = pl.attackTimer > m.attackT; m.attackT = pl.attackTimer;
    if ((struck && dist < 32) || cue === 'strike') { const sd = pl.facing || 1; pup.impulse('sway1', sd * 150).impulse('sway2', sd * 110).impulse('sway3', sd * 130).impulse('tip1', 14).impulse('tip2', 18).impulse('tip3', 16).impulse('inner', 5).impulse('sy', 0.8); m.burstT = 0.2; }
  }
  if (cue === 'dash') { dir = 1; k = 1; }
  if (k > 0) { pup.impulse('sway1', dir * 170 * k).impulse('sway2', dir * 120 * k).impulse('sway3', dir * 140 * k).impulse('sx', 2 * k).impulse('sy', -1.6 * k).impulse('tip1', 12 * k).impulse('tip2', 16 * k).impulse('tip3', 14 * k).impulse('inner', 4 * k); }
  if (healed) { pup.impulse('inner', 10).impulse('halo', 4).impulse('tip1', 14).impulse('tip2', 20).impulse('tip3', 16).impulse('sy', 1.4).impulse('sx', -0.7).impulse('sway1', -40).impulse('sway2', 28).impulse('sway3', -36); m.burstT = 0; m.rip = 0; }
  // ---- idle life: a chime now and then (one shard flicks and rings down, its tip alight), more often while it hums
  m.chimeT -= dt * (1 + 1.5 * humK);
  if (m.chimeT < 0 || cue === 'chime') { m.chimeT = 2.5 + Math.random() * 5; const i = 1 + (Math.random() * 3 | 0); pup.impulse('sway' + i, (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 50)).impulse('tip' + i, 14 + Math.random() * 8).impulse('inner', 1.2); }
  // the glints travel up their edges, each on its own period, hurrying while the crystal hums or feeds; the ripples cycle while it hums
  const gs = 1 + 0.7 * humK + 0.8 * feedK, gk = m.gk;
  for (let i = 0; i < 3; i++) { m.gT[i] += dt * gs; const kk = (m.gT[i] / GLINT_PER[i]) % 1; gk[i] = kk * kk * (3 - 2 * kk); }
  if (humK > 0.02) m.rip += dt * (1 + 1.2 * feedK);
  let burst = 0; if (m.burstT >= 0) { m.burstT += dt; const kk = m.burstT / 0.5; if (kk >= 1) m.burstT = -1; else burst = Math.pow(1 - kk, 1.2); }
  // ---- targets: the breath (period ~3 s, the old pulse), brighter for company and brighter still while it feeds a rekindling;
  // the halo follows the light a beat behind and leans toward Mote within the warmth radius
  const breath = 0.5 + 0.5 * Math.sin(t * 2 + m.ph);
  pup.target({
    inner: 0.7 * breath * (1 - 0.5 * humK) + 0.15 * warmK * (1 - humK) + 0.45 * humK + 0.9 * feedK,
    halo: P.inner, hum: near || feeding ? 1 : 0, ring: m.rip % 1, burst, quiver: 1.3 * humK + feedK, qt: t,
    sway1: 0, sway2: 0, sway3: 0, tip1: 0, tip2: 0, tip3: 0, sx: 1, sy: 1,
    glint1: gk[0], glint2: gk[1], glint3: gk[2],
    hx: clamp(dx / WARM, -1, 1) * 1.6 * warmK,
  });
}

// world-space light over the body: the old drawing's halo (breathing with the light, a beat behind it, leaning toward Mote),
// the additive ring of brightness while it hums, and the bloom of a heal
function after(ctx, e, pup, info) {
  if (!info.glowAt) return; const P = pup.P, s = pup.scale || SCALE;
  const bx = e.tx * TILE + 8, by = e.ty * TILE + TILE; const halo = clamp(P.halo, 0, 1.5), hum = clamp(P.hum, 0, 1.2), burst = clamp(P.burst, 0, 1);
  info.glowAt(bx + clamp(P.hx, -3, 3) * s, by - 10, 12 * (0.9 + 0.2 * Math.min(halo, 1)) + 4 * hum, '#e6c8ff', clamp(0.1 + 0.16 * halo + 0.1 * hum, 0, 0.5));
  if (hum > 0.02) {
    const r = (10.5 + 0.35 * Math.sin(6.2832 * P.ring)) * s, cy = by - HY * s;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 3.5 * s; ctx.strokeStyle = `rgba(226,200,255,${(0.12 * hum).toFixed(3)})`; ctx.beginPath(); ctx.arc(bx, cy, r, 0, 6.2832); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(250,242,255,${(0.3 * hum).toFixed(3)})`; ctx.beginPath(); ctx.arc(bx, cy, r, 0, 6.2832); ctx.stroke();
    ctx.restore();
    info.glowAt(bx, by - 9, 22, '#d8b8ff', 0.08 * hum);
  }
  if (burst > 0.02) info.glowAt(bx, by - 9, 26, '#fff0ff', 0.3 * burst);
}

module.exports = { name: 'crystal', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
