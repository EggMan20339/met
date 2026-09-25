// Creatures of the hush: inky bodies, each carrying one dimmed or stolen light.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, rect, stroke, g, rot, glowEye, glow, shade } = L;
const INK = '#1a1526', INK2 = '#2a2238';
const sheet = {};
const add = (name, w, h, anchor, fn) => { sheet[name] = { w, h, anchor, make: fn }; };

// ---- Dimling: a squat beetle carrying a lantern bulb it can no longer light
const dimling = (frame) => {
  const W = 26, H = 20; const ph = frame === 'b' ? 1 : -1;
  const bodyG = lin('db', 4, 4, 22, 18, [[0, '#3d3352'], [0.5, '#2a2238'], [1, '#1a1526']]);
  const glassG = rad('dg', 13, 7, 6, [[0, '#ffd27a', 0.55], [0.7, '#c08a3c', 0.3], [1, '#5a4020', 0.6]]);
  const legs = [0, 1, 2].map((i) => stroke(`M${8 + i * 4} 15 L${6 + i * 4 + ph * 1.6} 19`, INK, 1.6) + stroke(`M${9 + i * 4} 15 L${11 + i * 4 - ph * 1.6} 19`, INK, 1.6)).join('');
  const body = ell(13, 12, 10, 6, 'url(#db)', { stroke: '#120e1c', strokeWidth: 0.9 });
  const seam = stroke('M13 6.5 L13 17.5', '#120e1c', 0.8, { opacity: 0.7 });
  const glass = path('M8.5 9 C9 4 17 4 17.5 9 Z', 'url(#dg)', { stroke: '#6a5028', strokeWidth: 0.7 });
  const rim = stroke('M5 9.5 C7 6.5 10 5.6 12 5.6', '#6a5c86', 0.9, { opacity: 0.8 });
  const head = circ(22, 13.5, 3.4, INK2, { stroke: '#120e1c', strokeWidth: 0.8 });
  const eyes = glowEye(23.2, 12.6, 0.9, '#ffb347') + glowEye(21.2, 14.2, 0.7, '#ffb347');
  const antenna = stroke('M23.5 10.5 C25 8 26 8.5 25.5 6', INK2, 0.8);
  return svg(W, H, legs + body + seam + glass + rim + head + eyes + antenna, bodyG + glassG);
};
add('dimling_a', 26, 20, 'bottom', () => dimling('a')); add('dimling_b', 26, 20, 'bottom', () => dimling('b'));

// ---- Hushmoth: a moth whose wing eye-spots are the only bright thing left on it
const hushmoth = (frame) => {
  const W = 26, H = 20; const up = frame === 'up'; const wy = up ? -4 : 3;
  const wingG = lin('hw', 0, 4, 0, 18, [[0, '#6b5e8e'], [1, '#3a3050']]);
  const wing = (m) => g([
    path(`M13 10 C${13 + m * 5} ${2 + wy} ${13 + m * 12} ${2 + wy} ${13 + m * 12} ${9 + wy * 0.6} C${13 + m * 12} ${14 + wy * 0.3} ${13 + m * 5} 15 13 12 Z`, 'url(#hw)', { stroke: '#2a2238', strokeWidth: 0.8 }),
    circ(13 + m * 8.2, 8.5 + wy * 0.5, 2.1, '#2a2238'), circ(13 + m * 8.2, 8.5 + wy * 0.5, 1.2, '#7fd7ff', { opacity: 0.9 }), circ(13 + m * 8.2, 8.5 + wy * 0.5, 0.5, '#ffffff'),
  ]);
  const body = ell(13, 11.5, 2.6, 5, '#2a2238', { stroke: '#120e1c', strokeWidth: 0.8 });
  const fuzz = ell(13, 8.5, 3.2, 2.2, '#4a3f66');
  const eyes = glowEye(12, 8, 0.7, '#7fd7ff') + glowEye(14.2, 8, 0.7, '#7fd7ff');
  const ant = stroke('M12 6 C10.5 3.5 9.5 3 8.5 3.5', '#4a3f66', 0.7) + stroke('M14 6 C15.5 3.5 16.5 3 17.5 3.5', '#4a3f66', 0.7);
  return svg(W, H, wing(-1) + wing(1) + body + fuzz + eyes + ant, wingG);
};
add('hushmoth_up', 26, 20, 'center', () => hushmoth('up')); add('hushmoth_down', 26, 20, 'center', () => hushmoth('down'));

