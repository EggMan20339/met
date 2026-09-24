// ---- Sprite drawing (all procedural, in world coordinates) ------------------
function withFlash(R, x, y, w, h, drawFn, flashAmt) {
  const s = R.sctx, pad = 20; const W = w + pad * 2, H = h + pad * 2;
  if (R.scratch.width < W || R.scratch.height < H) { R.scratch.width = Math.max(W, R.scratch.width); R.scratch.height = Math.max(H, R.scratch.height); }
  s.clearRect(0, 0, R.scratch.width, R.scratch.height); s.save(); s.translate(pad - x, pad - y); drawFn(s); s.restore();
  s.globalCompositeOperation = 'source-atop'; s.fillStyle = `rgba(255,255,255,${flashAmt})`; s.fillRect(0, 0, W, H); s.globalCompositeOperation = 'source-over';
  return [x - pad, y - pad, W, H];
}
function drawSpriteMaybeFlash(ctx, R, e, drawFn) {
  if (e.flash > 0) { const [sx, sy, W, H] = withFlash(R, e.x, e.y, e.w, e.h, drawFn, 0.85); ctx.drawImage(R.scratch, 0, 0, W, H, sx, sy, W, H); }
  else drawFn(ctx);
}

// ---------- Player: Mote, a small luminous spirit
function drawPlayer(ctx, p, t) {
  if (p.dead) return;
  const cx = p.x + p.w / 2, feet = p.y + p.h;
  ctx.save();
  let alpha = 1;
  if (p.hazardTimer > 0) alpha = clamp(p.hazardTimer / 0.55, 0, 1);
  else if (p.invuln > 0 && Math.floor(t * 28) % 2 === 0) alpha = 0.4;
  // light trail
  const tail = p.anim.tail;
  if (tail.length > 2) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < tail.length; i++) { const k = i / tail.length; ctx.globalAlpha = alpha * k * 0.22; ctx.fillStyle = '#cfd8ff'; ctx.beginPath(); ctx.arc(tail[i].x, tail[i].y, 2 + k * 3, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = alpha;
  // dash ghosts
  if (p.dashing > 0) { for (let i = 1; i <= 3; i++) { ctx.globalAlpha = alpha * (0.25 - i * 0.06); ctx.fillStyle = '#dfe6ff'; ctx.beginPath(); ctx.ellipse(cx - p.dashDir * i * 7, feet - 8, 7, 5, 0, 0, TAU); ctx.fill(); } ctx.globalAlpha = alpha; }
  let sx = 1, sy = 1;
  if (!p.onGround && !p.wallSliding) { sy = clamp(1 + Math.abs(p.vy) / 1100, 1, 1.25); sx = 1 / sy; }
  if (p.anim.land > 0) { sx = 1 + p.anim.land * 0.3; sy = 1 - p.anim.land * 0.28; }
  if (p.dashing > 0) { sx = 1.45; sy = 0.72; }
  if (p.sitting) { sy = 0.9; sx = 1.08; }
  const bob = p.onGround && Math.abs(p.vx) < 20 && !p.sitting ? Math.sin(t * 3) * 0.6 : 0;
  const lean = p.onGround ? clamp(p.vx / PHYS.RUN, -1, 1) * 0.16 : (p.wallSliding ? -p.wallDir * 0.15 : clamp(p.vx / 400, -0.2, 0.2));
  ctx.translate(cx, feet); ctx.rotate(lean); ctx.scale(p.facing * sx, sy);
  const hurt = p.hurtTimer > 0; const body = hurt ? '#ffb4b4' : (p.focusing ? '#fff4d0' : '#f6f4ff');
  // legs
  const run = p.anim.run; const legA = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(run * 1.6) * 3 : 0;
  ctx.strokeStyle = '#d8dcf5'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  if (!p.sitting) { ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-2 + legA, 0); ctx.moveTo(2, -3); ctx.lineTo(2 - legA, 0); ctx.stroke(); }
  // tail
  const sway = Math.sin(t * 7) * 1.5 + (p.onGround ? -p.vx / PHYS.RUN * 2 : -clamp(p.vx, -80, 80) / 40);
  ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-8, -6 + sway, -10, -3 + sway * 1.5 + (p.vy > 100 ? -5 : 0)); ctx.stroke();
  // body glow
  ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(0, -8 + bob, 2, 0, -8 + bob, 14); gg.addColorStop(0, rgba(p.focusing ? '#ffd080' : '#b8c4ff', p.focusing ? 0.5 : 0.28)); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -8 + bob, 14, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  // body
  const g = ctx.createLinearGradient(0, -15, 0, 0); g.addColorStop(0, body); g.addColorStop(1, hurt ? '#e89090' : '#bcc8f0'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -8 + bob, 5.2, 6.8, 0, 0, TAU); ctx.fill();
  // ears: trail with vertical velocity
  const earTilt = clamp(p.vy / 700, -0.6, 0.6) + (p.onGround && Math.abs(p.vx) > 20 ? -0.2 : 0);
  ctx.fillStyle = body;
  for (const [ex, ang] of [[-2, -0.55], [1.5, -0.2]]) { ctx.save(); ctx.translate(ex, -13.5 + bob); ctx.rotate(ang + earTilt); ctx.beginPath(); ctx.ellipse(0, -5, 1.7, 5.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#e6c8ff'; ctx.beginPath(); ctx.ellipse(0, -5, 0.7, 3.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = body; ctx.restore(); }
  // eyes
  const blink = (Math.floor(t * 1.3) % 5 === 4 && (t * 1.3) % 1 < 0.12) || p.sitting && Math.sin(t) > 0.9;
  ctx.fillStyle = '#1e1b36';
  if (blink) { ctx.fillRect(1, -9 + bob, 2.5, 1); ctx.fillRect(3.5, -9.5 + bob, 2, 1); }
  else { ctx.beginPath(); ctx.ellipse(1.6, -9 + bob, 1.3, 1.9, 0, 0, TAU); ctx.ellipse(4.2, -9.4 + bob, 1.2, 1.7, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.fillRect(1.8, -10.2 + bob, 0.8, 0.8); ctx.fillRect(4.3, -10.6 + bob, 0.8, 0.8); }
  // focus aura
  if (p.focusing) { const k = p.focusTimer / PHYS.FOCUS_TIME; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#ffe0a0', 0.5 + k * 0.4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -8, 12 - k * 6, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
}

// ---------- Enemies
function drawEnemy(ctx, R, e, t) {
  if (!e.alive) return;
  const D = e.def; const cx = e.x + e.w / 2, cy = e.y + e.h / 2, bottom = e.y + e.h;
  const draw = (c) => {
    c.save();
    switch (e.type) {
      case 'e': { // beetle
        c.translate(cx, bottom); c.scale(e.facing, 1);
        c.strokeStyle = '#1b1526'; c.lineWidth = 1.5; const mv = Math.abs(e.vx) > 5 ? 1 : 0;
        for (let i = 0; i < 3; i++) { const ph = Math.sin(e.anim * 16 + i * 2.1) * 2 * mv; c.beginPath(); c.moveTo(-4 + i * 4, -3); c.lineTo(-6 + i * 5 + ph, 0); c.moveTo(-4 + i * 4, -3); c.stroke(); }
        const g = c.createLinearGradient(0, -11, 0, 0); g.addColorStop(0, shade(D.color, 0.25)); g.addColorStop(1, D.color); c.fillStyle = g;
        c.beginPath(); c.ellipse(-1, -5.5, 7, 5.2, 0, 0, TAU); c.fill();
        c.strokeStyle = rgba('#000', 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(-1, -10.5); c.lineTo(-1, -1); c.stroke();
        c.strokeStyle = rgba('#9a8cc0', 0.5); c.beginPath(); c.arc(-1, -5.5, 5.5, -2.6, -0.6); c.stroke();
        c.fillStyle = shade(D.color, -0.2); c.beginPath(); c.arc(6, -4, 3.2, 0, TAU); c.fill();
        c.fillStyle = D.eye; c.beginPath(); c.arc(7, -5, 1.1, 0, TAU); c.arc(5.2, -6, 0.8, 0, TAU); c.fill();
        break;
      }
      case 'f': { // moth
        c.translate(cx, cy); c.scale(e.facing, 1);
        const flap = Math.abs(Math.sin(e.anim * 22)); const wc = e.aggro ? '#7a5aa0' : '#5a4f7a';
        c.fillStyle = rgba(wc, 0.85);
        c.beginPath(); c.ellipse(-1, -3, 6 * (0.3 + flap * 0.7), 3.5, -0.4, 0, TAU); c.ellipse(-1, 2, 5 * (0.3 + flap * 0.7), 3, 0.4, 0, TAU); c.fill();
        c.fillStyle = D.color; c.beginPath(); c.ellipse(0, 0, 3, 4.2, 0, 0, TAU); c.fill();
        c.strokeStyle = D.color; c.lineWidth = 1; c.beginPath(); c.moveTo(1, -3.5); c.lineTo(3, -7); c.moveTo(-1, -3.5); c.lineTo(-2, -7); c.stroke();
        c.fillStyle = e.aggro ? '#ff8a8a' : D.eye; c.beginPath(); c.arc(1.6, -1.5, 1, 0, TAU); c.arc(-1.2, -1.5, 0.8, 0, TAU); c.fill();
        break;
      }
      case 'g': { // shade
        c.translate(cx, cy);
        const vx = e.vx, vy = e.vy; const sp = Math.hypot(vx, vy) || 1;
        for (let i = 1; i <= 4; i++) { c.fillStyle = rgba(D.color, 0.35 - i * 0.07); c.beginPath(); c.arc(-vx / sp * i * 3.5, -vy / sp * i * 3.5, 6 - i * 0.9, 0, TAU); c.fill(); }
        const core = e.state === 'tele' ? '#ffe9b0' : D.color;
        c.fillStyle = core; c.beginPath(); c.arc(0, 0, 6 + Math.sin(e.anim * 5) * 0.6, 0, TAU); c.fill();
        c.fillStyle = e.state === 'lunge' ? '#ff5a3a' : D.eye; c.beginPath(); c.arc(-2 * e.facing, -1, 1.2, 0, TAU); c.arc(2.5 * e.facing, -1, 1.2, 0, TAU); c.fill();
        break;
      }
      case 's': { // spore bulb
        c.translate(cx, bottom); c.scale(e.facing, 1);
        const charge = e.state === 'charge' ? clamp(e.t / 0.6, 0, 1) : 0;
        c.fillStyle = '#3d6a2f'; c.beginPath(); c.ellipse(-4, -1, 5, 2, -0.3, 0, TAU); c.ellipse(4, -1, 5, 2, 0.3, 0, TAU); c.fill();
        c.strokeStyle = '#4f7a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-1, -5, 0, -8); c.stroke();
        const r = 6 + charge * 2.5; const g = c.createRadialGradient(-1, -12, 1, 0, -11, r); g.addColorStop(0, mixHex('#8fd45a', '#ffe36a', charge)); g.addColorStop(1, D.color); c.fillStyle = g;
        c.beginPath(); c.ellipse(0, -11, r, r * 0.9, 0, 0, TAU); c.fill();
        c.fillStyle = '#1a2612'; c.beginPath(); c.ellipse(4.5, -9.5, 2 + charge * 1.5, 1.2 + charge * 2, 0, 0, TAU); c.fill();
        c.fillStyle = D.eye; c.beginPath(); c.arc(3, -13, 1.2, 0, TAU); c.fill();
        for (let i = 0; i < 3; i++) { c.fillStyle = rgba('#c8ff5a', 0.6); c.beginPath(); c.arc(-4 + i * 3, -16 - Math.sin(e.anim * 3 + i) * 1, 0.9, 0, TAU); c.fill(); }
        break;
      }
      case 'c': { // husk ram
        c.translate(cx, bottom); c.scale(e.facing, 1);
        if (e.state === 'tele') c.translate((Math.random() - 0.5) * 2, 0);
        c.strokeStyle = '#2a1a1a'; c.lineWidth = 2; const mv = Math.abs(e.vx) > 5 ? 1 : 0;
        for (let i = 0; i < 4; i++) { const ph = Math.sin(e.anim * 18 + i * 1.6) * 2.5 * mv; c.beginPath(); c.moveTo(-8 + i * 5, -4); c.lineTo(-9 + i * 5 + ph, 0); c.stroke(); }
        const g = c.createLinearGradient(0, -15, 0, 0); g.addColorStop(0, shade(D.color, 0.3)); g.addColorStop(1, D.color); c.fillStyle = g;
        c.beginPath(); c.moveTo(-11, -3); c.quadraticCurveTo(-12, -14, -2, -14); c.lineTo(6, -14); c.quadraticCurveTo(11, -14, 11, -6); c.lineTo(11, -3); c.closePath(); c.fill();
        c.fillStyle = e.state === 'charge' || e.state === 'tele' ? '#8a4a3a' : '#6a4a44'; c.beginPath(); c.moveTo(4, -15); c.lineTo(13, -12); c.lineTo(13, -3); c.lineTo(4, -3); c.closePath(); c.fill();
        c.strokeStyle = '#d8c0a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(11, -12); c.quadraticCurveTo(17, -13, 16, -8); c.moveTo(11, -8); c.quadraticCurveTo(16, -8, 15, -5); c.stroke();
        c.fillStyle = e.state === 'stun' ? '#ffd0a0' : D.eye; c.beginPath(); c.arc(9, -10, 1.3, 0, TAU); c.fill();
        if (e.state === 'charge') { c.strokeStyle = rgba('#ffffff', 0.35); c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-12, -12 + i * 4); c.lineTo(-22 - i * 3, -12 + i * 4); c.stroke(); } }
        break;
      }
    }
    c.restore();
  };
  drawSpriteMaybeFlash(ctx, R, e, draw);
}

// ---------- Boss: The Warden
function drawBoss(ctx, R, b, t) {
  const cx = b.x + b.w / 2, bottom = b.y + b.h;
  const draw = (c) => {
    c.save(); c.translate(cx, bottom); c.scale(b.facing, 1);
    if (b.state === 'charge_tele' || b.state === 'roar') c.translate((Math.random() - 0.5) * 3, 0);
    const squash = b.state === 'leap_tele' ? 0.82 : b.state === 'leap' ? 1.12 : b.state === 'slam' ? 0.88 : 1;
    c.scale(1 / squash, squash);
    const mv = Math.abs(b.vx) > 5 ? 1 : 0;
    c.strokeStyle = '#1a1214'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const ph = Math.sin(b.anim * 14 + i * 1.7) * 4 * mv; c.beginPath(); c.moveTo(-16 + i * 9, -10); c.lineTo(-20 + i * 10 + ph, 0); c.stroke(); }
    const phase2 = b.phase === 2; const base = phase2 ? '#4a2626' : '#3a2a3a';
    const g = c.createLinearGradient(0, -36, 0, 0); g.addColorStop(0, shade(base, 0.35)); g.addColorStop(1, shade(base, -0.2)); c.fillStyle = g;
    c.beginPath(); c.moveTo(-23, -6); c.quadraticCurveTo(-25, -34, -4, -36); c.lineTo(10, -36); c.quadraticCurveTo(24, -34, 24, -14); c.lineTo(24, -6); c.quadraticCurveTo(0, 2, -23, -6); c.closePath(); c.fill();
    c.strokeStyle = rgba('#c8a8d8', 0.35); c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-4, -18, 20 - i * 5, -2.4, -1.0); c.stroke(); }
    const crack = phase2 ? 0.9 : 0.45 + Math.sin(t * 3) * 0.15; c.strokeStyle = rgba('#ff8a3c', crack); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-14, -26); c.lineTo(-9, -20); c.lineTo(-11, -13); c.moveTo(2, -30); c.lineTo(5, -22); c.lineTo(1, -16); c.lineTo(6, -10); c.stroke();
    c.fillStyle = shade(base, -0.1); c.beginPath(); c.moveTo(14, -28); c.lineTo(28, -22); c.lineTo(28, -6); c.lineTo(14, -4); c.closePath(); c.fill();
    c.strokeStyle = '#e8d0b0'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, -26); c.quadraticCurveTo(36, -30, 34, -18); c.moveTo(24, -14); c.quadraticCurveTo(36, -14, 33, -7); c.stroke();
    const eye = b.state === 'stun' ? '#ffe0b0' : (b.state === 'charge_tele' || b.state === 'charge' ? '#ff3a2a' : (phase2 ? '#ff6a3a' : '#ffb347'));
    c.fillStyle = eye; c.beginPath(); c.arc(21, -20, 2.6, 0, TAU); c.arc(17, -24, 1.6, 0, TAU); c.fill();
    if (b.state === 'charge_tele' || b.state === 'roar') { c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba('#ff3a2a', 0.18 + Math.sin(t * 30) * 0.08); c.beginPath(); c.ellipse(0, -18, 34, 26, 0, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
    c.restore();
  };
  if (!b.alive) { const k = clamp(b.deathT / 2.5, 0, 1); ctx.save(); ctx.globalAlpha = 1 - k; drawSpriteMaybeFlash(ctx, R, Object.assign({}, b, { flash: Math.sin(t * 40) > 0 ? 1 : 0 }), draw); ctx.restore(); return; }
  drawSpriteMaybeFlash(ctx, R, b, draw);
}

