// Mote, the last spark: a small luminous spirit with ember-leaf ears and a wisp tail.
//
// This is the reference animated module (see art/ANIMATION.md). make(P, pup) is a pure drawing of the parameters,
// control(p, pup, info) turns the player's state into parameter targets every frame, springs do the in-betweens.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, tr, eye, glow, curve, mix, clamp, lerp } = L;
const W = 36, H = 40, FX = 18, FY = 38; // feet anchor: bottom centre
const RUN = 165; // player run speed in world units (PHYS.RUN), for leaning and leg cycles
const SCALE = 0.62; // world units per template unit (ART_SCALE.mote), for feeding world velocities to the tail

const params = {
  lean: 0,            // body tilt in degrees, positive leans forward (Mote faces right)
  earL: -38, earR: -14, // ear angles, degrees from straight up; more negative sweeps them back
  earCurl: 0,         // 0 straight .. 1 tips bent back by wind
  legL: 0, legR: 0,   // leg swing in degrees (positive = forward)
  legTuck: 0,         // 0 standing .. 1 legs pulled up under the body
  eyeOpen: 1, look: 0, squint: 0, wide: 0,
  sx: 1, sy: 1, bob: 0, // squash / stretch about the feet, and body lift
  paw: 0, pawAng: -20, pawKind: 'none', // paw extension 0..1, its angle, and what it is doing: none | cling | strike | ember
  ember: 0,           // ember held in the paw, 0..1
  aura: 0, glow: 0.28, hurt: 0, sit: 0, cheek: 0.45,
};
// [stiffness, damping ratio] for the values that should overshoot and settle; the rest snap to their target
const springs = {
  lean: [260, 0.55], earL: [300, 0.42], earR: [300, 0.42], earCurl: [160, 0.7], legL: [520, 0.8], legR: [520, 0.8], legTuck: [320, 0.8],
  sx: [420, 0.5], sy: [420, 0.5], bob: [300, 0.6], paw: [560, 0.72], pawAng: [420, 0.7], look: [180, 0.8], aura: [60, 1], glow: [90, 1], hurt: [140, 1], sit: [120, 1], wide: [200, 0.8],
};
// stills exported to art/mote_<pose>.svg; they are also handy reference targets for control()
const poses = {
  idle: {},
  run1: { lean: 9, earL: -62, earR: -36, legL: -28, legR: 26 }, run2: { lean: 9, earL: -58, earR: -30, legL: -6, legR: 4, sy: 1.04 },
  run3: { lean: 9, earL: -66, earR: -40, legL: 26, legR: -28 }, run4: { lean: 9, earL: -60, earR: -34, legL: 4, legR: -6, sy: 1.04 },
  jump: { lean: 5, earL: -78, earR: -56, legL: -40, legR: -40, legTuck: 0.7, sx: 0.92, sy: 1.14 },
  fall: { lean: -3, earL: -8, earR: 14, legL: 14, legR: -10, wide: 1, sx: 1.04, sy: 0.96 },
  cling: { lean: -14, earL: -20, earR: 6, legL: 30, legR: 20, paw: 1, pawKind: 'cling', sx: 0.96, sy: 1.02 },
  dash: { lean: 22, earL: -92, earR: -74, earCurl: 1, legL: -30, legR: -30, legTuck: 0.5, squint: 1, sx: 1.28, sy: 0.74 },
  hurt: { lean: -10, earL: -30, earR: -46, legL: 20, legR: -20, squint: 1, hurt: 1, sx: 1.04, sy: 0.96 },
  sit: { earL: -48, earR: -30, eyeOpen: 0, sit: 1, sx: 1.08, sy: 0.9 },
  cast: { lean: 6, earL: -70, earR: -40, legL: -10, legR: 12, paw: 1, pawKind: 'ember', pawAng: -25, ember: 1 },
  strike: { lean: 14, earL: -84, earR: -60, legL: -22, legR: 18, squint: 1, paw: 1, pawKind: 'strike', pawAng: -18, sx: 1.06, sy: 0.96 },
  focus: { earL: -20, earR: 2, eyeOpen: 0, aura: 1, sx: 1.04, sy: 0.96 },
};
const TAIL_REST = [{ x: -3.5, y: 1 }, { x: -6.5, y: 3.5 }, { x: -8.5, y: 7 }];

