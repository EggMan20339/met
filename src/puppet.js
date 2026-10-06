// ---- Puppet: live vector characters -------------------------------------------------------------
// A puppet owns the tweened parameters of one art template (see art/ANIMATION.md). Each frame the template's
// control() maps game state to targets, update() moves the parameters toward them (springs give overshoot and
// secondary motion; everything else snaps), and draw() paints template.make(params) through Vec.
const Ease = {
  linear: (t) => t, inQuad: (t) => t * t, outQuad: (t) => t * (2 - t), inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t, outCubic: (t) => 1 - Math.pow(1 - t, 3), inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2), inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  outBounce: (t) => { if (t < 1 / 2.75) return 7.5625 * t * t; if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75; if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375; return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375; },
};
const Anim = {
  // Sample keyframes [[time, values, ease?], ...] at t. Numbers interpolate with the ease of the frame being entered;
  // anything else switches at the frame time. Before the first frame the first values hold, after the last the last do.
  keys(t, frames) {
    if (t <= frames[0][0]) return Object.assign({}, frames[0][1]);
    for (let i = 0; i < frames.length - 1; i++) {
      const [t0, a] = frames[i], [t1, b, e] = frames[i + 1];
      if (t >= t0 && t < t1) { const k = (Ease[e] || Ease.inOutQuad)((t - t0) / (t1 - t0)); const out = Object.assign({}, a, b); for (const key in b) if (typeof b[key] === 'number' && typeof a[key] === 'number') out[key] = a[key] + (b[key] - a[key]) * k; return out; }
    }
    return Object.assign({}, frames[frames.length - 1][1]);
  },
  // a value that cycles 0..1 and back with a sine, phase in radians
  wave: (ph, lo = -1, hi = 1) => lo + (hi - lo) * (Math.sin(ph) * 0.5 + 0.5),
  // smooth step from 0 at a to 1 at b
  smooth: (v, a, b) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); },
  // springs move a value toward a target with overshoot: k = stiffness, z = damping ratio (1 = no bounce)
  spring(x, v, target, k, z, dt) {
    const d = 2 * Math.sqrt(k) * z; let n = Math.max(1, Math.ceil(dt / (1 / 120))); const h = dt / n;
    for (let i = 0; i < n; i++) { v += (k * (target - x) - d * v) * h; x += v * h; }
    return [x, v];
  },
};
// A verlet rope hanging from an anchor in the template's own coordinates, for tails, tentacles, cloth and antennae.
// rest: the points' resting positions relative to the anchor (defines the segment lengths and the pose it relaxes to).
class Chain {
  constructor(anchorX, anchorY, rest) {
    this.ax = anchorX; this.ay = anchorY; this.rest = rest.map((p) => ({ x: p.x, y: p.y }));
    this.pts = rest.map((p) => ({ x: anchorX + p.x, y: anchorY + p.y, px: anchorX + p.x, py: anchorY + p.y }));
    this.len = rest.map((p, i) => { const q = i ? rest[i - 1] : { x: 0, y: 0 }; return Math.hypot(p.x - q.x, p.y - q.y); });
  }
  // env: vx, vy (world velocity of the owner, scene units/s), facing, gravity, drag (how strongly motion drags the rope),
  // stiff (pull toward the rest pose per second), damp (0..1 velocity kept per step), wind (x,y force)
  update(dt, env) {
    env = env || {}; const n = Math.max(1, Math.ceil(dt / (1 / 60))); const h = dt / n; const damp = env.damp === undefined ? 0.9 : env.damp;
    const fx = -(env.vx || 0) * (env.facing || 1) * (env.drag === undefined ? 0.6 : env.drag) + (env.wind ? env.wind.x : 0), fy = -(env.vy || 0) * (env.drag === undefined ? 0.6 : env.drag) + (env.gravity === undefined ? 60 : env.gravity) + (env.wind ? env.wind.y : 0);
    const stiff = env.stiff === undefined ? 8 : env.stiff;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < this.pts.length; i++) {
        const p = this.pts[i]; const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp; p.px = p.x; p.py = p.y;
        const rx = this.ax + this.rest[i].x, ry = this.ay + this.rest[i].y;
        p.x += vx + (fx + (rx - p.x) * stiff * 4) * h * h * 60; p.y += vy + (fy + (ry - p.y) * stiff * 4) * h * h * 60;
      }
      for (let k = 0; k < 2; k++) for (let i = 0; i < this.pts.length; i++) {
        const p = this.pts[i], q = i ? this.pts[i - 1] : { x: this.ax, y: this.ay }; const dx = p.x - q.x, dy = p.y - q.y; const d = Math.hypot(dx, dy) || 1e-6; const err = (d - this.len[i]) / d;
        if (i) { p.x -= dx * err * 0.5; p.y -= dy * err * 0.5; q.x += dx * err * 0.5; q.y += dy * err * 0.5; } else { p.x -= dx * err; p.y -= dy * err; }
      }
    }
  }
  // the rope as points starting at the anchor, for lib.curve()
  points() { return [{ x: this.ax, y: this.ay }].concat(this.pts.map((p) => ({ x: p.x, y: p.y }))); }
  reset() { this.pts.forEach((p, i) => { p.x = p.px = this.ax + this.rest[i].x; p.y = p.py = this.ay + this.rest[i].y; }); }
}
class Puppet {
  constructor(def) {
    this.def = def; this.P = Object.assign({}, def.params); this.T = Object.assign({}, def.params); this.V = {};
    this.chains = {}; this.mem = {}; this.time = 0; this.ghosts = []; this.scale = 1;
  }
  // set targets (numbers with a spring entry ease in; everything else applies at the next update)
  target(obj) { Object.assign(this.T, obj); return this; }
  // set values immediately, killing any spring motion on them
  snap(obj) { Object.assign(this.T, obj); Object.assign(this.P, obj); for (const k in obj) this.V[k] = 0; return this; }
  // kick a spring-driven value (velocity in units per second): squash on landing, recoil on a hit
  impulse(k, v) { this.V[k] = (this.V[k] || 0) + v; return this; }
  // get (creating on first use) a verlet rope anchored in template space
  chain(name, ax, ay, rest) { return this.chains[name] || (this.chains[name] = new Chain(ax, ay, rest)); }
  // remember the current pose at a position; drawGhosts paints the memories fading out (dash after-images)
  ghost(x, y, life, alpha) { this.ghosts.push({ x, y, P: Object.assign({}, this.P), life, max: life, alpha: alpha === undefined ? 0.35 : alpha }); if (this.ghosts.length > 12) this.ghosts.shift(); }
  update(dt) {
    this.time += dt; const S = this.def.springs || {};
    for (const k in this.T) {
      const t = this.T[k]; const s = S[k];
      if (typeof t !== 'number' || !s) { this.P[k] = t; continue; }
      const [x, v] = Anim.spring(this.P[k], this.V[k] || 0, t, s[0], s[1] === undefined ? 0.7 : s[1], dt); this.P[k] = x; this.V[k] = v;
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) { this.ghosts[i].life -= dt; if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1); }
  }
  scene(P) { return this.def.make(P || this.P, this); }
  draw(ctx, x, y, o) { o = o || {}; Vec.draw(ctx, this.scene(), x, y, { anchor: this.def.anchor, scale: o.scale || this.scale, flip: o.flip, sx: o.sx, sy: o.sy, rot: o.rot, alpha: o.alpha }); }
  drawGhosts(ctx, o) { o = o || {}; for (const gh of this.ghosts) Vec.draw(ctx, this.scene(gh.P), gh.x, gh.y, { anchor: this.def.anchor, scale: o.scale || this.scale, flip: o.flip, alpha: gh.alpha * (gh.life / gh.max) }); }
}
Puppet.dt = 1 / 60; Puppet.time = 0;
// Puppets are created on demand and parked on the entity they animate
function puppetFor(ent, def, scale) { if (!ent.pup || ent.pup.def !== def) { ent.pup = new Puppet(def); ent.pup.scale = scale || 1; } return ent.pup; }
