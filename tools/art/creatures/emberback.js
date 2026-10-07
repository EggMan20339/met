// Emberback: an armoured burrower whose cracked shell still burns inside. It crawls on six legs in a heavy tripod
// gait whose rate comes from its speed (src/entities.js case 'a': 26 u/s, 1.6x when Mote is near), lurching forward
// on every push with the shell rocking on its back; a head on a stubby neck peers out from under the front of the
// shell, blinks, nods and sniffs with ember-tipped feelers, and pulls in to turn (the module keeps drawing the old
// facing for a tenth of a second while the body narrows, then flips and the head pops out the other side). The cracks
// pulse with the heat inside: stronger and faster when it hurries after Mote, when the head lowers, the eye swells and
// the mandibles part on a hiss. A blocked frontal hit ('shell', 0.7 s) snaps the head and legs in and clamps the shell
// down with an overshoot while it skids back on a shower of sparks and after-images; near the end of the tuck the heat
// builds and the shell quivers, telegraphing the pop that opens it again. A hit from behind pitches it onto its nose,
// lifts the rear of the shell like a lid and lets a burst of embers out of the gap. Everything that must line up with
// the game is keyed to the entity's own timer (e.t). See art/ANIMATION.md.
const L = require('../lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, tr, curve, mix, clamp, lerp, num: n } = L;
const W = 28, H = 20, PX = 14, PY = 19.5; // template box; the body pivots (lean, squash, stretch) about the ground centre
const SCALE = 0.72; // world units per template unit (ART_SCALE.emberback): for the gait rate and world-space particles
const SPEED = 26; // ENEMY_DEFS.a.speed; it hurries at 1.6x when Mote is near, which is how aggro is inferred
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const LINE = '#1c110a', LEG = '#2a1a10', LEG_FAR = '#150c07', BELLY = '#5a4030', HEAD = '#3a2418', EMBER = '#ff8a3c', EMBER_HOT = '#ffd080', PALE = '#ffe0a0', EYE = '#ffb347', FEELER = '#4a3020';
const SHELL_G = lin('eb', 4, 3, 24, 16, [[0, '#a05a30'], [0.5, '#6a3a20'], [1, '#3a2010']]);
const SHELL_D = 'M3 15 C3 5 9 3 14 3 C19 3 25 5 25 15 Z', PLATES_D = 'M9 4.5 L9 15 M14.5 3.5 L14.5 15 M20 4.5 L20 15';
const CRACKS_D = 'M6 9 L8 11.5 L7 13.5 M11 6 L12.5 9 L11.5 12 M17 6 L16 9.5 L18 12 M22 9 L21 12', CRACKS_HI = 'M6 9 L8 11.5 M11 6 L12.5 9 M17 6 L16 9.5';
const DOTS = [[8, 11.5], [12.5, 9], [16, 9.5], [21, 12]]; // the crack junctions where the embers show through
// six legs: [hip x, far side, index along the side (0 back .. 2 front)]; tripod gait: near back + near front + far mid step together
const LEGS = [[9.5, true, 0], [14.5, true, 1], [19.5, true, 2], [8, false, 0], [13, false, 1], [18, false, 2]];
const TRI = [Math.PI, 0, Math.PI, 0, Math.PI, 0];
const HX = 25.5, HY = 14, NX = 23, NY = 14.5, HEAD_SLIDE = 5.5; // head centre at rest, the neck pivot, how far headOut 0..1 slides it
const FA = [{ x: 1.3, y: -1.4 }, { x: 2.6, y: -2.3 }], FB = [{ x: 1.5, y: -0.3 }, { x: 3, y: -0.4 }]; // feeler rest offsets from their roots
const FA_ROOT = [27.1, 12.3], FB_ROOT = [27.5, 13.1];

const params = {
  legPhase: 0, stride: 0,                   // gait phase (radians) and amplitude 0..1 (settles to 0 when it stops)
  legTuck: 0, legSplay: 0,                  // legs pulled in under the belly 0..1, braced wide 0..1
  gLift: 0, gLean: 0, gShift: 0, gHead: 0,  // gait-cycle body lift, pitch (deg), fore/aft lurch, head bob: written directly, no spring
  lean: 0, sx: 1, sy: 1, bob: 0, shift: 0,  // body pitch (deg, + nose down), squash/stretch about the ground centre, lift, fore/aft shift
  clamp: 0, lid: 0,                         // shell clamped down 0..1 (overshoots past 1), rear of the shell lifted (deg, hinged at the front)
  headOut: 1, headPitch: 0, headDrop: 0,    // head slid out of the shell (0 hidden .. 1 rest .. 1.3 stretched), nodded (deg, + nose down), pushed down
  jaw: 0, eyeOpen: 1, eyeK: 1, look: 0,     // mandibles parted 0..1, lid, eye halo size, glint slide (+ forward)
  heat: 0.5, heatPh: 0, ph: 0, shake: 0,    // crack heat 0..1.5, its pulse clock, a free clock, quiver amplitude
};
// [stiffness, damping ratio] for the values that overshoot and settle; the gait values, clocks and amounts snap
const springs = {
  stride: [140, 0.75], legTuck: [420, 0.5], legSplay: [260, 0.55], lean: [240, 0.45], sx: [380, 0.42], sy: [380, 0.42], bob: [300, 0.5], shift: [200, 0.5],
  clamp: [330, 0.3], lid: [220, 0.32], headOut: [260, 0.42], headPitch: [320, 0.4], headDrop: [300, 0.5], jaw: [300, 0.5],
  eyeOpen: [700, 0.9], eyeK: [90, 1], look: [160, 0.8], heat: [40, 1],
};
// stills exported to art/emberback_<pose>.svg (a, b and shell are the originals; the rest are new readable poses)
const poses = {
  a: { stride: 1, legPhase: 0 }, b: { stride: 1, legPhase: Math.PI },
  shell: { clamp: 1, legTuck: 1, headOut: -0.25, heat: 0.3, bob: -0.3 },
  idle: {},
  peek: { headOut: 0.78, headPitch: -6, eyeK: 1.4, heat: 0.4 },
  sniff: { headOut: 1.08, headPitch: -12, jaw: 0.3, eyeK: 1.1, heat: 0.55 },
  aggro: { stride: 1, legPhase: 1, lean: 2, headOut: 1.2, headPitch: 10, jaw: 0.5, eyeK: 1.6, heat: 1.3, heatPh: 1.57 },
  hurt: { lean: 9, lid: 10, legSplay: 1, headOut: 1.25, headPitch: -14, jaw: 0.6, eyeK: 1.8, heat: 1.4, sx: 1.06, sy: 0.94, look: -0.6 },
};

function make(P, pup) {
  const lift = P.bob + P.gLift, lean = P.lean + P.gLean, sx = clamp(P.sx, 0.5, 1.6), sy = clamp(P.sy, 0.5, 1.6), cl = clamp(P.clamp, -0.35, 1.45);
  const c = Math.cos(lean * DEG), s = Math.sin(lean * DEG);
  const bx = PX + P.shift + P.gShift + P.shake * Math.sin(P.ph * 71), by = PY + P.shake * 0.5 * Math.cos(P.ph * 53); // where the body pivot is (the quiver shakes it)
  // where a point of the body ends up after the body's own transform, so the hips stay attached while the feet stay on the ground
  const hipX = (x, y) => bx + (x - PX) * sx * c - (y - PY - lift) * sy * s, hipY = (x, y) => by + (x - PX) * sx * s + (y - PY - lift) * sy * c;
  // legs: hip under the shell rim -> knee out and back -> foot; feet swing on the gait and lift on their forward swing; tucked legs fold up under the belly
  const tk = clamp(P.legTuck, 0, 1), sp = P.legSplay, reach = 2.1 * P.stride * (1 - tk), hop = 2.1 * P.stride * (1 - tk);
  const legs = LEGS.map(([hx0, far, j], i) => {
    const p = P.legPhase + TRI[i]; const fl = Math.max(0, -Math.sin(p)) * hop;
    const hx = hipX(hx0, 14.6), hy = hipY(hx0, 14.6);
    const fx = hx0 - 2.6 + Math.cos(p) * reach + (far ? 0.7 : 0) + tk * 1.4 + sp * (j - 1) * 1.7, fy = PY - fl - tk * 2.9 - sp * 0.3;
    const kx = (hx + fx) / 2 - 1.8 - fl * 0.3 + tk * 0.8 + sp * (j - 1) * 0.5, ky = (hy + fy) / 2 + 0.2 - fl * 0.7;
    return stroke(`M${n(hx)} ${n(hy)} L${n(kx)} ${n(ky)} L${n(fx)} ${n(fy)}`, far ? LEG_FAR : LEG, far ? 1.5 : 1.9);
  });
  const shadow = ell(bx, PY + 0.3, 11 - lift * 0.5, 1.1, '#000000', { opacity: clamp(0.2 - lift * 0.02, 0.08, 0.2) });
  const bodyT = `${tr(bx, by)} ${rot(lean)} scale(${n(sx)} ${n(sy)}) ${tr(-PX, -PY - lift)}`;
  // the heat inside: a slow pulse on top of the heat level, quantised so the gradients stay cached
  const hq = Math.round(clamp(P.heat * (0.75 + 0.25 * Math.sin(P.heatPh)), 0, 1.5) * 24) / 24;
  const crackCol = hq > 1 ? mix(EMBER, EMBER_HOT, (hq - 1) * 1.6) : EMBER;
  // the soft body: a belly that flattens when the shell clamps; the glowing interior shows through the gap when the rear lifts
  const lidUp = clamp((P.lid - 2) / 10, 0, 1);
  const belly = g([
    ell(13, 15 - cl, 9.5, 3.4 - cl, BELLY),
    lidUp > 0.02 ? circ(6.5, 13.8, 2.5 + lidUp * 2, rad('lg', 6.5, 13.8, 2.5 + lidUp * 2, [[0, EMBER_HOT, 0.75 * lidUp], [0.5, EMBER, 0.45 * lidUp], [1, EMBER, 0]])) : null,
  ], { transform: bodyT });
  // the head: slides out of the shell on its neck, nods about the neck pivot; blinking eye, a parting beak with a glowing throat
  const open = clamp(P.eyeOpen, 0, 1), jw = clamp(P.jaw, 0, 1), eyeCol = hq > 0.9 ? mix(EYE, '#ffe6a0', (hq - 0.9) * 0.8) : EYE;
  const hdx = (P.headOut - 1) * HEAD_SLIDE, hdy = P.headDrop + P.gHead;
  const head = g([
    stroke('M20.5 14.7 L25 14.1', HEAD, 3.2),
    ell(HX, HY, 3.4, 2.8, HEAD, { stroke: LINE, strokeWidth: 0.8 }),
    jw > 0.04 ? circ(29, 14.7, 0.5 + jw * 0.7, crackCol, { opacity: 0.4 + jw * 0.6 }) : null,
    stroke('M28.2 14.1 C29.4 14 29.9 14.5 29.6 15', LINE, 0.9, { transform: rot(-jw * 20, 28.2, 14.4) }),
    stroke('M28.2 14.9 C29.3 15 29.7 15.5 29.3 16', LINE, 0.9, { transform: rot(jw * 24, 28.2, 14.6) }),
    circ(26.6, 13.4, 1.62 * clamp(P.eyeK, 0.3, 2.5), eyeCol, { opacity: 0.25 }),
    open < 0.12 ? stroke('M25.7 13.5 L27.5 13.3', eyeCol, 0.7) : ell(26.6, 13.4, 0.9, 0.9 * open, eyeCol),
    open > 0.4 ? circ(26.6 + clamp(P.look, -1, 1) * 0.3, 13.1, 0.4, '#ffffff', { opacity: 0.8 }) : null,
  ], { transform: `${tr(hdx, hdy)} ${rot(P.headPitch, NX, NY)}` });
  // ember-tipped feelers: verlet chains when animated (their roots follow the head), the rest curves shifted with the head for the stills
  const fa = pup && pup.chains.fa ? pup.chains.fa.points() : [{ x: FA_ROOT[0] + hdx, y: FA_ROOT[1] + hdy }].concat(FA.map((q) => ({ x: FA_ROOT[0] + hdx + q.x, y: FA_ROOT[1] + hdy + q.y })));
  const fb = pup && pup.chains.fb ? pup.chains.fb.points() : [{ x: FB_ROOT[0] + hdx, y: FB_ROOT[1] + hdy }].concat(FB.map((q) => ({ x: FB_ROOT[0] + hdx + q.x, y: FB_ROOT[1] + hdy + q.y })));
  const ta = fa[fa.length - 1], tb = fb[fb.length - 1];
  const feelers = [stroke(curve(fa), FEELER, 0.8), stroke(curve(fb), FEELER, 0.8), circ(ta.x, ta.y, 0.55, crackCol, { opacity: 0.5 + hq * 0.3 }), circ(tb.x, tb.y, 0.5, crackCol, { opacity: 0.5 + hq * 0.3 })];
  // the shell: the dome squashes down about its rim when it clamps (plates and cracks with it) and hinges up at the rear when struck from behind
  const shell = g([
    path(SHELL_D, SHELL_G, { stroke: LINE, strokeWidth: 1 }),
    stroke(PLATES_D, LEG, 0.8, { opacity: 0.7 }),
    hq > 0.05 ? ell(14, 10.5, 9.5, 5.5, rad('eg', 14, 10.5, 9.5, [[0, EMBER, 0.3 * hq], [1, EMBER, 0]])) : null,
    stroke(CRACKS_D, crackCol, 1.1 + hq * 0.5, { opacity: 0.55 + hq * 0.3 }),
    stroke(CRACKS_HI, PALE, 0.6, { opacity: 0.35 + hq * 0.45 }),
    DOTS.map(([x, y], i) => circ(x, y, 0.4 + (0.5 + 0.5 * Math.sin(P.heatPh * 1.3 + i * 1.9)) * 0.45 * hq, PALE, { opacity: 0.35 + 0.45 * hq })),
    stroke('M6 9.5 C7.5 6 10.5 4.2 14 3.9', '#c8865a', 0.8, { opacity: 0.35 }),
  ], { transform: `${rot(clamp(P.lid, -6, 40), 25, 15)} ${tr(0, 15)} scale(1 ${n(1 - 0.17 * cl)}) ${tr(0, -15)}` });
  const body = g([head, feelers, shell], { transform: bodyT });
  return svg(W, H, [shadow, legs.slice(0, 3), belly, legs.slice(3), body]);
}

// ---- animation: from the enemy's state (walk / shell, see updateEnemy case 'a' and damageEnemy) to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem;
  if (m.init === undefined) {
    m.init = true; m.state = e.state; m.hp = e.hp; m.flash = e.flash || 0; m.facing = e.facing; m.drawFacing = e.facing; m.vx = e.vx; m.ax = 0; m.t0 = Math.random() * 10; m.phase = Math.random() * TAU;
    m.aggro = 0; m.heatPh = Math.random() * TAU; m.blink = 1 + Math.random() * 3; m.blinkT = 0; m.glance = 2 + Math.random() * 3; m.lookTo = 0.3; m.fidget = 1.5 + Math.random() * 3;
    m.sniffT = 9; m.peerT = 9; m.hissT = 9; m.turnT = 9; m.flipped = true; m.hitT = 9; m.kn = 1; m.openT = 9; m.emberT = 0.5 + Math.random(); m.sparkT = 0; m.ghostT = 0;
    m.parts = []; for (let i = 0; i < 18; i++) m.parts.push({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, r: 1, spark: false });
  }
  const s = pup.scale || SCALE, t = pup.time + m.t0, vx = e.vx, st = e.state, fac = e.facing, P = pup.P;
  const cx = e.x + e.w / 2, feet = e.y + e.h;
  const wx = (tx) => cx + m.drawFacing * (tx - PX) * s, wy = (ty) => feet - (H - ty) * s; // template -> world, as drawn
  const part = (x, y, pvx, pvy, r, life, spark) => { let q = m.parts[0]; for (const p of m.parts) if (p.life < q.life) q = p; q.x = x; q.y = y; q.vx = pvx; q.vy = pvy; q.r = r; q.life = q.max = life; q.spark = !!spark; };
  const emberFrom = (tx, ty, pvx, pvy, r, life) => part(wx(tx) + (Math.random() - 0.5) * 2, wy(ty) + (Math.random() - 0.5) * 2, pvx, pvy, r, life, false);
  const fa = pup.chain('fa', FA_ROOT[0], FA_ROOT[1], FA), fb = pup.chain('fb', FB_ROOT[0], FB_ROOT[1], FB);
  // ---- events, found by watching the state change: the tuck, the pop back open, a turn, a hit that got through (from behind)
  const tucked = st === 'shell' && m.state !== 'shell', opened = m.state === 'shell' && st !== 'shell';
  const turned = fac !== m.facing, hit = e.hp < m.hp || (e.flash > 0 && m.flash <= 0);
  const ax = dt > 0 ? (vx - m.vx) / dt / s : 0; m.ax = lerp(m.ax, Math.abs(ax) > 2500 ? 0 : ax, Math.min(1, dt * 10)); // smoothed acceleration, template units/s^2 (knocks are impulses instead)
  m.state = st; m.hp = e.hp; m.flash = e.flash || 0; m.facing = fac; m.vx = vx;
  const fwd = (Math.sign(vx) || 1) * fac; // +1 moving the way it faces, -1 shoved or sliding backwards
  // aggro is not on the entity: it hurries at 1.6x speed when Mote is near, and only turns toward Mote when near
  const hurry = Math.abs(vx) > SPEED * 1.25; if (hurry || (turned && e.events && e.events.indexOf('turn') >= 0)) m.aggro = 1; else m.aggro = Math.max(0, m.aggro - dt / 2.5);
  const ag = m.aggro;
  if (tucked) { // the clamp: head and legs snap in, the shell slams down and overshoots, the blocked blow strikes sparks off the front
    pup.impulse('clamp', 11).impulse('sy', -4.5).impulse('sx', 2.5).impulse('legTuck', 10).impulse('headOut', -34).impulse('lean', -90).impulse('bob', -4);
    m.hitT = 9; m.sniffT = m.peerT = m.hissT = 9; m.turnT = 9; m.flipped = true; m.drawFacing = fac;
    for (let i = 0; i < 7; i++) part(wx(25.5) + (Math.random() - 0.5) * 2, wy(9 + Math.random() * 6), m.drawFacing * (50 + Math.random() * 120), -40 - Math.random() * 100, 0.45 + Math.random() * 0.35, 0.12 + Math.random() * 0.15, true);
  }
  if (opened) { // the pop: the shell springs up past its rest, the head shoots out wide-eyed, the legs flick out, the pent-up heat escapes
    m.openT = 0; pup.impulse('clamp', -15).impulse('sy', 5).impulse('sx', -3).impulse('legTuck', -14).impulse('headOut', 26).impulse('bob', 12).impulse('lid', 110).impulse('eyeK', 8).impulse('headPitch', -300);
    for (let i = 0; i < 5; i++) { const d = DOTS[i % 4]; emberFrom(d[0], d[1], (Math.random() - 0.5) * 30, -30 - Math.random() * 45, 0.35 + Math.random() * 0.4, 0.5 + Math.random() * 0.4); }
  }
  if (hit) { // the only blows that land come from behind: it pitches onto its nose, the rear of the shell lifts and embers burst from the gap
    m.hitT = 0; m.kn = fwd; m.blinkT = 0.12; m.sniffT = m.peerT = 9; m.hissT = 0; m.turnT = 9; m.flipped = true; m.drawFacing = fac;
    pup.impulse('lean', 330 * m.kn).impulse('lid', m.kn > 0 ? 230 : 100).impulse('sx', 4).impulse('sy', -4).impulse('shift', 20 * m.kn).impulse('headOut', 14 * m.kn).impulse('headPitch', -280).impulse('legSplay', 9).impulse('eyeK', 9).impulse('heat', 5);
    for (let i = 0; i < 9; i++) part(wx(4 + Math.random() * 5), wy(13.5 + Math.random() * 1.5), -m.drawFacing * (15 + Math.random() * 50), -25 - Math.random() * 70, 0.35 + Math.random() * 0.45, 0.5 + Math.random() * 0.5, false);
    for (let i = 0; i < 3; i++) { const d = DOTS[i + 1]; emberFrom(d[0], d[1], (Math.random() - 0.5) * 30, -25 - Math.random() * 35, 0.3 + Math.random() * 0.35, 0.4 + Math.random() * 0.4); }
  }
  if (turned) { m.turnT = 0; m.flipped = false; m.sniffT = m.peerT = 9; pup.impulse('headOut', -20).impulse('bob', 5).impulse('lean', -110); }
  m.hitT += dt; m.turnT += dt; m.openT += dt; m.sniffT += dt; m.peerT += dt; m.hissT += dt;
  // the turn: the head pulls in, the body narrows, the drawing flips, the head pops out the other side (readable in place of an instant flip)
  const turning = m.turnT < 0.24;
  if (turning && !m.flipped && m.turnT >= 0.1) { m.flipped = true; m.drawFacing = fac; pup.impulse('headOut', 18).impulse('sx', 3).impulse('bob', 6); if (ag > 0.5) m.hissT = 0; }
  if (!turning && m.drawFacing !== fac) m.drawFacing = fac;
  // ---- legs: the cycle advances with distance covered (feet stay planted); a heavy crawl, a little quicker when it hurries
  const sp = Math.abs(vx) / s, shoved = m.hitT < 0.35, inShell = st === 'shell';
  const moving = sp > 4 && !inShell && !turning;
  const rate = Math.min(sp / 11, 6); if (moving || (shoved && sp > 4)) m.phase += fwd * rate * TAU * dt; if (m.phase > TAU) m.phase -= TAU; if (m.phase < 0) m.phase += TAU;
  const ph = m.phase, gait = P.stride;
  // ---- idle life: blinks, glances, the heat's pulse (quicker when hot), a fidget now and then: a sniff, a peer back into the shell, a look around
  m.blink -= dt; if (m.blink < 0) { m.blink = Math.random() < 0.2 ? 0.3 : 2 + Math.random() * 4; m.blinkT = 0.13; }
  let eyeOpen = 1; if (m.blinkT > 0) { m.blinkT -= dt; eyeOpen = clamp(m.blinkT > 0.065 ? 1 - (0.13 - m.blinkT) / 0.065 : m.blinkT / 0.065, 0, 1); }
  m.glance -= dt; if (m.glance < 0) { m.glance = 1.5 + Math.random() * 3; m.lookTo = Math.random() < 0.6 ? 0.5 : -0.4 + Math.random() * 0.8; }
  m.heatPh += dt * (3.6 + ag * 5 + (inShell && e.t > 0.45 ? 8 : 0));
  m.fidget -= dt; if (m.fidget < 0 && !inShell && !shoved && !turning && m.openT > 1) {
    m.fidget = 2 + Math.random() * 3.5; const r = Math.random();
    if (r < 0.45) { m.sniffT = 0; emberFrom(29, 14.8, m.drawFacing * 8, -9, 0.28, 0.45); }
    else if (r < 0.7 && ag < 0.5) { m.peerT = 0; pup.impulse('headOut', -8); }
    else { m.lookTo = -0.6; m.glance = 1.2; pup.impulse('headPitch', -120).impulse('eyeK', 2); }
  }
  const br = Math.sin(t * 1.9);
  const T = {
    legPhase: ph, stride: moving ? 1 + ag * 0.2 : 0, legTuck: 0, legSplay: 0, gLift: 0, gLean: 0, gShift: 0, gHead: 0,
    lean: 0, sx: 1 + br * 0.01, sy: 1 + br * 0.018, bob: 0, shift: 0, clamp: br * 0.03, lid: 0,
    headOut: 1 + ag * 0.22 + Math.sin(t * 1.1) * 0.05, headPitch: ag * 9 + Math.sin(t * 1.7) * 2 + br * 1.2, headDrop: ag * 0.4, jaw: ag * 0.35,
    eyeK: 1 + ag * 0.5 + Math.sin(t * 2.7) * 0.12, look: ag > 0.5 ? 0.8 : m.lookTo, heat: 0.5 + ag * 0.75, heatPh: m.heatPh, ph: t, shake: 0,
  };
  if (inShell) {
    // the tuck, keyed to the game's 0.7 s timer: clamped and dark at first, skidding back on sparks, then the heat climbs and the shell
    // squeezes tighter and quivers through the last quarter so the pop lands on the frame the game opens it
    const k = clamp(e.t / 0.7, 0, 1), build = Anim.smooth(k, 0.5, 1);
    Object.assign(T, { stride: 0, legTuck: 1, legSplay: 0, clamp: 1 + build * 0.22, headOut: -0.25, headPitch: 0, headDrop: 0.6, jaw: 0, look: 0, bob: -0.3 - build * 0.3, sx: 1 + build * 0.05, sy: 1 - build * 0.04,
      heat: lerp(0.25, 1.5, build), eyeK: 0.6, shake: build * 0.7 });
    eyeOpen = 0;
    if (sp > 15) { // the skid: sparks off the ground behind it, after-images while it is still fast
      m.sparkT -= dt; if (m.sparkT < 0) { m.sparkT = 0.022; const dir = Math.sign(vx) || 1; part(cx + dir * (3 + Math.random() * 6), feet - 0.5, -dir * (50 + Math.random() * 120) + vx * 0.2, -30 - Math.random() * 90, 0.45 + Math.random() * 0.35, 0.1 + Math.random() * 0.15, true); }
      m.ghostT += dt; if (sp > 45 && m.ghostT > 0.035) { m.ghostT = 0; pup.ghost(cx, feet, 0.22, 0.3); }
    }
  } else if (turning) {
    const k = m.turnT / 0.24;
    Object.assign(T, Anim.keys(k, [[0, { sx: 1, headOut: 0.05 }], [0.42, { sx: 0.68, headOut: 0.05 }, 'inQuad'], [1, { sx: 1, headOut: 1 + ag * 0.2 }, 'outBack']]));
    T.stride = 0; T.legSplay = 0.4; T.jaw = 0; T.look = 0.8; T.eyeK = 1.3 + ag * 0.3;
  } else if (moving) {
    // the crawl: two pushes per cycle (one per tripod), the body heaving forward and up on each and thudding down, the nose dipping
    // with the lurch and the head bobbing a beat behind; it leans into acceleration and rocks back when it brakes
    const s2 = Math.cos(2 * ph), push = Math.sin(2 * ph);
    T.gLift = Math.pow(0.5 - 0.5 * s2, 1.5) * 1.2 * gait; T.gShift = push * 0.7 * fwd * gait; T.gLean = -Math.sin(2 * ph + 0.6) * 2.2 * fwd * gait; T.gHead = Math.sin(2 * ph - 0.9) * 0.45 * gait;
    T.lean = 1.2 * fwd + ag * 1.5; T.shift = 0.3 * fwd;
    if (m.openT < 0.8) { const k = m.openT / 0.8; T.eyeK += 0.8 * (1 - k); T.heat += 0.5 * (1 - k); T.headOut += 0.2 * (1 - k); T.look = 0.8; }
  } else if (shoved) { T.stride = 0.4; T.legSplay = 0.6; }
  else if (m.openT < 0.8) { const k = m.openT / 0.8; T.eyeK += 0.8 * (1 - k); T.heat += 0.5 * (1 - k); T.headOut += 0.2 * (1 - k); }
  if (!inShell) {
    // fidgets layered on the base pose
    if (m.sniffT < 0.55) { const k = m.sniffT / 0.55, nod = Math.sin(k * TAU * 3) * (1 - k * 0.5); T.headPitch += -4 + nod * 7; T.headOut += 0.08; T.jaw += Math.max(0, nod) * 0.3; T.eyeK += 0.15; }
    if (m.peerT < 0.7) { T.headOut = m.peerT < 0.4 ? 0.4 : T.headOut + 0.12; T.headPitch -= 5; T.eyeK += 0.3; if (m.peerT >= 0.4 && m.peerT - dt < 0.4) pup.impulse('headOut', 10); }
    if (m.hissT < 0.4) { const k = m.hissT / 0.4; T.jaw = Math.max(T.jaw, 1 - k * k); T.heat += 0.4 * (1 - k); T.eyeK += 0.3 * (1 - k); }
    if (m.hitT < 0.5) { const k = m.hitT / 0.5; T.legSplay = Math.max(T.legSplay, 0.6 * (1 - k)); T.look = -0.7 * (1 - k) + T.look * k; T.heat += 0.6 * (1 - k); T.eyeK += 0.6 * (1 - k); T.shake = 0.35 * (1 - k) * (1 - k); T.headPitch -= 8 * (1 - k); T.jaw = Math.max(T.jaw, 0.7 * (1 - k)); }
    if (sp > 70 && shoved) { m.ghostT += dt; if (m.ghostT > 0.04) { m.ghostT = 0; pup.ghost(cx, feet, 0.2, 0.22); } }
  }
  // weight: lean into acceleration and back on braking (the knocks are impulses, so the filter ignores jolts)
  T.lean += clamp(m.ax * fwd / 360, -1, 1) * 5;
  T.eyeOpen = eyeOpen;
  pup.target(T);
  // ---- secondary motion: the feelers hang off the head, so their roots follow it, and they stream back when it moves and twitch on a sniff
  const hdx = (P.headOut - 1) * HEAD_SLIDE, hdy = P.headDrop + P.gHead, pr = P.headPitch * DEG, pc = Math.cos(pr), ps = Math.sin(pr);
  const rootAt = (ch, rx, ry) => { ch.ax = NX + (rx - NX) * pc - (ry - NY) * ps + hdx; ch.ay = NY + (rx - NX) * ps + (ry - NY) * pc + hdy; };
  rootAt(fa, FA_ROOT[0], FA_ROOT[1]); rootAt(fb, FB_ROOT[0], FB_ROOT[1]);
  const twitch = m.sniffT < 0.55 ? Math.sin(m.sniffT * 40) * 14 : 0;
  const env = { vx: vx / s * 0.6, vy: 0, facing: m.drawFacing, gravity: -6, drag: 0.5, stiff: 10, damp: 0.8, wind: { x: Math.sin(t * 2.9) * 2.5 + (pup.V.headOut || 0) * 0.4, y: Math.cos(t * 2.2) * 2 + twitch } };
  fa.update(dt, env); fb.update(dt, env);
  // ---- embers: a wisp rises from a crack now and then (often when hot), and every particle drifts, flickers and dies
  m.emberT -= dt * (1 + ag * 2.5); if (m.emberT < 0 && !inShell) { m.emberT = 0.45 + Math.random() * 0.9; const d = DOTS[Math.floor(Math.random() * 4)]; emberFrom(d[0], d[1], (Math.random() - 0.5) * 12, -12 - Math.random() * 14, 0.26 + Math.random() * 0.3, 0.6 + Math.random() * 0.5); }
  for (const p of m.parts) if (p.life > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.spark) { p.vy += 500 * dt; p.vx *= 1 - Math.min(1, dt * 2); } else { p.vy += 8 * dt; p.vx = p.vx * (1 - Math.min(1, dt * 3)) + Math.sin(p.life * 23 + p.r * 9) * 16 * dt; p.vy *= 1 - Math.min(1, dt * 2.2); } }
}
function flip(e, pup) { return (pup.mem.drawFacing === undefined ? e.facing : pup.mem.drawFacing) < 0; }

