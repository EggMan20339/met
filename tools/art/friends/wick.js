// Wick, the ember-keeper: an old moth whose folded wings are his cloak, leaning on a staff that holds the last coal.
//
// He stands at his hearth, so his motion is idle life and conversation (src/game.js: friends are static decor;
// interact() opens a dialogue, game.ui.dialogue stays set while it runs and game.nearInteract is the friend spoken to).
// make(P, pup) is a pure drawing of the parameters; control(ent, pup, info) reads the game every frame: a slow breath
// lifts the chest, the cloak and the head; the wings lift and resettle on a random timer (a two-wing stretch or a
// one-wing shrug: a dip of anticipation, a snap open, a cloth-like overshoot on the way down); the antennae are verlet
// chains that quiver on their own and lag the head when it turns; the coal pulses and swells when it is paid attention
// to; the head turns to the player when they are near (decor is drawn unflipped, so the turn is a parameter) with slow
// old-moth blinks and a doze when nobody has come by for a while; fidgets (a staff tap that throws sparks, a beckon with
// the coal, a head tilt, an antenna flick, a sigh); and while talking, a bow at the start, a nod on every new line, a
// talking bob while the text types out and a deep nod at the end. after() throws the coal's light on the world
// (info.glowAt) and draws the ember sparks the coal sheds (kept in pup.mem, moved by control()).
const L = require('../lib');
const { svg, lin, path, ell, circ, stroke, g, rot, tr, glow, curve, mix, clamp, lerp } = L;
const W = 36, H = 38, FX = 18, FY = 37;     // feet anchor: bottom centre; the hem sits one unit above the template bottom, as in the old still
const TILE = 16, SCALE = 0.7;               // world units per template unit (ART_SCALE.wick)
const NECK_X = 18, NECK_Y = 16.5;           // the head tilts about the neck
const STAFF_X = 28, STAFF_Y = 36, STAFF_LEN = 30, GRIP = 16; // the staff stands on its foot; the coal sits at its tip, the hand part way up
const ANT_Y = 8, ANT_LX = 16, ANT_RX = 20;  // antenna roots on the head
const ANT_L = [{ x: -2.3, y: -3 }, { x: -4.7, y: -4.3 }, { x: -7, y: -4 }], ANT_R = ANT_L.map((p) => ({ x: -p.x, y: p.y })); // rest offsets along the old curves
const ANT_L_PTS = [{ x: ANT_LX, y: ANT_Y }].concat(ANT_L.map((p) => ({ x: ANT_LX + p.x, y: ANT_Y + p.y })));
const ANT_R_PTS = [{ x: ANT_RX, y: ANT_Y }].concat(ANT_R.map((p) => ({ x: ANT_RX + p.x, y: ANT_Y + p.y })));
const SPARKS = 10, SP = 6;                  // ember sparks shed by the coal: a ring of SPARKS records of SP floats (x, y, vx, vy, age, life), world space
const RAD = Math.PI / 180;
// the wing lift: a dip of anticipation, a snap open with the tips flung out, a hold, and a slow resettle (the springs add the flump)
const WING_CLIP = [[0, { l: 0, f: 0 }], [0.2, { l: -1.8, f: 0 }, 'inQuad'], [0.55, { l: 9.5, f: 0.9 }, 'outCubic'], [1.15, { l: 8.3, f: 0.7 }, 'inOutQuad'], [2.1, { l: 0, f: 0 }, 'inOutCubic']];
const TAP_CLIP = [[0, { up: 0 }], [0.28, { up: 3.4 }, 'outQuad'], [0.5, { up: 3.4 }], [0.6, { up: 0 }, 'inQuad'], [1, { up: 0 }]];
const BECKON_CLIP = [[0, { up: 0, k: 0 }], [0.35, { up: 2.6, k: 1 }, 'outBack'], [1.1, { up: 2.2, k: 1 }], [1.7, { up: 0, k: 0 }, 'inOutCubic']];
const SIGH_CLIP = [[0, { sy: 0, droop: 0, nod: 0 }], [0.55, { sy: 1, droop: 0, nod: -0.15 }, 'inOutQuad'], [0.85, { sy: 1, droop: 0, nod: -0.15 }], [1.35, { sy: -0.3, droop: 1, nod: 0.4 }, 'inOutCubic'], [2.2, { sy: 0, droop: 0, nod: 0 }, 'inOutQuad']];
const END_NOD = [[0, { nod: 0 }], [0.3, { nod: 0.85 }, 'inOutQuad'], [0.6, { nod: 0.85 }], [1, { nod: 0 }, 'inOutCubic']];
const BOW = [[0, { nod: 0 }], [0.22, { nod: 1 }, 'inOutQuad'], [0.42, { nod: 1 }], [0.8, { nod: 0 }, 'inOutCubic']];

