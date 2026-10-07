// The lamp post of the Lanternry row: an iron post whose curved arm holds a hanging lantern.
//
// The old still (tools/art/props.js 'lamp') is the default pose; nothing about its silhouette, colours or size changes.
// The lantern hangs from the hook at the arm's tip and swings there on a spring, a pendulum with a long ring: a slow
// breeze drives it, gusts on a random timer (pup.mem) kick it, and when Mote dashes past (info.game.player.dashing,
// the kick growing with how close they pass) the wake throws it sideways, the top of the post shivers like a
// cantilever and the arm lags the post. The flame inside flickers on several sines, leans against the lantern's
// motion and with the wind, gutters now and then (a dip in brightness and height, a wobble) and flares back with the
// spring's overshoot; its halo swells a beat after the flame. A hard landing or a sprint right past the post nudge it
// too. after() throws the lantern's light on the world through info.glowAt at the lantern's actual, swinging position
// (the game's own light radius stays put at x+12,y-5; this is the part that follows). Decor never flips.
// See art/ANIMATION.md.
// Filmstrip aid: `cue` on the decor entity (--set '{"cue":"dash"}') fires one beat a moment later: dash, gust, gutter, thump.
const L = require('../lib');
const { svg, path, ell, circ, rect, stroke, g, rot, tr, glow, mix, clamp, num: n } = L;
const W = 26, H = 40;                       // template box; the post's foot sits on the bottom edge, as in the old still
const TILE = 16, SCALE = 0.7;               // world units per template unit (ART_SCALE.lamp)
const DEG = Math.PI / 180;
const IRON = '#3a3448', LAMP = '#4a4058', RIM = '#2a2638', GLASS = '#ffd27a', GLASS_DIM = '#b8823a', GLASS_HOT = '#fff0c4', WARM = '#fff4dc';
const TX = 9.2, TY = 12;                    // the top of the post, where the arm is fixed
const HX = 17, HY = 5.6;                    // the hook at the arm's tip, the lantern's pivot
const GX = 17, GY = 11;                     // the glass centre at rest, where the halo sits (HY + 5.4)
const ARM_PER_FLEX = 5;                     // degrees the arm tilts per template unit the post top bends (the post's tangent there)

const params = {
  swing: 0,     // the lantern's angle about its hook, in degrees; positive swings its bottom to the right
  flex: 0,      // the post top's sideways bend in template units (the post is a cantilever: it shivers when struck)
  arm: 0,       // the arm's droop in degrees about the post top (positive dips the hook); lags the post's flex
  flame: 1,     // the flame's brightness envelope: 1 = the still, lower in a gutter, above 1 in the flare after
  flick: 1,     // the fast flicker on top of it (set straight from the clock, no spring)
  lean: 0,      // the flame's lean in degrees about the wick, positive to the right
  tall: 1,      // the flame's height factor
  glowK: 1,     // the halo's size factor, a beat behind the flame
};
// [stiffness, damping ratio]: a slow, barely damped pendulum; a quick stiff post; a looser arm behind it; a lively flame
const springs = { swing: [30, 0.1], flex: [140, 0.22], arm: [90, 0.3], flame: [120, 0.45], lean: [170, 0.3], tall: [220, 0.35], glowK: [60, 1] };
// stills: default is the old art/lamp.svg; the others are the lantern's readable moments
const poses = {
  default: {},
  swing: { swing: 14, lean: -12, flex: 0.25, arm: -0.5, tall: 1.05 },
  gust: { swing: -20, flex: -0.9, arm: 1.6, lean: 22, flame: 0.75, tall: 0.7, glowK: 0.8 },
  gutter: { flame: 0.4, tall: 0.5, lean: 8, glowK: 0.5 },
  flare: { flame: 1.3, tall: 1.25, glowK: 1.35, swing: 3 },
};

// the glass centre in template space after the swing about the hook, the arm's tilt and the post's bend (one shared array)
const AT = [GX, GY];
function lanternAt(P) {
  const sw = clamp(P.swing, -60, 60) * DEG, fx = clamp(P.flex, -3, 3), ph = (fx * ARM_PER_FLEX + P.arm) * DEG;
  const x1 = HX + (GY - HY) * Math.sin(sw), y1 = HY + (GY - HY) * Math.cos(sw);
  const dx = x1 - TX, dy = y1 - TY, c = Math.cos(ph), s = Math.sin(ph);
  AT[0] = TX + dx * c - dy * s + fx; AT[1] = TY + dx * s + dy * c; return AT;
}
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

