// ---- Art: the game's original vector artwork, rasterised at the current zoom -----------------
// src/artdata.js (generated from art/*.svg, which are generated from the templates in tools/art/) holds
// every illustration as an SVG string plus its size and anchor. Sprites are drawn in world units; ART_SCALE
// says how many world units one SVG unit is for each family, so a 40-unit-tall Mote stands ~25 units high.
// Nothing here is required for play: every drawing routine falls back to its procedural version until
// the images have decoded, or if one is missing.
const ART_SCALE = {
  mote: 0.62, dimling: 0.65, hushmoth: 0.6, sporeling: 0.7, rootram: 0.72, snuffer: 0.68, emberback: 0.72, gloamwing: 0.62, springfoot: 0.68, husk: 0.8,
  wick: 0.7, bramble: 0.7, tallow: 0.7, ringer: 0.7, gulletroot: 0.78, bell: 0.75, lightless: 0.7,
  petal: 0.8, heartwood: 0.8, gift: 0.8, heart: 0.9, hearth: 0.75, lamp: 0.7, waystone: 0.8, crystal: 0.8, puffcap: 0.9, gate: 1, house: 1, icon: 1, logo: 1, bg: 1,
};
const ART_ANCHORS = { bottom: [0.5, 1], center: [0.5, 0.5], topleft: [0, 0], bottomleft: [0, 1] };
const Art = {
  imgs: {}, cache: new Map(), zoom: 1, ready: false, loaded: 0, total: 0, failed: [], queue: [], bgKept: 6,
  load() {
    if (typeof ART_SVGS === 'undefined' || typeof Image === 'undefined') return;
    const names = Object.keys(ART_SVGS); this.total = names.length;
    const done = () => { if (this.loaded + this.failed.length >= this.total) { this.ready = true; this.queue = names.slice().sort((a, b) => (b.startsWith('bg_') ? 1 : 0) - (a.startsWith('bg_') ? 1 : 0)); } };
    for (const name of names) {
      const img = new Image();
      img.onload = () => { this.loaded++; this.imgs[name] = img; done(); };
      img.onerror = () => { this.failed.push(name); done(); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART_SVGS[name]);
    }
  },
  has(name) { return !!this.imgs[name]; },
  scale(name) { return ART_SCALE[name.split('_')[0]] || 1; },
  setZoom(z) { if (z !== this.zoom) { this.zoom = z; this.cache.clear(); } },
  // pixels per SVG unit at which `name` is rasterised for the current zoom (backgrounds pass their own)
  pxFor(name) { return Math.min(8, this.scale(name) * this.zoom); },
  // an offscreen canvas holding `name` drawn at `px` pixels per SVG unit (cached per zoom)
  raster(name, px) {
    const img = this.imgs[name]; if (!img) return null;
    const key = name + '@' + px.toFixed(3); const hit = this.cache.get(key); if (hit) return hit;
    const m = ART_META[name]; const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(m.w * px)); c.height = Math.max(1, Math.ceil(m.h * px));
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(img, 0, 0, c.width, c.height);
    if (name.startsWith('bg_')) { // keep only a few painted backgrounds resident; they are large
      const bgs = [...this.cache.keys()].filter((k) => k.startsWith('bg_')); while (bgs.length >= this.bgKept) this.cache.delete(bgs.shift());
    }
    this.cache.set(key, c); return c;
  },
  // Draw `name` with its anchor at (x, y) in the context's current units. opts: flip, alpha, rot, sx, sy, scale.
  // Returns false (drawing nothing) when the image is not available so the caller can fall back.
  draw(ctx, name, x, y, o) {
    const img = this.imgs[name]; if (!img) return false; o = o || {};
    const m = ART_META[name]; const s = (o.scale || 1) * this.scale(name); const c = this.raster(name, Math.min(8, s * this.zoom));
    const w = m.w * s, h = m.h * s; const a = ART_ANCHORS[m.anchor] || ART_ANCHORS.center;
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(c, -a[0] * w, -a[1] * h, w, h); ctx.restore(); return true;
  },
  // Rasterise one queued asset per call (the game calls this every frame on the title and intro screens)
  prewarm(bgPx) {
    if (!this.ready || !this.queue.length) return;
    const name = this.queue.shift(); if (name.startsWith('bg_')) { if (bgPx) this.raster(name, bgPx); else this.queue.push(name); } else this.raster(name, this.pxFor(name));
  },
};
Art.load();
