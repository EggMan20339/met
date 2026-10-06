// Scene-graph drawing helpers shared by every art template.
//
// Each helper returns a plain op object; templates compose ops in (nested) arrays and hand them to svg(w, h, ops),
// which returns a scene { w, h, ops }. A scene has two backends: toSvg(scene) serialises it to an SVG string for the
// art/ files, and the game's src/vec.js draws it straight onto a canvas every frame (that is how the characters
// animate: their templates are called with tweened parameters, see art/ANIMATION.md).
//
// Op fields mirror SVG attributes in camelCase: fill, stroke, strokeWidth, opacity, strokeLinecap, strokeLinejoin,
// strokeDasharray, transform (an SVG transform string such as 'translate(3 4) rotate(20 0 0) scale(1 -1)').
// A fill or stroke may be a colour string, 'none', or a gradient object from lin()/rad().
const path = (d, fill, o) => Object.assign({ t: 'path', d, fill }, o);
const ell = (cx, cy, rx, ry, fill, o) => Object.assign({ t: 'ell', cx, cy, rx, ry, fill }, o);
const circ = (cx, cy, r, fill, o) => Object.assign({ t: 'circ', cx, cy, r, fill }, o);
const rect = (x, y, w, h, fill, o) => Object.assign({ t: 'rect', x, y, w, h, fill }, o);
const line = (x1, y1, x2, y2, stroke, w, o) => Object.assign({ t: 'line', x1, y1, x2, y2, stroke, strokeWidth: w, strokeLinecap: 'round' }, o);
const stroke = (d, color, w, o) => Object.assign({ t: 'path', d, fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round' }, o);
const text = (x, y, str, o) => Object.assign({ t: 'text', x, y, str }, o);
const g = (children, o) => Object.assign({ t: 'g', children: flat(children) }, o);
const flat = (a) => { const out = []; const walk = (v) => { if (v == null || v === false || v === '') return; if (Array.isArray(v)) v.forEach(walk); else out.push(v); }; walk(a); return out; };
const svg = (w, h, ops) => ({ w, h, ops: flat(ops) });
// gradients: stops are [offset, colour, alpha?]; coordinates are in the user space of the op that uses them
const lin = (id, x1, y1, x2, y2, stops) => ({ t: 'lin', id, x1, y1, x2, y2, stops });
const rad = (id, cx, cy, r, stops, fx, fy) => ({ t: 'rad', id, cx, cy, r, stops, fx, fy });
const rot = (deg, cx = 0, cy = 0) => `rotate(${num(deg)} ${num(cx)} ${num(cy)})`;
const tr = (x, y) => `translate(${num(x)} ${num(y)})`;
const num = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);
// deterministic rng for scatter
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// colour helpers
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (r, g2, b) => '#' + [r, g2, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const shade = (c, t) => (t < 0 ? mix(c, '#000000', -t) : mix(c, '#ffffff', t));
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// a soft glow disc (radial gradient fading to transparent)
const glow = (cx, cy, r, color, a = 0.5) => circ(cx, cy, r, rad('gl', cx, cy, r, [[0, color, a], [1, color, 0]]));
// an eye with a glint; open 1 = round, 0 = a closed line; look shifts the pupil
const eye = (cx, cy, rx, ry, color = '#1a1526', glint = true, open = 1, look = 0) => {
  if (open < 0.12) return stroke(`M${num(cx - rx)} ${num(cy)} C${num(cx - rx * 0.4)} ${num(cy + ry * 0.45)} ${num(cx + rx * 0.4)} ${num(cy + ry * 0.45)} ${num(cx + rx)} ${num(cy)}`, color, Math.max(0.8, rx * 0.5));
  const px = cx + look * rx * 0.3;
  return [ell(px, cy, rx, ry * open, color), glint && open > 0.5 ? circ(px - rx * 0.35, cy - ry * open * 0.45, Math.max(0.5, rx * 0.3), '#ffffff') : null];
};
// a pupil-less glowing eye (hushed creatures); glowK scales the halo
const glowEye = (cx, cy, r, color, glowK = 1) => [circ(cx, cy, r * 1.8 * glowK, color, { opacity: 0.25 }), circ(cx, cy, r, color), circ(cx, cy, r * 0.45, '#ffffff', { opacity: 0.8 })];
// a smooth curve through points [{x,y},...] (Catmull-Rom converted to cubic Béziers)
const curve = (pts) => {
  if (pts.length < 2) return '';
  let d = `M${num(pts[0].x)} ${num(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${num(p1.x + (p2.x - p0.x) / 6)} ${num(p1.y + (p2.y - p0.y) / 6)} ${num(p2.x - (p3.x - p1.x) / 6)} ${num(p2.y - (p3.y - p1.y) / 6)} ${num(p2.x)} ${num(p2.y)}`;
  }
  return d;
};

// ---- SVG backend
const ATTR = { strokeWidth: 'stroke-width', strokeLinecap: 'stroke-linecap', strokeLinejoin: 'stroke-linejoin', strokeDasharray: 'stroke-dasharray', fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', textAnchor: 'text-anchor', letterSpacing: 'letter-spacing', lengthAdjust: 'lengthAdjust', textLength: 'textLength' };
const SKIP = new Set(['t', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'children', 'str']);
function toSvg(scene) {
  const defs = []; const ids = new Map(); let n = 0;
  const gradId = (gr) => { if (ids.has(gr)) return ids.get(gr); const id = `${gr.id || 'g'}${++n}`; ids.set(gr, id);
    const stops = gr.stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('');
    defs.push(gr.t === 'lin' ? `<linearGradient id="${id}" x1="${num(gr.x1)}" y1="${num(gr.y1)}" x2="${num(gr.x2)}" y2="${num(gr.y2)}" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`
      : `<radialGradient id="${id}" cx="${num(gr.cx)}" cy="${num(gr.cy)}" r="${num(gr.r)}"${gr.fx !== undefined ? ` fx="${num(gr.fx)}" fy="${num(gr.fy)}"` : ''} gradientUnits="userSpaceOnUse">${stops}</radialGradient>`);
    return id; };
  const paint = (v) => (v && typeof v === 'object' ? `url(#${gradId(v)})` : v);
  const attrs = (op) => { let s = ''; for (const k of Object.keys(op)) { if (SKIP.has(k)) continue; let v = op[k]; if (v === undefined || v === null || v === false) continue; if (k === 'fill' || k === 'stroke') v = paint(v); if (k === 'rx' && op.t === 'rect') {} s += ` ${ATTR[k] || k}="${num(v)}"`; } return s; };
  const el = (op) => {
    switch (op.t) {
      case 'g': return `<g${attrs(op)}>${op.children.map(el).join('')}</g>`;
      case 'path': return `<path d="${op.d}"${attrs(op)}/>`;
      case 'ell': return `<ellipse cx="${num(op.cx)}" cy="${num(op.cy)}" rx="${num(op.rx)}" ry="${num(op.ry)}"${attrs(op)}/>`;
      case 'circ': return `<circle cx="${num(op.cx)}" cy="${num(op.cy)}" r="${num(op.r)}"${attrs(op)}/>`;
      case 'rect': return `<rect x="${num(op.x)}" y="${num(op.y)}" width="${num(op.w)}" height="${num(op.h)}"${op.rx !== undefined ? ` rx="${num(op.rx)}"` : ''}${attrs(op)}/>`;
      case 'line': return `<line x1="${num(op.x1)}" y1="${num(op.y1)}" x2="${num(op.x2)}" y2="${num(op.y2)}"${attrs(op)}/>`;
      case 'text': return `<text x="${num(op.x)}" y="${num(op.y)}"${attrs(op)}>${op.str}</text>`;
    }
    return '';
  };
  const body = scene.ops.map(el).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.w} ${scene.h}" width="${scene.w}" height="${scene.h}">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${body}</svg>`;
}
module.exports = { svg, toSvg, lin, rad, path, ell, circ, rect, line, stroke, text, g, flat, rot, tr, num, rng, mix, shade, lerp, clamp, glow, eye, glowEye, curve };