function drawProjectile(ctx, pr, t) {
  ctx.save();
  if (pr.kind === 'shock') { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ff9a4a', 0.8); ctx.beginPath(); ctx.moveTo(pr.x - 6, pr.y + 6); ctx.lineTo(pr.x, pr.y - 6 - Math.sin(t * 40) * 2); ctx.lineTo(pr.x + 6, pr.y + 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = rgba('#ffe0a0', 0.7); ctx.beginPath(); ctx.arc(pr.x, pr.y + 2, 3, 0, TAU); ctx.fill(); }
  else { ctx.fillStyle = '#5a7a2a'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#c8ff5a', 0.8); ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.55, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---------- Pickups
const ABILITY_COLORS = { 1: '#5ad8ff', 2: '#8cff9a', 3: '#d49aff' };
function drawPickup(ctx, pk, t) {
  if (pk.taken) return;
  const bob = Math.sin(t * 2.2 + pk.t) * 2; const x = pk.x, y = pk.y + bob;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pk.type === 'H') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 12); g.addColorStop(0, rgba('#ff6fa0', 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 12, y - 12, 24, 24);
    ctx.globalCompositeOperation = 'source-over'; ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.5 + pk.t) * 0.25);
    ctx.fillStyle = '#ff5f95'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, -1); ctx.lineTo(0, 6); ctx.lineTo(-4, -1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd0e0'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
  } else if (pk.type === '*') {
    const pulse = 1 + Math.sin(t * 4) * 0.12; const g = ctx.createRadialGradient(x, y, 0, x, y, 26 * pulse); g.addColorStop(0, rgba('#ffd060', 0.7)); g.addColorStop(0.4, rgba('#ff9a30', 0.25)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, 60, 60);
    ctx.strokeStyle = rgba('#ffe8a0', 0.6); ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const r = 8 + ((t * 20 + i * 8) % 16); ctx.globalAlpha = 1 - (r - 8) / 16; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(x, y, 6 * pulse, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff7e0'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 2.5, 0, TAU); ctx.fill();
  } else {
    const col = ABILITY_COLORS[pk.type]; const pulse = 1 + Math.sin(t * 3 + pk.t) * 0.1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 20 * pulse); g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44);
    ctx.strokeStyle = rgba(col, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10 + Math.sin(t * 2) * 1.5, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6.5 * pulse, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff';
    if (pk.type === '1') { ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillRect(x - 2, y - 3, 4, 1); ctx.fillRect(x - 2, y + 2, 4, 1); }
    else if (pk.type === '2') { ctx.fillRect(x - 4, y - 4, 2, 8); ctx.fillRect(x + 2, y - 4, 2, 8); ctx.fillRect(x - 1, y - 1, 2, 2); }
    else { ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x + 2, y); ctx.lineTo(x, y - 2); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x + 2, y + 4); ctx.lineTo(x, y + 2); ctx.lineTo(x - 2, y + 4); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- Decor & interactables
