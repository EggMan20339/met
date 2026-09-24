// ---- Rendering: tile atlas chunks, parallax backgrounds, lighting -------------
const PALETTES = {
  hollow:    { rock: '#34324a', rockDark: '#222036', edge: '#55527a', top: '#625f84', topHi: '#9995bc', bg0: '#0d0c1a', bg1: '#242044', fog: '#2f2c50', dark: 0.36, light: '#c0b8ff', ambient: 'dust', decor: '#6c6890' },
  mossgrove: { rock: '#2e422e', rockDark: '#1c2c1c', edge: '#476644', top: '#57944a', topHi: '#a6ea68', bg0: '#0a1610', bg1: '#1b3c2a', fog: '#24482f', dark: 0.28, light: '#c8ffa0', ambient: 'spore', decor: '#7ccf5a' },
  depths:    { rock: '#223244', rockDark: '#141e2e', edge: '#375272', top: '#42688e', topHi: '#80b8e4', bg0: '#060b14', bg1: '#10243a', fog: '#132a40', dark: 0.5, light: '#8ce0ff', ambient: 'bubble', decor: '#4fc3f7' },
  heights:   { rock: '#3f3355', rockDark: '#28203a', edge: '#6a5288', top: '#8662ac', topHi: '#dcb2ff', bg0: '#140c22', bg1: '#33245a', fog: '#3c2a66', dark: 0.3, light: '#ecc0ff', ambient: 'sparkle', decor: '#e6b3ff' },
  spire:     { rock: '#442a26', rockDark: '#281816', edge: '#6e4436', top: '#885240', topHi: '#f49656', bg0: '#180a08', bg1: '#3a1a14', fog: '#4a261e', dark: 0.38, light: '#ffb878', ambient: 'ember', decor: '#ff8a3c' },
};
const CHUNK = 32; // tiles per chunk edge

