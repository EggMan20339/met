// Painted parallax layers, two per area, tiling horizontally at 1024 px.
const L = require('./lib');
const { svg, lin, rad, path, ell, circ, rect, stroke, g, rng } = L;
const W = 1024, H = 640;
const sheet = {}; const add = (name, fn) => { sheet[name] = { w: W, h: H, anchor: 'topleft', make: fn }; };
// draw a shape three times so it wraps seamlessly across the 1024 px seam
const wrap = (el, x) => [-W, 0, W].map((o) => g([el], { transform: `translate(${o} 0)` })).join('');
const fog = (id, color, a) => rad(id, 0, 0, 1, [[0, color, a], [1, color, 0]]);

// ---- Rootshade: the underside of the sleeping tree, roots as thick as houses
add('bg_rootshade_far', () => {
  const r = rng(101); const out = []; const defs = lin('rsf', 0, 0, 0, H, [[0, '#2a2648'], [1, '#191632']]);
  for (let i = 0; i < 9; i++) { const x = r() * W, w = 40 + r() * 70, len = 260 + r() * 300, sway = (r() - 0.5) * 120; out.push(wrap(path(`M${x - w / 2} -10 C${x - w / 2 + sway * 0.3} ${len * 0.4} ${x + sway - w * 0.2} ${len * 0.8} ${x + sway} ${len} C${x + sway + w * 0.2} ${len * 0.8} ${x + w / 2 + sway * 0.3} ${len * 0.4} ${x + w / 2} -10 Z`, 'url(#rsf)', { opacity: 0.85 }))); }
  for (let i = 0; i < 30; i++) { const x = r() * W, y = 60 + r() * 500; out.push(wrap(circ(x, y, 1.2 + r() * 1.6, '#b8b0e0', { opacity: 0.15 + r() * 0.2 }))); }
  return svg(W, H, out.join(''), defs);
});
add('bg_rootshade_near', () => {
  const r = rng(102); const out = []; const defs = lin('rsn', 0, 0, 0, H, [[0, '#3a3558'], [1, '#221f3a']]);
  for (let i = 0; i < 6; i++) { const x = r() * W, w = 24 + r() * 40, len = 160 + r() * 260, sway = (r() - 0.5) * 80; out.push(wrap(path(`M${x - w / 2} -10 C${x - w / 2 + sway * 0.4} ${len * 0.5} ${x + sway - w * 0.15} ${len * 0.85} ${x + sway} ${len} C${x + sway + w * 0.15} ${len * 0.85} ${x + w / 2 + sway * 0.4} ${len * 0.5} ${x + w / 2} -10 Z`, 'url(#rsn)'))); for (let k = 0; k < 3; k++) { const t = 0.3 + r() * 0.6; out.push(wrap(stroke(`M${x + sway * t - w * 0.3} ${len * t} c${-20 - r() * 30} ${10 + r() * 30} ${-10} ${40 + r() * 40} ${-30 - r() * 20} ${60 + r() * 50}`, '#2c2848', 3 + r() * 3, { opacity: 0.9 }))); } }
  for (let i = 0; i < 7; i++) { const x = r() * W, y = 420 + r() * 220, w = 80 + r() * 160, h = 60 + r() * 120; out.push(wrap(path(`M${x - w / 2} ${H + 10} C${x - w / 2} ${y + h * 0.4} ${x - w * 0.2} ${y} ${x} ${y} C${x + w * 0.2} ${y} ${x + w / 2} ${y + h * 0.4} ${x + w / 2} ${H + 10} Z`, '#2a2646', { opacity: 0.95 }))); }
  return svg(W, H, out.join(''), defs);
});

