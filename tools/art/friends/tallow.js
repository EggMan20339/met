// Tallow, the snail cartographer: a lantern for a shell, spectacles on his eyestalks, and a map he is never done with.
//
// He keeps his corner of the Lanternry row, so his motion is idle life, his work and conversation (src/game.js: friends
// are static decor; interact() opens a dialogue, game.ui.dialogue stays set while it runs and game.nearInteract is the
// friend spoken to). make(P, pup) is a pure drawing of the parameters; control(ent, pup, info) reads the game every
// frame. The body stretches and contracts very slowly, a snail crawling in place: the foot lengthens from its tail, the
// head reaches with it, the shell is dragged along a beat later and rocks on its seat, and the flame in the lantern
// leans against the motion. The eyestalks are two springs that sway on their own, flick now and then, swing toward the
// player when they are near (right round over the shell when they stand behind him) and shrink into the head when
// something thumps down beside him, re-extending with a wobble; their tips lag and whip; the eyes blink and widen; the
// spectacles slip down the stalks when he hunches and pop back up when he straightens. On a timer he bows over the map
// and adds a line to it with the quill in his pen tentacle (revealed stroke by stroke, with a pause to consider
// halfway), then the fresh ink fades, so the map is never finished; between lines the quill taps the paper and he
// glances down at his work. The lantern breathes and brightens for company; after() throws its light on the world
// (info.glowAt). While he talks he perks up, the stalks waggle and the mouth moves with the typed text, every new line
// gets a nod and a flare of the lamp, and on the line about the map he lifts it toward the player and taps it.
// Decor never flips: he always faces right. See art/ANIMATION.md.
// Filmstrip aid: `cue` on the decor entity (--set '{"cue":"scribble"}') fires one beat: scribble, startle, greet, talk, present.
const L = require('../lib');
const { svg, rad, path, ell, circ, rect, stroke, g, rot, tr, glow, clamp, lerp, num: n } = L;
const W = 34, H = 30, FX = 17, FY = 29.5;      // template box; the sole sits half a unit above the bottom, as in the old still
const TILE = 16, SCALE = 0.7;                  // world units per template unit (ART_SCALE.tallow)
const DEG = Math.PI / 180;
const SKIN = '#8a7a9a', SKIN2 = '#9a8aaa', EDGE = '#5a4a6a', EYE = '#ffe9b0', INK = '#8a6a4a', PAPER = '#eadfc4', MARK = '#d04a5a', SPEC = '#d8c8a0', RIM = '#4a2c1c';
const SHELL = rad('ts', 12, 15, 11, [[0, '#ffe2b0'], [0.45, '#d89a58'], [1, '#5a3a24']], 10, 12);
const SPIRAL = 'M12 15 m6 0 a6 6 0 1 1 -6 -6 a4 4 0 1 1 4 4 a2 2 0 1 1 -2 -2';
const AL0 = Math.atan2(2, 7) / DEG, AR0 = Math.atan2(3.5, 5.5) / DEG; // the stalks' rest angles from straight up (clockwise = forward): 16 and 32.5 degrees
const LL = Math.hypot(2, 7), LR = Math.hypot(3.5, 5.5);                // and their lengths, base to eye
const PEN_X = 21.6, PEN_Y = 24.3;                                      // where the nib rests on the map between lines
// the lines he adds to the map: short polylines over the blank strips of the paper (template units; the map is 15..23 x 23..28)
const SCRIBS = [
  [[16, 23.9], [17, 24.3], [18, 23.8], [19.2, 24.3], [20.3, 23.9], [21.4, 24.2]],
  [[16.2, 27.6], [17.3, 27.2], [18.4, 27.7], [19.6, 27.2], [20.7, 27.6], [21.9, 27.3]],
  [[20.8, 25.6], [22.2, 27.1], [21.5, 26.3], [22.2, 25.6], [20.8, 27.1]],
];
// one line on the map, in seconds: bow over it with the quill raised, set the nib down, draw half, lift and consider, draw the
// rest, lift, straighten up (the springs add the overshoot); the ink progress rides the same clock (see control)
const SCRIB_CLIP = [[0, { dip: 0, lift: 0 }], [0.5, { dip: 1, lift: 1 }, 'inOutCubic'], [0.75, { dip: 1, lift: 1 }], [0.9, { dip: 1, lift: 0 }, 'inQuad'], [1.55, { dip: 1, lift: 0 }],
  [1.68, { dip: 0.9, lift: 1 }, 'outQuad'], [1.98, { dip: 0.9, lift: 1 }], [2.1, { dip: 1, lift: 0 }, 'inQuad'], [2.8, { dip: 1, lift: 0 }], [2.95, { dip: 0.95, lift: 0.8 }, 'outQuad'], [3.4, { dip: 0, lift: 0.1 }, 'inOutCubic']];
