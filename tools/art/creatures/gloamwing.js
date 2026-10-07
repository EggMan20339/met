// Gloamwing: a bat with a lantern-glass belly full of stolen violet light.
//
// It hovers near its roost on a slow figure-eight, beating its wings at a rate that rises with its speed and locking
// them flat for a glide now and then; it banks into its turns, the leading wing foreshortens, its feet dangle and
// swing behind the body, its ears flick on their own and swivel toward Mote once it is hunting. The game keeps it at a
// distance and fires paired gloam bolts every 2.4 s of e.t (src/entities.js case 'r'): over the last second the light
// in its belly gathers (motes swirl faster and climb, the glass whitens, the eyes go white, a ring contracts into the
// belly, the ears perk and quiver), in the last third of a second it pulls back and opens its mouth, then on the shot
// frame it snaps forward, the belly flashes, the wings throw up, the ears flatten, and the recoil carries it back; the
// second bolt gives a second smaller jab. The lantern is spent after the shot and refills. A hit sends it into a
// backward tumble with its wings crumpled limp before they snap open again. Everything is keyed to the entity's own
// timers (e.t) so the shot lands on the game's frame. See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, tr, mix, clamp, lerp, num: n } = L;
const W = 32, H = 20, CX = 16, CY = 10; // centre anchor
const SCALE = 0.62; // world units per template unit (ART_SCALE.gloamwing), for the world-space glow and the acceleration lean
const SPEED = 55;   // ENEMY_DEFS.r.speed: the reference for flap rate, bank and the wing foreshortening
const FIRE_AT = 2.4, BOLT_GAP = 0.12; // updateEnemy case 'r': a shot when e.t passes 2.4 s while aggro (t restarts), the second bolt 0.12 s later
const TAU = Math.PI * 2;
const BODY = '#2a2238', LINE = '#181226', FUR = '#4a3f6e', GLOW = '#b0a0ff', GLASS_HI = '#c8b8ff', GLASS_MID = '#8a70e0', GLASS_LO = '#3a2a60', MOTE = '#ece6ff';
const WING_G = lin('gw', 0, 2, 0, 18, [[0, '#4a3f6e'], [1, '#26203a']]);
const q = (v) => Math.round(clamp(v, 0, 1) * 20) / 20; // 0..1 in twentieths, so the gradient cache is not churned every frame

const params = {
  flap: -0.2,         // wing stroke of the arm: -1 wings up .. 1 wings down (set straight from the beat phase)
  tip: -0.2,          // the wing tips and trailing edge, lagging the arm
  reachL: 1, reachR: 1, // wing span multipliers; banking foreshortens the leading wing
  fold: 0,            // 0 open .. 1 wings crumpled limp against the body (tumble)
  glide: 0,           // 0 beating .. 1 wings locked flat and taut
  roll: 0,            // bank in degrees, positive leans toward +x (Mote's side)
  spin: 0,            // tumble angle in degrees, keyed to the time since a hit
  sx: 1, sy: 1,       // squash / stretch about the centre
  bobX: 0, bobY: 0,   // the hover (figure-eight, riding the wing beat); visual only, the hitbox stays put
  lunge: 0,           // body shift along x: the wind-up pulls back, the shot snaps forward, the recoil overshoots back
  earL: 0, earR: 0,   // ear angles in degrees: positive splayed outward / flattened back, negative perked up and inward
  legs: 0,            // the feet swinging under the body, degrees, positive toward +x
  fill: 1,            // how much stolen light the lantern belly holds: 0 spent .. 1 full
  charge: 0,          // the light gathering for a shot 0..1
  flash: 0,           // the shot: belly, eyes and mouth white-out
  mouth: 0,           // 0 closed .. 1 a hissing gape
  swirl: 0,           // phase of the motes circling in the glass (radians)
  pulse: 1,           // slow breathing of the glow
  eyeOpen: 1, look: 0, wide: 0, daze: 0,
};
// [stiffness, damping ratio] for the values that overshoot and settle; the rest snap to their target
const springs = {
  reachL: [160, 0.5], reachR: [160, 0.5], fold: [240, 0.6], glide: [60, 0.9], roll: [170, 0.45], sx: [420, 0.5], sy: [420, 0.5],
  lunge: [260, 0.32], earL: [380, 0.35], earR: [380, 0.35], legs: [110, 0.35], fill: [40, 1], charge: [70, 1], mouth: [300, 0.55],
  look: [160, 0.8], wide: [220, 0.55], daze: [120, 1],
};
// stills exported to art/gloamwing_<pose>.svg (up, down and fire are the originals)
const poses = {
  up: { flap: -1, tip: -0.95 }, down: { flap: 1, tip: 0.85 },
  fire: { flap: 0.6, tip: 0.3, flash: 1, charge: 1, mouth: 1, wide: 0.6, lunge: 1.5, earL: 24, earR: 24, fill: 0.9, legs: -14, look: 1 },
  alert: { flap: -0.95, tip: -1, reachL: 1.08, reachR: 1.08, wide: 1, earL: -14, earR: -14, bobY: -1.5, legs: -18, look: 1 },
  charge: { flap: -0.3, tip: -0.55, charge: 1, mouth: 0.5, wide: 0.5, lunge: -1.6, earL: -9, earR: -9, sy: 1.05, look: 1 },
  glide: { flap: -0.4, tip: -0.4, glide: 1, reachL: 1.05, reachR: 1.05, earL: 4, earR: 4, roll: 8, legs: -8 },
  hit: { spin: -50, fold: 1, flap: 0.4, tip: 0.8, earL: 30, earR: 30, eyeOpen: 0.3, daze: 1, legs: 28, sx: 0.92, sy: 1.08 },
  spent: { fill: 0.1, flap: 0.2, tip: 0.5, mouth: 0.2, lunge: -1.2 },
};

