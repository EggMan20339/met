// Mote, the last spark: a small luminous spirit with ember-leaf ears and a wisp tail.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, stroke, g, rot, eye, glow } = L;
const W = 36, H = 40, FX = 18, FY = 38; // feet anchor: bottom centre

const POSES = {
  idle: { lean: 0, earL: -38, earR: -14, legL: 0, legR: 0, eyes: 'open', sx: 1, sy: 1, tail: 0 },
  run1: { lean: 9, earL: -62, earR: -36, legL: -28, legR: 26, eyes: 'open', sx: 1, sy: 1, tail: 1 },
  run2: { lean: 9, earL: -58, earR: -30, legL: -6, legR: 4, eyes: 'open', sx: 1, sy: 1.04, tail: 1 },
  run3: { lean: 9, earL: -66, earR: -40, legL: 26, legR: -28, eyes: 'open', sx: 1, sy: 1, tail: 1 },
  run4: { lean: 9, earL: -60, earR: -34, legL: 4, legR: -6, eyes: 'open', sx: 1, sy: 1.04, tail: 1 },
  jump: { lean: 5, earL: -78, earR: -56, legL: -40, legR: -40, eyes: 'open', sx: 0.92, sy: 1.14, tail: 2 },
  fall: { lean: -3, earL: -8, earR: 14, legL: 14, legR: -10, eyes: 'wide', sx: 1.04, sy: 0.96, tail: -1 },
  cling: { lean: -14, earL: -20, earR: 6, legL: 30, legR: 20, eyes: 'open', sx: 0.96, sy: 1.02, tail: -1, paw: true },
  dash: { lean: 22, earL: -92, earR: -74, legL: -30, legR: -30, eyes: 'squint', sx: 1.28, sy: 0.74, tail: 3 },
  hurt: { lean: -10, earL: -30, earR: -46, legL: 20, legR: -20, eyes: 'squint', sx: 1.04, sy: 0.96, tail: -1 },
  sit: { lean: 0, earL: -48, earR: -30, legL: 0, legR: 0, eyes: 'closed', sx: 1.08, sy: 0.9, tail: 0 },
  cast: { lean: 6, earL: -70, earR: -40, legL: -10, legR: 12, eyes: 'open', sx: 1, sy: 1, tail: 1, paw: 'ember' },
  strike: { lean: 14, earL: -84, earR: -60, legL: -22, legR: 18, eyes: 'squint', sx: 1.06, sy: 0.96, tail: 2, paw: 'strike' },
  focus: { lean: 0, earL: -20, earR: 2, legL: 0, legR: 0, eyes: 'closed', sx: 1.04, sy: 0.96, tail: 0, aura: true },
};

function mote(name) {
  const P = POSES[name];
  const body = lin('mb', 10, 10, 26, 36, [[0, '#fffaf0'], [0.55, '#f4ecff'], [1, '#d8ccff']]);
  const earG = lin('me', 0, 0, 0, -20, [[0, '#fff3dc'], [0.7, '#ffe2b0'], [1, '#ffb347']]);
  const core = rad('mc', 17, 21, 9, [[0, '#ffffff', 0.9], [1, '#ffffff', 0]]);
  const aura = P.aura ? glow(18, 22, 17, '#ffd080', 0.45) : null;
  const defs = body + earG + core + (aura ? aura.def : '');
  const ear = (deg, x, y) => g([
    path('M0 0 C-3.2 -6 -3.4 -13 0 -20 C3.4 -13 3.2 -6 0 0 Z', 'url(#me)', { stroke: '#e8c690', strokeWidth: 0.7 }),
    stroke('M0 -2 C0.4 -8 0.4 -13 0 -18', '#f0c890', 0.6, { opacity: 0.7 }),
    circ(0, -19, 1.6, '#ffd27a', { opacity: 0.55 }),
  ], { transform: `translate(${x} ${y}) ${rot(deg, 0, 0)}` });
  const tailD = P.tail === 3 ? 'M11 27 C0 26 -4 30 -6 34' : P.tail === 2 ? 'M11 28 C6 30 4 34 5 38' : P.tail === -1 ? 'M11 28 C6 25 3 21 3 16' : P.tail === 1 ? 'M11 28 C5 28 2 32 1 36' : 'M11 28 C5 27 3 31 2 35';
  const tail = stroke(tailD, '#e8dcff', 3.2) + stroke(tailD, '#fffaf0', 1.4);
  const leg = (deg, x) => g([stroke('M0 0 L0 3.2', '#d8d0f4', 2.4), ell(0, 3.4, 1.9, 1.2, '#eee8ff')], { transform: `translate(${x} ${FY - 3.6}) ${rot(deg, 0, 0)}` });
  const legs = name === 'sit' ? ell(18, FY - 1.5, 6, 1.6, '#d8d0f4') : leg(P.legL, 15) + leg(P.legR, 21);
  const eyes = (() => {
    if (P.eyes === 'closed') return stroke('M13 21.5 C14.2 22.8 15.8 22.8 17 21.5', '#3a2e55', 1) + stroke('M19 21 C20.1 22.2 21.5 22.2 22.6 21', '#3a2e55', 1);
    if (P.eyes === 'squint') return stroke('M13.2 21.6 L16.6 21.2', '#3a2e55', 1.4) + stroke('M19.4 21 L22.4 20.6', '#3a2e55', 1.4);
    const k = P.eyes === 'wide' ? 1.15 : 1;
    return eye(15.2, 21, 2.1 * k, 2.9 * k) + eye(20.6, 20.4, 1.9 * k, 2.6 * k);
  })();
  const paw = P.paw === 'ember' ? g([stroke('M23 27 L29 24', '#f4ecff', 2.6), circ(30, 23, 2.4, '#ffb347'), circ(30, 23, 4.5, '#ffb347', { opacity: 0.3 })])
    : P.paw === 'strike' ? g([stroke('M23 26 L31 22', '#f4ecff', 2.6), stroke('M31 22 L35 19', '#ffe9b0', 1.8), stroke('M30.5 23.5 L34.5 20.5', '#ffb347', 0.8, { opacity: 0.8 })])
    : P.paw ? stroke('M12 24 L8 18', '#f4ecff', 2.6) : '';
  const bodyEl = path('M18 12 C25.5 12 27 19.5 26.2 27 C25.5 33 22.5 36.2 18 36.2 C13.5 36.2 10.5 33 9.8 27 C9 19.5 10.5 12 18 12 Z', 'url(#mb)', { stroke: '#cbbde8', strokeWidth: 0.9 });
  const rim = stroke('M12.2 16 C13 13.8 15 12.6 17.5 12.4', '#ffffff', 1.2, { opacity: 0.8 });
  const shadow = path('M20 35.6 C24 34.5 26 30 25.6 25', '#8f7fbf', { opacity: 0.22, stroke: 'none' });
  const cheek = circ(23.6, 24.6, 1.6, '#ffc6b0', { opacity: 0.45 });
  const inner = circ(17, 21, 9, 'url(#mc)');
  const bodyGroup = g([tail, ear(P.earL, 15.5, 12.5), bodyEl, inner, rim, shadow, cheek, ear(P.earR, 20, 12.2), eyes, paw], { transform: `translate(${FX} ${FY}) ${rot(P.lean, 0, 0)} scale(${P.sx} ${P.sy}) translate(${-FX} ${-FY})` });
  return svg(W, H, (aura ? aura.el : '') + bodyGroup + legs, defs);
}
module.exports = { names: Object.keys(POSES), make: mote, meta: { w: W, h: H, anchor: 'bottom' } };
