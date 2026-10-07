// Hushmoth: a moth whose wing eye-spots are the only bright thing left on it.
//
// It flutters around its home on a slow figure-eight and chases Mote when aggro (src/entities.js case 'f': the state
// stays 'idle'; e.aggro and the velocity carry everything). make(P, pup) is a pure drawing of the parameters; control()
// reads the entity every frame: the wing beat is a phase kept in pup.mem whose rate rises with speed, the body yaws
// into its flight line and banks (the leading wing foreshortens), the abdomen swings behind on a loose spring, the
// antennae are verlet chains streaming in the airflow, the eye-spots light up when it hunts and leave light streaks
// behind it (before()), the alert is a freeze with wings spread wide and a flare of the spots, and a hit sends it
// into a backward tumble with its wings folded limp before they snap open again.
const L = require('../lib');
const { svg, lin, path, ell, circ, stroke, g, rot, tr, curve, mix, clamp } = L;
const W = 26, H = 20, CX = 13, CY = 10; // centre anchor
const SCALE = 0.6;  // world units per template unit (ART_SCALE.hushmoth), for the antennae and the light streaks
const SPEED = 72;   // chase speed (ENEMY_DEFS.f.speed): the reference for flap rate, lean and bank
const ANT_Y = 6, ANT_LX = 12, ANT_RX = 14; // antenna roots on the head
const ANT_L = [{ x: -1.3, y: -2 }, { x: -2.6, y: -2.8 }, { x: -3.5, y: -2.5 }], ANT_R = ANT_L.map((p) => ({ x: -p.x, y: p.y }));
const ANT_L_PTS = [{ x: ANT_LX, y: ANT_Y }].concat(ANT_L.map((p) => ({ x: ANT_LX + p.x, y: ANT_Y + p.y })));
const ANT_R_PTS = [{ x: ANT_RX, y: ANT_Y }].concat(ANT_R.map((p) => ({ x: ANT_RX + p.x, y: ANT_Y + p.y })));
const TRAIL = 14, TRAIL_LIFE = 0.26; // eye-spot light streaks: samples kept, and how long each glows (seconds)

const params = {
  flap: -0.3,         // wing sweep: -1 forward/up stroke .. 1 back/down stroke (set straight from the beat phase)
  hind: -0.3,         // hindwing sweep, lagging the forewing
  reachL: 1, reachR: 1, // wing span multipliers; banking foreshortens the leading (right, forward) wing
  lean: 0,            // body yaw in degrees, positive turns the head toward the direction of flight
  curl: 0,            // abdomen swing in degrees about the thorax (a pendulum lagging the lean)
  spin: 0,            // tumble angle in degrees (hit reaction, keyed to the time since the hit)
  sx: 1, sy: 1,       // squash / stretch about the centre
  bobX: 0, bobY: 0,   // figure-eight hover and the body riding the wing beat (visual only, the hitbox stays put)
  spot: 0,            // 0 dim eye-spots .. 1 lit (aggro)
  flare: 0,           // extra flash of the eye-spots on alert and on a hit
  pulse: 1,           // breathing of the eye-spot glow
  tint: 0,            // wing membrane tint toward the hunting violet
  limp: 0,            // 1 = wings folded limp (tumbling)
  eyeOpen: 1, lookX: 0, lookY: 0, wide: 0,
};
// [stiffness, damping ratio] for the values that overshoot and settle; the rest snap to their target
const springs = {
  reachL: [140, 0.55], reachR: [140, 0.55], lean: [180, 0.45], curl: [120, 0.3], sx: [400, 0.5], sy: [400, 0.5],
  spot: [40, 1], flare: [160, 0.5], tint: [30, 1], limp: [240, 0.6], lookX: [160, 0.8], lookY: [160, 0.8], wide: [220, 0.55],
};
// stills exported to art/hushmoth_<pose>.svg (up and down are the originals)
const poses = {
  up: { flap: -1, hind: -0.75 }, down: { flap: 1, hind: 0.6 },
  alert: { flap: -1.05, hind: -1, reachL: 1.08, reachR: 1.08, spot: 1, flare: 0.5, wide: 1, lookX: 0.8 },
  chase: { flap: 0.1, hind: -0.5, lean: 20, reachR: 0.78, reachL: 1.07, curl: -8, spot: 1, tint: 1, lookX: 0.9, sy: 1.05, sx: 0.97 },
  hit: { spin: -55, limp: 1, flap: 0.6, hind: 0.9, curl: 28, eyeOpen: 0.25, flare: 0.3, sx: 0.9, sy: 1.1 },
};