const TALK_TEXT = { talk: 'Oh! A visitor! I had stopped expecting those. Tallow, cartographer, last lamplighter of the Row.', present: 'Here, I have marked what I know of these streets on your map.' };

const params = {
  stretch: 0,                    // -1 contracted .. 1 stretched: the foot lengthens from its tail and the head reaches with it
  shellK: 0,                     // the shell's own lagging copy of stretch: it is dragged along after the foot
  shellRock: 0,                  // shell tilt in degrees about its seat on the foot (positive tips it forward)
  sx: 1, sy: 1,                  // squash / stretch about the sole
  reach: 0,                      // head extension: positive reaches forward and up, negative pulls it back toward the shell
  back: 0,                       // 0..1 the head drawn back over the shell to look over his shoulder (the neck straightens up)
  dip: 0,                        // 0 head up .. 1 bowed over the map
  stalkL: AL0, stalkR: AR0,      // eyestalk angles in degrees from straight up (clockwise = forward; negative sweeps them back over the shell)
  bendL: 0, bendR: 0,            // how far each tip lags its base, in degrees (the stalk curves)
  retL: 0, retR: 0,              // 0 extended .. 1 drawn into the head (a startled snail)
  eyeOpen: 1, wide: 0, glowK: 1, // blink envelope (snaps), widening 0..1, halo pulse
  specSlip: 0,                   // 0..1 the spectacles slid down the stalks
  mouth: 0,                      // 0..1 open; only while he talks
  lift: 0,                       // 0 nib on the paper .. 1 quill raised
  penX: PEN_X, penY: PEN_Y,      // the nib's spot on the map (template units) when he is not drawing a line
  inking: 0, ink: 0, inkA: 1, scribI: 0, // drawing a line: 1 while the nib follows it; its progress 0..1; the fresh ink's opacity; which line
  mapLift: 0,                    // -1..1 the map tilted up at its left / right end
  lamp: 0.5, flick: 1,           // the lantern's brightness (0.5 = the still) and its flicker (set straight from the clock)
  flameLean: 0,                  // the flame's lean in degrees (positive to the right)
  sheen: 0,                      // 0..1 the glisten of the trail behind him
};
// [stiffness, damping ratio]: a slow heavy body, a shell that lags it, springy stalks with whippy tips, quick eyes and quill
const springs = {
  stretch: [22, 1], shellK: [9, 0.9], shellRock: [90, 0.32], sx: [420, 0.5], sy: [420, 0.5],
  reach: [70, 0.6], back: [90, 0.6], dip: [60, 0.62],
  stalkL: [150, 0.42], stalkR: [125, 0.45], bendL: [260, 0.28], bendR: [240, 0.3], retL: [170, 0.5], retR: [150, 0.5],
  wide: [220, 0.5], glowK: [80, 1], specSlip: [140, 0.4], mouth: [600, 0.8],
  lift: [320, 0.55], penX: [300, 0.8], penY: [300, 0.8], mapLift: [120, 0.45],
  lamp: [45, 0.9], flameLean: [200, 0.3],
};
// stills: default is the old art/tallow.svg; the rest are the readable moments of his day
const poses = {
  default: {},
  peer: { dip: 1, lift: 0, inking: 1, ink: 0.55, scribI: 1, specSlip: 0.5, lamp: 0.6, stalkL: -152, stalkR: -159, bendL: 5, bendR: 5, reach: -0.1 },
  greet: { reach: 0.4, wide: 0.8, lamp: 1.1, stalkL: 20, stalkR: 36, bendL: 5, bendR: 5, sy: 1.02, glowK: 1.2 },
  lookback: { back: 0.8, stalkL: -78, stalkR: -60, bendL: -8, bendR: -8, lamp: 0.8 },
  startle: { retL: 0.8, retR: 0.8, wide: 1, sx: 1.06, sy: 0.93, shellRock: -8, flameLean: 25, lift: 0.7, lamp: 0.9, mapLift: -0.25, reach: -0.3 },
  talk: { reach: 0.35, mouth: 0.6, lamp: 1.15, stalkL: 14, stalkR: 34, bendL: 8, bendR: -8, dip: 0.08, wide: 0.15 },
  present: { reach: 0.1, back: 0.6, mapLift: 1, lift: 0.4, penX: 21.5, penY: 25.4, lamp: 1.2, stalkL: -40, stalkR: -24, wide: 0.3 },
  blink: { eyeOpen: 0 },
  stretch: { stretch: 1, shellK: 0.35, shellRock: -3, reach: 0.2, flameLean: -8, stalkL: 8, stalkR: 24 },
};

