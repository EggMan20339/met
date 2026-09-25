// Pickups, props and interface art.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, rect, stroke, g, rot, glow, rng } = L;
const sheet = {}; const add = (name, w, h, anchor, fn) => { sheet[name] = { w, h, anchor, make: fn }; };

// ---- pickups
add('petal', 18, 18, 'center', () => {
  const pg = lin('pt', 9, 2, 9, 16, [[0, '#ffe2ec'], [1, '#ff6fa0']]); const gl = glow(9, 9, 9, '#ff8ab0', 0.4);
  return svg(18, 18, gl.el + g([path('M9 2 C15 6 15 12 9 16 C3 12 3 6 9 2 Z', 'url(#pt)', { stroke: '#ff9ac0', strokeWidth: 0.6 }), stroke('M9 4 L9 14', '#ffffff', 0.8, { opacity: 0.7 }), stroke('M9 7 L6.5 9.5 M9 10 L11.5 12', '#ffffff', 0.5, { opacity: 0.5 })], { transform: rot(-25, 9, 9) }), pg + gl.def);
});
add('heartwood', 18, 18, 'center', () => {
  const gl = glow(9, 9, 9, '#ffb347', 0.4);
  return svg(18, 18, gl.el + g([path('M3 7 L15 5 L16 11 L4 13 Z', '#7a4a24', { stroke: '#3a2010', strokeWidth: 0.7 }), path('M4.5 8 L14 6.4 L14.8 10.2 L5 11.6 Z', '#c8803a'), stroke('M6 9.5 L8 8.6 L10 9.4 L12 8.4', '#ffd080', 0.9), stroke('M5.5 10.8 L13.5 9.2', '#e8a050', 0.5, { opacity: 0.8 })], { transform: rot(18, 9, 9) }), gl.def);
});
const gift = (name, color, symbol) => add('gift_' + name, 24, 24, 'center', () => {
  const gl = glow(12, 12, 12, color, 0.5); const og = rad('go' + name, 10, 10, 8, [[0, '#ffffff'], [0.35, color], [1, L.shade(color, -0.45)]]);
  return svg(24, 24, gl.el + circ(12, 12, 7.2, `url(#go${name})`, { stroke: L.shade(color, 0.3), strokeWidth: 0.8 }) + circ(12, 12, 10, 'none', { stroke: color, strokeWidth: 0.7, opacity: 0.6, strokeDasharray: '2 2.5' }) + symbol, gl.def + og);
});
gift('windstep', '#5ad8ff', stroke('M7 12 L17 12 M9 9 L13 9 M9 15 L13 15', '#ffffff', 1.6));
gift('rootgrip', '#8cff9a', stroke('M8 8 L8 16 M16 8 L16 16', '#ffffff', 1.8) + circ(12, 12, 1.3, '#ffffff'));
gift('skyleaf', '#d49aff', stroke('M8 12 L12 8 L16 12 M8 16 L12 12 L16 16', '#ffffff', 1.6));
gift('cinder', '#ffb347', path('M12 6.5 C15.5 10 15 14 12 17 C9 14 8.5 10 12 6.5 Z', '#ffffff') + path('M12 11 C13.5 12.6 13.3 14.5 12 15.5 C10.7 14.5 10.5 12.6 12 11 Z', '#ffb347'));
add('heart', 28, 28, 'center', () => {
  const gl = glow(14, 14, 14, '#ffd060', 0.6); const cg = rad('hc', 12, 12, 9, [[0, '#fff7e0'], [0.5, '#ffd060'], [1, '#c8781a']]);
  return svg(28, 28, gl.el + circ(14, 14, 8, 'url(#hc)', { stroke: '#ffe9b0', strokeWidth: 0.8 }) + circ(14, 14, 11, 'none', { stroke: '#ffe0a0', strokeWidth: 0.8, opacity: 0.6 }) + path('M14 8 C16 11 17 13 14 20 C11 13 12 11 14 8 Z', '#ffffff', { opacity: 0.85 }), gl.def + cg);
});

