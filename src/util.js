// ---- Shared constants & helpers -------------------------------------------
const TILE = 16;
const VIEW_W = 480, VIEW_H = 270;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Deterministic hash in [0,1) from integer coords (used for procedural tile detail)
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}
function hash3(x, y, z) { return hash2(x + Math.imul(z | 0, 7919), y ^ Math.imul(z | 0, 104729)); }

// Small seeded RNG for backgrounds (mulberry32)
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function mixHex(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function shade(hex, amt) { // amt in [-1,1]
  const c = hexToRgb(hex).map((v) => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const IS_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';