// the nib's spot along the line being drawn, at progress 0..1 (template units, before the map is tilted)
const scribAt = (sc, ink, out) => { const prog = clamp(ink, 0, 1) * (sc.length - 1); const i = Math.min(sc.length - 2, Math.floor(prog)), f = prog - i; out[0] = lerp(sc[i][0], sc[i + 1][0], f); out[1] = lerp(sc[i][1], sc[i + 1][1], f); return i; };
const TIP = [0, 0];

function make(P, pup) {
  const st = clamp(P.stretch, -1.5, 1.5), dip = clamp(P.dip, -0.35, 1.25), lamp = clamp(P.lamp, 0, 1.6) * P.flick, lk = lamp - 0.5;
  const open = clamp(P.eyeOpen, 0, 1), wide = clamp(P.wide, 0, 1.3);
  // ---- the foot stretches about its tail, the front edge lifting a touch as it reaches; the trail glistens behind it
  const k = 1 + 0.13 * st, fx = (x) => n(3 + (x - 3) * k);
  const foot = path(`M${fx(2)} 29 C${fx(4)} 24 ${fx(10)} 22 ${fx(18)} ${n(22 - st * 0.3)} C${fx(25)} ${n(22 - st * 0.4)} ${fx(30)} 24 ${fx(31)} 27 C${fx(31)} 29 ${fx(28)} 29.5 ${fx(24)} 29.5 L${fx(4)} 29.5 Z`, SKIN, { stroke: EDGE, strokeWidth: 0.8 });
  const sheen = stroke(`M${n(0.6 - st * 0.4)} 29.7 L${n(5 + st * 0.6)} 29.7`, '#dcecf4', 0.5, { opacity: 0.1 + 0.22 * clamp(P.sheen, 0, 1) * clamp(lamp, 0, 1) });
  // ---- the shell, dragged along after the foot and rocking on its seat; the lantern inside breathes and its flame leans
  const gr = Math.round((9 + 2.5 * lk) * 10) / 10, ga = Math.round(clamp(0.5 + 0.3 * lk, 0, 1) * 100) / 100;
  const shell = g([
    glow(12, 15, gr, '#ffd9a0', ga),
    circ(12, 15, 10.5, SHELL, { stroke: RIM, strokeWidth: 1 }),
    stroke(SPIRAL, RIM, 0.9, { opacity: 0.6 }),
    circ(12, 15, 3.6, '#fff0cc', { opacity: clamp(0.9 + 0.2 * lk, 0, 1) }),
    circ(12 + P.flameLean * 0.03, 15 - lk * 0.3, 1.6 + 0.6 * lk, '#ffffff'),
  ], { transform: `${tr(P.shellK * 1.8, 0)} ${rot(P.shellRock, 12, 25)}` });
  // ---- the neck and head: the head reaches, pulls back and bows over the map; the neck's base rides the foot's stretch
  const back = clamp(P.back, 0, 1.2), hx = P.reach * 2.4 + st * 2 - dip * 3.5 - back * 2.5, hy = -Math.abs(P.reach) * 1.1 + dip * 4 - back * 0.8, bx = st * 1.5;
  const neck = path(`M${n(21 + bx)} 23 C${n(22 + bx + hx * 0.3)} ${n(18 + hy * 0.4)} ${n(25 + hx * 0.7)} ${n(15 + hy * 0.8)} ${n(28 + hx)} ${n(13 + hy)} C${n(30 + hx)} ${n(14 + hy)} ${n(30 + hx)} ${n(17 + hy)} ${n(27 + hx)} ${n(19 + hy)} C${n(25 + hx * 0.6 + bx * 0.4)} ${n(21 + hy * 0.5)} ${n(24 + bx)} 23 ${n(24 + bx)} 25 Z`, SKIN2, { stroke: EDGE, strokeWidth: 0.8 });
  const mouth = P.mouth > 0.05 ? ell(29.4 + hx, 16.6 + hy, 0.5 + 0.4 * P.mouth, 0.2 + 1.0 * P.mouth, '#4a3a5a') : null;
  // ---- the map, tilted up at one end when he lifts it; the line he is adding is revealed stroke by stroke and fades afterwards
  const ml = clamp(P.mapLift, -1, 1), mpx = ml >= 0 ? 15 : 23, mAng = -40 * ml;
  const sc = SCRIBS[clamp(P.scribI | 0, 0, SCRIBS.length - 1)]; const i0 = scribAt(sc, P.ink, TIP); const nx = TIP[0], ny = TIP[1];
  let d = `M${sc[0][0]} ${sc[0][1]}`; for (let i = 1; i <= i0; i++) d += ` L${sc[i][0]} ${sc[i][1]}`; d += ` L${n(nx)} ${n(ny)}`;
  const inkA = clamp(P.inkA, 0, 1);
  const map = g([
    rect(15, 23, 8, 5, PAPER, { rx: 0.8, stroke: INK, strokeWidth: 0.6 }),
    stroke('M16.5 25 L21 25 M16.5 26.5 L20 26.5', INK, 0.6),
    circ(21.5, 26.4, 0.6, MARK),
    P.ink > 0.01 && inkA > 0.02 ? stroke(d, '#4a3020', 0.7, { opacity: inkA }) : null,
  ], { transform: ml ? rot(mAng, mpx, 28) : undefined });
  // ---- the pen tentacle, from under the face to the quill; the nib follows the line while he draws, else rests where it was left
  const ca = Math.cos(mAng * DEG), sa = Math.sin(mAng * DEG); const qx0 = P.inking ? nx : P.penX, qy0 = P.inking ? ny : P.penY, lift = clamp(P.lift, -0.3, 1.5);
  const tipX = mpx + (qx0 - mpx) * ca - (qy0 - 28) * sa, tipY = 28 + (qx0 - mpx) * sa + (qy0 - 28) * ca - lift * 1.8;
  const px0 = 28.8 + hx, py0 = 17.8 + hy, mx = (px0 + tipX) / 2 + 1.4 - dip * 0.6, my = (py0 + tipY) / 2 + 2 - dip * 0.8;
  const tentacle = stroke(`M${n(px0)} ${n(py0)} Q${n(mx)} ${n(my)} ${n(tipX)} ${n(tipY)}`, SKIN2, 1.5);
  const qa = -36 - 12 * clamp(lift, 0, 1) + mAng * 0.5, qs = Math.sin(qa * DEG), qc = Math.cos(qa * DEG), qfx = tipX + qs * 2.9, qfy = tipY - qc * 2.9;
  const quill = [stroke(`M${n(tipX)} ${n(tipY)} L${n(tipX + qs * 4.2)} ${n(tipY - qc * 4.2)}`, '#e8dcc0', 0.7), ell(qfx, qfy, 0.75, 1.5, '#f4ecd8', { stroke: INK, strokeWidth: 0.3, transform: rot(qa, qfx, qfy) })];
  // ---- the eyestalks: springs from the head top, curving as their tips lag, shrinking when startled; the spectacles ride the eyes
  const eyeAt = (bx0, by0, a, bend, len, ret) => {
    const rk = clamp(ret, 0, 1), ext = len * (1 - 0.72 * rk), ar = a * DEG, at = (a + bend) * DEG, ds = Math.sin(at), dc = Math.cos(at);
    const cx = bx0 + ds * (ext + 0.5), cy = by0 - dc * (ext + 0.5), mx0 = bx0 + Math.sin(ar) * ext * 0.55, my0 = by0 - Math.cos(ar) * ext * 0.55;
    const r = 1.3 * (1 + 0.22 * wide) * (1 - 0.3 * rk), slip = clamp(P.specSlip, 0, 1) * 1.5;
    return [
      stroke(`M${n(bx0)} ${n(by0)} Q${n(mx0)} ${n(my0)} ${n(bx0 + ds * ext)} ${n(by0 - dc * ext)}`, SKIN2, 1.6),
      circ(cx - ds * slip, cy + dc * slip, 2.2, 'none', { stroke: SPEC, strokeWidth: 0.6 }),
      open < 0.12 ? stroke(`M${n(cx - r)} ${n(cy)} L${n(cx + r)} ${n(cy)}`, EYE, 0.7, { opacity: 0.55 })
        : [circ(cx, cy, r * 1.8 * P.glowK * (1 + 0.3 * wide), EYE, { opacity: 0.25 }), ell(cx, cy, r, r * open, EYE), open > 0.5 ? circ(cx, cy, r * 0.45, '#ffffff', { opacity: 0.8 }) : null],
    ];
  };
  const eyes = [eyeAt(27 + hx, 13 + hy, P.stalkL, P.bendL, LL, P.retL), eyeAt(28.5 + hx, 13.5 + hy, P.stalkR, P.bendR, LR, P.retR)];
  const body = g([foot, shell, neck, mouth, map, tentacle, quill, eyes], { transform: `${tr(FX, FY)} scale(${n(P.sx)} ${n(P.sy)}) ${tr(-FX, -FY)}` });
  return svg(W, H, [sheen, body]);
}

