// ---- Particles, screen shake, hit-stop, flashes ------------------------------
class FX {
  constructor() { this.ps = []; this.shakeAmt = 0; this.shakeT = 0; this.hitstop = 0; this.flash = 0; this.flashColor = '#ffffff'; this.slowmo = 1; this.slowT = 0; this.trail = []; }
  add(o) {
    if (this.ps.length > 900) this.ps.shift();
    this.ps.push(Object.assign({ vx: 0, vy: 0, life: 0.5, size: 2, color: '#fff', grav: 0, drag: 0, glow: false, shrink: true, shape: 'circle', alpha: 1, rot: 0, spin: 0 }, o, { max: o.life || 0.5 }));
  }
  burst(x, y, n, opt) {
    for (let i = 0; i < n; i++) {
      const a = (opt.angle !== undefined ? opt.angle + (Math.random() - 0.5) * (opt.spread || TAU) : Math.random() * TAU);
      const sp = (opt.speed || 60) * (0.4 + Math.random() * 0.8);
      this.add({ x: x + (Math.random() - 0.5) * (opt.jitter || 2), y: y + (Math.random() - 0.5) * (opt.jitter || 2), vx: Math.cos(a) * sp + (opt.vx || 0), vy: Math.sin(a) * sp + (opt.vy || 0), life: (opt.life || 0.5) * (0.6 + Math.random() * 0.8), size: (opt.size || 2) * (0.6 + Math.random() * 0.8), color: Array.isArray(opt.color) ? pick(opt.color) : opt.color, grav: opt.grav || 0, drag: opt.drag || 0, glow: !!opt.glow, shape: opt.shape || 'circle', shrink: opt.shrink !== false, spin: opt.spin || 0 });
    }
  }
  shake(amt, t = 0.2) { this.shakeAmt = Math.max(this.shakeAmt, amt); this.shakeT = Math.max(this.shakeT, t); }
  stop(t) { this.hitstop = Math.max(this.hitstop, t); }
  doFlash(a, color = '#ffffff') { this.flash = Math.max(this.flash, a); this.flashColor = color; }
  slow(f, t) { this.slowmo = f; this.slowT = t; }
  update(dt) {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowmo = 1; }
    const ps = this.ps; let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i]; q.life -= dt; if (q.life <= 0) continue;
      q.vy += q.grav * dt; if (q.drag) { q.vx *= (1 - q.drag * dt); q.vy *= (1 - q.drag * dt); }
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.spin * dt;
      ps[j++] = q;
    }
    ps.length = j;
  }
  shakeOffset() { if (this.shakeT <= 0) return [0, 0]; const a = this.shakeAmt * Math.min(1, this.shakeT * 5); return [(Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a]; }
  // Common emitters
  dust(x, y, n = 4, dir = 0) { this.burst(x, y, n, { speed: 30, angle: -Math.PI / 2 + dir * 0.6, spread: 1.6, life: 0.4, size: 1.8, color: ['#cfc4b0', '#9d9483', '#e8e0cf'], grav: 120, drag: 2 }); }
  land(x, y, s = 1) { this.burst(x, y, Math.round(6 * s), { speed: 70 * s, angle: -Math.PI / 2, spread: 2.6, life: 0.45, size: 2, color: ['#cfc4b0', '#9d9483', '#fff'], grav: 200, drag: 3 }); }
  glowBurst(x, y, n, color, speed = 80, life = 0.5) { this.burst(x, y, n, { speed, life, size: 2.2, color, glow: true, drag: 2.5 }); }
  sparks(x, y, dir, color) { this.burst(x, y, 8, { speed: 170, angle: dir, spread: 1.4, life: 0.25, size: 1.6, color, glow: true, drag: 4, shape: 'spark' }); }
  death(x, y, color) { this.burst(x, y, 18, { speed: 110, life: 0.7, size: 3, color: [color, '#000', shade(color, 0.3)], grav: 60, drag: 1.5, shape: 'square', spin: 8 }); this.glowBurst(x, y, 10, ['#fff', '#ffe8a0'], 60, 0.6); }
  soul(x, y, tx, ty) { for (let i = 0; i < 3; i++) this.add({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-40, 40), vy: rand(-60, -20), life: 0.7, size: 2, color: '#f4f0ff', glow: true, drag: 1, shape: 'soul', tx, ty }); }
  slashArc(x, y, dir, color) { this.add({ x, y, life: 0.13, size: 22, color, shape: 'arc', dir, shrink: false }); }
}
