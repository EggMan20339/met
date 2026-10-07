// The hearth: a ring of stones around two crossed logs, cold until Mote rests there, then a living fire.
//
// src/game.js: a hearth is static decor (tx, ty, type 'B'); interact() sits the player down, makes it game.benchPos (the
// current rest point: info.active) and adds it to game.benchesSeen (kindled for good: info.lit). make(P, pup) is a pure
// drawing of the parameters; control(ent, pup, info) animates: cold, the stones are dark and one faint ember breathes
// under a thread of smoke (a verlet chain in the draughts), flaring now and then and letting a spark go; kindled, three
// tongues of flame whose tips and bends ride different sine mixes plus smoothed noise from pup.mem, a bright core that
// flickers, sparks that rise on a timer, licks of flame that detach from the tip, crackles (a flash at a log end, the
// fire squats and jumps back up, quick sparks) and gusts (the flames flatten and lean hard, then swing back on a spring);
// the current rest point burns bigger and steadier, the flames lean toward Mote when they come near and the fire swells
// to greet them when they sit, then breathes slowly with them; kindling is a flare-up (the ember blazes, the fire shoots
// up with overshoot, a ring spreads, a shower of sparks, a bloom of light, the stones warm up slowly) found by watching
// info.lit in pup.mem. The light lags the fire on its own spring (glowK). after() throws the fire's light on the world
// (info.glowAt), as the old sprites.js drawing did: bigger and steadier at the rest point, a faint pulse from a cold ember.
const L = require('../lib');
const { svg, lin, path, ell, circ, stroke, g, tr, glow, curve, mix, clamp } = L;
const W = 40, H = 30, BASE = 25;              // bottom-centre anchor; the fire stands on the logs at y 25
const TILE = 16, SCALE = 0.75;                // world units per template unit (ART_SCALE.hearth)
const STONES = [[6, 26, 4, 2.4], [12, 28, 4.2, 2.2], [20, 28.5, 4.5, 2.2], [28, 28, 4.2, 2.2], [34, 26, 4, 2.4], [9, 23, 3, 1.8], [31, 23, 3, 1.8]];
const STONE_O = { stroke: '#2a2638', strokeWidth: 0.7 };
const LOG1 = 'M11 25 L29 22', LOG2 = 'M12 22 L28 26';
const HILITE = 'M9.6 26.5 Q12 25.7 14.6 26.4 M17.2 27 Q20 26.2 22.8 27 M25.4 26.4 Q28 25.7 30.4 26.5 M7.2 22.4 Q9 21.5 10.8 22.3 M29.2 22.3 Q31 21.5 32.8 22.4'; // the stones' faces toward the fire
const CRACKS = 'M11.6 25 L13.6 24.7 M26.6 22.4 L28.4 22.1 M12.6 22.2 L14.4 22.6 M26 25.5 L27.6 25.9';                                               // glowing splits in the log ends
// the tongues of flame: [base centre x, base half-width, tip x offset, height at heat 1, tip wobble amplitude]; back, left, right, and the core
const T_BACK = [20, 7.5, 0, 16, 1.6], T_LEFT = [16.5, 4.5, 0.5, 17, 2.6], T_RIGHT = [22, 5.5, 0.5, 19, 3], T_CORE = [19.5, 3.5, 0, 12, 1.8];
const SMOKE_REST = [{ x: 0.3, y: -4.5 }, { x: -0.6, y: -9 }, { x: 0.9, y: -13.5 }, { x: 2.2, y: -17.5 }];        // the smoke thread, anchored at the ember
const SMOKE_PTS = [{ x: 20, y: 21.5 }].concat(SMOKE_REST.map((p) => ({ x: 20 + p.x, y: 21.5 + p.y })));
const SPARKS_STILL = [15, 6, 0.8, 0.8, 0, 24, 3, 0.8, 0.8, 0, 19, 2, 0.8, 0.8, 0];   // the old still's three sparks: x, y, alpha, radius, lick?
const SPARKS = 8, SP = 7, SO = 5;             // sparks in flight: a ring of SPARKS records of SP floats (x, y, vx, vy, age, life, size), template units; SO floats each as drawn
// the kindling flare-up, on its own timer in pup.mem: the ember blazes, a ring spreads from it, the light blooms and fades
const KINDLE = [[0, { ring: 0, ember: 1.8, bloom: 1 }], [0.08, { ring: 0.06, ember: 1.8, bloom: 0.9 }, 'outQuad'], [0.45, { ring: 1, ember: 1.25, bloom: 0.15 }, 'outCubic'], [0.8, { ring: 1, ember: 1, bloom: 0 }, 'outQuad']];
const n = (v) => +v.toFixed(2), qz = (v) => Math.round(v * 50) / 50;        // path numbers, and gradient numbers quantised so the canvas gradient cache hits