function make(P, pup) {
  const lit = clamp(P.spot + P.flare, 0, 1.3), tint = clamp(P.tint, 0, 1), limp = clamp(P.limp, 0, 1);
  const wy = -0.5 + 3.5 * P.flap + 3 * limp, hy = 1 + 3 * P.hind + 2.5 * limp; // sweep offsets of the fore- and hindwings (negative = forward)
  const sheen = clamp(-P.flap, 0, 1) * 0.18; // the membrane catches light on the forward stroke
  const membT = mix(mix('#6b5e8e', '#7a5aa0', tint), '#9a8cc0', sheen), membB = mix('#3a3050', '#4a3a66', tint);
  const wingG = lin('hw', 0, 4, 0, 18, [[0, membT], [1, membB]]);
  const hindG = lin('hh', 0, 10, 0, 18, [[0, membB], [1, '#2a2238']]);
  const spotC = mix('#7fd7ff', '#e6fbff', clamp(lit - 0.5, 0, 1) * 0.8);
  // a wing: hindwing lobe, forewing, a vein, and the eye-spot that is the only light the moth has left
  const wing = (m, r) => {
    r *= 1 - 0.35 * limp;
    const ex = CX + m * 12 * r, ex5 = CX + m * 5 * r, px = CX + m * 8.2 * r, py = 8.5 + wy * 0.5;
    return [
      path(`M${CX} 11 C${CX + m * 4 * r} ${11 + hy * 0.6} ${CX + m * 9.5 * r} ${11.5 + hy} ${CX + m * 8.5 * r} ${14.5 + hy * 0.6} C${CX + m * 7 * r} ${17 + hy * 0.3} ${CX + m * 2.5 * r} 16 ${CX} 13 Z`, hindG, { stroke: '#2a2238', strokeWidth: 0.7 }),
      path(`M${CX} 10 C${ex5} ${2 + wy} ${ex} ${2 + wy} ${ex} ${9 + wy * 0.6} C${ex} ${14 + wy * 0.3} ${ex5} 15 ${CX} 12 Z`, wingG, { stroke: '#2a2238', strokeWidth: 0.8 }),
      stroke(`M${CX + m * 2 * r} 10.6 Q${CX + m * 7 * r} ${6 + wy * 0.75} ${CX + m * 10.8 * r} ${7.2 + wy * 0.62}`, '#a494cc', 0.5, { opacity: 0.3 + sheen }),
      circ(px, py, 3.2 + lit * 1.8, '#7fd7ff', { opacity: (0.06 + 0.16 * lit) * P.pulse }),
      circ(px, py, 2.1 + lit * 0.3, '#2a2238'), circ(px, py, 1.2 + lit * 0.5, spotC, { opacity: 0.9 }), circ(px, py, 0.5 + lit * 0.2, '#ffffff'),
    ];
  };
  // eyes: glowing, pupil-less; they blink, glance, widen on alert and squint when dazed
  const open = clamp(P.eyeOpen, 0, 1), er = 0.7 * (1 + 0.35 * clamp(P.wide, 0, 1.5)), lx = P.lookX * 0.35, ly = P.lookY * 0.3;
  const eyeC = mix('#7fd7ff', '#f0fcff', clamp(lit - 0.4, 0, 1) * 0.6);
  const eyeOp = (cx, cy) => open < 0.15 ? stroke(`M${cx - er} ${cy} L${cx + er} ${cy}`, '#9fe4ff', 0.6)
    : [circ(cx + lx, cy + ly, er * 1.8, eyeC, { opacity: 0.22 + 0.25 * lit }), ell(cx + lx, cy + ly, er, er * open, eyeC), open > 0.5 ? circ(cx + lx - er * 0.2, cy + ly - er * 0.3, er * 0.45, '#ffffff', { opacity: 0.85 }) : null];
  // antennae: verlet chains when animated, their rest curve for the stills
  const aL = pup && pup.chains.antL ? pup.chains.antL.points() : ANT_L_PTS, aR = pup && pup.chains.antR ? pup.chains.antR.points() : ANT_R_PTS;
  const antenna = (pts) => [stroke(curve(pts), '#4a3f66', 0.7), circ(pts[3].x, pts[3].y, 0.55, '#6b5e8e')];
  const abdomen = g([ell(CX, 11.5, 2.6, 5, '#2a2238', { stroke: '#120e1c', strokeWidth: 0.8 }), stroke('M10.9 12.4 Q13 13.3 15.1 12.4 M11.3 14.6 Q13 15.4 14.7 14.6', '#3a3050', 0.5, { opacity: 0.8 })], { transform: rot(P.curl, CX, 8.5) });
  const thorax = ell(CX, 8.5, 3.2, 2.2, '#4a3f66');
  const body = g([wing(-1, P.reachL), wing(1, P.reachR), abdomen, thorax, eyeOp(12, 8), eyeOp(14.2, 8), antenna(aL), antenna(aR)],
    { transform: `${tr(CX + P.bobX, CY + P.bobY)} ${rot(P.lean + P.spin)} scale(${P.sx} ${P.sy}) ${tr(-CX, -CY)}` });
  return svg(W, H, [body]);
}