function make(P, pup) {
  const fold = clamp(P.fold, 0, 1), glide = clamp(P.glide, 0, 1), fill = clamp(P.fill, 0, 1), ch = clamp(P.charge, 0, 1), fl = clamp(P.flash, 0, 1), mo = clamp(P.mouth, 0, 1), wide = clamp(P.wide, 0, 1.5), daze = clamp(P.daze, 0, 1);
  // wings: the arm (leading edge near the body) follows flap, the tips and the scalloped trailing edge follow the lagging tip value;
  // -6 is wings up, 4 wings down (the original up/down stills); crumpled wings hang lower and shorter, a glide stretches and tautens them
  const a = -1 + 5 * P.flap + 4 * fold, b = -1 + 5 * P.tip + 6 * fold;
  const wing = (m, r) => {
    r *= (1 - 0.45 * fold) * (1 + 0.06 * glide); const x = (k) => n(CX + m * k * r); const s1 = n(10 + b * 0.4 - 1.2 * glide);
    return [
      path(`M${CX} 9 C${x(6)} ${n(4 + a)} ${x(13)} ${n(3 + b)} ${x(15)} ${n(8 + b * 0.5)} L${x(12)} ${s1} L${x(9)} ${n(12 + a * 0.3 - 0.8 * glide)} L${x(5)} 12 Z`, WING_G, { stroke: LINE, strokeWidth: 0.8 }),
      stroke(`M${x(2.5)} 9.6 Q${x(8)} ${n(5.6 + a * 0.8)} ${x(12)} ${s1}`, '#6a5c90', 0.5, { opacity: 0.45 }), // the finger bone along the membrane
    ];
  };
  // feet: two little hooks dangling under the belly, swinging on their spring
  const foot = (hx, deg, m) => stroke(`M0 0 L0 2.3 L${m * 0.9} 2.9`, '#3a3050', 1.1, { transform: `${tr(hx, 15.3)} ${rot(deg)}` });
  const feet = [foot(14.7, P.legs - 3, -1), foot(17.3, P.legs * 0.85 + 3, 1)];
  const body = ell(CX, 10, 4.2, 6, BODY, { stroke: LINE, strokeWidth: 0.8 });
  const rim = stroke('M13.4 7.4 C13.7 5.6 15 4.5 16.6 4.3', FUR, 0.8, { opacity: 0.55 });
  // the lantern belly: glass whose light brightens toward white as a shot gathers and goes dark when spent, with motes swirling inside
  const hi = q(ch * 0.7 + fl), f = q(fill);
  const glassG = rad('gb', CX, 12, 5, [[0, mix(GLASS_HI, '#ffffff', hi), 0.95 * (0.3 + 0.7 * f)], [0.6, mix(GLASS_MID, '#d8ccff', q(ch * 0.5 + fl)), 0.7 * (0.35 + 0.65 * f)], [1, GLASS_LO, 0.5]]);
  const glass = ell(CX, 12, 3, 3.6, glassG, { stroke: '#5a4a88', strokeWidth: 0.5 });
  const glassHi = stroke('M13.4 10.5 C13.2 13 14 15 16 15.6', '#ffffff', 0.5, { opacity: 0.5 });
  const gr = 4.5 + 2.5 * ch + 2 * fl, ga = q(0.3 * fill * P.pulse + 0.4 * ch + 0.4 * fl);
  const inner = ga > 0.02 ? circ(CX, 12.2, gr, rad('gi', CX, 12.2, gr, [[0, mix(GLOW, '#ffffff', hi), ga], [1, GLOW, 0]])) : null;
  const mk = 0.3 + 0.7 * fill, lift = 1.3 * ch, mop = clamp(0.35 + 0.4 * fill + 0.4 * ch, 0, 1);
  const motes = [0, 1, 2].map((i) => { const an = P.swirl + i * 2.094; return circ(CX + Math.cos(an) * 1.7 * mk, 12.3 + Math.sin(an) * 2.3 * mk - lift, 0.45 + (Math.sin(an * 2 + i) + 1) * 0.15 + 0.3 * ch + 0.4 * fl, MOTE, { opacity: mop }); });
  // ears on their pivots: the right one is the left one mirrored, both rotate outward for a positive angle
  const ear = (px, py, deg, m) => g([path('M-0.1 0.2 L-1.6 -3.8 L1.4 -0.8 Z', BODY), path('M-0.4 -0.3 L-1.1 -2.6 L0.5 -0.9 Z', FUR, { opacity: 0.7 })], { transform: `${tr(px, py)} ${rot(deg)} scale(${m} 1)` });
  // eyes: pupil-less glow that blinks, glances, widens on alert, goes white as the shot gathers and dims dazed in a tumble
  const eo = clamp(P.eyeOpen, 0, 1), er = 0.9 * (1 + 0.3 * wide), lk = P.look * 0.3;
  const eyeC = mix(mix(GLOW, '#7a6ab0', daze), '#ffffff', clamp(ch * 0.8 + fl + wide * 0.25, 0, 1));
  const eyeOp = (cx, cy) => eo < 0.15 ? stroke(`M${n(cx - er)} ${cy} L${n(cx + er)} ${cy}`, GLOW, 0.6)
    : [circ(cx + lk, cy, er * 1.8 * (1 + 0.25 * ch + 0.35 * fl), eyeC, { opacity: 0.25 + 0.15 * ch + 0.2 * fl }), ell(cx + lk, cy, er, er * eo, eyeC), eo > 0.5 ? circ(cx + lk - er * 0.15, cy - er * 0.4 * eo, er * 0.45, '#ffffff', { opacity: 0.85 }) : null];
  // the mouth: a hiss between the eyes and the glass, lit from inside as the light gathers, fangs showing when it gapes
  const mouth = mo > 0.04 ? [ell(CX, 7.95 + mo * 0.25, 1 + 0.4 * mo, 0.15 + 0.65 * mo, '#120c1c'),
    ell(CX, 8 + mo * 0.3, 0.6 * mo, 0.45 * mo, mix(GLASS_MID, '#ffffff', q(ch * 0.6 + fl)), { opacity: clamp(0.3 + 0.5 * ch + fl, 0, 1) }),
    mo > 0.3 ? path('M15.2 7.6 L15.55 8.6 L15.9 7.6 Z M16.1 7.6 L16.45 8.6 L16.8 7.6 Z', '#f0ecff', { transform: `${tr(CX, 7.6)} scale(1 ${n(mo)}) ${tr(-CX, -7.6)}`, opacity: 0.9 }) : null] : null;
  const all = g([wing(-1, P.reachL), wing(1, P.reachR), feet, body, rim, glass, glassHi, inner, motes, ear(13.6, 4.8, -P.earL, 1), ear(18.4, 4.8, P.earR, -1), eyeOp(14.4, 6.5), eyeOp(17.6, 6.5), mouth],
    { transform: `${tr(CX + P.bobX + P.lunge, CY + P.bobY)} ${rot(P.roll + P.spin)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-CX, -CY)}` });
  return svg(W, H, [all]);
}