function make(P) {
  const sw = clamp(P.swing, -60, 60), fx = r2(clamp(P.flex, -3, 3)), b = clamp(P.flame * P.flick, 0, 1.4), tall = clamp(P.tall, 0.2, 1.6), gk = clamp(0.5 + 0.5 * P.glowK, 0.3, 1.3);
  const at = lanternAt(P);
  // ---- the halo, under everything, where the glass is now; the ground and the post (bent at the top by flex)
  const halo = glow(r1(at[0]), r1(at[1]), r1(12 * gk), '#ffc060', r2(clamp(0.5 * b, 0, 0.7)));
  const ground = ell(9, 39, 5, 1.6, RIM);
  const post = stroke(`M9.2 37.8 Q9.2 24 ${n(TX + fx)} 13.2`, IRON, 2.4);
  // ---- the lantern: body, glass (its colour follows the brightness), the flame leaning about its wick, the glass's top sheen
  const glass = b < 1 ? mix(GLASS_DIM, GLASS, clamp((b - 0.3) / 0.7, 0, 1)) : mix(GLASS, GLASS_HOT, Math.min(1, (b - 1) * 2.5));
  const fh = 3.6 * tall;
  const flame = g([
    path(`M17 13 C15.7 11.7 15.9 ${n(13 - fh * 0.55)} 17 ${n(13 - fh)} C18.1 ${n(13 - fh * 0.55)} 18.3 11.7 17 13 Z`, WARM, { opacity: r2(clamp(0.3 + 0.7 * b, 0, 1)) }),
    ell(17, r2(12.3 - fh * 0.14), 0.55, r2(0.45 + fh * 0.18), '#ffffff', { opacity: r2(clamp(b - 0.35, 0, 1)) }),
  ], { transform: rot(clamp(P.lean, -32, 32), 17, 13) });
  const lantern = g([
    rect(14, 6, 6, 9, LAMP, { rx: 1.2, stroke: RIM, strokeWidth: 0.6 }),
    rect(15.3, 7.5, 3.4, 6, glass, { rx: 0.8 }),
    flame,
    rect(15.3, 7.5, 3.4, 1.6, WARM, { opacity: 0.9 }),
  ], { transform: rot(-sw, HX, HY) });
  // ---- the arm carries the hook and the lantern; it rides the post top and tilts with the post's bend plus its own droop
  const arm = g([stroke('M9.2 12 C9.2 6 13 5 17 6', IRON, 1.8), lantern, circ(17, 5.5, 1.2, LAMP)], { transform: `${tr(fx, 0)} ${rot(fx * ARM_PER_FLEX + P.arm, TX, TY)}` });
  return svg(W, H, [halo, ground, post, arm]);
}

