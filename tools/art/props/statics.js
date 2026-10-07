// The static props and interface art: the lamplighter house facade, the boss gate bars, the waystone, the two HUD icons
// and the title logo.
//
// These are stills, not puppets (no params, no control, no before()/after()): a mechanical port of the matching entries
// of the old tools/art/props.js to the op-based lib, drawing exactly the same pictures at the same sizes and anchors.
// Ops compose in (nested) arrays instead of string concatenation, a gradient object is passed straight in as a fill,
// glow() is one op, and the logo's word is a text() op. tools/make-art.js exports them as art/<name>.svg; the game
// draws the rasters through Art.draw (src/sprites.js drawDecorArt for 'h' house, 'L' waystone and 'G' gate, where the
// waystone's pulsing glowAt lives; src/ui.js for the icons and the logo).
const L = require('../lib');
const { svg, lin, path, circ, rect, stroke, text, glow, rng } = L;
const stills = {}; const add = (name, w, h, anchor, make) => { stills[name] = { w, h, anchor, make }; };

// ---- props
add('waystone', 18, 22, 'bottom', () => svg(18, 22, [
  glow(9, 10, 9, '#8ce0ff', 0.3),
  path('M4 22 L4 6 C4 2 14 2 14 6 L14 22 Z', '#4c4a5e', { stroke: '#2a2838', strokeWidth: 0.8 }),
  stroke('M5.5 6.5 L5.5 20', '#6a6880', 0.9),
  [[7, 6, 4], [7, 8.5, 2], [10.5, 8.5, 1], [7, 11, 4], [8, 13.5, 2], [7, 16, 3]].map(([x, y, w]) => rect(x, y, w, 1, '#8ce0ff', { opacity: 0.85 })),
]));
add('gate', 16, 16, 'topleft', () => svg(16, 16, [
  [2, 8, 13].map((x) => [rect(x, 0, 2.6, 16, '#2a2230'), rect(x, 0, 1, 16, '#5a4a60')]),
  rect(0, 6, 16, 2, '#3a3040'), rect(0, 6, 16, 0.6, '#6a5a70'),
]));
add('house', 144, 100, 'bottomleft', () => {
  const r = rng(11); const windows = [];
  for (let i = 0; i < 3; i++) { const lit = r() < 0.6; windows.push(rect(32 + i * 34, 40, 14, 18, lit ? '#ffd68c' : '#0e1018', { rx: 1, opacity: lit ? 0.9 : 1 })); if (lit) windows.push(glow(39 + i * 34, 49, 22, '#ffbe64', 0.25)); windows.push(stroke(`M${39 + i * 34} 40 L${39 + i * 34} 58 M${32 + i * 34} 49 L${46 + i * 34} 49`, '#2a2a3a', 0.8)); }
  return svg(144, 100, [
    rect(0, 20, 144, 80, '#1a1e30'), path('M-4 22 L72 -2 L148 22 Z', '#242a44'), rect(0, 20, 144, 3, '#2e3452'),
    rect(8, 52, 14, 48, '#12151f', { rx: 1 }), circ(18, 78, 1, '#8a8a60'),
    windows,
    rect(0.5, 20.5, 143, 79, 'none', { stroke: '#4a5478', strokeWidth: 1, opacity: 0.5 }), rect(112, 8, 8, 14, '#242a44'),
  ]);
});

// ---- interface
add('icon_petal', 14, 16, 'center', () => svg(14, 16, [path('M7 1 C12 4.5 12 11 7 15 C2 11 2 4.5 7 1 Z', '#ff9ac0'), stroke('M7 3 L7 13', '#ffffff', 0.8, { opacity: 0.7 })]));
add('icon_lantern', 18, 26, 'center', () => svg(18, 26, [
  rect(5, 1, 8, 3, '#6a5a3a', { rx: 1 }), stroke('M9 1 C6 -2 6 2 9 1', '#8a7a5a', 1),
  rect(2, 4, 14, 20, '#0c0a16', { rx: 3, stroke: '#8a7a5a', strokeWidth: 1.2 }), stroke('M9 4 L9 24', '#3a3050', 0.6, { opacity: 0.6 }),
]));
add('logo', 420, 90, 'center', () => {
  const tg = lin('lg', 0, 20, 0, 70, [[0, '#fff6e6'], [0.5, '#ffe2b0'], [1, '#ffb347']]);
  return svg(420, 90, [
    glow(210, 46, 170, '#ffb347', 0.22), glow(210, 46, 70, '#ffd080', 0.35),
    // textLength pins the word to the box whatever serif the platform substitutes for Georgia
    text(210, 62, 'GLIMMERDEEP', { textAnchor: 'middle', textLength: 380, lengthAdjust: 'spacingAndGlyphs', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 'bold', fontSize: 46, fill: tg, stroke: '#5a2a10', strokeWidth: 1.1 }),
    path('M210 10 C216 16 215 24 210 28 C205 24 204 16 210 10 Z', '#ffb347', { opacity: 0.9 }), path('M210 16 C212.5 19 212.3 23 210 25 C207.7 23 207.5 19 210 16 Z', '#fff4dc'),
    stroke('M40 76 C140 71 280 71 380 76', '#ffd080', 1.2, { opacity: 0.7 }), circ(40, 76, 1.6, '#ffd080'), circ(380, 76, 1.6, '#ffd080'),
  ]);
});

module.exports = { stills };