const params = {
  breath: 0,            // 0..1 the slow breath (set straight from a phase): lifts the chest, the cloak and the head
  sx: 1, sy: 1,         // squash / stretch about the feet
  lean: 0,              // body lean in degrees about the feet (positive leans to the right)
  wingL: 0, wingR: 0,   // wing lift in template units (0 = the cloak at rest, 6 = the old pose b, ~11 = lifted high)
  flare: 0,             // 0..1 the wings open outward (tips flung out) on a stretch, a shrug or a gust
  headX: 0,             // head turn, -1 (to the left) .. 1 (to the right): the face slides across the head and the far eye narrows
  nod: 0,               // 0..1 the head dipped forward (chin tucked, brows down); a little negative lifts it
  tilt: 0,              // head side tilt in degrees
  eyeOpen: 1,           // 1 open .. 0 shut (snaps: driven by the blink timer)
  lookY: 0,             // -1 up .. 1 down: the eyes' glow slides toward what he looks at
  brow: 0,              // -1 lowered (dozing) .. 1 raised (greeting)
  staffTilt: 0,         // staff angle in degrees about its foot (positive leans the coal to the right)
  staffUp: 0,           // staff lifted off the ground, template units
  coal: 0.5,            // coal brightness, 0 (ash) .. ~1.3 (flaring)
  flick: 1,             // the coal's flicker multiplier (set straight from the clock)
};
// [stiffness, damping ratio] for the values that overshoot and settle; breath, eyeOpen and flick snap
const springs = {
  sx: [420, 0.5], sy: [420, 0.5], lean: [110, 0.6],
  wingL: [130, 0.4], wingR: [130, 0.4], flare: [150, 0.5],
  headX: [80, 0.62], nod: [230, 0.42], tilt: [100, 0.5], lookY: [120, 0.8], brow: [220, 0.55],
  staffTilt: [120, 0.5], staffUp: [320, 0.55], coal: [55, 0.75],
};
// stills exported to art/wick_<pose>.svg (a and b are the originals)
const poses = {
  a: {}, b: { wingL: 6, wingR: 6 },
  lift: { wingL: 6.5, wingR: 6, flare: 0.6, brow: 0.3, sy: 1.02, coal: 0.7 },
  greet: { headX: -1, brow: 0.6, coal: 1, staffTilt: -8, staffUp: 2, lean: -2, lookY: 0.2 },
  nod: { nod: 1, eyeOpen: 0.35, coal: 0.9, wingL: 2, wingR: 2 },
  talk: { headX: 0.6, nod: 0.25, brow: 0.3, coal: 1.1, staffUp: 1.5, lean: 2, flare: 0.3 },
  blink: { eyeOpen: 0, headX: 0.3 },
  doze: { eyeOpen: 0.3, nod: 0.5, wingL: -1, wingR: -1, coal: 0.3, tilt: 4, brow: -0.5 },
};

