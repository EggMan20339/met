// Tiny SVG authoring helpers shared by the art templates.
const esc = (s) => String(s);
const attrs = (o) => Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => ` ${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}="${esc(v)}"`).join('');
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('');
const lin = (id, x1, y1, x2, y2, list) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops(list)}</linearGradient>`;
const rad = (id, cx, cy, r, list, fx, fy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${fx !== undefined ? ` fx="${fx}" fy="${fy}"` : ''} gradientUnits="userSpaceOnUse">${stops(list)}</radialGradient>`;
const blur = (id, sd) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`;
const path = (d, fill, o = {}) => `<path d="${d}" fill="${fill}"${attrs(o)}/>`;
const ell = (cx, cy, rx, ry, fill, o = {}) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${attrs(o)}/>`;
const circ = (cx, cy, r, fill, o = {}) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${attrs(o)}/>`;
const rect = (x, y, w, h, fill, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${attrs(o)}/>`;
const line = (x1, y1, x2, y2, stroke, w, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${attrs(o)}/>`;
const stroke = (d, color, w, o = {}) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${attrs(o)}/>`;
const g = (children, o = {}) => `<g${attrs(o)}>${children.join('')}</g>`;
const rot = (deg, cx, cy) => `rotate(${deg} ${cx} ${cy})`;
// deterministic rng for scatter
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// colour helpers
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (r, g2, b) => '#' + [r, g2, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const shade = (c, t) => (t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t));
// a soft glow disc (radial gradient)
let uid = 0; const id = (p) => `${p}${++uid}`;
const glow = (cx, cy, r, color, a = 0.5) => { const i = id('gl'); return { def: rad(i, cx, cy, r, [[0, color, a], [1, color, 0]]), el: circ(cx, cy, r, `url(#${i})`) }; };
// an eye with a glint
const eye = (cx, cy, rx, ry, color = '#1a1526', glint = true) => ell(cx, cy, rx, ry, color) + (glint ? circ(cx - rx * 0.35, cy - ry * 0.45, Math.max(0.5, rx * 0.3), '#ffffff') : '');
const glowEye = (cx, cy, r, color) => circ(cx, cy, r * 1.8, color, { opacity: 0.25 }) + circ(cx, cy, r, color) + circ(cx, cy, r * 0.45, '#ffffff', { opacity: 0.8 });
module.exports = { svg, lin, rad, blur, path, ell, circ, rect, line, stroke, g, rot, rng, mix, shade, glow, eye, glowEye, id, attrs };