// ---- Fernwake: fronds the size of sails, spores drifting up
const frond = (x, y, len, ang, color, r) => { const els = []; const ca = Math.cos(ang), sa = Math.sin(ang); const tipx = x + ca * len, tipy = y + sa * len; els.push(stroke(`M${x} ${y} Q${x + ca * len * 0.5 - sa * 30} ${y + sa * len * 0.5 + ca * 30} ${tipx} ${tipy}`, color, 3 + len * 0.02)); for (let k = 1; k < 9; k++) { const t = k / 9; const px = x + ca * len * t - sa * 30 * (1 - Math.abs(t - 0.5) * 2) * 0.5, py = y + sa * len * t + ca * 30 * (1 - Math.abs(t - 0.5) * 2) * 0.5; const ll = (1 - t) * len * 0.28 + 6; els.push(path(`M${px} ${py} Q${px - sa * ll * 0.7 - ca * ll * 0.2} ${py + ca * ll * 0.7 - sa * ll * 0.2} ${px - sa * ll * 1.1 + ca * ll * 0.5} ${py + ca * ll * 1.1 + sa * ll * 0.5} Q${px - sa * ll * 0.3 + ca * ll * 0.5} ${py + ca * ll * 0.3 + sa * ll * 0.5} ${px} ${py} Z`, color)); els.push(path(`M${px} ${py} Q${px + sa * ll * 0.7 - ca * ll * 0.2} ${py - ca * ll * 0.7 - sa * ll * 0.2} ${px + sa * ll * 1.1 + ca * ll * 0.5} ${py - ca * ll * 1.1 + sa * ll * 0.5} Q${px + sa * ll * 0.3 + ca * ll * 0.5} ${py - ca * ll * 0.3 + sa * ll * 0.5} ${px} ${py} Z`, color)); } return els.join(''); };
add('bg_fernwake_far', () => {
  const r = rng(201); const out = [];
  for (let i = 0; i < 10; i++) { const x = r() * W, y = H + 20; const ang = -Math.PI / 2 + (r() - 0.5) * 1.2; out.push(wrap(frond(x, y, 220 + r() * 220, ang, '#1e3a2a', r))); }
  for (let i = 0; i < 40; i++) out.push(wrap(circ(r() * W, r() * H, 1 + r() * 1.8, '#9be05f', { opacity: 0.12 + r() * 0.25 })));
  return svg(W, H, out.join(''));
});
add('bg_fernwake_near', () => {
  const r = rng(202); const out = [];
  for (let i = 0; i < 7; i++) { const x = r() * W, y = H + 30; const ang = -Math.PI / 2 + (r() - 0.5) * 1.4; out.push(wrap(frond(x, y, 320 + r() * 260, ang, i % 2 ? '#26482f' : '#1c3826', r))); }
  for (let i = 0; i < 8; i++) { const x = r() * W, y = r() * 200; out.push(wrap(stroke(`M${x} -10 C${x + (r() - 0.5) * 60} ${y + 80} ${x + (r() - 0.5) * 80} ${y + 160} ${x + (r() - 0.5) * 40} ${y + 260}`, '#2e5a34', 4 + r() * 4))); }
  return svg(W, H, out.join(''));
});

// ---- The Drownwell: drowned arches and weed, light wavering down through water
add('bg_drownwell_far', () => {
  const r = rng(301); const out = []; const defs = lin('dwf', 0, 0, 0, H, [[0, '#1a3050'], [1, '#0c1a2c']]);
  for (let i = 0; i < 7; i++) { const x = r() * W, w = 90 + r() * 120, y = 220 + r() * 260, h = 160 + r() * 240; out.push(wrap(path(`M${x - w / 2} ${H + 10} L${x - w / 2} ${y + h * 0.35} C${x - w / 2} ${y} ${x + w / 2} ${y} ${x + w / 2} ${y + h * 0.35} L${x + w / 2} ${H + 10} Z`, 'url(#dwf)', { opacity: 0.9 }))); out.push(wrap(path(`M${x - w * 0.32} ${H + 10} L${x - w * 0.32} ${y + h * 0.45} C${x - w * 0.32} ${y + h * 0.15} ${x + w * 0.32} ${y + h * 0.15} ${x + w * 0.32} ${y + h * 0.45} L${x + w * 0.32} ${H + 10} Z`, '#0a1626'))); }
  for (let i = 0; i < 6; i++) { const x = r() * W; out.push(wrap(path(`M${x - 40} -10 L${x + 40} -10 L${x + 90 + r() * 60} ${H} L${x - 90 - r() * 60} ${H} Z`, '#3a6a9a', { opacity: 0.05 + r() * 0.05 }))); }
  return svg(W, H, out.join(''), defs);
});
add('bg_drownwell_near', () => {
  const r = rng(302); const out = [];
  for (let i = 0; i < 16; i++) { const x = r() * W, len = 80 + r() * 260; out.push(wrap(stroke(`M${x} -10 C${x + (r() - 0.5) * 40} ${len * 0.4} ${x - (r() - 0.5) * 60} ${len * 0.7} ${x + (r() - 0.5) * 50} ${len}`, i % 3 ? '#16324a' : '#1e4460', 3 + r() * 5))); }
  for (let i = 0; i < 5; i++) { const x = r() * W, w = 30 + r() * 50, y = 300 + r() * 200; out.push(wrap(rect(x - w / 2, y, w, H - y + 10, '#0f2438', { rx: 3 }))); out.push(wrap(rect(x - w / 2 - 6, y - 8, w + 12, 10, '#163048', { rx: 2 }))); }
  for (let i = 0; i < 24; i++) out.push(wrap(circ(r() * W, r() * H, 1.5 + r() * 2.5, '#8ce0ff', { opacity: 0.08 + r() * 0.15 })));
  return svg(W, H, out.join(''));
});