// ---- props
add('hearth', 40, 30, 'bottom', () => {
  const fg = lin('hf', 20, 6, 20, 26, [[0, '#ffe08a'], [0.6, '#ff8a3c'], [1, '#c83a10']]); const gl = glow(20, 18, 16, '#ffb347', 0.45);
  const stones = [[6, 26, 4, 2.4], [12, 28, 4.2, 2.2], [20, 28.5, 4.5, 2.2], [28, 28, 4.2, 2.2], [34, 26, 4, 2.4], [9, 23, 3, 1.8], [31, 23, 3, 1.8]].map(([x, y, rx, ry]) => ell(x, y, rx, ry, '#5a5470', { stroke: '#2a2638', strokeWidth: 0.7 })).join('');
  const logs = stroke('M11 25 L29 22', '#4a2f1e', 3) + stroke('M12 22 L28 26', '#5a3a24', 3);
  const fire = path('M13 25 C12 18 16 14 17 8 C19 13 22 12 22 6 C25 12 28 15 27 25 Z', 'url(#hf)') + path('M16 25 C15 20 18 17 19 13 C21 16 23 18 23 25 Z', '#fff4c0', { opacity: 0.85 });
  const sparks = [[15, 6], [24, 3], [19, 2]].map(([x, y]) => circ(x, y, 0.8, '#ffd27a', { opacity: 0.8 })).join('');
  return svg(40, 30, gl.el + stones + logs + fire + sparks, fg + gl.def);
});
add('hearth_cold', 40, 30, 'bottom', () => {
  const stones = [[6, 26, 4, 2.4], [12, 28, 4.2, 2.2], [20, 28.5, 4.5, 2.2], [28, 28, 4.2, 2.2], [34, 26, 4, 2.4], [9, 23, 3, 1.8], [31, 23, 3, 1.8]].map(([x, y, rx, ry]) => ell(x, y, rx, ry, '#4a4460', { stroke: '#2a2638', strokeWidth: 0.7 })).join('');
  return svg(40, 30, stones + stroke('M11 25 L29 22', '#3a2a1e', 3) + stroke('M12 22 L28 26', '#4a3224', 3) + circ(20, 22, 2, '#ff8a3c', { opacity: 0.35 }));
});
add('lamp', 26, 40, 'bottom', () => {
  const gl = glow(17, 11, 12, '#ffc060', 0.5);
  return svg(26, 40, gl.el + ell(9, 39, 5, 1.6, '#2a2638') + rect(8, 12, 2.4, 27, '#3a3448', { rx: 1 }) + stroke('M9.2 12 C9.2 6 13 5 17 6', '#3a3448', 1.8) + rect(14, 6, 6, 9, '#4a4058', { rx: 1.2, stroke: '#2a2638', strokeWidth: 0.6 }) + rect(15.3, 7.5, 3.4, 6, '#ffd27a', { rx: 0.8 }) + rect(15.3, 7.5, 3.4, 1.6, '#fff4dc', { opacity: 0.9 }) + circ(17, 5.5, 1.2, '#4a4058'), gl.def);
});
add('waystone', 18, 22, 'bottom', () => {
  const gl = glow(9, 10, 9, '#8ce0ff', 0.3);
  return svg(18, 22, gl.el + path('M4 22 L4 6 C4 2 14 2 14 6 L14 22 Z', '#4c4a5e', { stroke: '#2a2838', strokeWidth: 0.8 }) + stroke('M5.5 6.5 L5.5 20', '#6a6880', 0.9) + [[7, 6, 4], [7, 8.5, 2], [10.5, 8.5, 1], [7, 11, 4], [8, 13.5, 2], [7, 16, 3]].map(([x, y, w]) => rect(x, y, w, 1, '#8ce0ff', { opacity: 0.85 })).join(''), gl.def);
});
add('crystal', 20, 22, 'bottom', () => {
  const gl = glow(10, 11, 10, '#c9a0ff', 0.4);
  return svg(20, 22, gl.el + path('M2 22 L4 12 L7 22 Z', '#a070e0') + path('M5 22 L8 3 L12 22 Z', '#c9a0ff') + path('M5 22 L8 3 L9 22 Z', '#e6d3ff', { opacity: 0.8 }) + path('M11 22 L14 8 L17 22 Z', '#b088f0') + path('M11 22 L14 8 L15 22 Z', '#f3e0ff', { opacity: 0.7 }) + rect(7.5, 7, 1, 3, '#ffffff', { opacity: 0.8 }), gl.def);
});
add('puffcap', 18, 18, 'bottom', () => {
  const cg = rad('pc', 7, 6, 8, [[0, '#ff9ad8'], [1, '#a03a90']]);
  return svg(18, 18, rect(7, 9, 4, 9, '#d8d0e8', { rx: 1.5 }) + path('M1 9 C1 2 17 2 17 9 C13 7 5 7 1 9 Z', 'url(#pc)', { stroke: '#6a2a60', strokeWidth: 0.7 }) + [[5, 5.5], [9, 4], [13, 5.5]].map(([x, y]) => circ(x, y, 1.2, '#ffe0f4', { opacity: 0.8 })).join(''), cg);
});
add('gate', 16, 16, 'topleft', () => svg(16, 16, [2, 8, 13].map((x) => rect(x, 0, 2.6, 16, '#2a2230') + rect(x, 0, 1, 16, '#5a4a60')).join('') + rect(0, 6, 16, 2, '#3a3040') + rect(0, 6, 16, 0.6, '#6a5a70')));
add('house', 144, 100, 'bottomleft', () => {
  const r = rng(11); const windows = [];
  for (let i = 0; i < 3; i++) { const lit = r() < 0.6; windows.push(rect(32 + i * 34, 40, 14, 18, lit ? '#ffd68c' : '#0e1018', { rx: 1, opacity: lit ? 0.9 : 1 })); if (lit) { const gl = glow(39 + i * 34, 49, 22, '#ffbe64', 0.25); windows.push(gl.def + gl.el); } windows.push(stroke(`M${39 + i * 34} 40 L${39 + i * 34} 58 M${32 + i * 34} 49 L${46 + i * 34} 49`, '#2a2a3a', 0.8)); }
  return svg(144, 100, rect(0, 20, 144, 80, '#1a1e30') + path('M-4 22 L72 -2 L148 22 Z', '#242a44') + rect(0, 20, 144, 3, '#2e3452') + rect(8, 52, 14, 48, '#12151f', { rx: 1 }) + circ(18, 78, 1, '#8a8a60') + windows.join('') + rect(0.5, 20.5, 143, 79, 'none', { stroke: '#4a5478', strokeWidth: 1, opacity: 0.5 }) + rect(112, 8, 8, 14, '#242a44'));
});