const params = {
  lit: 1,            // 0 cold .. 1 kindled: the stones and logs warm up (slow), the fire takes over from the ember
  heat: 1,           // the fire's size: 0 none, 1 a kindled hearth, 1.25 the current rest point, ~1.8 at the top of a flare-up
  glowK: 1,          // the fire's light, following heat on a slower spring: the inner glow and the world glow swell after the flames
  sx: 1, sy: 1,      // the fire's squash and stretch about its base (impulses on crackles, gusts, greetings and the flare-up)
  lean: 0,           // the flames' lean at the tips, template units (gusts kick it; it lags and swings back)
  w1x: 0, w1y: 0, m1: 0, // the back tongue's tip wobble (x, height) and mid-bend, -1..1 (sine mixes plus noise, set by control)
  w2x: 0, w2y: 0, m2: 0, // the left tongue's
  w3x: 0, w3y: 0, m3: 0, // the right tongue's (the core follows the left and right)
  core: 1,           // the bright core's brightness, 0.5..1.2 (flicker)
  flick: 1,          // the fire light's flicker, 0.7..1.1: the inner glow, the bed, the stones' highlights and the log cracks
  ember: 0.35,       // the ember's brightness: ~0.35 glowing faintly, ~0.9 in a cold flicker, 1.8 as it blazes when kindled
  ring: 0,           // the kindling ring: 0 none, 0..1 spreading and fading
  pop: 0, popX: 20,  // a crackle's flash at popX, 1..0
  smoke: 0,          // the smoke thread's visibility (a cold hearth's ember smokes; it burns off when kindled)
  sparks: SPARKS_STILL, // [x, y, alpha, radius, lick, ...] the sparks in flight (control keeps a ring of them in pup.mem); a lick is a detached blob of flame
};
// [stiffness, damping ratio]: the fire's size, lean and stretch overshoot and settle; the light lags; the stones warm up without a bounce
const springs = { lit: [8, 1], heat: [70, 0.45], glowK: [25, 0.8], sx: [260, 0.4], sy: [260, 0.4], lean: [60, 0.3], ember: [90, 1], smoke: [6, 1] };
// stills exported to art/hearth_<pose>.svg: the old hearth and hearth_cold, plus the rest point and the moment of kindling
const poses = {
  lit: {},
  cold: { lit: 0, heat: 0, glowK: 0, ember: 0.35, smoke: 1, flick: 0, sparks: [] },
  active: { heat: 1.25, glowK: 1.25, core: 1.1 },
  kindle: { lit: 0.35, heat: 1.6, glowK: 1.3, sy: 1.08, ember: 1.6, ring: 0.45, core: 1.2, sparks: [14, 10, 0.9, 0.9, 0, 25, 6, 0.9, 0.8, 0, 19, 1, 0.8, 0.7, 0, 28, 12, 0.7, 0.6, 0, 11, 14, 0.7, 0.6, 0] },
};

