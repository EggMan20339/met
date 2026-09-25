// ---- HD vector renderer: organic terrain outlines, parallax, lighting ---------
// The world is simulated on a 16px tile grid but drawn as smooth vector shapes at native resolution.
const PALETTES = {
  rootshade:    { rock: '#3a3852', rockDeep: '#1b1a2c', edge: '#8a86b4', edgeGlow: '#5e5a86', top: '#a9a4cf', ceil: '#14121f', bg0: '#0d0c1a', bg1: '#262248', fog: '#33305a', dark: 0.3, light: '#c0b8ff', ambient: 'dust', decor: '#8a86b4', grass: null },
  fernwake: { rock: '#2f4530', rockDeep: '#15211a', edge: '#6a9a55', edgeGlow: '#3e6a3c', top: '#8fd45a', ceil: '#0f1a12', bg0: '#0a1610', bg1: '#1c3f2c', fog: '#265232', dark: 0.22, light: '#c8ffa0', ambient: 'spore', decor: '#7ccf5a', grass: '#9be05f' },
  drownwell:    { rock: '#233548', rockDeep: '#0f1826', edge: '#5f8fb8', edgeGlow: '#2f5478', top: '#7fb6dc', ceil: '#0a1220', bg0: '#060b14', bg1: '#11263c', fog: '#163048', dark: 0.42, light: '#8ce0ff', ambient: 'bubble', decor: '#4fc3f7', grass: null },
  chimeglass:   { rock: '#42365a', rockDeep: '#1f1830', edge: '#a888d8', edgeGlow: '#6a5292', top: '#d6b4ff', ceil: '#150f22', bg0: '#140c22', bg1: '#36265e', fog: '#41306e', dark: 0.24, light: '#ecc0ff', ambient: 'sparkle', decor: '#e6b3ff', grass: null },
  cinderthroat:     { rock: '#472c28', rockDeep: '#1f1210', edge: '#b06a48', edgeGlow: '#6e4436', top: '#f0a060', ceil: '#180c0a', bg0: '#180a08', bg1: '#3e1c16', fog: '#4e2820', dark: 0.32, light: '#ffb878', ambient: 'ember', decor: '#ff8a3c', grass: null },
  puffcap:   { rock: '#3a2e44', rockDeep: '#1a1420', edge: '#b07ac8', edgeGlow: '#6a4a80', top: '#d9a0f0', ceil: '#120c18', bg0: '#120a18', bg1: '#33204a', fog: '#3e2a58', dark: 0.3, light: '#e0a8ff', ambient: 'spore', decor: '#d9a0f0', grass: '#c88ce0' },
  bramblehush: { rock: '#33402e', rockDeep: '#161c14', edge: '#8aa05a', edgeGlow: '#4e6238', top: '#b8c86a', ceil: '#0e120c', bg0: '#0c1208', bg1: '#24301a', fog: '#2e3c22', dark: 0.28, light: '#e0ffa0', ambient: 'spore', decor: '#b8c86a', grass: '#c4d070' },
  lanternry:      { rock: '#2e3448', rockDeep: '#14182a', edge: '#7c8ab8', edgeGlow: '#4a5680', top: '#a8b4dc', ceil: '#0e1120', bg0: '#0b0e1c', bg1: '#222a4a', fog: '#2a3458', dark: 0.34, light: '#b8c8ff', ambient: 'rain', decor: '#8aa0d8', grass: null },
};
const SOLID_FOR_OUTLINE = (c) => c === '#' || c === 'D' || c === 'I';