// ---- interface
add('icon_petal', 14, 16, 'center', () => svg(14, 16, path('M7 1 C12 4.5 12 11 7 15 C2 11 2 4.5 7 1 Z', '#ff9ac0') + stroke('M7 3 L7 13', '#ffffff', 0.8, { opacity: 0.7 })));
add('icon_lantern', 18, 26, 'center', () => svg(18, 26, rect(5, 1, 8, 3, '#6a5a3a', { rx: 1 }) + stroke('M9 1 C6 -2 6 2 9 1', '#8a7a5a', 1) + rect(2, 4, 14, 20, '#0c0a16', { rx: 3, stroke: '#8a7a5a', strokeWidth: 1.2 }) + stroke('M9 4 L9 24', '#3a3050', 0.6, { opacity: 0.6 })));
add('logo', 420, 90, 'center', () => {
  const tg = lin('lg', 0, 20, 0, 70, [[0, '#fff6e6'], [0.5, '#ffe2b0'], [1, '#ffb347']]); const gl = glow(210, 46, 170, '#ffb347', 0.22); const gl2 = glow(210, 46, 70, '#ffd080', 0.35);
  // textLength pins the word to the box whatever serif the platform substitutes for Georgia
  const text = `<text x="210" y="62" text-anchor="middle" textLength="380" lengthAdjust="spacingAndGlyphs" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" font-size="46" fill="url(#lg)" stroke="#5a2a10" stroke-width="1.1">GLIMMERDEEP</text>`;
  const ember = path('M210 10 C216 16 215 24 210 28 C205 24 204 16 210 10 Z', '#ffb347', { opacity: 0.9 }) + path('M210 16 C212.5 19 212.3 23 210 25 C207.7 23 207.5 19 210 16 Z', '#fff4dc');
  const flourish = stroke('M40 76 C140 71 280 71 380 76', '#ffd080', 1.2, { opacity: 0.7 }) + circ(40, 76, 1.6, '#ffd080') + circ(380, 76, 1.6, '#ffd080');
  return svg(420, 90, gl.el + gl2.el + text + ember + flourish, tg + gl.def + gl2.def);
});

module.exports = sheet;
