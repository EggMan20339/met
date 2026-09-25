// The friends still lit: Wick, Old Bramble, Tallow, and the Bell Ringer.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, rect, stroke, g, rot, glowEye, glow, eye } = L;
const sheet = {}; const add = (name, w, h, anchor, fn) => { sheet[name] = { w, h, anchor, make: fn }; };

// ---- Wick: an old moth, ember-keeper, cloak of his own wings and a staff with the last coal
const wick = (frame) => {
  const W = 36, H = 38; const flap = frame === 'b' ? 6 : 0;
  const wingG = lin('ww', 0, 6, 0, 30, [[0, '#b8a8d8'], [1, '#6a5a90']]);
  const robeG = lin('wr', 12, 12, 24, 36, [[0, '#7a6b9c'], [1, '#3e3458']]);
  const coal = glow(28, 6, 7, '#ffb347', 0.6);
  const wing = (m) => path(`M18 16 C${18 + m * 4} ${8 - flap} ${18 + m * 16} ${8 - flap} ${18 + m * 16} ${18 - flap * 0.5} C${18 + m * 15} 26 ${18 + m * 7} 28 18 26 Z`, 'url(#ww)', { stroke: '#4a3f66', strokeWidth: 0.8, opacity: 0.92 });
  const spots = (m) => circ(18 + m * 10, 15 - flap * 0.5, 2, '#4a3f66') + circ(18 + m * 10, 15 - flap * 0.5, 1, '#ffd9a0', { opacity: 0.8 });
  const robe = path('M12 37 C11 26 13 18 18 14 C23 18 25 26 24 37 Z', 'url(#wr)', { stroke: '#2a2238', strokeWidth: 0.9 });
  const head = circ(18, 12, 5, '#8a7aa8', { stroke: '#4a3f66', strokeWidth: 0.9 });
  const fuzz = ell(18, 9, 5.6, 2.4, '#a898c4');
  const eyes = glowEye(16, 12.5, 1, '#ffe9b0') + glowEye(20, 12.5, 1, '#ffe9b0');
  const brows = stroke('M14.2 10.5 L16.8 10 M19.2 10 L21.8 10.5', '#4a3f66', 0.8);
  const antennae = stroke('M16 8 C14 4 11 3 9 4 M20 8 C22 4 25 3 27 4', '#d8c8ff', 0.9) + [[9, 4], [27, 4]].map(([x, y]) => circ(x, y, 0.9, '#d8c8ff')).join('');
  const staff = stroke('M28 36 L28 8', '#8a7a50', 1.8) + circ(28, 6, 2.4, '#ffb347') + circ(28, 6, 1.1, '#fff4dc');
  const hands = stroke('M23 24 L27 20', '#8a7aa8', 2.2);
  return svg(W, H, coal.el + wing(-1) + spots(-1) + robe + wing(1) + spots(1) + hands + staff + head + fuzz + eyes + brows + antennae, wingG + robeG + coal.def);
};
add('wick_a', 36, 38, 'bottom', () => wick('a')); add('wick_b', 36, 38, 'bottom', () => wick('b'));

// ---- Old Bramble: a hermit made of hedge; moss, twigs, two patient eyes and a cane
const bramble = () => {
  const W = 34, H = 34;
  const ballG = rad('bb', 15, 17, 12, [[0, '#7a9a4a'], [0.6, '#4a6a34'], [1, '#22361c']], 13, 14);
  const twigs = [];
  for (let i = 0; i < 14; i++) { const a = -Math.PI + i * (Math.PI * 1.15 / 13); const x = 17 + Math.cos(a) * 11, y = 20 + Math.sin(a) * 11; twigs.push(stroke(`M${x} ${y} L${17 + Math.cos(a) * 15.5} ${20 + Math.sin(a) * 15.5 - 0.5}`, '#3e4a2a', 1.4)); if (i % 3 === 1) twigs.push(stroke(`M${17 + Math.cos(a) * 13.5} ${20 + Math.sin(a) * 13.5} l${Math.cos(a + 0.9) * 3} ${Math.sin(a + 0.9) * 3}`, '#3e4a2a', 1)); }
  const ball = circ(17, 20, 11.5, 'url(#bb)', { stroke: '#1c2a16', strokeWidth: 1 });
  const moss = ell(12, 14, 3, 1.8, '#b8c86a', { opacity: 0.85 }) + ell(22, 26, 2.6, 1.5, '#b8c86a', { opacity: 0.75 }) + circ(21, 12, 1.3, '#e0ffa0', { opacity: 0.8 });
  const berries = circ(10, 24, 1.1, '#d04a5a') + circ(24, 15, 1, '#d04a5a');
  const eyes = glowEye(13.5, 19.5, 1.4, '#ffe9b0') + glowEye(20.5, 19.5, 1.4, '#ffe9b0');
  const mouth = stroke('M14.5 24.5 C16 26 18.5 26 20 24.5', '#1c2a16', 1);
  const cane = stroke('M4 33 L4 16', '#6a5a3a', 1.8) + stroke('M4 16 C3 12 6 11 7 13', '#6a5a3a', 1.8);
  const arm = stroke('M7 22 L5 19', '#3e4a2a', 2);
  return svg(W, H, cane + twigs.join('') + ball + moss + berries + arm + eyes + mouth, ballG);
};
add('bramble', 34, 34, 'bottom', bramble);