// ---- Chimeglass Reach: spires of glass that ring when the wind moves
const spire = (x, y, w, h, c1, c2, o = 1) => path(`M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y} Z`, c1, { opacity: o }) + path(`M${x} ${y - h} L${x + w / 2} ${y} L${x + w * 0.1} ${y} Z`, c2, { opacity: o * 0.7 });
add('bg_chimeglass_far', () => {
  const r = rng(401); const out = [];
  for (let i = 0; i < 14; i++) { const x = r() * W, h = 160 + r() * 380, w = 30 + r() * 60; out.push(wrap(spire(x, H + 10, w, h, '#2e2446', '#3f3260', 0.9))); }
  for (let i = 0; i < 10; i++) { const x = r() * W, h = 100 + r() * 200, w = 20 + r() * 40; out.push(wrap(g([spire(x, -10, w, h, '#2e2446', '#3f3260', 0.85)], { transform: `translate(${x} ${-10}) scale(1 -1) translate(${-x} ${10})` }))); }
  for (let i = 0; i < 30; i++) out.push(wrap(circ(r() * W, r() * H, 1 + r() * 1.5, '#e6d3ff', { opacity: 0.1 + r() * 0.3 })));
  return svg(W, H, out.join(''));
});
add('bg_chimeglass_near', () => {
  const r = rng(402); const out = [];
  for (let i = 0; i < 9; i++) { const x = r() * W, h = 220 + r() * 320, w = 44 + r() * 70; out.push(wrap(spire(x, H + 10, w, h, '#3a2d58', '#5a4a80'))); const gl = L.glow(x, H - h * 0.5, 40 + r() * 40, '#c9a0ff', 0.12); out.push(gl.def + wrap(gl.el)); }
  for (let i = 0; i < 12; i++) { const x = r() * W, y = H - r() * 120, s = 10 + r() * 20; out.push(wrap(path(`M${x - s * 0.6} ${y} L${x} ${y - s * 2} L${x + s * 0.6} ${y} Z`, '#8a6ac0', { opacity: 0.9 }))); }
  return svg(W, H, out.join(''));
});

// ---- Bramblehush: thorn tangles and a thicket that grew over the road
const bramble = (x, y, len, r, color, w) => { let d = `M${x} ${y}`; let cx = x, cy = y; const els = []; for (let k = 0; k < 6; k++) { const nx = cx + (r() - 0.5) * len * 0.5, ny = cy - len * 0.16 - r() * 20; d += ` Q${cx + (r() - 0.5) * 40} ${cy - 10} ${nx} ${ny}`; if (k % 2) els.push(path(`M${nx} ${ny} l${4 + r() * 4} ${-6 - r() * 6} l${2} ${8} Z`, color)); cx = nx; cy = ny; } els.unshift(stroke(d, color, w)); return els.join(''); };
add('bg_bramblehush_far', () => {
  const r = rng(501); const out = []; const defs = lin('bhf', 0, 0, 0, H, [[0, '#1c261a'], [1, '#101610']]);
  for (let i = 0; i < 12; i++) { const x = r() * W; out.push(wrap(bramble(x, H + 10, 280 + r() * 260, r, '#1c2a1c', 6 + r() * 6))); }
  for (let i = 0; i < 6; i++) { const x = r() * W, w = 120 + r() * 200; out.push(wrap(path(`M${x - w / 2} ${H + 10} C${x - w / 4} ${H - 120 - r() * 150} ${x + w / 4} ${H - 120 - r() * 150} ${x + w / 2} ${H + 10} Z`, 'url(#bhf)'))); }
  return svg(W, H, out.join(''), defs);
});
add('bg_bramblehush_near', () => {
  const r = rng(502); const out = [];
  for (let i = 0; i < 9; i++) { const x = r() * W; out.push(wrap(bramble(x, H + 10, 320 + r() * 300, r, '#25381f', 8 + r() * 8))); }
  for (let i = 0; i < 9; i++) { const x = r() * W; out.push(wrap(bramble(x, -10, -(200 + r() * 200), r, '#1e2e1a', 6 + r() * 6))); }
  for (let i = 0; i < 18; i++) out.push(wrap(circ(r() * W, r() * H, 1 + r() * 1.5, '#c4d070', { opacity: 0.1 + r() * 0.25 })));
  return svg(W, H, out.join(''));
});