// Build closed outline loops around connected regions of tiles (within a tile-bounds box) for which
// isIn(tx,ty) is true. Loops run clockwise (screen coords) with the region on the right. Segments on the
// box boundary that continue into open tiles are marked 'cut' (no rim drawn, region nudged outward so
// neighbouring chunks overlap without seams).
const CHUNK_T = 16;
function traceLoops(world, isIn, roundR, jitter, b) {
  const segs = new Map();
  const add = (x0, y0, x1, y1, kind, off) => { const k = x0 + ',' + y0; (segs.get(k) || segs.set(k, []).get(k)).push({ x0, y0, x1, y1, kind, off, used: false }); };
  const inB = (x, y) => x >= b.x0 && y >= b.y0 && x <= b.x1 && y <= b.y1;
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
    if (!isIn(x, y)) continue;
    const nb = (nx, ny, ax, ay, bx, by, kind, ox, oy) => {
      if (inB(nx, ny)) { if (!isIn(nx, ny)) add(ax, ay, bx, by, kind, null); }
      else if (!isIn(nx, ny)) add(ax, ay, bx, by, kind, null); else add(ax, ay, bx, by, 'cut', { x: ox, y: oy });
    };
    nb(x, y - 1, x, y, x + 1, y, 'ceil', 0, -1);
    nb(x + 1, y, x + 1, y, x + 1, y + 1, 'wall', 1, 0);
    nb(x, y + 1, x + 1, y + 1, x, y + 1, 'floor', 0, 1);
    nb(x - 1, y, x, y + 1, x, y, 'wall', -1, 0);
  }
  const loops = [];
  for (const list of segs.values()) for (const s of list) {
    if (s.used) continue;
    const pts = []; let cur = s; let guard = 0;
    while (cur && !cur.used && guard++ < 100000) {
      cur.used = true; pts.push({ x: cur.x0, y: cur.y0, kind: cur.kind, off: cur.off });
      const cands = (segs.get(cur.x1 + ',' + cur.y1) || []).filter((c) => !c.used);
      if (!cands.length) break;
      if (cands.length === 1) cur = cands[0];
      else { const dx = cur.x1 - cur.x0, dy = cur.y1 - cur.y0; let best = null, bestCross = -Infinity; for (const c of cands) { const cx = c.x1 - c.x0, cy = c.y1 - c.y0; const cross = dx * cy - dy * cx; if (cross > bestCross) { bestCross = cross; best = c; } } cur = best; }
    }
    if (pts.length >= 4) loops.push(buildLoop(pts, roundR, jitter));
  }
  return loops;
}
function buildLoop(pts, r, jitter) {
  const n = pts.length;
  // vertex i starts segment i; a vertex touching a cut segment (i or i-1) is sharp and nudged outward
  const P = pts.map((p, i) => {
    const prevSeg = pts[(i + n - 1) % n]; const cut = p.kind === 'cut' || prevSeg.kind === 'cut';
    const h1 = hash2(p.x * 3 + 1, p.y * 5 + 2) - 0.5, h2 = hash2(p.x * 7 + 3, p.y * 11 + 5) - 0.5;
    let x = p.x * TILE + h1 * 2 * jitter, y = p.y * TILE + h2 * 2 * jitter; const ux = x, uy = y;
    if (cut) { const o = p.kind === 'cut' ? p.off : prevSeg.off; x += o.x * 1.5; y += o.y * 1.5; }
    return { x, y, ux, uy, kind: p.kind, cut };
  });
  const corner = (i) => {
    const a = P[(i + n - 1) % n], bb = P[i], c = P[(i + 1) % n];
    if (bb.cut) return [{ x: bb.x, y: bb.y }, { x: bb.x, y: bb.y }];
    const l1 = Math.hypot(a.x - bb.x, a.y - bb.y), l2 = Math.hypot(c.x - bb.x, c.y - bb.y); const rr = Math.min(r, l1 / 2, l2 / 2);
    return [{ x: bb.x + (a.x - bb.x) / l1 * rr, y: bb.y + (a.y - bb.y) / l1 * rr }, { x: bb.x + (c.x - bb.x) / l2 * rr, y: bb.y + (c.y - bb.y) / l2 * rr }];
  };
  const C = P.map((_, i) => corner(i));
  const path = new Path2D(), floor = new Path2D(), ceil = new Path2D(), rim = new Path2D();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; let anyCut = false;
  // sub-paths (rims, floors, ceilings) end exactly on the chunk boundary, not on the nudged fill vertex, so neighbours do not double-stroke
  const U = (i) => (P[i].cut ? { x: P[i].ux, y: P[i].uy } : null);
  for (let i = 0; i < n; i++) {
    const bb = P[i], [p1, p2] = C[i]; minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y); maxX = Math.max(maxX, bb.x); maxY = Math.max(maxY, bb.y);
    if (i === 0) path.moveTo(p2.x, p2.y); else { path.lineTo(p1.x, p1.y); path.quadraticCurveTo(bb.x, bb.y, p2.x, p2.y); }
    const s0 = U(i) || p2, s1 = U((i + 1) % n) || C[(i + 1) % n][0];
    if (bb.kind === 'floor') { floor.moveTo(s0.x, s0.y); floor.lineTo(s1.x, s1.y); }
    else if (bb.kind === 'ceil') { ceil.moveTo(s0.x, s0.y); ceil.lineTo(s1.x, s1.y); }
    if (bb.kind === 'cut') anyCut = true;
  }
  path.lineTo(C[0][0].x, C[0][0].y); path.quadraticCurveTo(P[0].x, P[0].y, C[0][1].x, C[0][1].y); path.closePath();
  if (!anyCut) rim.addPath(path);
  else { // open polylines of non-cut segments, with rounded corners between consecutive ones
    let s0 = P.findIndex((p) => p.kind === 'cut');
    let open = false;
    for (let k = 1; k <= n; k++) {
      const i = (s0 + k) % n; const bb = P[i]; const prev = P[(i + n - 1) % n];
      if (bb.kind === 'cut') { open = false; continue; }
      const [p1, p2] = C[i]; const q1 = U((i + 1) % n) || C[(i + 1) % n][0]; const start = U(i) || p2;
      if (!open || prev.kind === 'cut') { rim.moveTo(start.x, start.y); open = true; } else { rim.lineTo(p1.x, p1.y); rim.quadraticCurveTo(bb.x, bb.y, p2.x, p2.y); }
      rim.lineTo(q1.x, q1.y);
    }
  }
  return { path, floor, ceil, rim, minX: minX - 10, minY: minY - 10, maxX: maxX + 10, maxY: maxY + 10 };
}