// ---- Sporeling: a puffball on a stalk that spits what it swallowed
const sporeling = (frame) => {
  const W = 24, H = 28; const ch = frame === 'charge' ? 1 : 0; const r = 7 + ch * 1.5;
  const capG = rad('sc', 10, 9, 9, [[0, ch ? '#e6ff9a' : '#a8c86a'], [0.6, ch ? '#9ac84a' : '#5f8a3a'], [1, '#2f4a26']]);
  const stalk = stroke('M12 27 C11.5 22 12.5 19 12 15', '#4f7a3a', 3.2) + stroke('M12 27 C11.5 22 12.5 19 12 15', '#7fae5a', 1.2, { opacity: 0.6 });
  const leaves = path('M12 25 C7 25 4 22 3 19 C7 19 10 21 12 25 Z', '#3d6a2f') + path('M12 25 C17 25 20 22 21 19 C17 19 14 21 12 25 Z', '#3d6a2f');
  const cap = ell(12, 11, r + 1, r, 'url(#sc)', { stroke: '#243a1e', strokeWidth: 0.9 });
  const spots = [[7, 7, 1.3], [15.5, 6, 1.1], [17, 12, 0.9], [9, 14, 0.8]].map(([x, y, s]) => circ(x, y, s, '#dff5b0', { opacity: 0.7 })).join('');
  const mouth = ell(15, 12.5, 2.2 + ch * 1.6, 1.3 + ch * 2, '#1a2612') + (ch ? circ(15, 12.5, 1.4, '#c8ff5a', { opacity: 0.8 }) : '');
  const eye = glowEye(13.6, 8.6, 1.1, '#c8ff5a');
  const spores = [0, 1, 2].map((i) => circ(6 + i * 5, 2.5 + (i % 2), 0.8, '#c8ff5a', { opacity: 0.6 })).join('');
  return svg(W, H, stalk + leaves + cap + spots + mouth + eye + spores, capG);
};
add('sporeling_idle', 24, 28, 'bottom', () => sporeling('idle')); add('sporeling_charge', 24, 28, 'bottom', () => sporeling('charge'));

// ---- Rootram: a beast grown of roots with a bark head-plate and wooden horns
const rootram = (frame) => {
  const W = 34, H = 24; const ph = frame === 'b' ? 1 : frame === 'a' ? -1 : 0; const charge = frame === 'charge';
  const bodyG = lin('rb', 6, 4, 26, 22, [[0, '#6a4a30'], [0.5, '#4a2f1e'], [1, '#2a1a12']]);
  const legs = [0, 1, 2, 3].map((i) => stroke(`M${8 + i * 5} 18 L${7 + i * 5 + (i % 2 ? ph : -ph) * 2} 23.5`, '#2a1a12', 2.4)).join('');
  const body = path('M4 18 C3 8 10 5 18 5 L24 5 C29 5 31 9 31 14 L31 18 Z', 'url(#rb)', { stroke: '#1c110a', strokeWidth: 1 });
  const roots = stroke('M8 17 C6 15 5 12 7 9', '#8a5a34', 1) + stroke('M14 18 C13 14 15 11 14 7', '#8a5a34', 1) + stroke('M20 18 C21 14 19 10 21 6', '#8a5a34', 1);
  const plate = path(`M22 ${charge ? 8 : 6} L32 ${charge ? 12 : 9} L33 18 L23 18 Z`, charge ? '#a06a3a' : '#8a5a34', { stroke: '#3a2416', strokeWidth: 0.9 });
  const grain = stroke(`M25 ${charge ? 10 : 8} L31 ${charge ? 13 : 11}`, '#c48a5a', 0.6, { opacity: 0.6 }) + stroke('M25 14 L31 15.5', '#c48a5a', 0.6, { opacity: 0.6 });
  const horns = stroke(`M30 ${charge ? 9 : 7} C34 ${charge ? 5 : 3} 36 ${charge ? 10 : 8} 33 ${charge ? 12 : 10}`, '#e0c8a0', 2.2) + stroke('M30 12 C34 11 35 14 32 15', '#e0c8a0', 1.8);
  const eye = glowEye(29, charge ? 14.5 : 13, 1.2, charge ? '#ff3a2a' : '#ff6a4a');
  const dust = charge ? stroke('M2 14 L-4 13 M2 17 L-5 17.5 M2 20 L-3 21', '#ffffff', 0.9, { opacity: 0.4 }) : '';
  return svg(W, H, dust + legs + body + roots + plate + grain + horns + eye, bodyG);
};
add('rootram_a', 34, 24, 'bottom', () => rootram('a')); add('rootram_b', 34, 24, 'bottom', () => rootram('b')); add('rootram_charge', 34, 24, 'bottom', () => rootram('charge'));

