// Gulletroot: a root-bulb the size of a hut, split by a maw of thorn teeth. It sits on a fan of roots that creep and
// flex on their own, breathes with its whole body, and never quite shuts its mouth. Five seed-eyes blink one at a
// time and swivel toward Mote (the game flips the scene so +x always faces the player). Everything is keyed to the
// boss's own timers (src/entities.js updateGulletroot, 'fast' = 0.7 in phase 2) so the hit frames land on the game's:
//   intro (1.5 s)        it rises out of the floor with its eyes shut, rumbling and throwing soil, then roars awake
//   thorns_tele (0.7 s)  cracks glow yellow on the bulb, the roots pull taut and dig in, the teeth grind, a shudder
//                        builds to a crouch; 'thorns' releases it upward with the roots splaying and soil flying
//   lash (0.5 s)         the bulb coils back on its roots with the maw gaping and drooling, then lunges at Mote and a
//                        vine whips out of its throat on the frame the game spawns the projectile
//   spit (0.45 s)        an inhale (the body swells and tips back, eyes rolling up), then a recoiling hack with flecks
//   submerge / emerge    eyes and maw shut as it is dragged under with its roots pulled in; it bursts back up snarling
//   a hit                a flinch away from Mote, the maw slamming shut, eyes squinting; death is a sagging, twitching fade
// Phase 2 (b.phase === 2) stains the bulb a sickly ochre with glowing orange veins, turns the eyes orange, and twitches
// everything faster. Old world-space effects live in after(): the 'lighter' maw glow and the soil crumbs. See art/ANIMATION.md.
const L = require('../lib');
const { svg, rad, path, ell, stroke, g, rot, tr, curve, mix, clamp, lerp, num: n } = L;
const W = 84, H = 64, CX = 42, FY = 64; // template box; the bulb pivots (lean, squash, lunge) about the bottom centre, where the roots meet the floor
const SCALE = 0.78; // world units per template unit (ART_SCALE.gulletroot), for the world-space effects in after()
const TAU = Math.PI * 2;
const T_TELE = 0.7, T_LASH = 0.5, T_SPIT = 0.45, T_INTRO = 1.5, T_SINK = 0.6, T_RISE = 0.5; // the game's state timers (the first three scale by 'fast')
const EYE = '#c8ff5a', EYE_HOT = '#ffe36a', EYE_RAGE = '#ff9a4a', LINE = '#0f1c12', MAW_LINE = '#0a120c', MOTTLE = '#a8d070';
const BULB = ['#6a9a44', '#35542c', '#16281a'], BULB_RAGE = ['#948c3a', '#4e3a26', '#24100c'], BULB_STOPS = [[0, BULB[0]], [0.5, BULB[1]], [1, BULB[2]]];
const ROOT_A = '#5a3a24', ROOT_B = '#4a2f1e', ROOT_HI = '#8a5a34', TENDRIL = '#7a4e2c';
const TOOTH_U = '#e8ffd0', TOOTH_L = '#d8f0c0', DROOL = '#d8ffb0', VINE = '#4f8a3a', VINE_TIP = '#c8ff5a', SOIL = '#4e3422', SOIL_HI = '#8a5e38';
const EYES = [[24, 20, 3], [31, 15.5, 1.8], [52, 15, 3.2], [60, 20, 1.9], [42, 13, 1.4]]; // [x, y, r]
const WAKE_AT = [0.25, 0.75, 0, 1, 0.5]; // the order the eyes open as it wakes (0 first)
const circD = (x, y, r) => `M${n(x - r)} ${n(y)} a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0 a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0`;
const MOTTLE_D = [[16, 22, 3], [26, 12, 2.4], [58, 14, 2.8], [68, 28, 2.2], [22, 44, 2], [62, 46, 2.4], [40, 10, 1.6]].map(([x, y, r]) => circD(x, y, r)).join('');
const VENT_D = circD(12, 34, 2.2) + circD(72, 34, 2.2), VENT_GLOW_D = circD(12, 34, 1) + circD(72, 34, 1);
const CRACK_D = 'M14 30 L20 26 L18 20 M70 30 L64 26 L66 20';
const VEIN_D = 'M30 9 L33 15 L29 21 M55 9 L51 14 L55 20 M18 44 L25 49 M66 44 L59 49 M40 7 L43 11';
const BULB_D = 'M8 40 C4 18 20 6 42 6 C64 6 80 18 76 40 C72 52 58 58 42 58 C26 58 12 52 8 40 Z';
const TEETH = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: 20 + i * 7.3, hh: 3 + (i % 3) * 1.4, up: i % 2 }));
const TEND_R = [{ x: 2.4, y: -3.2 }, { x: 4.2, y: -6.8 }, { x: 4.6, y: -10.5 }], TEND_L = TEND_R.map((p) => ({ x: -p.x, y: p.y })); // sprouts curling up off the outermost root tips
const DROOL_REST = [{ x: 0, y: 2.6 }, { x: 0.3, y: 5.2 }]; // strands hanging off two upper teeth
const DROOL_X1 = 34.6, DROOL_X2 = 49.2, DROOL_Y1 = 8.8, DROOL_Y2 = 7.4; // their anchors: tooth tips, offset from the upper gum line
const q = (v) => Math.round(clamp(v, 0, 1) * 10) / 10; // colour amounts quantised so the gradient cache is not churned every frame
const eyeColour = (hq, rq) => { let c = EYE; if (hq) c = mix(c, EYE_HOT, hq); if (rq) c = mix(c, EYE_RAGE, rq * (1 - hq * 0.5)); return c; };
const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a.toFixed(3)})`;

const params = {
  open: 0.12,                       // maw 0 shut .. 1 gaping (overshoots a little either way)
  sx: 1, sy: 1, bob: 0, lean: 0, shift: 0, // squash/stretch about the floor centre, lift, tilt (deg, + nose toward Mote), lunge toward Mote (template units)
  shake: 0, ph: 0,                  // quiver amplitude and a free clock (creep, jitter, flicker)
  rootFlex: 0, rootCreep: 1,        // roots: - pulled taut and dug in .. + splayed out; amplitude of their slow creeping
  eyeOpen: 1, wake: 1, wink: -1, winkK: 0, // lids (all), eyes opening in sequence 0..1 (intro, emerge, sleep), which eye is winking and how far
  lookX: 0.5, lookY: 0,             // where the eyes' cores sit: + toward Mote, + down
  eyeK: 1, hot: 0, rage: 0, glow: 0.3, // halo size, thorn-telegraph yellow 0..1, phase-2 orange 0..1, throat/vent brightness
  drool: 0, vine: 0, vineY: 0, spit: 0, crack: 0, chew: 0, // drool strands, the lash vine's reach 0..1 and its tip wobble, spit flecks 1 fresh .. 0 gone, telegraph cracks, lower-jaw slide
};
// [stiffness, damping ratio] for the values that overshoot and settle; the clocks, amounts and sequencers snap
const springs = {
  open: [220, 0.5], sx: [300, 0.45], sy: [300, 0.45], bob: [240, 0.5], lean: [220, 0.5], shift: [200, 0.45], rootFlex: [140, 0.5], rootCreep: [60, 1],
  eyeOpen: [700, 0.9], lookX: [160, 0.8], lookY: [160, 0.8], eyeK: [110, 0.9], hot: [120, 1], rage: [30, 1], glow: [100, 1], drool: [120, 0.9], vine: [420, 0.6], crack: [120, 1], chew: [260, 0.35],
};
// stills exported to art/gulletroot_<pose>.svg (closed, open and tele are the originals; the rest are new readable poses)
const poses = {
  closed: {},
  open: { open: 1, drool: 1, glow: 1, lookX: 0.6, eyeK: 1.2 },
  tele: { open: 0.45, hot: 1, crack: 1, rootFlex: -0.8, rootCreep: 0.2, lookY: 0.6, eyeK: 1.5, sy: 0.95, sx: 1.03, bob: -1 },
  lash: { shift: 9, lean: 7, sx: 1.08, sy: 0.95, open: 1.05, vine: 1, drool: 1, glow: 1, rootFlex: 0.6, lookX: 1, eyeK: 1.5 },
  spit: { sy: 0.9, sx: 1.08, lean: 5, open: 1.1, spit: 0.55, drool: 1, glow: 1.2, lookY: -0.6, lookX: 0.7, rootFlex: 0.4, eyeK: 1.5 },
  rage: { rage: 1, open: 0.3, eyeK: 1.3, glow: 0.6, lookX: 0.8 },
  hurt: { open: 0, eyeOpen: 0.25, lean: -5, shift: -4, sx: 1.04, sy: 0.96, rootFlex: -0.4 },
  sleep: { wake: 0, open: 0, rootFlex: -1, rootCreep: 0.2, sy: 0.92, glow: 0 },
};

// a root's tip and control point: fanning from the floor centre, creeping on the clock, pulled in or splayed by rootFlex, dragged along by a lunge
function rootPts(i, P) {
  const x1 = CX + i * 13, f = P.rootFlex, cr = P.rootCreep, ph = P.ph; const fin = f < 0 ? -f : 0, fout = f > 0 ? f : 0;
  const tx = x1 + Math.sin(ph * 0.5 + i * 2.1) * 1.5 * cr - i * 3 * fin + i * 2.5 * fout + P.shift * 0.7;
  const ty = 34 + Math.cos(ph * 0.6 + i * 1.3) * 1.2 * cr + 4 * fin - 3 * fout - P.bob * 0.6;
  const cx = x1 - i + Math.sin(ph * 0.7 + i * 1.7) * 2.6 * cr + P.shift * 0.35, cy = 46 + 2 * fin - P.bob * 0.3;
  return [tx, ty, cx, cy];
}
const restPts = (ax, ay, rest) => [{ x: ax, y: ay }].concat(rest.map((p) => ({ x: ax + p.x, y: ay + p.y })));

function make(P, pup) {
  const open = clamp(P.open, -0.08, 1.2), hq = q(P.hot), rq = q(P.rage), ec = eyeColour(hq, rq);
  const sh = P.shake, jx = sh * Math.sin(P.ph * 61) * 1.3, jy = sh * Math.cos(P.ph * 47) * 0.6; // the quiver
  // roots: nine of them, buried below the box (the game clips at the floor), alternating two barks, one highlight pass
  let dA = '', dB = '';
  for (let i = -4; i <= 4; i++) { const x0 = CX + i * 5; const [tx, ty, cx, cy] = rootPts(i, P); const d = `M${x0} 68 C${x0} 54 ${n(cx)} ${n(cy)} ${n(tx)} ${n(ty)}`; if (i % 2) dB += d; else dA += d; }
  const roots = [stroke(dA, ROOT_A, 5.5), stroke(dB, ROOT_B, 5.5), stroke(dA + dB, ROOT_HI, 1.2, { opacity: 0.6 })];
  // sprouts on the outermost root tips: verlet chains when animated, their rest curls for the stills
  const tl = pup && pup.chains.tendL ? pup.chains.tendL.points() : restPts(rootPts(-4, P)[0], rootPts(-4, P)[1], TEND_L);
  const trr = pup && pup.chains.tendR ? pup.chains.tendR.points() : restPts(rootPts(4, P)[0], rootPts(4, P)[1], TEND_R);
  const tendrils = [stroke(curve(tl), TENDRIL, 1.8), stroke(curve(trr), TENDRIL, 1.8)];
  // the bulb, stained ochre by rage
  const stops = rq ? [[0, mix(BULB[0], BULB_RAGE[0], rq)], [0.5, mix(BULB[1], BULB_RAGE[1], rq)], [1, mix(BULB[2], BULB_RAGE[2], rq)]] : BULB_STOPS;
  const bulb = path(BULB_D, rad('gbu', 34, 26, 34, stops, 30, 20), { stroke: LINE, strokeWidth: 1.6 });
  const veins = rq > 0.05 ? stroke(VEIN_D, EYE_RAGE, 1, { opacity: rq * (0.35 + 0.15 * Math.sin(P.ph * 3)) }) : null;
  // the maw: lips part with open, the throat glows the eyes' colour; two rows of thorn teeth, the lower row sliding with chew
  const lipU = 28 - open * 12, lipL = 44 + open * 10, yu = 31 - open * 9, yl = 41 + open * 8, ch = P.chew;
  const throat = rad('gth', 42, 38, 14 + Math.round(open * 10) * 0.6, [[0, ec, 0.9], [0.5, rq ? mix('#5a7a2a', '#7a4a1a', rq) : '#5a7a2a', 0.6], [1, '#120a10', 0.9]]);
  const maw = path(`M16 36 C28 ${n(lipU)} 56 ${n(lipU)} 68 36 C56 ${n(lipL)} 28 ${n(lipL)} 16 36 Z`, throat, { stroke: MAW_LINE, strokeWidth: 1.2 });
  let dU = '', dL = '';
  for (const { x, hh, up } of TEETH) { const y0 = yu + up; dU += `M${n(x - 2)} ${n(y0)} L${n(x)} ${n(yu + hh + 3)} L${n(x + 2)} ${n(y0)} Z`; dL += `M${n(x - 2 + ch)} ${n(yl)} L${n(x + ch)} ${n(yl - hh - 2)} L${n(x + 2 + ch)} ${n(yl)} Z`; }
  // drool: two strands off the upper teeth (chains in the game) with a drop at the end, only while the maw is open enough to see them
  const dr = clamp(P.drool, 0, 1); let drool = null;
  if (dr > 0.05 && open > 0.25) {
    const p1 = pup && pup.chains.drool1 ? pup.chains.drool1.points() : restPts(DROOL_X1, yu + DROOL_Y1, DROOL_REST), p2 = pup && pup.chains.drool2 ? pup.chains.drool2.points() : restPts(DROOL_X2, yu + DROOL_Y2, DROOL_REST);
    const e1 = p1[p1.length - 1], e2 = p2[p2.length - 1];
    drool = [stroke(curve(p1) + curve(p2), DROOL, 1.1, { opacity: dr * 0.85 }), path(circD(e1.x, e1.y, 0.9) + circD(e2.x, e2.y, 0.8), DROOL, { opacity: dr * 0.9 })];
  }
  // the lash vine whipping out of the throat and down to the ground, with a leaf-blade tip
  const vk = clamp(P.vine, 0, 1.1); let vine = null;
  if (vk > 0.03) { const len = vk * 40, tx = 44 + len, ty = 38 + len * 0.42 + P.vineY; const w1 = Math.sin(P.ph * 23) * 2 * vk;
    vine = [stroke(`M40 38 Q${n(44 + len * 0.5)} ${n(36 + len * 0.1 + w1)} ${n(tx)} ${n(ty)}`, VINE, 3.6), path(`M${n(tx - 2)} ${n(ty + 1.5)} L${n(tx + 6)} ${n(ty - 1)} L${n(tx + 1)} ${n(ty - 4)} Z`, VINE_TIP)]; }
  // spit flecks spraying up and forward out of the maw
  const sp = clamp(P.spit, 0, 1); let flecks = null;
  if (sp > 0.03) { const k = 1 - sp; let d = ''; for (let i = 0; i < 4; i++) { const a = -1.25 + i * 0.3, dist = 6 + k * 24 + i * 2; d += circD(46 + Math.cos(a) * dist, 30 + Math.sin(a) * dist + k * k * 10, 1.7 - k); } flecks = path(d, ec, { opacity: sp * 0.9 }); }
  const vents = [path(VENT_D, LINE), path(VENT_GLOW_D, ec, { opacity: 0.5 + clamp(P.glow, 0, 1) * 0.35 })];
  // eyes: halos in one path, five lids, cores (slid toward Mote) in one path; each opens in its own turn as it wakes, and can wink alone
  let haloD = '', coreD = ''; const lids = [];
  for (let i = 0; i < 5; i++) {
    const [x, y, r] = EYES[i]; const o = clamp(P.eyeOpen * clamp((P.wake - WAKE_AT[i] * 0.6) / 0.4, 0, 1) * (i === P.wink ? 1 - P.winkK : 1), 0, 1);
    haloD += circD(x, y, r * 1.8 * P.eyeK * (0.5 + 0.5 * o)); lids.push(ell(x, y, r, r * Math.max(0.12, o), ec));
    if (o > 0.45) coreD += circD(x + P.lookX * r * 0.4, y + P.lookY * r * 0.35, r * 0.45);
  }
  const eyes = [path(haloD, ec, { opacity: 0.25 }), lids, coreD ? path(coreD, '#ffffff', { opacity: 0.8 }) : null];
  const ck = clamp(P.crack, 0, 1); const cracks = ck > 0.03 || rq > 0.05 ? stroke(CRACK_D, ec, 1.2, { opacity: Math.max(ck * 0.8, rq * 0.45) }) : null;
  const body = g([bulb, path(MOTTLE_D, MOTTLE, { opacity: 0.35 }), veins, maw, vine, path(dU, TOOTH_U), drool, path(dL, TOOTH_L), vents, eyes, cracks, flecks],
    { transform: `${tr(CX + P.shift + jx, FY + jy)} ${rot(P.lean)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-CX, -FY - P.bob)}` });
  return svg(W, H, [roots, tendrils, body]);
}

// ---- animation: from the boss's state (src/entities.js updateGulletroot) to parameter targets, every frame
function control(b, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.state = b.state; m.tPrev = -1; m.hp = b.hp; m.flash = b.flash || 0; m.t0 = Math.random() * 10;
    m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.wink = -1; m.winkT = 0; m.fidget = 2 + Math.random() * 3; m.chompT = 9; m.shudT = 0; m.glanceT = 0; m.wander = null;
    m.roarT = 9; m.roarLen = 0.7; m.hitT = 9; m.lashT = 9; m.spitT = 9; m.twitchT = 0.4; m.puffT = 0;
    m.puffs = []; for (let i = 0; i < 18; i++) m.puffs.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 1, hi: false });
  }
  const st = b.state, ang = b.phase >= 2, fast = ang ? 0.7 : 1, t = pup.time + m.t0, s = pup.scale || SCALE, fac = b.facing < 0 ? -1 : 1, alive = b.alive !== false;
  const cx = b.x + b.w / 2, floor = b.y + b.h, ground = b.floorY === undefined ? floor : b.floorY;
  // ---- events, found by watching the state and the game's timer: the roar after rising, the thorn release, the lash and spit frames, a hit
  const entered = st !== m.state, prev = m.state; const tPrev = entered ? -1 : m.tPrev; m.tPrev = b.t;
  const hit = alive && (b.hp < m.hp || (b.flash > 0 && m.flash <= 0));
  m.state = st; m.hp = b.hp; m.flash = b.flash || 0;
  const cross = (thr) => b.t >= thr && tPrev < thr; // the game's timer passed thr this frame
  // where Mote is, in template space (+x toward it): the eyes swivel there
  const G = info.game || (typeof game !== 'undefined' ? game : null), pl = G && G.player;
  let lx = 0.5, ly = 0.1;
  if (pl) { const dx = (pl.x + pl.w / 2 - cx) * fac, dy = pl.y + pl.h / 2 - (floor - 40 * s); lx = clamp(dx / 80, -0.4, 1); ly = clamp(dy / 60, -1, 1); }
  // soil crumbs (world units), thrown up around the base by the roots
  const puff = (x, y, r, vx, vy, life, hi) => { let o = m.puffs[0]; for (const p of m.puffs) if (p.life < o.life) o = p; o.x = x; o.y = y; o.r = r; o.vx = vx; o.vy = vy; o.life = o.max = life; o.hi = hi; };
  const soil = (nn, up) => { for (let i = 0; i < nn; i++) { const rx = (Math.random() - 0.5) * b.w * 1.3; puff(cx + rx, ground - 1 - Math.random() * 2, (1 + Math.random() * 1.6) * s, rx * (1.5 + Math.random()) + (Math.random() - 0.5) * 30, -up * (0.5 + Math.random()), 0.45 + Math.random() * 0.35, Math.random() < 0.4); } };
  if (entered && st === 'idle' && (prev === 'intro' || prev === 'emerge')) { m.roarT = 0; m.roarLen = prev === 'intro' ? 0.8 : 0.45; pup.impulse('open', prev === 'intro' ? 10 : 7).impulse('bob', 30).impulse('sy', 3).impulse('sx', -1.5).impulse('rootFlex', 8).impulse('eyeK', 4); soil(prev === 'intro' ? 8 : 6, 90); }
  if (entered && st === 'thorns') { pup.impulse('bob', 34).impulse('sy', 4).impulse('sx', -2.5).impulse('rootFlex', 14).impulse('open', 6).impulse('eyeK', 5); soil(8, 120); }
  if (st === 'lash' && cross(T_LASH * fast)) { m.lashT = 0; pup.impulse('shift', 160).impulse('lean', 340).impulse('sx', 3).impulse('sy', -2).impulse('open', 5).impulse('glow', 4).impulse('eyeK', 3); }
  if (st === 'spit' && cross(T_SPIT * fast)) { m.spitT = 0; pup.impulse('sy', -5).impulse('sx', 4).impulse('lean', 200).impulse('bob', -30).impulse('open', 6).impulse('glow', 5); }
  if (hit) { m.hitT = 0; pup.impulse('lean', -460).impulse('shift', -100).impulse('sx', 3.2).impulse('sy', -3.2).impulse('bob', -8).impulse('open', -14).impulse('rootFlex', -7).impulse('eyeOpen', -8).impulse('eyeK', -3); }
  if (entered && st === 'submerge') pup.impulse('open', -6).impulse('sy', -1.5);
  if (entered && st === 'emerge') soil(5, 60);
  m.hitT += dt; m.lashT += dt; m.spitT += dt; m.roarT += dt; m.chompT += dt;
  // ---- idle life: single-eye winks and the odd full blink, glances away from Mote, fidgets (a chomp, a shudder, a jaw slide, a stare)
  m.blink -= dt; if (m.blink < 0) { if (Math.random() < 0.25) { m.blink = 0.4 + Math.random(); m.blinkT = 0.14; } else { m.blink = (0.8 + Math.random() * 2) * fast; m.wink = Math.floor(Math.random() * 5); m.winkT = 0.18; } }
  let eyeOpen = 1; if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = clamp(m.blinkT > 0.07 ? 1 - (0.14 - m.blinkT) / 0.07 : m.blinkT / 0.07, 0, 1); }
  let winkK = 0; if (m.winkT > 0) { m.winkT -= dt; winkK = clamp(m.winkT > 0.09 ? 1 - (0.18 - m.winkT) / 0.09 : m.winkT / 0.09, 0, 1); }
  m.glanceT -= dt; if (m.glanceT < 0) { m.glanceT = 1.5 + Math.random() * 3; m.wander = Math.random() < 0.3 ? { x: -0.5 + Math.random(), y: -0.6 + Math.random() * 1.2 } : null; }
  m.fidget -= dt;
  if (m.fidget < 0 && st === 'idle' && alive && m.roarT > m.roarLen && m.hitT > 0.5) {
    m.fidget = (1.5 + Math.random() * 3) * fast; const r = Math.random();
    if (r < 0.35) { m.chompT = 0; pup.impulse('open', 9); }
    else if (r < 0.6) { m.shudT = 0.25; pup.impulse('sy', 1.5); }
    else if (r < 0.8) pup.impulse('chew', (Math.random() < 0.5 ? 1 : -1) * 40).impulse('lean', (Math.random() - 0.5) * 60);
    else { pup.impulse('eyeK', 3); m.wander = { x: 0.9, y: -0.3 + Math.random() * 0.6 }; m.glanceT = 1; }
  }
  if (m.shudT > 0) m.shudT -= dt;
  const br = Math.sin(t * 1.7 * (ang ? 1.4 : 1)); // breath
  const T = {
    open: 0.12 + Anim.wave(t * 0.9, 0, 0.1) + (ang ? 0.08 : 0), sx: 1 + br * 0.012, sy: 1 + br * 0.028, bob: 0, lean: Math.sin(t * 0.6) * 1.2, shift: 0,
    shake: (ang ? 0.12 : 0) + (m.shudT > 0 ? 0.5 : 0), ph: t, rootFlex: br * 0.15, rootCreep: 1, wake: 1,
    lookX: m.wander ? m.wander.x : lx + (ang ? Math.sin(t * 13) * 0.12 : 0), lookY: m.wander ? m.wander.y : ly, eyeK: 1 + Math.sin(t * (ang ? 4.1 : 2.3)) * 0.15, hot: 0, rage: ang ? 1 : 0,
    glow: 0.3 + Math.sin(t * 2.1) * 0.08, drool: 0, vine: 0, vineY: 0, spit: 0, crack: 0, chew: ang ? Math.sin(t * 9) * 0.5 : 0,
  };
  if (m.chompT < 0.3) { T.open = m.chompT < 0.13 ? 0.7 : 0.02; if (m.chompT >= 0.13 && m.chompT - dt < 0.13) pup.impulse('open', -16); }
  // ---- states, keyed to the game's own timers
  if (st === 'thorns_tele') {
    // the wind-up: cracks glow, the roots pull taut and dig in, the teeth grind, a shudder builds to a crouch just before the thorns erupt
    const k = clamp(b.t / (T_TELE * fast), 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { open: 0.15, hot: 0.2, crack: 0, rootFlex: 0, sy: 1, sx: 1, bob: 0, shake: 0.1, glow: 0.4, eyeK: 1.1 }],
      [0.35, { open: 0.42, hot: 0.7, crack: 0.6, rootFlex: -0.7, sy: 0.97, sx: 1.02, bob: -0.6, shake: 0.4, glow: 0.7, eyeK: 1.4 }, 'outQuad'],
      [0.85, { open: 0.45, hot: 0.95, crack: 0.9, rootFlex: -1, sy: 0.94, sx: 1.04, bob: -1.4, shake: 0.9, glow: 0.9, eyeK: 1.6 }, 'inOutQuad'],
      [1, { open: 0.5, hot: 1, crack: 1, rootFlex: -1.25, sy: 0.91, sx: 1.06, bob: -2, shake: 1.7, glow: 1, eyeK: 1.8 }, 'inQuad'],
    ]));
    T.lookY = 0.8; T.lookX = 0.2; T.rootCreep = 1 - k * 0.8; T.chew = Math.sin(t * 34) * k * 1.4; T.lean = Math.sin(t * 31) * k * 1.5;
  } else if (st === 'thorns') {
    // the release (the impulses fired on entry): it pops up with the roots splayed, then the heat drains and it settles
    const k = clamp(b.t / 0.9, 0, 1);
    Object.assign(T, Anim.keys(k, [
      [0, { open: 0.85, hot: 1, crack: 1, rootFlex: 0.9, bob: 2.5, eyeK: 1.8, glow: 1, drool: 0.7, sy: 1.04 }],
      [0.3, { open: 0.6, hot: 0.5, crack: 0.6, rootFlex: 0.4, bob: 0.6, eyeK: 1.4, glow: 0.7, drool: 0.5, sy: 1 }, 'outQuad'],
      [1, { open: 0.15, hot: 0, crack: 0, rootFlex: 0, bob: 0, eyeK: 1, glow: 0.35, drool: 0, sy: 1 }, 'inOutQuad'],
    ]));
    T.lookY = lerp(0.6, ly, k);
  } else if (st === 'lash') {
    const thr = T_LASH * fast;
    if (b.t < thr) {
      // the coil: it draws back on its roots, the maw gaping and drooling, the eyes fixed on Mote, a quiver building
      const k = clamp(b.t / thr, 0, 1);
      Object.assign(T, Anim.keys(k, [
        [0, { shift: 0, lean: 0, sx: 1, sy: 1, open: 0.2, drool: 0.2, rootFlex: 0, eyeK: 1.1, glow: 0.4, bob: 0 }],
        [0.5, { shift: -4, lean: -3, sx: 0.95, sy: 1.05, open: 0.75, drool: 0.9, rootFlex: -0.5, eyeK: 1.4, glow: 0.7, bob: 1 }, 'outCubic'],
        [1, { shift: -8.5, lean: -6.5, sx: 0.9, sy: 1.1, open: 0.95, drool: 1, rootFlex: -0.95, eyeK: 1.6, glow: 0.9, bob: 2 }, 'inQuad'],
      ])); T.shake = k * 0.5; T.lookX = 1; T.lookY = ly * 0.5 + 0.2;
    } else {
      // the lunge (impulses on the hit frame): the whole bulb throws itself at Mote and the vine whips out, then it drags itself back
      const k = clamp(m.lashT, 0, 0.75);
      Object.assign(T, Anim.keys(k, [
        [0, { shift: 9, lean: 7, sx: 1.1, sy: 0.93, open: 1.15, vine: 1, drool: 1, rootFlex: 0.7, glow: 1.1, eyeK: 1.7, bob: -0.5 }],
        [0.2, { shift: 10, lean: 7.5, sx: 1.08, sy: 0.95, open: 1.05, vine: 1, drool: 0.95, rootFlex: 0.6, glow: 1, eyeK: 1.5, bob: 0 }, 'outQuad'],
        [0.45, { shift: 2, lean: 2, sx: 1, sy: 1, open: 0.65, vine: 0, drool: 0.6, rootFlex: 0.2, glow: 0.6, eyeK: 1.2, bob: 0 }, 'inOutQuad'],
        [0.75, { shift: 0, lean: 0, sx: 1, sy: 1, open: 0.25, vine: 0, drool: 0.15, rootFlex: 0, glow: 0.35, eyeK: 1, bob: 0 }, 'outQuad'],
      ])); T.lookX = 1; T.vineY = Math.sin(t * 19) * 1.5;
    }
  } else if (st === 'spit') {
    const thr = T_SPIT * fast;
    if (b.t < thr) {
      // the inhale: the body swells and tips back, the eyes roll up along the throw, the throat brightens
      const k = clamp(b.t / thr, 0, 1);
      Object.assign(T, Anim.keys(k, [
        [0, { sy: 1, sx: 1, bob: 0, lean: 0, open: 0.2, drool: 0.3, glow: 0.35, rootFlex: 0, eyeK: 1.1 }],
        [0.6, { sy: 1.1, sx: 0.95, bob: 3, lean: -4, open: 0.6, drool: 0.7, glow: 0.7, rootFlex: -0.3, eyeK: 1.4 }, 'outCubic'],
        [1, { sy: 1.15, sx: 0.92, bob: 4.5, lean: -7, open: 0.7, drool: 0.9, glow: 1, rootFlex: -0.5, eyeK: 1.6 }, 'inQuad'],
      ])); T.lookY = -0.8; T.lookX = 0.7; T.shake = k * 0.3;
    } else {
      // the hack (impulses on the spit frame): a recoiling squash with the maw thrown wide and flecks flying, then it straightens
      const k = clamp(m.spitT, 0, 0.6);
      Object.assign(T, Anim.keys(k, [
        [0, { sy: 0.86, sx: 1.12, bob: -2, lean: 6, open: 1.15, spit: 1, drool: 1, glow: 1.3, rootFlex: 0.5, eyeK: 1.7 }],
        [0.2, { sy: 0.95, sx: 1.04, bob: -1, lean: 3, open: 1, spit: 0.4, drool: 0.9, glow: 0.9, rootFlex: 0.3, eyeK: 1.4 }, 'outQuad'],
        [0.6, { sy: 1, sx: 1, bob: 0, lean: 0, open: 0.3, spit: 0, drool: 0.3, glow: 0.4, rootFlex: 0, eyeK: 1 }, 'inOutQuad'],
      ])); T.lookY = lerp(-0.6, ly, k / 0.6); T.lookX = 0.7;
    }
  } else if (st === 'intro') {
    // rising from the floor with its eyes shut, rumbling, soil spilling off it; the eyes open one by one near the top
    const k = clamp(b.t / T_INTRO, 0, 1);
    Object.assign(T, { wake: Anim.smooth(k, 0.3, 0.95), open: 0.04, shake: 0.25 + (1 - k) * 0.4, rootFlex: -0.7, eyeK: 0.8 + k * 0.3, sy: 0.96, glow: 0.2 + k * 0.2, rootCreep: 0.3, lookY: 0.3 });
    m.puffT += dt; if (m.puffT > 0.07 && k < 1) { m.puffT = 0; soil(1, 50 + k * 40); }
  } else if (st === 'submerge') {
    // dragged under: eyes and maw shut, the roots haul it down, it is pressed flat, soil spills in over it
    const k = clamp(b.t / T_SINK, 0, 1);
    Object.assign(T, { wake: 1 - Anim.smooth(k, 0, 0.4), open: 0.1 * (1 - k), sy: 1 - k * 0.08, sx: 1 + k * 0.03, rootFlex: -k * 1.2, shake: k < 1 ? 0.35 + k * 0.3 : 0, eyeK: 0.8, rootCreep: 0.3, glow: 0.3 * (1 - k), lean: 0 });
    m.puffT += dt; if (m.puffT > 0.05 && k < 1) { m.puffT = 0; soil(2, 40); }
  } else if (st === 'emerge') {
    // bursting back up somewhere else: shaking off soil, eyes opening, the maw already starting to snarl
    const k = clamp(b.t / T_RISE, 0, 1);
    Object.assign(T, { wake: Anim.smooth(k, 0.25, 0.85), open: 0.1 + Anim.smooth(k, 0.6, 1) * 0.5, shake: 0.7 + k * 0.3, rootFlex: -0.9 + k * 0.7, sy: 0.94 + k * 0.06, sx: 1.03, eyeK: 1.2 + k * 0.4, glow: 0.3 + k * 0.5, rootCreep: 0.4, hot: ang ? 0.3 : 0, lookX: 1 });
    m.puffT += dt; if (m.puffT > 0.04) { m.puffT = 0; soil(2, 110); }
  } else if (st === 'hurt') Object.assign(T, { open: 0, lean: -4, shift: -3, sx: 1.04, sy: 0.96, rootFlex: -0.4 });
  // the roar after rising (and a shorter snarl after re-emerging), layered on the idle
  if (st === 'idle' && m.roarT < m.roarLen) {
    const k = m.roarT / m.roarLen;
    Object.assign(T, Anim.keys(k, [
      [0, { open: 0.3, bob: 0, eyeK: 1.1, drool: 0.3, glow: 0.5, shake: 0.5, sy: 1.02, rootFlex: 0.5 }],
      [0.15, { open: 1.15, bob: 4, eyeK: 1.8, drool: 1, glow: 1.1, shake: 0.7, sy: 1.08, rootFlex: 0.8 }, 'outBack'],
      [0.6, { open: 1, bob: 3, eyeK: 1.6, drool: 1, glow: 1, shake: 0.35, sy: 1.05, rootFlex: 0.5 }, 'inOutQuad'],
      [1, { open: 0.2, bob: 0, eyeK: 1.1, drool: 0.2, glow: 0.4, shake: 0, sy: 1, rootFlex: 0 }, 'inOutQuad'],
    ])); T.lookX = 1; T.lookY = ly;
  }
  // the flinch (impulses fired on the hit): the maw stays clamped and the eyes squint for a beat
  if (m.hitT < 0.3 && alive) { const k = m.hitT / 0.3; T.open = Math.min(T.open, 0.02); eyeOpen = Math.min(eyeOpen, 0.2 + k * 0.8); T.vine = 0; T.drool = Math.min(T.drool, 0.3); T.glow = Math.min(T.glow, 0.2); }
  if (st === 'hurt') eyeOpen = Math.min(eyeOpen, 0.3);
  // death (the game fades and flickers it): the eyes dim and close, the maw sags open, the roots go slack, with a few last twitches
  if (!alive) {
    const k = clamp((b.deathT || 0) / 2.5, 0, 1);
    Object.assign(T, { wake: 1 - Anim.smooth(k, 0, 0.5), open: 0.1 + k * 0.6, lean: -k * 6, bob: -k * 3, sy: 1 - k * 0.1, sx: 1 + k * 0.05, rootFlex: k * 0.8, rootCreep: 0.1, glow: 0.3 * (1 - k), drool: 0.6 * k, rage: 0, hot: 0, shake: 0, eyeK: 1 - k * 0.5, vine: 0, spit: 0, crack: 0, chew: 0 });
    m.twitchT -= dt; if (m.twitchT < 0) { m.twitchT = 0.25 + Math.random() * 0.6; pup.impulse('lean', (Math.random() - 0.5) * 300).impulse('open', (Math.random() - 0.3) * 10).impulse('rootFlex', (Math.random() - 0.5) * 8).impulse('sy', (Math.random() - 0.5) * 3); }
  }
  T.eyeOpen = eyeOpen; T.winkK = winkK; T.wink = m.wink;
  pup.target(T);
  // ---- secondary motion: the root sprouts whip on a lunge and sway in idle; the drool strands hang off the teeth and swing with the maw
  const P = pup.P, vsh = pup.V.shift || 0;
  const tipL = rootPts(-4, P), tipR = rootPts(4, P);
  const tl = pup.chain('tendL', tipL[0], tipL[1], TEND_L), trr = pup.chain('tendR', tipR[0], tipR[1], TEND_R);
  tl.ax = tipL[0]; tl.ay = tipL[1]; trr.ax = tipR[0]; trr.ay = tipR[1];
  const env = { vx: vsh * 0.6, vy: -(pup.V.bob || 0) * 0.3, facing: 1, gravity: 22, drag: 0.5, stiff: 7, damp: 0.86, wind: { x: Math.sin(t * 1.9) * 5 + P.shake * Math.sin(t * 50) * 30, y: Math.cos(t * 2.3) * 4 } };
  tl.update(dt, env); trr.update(dt, env);
  const yu = 31 - clamp(P.open, -0.08, 1.2) * 9;
  const d1 = pup.chain('drool1', DROOL_X1, yu + DROOL_Y1, DROOL_REST), d2 = pup.chain('drool2', DROOL_X2, yu + DROOL_Y2, DROOL_REST);
  d1.ay = yu + DROOL_Y1; d2.ay = yu + DROOL_Y2;
  const denv = { vx: vsh * 0.8, vy: -(pup.V.bob || 0) * 0.5, facing: 1, gravity: 90, drag: 0.5, stiff: 2.5, damp: 0.9, wind: { x: Math.sin(t * 3.1) * 3, y: 0 } };
  d1.update(dt, denv); d2.update(dt, denv);
  for (const p of m.puffs) if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.vx *= 1 - Math.min(1, dt * 2); }
}

// world-space effects over the body: soil crumbs thrown up by the roots (they fall back under the floor, where the game's clip
// swallows them) and the maw's 'lighter' glow, hotter when it gapes, yellow for the thorn telegraph, orange in phase 2
function after(ctx, b, pup) {
  const P = pup.P, m = pup.mem, s = pup.scale || SCALE, fac = b.facing < 0 ? -1 : 1;
  const cx = b.x + b.w / 2, floor = b.y + b.h;
  ctx.save();
  if (m.puffs) for (const p of m.puffs) { if (p.life <= 0) continue; ctx.globalAlpha = Math.min(1, p.life / p.max * 2); ctx.fillStyle = p.hi ? SOIL_HI : SOIL; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  const open = clamp(P.open, 0, 1.2), gl = clamp(P.glow, 0, 1.5); const a = 0.1 + open * 0.16 + gl * 0.1;
  const jx = P.shake * Math.sin(P.ph * 61) * 1.3;
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba(eyeColour(q(P.hot), q(P.rage)), a);
  ctx.beginPath(); ctx.ellipse(cx + (P.shift + jx) * s * fac, floor - (28 + P.bob) * P.sy * s, (17 + open * 4) * P.sx * s, (6 + open * 5) * P.sy * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

module.exports = { name: 'gulletroot', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