function make(P, pup) {
  const lit = clamp(P.lit, 0, 1), hK = Math.max(0, P.heat), gK = clamp(P.glowK, 0, 1.8), fireA = clamp(hK * 1.8, 0, 1), fl = clamp(P.flick, 0, 1.4), warm = lit * fl * fireA, lean = P.lean;
  // ---- the stone ring, warmed by the fire; the logs; glowing splits in their ends
  const stoneF = mix('#4a4460', '#5a5470', lit);
  const stones = STONES.map((s) => ell(s[0], s[1], s[2], s[3], stoneF, STONE_O));
  const hi = warm > 0.02 ? stroke(HILITE, '#ffb060', 0.7, { opacity: 0.38 * warm }) : null;
  const logs = [stroke(LOG1, mix('#3a2a1e', '#4a2f1e', lit), 3), stroke(LOG2, mix('#4a3224', '#5a3a24', lit), 3)];
  const cracks = warm > 0.02 ? stroke(CRACKS, '#ff9a4c', 0.6, { opacity: 0.7 * warm }) : null;
  // ---- the ember: a faint coal when cold, blazing as it kindles, hidden under the fire once lit
  const eK = Math.max(0, P.ember);
  const ember = [circ(20, 22.3, 3 + 3 * eK, '#ff8a3c', { opacity: clamp(0.5 * (eK - 0.3), 0, 0.6) * (1 - 0.8 * lit) }),
    circ(20, 22, 1.65 + eK, mix('#ff8a3c', '#fff4c0', clamp(eK - 0.5, 0, 1)), { opacity: clamp(eK, 0, 1) * (1 - 0.5 * lit) })];
  // ---- the smoke thread (the chain when animated, its rest curve for the stills): a soft haze around a thin thread
  const sk = clamp(P.smoke, 0, 1); const sd = sk > 0.02 ? curve(pup && pup.chains.smoke ? pup.chains.smoke.points() : SMOKE_PTS) : null;
  const smoke = sd ? [stroke(sd, '#9a90a8', 2.4, { opacity: 0.07 * sk }), stroke(sd, '#b0a8bc', 1, { opacity: 0.2 * sk })] : null;
  // ---- the fire: three tongues and a core, each a path whose tip and mid-bend wobble; taller tongues lean more
  const top = BASE - 19 * hK;
  const fg = lin('hf', 20, qz(top), 20, 26, [[0, '#ffe08a'], [0.6, '#ff8a3c'], [1, '#c83a10']]);
  const bg = lin('hb', 20, qz(top + 3), 20, 26, [[0, '#ffb060'], [0.55, '#ff6a2c'], [1, '#a82a0c']]);
  const tongue = (T, wx, wy, m, fill, o) => {
    const h = T[3] * hK * (1 + 0.16 * wy); if (h < 0.05) return null;
    const k = h / 19, bx = T[0], hw = T[1] * (0.85 + 0.15 * Math.min(hK, 1.3)); const tipX = bx + T[2] + wx * T[4] + lean * k, tipY = BASE - h, mid = m * 2.6 + lean * 0.45 * k;
    // a full base, sides that bulge out then pull in to a slender lick under the tip (the right side fuller, as in the old still)
    return path(`M${n(bx - hw)} ${BASE} C${n(bx - hw - 0.8)} ${n(BASE - h * 0.4)} ${n(tipX - hw * 0.25 + mid)} ${n(tipY + h * 0.4)} ${n(tipX)} ${n(tipY)} C${n(tipX + hw * 0.45 + mid)} ${n(tipY + h * 0.36)} ${n(bx + hw + 0.5)} ${n(BASE - h * 0.5)} ${n(bx + hw)} ${BASE} Z`, fill, o);
  };
  const fire = fireA > 0.02 ? g([
    tongue(T_BACK, P.w1x, P.w1y, P.m1, bg, { opacity: 0.9 }),
    tongue(T_LEFT, P.w2x, P.w2y, P.m2, fg),
    tongue(T_RIGHT, P.w3x, P.w3y, P.m3, fg),
    ell(20 + lean * 0.1, 24.2, 5.5 * Math.min(hK, 1.3), 1.4, '#ffd27a', { opacity: 0.5 * fl }),
    tongue(T_CORE, (P.w2x + P.w3x) * 0.4, (P.w2y + P.w3y) * 0.5, (P.m2 + P.m3) * 0.5, '#fff4c0', { opacity: 0.85 * clamp(P.core, 0, 1.2) }),
  ], { transform: `${tr(20, BASE)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-20, -BASE)}`, opacity: fireA }) : null;
  const gl = fireA > 0.02 && gK > 0.05 ? glow(20, qz(BASE - 7 * Math.min(gK, 1.6)), qz(16 * clamp(gK, 0.5, 1.5)), '#ffb347', qz(0.45 * fireA * fl * Math.min(gK, 1.2))) : null;
  // ---- sparks and licks in flight, a crackle's flash, the kindling ring
  const sp = P.sparks, sparks = [];
  for (let i = 0; i + 4 < sp.length; i += SO) if (sp[i + 2] > 0.03) sparks.push(sp[i + 4] > 0.5 ? ell(sp[i], sp[i + 1], sp[i + 3] * 0.7, sp[i + 3] * 1.15, '#ffb347', { opacity: Math.min(1, sp[i + 2]) }) : circ(sp[i], sp[i + 1], sp[i + 3], '#ffd27a', { opacity: Math.min(1, sp[i + 2]) }));
  const pop = P.pop > 0.02 ? circ(P.popX, 24, 1.2 + 2.2 * (1 - P.pop), '#fff4c0', { opacity: 0.9 * P.pop }) : null;
  const ring = P.ring > 0 && P.ring < 1 ? circ(20, 22, 2 + P.ring * 20, 'none', { stroke: '#ffe8b0', strokeWidth: 0.3 + 1.6 * (1 - P.ring), opacity: 0.85 * (1 - P.ring) }) : null;
  return svg(W, H, [gl, smoke, stones, hi, logs, cracks, ember, fire, sparks, pop, ring]);
}

