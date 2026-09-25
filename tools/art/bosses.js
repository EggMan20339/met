// The three that swallowed too much: Gulletroot, the Drowned Bell, the Lightless.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, rect, stroke, g, rot, glowEye, glow, shade } = L;
const sheet = {}; const add = (name, w, h, anchor, fn) => { sheet[name] = { w, h, anchor, make: fn }; };

// ---- Gulletroot: a root-bulb the size of a hut, split by a maw of thorn teeth
const gulletroot = (frame) => {
  const W = 84, H = 64; const open = frame === 'open' ? 1 : frame === 'tele' ? 0.45 : 0.12; const tele = frame === 'tele';
  const bulbG = rad('gbu', 34, 26, 34, [[0, '#6a9a44'], [0.5, '#35542c'], [1, '#16281a']], 30, 20);
  const throat = rad('gth', 42, 38, 16, [[0, tele ? '#ffe36a' : '#c8ff5a', 0.9], [0.5, '#5a7a2a', 0.6], [1, '#120a10', 0.9]]);
  const roots = [];
  for (let i = -4; i <= 4; i++) { const x0 = 42 + i * 5, x1 = 42 + i * 13, sw = i % 2 ? '#4a2f1e' : '#5a3a24'; roots.push(stroke(`M${x0} 64 C${x0} 54 ${x1 - i} 46 ${x1} 34`, sw, 5.5)); roots.push(stroke(`M${x0} 64 C${x0} 54 ${x1 - i} 46 ${x1} 34`, '#8a5a34', 1.2, { opacity: 0.6 })); }
  const bulb = path('M8 40 C4 18 20 6 42 6 C64 6 80 18 76 40 C72 52 58 58 42 58 C26 58 12 52 8 40 Z', 'url(#gbu)', { stroke: '#0f1c12', strokeWidth: 1.6 });
  const mottle = [[16, 22, 3], [26, 12, 2.4], [58, 14, 2.8], [68, 28, 2.2], [22, 44, 2], [62, 46, 2.4], [40, 10, 1.6]].map(([x, y, r]) => circ(x, y, r, '#a8d070', { opacity: 0.35 })).join('');
  const maw = path(`M16 36 C28 ${28 - open * 12} 56 ${28 - open * 12} 68 36 C56 ${44 + open * 10} 28 ${44 + open * 10} 16 36 Z`, 'url(#gth)', { stroke: '#0a120c', strokeWidth: 1.2 });
  const teeth = [];
  for (let i = 0; i < 7; i++) { const x = 20 + i * 7.3; const hh = 3 + (i % 3) * 1.4; teeth.push(path(`M${x - 2} ${31 - open * 9 + (i % 2)} L${x} ${31 - open * 9 + hh + 3} L${x + 2} ${31 - open * 9 + (i % 2)} Z`, '#e8ffd0')); teeth.push(path(`M${x - 2} ${41 + open * 8} L${x} ${41 + open * 8 - hh - 2} L${x + 2} ${41 + open * 8} Z`, '#d8f0c0')); }
  const eyeC = tele ? '#ffe36a' : '#c8ff5a';
  const eyes = [[24, 20, 3], [31, 15.5, 1.8], [52, 15, 3.2], [60, 20, 1.9], [42, 13, 1.4]].map(([x, y, r]) => glowEye(x, y, r, eyeC)).join('');
  const cracks = tele ? stroke('M14 30 L20 26 L18 20 M70 30 L64 26 L66 20', '#ffe36a', 1.2, { opacity: 0.8 }) : '';
  const vents = [[12, 34], [72, 34]].map(([x, y]) => circ(x, y, 2.2, '#0f1c12') + circ(x, y, 1, '#c8ff5a', { opacity: 0.7 })).join('');
  return svg(W, H, roots.join('') + bulb + mottle + maw + teeth.join('') + vents + eyes + cracks, bulbG + throat);
};
['closed', 'open', 'tele'].forEach((f) => add('gulletroot_' + f, 84, 64, 'bottom', () => gulletroot(f)));