function make(P, pup) {
  const bodyFill = lin('mb', 10, 10, 26, 36, [[0, mix('#fffaf0', '#ffb4b4', P.hurt)], [0.55, mix('#f4ecff', '#f0a0a0', P.hurt)], [1, mix('#d8ccff', '#e08c8c', P.hurt)]]);
  const earFill = lin('me', 0, 0, 0, -20, [[0, '#fff3dc'], [0.7, '#ffe2b0'], [1, '#ffb347']]);
  const core = rad('mc', 17, 21, 9, [[0, '#ffffff', 0.9], [1, '#ffffff', 0]]);
  // ears: leaf shapes whose tips bend with earCurl
  const ear = (deg, x, y) => { const c = P.earCurl * 5; return g([
    path(`M0 0 C-3.2 -6 ${-3.4 - c * 0.3} -13 ${-c} -20 C${3.4 - c * 0.6} -13 3.2 -6 0 0 Z`, earFill, { stroke: '#e8c690', strokeWidth: 0.7 }),
    stroke(`M0 -2 C0.4 -8 ${0.4 - c * 0.4} -13 ${-c * 0.9} -18`, '#f0c890', 0.6, { opacity: 0.7 }),
    circ(-c, -19, 1.6, '#ffd27a', { opacity: 0.55 }),
  ], { transform: `${tr(x, y)} ${rot(deg)}` }); };
  // tail: a wisp that trails the body (verlet chain when animated, its rest curve for the stills)
  const tailPts = pup && pup.chains.tail ? pup.chains.tail.points() : [{ x: 11, y: 28 }].concat(TAIL_REST.map((p) => ({ x: 11 + p.x, y: 28 + p.y })));
  const tailD = curve(tailPts);
  const tail = [stroke(tailD, '#e8dcff', 3.2), stroke(tailD, '#fffaf0', 1.4)];
  // legs hang from the body's underside; tucked legs fold up and inward
  const legY = FY - 3.6 - P.legTuck * 5 + P.bob * 0.5;
  const leg = (deg, x, side) => g([stroke(`M0 0 L0 ${3.2 - P.legTuck * 1.2}`, '#d8d0f4', 2.4), ell(0, 3.4 - P.legTuck * 1.2, 1.9, 1.2, '#eee8ff')], { transform: `${tr(x + side * P.legTuck * 1.5, legY)} ${rot(deg + side * P.legTuck * 25)}` });
  const legs = P.sit > 0.5 ? ell(18, FY - 1.5, 6, 1.6, '#d8d0f4') : [leg(P.legL, 15, -1), leg(P.legR, 21, 1)];
  // eyes: open/closed/squint and a glance direction
  const open = clamp(P.eyeOpen * (1 - P.squint * 0.75), 0, 1); const k = 1 + P.wide * 0.15;
  const eyes = P.squint > 0.6 && P.eyeOpen > 0.5 ? [stroke('M13.2 21.6 L16.6 21.2', '#3a2e55', 1.4), stroke('M19.4 21 L22.4 20.6', '#3a2e55', 1.4)]
    : [eye(15.2, 21, 2.1 * k, 2.9 * k, '#1a1526', true, open, P.look), eye(20.6, 20.4, 1.9 * k, 2.6 * k, '#1a1526', true, open, P.look)];
  // the paw: reaches to the wall when clinging, out and forward for a strike, holds the ember for a cast
  const px = 23, py = 27; const reach = P.paw * (P.pawKind === 'cling' ? -7 : P.pawKind === 'strike' ? 11 : 7); const a = P.pawAng * Math.PI / 180;
  const hx = px + Math.cos(a) * reach, hy = py + Math.sin(a) * reach;
  const paw = P.paw < 0.05 || P.pawKind === 'none' ? null
    : P.pawKind === 'cling' ? stroke(`M12 24 L${8 - P.paw * 0.5} ${18 + (1 - P.paw) * 5}`, '#f4ecff', 2.6)
    : P.pawKind === 'strike' ? [stroke(`M${px} ${py} L${hx} ${hy}`, '#f4ecff', 2.6), stroke(`M${hx} ${hy} L${hx + Math.cos(a) * 4} ${hy + Math.sin(a) * 4}`, '#ffe9b0', 1.8), stroke(`M${hx - Math.sin(a)} ${hy + Math.cos(a)} L${hx + Math.cos(a) * 4 - Math.sin(a)} ${hy + Math.sin(a) * 4 + Math.cos(a)}`, '#ffb347', 0.8, { opacity: 0.8 })]
    : [stroke(`M${px} ${py} L${hx} ${hy}`, '#f4ecff', 2.6), P.ember > 0.02 ? [circ(hx + Math.cos(a) * 1.5, hy + Math.sin(a) * 1.5, 4.5 * P.ember, '#ffb347', { opacity: 0.3 }), circ(hx + Math.cos(a) * 1.5, hy + Math.sin(a) * 1.5, 2.4 * P.ember, '#ffb347'), circ(hx + Math.cos(a) * 1.5, hy + Math.sin(a) * 1.5, 1.1 * P.ember, '#fff4dc')] : null];
  const bodyEl = path('M18 12 C25.5 12 27 19.5 26.2 27 C25.5 33 22.5 36.2 18 36.2 C13.5 36.2 10.5 33 9.8 27 C9 19.5 10.5 12 18 12 Z', bodyFill, { stroke: mix('#cbbde8', '#d08080', P.hurt), strokeWidth: 0.9 });
  const rim = stroke('M12.2 16 C13 13.8 15 12.6 17.5 12.4', '#ffffff', 1.2, { opacity: 0.8 });
  const shadow = path('M20 35.6 C24 34.5 26 30 25.6 25', '#8f7fbf', { opacity: 0.22 });
  const cheek = circ(23.6, 24.6, 1.6, '#ffc6b0', { opacity: P.cheek });
  const inner = circ(17, 21, 9 + P.glow * 6, rad('mc', 17, 21, 9 + P.glow * 6, [[0, '#ffffff', 0.5 + P.glow], [1, '#ffffff', 0]]));
  const aura = P.aura > 0.02 ? glow(18, 22, 17 + P.aura * 4, '#ffd080', 0.45 * P.aura) : null;
  const body = g([tail, ear(P.earL, 15.5, 12.5), bodyEl, inner, rim, shadow, cheek, ear(P.earR, 20, 12.2), eyes, paw], { transform: `${tr(FX, FY)} ${rot(P.lean)} scale(${P.sx} ${P.sy}) ${tr(-FX, -FY - P.bob)}` });
  return svg(W, H, [aura, body, legs]);
}