// a spark (or, with size > 1.2, a lick of flame) set going from (x, y) in template units
function spark(m, x, y, vx, vy, life, size) {
  const o = m.si * SP; m.si = (m.si + 1) % SPARKS;
  m.sp[o] = x; m.sp[o + 1] = y; m.sp[o + 2] = vx; m.sp[o + 3] = vy; m.sp[o + 4] = 0; m.sp[o + 5] = life; m.sp[o + 6] = size;
}

// ---- animation: from the game's state (kindled? the rest point? Mote near or sitting?) to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, t = pup.time, P = pup.P;
  const lit = !!info.lit, active = !!info.active; const p = info.game && info.game.player;
  if (m.init === undefined) {
    m.init = true; m.ph = ((e.tx || 0) * 1.7 + (e.ty || 0) * 0.9) % 6.283; m.lit = lit; m.active = active; m.sitting = false; m.nearK = 0;
    m.nv = new Float32Array(12); m.nt = new Float32Array(12); m.nT = new Float32Array(12);       // noise channels: value, target, time to the next target
    m.sp = new Float32Array(SPARKS * SP); m.out = new Float32Array(SPARKS * SO); m.si = 0; m.burst = 0; m.burstX = -1; m.burstVX = 0;
    m.sparkT = 0.3; m.lickT = 1 + Math.random() * 2; m.gustT = 2 + Math.random() * 4; m.popT = 1.5 + Math.random() * 3; m.popK = 0; m.popX = 20; m.flickT = 1 + Math.random() * 3; m.flT = 0; m.flareT = -1; m.greet = 0; m.bloom = 0; m.puff = 0; m.puffV = 0;
    pup.snap({ lit: lit ? 1 : 0, heat: lit ? (active ? 1.25 : 1) : 0, glowK: lit ? (active ? 1.25 : 1) : 0, ember: lit ? 1 : 0.35, smoke: lit ? 0 : 1, sparks: m.out }); // no flare-up for a hearth found already burning
  }
  // ---- events, found by watching the game's flags change: kindled (first rest here), made the rest point, Mote sitting down
  const kindled = lit && !m.lit, activated = active && !m.active; m.lit = lit; m.active = active;
  let dx = 0, near = 0, sitting = false;
  if (p) { dx = p.x + p.w / 2 - (e.tx * TILE + 8); const dy = p.y + p.h - (e.ty * TILE + TILE); near = Math.abs(dx) < 44 && Math.abs(dy) < 36 ? 1 : 0; sitting = active && !!p.sitting && Math.abs(dx) < 20; }
  m.nearK += (near - m.nearK) * Math.min(1, dt * 3);
  const sat = sitting && !m.sitting; m.sitting = sitting;
  if (kindled) { m.flareT = 0; pup.impulse('heat', 9).impulse('sy', 3).impulse('sx', -1.2); pup.snap({ smoke: 0 }); if (pup.chains.smoke) pup.chains.smoke.reset(); m.burst = 9; m.burstX = -1; m.burstVX = 0; }
  else if (lit && (sat || activated)) { pup.impulse('heat', 2.6).impulse('sy', 1.6); m.burst += 4; m.burstX = -1; m.burstVX = 0; m.greet = 0.6; }
  // ---- noise: each channel eases toward a target re-rolled every 70-270 ms
  for (let i = 0; i < 12; i++) { m.nT[i] -= dt; if (m.nT[i] < 0) { m.nT[i] = 0.07 + Math.random() * 0.2; m.nt[i] = Math.random() * 2 - 1; } m.nv[i] += (m.nt[i] - m.nv[i]) * Math.min(1, dt * 12); }
  const nv = m.nv; const amp = (active ? 0.65 : 1) * (sitting ? 0.8 : 1);   // the rest point burns steadier, more so with company
  // ---- the fire's own life: gusts (the flames flatten and lean hard, then swing back), crackles (a flash at a log end, the fire
  // squats and jumps back up, quick sparks from the split) and licks (a blob of flame detaches from the tip and burns out)
  if (lit && P.heat > 0.5) {
    m.gustT -= dt; if (m.gustT < 0) { m.gustT = 3 + Math.random() * 6; const dir = Math.random() < 0.5 ? -1 : 1; pup.impulse('lean', dir * (90 + Math.random() * 40) * (active ? 0.7 : 1)).impulse('sy', -1.5).impulse('sx', 1.2).impulse('heat', 0.6); m.burst += 2; m.burstX = -1; m.burstVX = dir * 14; }
    m.popT -= dt; if (m.popT < 0) { m.popT = 2 + Math.random() * 4; m.popK = 1; m.popX = Math.random() < 0.5 ? 12 + Math.random() * 2 : 26 + Math.random() * 2; pup.impulse('sy', -4).impulse('sx', 2).impulse('heat', -2.5); m.burst += 1 + (Math.random() * 2 | 0); m.burstX = m.popX; }
    m.lickT -= dt; if (m.lickT < 0) { m.lickT = 1.2 + Math.random() * 1.8; const h = 19 * Math.min(P.heat, 1.4); spark(m, 22.5 + P.w3x * 3 + P.lean, BASE - h + 3, (Math.random() - 0.5) * 4 + P.lean * 0.5, -9 - Math.random() * 5, 0.45 + Math.random() * 0.2, 1.8); }
  }
  m.popK = Math.max(0, m.popK - dt * 6);
  // ---- the kindling clip and the cold ember's breathing and flickers
  let ring = 0, emberT = lit ? 1 : 0.35 + 0.14 * Math.sin(t * 1.9 + m.ph), bloom = 0;
  if (m.flareT >= 0) { m.flareT += dt; const c = Anim.keys(m.flareT, KINDLE); ring = c.ring; emberT = Math.max(emberT, c.ember); bloom = c.bloom; if (m.flareT > 0.8) m.flareT = -1; }
  if (!lit) { m.flickT -= dt; if (m.flickT < 0) { m.flickT = 2.5 + Math.random() * 5; m.flT = 0.35; m.puff = 0.5; m.puffV = (Math.random() < 0.5 ? -1 : 1) * 40; spark(m, 20 + (Math.random() - 0.5) * 2, 21, (Math.random() - 0.5) * 6, -7 - Math.random() * 5, 1.2, 1); } }
  if (m.flT > 0) { m.flT -= dt; emberT = Math.max(emberT, 0.9); }
  m.puff = Math.max(0, m.puff - dt); m.greet = Math.max(0, m.greet - dt * 1.5); m.bloom = Math.max(bloom, m.greet * 0.5);
  // ---- sparks: one now and then from the flames (more at the rest point and for company), a shower on events
  m.sparkT -= dt; const sp = m.sp;
  if ((lit && P.heat > 0.3 && m.sparkT < 0) || m.burst > 0) {
    const burst = m.burst > 0; if (burst) m.burst--; else m.sparkT = (active ? 0.25 : 0.45) * (1 - 0.35 * m.nearK) * (0.6 + Math.random() * 0.8);
    if (burst && m.burstX >= 0) spark(m, m.burstX + (Math.random() - 0.5) * 2, 23.5, (m.burstX < 20 ? -1 : 1) * (6 + Math.random() * 14), -22 - Math.random() * 18, 0.4 + Math.random() * 0.4, 1);
    else { const h = 19 * Math.min(P.heat, 1.4); spark(m, 16 + Math.random() * 8 + P.lean * 0.3, BASE - h * (0.3 + Math.random() * 0.6), (Math.random() - 0.5) * 10 + P.lean * 0.8 + (burst ? m.burstVX : 0), -(14 + Math.random() * 16) * (burst ? 1.5 : 1), 0.5 + Math.random() * 0.5, 1); }
    if (!burst || m.burst === 0) { m.burstX = -1; m.burstVX = 0; }
  }
  for (let i = 0; i < SPARKS; i++) {
    const o = i * SP, q = i * SO, life = sp[o + 5]; if (life <= 0 || sp[o + 4] >= life) { m.out[q + 2] = 0; continue; }
    sp[o + 4] += dt; sp[o] += (sp[o + 2] + Math.sin(sp[o + 4] * 11 + i * 1.7) * 5 + P.lean * 0.5) * dt; sp[o + 1] += sp[o + 3] * dt; sp[o + 3] += 12 * dt;
    if (sp[o + 1] < -8) sp[o + 4] = life;
    const k = 1 - sp[o + 4] / life, lick = sp[o + 6] > 1.2; m.out[q] = sp[o]; m.out[q + 1] = sp[o + 1]; m.out[q + 2] = Math.min(1, k * 1.6); m.out[q + 3] = sp[o + 6] * (0.45 + 0.55 * k); m.out[q + 4] = lick ? 1 : 0;
  }
  // ---- the smoke thread drifts up from the ember in the draughts, puffed by a flicker, bent by a gust
  pup.chain('smoke', 20, 21.5, SMOKE_REST).update(dt, { gravity: -14, drag: 0, stiff: 2.5, damp: 0.9, wind: { x: Math.sin(t * 1.3 + m.ph) * 7 + Math.sin(t * 3.1) * 3 + m.puffV * m.puff + P.lean * 2, y: -3 + Math.sin(t * 0.8) * 3 } });
  // ---- targets: the tongues' wobble on different frequencies plus noise, the core and light flicker, the lean toward Mote
  const heatT = lit ? (active ? 1.25 : 1) + 0.1 * m.nearK + (sitting ? 0.1 + 0.05 * Math.sin(t * 1.6) : 0) : 0;
  pup.target({
    lit: lit ? 1 : 0, heat: heatT, glowK: heatT, ember: emberT, smoke: lit ? 0 : 1, ring, pop: m.popK, popX: m.popX,
    lean: lit ? Math.sign(dx) * 2.2 * m.nearK : 0,
    w1x: amp * (0.55 * Math.sin(t * 7.3 + m.ph) + 0.3 * Math.sin(t * 4.1 + 1.3) + 0.5 * nv[0]), w1y: amp * (0.5 * Math.sin(t * 6.1 + 0.7 + m.ph) + 0.6 * nv[1]), m1: amp * (0.5 * Math.sin(t * 5.3 + 2.1) + 0.6 * nv[2]),
    w2x: amp * (0.55 * Math.sin(t * 10.1 + 0.4 + m.ph) + 0.3 * Math.sin(t * 6.3 + 2.5) + 0.5 * nv[3]), w2y: amp * (0.5 * Math.sin(t * 8.7 + 1.9) + 0.6 * nv[4]), m2: amp * (0.5 * Math.sin(t * 7.9 + 0.3) + 0.6 * nv[5]),
    w3x: amp * (0.55 * Math.sin(t * 12.7 + 1.1 + m.ph) + 0.3 * Math.sin(t * 5.1 + 0.9) + 0.5 * nv[6]), w3y: amp * (0.5 * Math.sin(t * 9.3 + 2.4) + 0.6 * nv[7]), m3: amp * (0.5 * Math.sin(t * 11.3 + 1.6) + 0.6 * nv[8]),
    core: 0.85 + amp * (0.15 * Math.sin(t * 14.3 + m.ph) + 0.1 * Math.sin(t * 23.1) + 0.2 * nv[9]) + m.popK * 0.3,
    flick: 0.9 + amp * (0.1 * Math.sin(t * 9 + m.ph) + 0.08 * nv[10]) + m.popK * 0.2,
  });
}

