// ---- Vec: draws art scenes (tools/art/lib.js op trees) straight onto a canvas ---------------------
// The animated characters are not rasters: every frame their template is called with the puppet's current
// parameters and the resulting scene is painted here, so they stay crisp at any zoom and tween smoothly.
const Vec = {
  paths: new Map(), grads: new Map(),
  path2d(d) {
    let p = this.paths.get(d); if (p) return p;
    if (this.paths.size > 3000) this.paths.clear(); // animated paths change every frame; keep the cache bounded
    p = new Path2D(d); this.paths.set(d, p); return p;
  },
  gradient(ctx, gr) {
    const key = gr.t === 'lin' ? `l${gr.x1},${gr.y1},${gr.x2},${gr.y2}|${gr.stops.join(';')}` : `r${gr.cx},${gr.cy},${gr.r},${gr.fx},${gr.fy}|${gr.stops.join(';')}`;
    let g = this.grads.get(key); if (g) return g;
    if (this.grads.size > 600) this.grads.clear();
    g = gr.t === 'lin' ? ctx.createLinearGradient(gr.x1, gr.y1, gr.x2, gr.y2) : ctx.createRadialGradient(gr.fx !== undefined ? gr.fx : gr.cx, gr.fy !== undefined ? gr.fy : gr.cy, 0, gr.cx, gr.cy, gr.r);
    for (const [o, c, a] of gr.stops) g.addColorStop(Math.max(0, Math.min(1, o)), a === undefined ? c : rgba(c, a));
    this.grads.set(key, g); return g;
  },
  paint(ctx, v) { return v && typeof v === 'object' ? this.gradient(ctx, v) : v; },
  // SVG transform strings: translate(x y) rotate(a [cx cy]) scale(sx [sy])
  transform(ctx, s) {
    const re = /(\w+)\(([^)]*)\)/g; let m;
    while ((m = re.exec(s))) {
      const a = m[2].trim().split(/[\s,]+/).map(Number);
      if (m[1] === 'translate') ctx.translate(a[0] || 0, a[1] || 0);
      else if (m[1] === 'scale') ctx.scale(a[0], a.length > 1 ? a[1] : a[0]);
      else if (m[1] === 'rotate') { const r = (a[0] || 0) * Math.PI / 180; if (a.length > 2) { ctx.translate(a[1], a[2]); ctx.rotate(r); ctx.translate(-a[1], -a[2]); } else ctx.rotate(r); }
    }
  },
  op(ctx, op) {
    const alpha = ctx.globalAlpha; if (op.opacity !== undefined) ctx.globalAlpha = alpha * op.opacity;
    if (op.t === 'g') {
      ctx.save(); if (op.transform) this.transform(ctx, op.transform);
      for (const c of op.children) this.op(ctx, c);
      ctx.restore(); ctx.globalAlpha = alpha; return;
    }
    if (op.transform) { ctx.save(); this.transform(ctx, op.transform); }
    let shape = null;
    switch (op.t) {
      case 'path': shape = this.path2d(op.d); break;
      case 'circ': ctx.beginPath(); ctx.arc(op.cx, op.cy, Math.max(0, op.r), 0, 6.283185307179586); break;
      case 'ell': ctx.beginPath(); ctx.ellipse(op.cx, op.cy, Math.max(0, op.rx), Math.max(0, op.ry), 0, 0, 6.283185307179586); break;
      case 'rect': ctx.beginPath(); if (op.rx) ctx.roundRect(op.x, op.y, op.w, op.h, op.rx); else ctx.rect(op.x, op.y, op.w, op.h); break;
      case 'line': ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); break;
      case 'text': {
        ctx.font = `${op.fontWeight || ''} ${op.fontSize || 12}px ${op.fontFamily || 'serif'}`; ctx.textAlign = op.textAnchor === 'middle' ? 'center' : op.textAnchor === 'end' ? 'right' : 'left'; ctx.textBaseline = 'alphabetic';
        if (op.fill && op.fill !== 'none') { ctx.fillStyle = this.paint(ctx, op.fill); ctx.fillText(op.str, op.x, op.y); }
        if (op.stroke && op.stroke !== 'none') { ctx.strokeStyle = this.paint(ctx, op.stroke); ctx.lineWidth = op.strokeWidth || 1; ctx.strokeText(op.str, op.x, op.y); }
        if (op.transform) ctx.restore(); ctx.globalAlpha = alpha; return;
      }
    }
    const fill = op.fill === undefined ? '#000' : op.fill;
    if (fill && fill !== 'none') { ctx.fillStyle = this.paint(ctx, fill); if (shape) ctx.fill(shape); else ctx.fill(); }
    if (op.stroke && op.stroke !== 'none' && op.strokeWidth !== 0) {
      ctx.strokeStyle = this.paint(ctx, op.stroke); ctx.lineWidth = op.strokeWidth === undefined ? 1 : op.strokeWidth;
      ctx.lineCap = op.strokeLinecap || 'butt'; ctx.lineJoin = op.strokeLinejoin || 'miter';
      if (op.strokeDasharray) ctx.setLineDash(String(op.strokeDasharray).split(/[\s,]+/).map(Number));
      if (shape) ctx.stroke(shape); else ctx.stroke();
      if (op.strokeDasharray) ctx.setLineDash([]);
    }
    if (op.transform) ctx.restore(); ctx.globalAlpha = alpha;
  },
  // Draw a scene with its anchor at (x, y). o: scale (world units per scene unit), flip, sx, sy, rot, alpha, anchor
  draw(ctx, scene, x, y, o) {
    o = o || {}; const s = o.scale || 1; const a = VEC_ANCHORS[o.anchor] || VEC_ANCHORS.center;
    ctx.save(); ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); ctx.scale((o.flip ? -1 : 1) * (o.sx || 1) * s, (o.sy || 1) * s); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    ctx.translate(-a[0] * scene.w, -a[1] * scene.h);
    for (const op of scene.ops) this.op(ctx, op);
    ctx.restore();
  },
};
const VEC_ANCHORS = { bottom: [0.5, 1], center: [0.5, 0.5], topleft: [0, 0], bottomleft: [0, 1] };