// ---- animation: the breeze, the gusts, the flame's life and the player's passing, turned into targets every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, game = info.game, P = pup.P, V = pup.V;
  if (m.init === undefined) {
    m.init = true; m.t0 = Math.random() * 20; m.ph = Math.random() * 6.3; m.ph2 = Math.random() * 6.3;
    m.gust = 1.5 + Math.random() * 5; m.gutter = 3 + Math.random() * 6; m.gutT = 0; m.wind = 0; m.windT = 0; m.windT0 = 1;
    m.kick = 0; m.passCd = 0; m.pAir = false; m.pvy = 0; m.cue = null; m.cueT = -1;
  }
  const s = pup.scale || SCALE, t = pup.time + m.t0;
  const at = lanternAt(P); const lx = e.tx * TILE + 8 + (at[0] - 13) * s, ly = e.ty * TILE + TILE + (at[1] - H) * s; // the lantern in world units
  // ---- a cue set on the entity (filmstrips) fires one beat a moment later
  if (e.cue !== m.cue) { m.cue = e.cue; if (e.cue) m.cueT = 0.25; }
  let cue = null; if (m.cueT >= 0) { m.cueT -= dt; if (m.cueT < 0) cue = m.cue; }
  // ---- the player: a dash past kicks the lantern, the wake building as they come closer; a sprint past or a hard landing nudges it
  const pl = game && game.player; let dir = 0, k = 0;
  if (pl && !pl.dead) {
    const dx = pl.x + pl.w / 2 - lx, dy = pl.y + pl.h / 2 - ly, dist = Math.hypot(dx, dy);
    if (pl.dashing > 0) { const kk = Math.max(0, 1 - dist / 72); if (kk > m.kick) { dir = pl.dashDir || (pl.vx < 0 ? -1 : 1); k = kk - m.kick; m.kick = kk; } }
    else m.kick = 0;
    m.passCd -= dt;
    if (!(pl.dashing > 0) && m.passCd < 0 && Math.abs(pl.vx) > 110 && dist < 30) { m.passCd = 1.2; const sd = pl.vx > 0 ? 1 : -1; pup.impulse('swing', sd * 28).impulse('lean', sd * 140).impulse('flex', sd * 1.5); }
    const landed = !!pl.onGround && m.pAir && m.pvy > 220 && dist < 56; m.pAir = !pl.onGround; m.pvy = pl.vy;
    if (landed || cue === 'thump') { const sd = dx < 0 ? 1 : -1, kk = landed ? Math.max(0.35, 1 - dist / 56) : 1; pup.impulse('flex', sd * 8 * kk).impulse('swing', sd * 26 * kk).impulse('tall', -3 * kk).impulse('lean', -sd * 90 * kk); }
  }
  if (cue === 'dash') { dir = 1; k = 1; }
  if (k > 0) { // the wake of a dash: the lantern thrown sideways, the post struck, the flame blown over and dimmed
    pup.impulse('swing', dir * 150 * k).impulse('flex', dir * 14 * k).impulse('arm', dir * 30 * k).impulse('lean', dir * 300 * k).impulse('flame', -2.5 * k).impulse('tall', -3 * k);
    m.wind = dir * k; m.windT = m.windT0 = 0.4;
  }
  // ---- idle life: the breeze's gusts, the flame's gutters
  m.gust -= dt; if (m.gust < 0 || cue === 'gust') { m.gust = 2 + Math.random() * 5; const gd = Math.random() < 0.5 ? -1 : 1, gk = 0.3 + Math.random() * 0.7; pup.impulse('swing', gd * 90 * gk).impulse('lean', gd * 200 * gk).impulse('flame', -1.5 * gk).impulse('flex', gd * 1.5 * gk); m.wind = gd * gk * 0.5; m.windT = m.windT0 = 0.5; }
  m.gutter -= dt; if (m.gutter < 0 || cue === 'gutter') { m.gutter = 4 + Math.random() * 8; m.gutT = 0.18 + Math.random() * 0.2; pup.impulse('lean', (Math.random() - 0.5) * 360).impulse('tall', -2); }
  if (m.gutT > 0) m.gutT -= dt; if (m.windT > 0) m.windT -= dt;
  const gut = m.gutT > 0, windK = m.windT > 0 ? m.wind * (m.windT / m.windT0) : 0;
  const flick = 1 + 0.09 * Math.sin(t * 9 + m.ph) + 0.05 * Math.sin(t * 23.7 + m.ph2) + 0.03 * Math.sin(t * 41 + 1.3);
  const drive = 3.5 * Math.sin(t * 0.9 + m.ph) + 1.5 * Math.sin(t * 0.37 + m.ph2);
  // ---- secondary motion: the arm lags the post, the flame lags the lantern (its lean follows the swing's velocity) and bends with the wind, the halo follows the flame
  pup.target({
    swing: drive + windK * 6, flex: 0, arm: -P.flex * 2.5,
    flame: (gut ? 0.4 : 1) - 0.2 * Math.abs(windK), flick,
    lean: clamp(-(V.swing || 0) * 0.09, -24, 24) + windK * 32 + (gut ? 7 * Math.sin(t * 34) : 0),
    tall: (gut ? 0.55 : 1) + 0.12 * Math.sin(t * 13 + m.ph) + 0.08 * Math.sin(t * 31 + m.ph2) - 0.15 * Math.abs(windK),
    glowK: (gut ? 0.5 : 1) + 0.08 * Math.sin(t * 2.1 + m.ph2) + 0.5 * (flick - 1),
  });
}

// world-space light over the body: the lantern's glow on its surroundings, following the swing and breathing with the flame
function after(ctx, e, pup, info) {
  if (!info.glowAt) return; const P = pup.P, s = pup.scale || SCALE; const at = lanternAt(P);
  const b = clamp(P.flame * P.flick, 0, 1.4), gk = clamp(0.5 + 0.5 * P.glowK, 0.3, 1.3);
  const wx = e.tx * TILE + 8 + (at[0] - 13) * s, wy = e.ty * TILE + TILE + (at[1] - H) * s;
  info.glowAt(wx, wy, 16 * gk, '#ffb347', 0.3 * b);
  info.glowAt(wx + (at[0] - GX) * s * 1.5, e.ty * TILE + TILE - 1, 9 + 3 * gk, '#ffb347', 0.07 * b); // the pool on the ground under it, sliding with the swing
}

module.exports = { name: 'lamp', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