class Renderer {
  constructor(world) {
    this.world = world; this.bgs = {}; this.time = 0; this.zoom = 1; this.W = 1; this.H = 1;
    this.dark = document.createElement('canvas'); this.dctx = this.dark.getContext('2d');
    this.glow = document.createElement('canvas'); this.gctx = this.glow.getContext('2d');
    this.bgc = document.createElement('canvas'); this.bctx = this.bgc.getContext('2d');
    this.rock = document.createElement('canvas'); this.rctx = this.rock.getContext('2d');
    this.scratch = document.createElement('canvas'); this.scratch.width = 256; this.scratch.height = 256; this.sctx = this.scratch.getContext('2d');
    this.curArea = null; this.prevArea = null; this.areaFade = 1; this.neighbors = null; this.bgQueuedFor = null;
    this.textures = {}; this.rockGen = 0; this.rockKey = ''; this.rebuild();
  }
  setSize(W, H, zoom) { this.W = W; this.H = H; this.zoom = zoom; this.LS = 0.5; this.dark.width = Math.ceil(W * this.LS); this.dark.height = Math.ceil(H * this.LS); this.glow.width = this.dark.width; this.glow.height = this.dark.height; this.bgc.width = this.dark.width; this.bgc.height = this.dark.height; this.rock.width = W; this.rock.height = H; this.bgPx = Math.min(2, zoom * this.LS * this.bgFit(H / zoom)); }
  // painted backgrounds are 1024x640; scale them up when the view is taller than that
  bgFit(viewH) { return Math.max(1, (viewH * 1.06) / 640); }
  rebuild() {
    const w = this.world; this.chunks = new Map();
    this.crystalLoops = traceLoops(w, (x, y) => w.tile(x, y) === 'I', 3, 0.6, { x0: 0, y0: 0, x1: w.w - 1, y1: w.h - 1 });
  }
  chunkLoops(cx, cy) {
    const k = cx + ',' + cy; let L = this.chunks.get(k);
    if (!L) { const w = this.world; const b = { x0: cx * CHUNK_T, y0: cy * CHUNK_T, x1: Math.min(w.w - 1, cx * CHUNK_T + CHUNK_T - 1), y1: Math.min(w.h - 1, cy * CHUNK_T + CHUNK_T - 1) };
      L = traceLoops(w, (x, y) => x >= 0 && y >= 0 && x < w.w && y < w.h && !SOLID_FOR_OUTLINE(w.tile(x, y)), 5, 1.4, b); this.chunks.set(k, L); }
    return L;
  }
  visibleLoops(cam, viewW, viewH) {
    const out = []; const cx0 = Math.max(0, Math.floor(cam.x / TILE / CHUNK_T)), cy0 = Math.max(0, Math.floor(cam.y / TILE / CHUNK_T)), cx1 = Math.floor((cam.x + viewW) / TILE / CHUNK_T), cy1 = Math.floor((cam.y + viewH) / TILE / CHUNK_T);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) { if (cx * CHUNK_T >= this.world.w || cy * CHUNK_T >= this.world.h) continue; for (const L of this.chunkLoops(cx, cy)) if (L.maxX > cam.x && L.minX < cam.x + viewW && L.maxY > cam.y && L.minY < cam.y + viewH) out.push(L); }
    return out;
  }
  invalidateTiles(list) { this.rockGen = (this.rockGen || 0) + 1; const keys = new Set(); for (const [x, y] of list) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.add(Math.floor((x + dx) / CHUNK_T) + ',' + Math.floor((y + dy) / CHUNK_T)); for (const k of keys) this.chunks.delete(k); }
  texture(area) {
    if (this.textures[area]) return this.textures[area];
    const pal = PALETTES[area]; const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d'); let seed = 7; for (let i = 0; i < area.length; i++) seed = (seed * 131 + area.charCodeAt(i)) >>> 0; const rng = makeRng(seed);
    for (let i = 0; i < 900; i++) { const px = rng() * 512, py = rng() * 512, r = 3 + rng() * 30; const g = x.createRadialGradient(px, py, 0, px, py, r); const light = rng() < 0.45; g.addColorStop(0, rgba(light ? pal.edgeGlow : pal.rockDeep, light ? 0.4 : 0.55)); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { x.beginPath(); x.arc(px + ox, py + oy, r, 0, TAU); x.fill(); } }
    x.strokeStyle = rgba(pal.rockDeep, 0.35); x.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const px = rng() * 512, py = rng() * 512; x.beginPath(); x.moveTo(px, py); let cx = px, cy = py; for (let k = 0; k < 5; k++) { cx += (rng() - 0.5) * 40; cy += (rng() - 0.3) * 30; x.lineTo(cx, cy); } x.stroke(); }
    const pat = this.rctx.createPattern(c, 'repeat'); if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.5));
    return (this.textures[area] = pat);
  }
  // ---------- terrain
  drawTerrain(ctx, cam, viewW, viewH, t) {
    const rc = this.rctx, z = this.zoom, w = this.world; const W = this.W, H = this.H;
    const key = `${cam.x.toFixed(2)},${cam.y.toFixed(2)},${viewW},${viewH},${z},${W},${H},${this.rockGen}`;
    if (key === this.rockKey) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.rock, 0, 0); ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z); this.drawCrystals(ctx, cam, viewW, viewH); this.drawTiles(ctx, cam, viewW, viewH, t); return; }
    this.rockKey = key;
    rc.setTransform(1, 0, 0, 1, 0, 0); rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, W, H);
    const tf = () => rc.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    // 1. fill rock per area (so each region carries its own palette)
    for (const a of w.map.areas) for (const r of a.rects) {
      const rx = r[0] * TILE, ry = r[1] * TILE, rw = r[2] * TILE, rh = r[3] * TILE;
      if (rx > cam.x + viewW || rx + rw < cam.x || ry > cam.y + viewH || ry + rh < cam.y) continue;
      const pal = PALETTES[a.id]; rc.save(); tf(); rc.beginPath(); rc.rect(rx, ry, rw, rh); rc.clip();
      const g = rc.createLinearGradient(0, cam.y - 40, 0, cam.y + viewH + 40); g.addColorStop(0, pal.rock); g.addColorStop(1, mixHex(pal.rock, pal.rockDeep, 0.7));
      rc.fillStyle = g; rc.fillRect(cam.x - 8, cam.y - 8, viewW + 16, viewH + 16);
      rc.fillStyle = this.texture(a.id); rc.globalAlpha = 0.9; rc.fillRect(cam.x - 8, cam.y - 8, viewW + 16, viewH + 16); rc.globalAlpha = 1;
      rc.restore();
    }
    // default palette for anything outside the area rects
    rc.save(); tf(); rc.globalCompositeOperation = 'destination-over'; rc.fillStyle = PALETTES.rootshade.rockDeep; rc.fillRect(cam.x - 8, cam.y - 8, viewW + 16, viewH + 16); rc.restore();
    // 2. cut out the air
    tf(); rc.globalCompositeOperation = 'destination-out'; rc.fillStyle = '#000';
    const vis = this.visibleLoops(cam, viewW, viewH);
    for (const L of vis) rc.fill(L.path);
    // 3. rims, surfaces and ceilings painted only onto remaining rock, coloured per area via clipping
    rc.globalCompositeOperation = 'source-atop'; rc.lineJoin = 'round'; rc.lineCap = 'round';
    for (const a of w.map.areas) for (const r of a.rects) {
      const rx = r[0] * TILE, ry = r[1] * TILE, rw = r[2] * TILE, rh = r[3] * TILE;
      if (rx > cam.x + viewW || rx + rw < cam.x || ry > cam.y + viewH || ry + rh < cam.y) continue;
      const pal = PALETTES[a.id]; rc.save(); tf(); rc.beginPath(); rc.rect(rx, ry, rw, rh); rc.clip();
      for (const L of vis) {
        if (L.maxX < rx || L.minX > rx + rw || L.maxY < ry || L.minY > ry + rh) continue;
        rc.strokeStyle = rgba(pal.edgeGlow, 0.5); rc.lineWidth = 18; rc.stroke(L.rim);
        rc.strokeStyle = rgba(pal.rockDeep, 0.55); rc.lineWidth = 9; rc.stroke(L.ceil);
        rc.strokeStyle = pal.edge; rc.lineWidth = 2.2; rc.stroke(L.rim);
        rc.strokeStyle = pal.top; rc.lineWidth = 5; rc.stroke(L.floor);
        if (pal.grass) { rc.strokeStyle = rgba(pal.grass, 0.8); rc.lineWidth = 2.5; rc.stroke(L.floor); }
      }
      rc.restore();
    }
    rc.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.rock, 0, 0);
    // 4. crystal masses and per-tile details in world space
    ctx.setTransform(z, 0, 0, z, -cam.x * z, -cam.y * z);
    this.drawCrystals(ctx, cam, viewW, viewH);
    this.drawTiles(ctx, cam, viewW, viewH, t);
  }
  drawCrystals(ctx, cam, viewW, viewH) {
    for (const L of this.crystalLoops) {
      if (!(L.maxX > cam.x && L.minX < cam.x + viewW && L.maxY > cam.y && L.minY < cam.y + viewH)) continue;
      const g = ctx.createLinearGradient(L.minX, L.minY, L.maxX, L.maxY); g.addColorStop(0, 'rgba(190,235,255,0.92)'); g.addColorStop(0.5, 'rgba(90,160,220,0.9)'); g.addColorStop(1, 'rgba(160,210,255,0.92)');
      ctx.fillStyle = g; ctx.fill(L.path); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.stroke(L.path);
      ctx.save(); ctx.clip(L.path); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = L.minX - 40; x < L.maxX + 40; x += 14) { ctx.moveTo(x, L.minY); ctx.lineTo(x + 30, L.maxY); } ctx.stroke();
      const sh = ctx.createLinearGradient(0, L.minY, 0, L.maxY); sh.addColorStop(0, 'rgba(255,255,255,0.25)'); sh.addColorStop(1, 'rgba(10,30,80,0.35)'); ctx.fillStyle = sh; ctx.fillRect(L.minX, L.minY, L.maxX - L.minX, L.maxY - L.minY); ctx.restore();
    }
  }
  drawTiles(ctx, cam, viewW, viewH, t) {
    const w = this.world; const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1), y0 = Math.max(0, Math.floor(cam.y / TILE) - 2), x1 = Math.min(w.w - 1, Math.ceil((cam.x + viewW) / TILE) + 1), y1 = Math.min(w.h - 1, Math.ceil((cam.y + viewH) / TILE) + 2);
    const S = (x, y) => SOLID_FOR_OUTLINE(w.tile(x, y));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = w.tile(tx, ty); const px = tx * TILE, py = ty * TILE; const area = w.areaAt(tx, ty); const pal = PALETTES[area];
      if (ch === 'D') { // cracked wall
        const h = hash2(tx, ty); ctx.strokeStyle = 'rgba(240,226,255,0.55)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(px + 2 + h * 4, py + 1); ctx.lineTo(px + 7, py + 5 + h * 3); ctx.lineTo(px + 5 + h * 2, py + 10); ctx.lineTo(px + 9, py + 15);
        ctx.moveTo(px + 7, py + 5 + h * 3); ctx.lineTo(px + 13, py + 3 + h * 3); ctx.moveTo(px + 5 + h * 2, py + 10); ctx.lineTo(px + 1, py + 12 + h * 2); ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.05 + Math.sin(t * 2 + h * 6) * 0.03})`; ctx.fillRect(px, py, TILE, TILE);
      } else if (ch === '^') {
        let dir = 'up'; if (S(tx, ty - 1) && !S(tx, ty + 1)) dir = 'down'; else if (S(tx - 1, ty) && !S(tx, ty + 1) && !S(tx, ty - 1)) dir = 'right'; else if (S(tx + 1, ty) && !S(tx, ty + 1) && !S(tx, ty - 1)) dir = 'left';
        ctx.save(); ctx.translate(px + 8, py + 8); ctx.rotate(dir === 'down' ? Math.PI : dir === 'right' ? Math.PI / 2 : dir === 'left' ? -Math.PI / 2 : 0);
        ctx.fillStyle = '#4c5060'; ctx.beginPath(); ctx.roundRect(-8, 5, 16, 3, 1); ctx.fill();
        for (let i = 0; i < 3; i++) { const bx = -8 + i * 5.5 + 2.7; const hh = 10 + hash3(tx, ty, i) * 3; ctx.fillStyle = '#d8dce8'; ctx.beginPath(); ctx.moveTo(bx - 2.6, 6); ctx.quadraticCurveTo(bx - 0.5, -hh * 0.4, bx, 6 - hh); ctx.quadraticCurveTo(bx + 0.5, -hh * 0.4, bx + 2.6, 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#6f7488'; ctx.beginPath(); ctx.moveTo(bx, 6 - hh); ctx.quadraticCurveTo(bx + 0.5, -hh * 0.4, bx + 2.6, 6); ctx.lineTo(bx + 0.4, 6); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      } else if (ch === '~') {
        const top = w.tile(tx, ty - 1) !== '~';
        const g = ctx.createLinearGradient(0, py, 0, py + TILE); g.addColorStop(0, top ? 'rgba(40,60,140,0.75)' : 'rgba(8,10,40,0.9)'); g.addColorStop(1, 'rgba(4,5,22,0.95)'); ctx.fillStyle = g; ctx.fillRect(px, py - (top ? 1 : 0), TILE, TILE + 1);
        if (top) { ctx.strokeStyle = 'rgba(140,170,255,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); for (let i = 0; i <= 16; i += 4) { const yy = py + 1 + Math.sin(t * 2.2 + (px + i) * 0.35) * 1.2; if (i === 0) ctx.moveTo(px + i, yy); else ctx.lineTo(px + i, yy); } ctx.stroke(); ctx.fillStyle = 'rgba(160,190,255,0.25)'; ctx.fillRect(px, py + 2, TILE, 2); }
        if (hash2(tx, ty) < 0.2) { const bx = px + 4 + hash3(tx, ty, 2) * 8, by = py + ((t * 9 + hash3(tx, ty, 3) * 16) % 16); ctx.fillStyle = 'rgba(120,150,255,0.35)'; ctx.beginPath(); ctx.arc(bx, py + 16 - (by - py), 1, 0, TAU); ctx.fill(); }
      } else if (ch === '=') {
        const g = ctx.createLinearGradient(0, py, 0, py + 5); g.addColorStop(0, pal.top); g.addColorStop(1, pal.edgeGlow); ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(px - 1, py, TILE + 2, 4.5, 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px, py + 4, TILE, 1.2); ctx.fillStyle = pal.edgeGlow; ctx.beginPath(); ctx.roundRect(px + 2, py + 4, 2, 4, 1); ctx.roundRect(px + 12, py + 4, 2, 4, 1); ctx.fill();
      } else if (ch === '%') { // bounce shroom cap
        const sq = 1 + Math.sin(t * 5 + tx) * 0.04;
        if (Art.ready && Art.draw(ctx, 'puffcap', px + 8, py + 16, { sx: 1 / sq, sy: sq })) continue;
        ctx.save(); ctx.translate(px + 8, py + 16); ctx.scale(1 / sq, sq);
        ctx.fillStyle = '#d8d0e8'; ctx.fillRect(-2, -8, 4, 8); const g = ctx.createRadialGradient(-2, -12, 1, 0, -10, 10); g.addColorStop(0, '#ff9ad8'); g.addColorStop(1, '#a03a90'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -10, 9, 5.5, 0, Math.PI, 0); ctx.quadraticCurveTo(0, -6, -9, -10); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-5 + i * 4.5, -12 + (i % 2), 1.1, 0, TAU); ctx.fill(); } ctx.restore();
      } else if (ch === '.') this.drawDecor(ctx, tx, ty, px, py, area, pal, t);
    }
  }
  drawDecor(ctx, tx, ty, px, py, area, pal, t) {
    const w = this.world; const h = hash2(tx, ty); const S = (x, y) => SOLID_FOR_OUTLINE(w.tile(x, y));
    const onFloor = S(tx, ty + 1) && w.tile(tx, ty + 1) !== 'I', onCeil = S(tx, ty - 1) && w.tile(tx, ty - 1) !== 'I';
    const sway = Math.sin(t * 1.4 + tx * 0.7) * 1.2;
    if (area === 'fernwake' || area === 'bramblehush' || area === 'puffcap') {
      const g1 = pal.grass || '#9be05f', g2 = shade(g1, -0.35);
      if (onFloor && h < 0.75) { ctx.lineWidth = 1.2; ctx.lineCap = 'round'; for (let i = 0; i < 5; i++) { const bx = px + 1.5 + i * 3.4 + hash3(tx, ty, i) * 2; const bh = 3 + hash3(tx, ty, i + 9) * 6; ctx.strokeStyle = hash3(tx, ty, i + 20) < 0.5 ? g1 : g2; ctx.beginPath(); ctx.moveTo(bx, py + TILE + 1); ctx.quadraticCurveTo(bx + sway * 0.5, py + TILE - bh * 0.6, bx + sway + (hash3(tx, ty, i + 3) - 0.5) * 3, py + TILE - bh); ctx.stroke(); } }
      if (onCeil && h < 0.22) { const len = 8 + hash3(tx, ty, 7) * 30; ctx.strokeStyle = g2; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px + 8, py - 1); ctx.quadraticCurveTo(px + 8 + sway * 2, py + len * 0.5, px + 8 + sway * 3 + (hash3(tx, ty, 8) - 0.5) * 8, py + len); ctx.stroke(); ctx.fillStyle = g1; for (let i = 4; i < len; i += 6) { ctx.beginPath(); ctx.ellipse(px + 8 + sway * (i / len) * 3 + (i % 12 ? 2 : -2), py + i, 2.2, 1.1, i % 12 ? 0.6 : -0.6, 0, TAU); ctx.fill(); } }
      if (onFloor && h > 0.93) { const mc = area === 'puffcap' ? '#ff9ad8' : '#e8ffb0'; ctx.fillStyle = shade(mc, -0.4); ctx.fillRect(px + 7, py + 11, 2.5, 5); ctx.fillStyle = mc; ctx.beginPath(); ctx.ellipse(px + 8, py + 11, 4.5, 2.8, 0, Math.PI, 0); ctx.fill(); }
    } else if (area === 'rootshade' || area === 'lanternry') {
      if (onFloor && h < 0.16) { ctx.fillStyle = pal.edgeGlow; ctx.beginPath(); ctx.moveTo(px + 4, py + TILE + 1); ctx.quadraticCurveTo(px + 7, py + TILE - 6 - h * 40, px + 8, py + TILE - 6 - h * 45); ctx.quadraticCurveTo(px + 9, py + TILE - 6 - h * 40, px + 12, py + TILE + 1); ctx.fill(); }
      if (onCeil && h > 0.86) { ctx.fillStyle = pal.edgeGlow; ctx.beginPath(); ctx.moveTo(px + 4, py - 1); ctx.quadraticCurveTo(px + 7, py + 5 + (h - 0.86) * 60, px + 8, py + 6 + (h - 0.86) * 70); ctx.quadraticCurveTo(px + 9, py + 5, px + 12, py - 1); ctx.fill(); }
      if (onFloor && h > 0.5 && h < 0.58) { ctx.fillStyle = rgba(pal.edge, 0.7); ctx.beginPath(); ctx.ellipse(px + 5, py + 15, 2.5, 1.4, 0, 0, TAU); ctx.ellipse(px + 11, py + 15.5, 1.6, 1, 0, 0, TAU); ctx.fill(); }
      if (area === 'lanternry' && onCeil && h > 0.6 && h < 0.66) { ctx.strokeStyle = 'rgba(180,200,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 8, py); ctx.lineTo(px + 8, py + 4 + ((t * 40 + h * 100) % 14)); ctx.stroke(); }
    } else if (area === 'drownwell') {
      if (onCeil && h < 0.3) { const dl = (t * 30 + h * 80) % 40; ctx.strokeStyle = 'rgba(140,224,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px + 6 + h * 12, py); ctx.lineTo(px + 6 + h * 12, py + 3 + h * 10); ctx.stroke(); if (dl < 24) { ctx.fillStyle = 'rgba(140,224,255,0.7)'; ctx.beginPath(); ctx.arc(px + 6 + h * 12, py + 4 + h * 10 + dl, 0.9, 0, TAU); ctx.fill(); } }
      if (onFloor && h > 0.84) { ctx.fillStyle = '#2b6a86'; ctx.fillRect(px + 5, py + 11, 2, 5); ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.ellipse(px + 6, py + 11, 3.5, 2.2, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#9ce8ff'; ctx.beginPath(); ctx.ellipse(px + 11, py + 14, 2, 1.4, 0, Math.PI, 0); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(79,195,247,${0.12 + Math.sin(t * 3 + h * 9) * 0.06})`; ctx.beginPath(); ctx.arc(px + 7, py + 10, 9, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    } else if (area === 'chimeglass') {
      if ((onFloor || onCeil) && h < 0.24) { const up = onFloor; ctx.save(); ctx.translate(px + 8, up ? py + TILE + 0.5 : py - 0.5); if (!up) ctx.scale(1, -1); const hh = 6 + h * 32; const g = ctx.createLinearGradient(-4, 0, 6, 0); g.addColorStop(0, '#c9a0ff'); g.addColorStop(0.5, '#f3e0ff'); g.addColorStop(1, '#8a5ad0'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, -hh); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(4, -hh * 0.6); ctx.lineTo(6, 0); ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(230,190,255,${0.1 + Math.sin(t * 2 + h * 20) * 0.05})`; ctx.beginPath(); ctx.arc(0, -hh * 0.4, hh * 0.7, 0, TAU); ctx.fill(); ctx.restore(); }
    } else if (area === 'cinderthroat') {
      if (onFloor && h < 0.25) { ctx.strokeStyle = `rgba(255,138,60,${0.6 + Math.sin(t * 4 + h * 30) * 0.3})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(px + 1 + h * 20, py + 15); ctx.lineTo(px + 6 + h * 24, py + 15.5); ctx.lineTo(px + 10 + h * 20, py + 15); ctx.stroke(); }
      if (onFloor && h > 0.82) { ctx.fillStyle = '#5a3a30'; ctx.beginPath(); ctx.ellipse(px + 8, py + 15, 5, 2.2, 0, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#3a2422'; ctx.beginPath(); ctx.ellipse(px + 7, py + 13.5, 2.5, 1.2, 0, Math.PI, 0); ctx.fill(); }
      if (onCeil && h > 0.9) { ctx.fillStyle = pal.edgeGlow; ctx.beginPath(); ctx.moveTo(px + 5, py - 1); ctx.quadraticCurveTo(px + 8, py + 4, px + 8, py + 7); ctx.quadraticCurveTo(px + 8, py + 4, px + 11, py - 1); ctx.fill(); }
    }
  }
  // ---------- backgrounds
  getBg(area) {
    if (this.bgs[area]) return this.bgs[area];
    const pal = PALETTES[area]; const rng = makeRng(area.length * 977 + area.charCodeAt(0) * 31);
    const W = 1024, H = 1280, S = 2; const layers = [];
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const far = mk(); { const c = far.getContext('2d'); for (let i = 0; i < 30; i++) { const x = rng() * W, y = rng() * H, r = (40 + rng() * 100) * S; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(pal.fog, 0.7)); g.addColorStop(1, rgba(pal.fog, 0)); c.fillStyle = g; for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { c.beginPath(); c.arc(x + ox, y + oy, r, 0, TAU); c.fill(); } } }
    const silhouette = (alpha, count, scale) => { const cv = mk(); const c = cv.getContext('2d'); c.fillStyle = rgba(mixHex(pal.rockDeep, pal.bg0, 0.4), alpha);
      for (let i = 0; i < count; i++) { const x = rng() * W, base = rng() * H, w = (20 + rng() * 60) * scale * S, h = (60 + rng() * 260) * scale * S; const up = rng() < 0.5;
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { c.beginPath(); const bx = x + ox, by = base + oy; if (up) { c.moveTo(bx - w / 2, by); c.quadraticCurveTo(bx - w / 4, by - h * 0.7, bx, by - h); c.quadraticCurveTo(bx + w / 4, by - h * 0.7, bx + w / 2, by); } else { c.moveTo(bx - w / 2, by); c.quadraticCurveTo(bx - w / 4, by + h * 0.7, bx, by + h); c.quadraticCurveTo(bx + w / 4, by + h * 0.7, bx + w / 2, by); } c.closePath(); c.fill(); } }
      if (area === 'fernwake' || area === 'bramblehush') { c.strokeStyle = rgba('#2e5a2e', alpha); c.lineWidth = 3 * scale; for (let i = 0; i < 50; i++) { const x = rng() * W, y = rng() * H, l = (20 + rng() * 80) * S; for (const ox of [-W, 0, W]) { c.beginPath(); c.moveTo(x + ox, y); c.quadraticCurveTo(x + ox + (rng() - 0.5) * 60, y + l / 2, x + ox + (rng() - 0.5) * 40, y + l); c.stroke(); } } }
      if (area === 'chimeglass' || area === 'puffcap') { for (let i = 0; i < 34; i++) { const x = rng() * W, y = rng() * H, s = (3 + rng() * 6) * scale * S; c.fillStyle = rgba(pal.decor, alpha * 0.5); for (const ox of [-W, 0, W]) { c.beginPath(); c.moveTo(x + ox, y - s * 2); c.lineTo(x + ox + s, y); c.lineTo(x + ox, y + s * 2); c.lineTo(x + ox - s, y); c.closePath(); c.fill(); } } }
      if (area === 'cinderthroat') { c.fillStyle = rgba('#ff7a30', alpha * 0.35); for (let i = 0; i < 30; i++) { const x = rng() * W, y = rng() * H; for (const ox of [-W, 0, W]) c.fillRect(x + ox, y, (2 + rng() * 10) * S, 2); } }
      if (area === 'lanternry') { c.fillStyle = rgba(pal.fog, alpha); for (let i = 0; i < 26; i++) { const x = rng() * W, y = rng() * H, w = (14 + rng() * 30) * S, h = (80 + rng() * 300) * S; for (const ox of [-W, 0, W]) { c.fillRect(x + ox - w / 2, y - h, w, h); c.beginPath(); c.moveTo(x + ox - w / 2 - 6, y - h); c.lineTo(x + ox, y - h - 30 * S); c.lineTo(x + ox + w / 2 + 6, y - h); c.fill(); for (let k = 0; k < h; k += 26 * S) { c.fillStyle = rgba('#ffe0a0', alpha * (rng() < 0.3 ? 0.35 : 0)); c.fillRect(x + ox - 3, y - h + k + 8, 6, 8); c.fillStyle = rgba(pal.fog, alpha); } } } }
      return cv; };
    layers.push({ c: far, f: 0.15 }); layers.push({ c: silhouette(0.55, 34, 1.6), f: 0.32 }); layers.push({ c: silhouette(0.85, 30, 1.0), f: 0.55 });
    return (this.bgs[area] = { layers, pal, W, H, S });
  }
  // areas whose rooms come within two tiles of each other: their backgrounds are rasterised ahead of the player
  areaNeighbors(area) {
    if (!this.neighbors) {
      this.neighbors = {}; const A = this.world.map.areas; const touch = (r, s) => r[0] < s[0] + s[2] + 2 && s[0] < r[0] + r[2] + 2 && r[1] < s[1] + s[3] + 2 && s[1] < r[1] + r[3] + 2;
      for (const a of A) this.neighbors[a.id] = A.filter((b) => b !== a && a.rects.some((r) => b.rects.some((s) => touch(r, s)))).map((b) => b.id);
    }
    return this.neighbors[area] || [];
  }
  drawBackground(ctx, cam, area, t, viewW, viewH) {
    if (this.curArea !== area) { this.prevArea = this.curArea; this.curArea = area; this.areaFade = 0; }
    if (Art.ready && this.bgQueuedFor !== area) { this.bgQueuedFor = area; Art.queueBg(this.areaNeighbors(area).flatMap((a) => ['bg_' + a + '_far', 'bg_' + a + '_near']), this.bgPx); }
    this.areaFade = Math.min(1, this.areaFade + 0.016);
    const z = this.zoom * this.LS, b = this.bctx, BW = this.bgc.width, BH = this.bgc.height;
    const draw = (a, alpha) => {
      const pal = PALETTES[a]; b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = alpha;
      const g = b.createLinearGradient(0, 0, 0, BH); g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1); b.fillStyle = g; b.fillRect(0, 0, BW, BH);
      if (this.drawPaintedBg(b, a, cam, viewW, viewH, z)) { b.globalAlpha = 1; return; }
      const bg = this.getBg(a); const lw = bg.W / bg.S, lh = bg.H / bg.S; // layer size in world units
      for (const L of bg.layers) {
        const ox = ((cam.x * L.f) % lw + lw) % lw, oy = ((cam.y * L.f * 0.6) % lh + lh) % lh;
        for (let x = -ox; x < viewW; x += lw) for (let y = -oy; y < viewH; y += lh) b.drawImage(L.c, x * z, y * z, lw * z, lh * z);
      }
      b.globalAlpha = 1;
    };
    if (this.prevArea && this.areaFade < 1) { draw(this.prevArea, 1); draw(area, this.areaFade); } else draw(area, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.bgc, 0, 0, BW, BH, 0, 0, this.W, this.H);
  }
  // The painted parallax layers (art/bg_<area>_far|near.svg). The far layer scrolls slowly, the near one faster;
  // vertically they slide in proportion to how deep the camera is in the world, so they never need to tile.
  drawPaintedBg(b, area, cam, viewW, viewH, z) {
    const far = 'bg_' + area + '_far', near = 'bg_' + area + '_near';
    if (!Art.ready || !Art.has(far) || !Art.has(near)) return false;
    const m = ART_META[far]; const S = this.bgFit(viewH); const lw = m.w * S, lh = m.h * S; const px = this.bgPx || 1;
    const depth = clamp(cam.y / Math.max(1, this.world.h * TILE - viewH), 0, 1);
    for (const [name, f, vf] of [[far, 0.18, 0.55], [near, 0.42, 1]]) {
      const c = Art.raster(name, px); const ox = ((cam.x * f) % lw + lw) % lw; const y = -depth * (lh - viewH) * vf;
      for (let x = -ox; x < viewW; x += lw) b.drawImage(c, x * z, y * z, lw * z + 0.5, lh * z);
    }
    return true;
  }
  // ---------- lighting (half-resolution screen space, scaled up)
  drawLighting(ctx, cam, lights, pal, viewW, viewH) {
    const d = this.dctx, gl = this.gctx, z = this.zoom * this.LS, DW = this.dark.width, DH = this.dark.height;
    d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.fillStyle = rgba(pal.bg0, pal.dark); d.fillRect(0, 0, DW, DH);
    d.globalCompositeOperation = 'destination-out';
    gl.setTransform(1, 0, 0, 1, 0, 0); gl.globalCompositeOperation = 'source-over'; gl.clearRect(0, 0, DW, DH); gl.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const x = (L.x - cam.x) * z, y = (L.y - cam.y) * z, r = L.r * z; if (x < -r || y < -r || x > DW + r || y > DH + r) continue;
      const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(0.5, `rgba(0,0,0,${L.a * 0.45})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2);
      if (L.color) { const rg = r * 0.6; const g2 = gl.createRadialGradient(x, y, 0, x, y, rg); g2.addColorStop(0, rgba(L.color, (L.glow || 0.25))); g2.addColorStop(1, rgba(L.color, 0)); gl.fillStyle = g2; gl.fillRect(x - rg, y - rg, rg * 2, rg * 2); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(this.dark, 0, 0, DW, DH, 0, 0, this.W, this.H);
    ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(this.glow, 0, 0, DW, DH, 0, 0, this.W, this.H); ctx.globalCompositeOperation = 'source-over';
  }
  drawParticles(ctx, fx, cam, viewW, viewH) {
    for (const q of fx.ps) {
      if (q.x < cam.x - 40 || q.y < cam.y - 40 || q.x > cam.x + viewW + 40 || q.y > cam.y + viewH + 40) continue;
      const k = q.life / q.max; const a = q.alpha * Math.min(1, k * 2); const x = q.x, y = q.y;
      ctx.globalAlpha = a; ctx.fillStyle = q.color;
      const s = q.shrink ? q.size * (0.3 + 0.7 * k) : q.size;
      if (q.glow) ctx.globalCompositeOperation = 'lighter';
      if (q.shape === 'circle' || q.shape === 'soul') { ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); if (q.glow) { ctx.globalAlpha = a * 0.3; ctx.beginPath(); ctx.arc(x, y, s * 2.4, 0, TAU); ctx.fill(); } }
      else if (q.shape === 'square') { ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
      else if (q.shape === 'spark') { ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(0.6, s * 0.5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - q.vx * 0.04, y - q.vy * 0.04); ctx.stroke(); }
      else if (q.shape === 'arc') drawSlashArc(ctx, x, y, q.dir, q.size, k, q.color, q.wide);
      else if (q.shape === 'ring') { ctx.strokeStyle = q.color; ctx.lineWidth = 1.5 * (0.4 + k); ctx.beginPath(); ctx.arc(x, y, q.size * (1.6 - k), 0, TAU); ctx.stroke(); }
      else if (q.shape === 'streak') { ctx.strokeStyle = q.color; ctx.lineWidth = s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(q.rot) * q.len * k, y + Math.sin(q.rot) * q.len * k); ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}
function drawSlashArc(ctx, x, y, dir, r, k, color, wide) {
  const a0 = dir === 'right' ? -1.15 : dir === 'left' ? Math.PI - 1.15 : dir === 'up' ? -Math.PI / 2 - 1.15 : Math.PI / 2 - 1.15;
  const span = wide ? 2.9 : 2.3; const grow = 0.7 + (1 - k) * 0.45; const fade = Math.min(1, k * 1.6);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = fade * 0.35; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * grow * 1.15, a0 - 0.15, a0 + span + 0.15); ctx.arc(x, y, r * grow * 0.45, a0 + span + 0.15, a0 - 0.15, true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = fade * 0.9; ctx.beginPath(); ctx.arc(x, y, r * grow, a0, a0 + span); ctx.arc(x, y, r * grow * 0.62, a0 + span, a0, true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = fade; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * grow * 0.93, a0 + 0.35, a0 + span - 0.35); ctx.arc(x, y, r * grow * 0.78, a0 + span - 0.35, a0 + 0.35, true); ctx.closePath(); ctx.fill();
  ctx.restore();
}