// ---- Snuffer: a lantern that went out and learned to hunt; its eyes are the last two flames
const snuffer = (frame) => {
  const W = 22, H = 22; const bright = frame === 'tele';
  const gl = glow(11, 11, 10, bright ? '#ffe9b0' : '#ffd24a', bright ? 0.6 : 0.2);
  const cage = ell(11, 11.5, 6.5, 7.5, bright ? '#5a4a3a' : '#2a1e1e', { stroke: '#120c0c', strokeWidth: 0.9 });
  const bars = [-4, 0, 4].map((x) => stroke(`M${11 + x} 5 C${11 + x * 1.2} 9 ${11 + x * 1.2} 14 ${11 + x} 18`, '#120c0c', 0.7, { opacity: 0.8 })).join('');
  const cap = path('M6 6 C7 2.5 15 2.5 16 6 Z', '#3a2626', { stroke: '#120c0c', strokeWidth: 0.8 }) + circ(11, 2.6, 1.2, '#3a2626');
  const eyes = glowEye(8.6, 11, 1.3, bright ? '#ffe9b0' : '#ffd24a') + glowEye(13.4, 11, 1.3, bright ? '#ffe9b0' : '#ffd24a');
  const wisp = stroke('M11 18.5 C10 20.5 12 21 11 22', '#3a2626', 1.2);
  return svg(W, H, gl.el + cage + bars + cap + eyes + wisp, gl.def);
};
add('snuffer_idle', 22, 22, 'center', () => snuffer('idle')); add('snuffer_tele', 22, 22, 'center', () => snuffer('tele'));

// ---- Emberback: an armoured burrower; its shell is cracked and something still burns inside
const emberback = (frame) => {
  const W = 28, H = 20; const tuck = frame === 'shell'; const ph = frame === 'b' ? 1 : -1;
  const shellG = lin('eb', 4, 3, 24, 16, [[0, '#a05a30'], [0.5, '#6a3a20'], [1, '#3a2010']]);
  const legs = tuck ? '' : [0, 1, 2].map((i) => stroke(`M${8 + i * 5} 15 L${7 + i * 5 + ph * 1.8} 19.5`, '#2a1a10', 1.8)).join('');
  const belly = ell(13, 15 - tuck * 1, 9.5, 3.4 - tuck, '#5a4030');
  const shell = path(`M3 15 C3 ${5 + tuck * 2} 9 ${3 + tuck * 2} 14 ${3 + tuck * 2} C19 ${3 + tuck * 2} 25 ${5 + tuck * 2} 25 15 Z`, 'url(#eb)', { stroke: '#1c110a', strokeWidth: 1 });
  const plates = stroke('M9 4.5 L9 15 M14.5 3.5 L14.5 15 M20 4.5 L20 15', '#2a1a10', 0.8, { opacity: 0.7 });
  const cracks = stroke('M6 9 L8 11.5 L7 13.5 M11 6 L12.5 9 L11.5 12 M17 6 L16 9.5 L18 12 M22 9 L21 12', '#ff8a3c', 1.1) + stroke('M6 9 L8 11.5 M11 6 L12.5 9 M17 6 L16 9.5', '#ffe0a0', 0.6, { opacity: 0.8 });
  const head = tuck ? '' : g([ell(25.5, 14, 3.4, 2.8, '#3a2418', { stroke: '#1c110a', strokeWidth: 0.8 }), glowEye(26.6, 13.4, 0.9, '#ffb347')]);
  return svg(W, H, legs + belly + shell + plates + cracks + head, shellG);
};
add('emberback_a', 28, 20, 'bottom', () => emberback('a')); add('emberback_b', 28, 20, 'bottom', () => emberback('b')); add('emberback_shell', 28, 20, 'bottom', () => emberback('shell'));