// ---- Puffcap Warrens: mushrooms like cathedrals, spores like snow
const cap = (x, y, w, h, c1, c2) => path(`M${x - w / 2} ${y} C${x - w / 2} ${y - h} ${x + w / 2} ${y - h} ${x + w / 2} ${y} C${x + w * 0.3} ${y - h * 0.15} ${x - w * 0.3} ${y - h * 0.15} ${x - w / 2} ${y} Z`, c1) + path(`M${x - w * 0.2} ${y - h * 0.86} C${x} ${y - h * 0.98} ${x + w * 0.2} ${y - h * 0.9} ${x + w * 0.25} ${y - h * 0.8}`, 'none', { stroke: c2, strokeWidth: 3, strokeLinecap: 'round', opacity: 0.6 });
add('bg_puffcap_far', () => {
  const r = rng(601); const out = [];
  for (let i = 0; i < 9; i++) { const x = r() * W, w = 120 + r() * 200, h = 60 + r() * 90, y = H - 100 - r() * 300; out.push(wrap(rect(x - w * 0.09, y - 2, w * 0.18, H - y + 10, '#2a2038'))); out.push(wrap(cap(x, y, w, h, '#3a2a4a', '#6a4a80'))); }
  for (let i = 0; i < 40; i++) out.push(wrap(circ(r() * W, r() * H, 1 + r() * 2, '#e0a8ff', { opacity: 0.1 + r() * 0.25 })));
  return svg(W, H, out.join(''));
});
add('bg_puffcap_near', () => {
  const r = rng(602); const out = [];
  for (let i = 0; i < 6; i++) { const x = r() * W, w = 200 + r() * 260, h = 90 + r() * 120, y = H - 40 - r() * 200; out.push(wrap(rect(x - w * 0.08, y - 2, w * 0.16, H - y + 10, '#33254a'))); out.push(wrap(cap(x, y, w, h, '#4a3260', '#8a5aa8'))); const gl = L.glow(x, y - h * 0.5, w * 0.5, '#d9a0f0', 0.1); out.push(gl.def + wrap(gl.el)); }
  for (let i = 0; i < 14; i++) { const x = r() * W, y = H - r() * 60; out.push(wrap(cap(x, y, 16 + r() * 24, 10 + r() * 14, '#c87ab8', '#ffd0f0'))); }
  return svg(W, H, out.join(''));
});