class Renderer {
  constructor(world) {
    this.world = world; this.chunks = new Map(); this.bgs = {}; this.time = 0;
    this.dark = document.createElement('canvas'); this.dark.width = VIEW_W; this.dark.height = VIEW_H; this.dctx = this.dark.getContext('2d');
    this.scratch = document.createElement('canvas'); this.scratch.width = 96; this.scratch.height = 96; this.sctx = this.scratch.getContext('2d');
    this.curArea = null; this.prevArea = null; this.areaFade = 1;
  }
  // ---------- chunks
  chunkKey(cx, cy) { return cx + ',' + cy; }
  getChunk(cx, cy) {
    const k = this.chunkKey(cx, cy); let c = this.chunks.get(k);
    if (!c) { c = document.createElement('canvas'); c.width = CHUNK * TILE; c.height = CHUNK * TILE; this.renderChunk(c, cx, cy); this.chunks.set(k, c); }
    return c;
  }
  invalidateTiles(list) {
    const keys = new Set();
    for (const [x, y] of list) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keys.add(this.chunkKey(Math.floor((x + dx) / CHUNK), Math.floor((y + dy) / CHUNK)));
    for (const k of keys) this.chunks.delete(k);
  }
  renderChunk(canvas, cx, cy) {
    const ctx = canvas.getContext('2d'); const w = this.world;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const x0 = cx * CHUNK, y0 = cy * CHUNK;
    for (let ty = y0; ty < y0 + CHUNK; ty++) for (let tx = x0; tx < x0 + CHUNK; tx++) this.drawTile(ctx, tx, ty, (tx - x0) * TILE, (ty - y0) * TILE);
    for (let ty = y0; ty < y0 + CHUNK; ty++) for (let tx = x0; tx < x0 + CHUNK; tx++) this.drawDecor(ctx, tx, ty, (tx - x0) * TILE, (ty - y0) * TILE);
  }
  drawTile(ctx, tx, ty, px, py) {
    const w = this.world; const ch = w.tile(tx, ty); if (tx >= w.w || ty >= w.h) return;
    const pal = PALETTES[w.areaAt(tx, ty)];
    const S = (x, y) => { const c = w.tile(x, y); return c === '#' || c === 'D' || c === 'I'; };
    if (ch === '#' || ch === 'D') {
      const up = S(tx, ty - 1), dn = S(tx, ty + 1), lf = S(tx - 1, ty), rt = S(tx + 1, ty);
      const interior = up && dn && lf && rt;
      const h = hash2(tx, ty);
      ctx.fillStyle = interior ? mixHex(pal.rockDark, pal.rock, h * 0.35) : mixHex(pal.rock, pal.rockDark, h * 0.3);
      ctx.fillRect(px, py, TILE, TILE);
      // noise specks
      for (let i = 0; i < 4; i++) { const hx = hash3(tx, ty, i + 1); const hy = hash3(tx, ty, i + 11); if (hash3(tx, ty, i + 21) < 0.55) { ctx.fillStyle = rgba(hash3(tx, ty, i + 31) < 0.5 ? pal.rockDark : pal.edge, 0.35); ctx.fillRect(px + Math.floor(hx * 14), py + Math.floor(hy * 14), 2, 1 + (hash3(tx, ty, i + 41) < 0.3 ? 1 : 0)); } }
      if (interior && h < 0.12) { ctx.strokeStyle = rgba('#000000', 0.25); ctx.beginPath(); ctx.moveTo(px + 2, py + 3 + h * 40); ctx.lineTo(px + 8, py + 7 + h * 20); ctx.lineTo(px + 14, py + 5 + h * 60); ctx.stroke(); }
      // edges
      if (!up) { ctx.fillStyle = pal.top; ctx.fillRect(px, py, TILE, 3); ctx.fillStyle = pal.topHi; for (let i = 0; i < TILE; i += 2) if (hash3(tx, ty, i + 50) < 0.75) ctx.fillRect(px + i, py, 2, 1); ctx.fillStyle = rgba(pal.topHi, 0.35); ctx.fillRect(px, py + 3, TILE, 1); }
      if (!dn) { ctx.fillStyle = rgba('#000000', 0.45); ctx.fillRect(px, py + TILE - 2, TILE, 2); ctx.fillStyle = pal.edge; for (let i = 0; i < TILE; i += 3) if (hash3(tx, ty, i + 60) < 0.5) ctx.fillRect(px + i, py + TILE - 3, 1, 1); }
      if (!lf) { ctx.fillStyle = pal.edge; ctx.fillRect(px, py, 1, TILE); ctx.fillStyle = rgba(pal.edge, 0.4); ctx.fillRect(px + 1, py, 1, TILE); }
      if (!rt) { ctx.fillStyle = pal.edge; ctx.fillRect(px + TILE - 1, py, 1, TILE); ctx.fillStyle = rgba(pal.edge, 0.4); ctx.fillRect(px + TILE - 2, py, 1, TILE); }
      // inner corner shading
      if (up && lf && !S(tx - 1, ty - 1)) { ctx.fillStyle = pal.edge; ctx.fillRect(px, py, 1, 1); }
      if (up && rt && !S(tx + 1, ty - 1)) { ctx.fillStyle = pal.edge; ctx.fillRect(px + TILE - 1, py, 1, 1); }
      if (ch === 'D') { // cracked, breakable wall
        ctx.strokeStyle = rgba('#e8d8ff', 0.55); ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(px + 3, py + 1); ctx.lineTo(px + 7, py + 6); ctx.lineTo(px + 5, py + 10); ctx.lineTo(px + 9, py + 15);
        ctx.moveTo(px + 7, py + 6); ctx.lineTo(px + 13, py + 4); ctx.moveTo(px + 5, py + 10); ctx.lineTo(px + 1, py + 12); ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', 0.12); ctx.fillRect(px + 2, py + 2, 12, 12);
      }
    } else if (ch === 'I') { // smooth crystal: cannot be clung to
      const h = hash2(tx, ty);
      const up = S(tx, ty - 1), dn = S(tx, ty + 1), lf = S(tx - 1, ty), rt = S(tx + 1, ty);
      ctx.fillStyle = mixHex('#8ad8ff', '#4a90c8', h * 0.6); ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = rgba('#ffffff', 0.25); ctx.beginPath(); ctx.moveTo(px, py + TILE); ctx.lineTo(px + TILE * (0.3 + h * 0.4), py); ctx.lineTo(px + TILE, py); ctx.lineTo(px + TILE, py + TILE * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba('#0a2040', 0.35); ctx.beginPath(); ctx.moveTo(px, py + TILE); ctx.lineTo(px + TILE, py + TILE); ctx.lineTo(px + TILE, py + TILE * (0.5 + h * 0.4)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 1;
      ctx.beginPath(); if (!up) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + TILE, py + 0.5); } if (!lf) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + TILE); } if (!rt) { ctx.moveTo(px + TILE - 0.5, py); ctx.lineTo(px + TILE - 0.5, py + TILE); } if (!dn) { ctx.moveTo(px, py + TILE - 0.5); ctx.lineTo(px + TILE, py + TILE - 0.5); } ctx.stroke();
      if (h < 0.3) { ctx.fillStyle = rgba('#ffffff', 0.8); ctx.fillRect(px + 3 + Math.floor(h * 30), py + 3 + Math.floor(hash3(tx, ty, 5) * 8), 1, 1); }
    } else if (ch === '^') { // spikes: point away from the adjacent solid side
      let dir = 'up'; if (S(tx, ty - 1) && !S(tx, ty + 1)) dir = 'down'; else if (S(tx - 1, ty) && !S(tx, ty + 1) && !S(tx, ty - 1)) dir = 'right'; else if (S(tx + 1, ty) && !S(tx, ty + 1) && !S(tx, ty - 1)) dir = 'left';
      ctx.save(); ctx.translate(px + 8, py + 8); ctx.rotate(dir === 'down' ? Math.PI : dir === 'right' ? Math.PI / 2 : dir === 'left' ? -Math.PI / 2 : 0);
      ctx.fillStyle = '#6b6f80'; ctx.fillRect(-8, 6, 16, 2);
      for (let i = 0; i < 3; i++) { const bx = -8 + i * 5.5 + 2.7; ctx.fillStyle = '#d8dce8'; ctx.beginPath(); ctx.moveTo(bx - 2.5, 6); ctx.lineTo(bx, -6); ctx.lineTo(bx + 2.5, 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#8a8fa3'; ctx.beginPath(); ctx.moveTo(bx, -6); ctx.lineTo(bx + 2.5, 6); ctx.lineTo(bx + 0.5, 6); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    } else if (ch === '~') { // void water
      const top = w.tile(tx, ty - 1) !== '~';
      ctx.fillStyle = mixHex('#05060e', '#0d1030', hash2(tx, ty) * 0.5); ctx.fillRect(px, py, TILE, TILE);
      if (top) { ctx.fillStyle = rgba('#5060c0', 0.5); ctx.fillRect(px, py, TILE, 1); ctx.fillStyle = rgba('#8090ff', 0.35); for (let i = 0; i < 16; i += 4) if (hash3(tx, ty, i) < 0.5) ctx.fillRect(px + i, py + 1, 2, 1); }
      else if (hash2(tx, ty) < 0.15) { ctx.fillStyle = rgba('#6070d0', 0.25); ctx.fillRect(px + 4 + Math.floor(hash3(tx, ty, 2) * 8), py + 4 + Math.floor(hash3(tx, ty, 3) * 8), 1, 1); }
    } else if (ch === '=') { // one-way ledge
      ctx.fillStyle = pal.top; ctx.fillRect(px, py, TILE, 4); ctx.fillStyle = pal.topHi; ctx.fillRect(px, py, TILE, 1);
      ctx.fillStyle = rgba('#000000', 0.35); ctx.fillRect(px, py + 4, TILE, 1);
      ctx.fillStyle = pal.edge; ctx.fillRect(px + 2, py + 4, 2, 3); ctx.fillRect(px + 12, py + 4, 2, 3);
    }
  }
  drawDecor(ctx, tx, ty, px, py) {
    const w = this.world; if (w.tile(tx, ty) !== '.') return;
    const area = w.areaAt(tx, ty); const pal = PALETTES[area]; const h = hash2(tx, ty);
    const S = (x, y) => { const c = w.tile(x, y); return c === '#' || c === 'D'; };
    const onFloor = S(tx, ty + 1), onCeil = S(tx, ty - 1);
    if (area === 'mossgrove') {
      if (onFloor && h < 0.7) { ctx.strokeStyle = h < 0.35 ? '#8fd45a' : '#5fae3a'; ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { const bx = px + 2 + i * 4 + Math.floor(hash3(tx, ty, i) * 3); const bh = 2 + Math.floor(hash3(tx, ty, i + 9) * 5); ctx.beginPath(); ctx.moveTo(bx, py + TILE); ctx.lineTo(bx + (hash3(tx, ty, i + 3) < 0.5 ? -1 : 1), py + TILE - bh); ctx.stroke(); } }
      if (onCeil && h < 0.28) { const len = 6 + Math.floor(hash3(tx, ty, 7) * 26); ctx.strokeStyle = '#3f7a34'; ctx.beginPath(); ctx.moveTo(px + 8, py); ctx.quadraticCurveTo(px + 8 + (h - 0.14) * 20, py + len / 2, px + 8 + (hash3(tx, ty, 8) - 0.5) * 6, py + len); ctx.stroke(); ctx.fillStyle = '#6fc24a'; for (let i = 3; i < len; i += 5) ctx.fillRect(px + 7 + (i % 2 ? 2 : -2), py + i, 2, 1); }
      if (onFloor && h > 0.93) { ctx.fillStyle = '#d0ff9a'; ctx.beginPath(); ctx.arc(px + 8, py + 12, 3, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#7ccf5a'; ctx.fillRect(px + 7, py + 12, 2, 4); }
    } else if (area === 'hollow') {
      if (onFloor && h < 0.18) { ctx.fillStyle = pal.top; ctx.beginPath(); ctx.moveTo(px + 4, py + TILE); ctx.lineTo(px + 8, py + TILE - 4 - h * 30); ctx.lineTo(px + 12, py + TILE); ctx.fill(); }
      if (onCeil && h > 0.84) { ctx.fillStyle = pal.top; ctx.beginPath(); ctx.moveTo(px + 4, py); ctx.lineTo(px + 8, py + 4 + (h - 0.84) * 60); ctx.lineTo(px + 12, py); ctx.fill(); }
      if (onFloor && h > 0.5 && h < 0.6) { ctx.fillStyle = pal.edge; ctx.fillRect(px + 3, py + 14, 3, 2); ctx.fillRect(px + 10, py + 15, 2, 1); }
    } else if (area === 'depths') {
      if (onCeil && h < 0.3) { ctx.strokeStyle = rgba('#8ce0ff', 0.5); ctx.beginPath(); ctx.moveTo(px + 6 + h * 12, py); ctx.lineTo(px + 6 + h * 12, py + 3 + h * 12); ctx.stroke(); }
      if (onFloor && h > 0.86) { ctx.fillStyle = '#4fc3f7'; ctx.beginPath(); ctx.arc(px + 6, py + 12, 2.5, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#2b6a86'; ctx.fillRect(px + 5, py + 12, 2, 4); ctx.fillStyle = '#9ce8ff'; ctx.beginPath(); ctx.arc(px + 11, py + 14, 1.5, Math.PI, 0); ctx.fill(); }
      if (onFloor && h > 0.4 && h < 0.5) { ctx.fillStyle = rgba('#000', 0.3); ctx.fillRect(px + 2, py + 15, 6, 1); }
    } else if (area === 'heights') {
      if ((onFloor || onCeil) && h < 0.22) { const up = onFloor; ctx.save(); ctx.translate(px + 8, up ? py + TILE : py); if (!up) ctx.scale(1, -1); ctx.fillStyle = mixHex('#d6a8ff', '#8a5ad0', h * 4); ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, -6 - h * 30); ctx.lineTo(2, 0); ctx.fill(); ctx.fillStyle = '#f3e0ff'; ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(4, -4 - h * 20); ctx.lineTo(6, 0); ctx.fill(); ctx.restore(); }
    } else if (area === 'spire') {
      if (onFloor && h < 0.25) { ctx.fillStyle = rgba('#ff8a3c', 0.7); ctx.fillRect(px + 2 + Math.floor(h * 20), py + 15, 3 + Math.floor(h * 12), 1); ctx.fillStyle = rgba('#ffd080', 0.5); ctx.fillRect(px + 4 + Math.floor(h * 20), py + 15, 1, 1); }
      if (onFloor && h > 0.8) { ctx.fillStyle = '#5a3a30'; ctx.fillRect(px + 3, py + 13, 8, 3); ctx.fillStyle = '#3a2422'; ctx.fillRect(px + 5, py + 12, 4, 1); }
      if (onCeil && h > 0.9) { ctx.fillStyle = pal.top; ctx.beginPath(); ctx.moveTo(px + 5, py); ctx.lineTo(px + 8, py + 6); ctx.lineTo(px + 11, py); ctx.fill(); }
    }
  }
  // ---------- backgrounds
  getBg(area) {
    if (this.bgs[area]) return this.bgs[area];
    const pal = PALETTES[area]; const rng = makeRng(area.length * 977 + area.charCodeAt(0) * 31);
    const W = 512, H = 640; const layers = [];
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    // far layer: soft fog blobs
    const far = mk(); { const c = far.getContext('2d'); for (let i = 0; i < 26; i++) { const x = rng() * W, y = rng() * H, r = 40 + rng() * 90; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(pal.fog, 0.75)); g.addColorStop(1, rgba(pal.fog, 0)); c.fillStyle = g; for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { c.beginPath(); c.arc(x + ox, y + oy, r, 0, TAU); c.fill(); } } }
    // mid & near: silhouetted rock columns / stalactites
    const silhouette = (alpha, count, scale) => { const cv = mk(); const c = cv.getContext('2d'); c.fillStyle = rgba(mixHex(pal.rockDark, pal.bg0, 0.5), alpha);
      for (let i = 0; i < count; i++) { const x = rng() * W, base = rng() * H, w = (20 + rng() * 60) * scale, h = (60 + rng() * 260) * scale; const up = rng() < 0.5;
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) { c.beginPath(); const bx = x + ox, by = base + oy; if (up) { c.moveTo(bx - w / 2, by); c.quadraticCurveTo(bx - w / 4, by - h * 0.7, bx, by - h); c.quadraticCurveTo(bx + w / 4, by - h * 0.7, bx + w / 2, by); } else { c.moveTo(bx - w / 2, by); c.quadraticCurveTo(bx - w / 4, by + h * 0.7, bx, by + h); c.quadraticCurveTo(bx + w / 4, by + h * 0.7, bx + w / 2, by); } c.closePath(); c.fill(); } }
      if (area === 'mossgrove') { c.strokeStyle = rgba('#2e5a2e', alpha); c.lineWidth = 2 * scale; for (let i = 0; i < 40; i++) { const x = rng() * W, y = rng() * H, l = 20 + rng() * 80; for (const ox of [-W, 0, W]) { c.beginPath(); c.moveTo(x + ox, y); c.quadraticCurveTo(x + ox + (rng() - 0.5) * 30, y + l / 2, x + ox + (rng() - 0.5) * 20, y + l); c.stroke(); } } }
      if (area === 'heights') { for (let i = 0; i < 30; i++) { const x = rng() * W, y = rng() * H, s = (3 + rng() * 6) * scale; c.fillStyle = rgba('#c9a0ff', alpha * 0.5); for (const ox of [-W, 0, W]) { c.beginPath(); c.moveTo(x + ox, y - s * 2); c.lineTo(x + ox + s, y); c.lineTo(x + ox, y + s * 2); c.lineTo(x + ox - s, y); c.closePath(); c.fill(); } } }
      if (area === 'spire') { c.fillStyle = rgba('#ff7a30', alpha * 0.35); for (let i = 0; i < 24; i++) { const x = rng() * W, y = rng() * H; for (const ox of [-W, 0, W]) c.fillRect(x + ox, y, 2 + rng() * 10, 1); } }
      return cv; };
    layers.push({ c: far, f: 0.15 }); layers.push({ c: silhouette(0.55, 30, 1.6), f: 0.32 }); layers.push({ c: silhouette(0.85, 28, 1.0), f: 0.55 });
    return (this.bgs[area] = { layers, pal, W, H });
  }
  drawBackground(ctx, cam, area, t) {
    if (this.curArea !== area) { this.prevArea = this.curArea; this.curArea = area; this.areaFade = 0; }
    this.areaFade = Math.min(1, this.areaFade + 0.016);
    const draw = (a, alpha) => {
      const bg = this.getBg(a); const pal = bg.pal;
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (const L of bg.layers) {
        const ox = ((cam.x * L.f) % bg.W + bg.W) % bg.W, oy = ((cam.y * L.f * 0.6) % bg.H + bg.H) % bg.H;
        for (let x = -ox; x < VIEW_W; x += bg.W) for (let y = -oy; y < VIEW_H; y += bg.H) ctx.drawImage(L.c, Math.round(x), Math.round(y));
      }
      ctx.globalAlpha = 1;
    };
    if (this.prevArea && this.areaFade < 1) { draw(this.prevArea, 1); draw(area, this.areaFade); } else draw(area, 1);
  }
  drawTiles(ctx, cam) {
    const cx0 = Math.floor(cam.x / (CHUNK * TILE)), cy0 = Math.floor(cam.y / (CHUNK * TILE));
    const cx1 = Math.floor((cam.x + VIEW_W) / (CHUNK * TILE)), cy1 = Math.floor((cam.y + VIEW_H) / (CHUNK * TILE));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= this.world.w || cy * CHUNK >= this.world.h) continue;
      ctx.drawImage(this.getChunk(cx, cy), cx * CHUNK * TILE - cam.x, cy * CHUNK * TILE - cam.y);
    }
  }
  // ---------- lighting
  drawLighting(ctx, cam, lights, pal) {
    const d = this.dctx; d.globalCompositeOperation = 'source-over';
    d.fillStyle = rgba(pal.bg0, pal.dark); d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const x = L.x - cam.x, y = L.y - cam.y; if (x < -L.r || y < -L.r || x > VIEW_W + L.r || y > VIEW_H + L.r) continue;
      const g = d.createRadialGradient(x, y, 0, x, y, L.r); g.addColorStop(0, `rgba(0,0,0,${L.a})`); g.addColorStop(0.5, `rgba(0,0,0,${L.a * 0.45})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(x - L.r, y - L.r, L.r * 2, L.r * 2);
    }
    ctx.drawImage(this.dark, 0, 0);
    // colored glow pass
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.color) continue; const x = L.x - cam.x, y = L.y - cam.y; const r = L.r * 0.6; if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(L.color, (L.glow || 0.25))); g.addColorStop(1, rgba(L.color, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  drawParticles(ctx, cam, fx) {
    for (const q of fx.ps) {
      const x = q.x - cam.x, y = q.y - cam.y; if (x < -30 || y < -30 || x > VIEW_W + 30 || y > VIEW_H + 30) continue;
      const k = q.life / q.max; const a = q.alpha * Math.min(1, k * 2);
      ctx.globalAlpha = a; ctx.fillStyle = q.color;
      const s = q.shrink ? q.size * (0.3 + 0.7 * k) : q.size;
      if (q.glow) { ctx.globalCompositeOperation = 'lighter'; }
      if (q.shape === 'circle' || q.shape === 'soul') { ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); if (q.glow) { ctx.globalAlpha = a * 0.35; ctx.beginPath(); ctx.arc(x, y, s * 2.2, 0, TAU); ctx.fill(); } }
      else if (q.shape === 'square') { ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
      else if (q.shape === 'spark') { ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, s * 0.6); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - q.vx * 0.03, y - q.vy * 0.03); ctx.stroke(); }
      else if (q.shape === 'arc') { drawSlashArc(ctx, x, y, q.dir, q.size, k, q.color); }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}
function drawSlashArc(ctx, x, y, dir, r, k, color) {
  const a0 = dir === 'right' ? -1.1 : dir === 'left' ? Math.PI - 1.1 : dir === 'up' ? -Math.PI / 2 - 1.1 : Math.PI / 2 - 1.1;
  const span = 2.2; const grow = 0.75 + (1 - k) * 0.35;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, k * 1.8) * 0.9;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r * grow, a0, a0 + span); ctx.arc(x, y, r * grow * 0.55, a0 + span, a0, true); ctx.closePath(); ctx.fill();
  ctx.globalAlpha *= 0.6; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r * grow * 0.92, a0 + 0.3, a0 + span - 0.3); ctx.arc(x, y, r * grow * 0.7, a0 + span - 0.3, a0 + 0.3, true); ctx.closePath(); ctx.fill();
  ctx.restore();
}