// ---- Gloamwing: a bat with a lantern-glass belly full of stolen violet light
const gloamwing = (frame) => {
  const W = 32, H = 20; const up = frame === 'up'; const fire = frame === 'fire'; const wy = up ? -6 : 4;
  const wingG = lin('gw', 0, 2, 0, 18, [[0, '#4a3f6e'], [1, '#26203a']]);
  const belly = rad('gb', 16, 12, 5, [[0, fire ? '#ffffff' : '#c8b8ff', 0.95], [0.6, '#8a70e0', 0.7], [1, '#3a2a60', 0.5]]);
  const wing = (m) => path(`M16 9 C${16 + m * 6} ${4 + wy} ${16 + m * 13} ${3 + wy} ${16 + m * 15} ${8 + wy * 0.5} L${16 + m * 12} ${10 + wy * 0.4} L${16 + m * 9} ${12 + wy * 0.3} L${16 + m * 5} 12 Z`, 'url(#gw)', { stroke: '#181226', strokeWidth: 0.8 });
  const body = ell(16, 10, 4.2, 6, '#2a2238', { stroke: '#181226', strokeWidth: 0.8 });
  const glass = ell(16, 12, 3, 3.6, 'url(#gb)') + stroke('M13.4 10.5 C13.2 13 14 15 16 15.6', '#ffffff', 0.5, { opacity: 0.5 });
  const ears = path('M13.5 5 L12 1 L15 4 Z', '#2a2238') + path('M18.5 5 L20 1 L17 4 Z', '#2a2238');
  const eyes = glowEye(14.4, 6.5, 0.9, fire ? '#ffffff' : '#b0a0ff') + glowEye(17.6, 6.5, 0.9, fire ? '#ffffff' : '#b0a0ff');
  return svg(W, H, wing(-1) + wing(1) + body + glass + ears + eyes, wingG + belly);
};
add('gloamwing_up', 32, 20, 'center', () => gloamwing('up')); add('gloamwing_down', 32, 20, 'center', () => gloamwing('down')); add('gloamwing_fire', 32, 20, 'center', () => gloamwing('fire'));

// ---- Springfoot: a frog-thing with puffcap spores growing on its back, all legs
const springfoot = (frame) => {
  const W = 26, H = 22; const air = frame === 'air'; const crouch = frame === 'crouch';
  const bodyG = lin('sf', 6, 4, 20, 20, [[0, '#5a8a62'], [0.5, '#2f4a3a'], [1, '#1c2c24']]);
  const legs = air ? stroke('M7 15 L3 8 M19 15 L23 8', '#1f3428', 2.6) : crouch ? stroke('M7 16 L2 19 L6 21 M19 16 L24 19 L20 21', '#1f3428', 2.6) : stroke('M7 15 L3 19 L7 21 M19 15 L23 19 L19 21', '#1f3428', 2.6);
  const body = ell(13, 13, 8.5, 6.5 * (crouch ? 0.8 : air ? 1.15 : 1), 'url(#sf)', { stroke: '#142018', strokeWidth: 0.9 });
  const belly = ell(13, 15, 5, 2.6, '#9fd0a0', { opacity: 0.8 });
  const cap = path('M9 8 C9 4 17 4 17 8 C15 7 11 7 9 8 Z', '#c86a9a') + circ(11, 6.2, 0.8, '#ffd0e8') + circ(14.5, 5.6, 0.7, '#ffd0e8');
  const eyes = glowEye(9.5, 9.5, 1.5, '#ffe66a') + glowEye(16.5, 9.5, 1.5, '#ffe66a') + circ(9.9, 9.5, 0.7, '#1a1a1a') + circ(16.9, 9.5, 0.7, '#1a1a1a');
  return svg(W, H, legs + body + belly + cap + eyes, bodyG);
};
add('springfoot_idle', 26, 22, 'bottom', () => springfoot('idle')); add('springfoot_crouch', 26, 22, 'bottom', () => springfoot('crouch')); add('springfoot_air', 26, 22, 'bottom', () => springfoot('air'));