// the angle from straight up (clockwise positive, degrees) of the direction from (x0, y0) to (x1, y1)
const aim = (x0, y0, x1, y1) => Math.atan2(x1 - x0, -(y1 - y0)) / DEG;

// ---- animation: idle life, his work on the map, the player's whereabouts and the dialogue, turned into targets every frame
function control(e, pup, info) {
  const dt = info.dt, m = pup.mem, game = info.game, P = pup.P, V = pup.V;
  if (m.init === undefined) {
    m.init = true; m.t0 = Math.random() * 9; m.ph = Math.random() * 6.3; m.blink = 2 + Math.random() * 3; m.blinkT = 0; m.dbl = false;
    m.glance = 1.5 + Math.random() * 2; m.ga = 0; m.gd = 0; m.flickT = 1 + Math.random() * 3; m.penTw = 2 + Math.random() * 3;
    m.scrib = 1.6; m.clip = -1; m.scribI = 0; m.inkDone = 9; m.phase = 0; m.consider = 1;
    m.near = false; m.pAir = false; m.pvy = 0; m.startle = 0; m.perk = 0; m.gustCd = 0; m.gustT = 0; m.gustV = 0; m.thump = false; m.arrive = false;
    m.dlg = false; m.dlgI = -1; m.lineT = 9; m.endT = 9; m.side = 1; m.tap = 0; m.cue = null; m.cueT = -1; m.fake = null;
  }
  const s = pup.scale || SCALE; const wx = e.tx * TILE + 8, wy = e.ty * TILE + TILE;
  const hwx = wx + (28 + P.reach * 2.4 - P.back * 2.5 - FX) * s, hwy = wy + (13 + P.dip * 4 - H) * s; // his head, in world units
  // ---- the player: where they are relative to his head, and how much of his attention they get
  const pl = game && game.player; let dx = 1e4, dy = 0, dist = 1e9, pvx = 0, pvy = 0, pOnG = true;
  if (pl && !pl.dead) { dx = pl.x + pl.w / 2 - hwx; dy = pl.y + pl.h / 2 - hwy; dist = Math.hypot(dx, dy); pvx = pl.vx; pvy = pl.vy; pOnG = !!pl.onGround; }
  const sd = dx < 0 ? -1 : 1, att = Anim.smooth(dist, 170, 70), near = dist < 110;
  // ---- a cue set on the entity (filmstrips) fires one beat a moment later
  if (e.cue !== m.cue) { m.cue = e.cue; if (e.cue) m.cueT = 0.25; }
  if (m.cueT >= 0) { m.cueT -= dt; if (m.cueT < 0) { const c = m.cue; if (c === 'scribble') m.scrib = 0; else if (c === 'startle') m.thump = true; else if (c === 'greet') m.arrive = true; else if (TALK_TEXT[c]) m.fake = { lines: [{ who: 'Tallow', text: TALK_TEXT[c] }], i: 0, shown: 0, t: 0 }; } }
  // ---- the conversation: ui.dialogue is set while one runs, nearInteract is the friend it was opened on (or a cue's stand-in)
  let dlg = game && game.ui ? game.ui.dialogue : null, talking = !!dlg && game.nearInteract === e;
  if (m.fake) { const f = m.fake, len = f.lines[0].text.length; f.t += dt; f.shown = Math.min(len, f.shown + dt * 38); if (f.t > len / 38 + 1.6) f.i = 1; if (f.t > len / 38 + 2.6) m.fake = null; else { dlg = f; talking = true; } }
  const line = talking ? dlg.lines[dlg.i] : null, speaking = !!line && line.who === 'Tallow', typing = speaking && dlg.shown < line.text.length, shown = speaking ? dlg.shown : 0;
  const mapLine = speaking && /map/i.test(line.text);
  const talkStart = talking && !m.dlg, talkEnd = !talking && m.dlg; m.dlg = talking;
  const newLine = talking && !talkStart && dlg.i !== m.dlgI; m.dlgI = talking ? dlg.i : -1;
  // ---- events, found by watching the state change: the player arriving, thumping down beside him or dashing past
  const arrive = (near && !m.near) || m.arrive; m.near = near; m.arrive = false;
  const landed = pOnG && m.pAir && m.pvy > 160 && dist < 100; m.pAir = !pOnG; m.pvy = pvy;
  m.gustCd -= dt; const dashBy = m.gustCd < 0 && dist < 70 && Math.abs(pvx) > 240;
  const thump = landed || dashBy || m.thump; m.thump = false; const wind = pvx ? (pvx > 0 ? 1 : -1) : sd;
  if (thump) { // a snail's reflex: eyes in, a squash, the shell rocks, the quill jumps, the map's corner flaps
    m.startle = 0.6; m.clip = -1; m.gustCd = 0.8; m.gustT = 0.25; m.gustV = pvx; m.perk = 0.7; m.blink = Math.max(m.blink, 0.9);
    pup.impulse('sx', 1.5).impulse('sy', -1.3).impulse('shellRock', -45 * wind).impulse('flameLean', 420 * wind).impulse('mapLift', 4 * wind).impulse('lift', 10).impulse('reach', -6).impulse('bendL', 420 * wind).impulse('bendR', 420 * wind);
  } else if (arrive && m.startle <= 0) { // company: a look up and over, the lamp brightens
    m.perk = 0.45; m.glance = 4;
    pup.impulse('reach', 5 * sd).impulse('stalkL', 280 * sd).impulse('stalkR', 240 * sd).impulse('lamp', 2.5).impulse('sy', 0.4).impulse('glowK', 2);
  }
  if (talkStart) { m.clip = -1; m.lineT = 0; m.tap = 0; pup.impulse('reach', 6 * sd).impulse('stalkL', 260 * sd).impulse('stalkR', 220 * sd).impulse('lamp', 4).impulse('sy', 0.6).impulse('specSlip', -5).impulse('glowK', 3); }
  if (newLine) { m.lineT = 0; m.side = -m.side; pup.impulse('dip', 4).impulse('lamp', 2).impulse('stalkL', 160 * m.side).impulse('stalkR', -130 * m.side).impulse('mapLift', mapLine ? 0 : 1.5 * m.side); }
  if (talkEnd) { m.endT = 0; m.scrib = Math.min(m.scrib, 1.4 + Math.random()); pup.impulse('dip', 3).impulse('lamp', -1.2).impulse('stalkL', -120).impulse('stalkR', -100); }
  m.lineT += dt; m.endT += dt; if (m.startle > 0) m.startle -= dt; if (m.perk > 0) m.perk -= dt; if (m.gustT > 0) m.gustT -= dt;
  // ---- idle life: a breath, the crawl (a slow reach and a quicker pull-in), blinks (sometimes doubled), glances, stalk flicks, quill taps
  const t = pup.time + m.t0; const br = Math.sin(t * 1.4);
  m.ph += dt * 0.6 * (Math.cos(m.ph) < 0 ? 1.5 : 0.75) * (talking ? 0.5 : 1); const stretch = Math.sin(m.ph) * (talking ? 0.5 : 1);
  m.blink -= dt; if (m.blink < 0) { m.blink = m.dbl ? 0.3 : 2.5 + Math.random() * 4; m.dbl = !m.dbl && Math.random() < 0.22; m.blinkT = 0.2; }
  let open = 1; if (m.blinkT > 0) { m.blinkT -= dt; open = m.blinkT > 0.1 ? 1 - (0.2 - m.blinkT) / 0.1 : m.blinkT / 0.1; }
  if (m.perk > 0) open = 1;
  m.glance -= dt; if (m.glance < 0) { m.glance = 2 + Math.random() * 4; const r = Math.random(); m.ga = r < 0.3 ? -35 - Math.random() * 25 : (Math.random() - 0.5) * 50; m.gd = r < 0.3 ? 0.25 : 0; } // a look about, or a check of the map
  m.flickT -= dt; if (m.flickT < 0) { m.flickT = 1.5 + Math.random() * 3; pup.impulse(Math.random() < 0.5 ? 'stalkL' : 'stalkR', (Math.random() < 0.5 ? -1 : 1) * (160 + Math.random() * 140)); }
  m.penTw -= dt; if (m.penTw < 0 && m.clip < 0 && !talking) { m.penTw = 2.5 + Math.random() * 4; pup.impulse('lift', 5 + Math.random() * 4); }
  const swayL = Math.sin(t * 1.1) * 6 + Math.sin(t * 2.7 + 1) * 2, swayR = Math.sin(t * 1.35 + 1.7) * 6.5 + Math.sin(t * 3.1 + 0.5) * 2;
  const flick = 0.9 + 0.07 * Math.sin(t * 8.7) + 0.04 * Math.sin(t * 21.3 + 2) + (typing ? 0.08 * Math.sin(shown * 2.6) : 0);
  // ---- his work: every so often he bows over the map and adds a line to it (a clip on his own clock), then the ink fades
  m.scrib -= dt; m.inkDone += dt;
  if (m.scrib < 0 && m.clip < 0 && !talking && m.startle <= 0 && m.endT > 1) {
    m.scrib = (near ? 7 : 4.5) + Math.random() * 4; m.clip = 0; m.scribI = (m.scribI + 1 + (Math.random() < 0.5 ? 1 : 0)) % SCRIBS.length; m.phase = 0; m.inkDone = -9; m.consider = Math.random() < 0.5 ? 1 : -1;
    pup.snap({ ink: 0, inkA: 1, scribI: m.scribI }); pup.impulse('specSlip', 6).impulse('stalkL', -200).impulse('stalkR', -200);
  }
  let dipT = 0, lift = 0, ink = P.ink, inking = 0, penX = P.penX, penY = P.penY, mapLift = 0, reachT = 0, backT = 0.45 * att * (sd < 0 ? 1 : 0), cock = 0;
  if (m.clip >= 0) {
    m.clip += dt; const k = m.clip, c = Anim.keys(k, SCRIB_CLIP), sc = SCRIBS[m.scribI]; dipT = c.dip; lift = c.lift;
    if (k < 0.9) { penX = sc[0][0]; penY = sc[0][1]; } // the nib travels to where the new line starts
    else if (k < 2.95) { inking = 1; ink = k < 1.55 ? (k - 0.9) / 0.65 * 0.5 : k < 2.1 ? 0.5 : k < 2.8 ? 0.5 + (k - 2.1) / 0.7 * 0.5 : 1; dipT += 0.03 * Math.sin(ink * 31); lift += 0.1 * Math.abs(Math.sin(ink * 47)); if (k > 1.6 && k < 2.05) cock = m.consider; }
    else { ink = 1; const last = sc[sc.length - 1]; penX = last[0]; penY = last[1]; if (m.phase === 0) { m.phase = 1; pup.snap({ penX: last[0], penY: last[1] }); pup.impulse('specSlip', -7).impulse('stalkL', 220).impulse('stalkR', 260).impulse('reach', 3); } } // done: he straightens, the spectacles pop back up
    if (k >= 3.4) { m.clip = -1; m.inkDone = 0; }
  }
  // ---- the stalks: at the player when they have his attention, at the nib while he works, else a sway and the odd glance
  let aL = AL0 + swayL + m.ga, aR = AR0 + swayR + m.ga * 0.85, wide = 0, retT = 0, mouth = 0, lampT = 0.5 + 0.2 * Math.sin(t * 0.9 + 1) + 0.3 * att;
  dipT += m.gd * (1 - att);
  const attK = talking ? 1 : att * (1 - 0.6 * clamp(dipT, 0, 1)), aPl = clamp(aim(0, 0, dx, dy), -128, 128);
  aL = lerp(aL, aPl - 8, attK); aR = lerp(aR, aPl + 8, attK);
  if (dipT > 0.05) { // the eyes follow the nib
    const hxT = reachT * 2.4 + P.stretch * 2 - dipT * 3.5 - backT * 2.5, hyT = dipT * 4 - backT * 0.8, dk = clamp(dipT * 1.3, 0, 1);
    if (inking) scribAt(SCRIBS[m.scribI], ink, TIP); else { TIP[0] = penX; TIP[1] = penY; }
    aL = lerp(aL, aim(27 + hxT, 13 + hyT, TIP[0] - 1.6, TIP[1]), dk); aR = lerp(aR, aim(28.5 + hxT, 13.5 + hyT, TIP[0] + 1.6, TIP[1]), dk);
  }
  aR += cock * 22; aL -= cock * 6;
  // ---- talking: perked up toward the player, the stalks waggle and the mouth moves with the text; the map is lifted and tapped on its line
  if (talking) {
    reachT = 0.35; backT = sd < 0 ? 0.85 : 0; wide = 0.15; lampT += typing ? 0.4 + 0.1 * Math.sin(shown * 2.3) : 0.3;
    if (typing) { mouth = 0.2 + 0.55 * Math.max(0, Math.sin(shown * 1.15)); dipT += 0.08 + 0.07 * Math.sin(shown * 0.9); aL += Math.sin(shown * 0.8) * 7; aR += Math.cos(shown * 0.8) * 7; }
    else { dipT += 0.03; if (speaking) { aL += 4 * m.side; aR -= 3 * m.side; } } // waiting for the player to read: a cocked look
    if (mapLine) { mapLift = -sd; lift = 0.45; penX = 21.5; penY = 25.4; m.tap -= dt; if (m.tap < 0) { m.tap = 0.7; pup.impulse('lift', -9); } }
  }
  // ---- startled: the eyes are drawn in, wide when they come back out; perked: wide for a moment
  if (m.startle > 0) { retT = m.startle > 0.25 ? 0.85 : 0; wide = 1; dipT = 0; lift = Math.max(lift, 0.5); reachT = -0.4; backT = 0; aL = lerp(aL, AL0 - 10, 0.7); aR = lerp(aR, AR0 - 6, 0.7); }
  else if (m.perk > 0) wide = Math.max(wide, 0.7);
  // ---- secondary motion: the tips lag the stalks, the shell lags the foot and rocks, the flame leans against the shell's motion and the gusts
  pup.target({
    stretch, shellK: P.stretch, shellRock: (P.shellK - P.stretch) * 10, sx: 1 - 0.01 * br, sy: 1 + 0.018 * br,
    reach: reachT + 0.3 * stretch + 0.15 * att * (sd > 0 ? 1 : 0), back: backT, dip: dipT, stalkL: aL, stalkR: aR,
    bendL: clamp(-(V.stalkL || 0) * 0.045, -30, 30), bendR: clamp(-(V.stalkR || 0) * 0.045, -30, 30), retL: retT, retR: retT * 0.9,
    eyeOpen: open, wide, glowK: 1 + 0.12 * Math.sin(t * 2.3), specSlip: 0.5 * clamp(dipT, 0, 1), mouth,
    lift, penX, penY, inking, ink, inkA: 1 - Anim.smooth(m.inkDone, 1.5, 5), scribI: m.scribI, mapLift,
    lamp: lampT, flick, flameLean: -(V.shellK || 0) * 25 - (V.stretch || 0) * 10 + (m.gustT > 0 ? m.gustV * 0.08 : 0), sheen: 0.5 + 0.5 * Math.sin(m.ph - 1.2),
  });
}

// world-space light over the body: the lantern's glow on its surroundings, breathing with the lamp
function after(ctx, e, pup, info) {
  if (!info.glowAt) return; const P = pup.P, s = pup.scale || SCALE;
  const px = FX + (12 + P.shellK * 1.8 - FX) * P.sx, py = FY + (15 - FY) * P.sy; // the shell's centre through the body's squash
  const k = clamp(P.lamp, 0, 1.6) * P.flick;
  info.glowAt(e.tx * TILE + 8 + (px - FX) * s, e.ty * TILE + TILE + (py - H) * s, 9 + 7 * k, '#ffd9a0', 0.1 + 0.18 * k);
}

module.exports = { name: 'tallow', w: W, h: H, anchor: 'bottom', params, springs, poses, make, control, after };