function make(P, pup) {
  const b = clamp(P.breath, 0, 1), fl = clamp(P.flare, 0, 1.2), nod = clamp(P.nod, -0.3, 1.2), turn = clamp(P.headX, -1.2, 1.2), coal = clamp(P.coal, 0, 1.5) * P.flick;
  const wingG = lin('ww', 0, 6, 0, 30, [[0, '#b8a8d8'], [1, '#6a5a90']]);
  const robeG = lin('wr', 12, 12, 24, 36, [[0, '#7a6b9c'], [1, '#3e3458']]);
  // the staff pivots about its foot and may lift off the ground; the coal's halo swells with its brightness; the hand holds it part way up
  const sa = P.staffTilt * RAD, sn = Math.sin(sa), cs = Math.cos(sa);
  const coalX = STAFF_X + sn * STAFF_LEN, coalY = STAFF_Y - P.staffUp - cs * STAFF_LEN, gripX = STAFF_X + sn * GRIP, gripY = STAFF_Y - P.staffUp - cs * GRIP;
  const halo = glow(coalX, coalY, 6 + 4 * coal, '#ffb347', 0.3 + 0.35 * coal);
  const staff = g([stroke(`M${STAFF_X} ${STAFF_Y} L${STAFF_X} ${STAFF_Y - STAFF_LEN + 2}`, '#8a7a50', 1.8), circ(STAFF_X, STAFF_Y - STAFF_LEN, 2.4, mix('#b86a34', '#ffb347', clamp(coal, 0, 1))), circ(STAFF_X, STAFF_Y - STAFF_LEN, 1.1 + 0.5 * coal, '#fff4dc', { opacity: 0.55 + 0.45 * clamp(coal, 0, 1) })],
    { transform: `${tr(0, -P.staffUp)} ${rot(P.staffTilt, STAFF_X, STAFF_Y)}` });
  const hands = [stroke(`M23 ${24 - b * 0.4} L${gripX} ${gripY}`, '#8a7aa8', 2.2), circ(gripX, gripY, 1.4, '#9a8ab8')];
  // the cloak of wings: hung from the shoulders, lifted by wingL/wingR (the old flap), flung open by flare; the eye-spots catch the coal's light
  const wing = (m, f) => {
    const tipX = 18 + m * (16 + 4 * fl), topY = 8 - f - 2 * fl, spx = 18 + m * (10 + 2 * fl), spy = 15 - f * 0.5 - fl;
    return [
      path(`M18 16 C${18 + m * 4} ${topY} ${tipX} ${topY} ${tipX} ${18 - f * 0.5 - fl} C${18 + m * 15} ${26 - f * 0.25 - 2 * fl} ${18 + m * 7} ${28 - f * 0.15 - fl} 18 26 Z`, wingG, { stroke: '#4a3f66', strokeWidth: 0.8, opacity: 0.92 }),
      stroke(`M${18 + m * 3} 19 Q${18 + m * 9} ${13 - f * 0.7 - fl} ${18 + m * 14.5} ${16.5 - f * 0.5 - fl}`, '#d8ccf0', 0.5, { opacity: 0.3 }),
      circ(spx, spy, 2, '#4a3f66'), circ(spx, spy, 1, '#ffd9a0', { opacity: 0.6 + 0.3 * clamp(coal, 0, 1) }),
    ];
  };
  const robe = [path(`M12 37 C11 26 13 ${18 - b} 18 ${14 - b * 0.5} C23 ${18 - b} 25 26 24 37 Z`, robeG, { stroke: '#2a2238', strokeWidth: 0.9 }), path('M20.5 36.5 C23.2 30 23 22 20 16.5 C22.5 22 22.3 30 20.5 36.5 Z', '#2a2238', { opacity: 0.22 })];
  // the head: turns by sliding the face across it (the far eye narrows), nods by dipping and tucking the chin, tilts about the neck
  const fx = turn * 1.8, fy = nod * 0.8 + P.lookY * 0.4; const open = clamp(P.eyeOpen, 0, 1) * (1 - 0.35 * Math.max(0, nod));
  const eyeOp = (cx, m) => {
    const rx = 1 - 0.3 * Math.max(0, -m * turn); cx += fx; const cy = 12.5 + fy;
    if (open < 0.15) return stroke(`M${cx - rx} ${cy} L${cx + rx} ${cy}`, '#ffe9b0', 0.6, { opacity: 0.6 });
    return [circ(cx, cy, 1.8 * rx, '#ffe9b0', { opacity: 0.25 * open }), ell(cx, cy, rx, open, '#ffe9b0'), open > 0.5 ? circ(cx, cy - 0.2 * open, 0.45, '#ffffff', { opacity: 0.8 }) : null];
  };
  const by = 10 - 1.3 * clamp(P.brow, -1, 1) + 0.6 * Math.max(0, nod) + fy * 0.6;
  const brows = stroke(`M${14.2 + fx} ${by + 0.5} L${16.8 + fx} ${by} M${19.2 + fx} ${by} L${21.8 + fx} ${by + 0.5}`, '#4a3f66', 0.8);
  // antennae: verlet chains when animated, their rest curves for the stills
  const aL = pup && pup.chains.antL ? pup.chains.antL.points() : ANT_L_PTS, aR = pup && pup.chains.antR ? pup.chains.antR.points() : ANT_R_PTS;
  const antenna = (pts) => [stroke(curve(pts), '#d8c8ff', 0.9), circ(pts[3].x, pts[3].y, 0.9, '#d8c8ff')];
  const head = g([circ(18, 12, 5, '#8a7aa8', { stroke: '#4a3f66', strokeWidth: 0.9 }), ell(18 + fx * 0.5, 9 + nod * 0.5, 5.6, 2.4, '#a898c4'), eyeOp(16, -1), eyeOp(20, 1), brows, g([antenna(aL), antenna(aR)], { transform: tr(fx * 0.7, fy * 0.5) })],
    { transform: `${tr(turn * 1.2, nod * 3.2 - b * 0.9 - Math.max(P.wingL, P.wingR, 0) * 0.1)} ${rot(P.tilt + turn * 2, NECK_X, NECK_Y)}` });
  const body = g([halo, wing(-1, P.wingL + b * 1.3), robe, wing(1, P.wingR + b * 1.3), hands, staff, head], { transform: `${rot(P.lean, FX, FY)} ${tr(FX, FY)} scale(${P.sx} ${P.sy}) ${tr(-FX, -FY)}` });
  return svg(W, H, [body]);
}