// world-space light over the body: the fire's glow on its surroundings (the old drawing's, bigger and steadier at the rest
// point, swelling after the fire on glowK), a cold ember's faint pulse, and the bloom of a kindling or a greeting
function after(ctx, e, pup, info) {
  const P = pup.P, m = pup.mem; if (!info.glowAt || !m.init) return;
  const bx = e.tx * TILE + 8, by = e.ty * TILE + TILE; const lit = clamp(P.lit, 0, 1), gK = clamp(P.glowK, 0, 1.8), fireA = clamp(Math.max(0, P.heat) * 1.8, 0, 1), fl = clamp(P.flick, 0, 1.4), eK = Math.max(0, P.ember);
  if (fireA > 0.02 && gK > 0.05) info.glowAt(bx + P.lean * 0.2 * (pup.scale || SCALE), by - 9 * Math.min(gK, 1.4), 24 * (0.75 + 0.25 * gK), '#ffb347', 0.28 * fl * fireA * Math.min(gK, 1.3));
  if (lit < 0.98) info.glowAt(bx, by - 6, 10 + 8 * Math.max(0, eK - 0.35), '#ff8a3c', (0.04 + 0.23 * Math.min(eK, 1.2)) * (1 - lit));
  if (m.bloom > 0.02) info.glowAt(bx, by - 8, 30, '#ffe0a0', 0.35 * m.bloom);
}

module.exports = { name: 'hearth', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