// ---- animation: from the enemy's state (aggro, fire / e.t, velocity, hits) to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.t0 = Math.random() * 10; m.ph = Math.random() * TAU; m.swirl = Math.random() * TAU;
    m.aggro = !!e.aggro; m.facing = e.facing; m.hp = e.hp; m.flash = e.flash || 0; m.t = e.t; m.vx = e.vx; m.ax = 0;
    m.hitT = 9; m.alertT = 9; m.fireT = 9; m.kn = -1; m.launched = true; m.sprung = true;
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.glance = 1 + Math.random() * 2; m.gx = 0; m.flick = 1 + Math.random() * 3; m.glideT = 0; m.glideIn = 2 + Math.random() * 4;
  }
  const t = pup.time + m.t0, s = pup.scale || SCALE, fac = e.facing, aggro = !!e.aggro;
  if (m.facing !== fac) { // the game mirrors the whole scene on a turn: mirror the template-space state too, so the world-space pose stays continuous
    m.facing = fac; const P = pup.P, V = pup.V;
    for (const k of ['roll', 'look', 'legs', 'lunge']) { P[k] = -P[k]; V[k] = -(V[k] || 0); } m.kn = -m.kn;
    const sw = (a, b) => { let x = P[a]; P[a] = P[b]; P[b] = x; x = V[a] || 0; V[a] = V[b] || 0; V[b] = x; }; sw('reachL', 'reachR'); sw('earL', 'earR');
  }
  const fwd = e.vx * fac, speed = Math.hypot(e.vx, e.vy); // forward is template +x (the game flips the scene when it faces left)
  const sk = clamp(speed / SPEED, 0, 1.5), fk = clamp(fwd / SPEED, -1.3, 1.3), vk = clamp(e.vy / SPEED, -1.3, 1.3);
  // ---- events, found by watching the entity: the alert (aggro rising), the shot (e.t restarted in 'fire'), the second bolt, a hit
  const alert = aggro && !m.aggro;
  const fired = e.state === 'fire' && e.t < m.t && !alert;
  const bolt2 = e.state === 'fire' && m.t < BOLT_GAP && e.t >= BOLT_GAP && m.fireT < 0.5;
  const dvx = e.vx - m.vx; const hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0);
  const ax = dt > 0 ? dvx / dt / s : 0; m.ax = lerp(m.ax, Math.abs(ax) > 2500 ? 0 : ax, Math.min(1, dt * 8)); // smoothed acceleration in template units/s^2 (knocks and wall bounces are impulses instead)
  m.aggro = aggro; m.t = e.t; m.hp = e.hp; m.flash = e.flash || 0; m.vx = e.vx;
  if (alert) { m.alertT = 0; m.launched = false; m.glideT = 0; pup.impulse('wide', 9).impulse('earL', -600).impulse('earR', -600).impulse('sy', 2.5).impulse('sx', -1.8).impulse('reachL', 2.5).impulse('reachR', 2.5).impulse('legs', -200); }
  if (fired) { // the shot: the lantern empties, the body snaps forward and the spring carries it back, the wings throw up, the ears flatten
    m.fireT = 0; m.glideT = 0; m.ph = -Math.PI / 2; pup.snap({ fill: 0.06 });
    pup.impulse('lunge', 85).impulse('sx', 3).impulse('sy', -2.5).impulse('earL', 650).impulse('earR', 650).impulse('reachL', -3).impulse('reachR', -3).impulse('legs', -350).impulse('mouth', 12);
  }
  if (bolt2) pup.impulse('lunge', 70).impulse('sx', 2).impulse('sy', -1.5).impulse('earL', 350).impulse('earR', 350).impulse('legs', -200);
  if (hit) { // which way it is being shoved in template space: -1 backwards (away from Mote)
    m.hitT = 0; m.sprung = false; m.glideT = 0; m.kn = (Math.sign(dvx) || -1) * fac; m.blinkT = 0;
    pup.impulse('sx', -3).impulse('sy', 3).impulse('legs', 500 * m.kn).impulse('earL', 800).impulse('earR', 800).impulse('fold', 6).impulse('lunge', 40 * m.kn);
  }
  m.hitT += dt; m.alertT += dt; m.fireT += dt;
  const tumbling = m.hitT < 0.6, alerting = m.alertT < 0.28, firing = m.fireT < 0.5 && e.state === 'fire';
  if (!alerting && !m.launched) { m.launched = true; m.ph = -Math.PI / 2; pup.impulse('sy', 2.5).impulse('sx', -1.5).impulse('legs', 250).impulse('roll', 120 * (fk || -1)); } // out of the freeze with a big downstroke
  if (!tumbling && !m.sprung) { m.sprung = true; m.ph = -Math.PI / 2; pup.impulse('reachL', 5).impulse('reachR', 5).impulse('fold', -5).impulse('sx', 2.5).impulse('sy', -1.5).impulse('roll', -250 * m.kn).impulse('earL', -400).impulse('earR', -400); } // the wings snap open again
  // ---- the shot timer: the light gathers over the last second of e.t, the wind-up fills the last third of a second
  const chargeK = aggro ? Anim.smooth(e.t, 1.3, FIRE_AT - 0.02) : 0;
  const windup = aggro && e.t > FIRE_AT - 0.35 ? clamp((e.t - (FIRE_AT - 0.35)) / 0.33, 0, 1) : 0;
  // ---- fidgets: ear flicks, and glides (longer and more often when calm)
  m.flick -= dt; if (m.flick < 0 && !tumbling) { // an ear flick, both ears back, or a ruffle of the wings
    m.flick = 1.2 + Math.random() * 3.5; const r = Math.random();
    if (r < 0.35) pup.impulse('earL', -450); else if (r < 0.7) pup.impulse('earR', -450); else if (r < 0.85) pup.impulse('earL', 380).impulse('earR', 380).impulse('sy', 1.2); else pup.impulse('reachL', -2.5).impulse('reachR', 2.5).impulse('roll', 160).impulse('legs', 120);
  }
  m.glideIn -= dt; if (m.glideIn < 0 && !tumbling && !alerting && !firing && chargeK < 0.3) { m.glideIn = aggro ? 2 + Math.random() * 3 : 1.5 + Math.random() * 3.5; m.glideT = aggro ? 0.3 + Math.random() * 0.3 : 0.5 + Math.random() * 0.7; }
  m.glideT -= dt; const gliding = m.glideT > 0 && !tumbling && !alerting && !firing && chargeK < 0.3; const glideP = clamp(pup.P.glide, 0, 1);
  // ---- the wing beat: a phase whose rate rises with speed (and with the charge); strokes fade out into a glide, shrink to a quiver in the alert freeze, go slack in a tumble
  const rate = tumbling ? 7 : alerting ? 2 : (12 + 12 * sk) * (1 + 0.35 * chargeK);
  m.ph += rate * dt; if (m.ph > 100 * TAU) m.ph -= 100 * TAU;
  const amp = (tumbling ? 0.25 : alerting ? 0.07 : 0.72 + 0.3 * sk + 0.15 * chargeK) * (1 - glideP);
  const bias = lerp(alerting ? -0.95 : -0.12 + clamp(vk, -1, 1) * 0.25 - 0.15 * chargeK, -0.4, glideP); // wings spread high on alert, swept up when diving, down when climbing
  const sn = Math.sin(m.ph);
  m.swirl += (2 + 10 * chargeK + 2 * sk + (tumbling ? 12 : 0)) * dt; if (m.swirl > 100 * TAU) m.swirl -= 100 * TAU;
  const calm = aggro ? 0.3 : 1;
  const T = {
    flap: bias + sn * amp, tip: bias + Math.sin(m.ph - 0.95) * amp * 1.15,
    reachL: 1 + 0.08 * Math.max(0, fk) - 0.16 * Math.max(0, -fk) + 0.05 * glideP, reachR: 1 - 0.16 * Math.max(0, fk) + 0.08 * Math.max(0, -fk) + 0.05 * glideP,
    fold: tumbling && m.hitT < 0.33 ? 1 : 0, glide: gliding ? 1 : 0,
    roll: tumbling || alerting ? 0 : fk * 13 + m.ax * fac * 0.03 + Math.sin(t * 1.1) * 2.5 * calm,
    spin: tumbling ? Anim.keys(m.hitT / 0.6, [[0, { v: 0 }], [0.82, { v: 360 * m.kn }, 'outCubic'], [1, { v: 360 * m.kn }]]).v : 0,
    sx: 1 - 0.02 * sk + Math.sin(t * 2.4) * 0.012 - sn * 0.02 * amp, sy: 1 + 0.04 * sk - Math.sin(t * 2.4) * 0.012 + sn * 0.035 * amp + 0.05 * Math.max(0, -vk),
    // the hover: a figure-eight when calm, and the body riding the wing beat
    bobX: Math.sin(t * 0.9) * 1.6 * calm * fac, bobY: Math.sin(t * 1.8) * 1.1 * calm - Math.cos(m.ph - 0.6) * 0.45 * amp,
    lunge: 0, earL: Math.sin(t * 1.3) * 2 + 4 * glideP, earR: Math.sin(t * 1.3 + 0.7) * 2 + 4 * glideP,
    legs: -pup.P.roll * 0.8 - m.ax * fac * 0.05 + Math.sin(t * 2.1 + 1) * 3, // the feet trail the bank and the acceleration
    fill: clamp(m.fireT / 1.3, 0, 1), charge: chargeK, flash: 0, mouth: 0, swirl: m.swirl, pulse: 1 + Math.sin(t * (aggro ? 5.5 : 2.2)) * 0.25,
    eyeOpen: 1, look: aggro ? 0.9 : m.gx, wide: 0, daze: 0,
  };
  if (aggro) { T.earL -= 6; T.earR += 6; } // the ears swivel toward Mote
  // ---- the telegraph: ears perk and quiver, the mouth starts to open, the eyes widen; then the pull-back
  if (chargeK > 0) { const qv = Math.sin(t * 35) * 1.5 * chargeK; T.earL += -9 * chargeK + qv; T.earR += -9 * chargeK - qv; T.mouth = 0.45 * Anim.smooth(chargeK, 0.45, 1); T.wide = 0.5 * chargeK; T.look = 1; }
  if (windup > 0) { T.lunge = -2.2 * windup; T.sy += 0.06 * windup; T.sx -= 0.04 * windup; T.mouth = 0.45 + 0.2 * windup; }
  // ---- the alert: a freeze with the wings spread wide, the body popping up, ears straight up, eyes wide
  if (alerting) { const c = Anim.keys(m.alertT / 0.28, [[0, { y: 0, ear: -8 }], [0.3, { y: -3, ear: -16 }, 'outCubic'], [1, { y: -0.5, ear: -12 }, 'inQuad']]); T.bobY += c.y; T.earL = c.ear; T.earR = c.ear; T.wide = 1; T.reachL = T.reachR = 1.1; T.legs = -22; T.look = 1; }
  // ---- the shot, keyed to e.t (restarted by the game on the frame it fires): the flash, the gape, the forward snap and the recoil, a second kick for the second bolt
  if (firing) {
    const c = Anim.keys(e.t, [[0, { fl: 1, mo: 1, lu: 0.5 }], [0.1, { fl: 0.45, mo: 0.9, lu: -1.5 }, 'outQuad'], [BOLT_GAP, { fl: 0.9, mo: 1, lu: -1 }], [0.25, { fl: 0.25, mo: 0.6, lu: -2.2 }, 'outQuad'], [0.5, { fl: 0, mo: 0, lu: 0 }, 'inOutQuad']]);
    T.flash = c.fl; T.mouth = c.mo; T.lunge = c.lu; T.wide = 0.8 * c.fl; T.look = 1; T.earL += 10 * c.fl; T.earR += 10 * c.fl;
  }
  // ---- the tumble: wings crumpled, ears flat, feet flailing, eyes squinting and dim, the light sloshing
  if (tumbling) { const k = m.hitT / 0.6; T.earL = 30 + Math.sin(m.hitT * 30) * 5; T.earR = 30 - Math.sin(m.hitT * 30) * 5; T.legs = Math.sin(m.hitT * 18) * 25 * (1 - k); T.daze = 1; T.look = 0; T.wide = 0; T.lunge = 0; T.mouth = 0.35 * (1 - k); T.charge = chargeK * 0.5; }
  // ---- eyes: blinks and glances, held open while alert or firing, squinting in a tumble
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.25 ? 0.3 : 2 + Math.random() * 4; m.blinkT = 0.16; }
  if (m.blinkT > 0) { m.blinkT -= dt; T.eyeOpen = clamp(m.blinkT > 0.08 ? 1 - (0.16 - m.blinkT) / 0.08 : m.blinkT / 0.08, 0, 1); }
  if (alerting || firing) T.eyeOpen = 1; if (tumbling) T.eyeOpen = Math.min(T.eyeOpen, 0.3 + Math.sin(m.hitT * 30) * 0.12);
  m.glance -= dt; if (m.glance < 0) { m.glance = 1 + Math.random() * 3; m.gx = (Math.random() - 0.5) * 1.8; }
  pup.target(T);
}