// ---- Tallow: a snail cartographer whose shell is a lantern; spectacles, and a map he is never done with
const tallow = () => {
  const W = 34, H = 30;
  const shellG = rad('ts', 12, 15, 11, [[0, '#ffe2b0'], [0.45, '#d89a58'], [1, '#5a3a24']], 10, 12);
  const lamp = glow(12, 15, 9, '#ffd9a0', 0.5);
  const foot = path('M2 29 C4 24 10 22 18 22 C25 22 30 24 31 27 C31 29 28 29.5 24 29.5 L4 29.5 Z', '#8a7a9a', { stroke: '#5a4a6a', strokeWidth: 0.8 });
  const shell = circ(12, 15, 10.5, 'url(#ts)', { stroke: '#4a2c1c', strokeWidth: 1 });
  const spiral = stroke('M12 15 m6 0 a6 6 0 1 1 -6 -6 a4 4 0 1 1 4 4 a2 2 0 1 1 -2 -2', '#4a2c1c', 0.9, { opacity: 0.6 });
  const glass = circ(12, 15, 3.6, '#fff0cc', { opacity: 0.9 }) + circ(12, 15, 1.6, '#ffffff');
  const neck = path('M21 23 C22 18 25 15 28 13 C30 14 30 17 27 19 C25 21 24 23 24 25 Z', '#9a8aaa', { stroke: '#5a4a6a', strokeWidth: 0.8 });
  const stalks = stroke('M27 13 L29 6 M28.5 13.5 L32 8', '#9a8aaa', 1.6);
  const eyes = glowEye(29, 5.5, 1.3, '#ffe9b0') + glowEye(32.2, 7.5, 1.3, '#ffe9b0');
  const specs = circ(29, 5.5, 2.2, 'none', { stroke: '#d8c8a0', strokeWidth: 0.6 }) + circ(32.2, 7.5, 2.2, 'none', { stroke: '#d8c8a0', strokeWidth: 0.6 });
  const map = rect(15, 23, 8, 5, '#eadfc4', { rx: 0.8, stroke: '#8a6a4a', strokeWidth: 0.6 }) + stroke('M16.5 25 L21 25 M16.5 26.5 L20 26.5', '#8a6a4a', 0.6) + circ(21.5, 26.4, 0.6, '#d04a5a');
  return svg(W, H, lamp.el + foot + shell + spiral + glass + neck + stalks + specs + eyes + map, shellG + lamp.def);
};
add('tallow', 34, 30, 'bottom', tallow);

// ---- The Bell Ringer: what the water left of the one who rang the warning
const ringer = () => {
  const W = 30, H = 36;
  const bodyG = lin('rg', 0, 4, 0, 34, [[0, '#cfe8ff', 0.95], [0.6, '#8ec4ff', 0.6], [1, '#6aa0ff', 0]]);
  const halo = glow(15, 14, 13, '#8ce0ff', 0.35);
  const body = path('M8 34 C6 24 6 14 15 6 C24 14 24 24 22 34 L20 30 L17.5 34 L15 30 L12.5 34 L10 30 Z', 'url(#rg)');
  const rim = stroke('M8.5 28 C8 20 9 12 15 7', '#e8f6ff', 0.9, { opacity: 0.8 });
  const eyes = ell(12.2, 15, 1.4, 2.2, '#0c1a2c') + ell(17.8, 15, 1.4, 2.2, '#0c1a2c') + circ(12, 14.3, 0.5, '#8ce0ff') + circ(17.6, 14.3, 0.5, '#8ce0ff');
  const mouth = ell(15, 20, 1.2, 1.8, '#0c1a2c', { opacity: 0.8 });
  const arm = stroke('M21 20 L26 14', '#cfe8ff', 1.8, { opacity: 0.9 });
  const bell = path('M23 14 C23 8 29 8 29 14 L30 16 L22 16 Z', '#dbe8f0', { stroke: '#8aa8c0', strokeWidth: 0.7 }) + circ(26, 16.5, 0.9, '#8aa8c0') + circ(26, 8.5, 0.8, '#dbe8f0');
  const rings = [[26, 15, 5], [26, 15, 8]].map(([x, y, r]) => circ(x, y, r, 'none', { stroke: '#8ce0ff', strokeWidth: 0.6, opacity: 0.35 })).join('');
  return svg(W, H, halo.el + body + rim + eyes + mouth + arm + bell + rings, bodyG + halo.def);
};
add('ringer', 30, 36, 'bottom', ringer);

module.exports = sheet;