// world-space effects: the underglow of the heat inside, under the body (brighter and quicker when it hurries, dim when clamped shut)
function before(ctx, e, pup) {
  const P = pup.P, s = pup.scale || SCALE; const hk = clamp(P.heat * (0.75 + 0.25 * Math.sin(P.heatPh)), 0, 1.5);
  const a = (0.12 + Math.sin(P.heatPh) * 0.06) * hk / 0.5 * (1 - clamp(P.clamp, 0, 1) * 0.55);
  if (a < 0.01) return;
  const cx = e.x + e.w / 2 + (P.shift + P.gShift) * (pup.mem.drawFacing || e.facing) * s, cy = e.y + e.h - (9.5 - P.bob - P.gLift) * s;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,138,60,${a.toFixed(3)})`; ctx.beginPath(); ctx.ellipse(cx, cy, (8 + hk * 2) * (P.sx || 1), 5 * (P.sy || 1), 0, 0, TAU); ctx.fill(); ctx.restore();
}
// embers and sparks over the body: embers drift up and flicker from white-hot to a dying red, sparks streak along their flight and fall
function after(ctx, e, pup) {
  const ps = pup.mem.parts; if (!ps) return;
  let any = false; for (const p of ps) if (p.life > 0) { any = true; break; } if (!any) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const p of ps) {
    if (p.life <= 0) continue; const k = p.life / p.max;
    if (p.spark) { ctx.strokeStyle = `rgba(255,${Math.round(200 + 55 * k)},${Math.round(120 * k)},${(0.9 * k).toFixed(3)})`; ctx.lineWidth = p.r; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025); ctx.stroke(); }
    else { const fl = 0.7 + 0.3 * Math.sin(p.life * 31); ctx.fillStyle = `rgba(255,${Math.round(90 + 130 * k)},${Math.round(40 * k)},${(0.85 * k * fl).toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.6 + k * 0.6) + (1 - k) * 0.3, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

module.exports = { name: 'emberback', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, flip, before, after };