// world-space light under the body: the violet glow of the lantern belly (swelling with the charge, dark when spent) and the
// ring that contracts into it as the light gathers
function before(ctx, e, pup) {
  const P = pup.P, s = pup.scale || SCALE, flip = e.facing < 0 ? -1 : 1;
  const fill = clamp(P.fill, 0, 1), ch = clamp(P.charge, 0, 1), fl = clamp(P.flash, 0, 1);
  const bx = e.x + e.w / 2 + (P.bobX + P.lunge) * s * flip, by = e.y + e.h / 2 + (P.bobY + 2.2 * P.sy) * s;
  const a = 0.08 + 0.14 * fill * P.pulse + 0.35 * ch + 0.3 * fl, r = 8 + 2 * P.pulse * fill + 6 * ch + 6 * fl;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(bx, by, 0.5, bx, by, r); gr.addColorStop(0, `rgba(176,160,255,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(176,160,255,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
  if (ch > 0.15 && fl < 0.05) { const k = (ch - 0.15) / 0.85; ctx.strokeStyle = `rgba(200,184,255,${(0.12 + 0.55 * k).toFixed(3)})`; ctx.lineWidth = 0.7 + k; ctx.beginPath(); ctx.arc(bx, by, lerp(17, 3.5, k * k), 0, TAU); ctx.stroke(); }
  ctx.restore();
}
// world-space light over the body: the muzzle burst of the shot and a streak of light leaving the belly toward Mote
function after(ctx, e, pup) {
  const P = pup.P, fl = clamp(P.flash, 0, 1); if (fl < 0.03) return;
  const s = pup.scale || SCALE, flip = e.facing < 0 ? -1 : 1;
  const bx = e.x + e.w / 2 + (P.bobX + P.lunge) * s * flip, by = e.y + e.h / 2 + (P.bobY + 2.2 * P.sy) * s; const r = 2.5 + 7 * (1 - fl);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(bx, by, 0, bx, by, r); gr.addColorStop(0, `rgba(240,236,255,${(0.55 * fl).toFixed(3)})`); gr.addColorStop(0.5, `rgba(200,184,255,${(0.25 * fl).toFixed(3)})`); gr.addColorStop(1, 'rgba(176,160,255,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(236,230,255,${(0.7 * fl).toFixed(3)})`; ctx.lineWidth = 1.2 * fl + 0.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(bx + flip * 2, by + 0.5); ctx.lineTo(bx + flip * (5 + 9 * (1 - fl)), by + 2 + 4 * (1 - fl)); ctx.stroke();
  ctx.restore();
}

module.exports = { name: 'gloamwing', w: W, h: H, anchor: 'center', params, springs, poses, make, control, before, after };