// ---- animation: from the player's state to parameter targets, every frame
function control(p, pup, info) {
  const dt = info.dt, m = pup.mem, t = pup.time;
  if (m.init === undefined) { m.init = true; m.air = !p.onGround; m.attackTimer = 0; m.castTimer = 0; m.blink = 2 + Math.random() * 3; m.glance = 1 + Math.random() * 3; m.lookTo = 0.3; m.hp = p.hp; m.wall = 0; m.dashT = 0; m.focusT = 0; }
  const tail = pup.chain('tail', 11, 28, TAIL_REST);
  const speed = Math.abs(p.vx) / RUN; const moving = p.onGround && Math.abs(p.vx) > 20;
  // events, found by watching the state change
  const landed = p.onGround && m.air, jumped = !p.onGround && !m.air; const struck = p.attackTimer > m.attackTimer, cast = p.castTimer > m.castTimer, hit = p.hp < m.hp;
  const dashStart = p.dashing > 0 && !m.dashing; m.dashing = p.dashing > 0;
  m.air = !p.onGround; m.attackTimer = p.attackTimer; m.castTimer = p.castTimer; m.hp = p.hp;
  if (landed) { pup.impulse('sy', -3.2).impulse('sx', 2.2).impulse('earL', 360).impulse('earR', 360).impulse('legTuck', -2); m.landT = 0.25; }
  if (jumped && p.vy < -150) { pup.impulse('sy', 2.4).impulse('sx', -1.4).impulse('earL', -420).impulse('earR', -420); }
  if (hit) pup.impulse('lean', -260).impulse('earL', 260).impulse('earR', -200);
  if (dashStart) pup.impulse('earCurl', 8);
  const T = { pawKind: 'none', paw: 0, ember: 0, aura: 0, hurt: 0, sit: 0, squint: 0, wide: 0, legTuck: 0, earCurl: 0, cheek: 0.45, glow: p.focusing || p.warm ? 0.5 : 0.28, bob: 0 };
  let eyeOpen = 1;
  // ---- blinks and glances (idle life)
  m.blink -= dt; if (m.blink < 0) { m.blink = (Math.random() < 0.2 ? 0.25 : 2.5 + Math.random() * 3); m.blinkT = 0.14; }
  if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = m.blinkT > 0.07 ? 1 - (0.14 - m.blinkT) / 0.07 : m.blinkT / 0.07; }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.5 + Math.random() * 3.5; m.lookTo = Math.random() < 0.5 ? 0.35 : -0.2 + Math.random() * 0.4; }
  T.look = moving || !p.onGround ? 0.45 : m.lookTo;
  // ---- base pose by state (priority order matches the old pose table)
  if (p.sitting) { Object.assign(T, { lean: 0, earL: -48 + Math.sin(t * 1.3) * 2, earR: -30 + Math.sin(t * 1.3 + 1) * 2, legL: 0, legR: 0, sit: 1, sx: 1.08 + Math.sin(t * 1.6) * 0.012, sy: 0.9 + Math.sin(t * 1.6) * 0.015 }); eyeOpen = Math.min(eyeOpen, Math.max(0, 1 - (p.benchTimer || 0) * 1.5)); }
  else if (p.hurtTimer > 0) { Object.assign(T, { lean: -10, earL: -30, earR: -46, legL: 20, legR: -20, squint: 1, hurt: 1, sx: 1.04, sy: 0.96 }); }
  else if (p.dashing > 0) { Object.assign(T, { lean: 22, earL: -92, earR: -74, earCurl: 1, legL: -30, legR: -30, legTuck: 0.5, squint: 1, sx: 1.28, sy: 0.74 }); }
  else if (p.focusing) { const k = p.focusTimer / 0.9; Object.assign(T, { lean: 0, earL: -20 + k * 14, earR: 2 + k * 14, legL: 0, legR: 0, aura: 0.4 + k * 0.6, glow: 0.6 + k * 0.4, sx: 1.03 + Math.sin(t * 5) * 0.012, sy: 0.97 + Math.sin(t * 5) * 0.02, bob: k * 1.5, cheek: 0.6 }); eyeOpen = 0; }
  else if (p.wallSliding) { Object.assign(T, { lean: -14, earL: -20 + Math.sin(t * 9) * 3, earR: 6 + Math.sin(t * 9 + 2) * 3, legL: 30, legR: 20, paw: 1, pawKind: 'cling', sx: 0.96, sy: 1.02 }); }
  else if (!p.onGround) {
    const up = p.vy < -60, fall = p.vy > 120; const vk = clamp(p.vy / 430, -1, 1);
    Object.assign(T, { lean: clamp(p.vx / 400, -1, 1) * 10 + (up ? 5 : -3), earL: up ? -78 : fall ? -8 - vk * 6 : -40, earR: up ? -56 : fall ? 14 : -18, legL: up ? -40 : 14, legR: up ? -40 : -10, legTuck: up ? 0.7 : 0.15, wide: fall ? 1 : 0, sx: up ? 0.92 : 1.04, sy: up ? 1.14 : 0.96, earCurl: fall ? 0.4 : 0 });
    if (p.canDoubleJump === false && up) T.lean += 6; // second leap: a little more flourish
  }
  else if (moving) {
    // a bounding gait: crouch, spring forward with the legs trailing, land on them again; one bound per 4 units of the
    // run counter (that is also the footstep cadence), amplitude scaled by speed so a slow walk is a gentle shuffle
    const ph = p.anim.run * (Math.PI / 2); const s = Math.sin(ph), c = Math.cos(ph); const back = Math.sign(p.vx) !== p.facing ? -1 : 1;
    Object.assign(T, { lean: (8 + s * 7) * speed * back, earL: -40 - speed * 22 + s * 9 * speed, earR: -14 - speed * 22 + s * 9 * speed, legL: (-c * 30 - 4) * speed * back, legR: (-Math.cos(ph + 0.7) * 30 + 4) * speed * back,
      legTuck: Math.max(0, s) * 0.35 * speed, sy: 1 + s * 0.11 * speed, sx: 1 - s * 0.06 * speed, bob: Math.max(0, s) * 4.2 * speed });
  }
  else {
    m.twitch = (m.twitch === undefined ? 2 + Math.random() * 4 : m.twitch - dt); if (m.twitch < 0) { m.twitch = 2.5 + Math.random() * 5; pup.impulse(Math.random() < 0.5 ? 'earL' : 'earR', 260); }
    Object.assign(T, { lean: 0, earL: -38 + Math.sin(t * 1.7) * 2.5, earR: -14 + Math.sin(t * 1.7 + 0.9) * 2.5, legL: 0, legR: 0, sx: 1 + Math.sin(t * 2.2) * 0.012, sy: 1 + Math.sin(t * 2.2) * 0.018 });
  }
  // ---- actions layered on top: strike and cast clips keyed to the player's own timers
  if (p.attackTimer > 0 && !p.dashing) {
    const k = 1 - p.attackTimer / 0.11; const dirA = p.attackDir === 'up' ? -95 : p.attackDir === 'down' ? 75 : -18;
    const c = Anim.keys(k, [[0, { paw: 0.2, lean: -4 }], [0.35, { paw: 1.25, lean: 16 }, 'outCubic'], [1, { paw: 0.9, lean: 10 }, 'outQuad']]);
    Object.assign(T, { pawKind: 'strike', paw: c.paw, pawAng: dirA, lean: T.lean + c.lean, earL: T.earL - 30, earR: T.earR - 30, squint: 1 });
    if (struck) pup.impulse('sx', 1.6).impulse('earL', -200).impulse('earR', -200);
  } else if (p.castTimer > 0) {
    const k = 1 - p.castTimer / 0.35;
    const c = Anim.keys(k, [[0, { paw: 0.3, ember: 1, lean: -6 }], [0.25, { paw: 0.5, ember: 1.2, lean: -8 }, 'outQuad'], [0.4, { paw: 1.2, ember: 0, lean: 12 }, 'outCubic'], [1, { paw: 0.6, ember: 0, lean: 4 }, 'outQuad']]);
    Object.assign(T, { pawKind: 'ember', paw: c.paw, pawAng: -25, ember: c.ember, lean: T.lean + c.lean, earL: T.earL - 20, earR: T.earR - 20 });
    if (cast) pup.impulse('sx', -1.5).impulse('sy', 1.5);
  }
  if (p.flareCd > 1.85) { T.glow = 1; T.aura = 1; T.earL = -70; T.earR = -50; }
  T.eyeOpen = eyeOpen;
  pup.target(T);
  // ---- secondary motion: the tail streams behind the body, flutters when idle, hangs when clinging
  const vxs = p.vx / SCALE, vys = p.vy / SCALE; const facing = p.wallSliding ? -p.wallDir : p.facing;
  tail.update(dt, { vx: vxs * 0.35, vy: vys * 0.25, facing, gravity: p.wallSliding ? 90 : 26, drag: 0.5, stiff: p.onGround && !moving ? 9 : 5, damp: 0.86, wind: { x: Math.sin(t * 2.6) * 6 * (moving ? 0 : 1), y: Math.cos(t * 1.9) * 4 } });
  // dash after-images
  if (p.dashing > 0) { m.ghostT = (m.ghostT || 0) + dt; if (m.ghostT > 0.022) { m.ghostT = 0; pup.ghost(p.x + p.w / 2, p.y + p.h, 0.3, 0.5); } }
}

module.exports = { name: 'mote', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control };