// ---- The Drowned Bell: a jelly shaped like the warning bell it swallowed, ringing itself
const bell = (frame) => {
  const W = 56, H = 64; const toll = frame === 'toll', stun = frame === 'stunned';
  const bodyG = lin('bbo', 8, 6, 48, 40, [[0, '#c8ecff', 0.92], [0.5, '#5aa0e0', 0.82], [1, '#2a4a9a', 0.9]]);
  const core = rad('bco', 28, 24, 12, [[0, '#ffffff', toll ? 1 : 0.85], [0.5, '#8ce0ff', 0.5], [1, '#8ce0ff', 0]]);
  const sq = toll ? 0.88 : 1;
  const tent = [];
  for (let i = -3; i <= 3; i++) { const x = 28 + i * 6; const ph = i * 0.9; tent.push(stroke(`M${x} 40 C${x + Math.sin(ph) * 5} 48 ${x - Math.sin(ph) * 6} 54 ${x + Math.sin(ph * 1.3) * 7} ${62 - Math.abs(i) * 2}`, i % 2 ? '#7fd7ff' : '#a0b8ff', 1.8, { opacity: 0.8 })); }
  const body = g([
    path('M8 40 C6 12 20 4 28 4 C36 4 50 12 48 40 C40 46 16 46 8 40 Z', 'url(#bbo)', { stroke: '#e8f6ff', strokeWidth: 1.2 }),
    stroke('M14 34 C22 40 34 40 42 34', '#ffffff', 1, { opacity: 0.4 }), stroke('M12 20 C14 12 20 8 26 7', '#ffffff', 1.2, { opacity: 0.7 }),
    circ(28, 24, 12, 'url(#bco)'), circ(28, 30, 4, '#dff6ff'), circ(28, 30, 1.8, '#ffffff'),
    // the drowned, faint in the glass
    ell(19, 18, 1.5, 2.2, stun ? '#20406a' : '#ff8ab0', { opacity: 0.8 }), ell(24, 17, 1.4, 2, stun ? '#20406a' : '#ff8ab0', { opacity: 0.6 }), ell(35, 19, 1.5, 2.2, stun ? '#20406a' : '#ff8ab0', { opacity: 0.8 }), ell(40, 17.5, 1.3, 1.9, stun ? '#20406a' : '#ff8ab0', { opacity: 0.6 }),
    circ(28, 4.5, 2.2, '#dff6ff', { stroke: '#8ec4ff', strokeWidth: 0.7 }),
  ], { transform: `translate(28 40) scale(${1 / sq} ${sq}) ${stun ? rot(22, 0, 0) : ''} translate(-28 -40)` });
  const rings = toll ? [10, 16, 22].map((r, i) => circ(28, 24, r, 'none', { stroke: '#8ce0ff', strokeWidth: 1.6 - i * 0.4, opacity: 0.55 - i * 0.12 })).join('') : '';
  return svg(W, H, tent.join('') + body + rings, bodyG + core);
};
['hover', 'toll', 'stunned'].forEach((f) => add('bell_' + f, 56, 64, 'center', () => bell(f)));

// ---- The Lightless: Sorrel, or what is left, a great beetle whose shell is the Great Lantern's iron cage
const lightless = (frame) => {
  const W = 72, H = 52; const charge = frame === 'charge', leap = frame === 'leap', stun = frame === 'stun', p3 = frame === 'phase3', p2 = frame === 'phase2';
  const shellG = lin('lsh', 10, 6, 60, 44, [[0, p3 ? '#3a2a34' : '#5a4a5c'], [0.5, p3 ? '#22181f' : '#3a2a3a'], [1, '#15100f']]);
  const inner = glow(34, 24, 22, p3 ? '#fff0c0' : '#ffd080', p3 ? 0.7 : p2 ? 0.45 : 0.3);
  const legY = leap ? -4 : 0; const mv = charge ? 3 : 0;
  const legs = [0, 1, 2, 3].map((i) => stroke(`M${18 + i * 11} 40 L${14 + i * 12 + (i % 2 ? mv : -mv)} ${51 + legY}`, '#1a1214', 3.4)).join('');
  const shell = path('M8 42 C4 20 14 8 34 6 L44 6 C60 8 68 20 66 40 C60 48 20 48 8 42 Z', 'url(#lsh)', { stroke: '#0e0a0c', strokeWidth: 1.6 });
  const plates = stroke('M20 10 C18 20 18 32 22 44 M34 7 C32 20 32 34 36 46 M48 8 C50 20 50 32 46 44', '#0e0a0c', 1.1, { opacity: 0.7 });
  const cage = stroke('M12 24 C24 22 46 22 62 24 M14 34 C26 32 48 32 64 34', '#7a6a80', 1, { opacity: 0.35 });
  const cracks = stroke('M16 30 L22 24 L20 16 M30 12 L34 22 L30 30 L36 40 M50 14 L46 24 L52 32', p3 ? '#fff4d0' : '#ff8a3c', p3 ? 2 : p2 ? 1.6 : 1.2) + stroke('M30 12 L34 22 M50 14 L46 24', '#ffe0a0', 0.8, { opacity: 0.8 });
  const head = path('M56 30 L70 26 L72 40 L58 44 Z', '#2a1f28', { stroke: '#0e0a0c', strokeWidth: 1.2 });
  const mandibles = stroke('M66 30 C76 26 78 34 72 38', '#e8d0b0', 3.2) + stroke('M66 40 C74 40 74 46 69 46', '#e8d0b0', 2.6);
  const eyeC = stun ? '#ffe0b0' : charge ? '#ff3a2a' : p3 ? '#ffffff' : p2 ? '#ff6a3a' : '#ffb347';
  const eyes = glowEye(64, 34, 3, eyeC) + glowEye(59, 30, 1.8, eyeC);
  const spines = [0, 1, 2].map((i) => path(`M${22 + i * 12} 8 L${26 + i * 12} 2 L${29 + i * 12} 8 Z`, '#3a2a3a')).join('');
  return svg(W, H, inner.el + legs + shell + plates + cage + cracks + spines + head + mandibles + eyes, shellG + inner.def);
};
['idle', 'charge', 'leap', 'stun', 'phase2', 'phase3'].forEach((f) => add('lightless_' + f, 72, 52, 'bottom', () => lightless(f)));

module.exports = sheet;