// ---- Lampwright Husk: an emptied lamplighter still walking its round, lamp on a pole
const husk = (frame) => {
  const W = 34, H = 36; const swingTele = frame === 'swing_tele', swing = frame === 'swing', lunge = frame === 'lunge', stagger = frame === 'stagger';
  const walk = frame === 'walk_b' ? 1 : frame === 'walk_a' ? -1 : 0;
  const coatG = lin('hc', 8, 6, 24, 30, [[0, '#4a4460'], [0.5, '#2c2838'], [1, '#1a1526']]);
  const lamp = glow(0, 0, 9, '#ffd27a', 0.5);
  const lean = lunge ? 18 : stagger ? -16 : 0;
  const legs = stroke(`M13 26 L${12 + walk * 2.5} 34.5 M19 26 L${20 - walk * 2.5} 34.5`, '#1a1526', 2.6);
  const coat = path('M10 27 C8 20 9 12 13 8 L19 8 C23 12 24 20 22 27 Z', 'url(#hc)', { stroke: '#120e1c', strokeWidth: 1 });
  const collar = path('M11 10 C13 7 19 7 21 10 L20 12 L12 12 Z', '#5a5470');
  const hood = path('M11 9 C11 3 21 3 21 9 C19 8 13 8 11 9 Z', '#3a3448', { stroke: '#120e1c', strokeWidth: 0.9 });
  const face = ell(16, 8.4, 3.4, 2.6, '#0c0a14');
  const eyes = glowEye(14.6, 8.4, 0.9, swingTele || lunge ? '#ff6a4a' : '#ffd080') + glowEye(17.6, 8.4, 0.9, swingTele || lunge ? '#ff6a4a' : '#ffd080');
  const buttons = circ(16, 15, 0.7, '#8a7a50') + circ(16, 19, 0.7, '#8a7a50') + circ(16, 23, 0.7, '#8a7a50');
  const poleA = swing ? 40 : swingTele ? -70 : lunge ? 10 : -25;
  const pole = g([stroke('M0 0 L18 0', '#6a5a3a', 1.8), rect(16, -3.5, 5, 7, '#3a3040', { rx: 1 }), rect(17.2, -2.2, 2.6, 4.4, '#ffd27a', { opacity: 0.9 }), g([lamp.el], { transform: 'translate(18.5 0)' })], { transform: `translate(21 17) ${rot(poleA, 0, 0)}` });
  const arm = stroke(`M21 16 L${21 + Math.cos(poleA * Math.PI / 180) * 5} ${16 + Math.sin(poleA * Math.PI / 180) * 5}`, '#2c2838', 2.8);
  const body = g([legs, coat, collar, buttons, hood, face, eyes, arm, pole], { transform: `${rot(lean, 16, 34)}` });
  return svg(W, H, body, coatG + lamp.def);
};
['walk_a', 'walk_b', 'idle', 'swing_tele', 'swing', 'lunge', 'stagger'].forEach((f) => add('husk_' + f, 34, 36, 'bottom', () => husk(f)));

module.exports = sheet;