// ---- The Lanternry: the lamplighters' rooftops, most windows dark now
add('bg_lanternry_far', () => {
  const r = rng(701); const out = []; const defs = lin('lnf', 0, 0, 0, H, [[0, '#2a3454'], [1, '#161c30']]);
  for (let i = 0; i < 16; i++) { const x = r() * W, w = 50 + r() * 90, h = 120 + r() * 260, y = H - h; out.push(wrap(rect(x - w / 2, y, w, h + 10, 'url(#lnf)'))); out.push(wrap(path(`M${x - w / 2 - 6} ${y} L${x} ${y - 20 - r() * 30} L${x + w / 2 + 6} ${y} Z`, '#1c2440'))); if (r() < 0.5) out.push(wrap(rect(x + w * 0.2, y - 40, 8, 40, '#1c2440'))); for (let k = 0; k < 6; k++) { const wx = x - w / 2 + 10 + r() * (w - 20), wy = y + 20 + r() * (h - 40); const lit = r() < 0.18; out.push(wrap(rect(wx, wy, 6, 8, lit ? '#ffe0a0' : '#0e1220', { opacity: lit ? 0.7 : 1 }))); } }
  return svg(W, H, out.join(''), defs);
});
add('bg_lanternry_near', () => {
  const r = rng(702); const out = [];
  for (let i = 0; i < 5; i++) { const x = r() * W, y = 80 + r() * 160; const x2 = x + 200 + r() * 200; out.push(wrap(stroke(`M${x} ${y} Q${(x + x2) / 2} ${y + 60} ${x2} ${y + (r() - 0.5) * 40}`, '#1a1f33', 2))); for (let k = 1; k < 4; k++) { const t = k / 4; const lx = x + (x2 - x) * t, ly = y + 60 * 4 * t * (1 - t) * 0.5 + (r() - 0.5) * 10; out.push(wrap(stroke(`M${lx} ${ly} L${lx} ${ly + 14}`, '#1a1f33', 1.5))); const lit = r() < 0.4; out.push(wrap(rect(lx - 4, ly + 14, 8, 11, lit ? '#ffd27a' : '#2a2a3a', { rx: 1.5, opacity: lit ? 0.9 : 1 }))); if (lit) { const gl = L.glow(lx, ly + 19, 30, '#ffbe64', 0.25); out.push(gl.def + wrap(gl.el)); } } }
  for (let i = 0; i < 8; i++) { const x = r() * W, w = 90 + r() * 140, h = 200 + r() * 200; out.push(wrap(rect(x - w / 2, H - h, w, h + 10, '#20263e'))); out.push(wrap(path(`M${x - w / 2 - 8} ${H - h} L${x} ${H - h - 30 - r() * 30} L${x + w / 2 + 8} ${H - h} Z`, '#2a3050'))); }
  return svg(W, H, out.join(''));
});

// ---- Cinderthroat: columns of cooled ash and rivers of ember in the cracks
add('bg_cinderthroat_far', () => {
  const r = rng(801); const out = []; const defs = lin('ctf', 0, 0, 0, H, [[0, '#3a1c16'], [1, '#1c0c0a']]);
  for (let i = 0; i < 12; i++) { const x = r() * W, w = 50 + r() * 110, top = -10, h = 200 + r() * 460; out.push(wrap(path(`M${x - w / 2} ${top} L${x + w / 2} ${top} L${x + w * 0.35} ${top + h} L${x - w * 0.35} ${top + h} Z`, 'url(#ctf)', { opacity: 0.95 }))); }
  for (let i = 0; i < 14; i++) { const x = r() * W, y = 300 + r() * 340; out.push(wrap(stroke(`M${x} ${y} l${20 + r() * 40} ${-6 + r() * 12} l${20 + r() * 40} ${6 + r() * 12}`, '#ff6a2a', 1.5 + r() * 2, { opacity: 0.35 + r() * 0.35 }))); }
  return svg(W, H, out.join(''), defs);
});
add('bg_cinderthroat_near', () => {
  const r = rng(802); const out = [];
  for (let i = 0; i < 7; i++) { const x = r() * W, w = 80 + r() * 140, h = 260 + r() * 300; out.push(wrap(path(`M${x - w / 2} ${H + 10} L${x - w * 0.3} ${H - h} L${x + w * 0.3} ${H - h} L${x + w / 2} ${H + 10} Z`, '#2c1512'))); out.push(wrap(stroke(`M${x - w * 0.1} ${H - h + 20} L${x + (r() - 0.5) * 30} ${H - h * 0.5} L${x - (r() - 0.5) * 30} ${H}`, '#ff8a3c', 2, { opacity: 0.5 }))); const gl = L.glow(x, H - h * 0.4, 50 + r() * 50, '#ff6a2a', 0.12); out.push(gl.def + wrap(gl.el)); }
  for (let i = 0; i < 30; i++) out.push(wrap(circ(r() * W, r() * H, 0.8 + r() * 1.6, '#ffb070', { opacity: 0.15 + r() * 0.35 })));
  return svg(W, H, out.join(''));
});

module.exports = sheet;