// ---- animation: from the enemy's state to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, t = pup.time;
  if (m.init === undefined) {
    m.init = true; m.ph = Math.random() * 6.3; m.aggro = false; m.facing = e.facing; m.hp = e.hp; m.flash = e.flash || 0; m.hitT = 9; m.alertT = 9; m.launched = true; m.sprung = true;
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.glance = 1 + Math.random() * 2; m.gx = 0; m.gy = 0; m.fidget = 2 + Math.random() * 4; m.burstT = 0;
    m.trail = new Float32Array(TRAIL * 5); m.trail.fill(-9); m.ti = 0; m.trailT = 0;
  }
  const antL = pup.chain('antL', ANT_LX, ANT_Y, ANT_L), antR = pup.chain('antR', ANT_RX, ANT_Y, ANT_R);
  if (m.facing !== e.facing) { // the game mirrors the whole scene on a turn: mirror the template-space state too, so the world-space pose stays continuous
    m.facing = e.facing; const P = pup.P, V = pup.V;
    for (const k of ['lean', 'curl', 'lookX']) { P[k] = -P[k]; V[k] = -(V[k] || 0); }
    const r = P.reachL; P.reachL = P.reachR; P.reachR = r; const rv = V.reachL || 0; V.reachL = V.reachR || 0; V.reachR = rv;
    const a = antL.pts; antL.pts = antR.pts; antR.pts = a; for (const c of [antL, antR]) for (const q of c.pts) { q.x = 2 * CX - q.x; q.px = 2 * CX - q.px; }
  }
  const fwd = e.vx * e.facing, speed = Math.hypot(e.vx, e.vy); // forward speed is template +x (the game flips the scene)
  const sk = clamp(speed / SPEED, 0, 1.4), fk = clamp(fwd / SPEED, -1, 1.3); const aggro = !!e.aggro;
  // ---- events: the alert (aggro rising edge) and hits (hp dropped, or a fresh flash)
  const alert = aggro && !m.aggro; m.aggro = aggro;
  const hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0); m.hp = e.hp; m.flash = e.flash || 0;
  if (alert) { m.alertT = 0; m.launched = false; pup.impulse('flare', 10).impulse('wide', 9).impulse('sx', 2.6).impulse('sy', -2).impulse('curl', -260).impulse('reachL', 2).impulse('reachR', 2); }
  if (hit) { m.hitT = 0; m.sprung = false; pup.impulse('sx', -3).impulse('sy', 2.5).impulse('curl', 600).impulse('lean', -400).impulse('flare', 3); }
  m.hitT += dt; m.alertT += dt;
  const tumbling = m.hitT < 0.5, alerting = m.alertT < 0.26;
  if (!alerting && !m.launched) { m.launched = true; pup.impulse('sy', 3).impulse('sx', -1.5).impulse('curl', 300).impulse('lean', 220); } // launch out of the freeze
  if (!tumbling && !m.sprung) { m.sprung = true; pup.impulse('reachL', 4).impulse('reachR', 4).impulse('sx', 2); }               // the wings snap back open
  // ---- fidgets: a quick flap burst, or a wing shiver with a tail flick
  m.fidget -= dt; if (m.fidget < 0) { m.fidget = 2.5 + Math.random() * 4; if (Math.random() < 0.5) m.burstT = 0.35; else pup.impulse('reachL', -2.5).impulse('reachR', 2.5).impulse('curl', 180); }
  m.burstT -= dt;
  // ---- the wing beat: a phase whose rate rises with speed; strokes widen with speed, shrink to a quiver during the alert freeze, go slack in a tumble
  const rate = tumbling ? 5 : alerting ? 3 : (15 + 18 * sk) * (m.burstT > 0 ? 1.8 : 1);
  m.ph += rate * dt;
  const amp = tumbling ? 0.25 : alerting ? 0.1 : 0.72 + 0.4 * sk + (m.burstT > 0 ? 0.2 : 0);
  const s = Math.sin(m.ph);
  const bias = alerting ? -0.85 : clamp(-e.vy / 160, -0.3, 0.3); // wings spread forward on alert; swept back when climbing, forward when diving
  const calm = aggro ? 0.25 : 1;
  const T = {
    flap: bias + s * amp, hind: bias * 0.8 + Math.sin(m.ph - 1.1) * amp * 0.85,
    lean: tumbling ? 0 : fk * (24 + clamp(e.vy / SPEED, -1, 1) * 8) + (alerting ? -4 : Math.sin(t * 1.1) * 3 * calm),
    reachR: alerting ? 1.08 : 1 - 0.22 * Math.max(0, fk) + 0.1 * Math.min(0, fk), reachL: alerting ? 1.08 : 1 + 0.07 * Math.max(0, fk) - 0.2 * Math.min(0, fk),
    spot: aggro ? 1 : 0, tint: aggro ? 1 : 0, pulse: 1 + Math.sin(t * (aggro ? 7 : 2.4)) * 0.25,
    limp: tumbling && m.hitT < 0.36 ? 1 : 0, wide: alerting ? 1 : 0,
    sx: 1 - 0.03 * sk + Math.sin(t * 2.6) * 0.012, sy: 1 + 0.06 * sk - Math.sin(t * 2.6) * 0.012 + s * 0.025 * amp,
    // hover: a small figure-eight when calm, and the body riding the wing beat
    bobX: Math.sin(t * 2.1) * 2.2 * calm * e.facing, bobY: Math.sin(t * 4.2) * 1.2 * calm + Math.cos(m.ph) * 0.35 * amp + (alerting ? Anim.keys(m.alertT / 0.26, [[0, { y: 0 }], [0.3, { y: -3 }, 'outCubic'], [1, { y: 0 }, 'inQuad']]).y : 0),
    // the abdomen trails the yaw, sways, and lifts with the dive
    curl: -pup.P.lean * 0.35 + Math.sin(t * 2.1) * 3 + clamp(e.vy / 160, -1, 1) * 6,
    // the tumble: a backward roll keyed to the time since the hit (wings go limp, then spring open above)
    spin: tumbling ? Anim.keys(m.hitT / 0.5, [[0, { spin: 0 }], [0.8, { spin: -360 }, 'outCubic'], [1, { spin: -360 }]]).spin : 0,
  };
  // ---- eyes: blinks, idle glances, a stare along the flight line when hunting, wide on alert, squinting dazed in a tumble
  let open = 1;
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.25 ? 0.3 : 2 + Math.random() * 4; m.blinkT = 0.16; }
  if (m.blinkT > 0) { m.blinkT -= dt; open = m.blinkT > 0.08 ? 1 - (0.16 - m.blinkT) / 0.08 : m.blinkT / 0.08; }
  if (alerting) open = 1; if (tumbling) open = Math.min(open, 0.25);
  m.glance -= dt; if (m.glance < 0) { m.glance = 1 + Math.random() * 3; m.gx = (Math.random() - 0.5) * 1.6; m.gy = (Math.random() - 0.5) * 1.2; }
  T.eyeOpen = open; T.lookX = aggro ? fk * 0.9 : m.gx; T.lookY = aggro ? clamp(e.vy / SPEED, -1, 1) * 0.7 : m.gy;
  pup.target(T);
  // ---- secondary motion: the antennae stream in the airflow, drift on their own, and whip in a tumble
  const env = { vx: e.vx / SCALE * 0.5, vy: e.vy / SCALE * 0.5, facing: e.facing, gravity: -3, drag: 0.5, stiff: 7, damp: 0.84, wind: { x: Math.sin(t * 3.3) * 3 + (tumbling ? Math.sin(m.hitT * 30) * 50 : 0), y: Math.cos(t * 2.4) * 2.5 } };
  antL.update(dt, env); env.wind.x += Math.sin(t * 2.7 + 2) * 3; antR.update(dt, env);
  // ---- the eye-spots leave light streaks while it hunts: remember their world positions (drawn by before())
  m.trailT -= dt;
  if (aggro && speed > 40 && m.trailT <= 0) {
    m.trailT = 0.02; const P = pup.P; const a = (P.lean + P.spin) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a); const flip = e.facing < 0 ? -1 : 1;
    const lim = clamp(P.limp, 0, 1); const py = (8.5 + (-0.5 + 3.5 * P.flap + 3 * lim) * 0.5 - CY) * P.sy; const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const o = m.ti * 5; m.ti = (m.ti + 1) % TRAIL;
    for (let k = 0; k < 2; k++) { const lx = (k ? P.reachR : -P.reachL) * 8.2 * (1 - 0.35 * lim) * P.sx; m.trail[o + k * 2] = cx + (lx * ca - py * sa + P.bobX) * SCALE * flip; m.trail[o + k * 2 + 1] = cy + (lx * sa + py * ca + P.bobY) * SCALE; }
    m.trail[o + 4] = t;
  }
}