function drawDecor(ctx, ent, t, st) {
  const x = ent.tx * TILE, y = ent.ty * TILE; ctx.save();
  switch (ent.type) {
    case 'B': { // bench
      ctx.fillStyle = '#4a4660'; ctx.fillRect(x - 6, y + 8, 28, 3); ctx.fillStyle = '#6c6890'; ctx.fillRect(x - 6, y + 8, 28, 1);
      ctx.fillStyle = '#3a3750'; ctx.fillRect(x - 3, y + 11, 3, 5); ctx.fillRect(x + 16, y + 11, 3, 5);
      ctx.fillStyle = '#2f2c45'; ctx.fillRect(x + 22, y - 6, 2, 22); ctx.fillStyle = '#8a7a50'; ctx.fillRect(x + 20, y - 10, 6, 5);
      ctx.globalCompositeOperation = 'lighter'; const fl = 0.7 + Math.sin(t * 9) * 0.15; ctx.fillStyle = rgba('#ffd27a', fl); ctx.fillRect(x + 21, y - 9, 4, 3);
      const g = ctx.createRadialGradient(x + 23, y - 8, 0, x + 23, y - 8, 14); g.addColorStop(0, rgba('#ffb347', 0.35 * fl)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x + 9, y - 22, 28, 28);
      break;
    }
    case 'T': { // torch
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x + 7, y + 6, 2, 10); ctx.fillStyle = '#6a5a3a'; ctx.fillRect(x + 5, y + 5, 6, 2);
      ctx.globalCompositeOperation = 'lighter'; const f1 = Math.sin(t * 13 + x) * 1.2, f2 = Math.cos(t * 17 + y) * 1;
      ctx.fillStyle = rgba('#ff8a3c', 0.9); ctx.beginPath(); ctx.moveTo(x + 5, y + 5); ctx.quadraticCurveTo(x + 8 + f1, y - 3 + f2, x + 8 + f1 * 0.5, y - 7 + f2); ctx.quadraticCurveTo(x + 9 + f1, y - 2, x + 11, y + 5); ctx.fill();
      ctx.fillStyle = rgba('#ffe08a', 0.9); ctx.beginPath(); ctx.moveTo(x + 6.5, y + 5); ctx.quadraticCurveTo(x + 8 + f1 * 0.4, y, x + 8 + f1 * 0.3, y - 2 + f2 * 0.5); ctx.quadraticCurveTo(x + 9, y + 1, x + 9.5, y + 5); ctx.fill();
      break;
    }
    case '+': { // crystal cluster
      ctx.fillStyle = '#c9a0ff'; ctx.beginPath(); ctx.moveTo(x + 4, y + 16); ctx.lineTo(x + 7, y + 3); ctx.lineTo(x + 10, y + 16); ctx.fill();
      ctx.fillStyle = '#ecd0ff'; ctx.beginPath(); ctx.moveTo(x + 9, y + 16); ctx.lineTo(x + 12, y + 7); ctx.lineTo(x + 14, y + 16); ctx.fill();
      ctx.fillStyle = '#a070e0'; ctx.beginPath(); ctx.moveTo(x + 1, y + 16); ctx.lineTo(x + 3, y + 9); ctx.lineTo(x + 6, y + 16); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ffffff', 0.5 + Math.sin(t * 2 + x) * 0.2); ctx.fillRect(x + 7, y + 6, 1, 3);
      break;
    }
    case 'N': { // Elder Pell, an old moth
      const cx = x + 8, by = y + 16; ctx.translate(cx, by);
      const flap = Math.sin(t * 2.5) * 0.15;
      ctx.fillStyle = rgba('#a89ac8', 0.85); ctx.save(); ctx.rotate(-0.3 + flap); ctx.beginPath(); ctx.ellipse(-8, -12, 8, 4.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(0.3 - flap); ctx.beginPath(); ctx.ellipse(8, -12, 8, 4.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#5c4f7a'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-7, -14, 0, -18); ctx.quadraticCurveTo(7, -14, 6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a6b9c'; ctx.beginPath(); ctx.arc(0, -17, 4.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8c8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -21); ctx.quadraticCurveTo(-6, -27, -8, -25); ctx.moveTo(2, -21); ctx.quadraticCurveTo(6, -27, 8, -25); ctx.stroke();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(-1.8, -17, 1.1, 0, TAU); ctx.arc(1.8, -17, 1.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(9, -22); ctx.stroke(); ctx.fillStyle = '#c8ff5a'; ctx.beginPath(); ctx.arc(9, -23, 1.8, 0, TAU); ctx.fill();
      break;
    }
    case 'L': { // lore stone
      ctx.fillStyle = '#4c4a5e'; ctx.beginPath(); ctx.moveTo(x + 3, y + 16); ctx.lineTo(x + 3, y + 4); ctx.quadraticCurveTo(x + 8, y - 1, x + 13, y + 4); ctx.lineTo(x + 13, y + 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a6880'; ctx.fillRect(x + 4, y + 4, 1, 11);
      ctx.globalCompositeOperation = 'lighter'; const a = 0.6 + Math.sin(t * 2 + x) * 0.25; ctx.fillStyle = rgba('#8ce0ff', a);
      ctx.fillRect(x + 6, y + 5, 4, 1); ctx.fillRect(x + 6, y + 7, 2, 1); ctx.fillRect(x + 9, y + 7, 1, 1); ctx.fillRect(x + 6, y + 9, 4, 1); ctx.fillRect(x + 7, y + 11, 2, 1);
      break;
    }
    case 'G': { // boss gate bars (only when closed)
      if (!st.gatesClosed) break;
      ctx.fillStyle = '#2a2230'; ctx.fillRect(x + 2, y, 3, 16); ctx.fillRect(x + 8, y, 3, 16); ctx.fillRect(x + 13, y, 2, 16);
      ctx.fillStyle = '#5a4a60'; ctx.fillRect(x + 2, y, 1, 16); ctx.fillRect(x + 8, y, 1, 16); ctx.fillRect(x + 13, y, 1, 16);
      ctx.fillStyle = '#3a3040'; ctx.fillRect(x, y + 6, 16, 2);
      break;
    }
  }
  ctx.restore();
}
function drawPrompt(ctx, x, y, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ffffff', 0.85);
  const by = y + Math.sin(t * 5) * 1.5; ctx.beginPath(); ctx.moveTo(x - 3, by + 3); ctx.lineTo(x, by - 1); ctx.lineTo(x + 3, by + 3); ctx.closePath(); ctx.fill(); ctx.restore();
}