// the coal's position in world units (through the staff's pivot and the body's lean and squash), written to out[0], out[1]
function coalWorld(e, P, s, out) {
  const sa = P.staffTilt * RAD; const cx = STAFF_X + Math.sin(sa) * STAFF_LEN, cy = STAFF_Y - P.staffUp - Math.cos(sa) * STAFF_LEN;
  const la = P.lean * RAD, cl = Math.cos(la), sl = Math.sin(la); const qx = (cx - FX) * P.sx, qy = (cy - FY) * P.sy;
  out[0] = e.tx * TILE + 8 + (qx * cl - qy * sl) * s; out[1] = e.ty * TILE + TILE + (FY + qx * sl + qy * cl - H) * s;
}

// ---- animation: from the game (the player's position, the dialogue) and his own timers to parameter targets, every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, t = pup.time, game = info.game, P = pup.P;
  if (m.init === undefined) {
    m.init = true; m.ph = Math.random() * 6.3; m.blink = 2 + Math.random() * 3; m.blinkT = 0; m.blinkLen = 0.16; m.perkT = 0;
    m.wingT = 1.5 + Math.random() * 3; m.wingClip = 9; m.wingMode = 0; m.wingSnap = true;
    m.fidget = 2 + Math.random() * 3; m.fidgetT = 9; m.kind = ''; m.side = 1; m.tapped = true;
    m.glance = 2 + Math.random() * 3; m.gx = 0.35; m.near = false; m.far = 0; m.doze = 0; m.dlg = false; m.dlgI = -1; m.lineT = 9; m.endT = 9;
    m.gustCd = 0; m.gustT = 0; m.gustV = 0; m.hx = 0; m.burst = 0; m.sparkT = 0.5; m.si = 0; m.sparks = new Float32Array(SPARKS * SP); m.cw = [0, 0];
  }
  const antL = pup.chain('antL', ANT_LX, ANT_Y, ANT_L), antR = pup.chain('antR', ANT_RX, ANT_Y, ANT_R);
  const s = pup.scale || SCALE; const wx = e.tx * TILE + 8, wy = e.ty * TILE + TILE; // his feet, in world units
  // ---- the player: where they are relative to his head, and how much of his attention they get
  const pl = game && game.player; let dx = 0, dy = 0, dist = 1e9, pvx = 0;
  if (pl && !pl.dead) { dx = pl.x + pl.w / 2 - wx; dy = pl.y + pl.h / 2 - (wy - 18); dist = Math.hypot(dx, dy); pvx = pl.vx; }
  const att = Anim.smooth(dist, 150, 60), near = dist < 130;
  // ---- the conversation: ui.dialogue is set while one runs, nearInteract is the friend it was opened on
  const dlg = game && game.ui ? game.ui.dialogue : null; const talking = !!dlg && game.nearInteract === e;
  const line = talking ? dlg.lines[dlg.i] : null; const speaking = !!line && line.who === 'Wick'; const typing = speaking && dlg.shown < line.text.length;
  // ---- events, found by watching the state change
  const arrive = near && !m.near; m.near = near;
  const talkStart = talking && !m.dlg, talkEnd = !talking && m.dlg; m.dlg = talking;
  const newLine = talking && !talkStart && dlg.i !== m.dlgI; m.dlgI = talking ? dlg.i : -1;
  if (talkStart) { m.lineT = 0; m.burst = 6; pup.impulse('nod', 6).impulse('wingL', 75).impulse('wingR', 60).impulse('flare', 2).impulse('coal', 2.5).impulse('sy', -0.5); }
  if (newLine) { m.lineT = 0; m.burst = 2; pup.impulse('nod', speaking ? 14 : 5).impulse('staffTilt', speaking ? (dx < 0 ? -40 : 40) : 0).impulse('coal', 1.2).impulse('sy', -0.25); }
  if (talkEnd) { m.endT = 0; pup.impulse('wingL', -30).impulse('wingR', -30).impulse('coal', 0.8); }
  m.lineT += dt; m.endT += dt;
  // ---- dozing: after a while with nobody near he nods off over his coal (time he spent out of view, when this does not run, counts
  // as time alone, so he is found asleep after a long absence); being come upon wakes him with a start, a plain arrival gets a look up
  const gap = m.lastT === undefined ? 0 : info.t - m.lastT; m.lastT = info.t;
  if (gap > 1.5) { m.far += gap; m.doze = Math.max(m.doze, clamp((m.far - 14) / 6, 0, 1)); }
  m.far = near || talking ? 0 : m.far + dt; const dozeTo = clamp((m.far - 14) / 6, 0, 1); m.doze += clamp(dozeTo - m.doze, -dt * 4, dt * 0.25);
  const startle = near && m.doze > 0.25;
  if (startle || arrive) { // a look up, brows raised, antennae perked; wings and all when he was asleep
    const k = startle ? 1 + 2.5 * m.doze : 1; m.perkT = startle ? 0.3 : 0.18; m.glance = 9; m.fidget = Math.max(m.fidget, 1.5); if (startle) m.doze = 0;
    pup.impulse('brow', 9 * k).impulse('tilt', -50 * k).impulse('coal', 1.2 * k).impulse('wingL', 25 * k).impulse('wingR', 25 * k).impulse('sy', 0.3 * k).impulse('nod', -4 * k);
  }
  const doze = m.doze;
  // ---- breathing: slow and old, quicker while talking, slower asleep
  m.ph += dt * 1.4 * (talking ? 1.5 : 1 - 0.25 * doze); const br = 0.5 + 0.5 * Math.sin(m.ph);
  // ---- the wings lift and resettle on their own timer: both (a stretch) or mostly one (a shrug); the right wing lags the left a touch
  m.wingT -= dt; if (m.wingT < 0 && !talking) { m.wingT = 5 + Math.random() * 7; m.wingClip = 0; m.wingMode = Math.random() < 0.35 ? 1 : 0; m.wingSnap = false; }
  m.wingClip += dt; const wcL = Anim.keys(m.wingClip, WING_CLIP), wcR = Anim.keys(m.wingClip - 0.09, WING_CLIP);
  if (!m.wingSnap && m.wingClip > 0.2) { m.wingSnap = true; pup.impulse('wingL', m.wingMode ? 20 : 110).impulse('wingR', m.wingMode ? 70 : 90).impulse('sy', 0.5).impulse('brow', 4); }
  let wl = m.wingMode ? wcL.l * 0.15 : wcL.l, wr = m.wingMode ? wcR.l * 0.6 : wcR.l, flare = Math.max(wcL.f, wcR.f) * (m.wingMode ? 0.4 : 1);
  // ---- fidgets on a random timer: a staff tap (a beckon with the coal when the player is near), a head tilt, an antenna flick, a sigh
  m.fidget -= dt;
  if (m.fidget < 0 && m.wingClip > 2.2 && !talking && m.endT > 1.2) {
    m.fidget = 3 + Math.random() * 5; m.fidgetT = 0; m.tapped = false; m.side = Math.random() < 0.5 ? -1 : 1; const r = Math.random();
    m.kind = r < 0.3 ? (near ? 'beckon' : 'tap') : r < 0.55 ? 'tilt' : r < 0.78 ? 'twitch' : 'sigh';
    if (m.kind === 'sigh') { m.blinkT = m.blinkLen = 0.8; m.blink = Math.max(m.blink, 1.5); } // a long slow blink rides the sigh
  }
  m.fidgetT += dt; const fk = m.kind, ft = m.fidgetT;
  let sy = 1 + 0.02 * br, sx = 1 - 0.01 * br, nod = 0.35 * doze, tilt = 5 * doze, brow = -0.6 * doze, staffUp = 0, staffTilt = Math.sin(t * 0.9) * 1.2, lean = Math.sin(t * 0.6) * 0.6, coal = 0.5 + 0.3 * att - 0.15 * doze, gx = 0;
  if (fk === 'tap' && ft < 1) { staffUp = Anim.keys(ft, TAP_CLIP).up; gx = 0.5; if (!m.tapped && ft > 0.6) { m.tapped = true; m.burst = 4; pup.impulse('staffUp', -25).impulse('coal', 2.2).impulse('sx', 0.6).impulse('nod', 3); } }
  else if (fk === 'beckon' && ft < 1.7) { const c = Anim.keys(ft, BECKON_CLIP); staffUp = c.up; staffTilt += c.k * 12 * (dx < 0 ? -1 : 1); coal += 0.45 * c.k; brow += 0.5 * c.k; lean = c.k * 2 * (dx < 0 ? -1 : 1); if (!m.tapped && ft > 0.3) { m.tapped = true; m.burst = 3; } }
  else if (fk === 'tilt' && ft < 1.4) { tilt += Anim.keys(ft, [[0, { a: 0 }], [0.35, { a: 9 }, 'outBack'], [1, { a: 9 }], [1.4, { a: 0 }, 'inOutQuad']]).a * m.side; brow += 0.3; }
  else if (fk === 'sigh' && ft < 2.2) { const c = Anim.keys(ft, SIGH_CLIP); sy += 0.035 * c.sy; wl -= 2.2 * c.droop; wr -= 2.2 * c.droop; nod += c.nod; brow -= 0.3 * c.droop; }
  const twitch = fk === 'twitch' && ft < 0.12;
  // ---- talking: a bob while the text types out, an expectant tilt while it waits, a deep nod after the last line
  if (talking) {
    coal += typing ? 0.35 : 0.2; lean += (dx < 0 ? -1 : 1) * (typing ? 2 : 1); flare += typing ? 0.12 : 0.05; staffUp += typing ? 1 : 0.4;
    if (talkStart || m.lineT < 0.8 && m.dlgI === 0) nod += Anim.keys(m.lineT, BOW).nod; // the bow that opens the conversation
    else if (typing) nod += 0.14 + 0.12 * Math.sin(t * 8.5); else if (speaking) { nod += 0.04; tilt += 4 * (dx < 0 ? -1 : 1); brow += 0.2; } else { tilt += 6 * (dx < 0 ? 1 : -1); brow += 0.4; }
  } else if (m.endT < 1) nod += Anim.keys(m.endT, END_NOD).nod;
  // ---- the player passing at speed stirs the cloak and the antennae
  m.gustCd -= dt; m.gustT -= dt;
  if (m.gustCd < 0 && dist < 55 && Math.abs(pvx) > 250) { m.gustCd = 0.7; m.gustT = 0.22; m.gustV = pvx / s * 0.22; pup.impulse('wingL', 85).impulse('wingR', 85).impulse('flare', 4).impulse('tilt', pvx > 0 ? 35 : -35); }
  // ---- eyes: blinks (slow ones when nobody is about), glances mostly toward the coal, a steady look at the player when they are near
  m.blink -= dt; if (m.blink < 0) { const slow = !near && Math.random() < 0.3; m.blink = slow ? 4 + Math.random() * 3 : Math.random() < 0.2 ? 0.3 : 2.5 + Math.random() * 3.5; m.blinkT = m.blinkLen = slow ? 0.55 : 0.16; }
  let open = 1; if (m.blinkT > 0) { m.blinkT -= dt; const h = m.blinkLen / 2; open = m.blinkT > h ? 1 - (m.blinkLen - m.blinkT) / h : m.blinkT / h; }
  if (m.perkT > 0) { m.perkT -= dt; open = 1; }
  open = clamp(open, 0, 1) * (1 - 0.55 * doze);
  m.glance -= dt; if (m.glance < 0) { m.glance = 2 + Math.random() * 4; m.gx = Math.random() < 0.55 ? 0.3 + Math.random() * 0.3 : -0.3 + Math.random() * 0.5; }
  const toPlayer = clamp(dx / 45, -1, 1); const headX = talking ? toPlayer : lerp(m.gx + gx + 0.25 * doze, toPlayer, att);
  const lookY = talking ? clamp(dy / 45, -1, 1) * 0.7 : clamp(dy / 45, -1, 1) * 0.7 * att;
  const flick = 0.86 + 0.09 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 23.7 + 1) + (typing ? 0.12 * Math.sin(t * 41) : 0);
  pup.target({ breath: br, sx, sy, lean, wingL: wl + 0.4 * (typing ? 1 : 0), wingR: wr, flare, headX, nod, tilt, eyeOpen: open, lookY, brow, staffTilt, staffUp, coal, flick });
  // ---- secondary motion: the antennae lag the turning head, quiver (more while he talks), perk on arrival, flick on a twitch, stream in a gust
  if (dt > 0) {
    const hx = P.headX * 1.2 + P.lean * 0.3; const hv = (hx - m.hx) / dt; m.hx = hx;
    const quiver = (talking ? Math.sin(t * 17) * (typing ? 40 : 16) : Math.sin(t * 2.9) * 12 * (1 - 0.6 * doze)) + Math.sin(t * 23) * 4;
    const flickL = twitch && m.side < 0 ? -70 : 0, flickR = twitch && m.side > 0 ? 70 : 0; // one antenna flicks outward on a twitch
    const env = { vx: hv * 12, vy: 0, facing: 1, gravity: -6, drag: 0.6, stiff: 6, damp: 0.87, wind: { x: quiver + (m.gustT > 0 ? m.gustV : 0) + flickL, y: Math.cos(t * 2.3) * 8 + (m.perkT > 0 ? -90 : 0) + 12 * doze } };
    antL.update(dt, env); env.wind.x += Math.sin(t * 3.4 + 2) * 10 - flickL + flickR; antR.update(dt, env);
  }
  // ---- ember sparks: the coal sheds one now and then, a few at once when it flares; they rise, wobble and go out (drawn by after())
  m.sparkT -= dt; const sp = m.sparks;
  if (m.sparkT < 0 || m.burst > 0) {
    m.sparkT = (P.coal > 0.95 ? 0.22 : 0.75 + 0.6 * (1 - att) + 1.5 * doze) * (0.6 + Math.random() * 0.8); if (m.burst > 0) m.burst--;
    coalWorld(e, P, s, m.cw); const o = m.si * SP; m.si = (m.si + 1) % SPARKS;
    sp[o] = m.cw[0] + (Math.random() - 0.5) * 2; sp[o + 1] = m.cw[1] - 1; sp[o + 2] = (Math.random() - 0.5) * 14; sp[o + 3] = -10 - Math.random() * 16; sp[o + 4] = 0; sp[o + 5] = 0.45 + Math.random() * 0.5;
  }
  for (let i = 0; i < SPARKS; i++) { const o = i * SP; if (sp[o + 5] <= 0 || sp[o + 4] >= sp[o + 5]) continue; sp[o + 4] += dt; sp[o] += sp[o + 2] * dt; sp[o + 1] += sp[o + 3] * dt; sp[o + 3] += 14 * dt; sp[o + 2] += Math.sin(sp[o + 4] * 13 + i) * 20 * dt; }
}

// world-space light over the body: the coal's glow on its surroundings, and the sparks it sheds
function after(ctx, e, pup, info) {
  const P = pup.P, m = pup.mem; if (!m.cw) return;
  coalWorld(e, P, pup.scale || SCALE, m.cw); const k = clamp(P.coal, 0, 1.5) * P.flick;
  if (info.glowAt) info.glowAt(m.cw[0], m.cw[1], 11 + 8 * k, '#ffb347', 0.14 + 0.16 * k);
  const sp = m.sparks; ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < SPARKS; i++) {
    const o = i * SP; const life = sp[o + 5], age = sp[o + 4]; if (life <= 0 || age >= life) continue;
    const q = 1 - age / life; ctx.fillStyle = `rgba(255,${(150 + 90 * q) | 0},90,${(0.9 * q).toFixed(2)})`; ctx.beginPath(); ctx.arc(sp[o], sp[o + 1], 0.45 + 0.75 * q, 0, 6.2832); ctx.fill();
  }
  ctx.restore();
}

module.exports = { name: 'wick', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