// world-space light under the body: the streaks the eye-spots leave, and the faint hush-glow of a hunting moth
function before(ctx, e, pup) {
  const P = pup.P, m = pup.mem; const lit = clamp(P.spot + P.flare * 0.5, 0, 1); if (lit < 0.03 || !m.trail) return;
  const now = pup.time, cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < TRAIL - 1; i++) {
    const a = ((m.ti + i) % TRAIL) * 5, b = ((m.ti + i + 1) % TRAIL) * 5; const age = now - m.trail[b + 4]; if (age < 0 || age > TRAIL_LIFE || m.trail[b + 4] - m.trail[a + 4] > 0.1) continue;
    const k = 1 - age / TRAIL_LIFE; ctx.strokeStyle = `rgba(127,215,255,${(0.5 * k * k * lit).toFixed(3)})`; ctx.lineWidth = 0.5 + 1.3 * k;
    ctx.beginPath(); ctx.moveTo(m.trail[a], m.trail[a + 1]); ctx.lineTo(m.trail[b], m.trail[b + 1]); ctx.moveTo(m.trail[a + 2], m.trail[a + 3]); ctx.lineTo(m.trail[b + 2], m.trail[b + 3]); ctx.stroke();
  }
  const r = 12 + 2 * P.pulse; const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
  gr.addColorStop(0, `rgba(127,215,255,${(0.14 * lit * P.pulse).toFixed(3)})`); gr.addColorStop(1, 'rgba(127,215,255,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
  ctx.restore();
}

module.exports = { name: 'hushmoth', w: W, h: H, anchor: 'center', params, springs, poses, make, control, before };
