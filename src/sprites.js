// ---- Sprite drawing (all procedural vectors, in world coordinates) --------------
function withFlash(R, x, y, w, h, drawFn, flashAmt) {
  const z = R.zoom || 1; const s = R.sctx, pad = 24; const W = Math.ceil((w + pad * 2) * z), H = Math.ceil((h + pad * 2) * z);
  if (R.scratch.width < W || R.scratch.height < H) { R.scratch.width = Math.max(W, R.scratch.width); R.scratch.height = Math.max(H, R.scratch.height); }
  s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, R.scratch.width, R.scratch.height);
  s.save(); s.setTransform(z, 0, 0, z, (pad - x) * z, (pad - y) * z); drawFn(s); s.restore();
  s.globalCompositeOperation = 'source-atop'; s.fillStyle = `rgba(255,255,255,${flashAmt})`; s.fillRect(0, 0, W, H); s.globalCompositeOperation = 'source-over';
  return [x - pad, y - pad, w + pad * 2, h + pad * 2, W, H];
}
function drawSpriteMaybeFlash(ctx, R, e, drawFn) {
  if (e.flash > 0) { const [sx, sy, sw, sh, W, H] = withFlash(R, e.x, e.y, e.w, e.h, drawFn, 0.85); ctx.drawImage(R.scratch, 0, 0, W, H, sx, sy, sw, sh); }
  else drawFn(ctx);
}
const ABILITY_COLORS = { 1: '#5ad8ff', 2: '#8cff9a', 3: '#d49aff', 4: '#ffb347' };

// ---------- Player: Mote, a small luminous spirit
function drawPlayer(ctx, p, t) {
  if (p.dead) return;
  const cx = p.x + p.w / 2, feet = p.y + p.h;
  ctx.save();
  let alpha = 1;
  if (p.hazardTimer > 0) alpha = clamp(p.hazardTimer / 0.55, 0, 1);
  else if (p.invuln > 0 && p.flareCd < 1.8 && Math.floor(t * 28) % 2 === 0) alpha = 0.4;
  const tail = p.anim.tail;
  if (tail.length > 2) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < tail.length; i++) { const k = i / tail.length; ctx.globalAlpha = alpha * k * 0.22; ctx.fillStyle = '#cfd8ff'; ctx.beginPath(); ctx.arc(tail[i].x, tail[i].y, 2 + k * 3, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = alpha;
  if (p.dashing > 0) { for (let i = 1; i <= 3; i++) { ctx.globalAlpha = alpha * (0.25 - i * 0.06); ctx.fillStyle = '#dfe6ff'; ctx.beginPath(); ctx.ellipse(cx - p.dashDir * i * 7, feet - 8, 7, 5, 0, 0, TAU); ctx.fill(); } ctx.globalAlpha = alpha; }
  let sx = 1, sy = 1;
  if (!p.onGround && !p.wallSliding) { sy = clamp(1 + Math.abs(p.vy) / 1100, 1, 1.25); sx = 1 / sy; }
  if (p.anim.land > 0) { sx = 1 + p.anim.land * 0.3; sy = 1 - p.anim.land * 0.28; }
  if (p.dashing > 0) { sx = 1.45; sy = 0.72; }
  if (p.sitting) { sy = 0.9; sx = 1.08; }
  const bob = p.onGround && Math.abs(p.vx) < 20 && !p.sitting ? Math.sin(t * 3) * 0.6 : 0;
  const lean = p.onGround ? clamp(p.vx / PHYS.RUN, -1, 1) * 0.16 : (p.wallSliding ? -p.wallDir * 0.15 : clamp(p.vx / 400, -0.2, 0.2));
  ctx.translate(cx, feet); ctx.rotate(lean); ctx.scale(p.facing * sx, sy);
  const hurt = p.hurtTimer > 0; const body = hurt ? '#ffb4b4' : (p.focusing ? '#fff4d0' : p.castTimer > 0.25 ? '#fff0c0' : '#f6f4ff');
  const run = p.anim.run; const legA = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(run * 1.6) * 3 : 0;
  ctx.strokeStyle = '#d8dcf5'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  if (!p.sitting) { ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-2 + legA, 0); ctx.moveTo(2, -3); ctx.lineTo(2 - legA, 0); ctx.stroke(); }
  const sway = Math.sin(t * 7) * 1.5 + (p.onGround ? -p.vx / PHYS.RUN * 2 : -clamp(p.vx, -80, 80) / 40);
  ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-8, -6 + sway, -10, -3 + sway * 1.5 + (p.vy > 100 ? -5 : 0)); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(0, -8 + bob, 2, 0, -8 + bob, 14); gg.addColorStop(0, rgba(p.focusing || p.warm ? '#ffd080' : '#b8c4ff', p.focusing ? 0.5 : 0.28)); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, -8 + bob, 14, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createLinearGradient(0, -15, 0, 0); g.addColorStop(0, body); g.addColorStop(1, hurt ? '#e89090' : '#bcc8f0'); ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -8 + bob, 5.2, 6.8, 0, 0, TAU); ctx.fill();
  const earTilt = clamp(p.vy / 700, -0.6, 0.6) + (p.onGround && Math.abs(p.vx) > 20 ? -0.2 : 0);
  ctx.fillStyle = body;
  for (const [ex, ang] of [[-2, -0.55], [1.5, -0.2]]) { ctx.save(); ctx.translate(ex, -13.5 + bob); ctx.rotate(ang + earTilt); ctx.beginPath(); ctx.ellipse(0, -5, 1.7, 5.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#e6c8ff'; ctx.beginPath(); ctx.ellipse(0, -5, 0.7, 3.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = body; ctx.restore(); }
  const blink = (Math.floor(t * 1.3) % 5 === 4 && (t * 1.3) % 1 < 0.12) || (p.sitting && Math.sin(t) > 0.9);
  ctx.fillStyle = '#1e1b36';
  if (blink) { ctx.fillRect(1, -9 + bob, 2.5, 1); ctx.fillRect(3.5, -9.5 + bob, 2, 1); }
  else { ctx.beginPath(); ctx.ellipse(1.6, -9 + bob, 1.3, 1.9, 0, 0, TAU); ctx.ellipse(4.2, -9.4 + bob, 1.2, 1.7, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(2, -9.8 + bob, 0.45, 0, TAU); ctx.arc(4.5, -10.2 + bob, 0.45, 0, TAU); ctx.fill(); }
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
      case 'e': {
        c.translate(cx, bottom); c.scale(e.facing, 1);
        c.strokeStyle = '#1b1526'; c.lineWidth = 1.5; c.lineCap = 'round'; const mv = Math.abs(e.vx) > 5 ? 1 : 0;
        for (let i = 0; i < 3; i++) { const ph = Math.sin(e.anim * 16 + i * 2.1) * 2 * mv; c.beginPath(); c.moveTo(-4 + i * 4, -3); c.lineTo(-6 + i * 5 + ph, 0); c.stroke(); }
        const g = c.createLinearGradient(0, -11, 0, 0); g.addColorStop(0, shade(D.color, 0.25)); g.addColorStop(1, D.color); c.fillStyle = g;
        c.beginPath(); c.ellipse(-1, -5.5, 7, 5.2, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1, -10.5); c.lineTo(-1, -1); c.stroke();
        c.strokeStyle = 'rgba(154,140,192,0.5)'; c.beginPath(); c.arc(-1, -5.5, 5.5, -2.6, -0.6); c.stroke();
        c.fillStyle = shade(D.color, -0.2); c.beginPath(); c.arc(6, -4, 3.2, 0, TAU); c.fill();
        c.fillStyle = D.eye; c.beginPath(); c.arc(7, -5, 1.1, 0, TAU); c.arc(5.2, -6, 0.8, 0, TAU); c.fill();
        break;
      }
      case 'f': {
        c.translate(cx, cy); c.scale(e.facing, 1);
        const flap = Math.abs(Math.sin(e.anim * 22)); const wc = e.aggro ? '#7a5aa0' : '#5a4f7a';
        c.fillStyle = rgba(wc, 0.85);
        c.beginPath(); c.ellipse(-1, -3, 6 * (0.3 + flap * 0.7), 3.5, -0.4, 0, TAU); c.ellipse(-1, 2, 5 * (0.3 + flap * 0.7), 3, 0.4, 0, TAU); c.fill();
        c.fillStyle = D.color; c.beginPath(); c.ellipse(0, 0, 3, 4.2, 0, 0, TAU); c.fill();
        c.strokeStyle = D.color; c.lineWidth = 1; c.beginPath(); c.moveTo(1, -3.5); c.lineTo(3, -7); c.moveTo(-1, -3.5); c.lineTo(-2, -7); c.stroke();
        c.fillStyle = e.aggro ? '#ff8a8a' : D.eye; c.beginPath(); c.arc(1.6, -1.5, 1, 0, TAU); c.arc(-1.2, -1.5, 0.8, 0, TAU); c.fill();
        break;
      }
      case 'g': {
        c.translate(cx, cy);
        const vx = e.vx, vy = e.vy; const sp = Math.hypot(vx, vy) || 1;
        for (let i = 1; i <= 4; i++) { c.fillStyle = rgba(D.color, 0.35 - i * 0.07); c.beginPath(); c.arc(-vx / sp * i * 3.5, -vy / sp * i * 3.5, 6 - i * 0.9, 0, TAU); c.fill(); }
        const core = e.state === 'tele' ? '#ffe9b0' : D.color;
        c.fillStyle = core; c.beginPath(); c.arc(0, 0, 6 + Math.sin(e.anim * 5) * 0.6, 0, TAU); c.fill();
        c.fillStyle = e.state === 'lunge' ? '#ff5a3a' : D.eye; c.beginPath(); c.arc(-2 * e.facing, -1, 1.2, 0, TAU); c.arc(2.5 * e.facing, -1, 1.2, 0, TAU); c.fill();
        break;
      }
      case 's': {
        c.translate(cx, bottom); c.scale(e.facing, 1);
        const charge = e.state === 'charge' ? clamp(e.t / 0.6, 0, 1) : 0;
        c.fillStyle = '#3d6a2f'; c.beginPath(); c.ellipse(-4, -1, 5, 2, -0.3, 0, TAU); c.ellipse(4, -1, 5, 2, 0.3, 0, TAU); c.fill();
        c.strokeStyle = '#4f7a3a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-1, -5, 0, -8); c.stroke();
        const r = 6 + charge * 2.5; const g = c.createRadialGradient(-1, -12, 1, 0, -11, r); g.addColorStop(0, mixHex('#8fd45a', '#ffe36a', charge)); g.addColorStop(1, D.color); c.fillStyle = g;
        c.beginPath(); c.ellipse(0, -11, r, r * 0.9, 0, 0, TAU); c.fill();
        c.fillStyle = '#1a2612'; c.beginPath(); c.ellipse(4.5, -9.5, 2 + charge * 1.5, 1.2 + charge * 2, 0, 0, TAU); c.fill();
        c.fillStyle = D.eye; c.beginPath(); c.arc(3, -13, 1.2, 0, TAU); c.fill();
        for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(200,255,90,0.6)'; c.beginPath(); c.arc(-4 + i * 3, -16 - Math.sin(e.anim * 3 + i) * 1, 0.9, 0, TAU); c.fill(); }
        break;
      }
      case 'c': {
        c.translate(cx, bottom); c.scale(e.facing, 1);
        if (e.state === 'tele') c.translate((Math.random() - 0.5) * 2, 0);
        c.strokeStyle = '#2a1a1a'; c.lineWidth = 2; c.lineCap = 'round'; const mv = Math.abs(e.vx) > 5 ? 1 : 0;
        for (let i = 0; i < 4; i++) { const ph = Math.sin(e.anim * 18 + i * 1.6) * 2.5 * mv; c.beginPath(); c.moveTo(-8 + i * 5, -4); c.lineTo(-9 + i * 5 + ph, 0); c.stroke(); }
        const g = c.createLinearGradient(0, -15, 0, 0); g.addColorStop(0, shade(D.color, 0.3)); g.addColorStop(1, D.color); c.fillStyle = g;
        c.beginPath(); c.moveTo(-11, -3); c.quadraticCurveTo(-12, -14, -2, -14); c.lineTo(6, -14); c.quadraticCurveTo(11, -14, 11, -6); c.lineTo(11, -3); c.closePath(); c.fill();
        c.fillStyle = e.state === 'charge' || e.state === 'tele' ? '#8a4a3a' : '#6a4a44'; c.beginPath(); c.moveTo(4, -15); c.lineTo(13, -12); c.lineTo(13, -3); c.lineTo(4, -3); c.closePath(); c.fill();
        c.strokeStyle = '#d8c0a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(11, -12); c.quadraticCurveTo(17, -13, 16, -8); c.moveTo(11, -8); c.quadraticCurveTo(16, -8, 15, -5); c.stroke();
        c.fillStyle = e.state === 'stun' ? '#ffd0a0' : D.eye; c.beginPath(); c.arc(9, -10, 1.3, 0, TAU); c.fill();
        if (e.state === 'charge') { c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-12, -12 + i * 4); c.lineTo(-22 - i * 3, -12 + i * 4); c.stroke(); } }
        break;
      }
      case 'a': { // emberback
        c.translate(cx, bottom); c.scale(e.facing, 1); const tuck = e.state === 'shell' ? 1 : 0;
        c.strokeStyle = '#2a1a10'; c.lineWidth = 1.6; c.lineCap = 'round'; const mv = Math.abs(e.vx) > 5 ? 1 : 0;
        if (!tuck) for (let i = 0; i < 3; i++) { const ph = Math.sin(e.anim * 14 + i * 2) * 2 * mv; c.beginPath(); c.moveTo(-5 + i * 4, -3); c.lineTo(-7 + i * 5 + ph, 0); c.stroke(); }
        c.fillStyle = '#5a4030'; c.beginPath(); c.ellipse(0, -5 + tuck * 2, 8, 4.5 - tuck, 0, 0, TAU); c.fill();
        const g = c.createLinearGradient(-8, -13, 8, -4); g.addColorStop(0, '#6a3a20'); g.addColorStop(0.5, '#a05028'); g.addColorStop(1, '#4a2a18'); c.fillStyle = g;
        c.beginPath(); c.moveTo(-9, -4); c.quadraticCurveTo(-9, -14 + tuck * 2, 0, -14 + tuck * 2); c.quadraticCurveTo(10, -14 + tuck * 2, 10, -4); c.closePath(); c.fill();
        c.globalCompositeOperation = 'lighter'; const em = 0.5 + Math.sin(e.anim * 4) * 0.25; c.strokeStyle = rgba('#ff8a3c', em); c.lineWidth = 1.2; c.beginPath(); c.moveTo(-6, -8); c.lineTo(-2, -11); c.lineTo(2, -8); c.lineTo(6, -11); c.moveTo(-4, -5); c.lineTo(0, -8); c.lineTo(4, -5); c.stroke(); c.globalCompositeOperation = 'source-over';
        if (!tuck) { c.fillStyle = '#3a2418'; c.beginPath(); c.arc(9, -4, 3, 0, TAU); c.fill(); c.fillStyle = D.eye; c.beginPath(); c.arc(10.5, -4.5, 1, 0, TAU); c.fill(); }
        break;
      }
      case 'r': { // gloamwing
        c.translate(cx, cy); c.scale(e.facing, 1);
        const flap = Math.sin(e.anim * 16); c.fillStyle = 'rgba(70,60,120,0.9)';
        c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(-9, -4 - flap * 5, -14, -1 + flap * 3); c.quadraticCurveTo(-8, 3, -2, 2); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(9, -4 - flap * 5, 14, -1 + flap * 3); c.quadraticCurveTo(8, 3, 2, 2); c.closePath(); c.fill();
        c.fillStyle = D.color; c.beginPath(); c.ellipse(0, 0, 4, 5, 0, 0, TAU); c.fill();
        c.fillStyle = e.state === 'fire' && e.t < 0.3 ? '#ffffff' : D.eye; c.beginPath(); c.arc(1.5, -1.5, 1.3, 0, TAU); c.arc(-1.5, -1.5, 1.3, 0, TAU); c.fill();
        c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(176,160,255,0.25)'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
        break;
      }
      case 'j': { // springfoot
        c.translate(cx, bottom); c.scale(e.facing, 1);
        const air = e.state === 'air'; const sq = e.state === 'land' ? 1.3 : e.state === 'wait' && e.t > 0.4 ? 1.12 : 1; const st = air ? 1.25 : 1 / sq;
        c.scale(sq, st);
        c.strokeStyle = '#1f3428'; c.lineWidth = 2.2; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-4, -4); c.lineTo(-7, air ? 2 : -1); c.lineTo(-9, 0); c.moveTo(4, -4); c.lineTo(7, air ? 2 : -1); c.lineTo(9, 0); c.stroke();
        const g = c.createLinearGradient(0, -12, 0, 0); g.addColorStop(0, '#4f7a5a'); g.addColorStop(1, D.color); c.fillStyle = g; c.beginPath(); c.ellipse(0, -7, 7, 5.5, 0, 0, TAU); c.fill();
        c.fillStyle = '#9fd0a0'; c.beginPath(); c.ellipse(0, -5, 4.5, 2.5, 0, 0, TAU); c.fill();
        c.fillStyle = D.eye; c.beginPath(); c.arc(4, -10, 1.6, 0, TAU); c.arc(1, -10.5, 1.4, 0, TAU); c.fill(); c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(4.4, -10, 0.7, 0, TAU); c.arc(1.4, -10.5, 0.6, 0, TAU); c.fill();
        break;
      }
      case 'k': { // lampwright husk
        c.translate(cx, bottom); c.scale(e.facing, 1);
        if (e.state === 'swing_tele' || e.state === 'lunge_tele') c.translate((Math.random() - 0.5) * 1.5, 0);
        const lean = e.state === 'lunge' ? 0.35 : e.state === 'stagger' ? -0.25 : 0; c.rotate(lean);
        const walk = Math.abs(e.vx) > 5 ? Math.sin(e.anim * 9) * 3 : 0;
        c.strokeStyle = '#2a2636'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, -9); c.lineTo(-4 + walk, 0); c.moveTo(3, -9); c.lineTo(4 - walk, 0); c.stroke();
        const g = c.createLinearGradient(0, -26, 0, -6); g.addColorStop(0, '#4a4460'); g.addColorStop(1, '#2c2838'); c.fillStyle = g;
        c.beginPath(); c.moveTo(-7, -8); c.quadraticCurveTo(-9, -20, -3, -24); c.lineTo(3, -24); c.quadraticCurveTo(9, -20, 7, -8); c.closePath(); c.fill();
        c.fillStyle = '#5a5470'; c.beginPath(); c.moveTo(-6, -22); c.quadraticCurveTo(0, -30, 6, -22); c.lineTo(5, -19); c.lineTo(-5, -19); c.closePath(); c.fill();
        c.fillStyle = e.state === 'swing_tele' || e.state === 'lunge_tele' ? '#ff6a4a' : D.eye; c.beginPath(); c.arc(2, -21, 1.2, 0, TAU); c.arc(-2, -21, 1.2, 0, TAU); c.fill();
        // lantern pole
        const sw = e.state === 'swing' ? -1.9 + clamp(e.t / 0.2, 0, 1) * 2.6 : e.state === 'swing_tele' ? -1.9 : -0.5;
        c.save(); c.translate(5, -16); c.rotate(sw); c.strokeStyle = '#6a5a3a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(16, 0); c.stroke();
        c.fillStyle = '#3a3040'; c.fillRect(14, 0, 5, 7); c.globalCompositeOperation = 'lighter'; const fl = 0.7 + Math.sin(t * 12) * 0.2; c.fillStyle = rgba('#ffd080', fl); c.fillRect(15, 1.5, 3, 4); const lg = c.createRadialGradient(16.5, 3.5, 0, 16.5, 3.5, 12); lg.addColorStop(0, rgba('#ffb347', 0.35 * fl)); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.fillRect(4, -9, 26, 26); c.restore();
        break;
      }
    }
    c.restore();
  };
  drawSpriteMaybeFlash(ctx, R, e, draw);
}

// ---------- Bosses
function drawBoss(ctx, R, b, t) {
  if (b.kind === 'lightless') drawLightless(ctx, R, b, t); else if (b.kind === 'gulletroot') drawGulletroot(ctx, R, b, t); else drawBell(ctx, R, b, t);
}
function drawLightless(ctx, R, b, t) {
  const cx = b.x + b.w / 2, bottom = b.y + b.h;
  if (b.state === 'blink' && b.alive) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ff5a3a', 0.15 * (1 - clamp(b.t / 0.7, 0, 1))); ctx.beginPath(); ctx.ellipse(cx, bottom - 18, 30, 22, 0, 0, TAU); ctx.fill(); ctx.restore(); return; }
  if (b.state === 'beam_tele' || b.state === 'beam') { const y = b.floorY - 30; const a = b.arena || { x: b.x - 300, w: 700 }; ctx.save(); ctx.globalCompositeOperation = 'lighter'; if (b.state === 'beam_tele') { ctx.strokeStyle = rgba('#ff6a3a', 0.3 + Math.sin(t * 30) * 0.2); ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(a.x + a.w, y); ctx.stroke(); } else { const k = 1 - clamp(b.t / 0.55, 0, 1); const g = ctx.createLinearGradient(0, y - 12, 0, y + 12); g.addColorStop(0, 'rgba(255,90,40,0)'); g.addColorStop(0.5, rgba('#fff0c0', 0.9 * k)); g.addColorStop(1, 'rgba(255,90,40,0)'); ctx.fillStyle = g; ctx.fillRect(a.x, y - 12, a.w, 24); ctx.fillStyle = rgba('#ff8a3c', 0.5 * k); ctx.fillRect(a.x, y - 4, a.w, 8); } ctx.restore(); }
  const draw = (c) => {
    c.save(); c.translate(cx, bottom); c.scale(b.facing, 1);
    if (b.state === 'charge_tele' || b.state === 'roar' || b.state === 'beam_tele') c.translate((Math.random() - 0.5) * 3, 0);
    const squash = b.state === 'leap_tele' ? 0.82 : b.state === 'leap' ? 1.12 : b.state === 'slam' ? 0.88 : 1;
    c.scale(1 / squash, squash);
    const mv = Math.abs(b.vx) > 5 ? 1 : 0;
    c.strokeStyle = '#1a1214'; c.lineWidth = 3; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const ph = Math.sin(b.anim * 14 + i * 1.7) * 4 * mv; c.beginPath(); c.moveTo(-16 + i * 9, -10); c.lineTo(-20 + i * 10 + ph, 0); c.stroke(); }
    const p3 = b.phase === 3, p2 = b.phase >= 2; const base = p3 ? '#2a1a22' : p2 ? '#4a2626' : '#3a2a3a';
    const g = c.createLinearGradient(0, -36, 0, 0); g.addColorStop(0, shade(base, 0.35)); g.addColorStop(1, shade(base, -0.2)); c.fillStyle = g;
    c.beginPath(); c.moveTo(-23, -6); c.quadraticCurveTo(-25, -34, -4, -36); c.lineTo(10, -36); c.quadraticCurveTo(24, -34, 24, -14); c.lineTo(24, -6); c.quadraticCurveTo(0, 2, -23, -6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(200,168,216,0.35)'; c.lineWidth = 1.5; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-4, -18, 20 - i * 5, -2.4, -1.0); c.stroke(); }
    const crack = p3 ? 1 : p2 ? 0.9 : 0.45 + Math.sin(t * 3) * 0.15; c.strokeStyle = rgba(p3 ? '#ffd080' : '#ff8a3c', crack); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-14, -26); c.lineTo(-9, -20); c.lineTo(-11, -13); c.moveTo(2, -30); c.lineTo(5, -22); c.lineTo(1, -16); c.lineTo(6, -10); c.stroke();
    // the lantern it swallowed, glowing through the shell
    c.globalCompositeOperation = 'lighter'; const lg = c.createRadialGradient(-2, -20, 0, -2, -20, 16); lg.addColorStop(0, rgba('#ffd080', p3 ? 0.55 : 0.25)); lg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = lg; c.beginPath(); c.arc(-2, -20, 16, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
    c.fillStyle = shade(base, -0.1); c.beginPath(); c.moveTo(14, -28); c.lineTo(28, -22); c.lineTo(28, -6); c.lineTo(14, -4); c.closePath(); c.fill();
    c.strokeStyle = '#e8d0b0'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, -26); c.quadraticCurveTo(36, -30, 34, -18); c.moveTo(24, -14); c.quadraticCurveTo(36, -14, 33, -7); c.stroke();
    const eye = b.state === 'stun' ? '#ffe0b0' : (b.state === 'charge_tele' || b.state === 'charge' ? '#ff3a2a' : (p2 ? '#ff6a3a' : '#ffb347'));
    c.fillStyle = eye; c.beginPath(); c.arc(21, -20, 2.6, 0, TAU); c.arc(17, -24, 1.6, 0, TAU); c.fill();
    if (b.state === 'charge_tele' || b.state === 'roar' || b.state === 'beam_tele') { c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba('#ff3a2a', 0.18 + Math.sin(t * 30) * 0.08); c.beginPath(); c.ellipse(0, -18, 34, 26, 0, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over'; }
    c.restore();
  };
  if (!b.alive) { const k = clamp(b.deathT / 2.5, 0, 1); ctx.save(); ctx.globalAlpha = 1 - k; drawSpriteMaybeFlash(ctx, R, Object.assign({}, b, { flash: Math.sin(t * 40) > 0 ? 1 : 0 }), draw); ctx.restore(); return; }
  drawSpriteMaybeFlash(ctx, R, b, draw);
}
function drawGulletroot(ctx, R, b, t) {
  const cx = b.x + b.w / 2; const floor = b.floorY;
  // telegraph: cracks where thorns will erupt
  if (b.state === 'thorns_tele' && b.spots) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const k = clamp(b.t / 0.7, 0, 1); for (const x of b.spots) { ctx.strokeStyle = rgba('#c8ff5a', 0.3 + k * 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 6, floor); ctx.lineTo(x - 2, floor - 3 - k * 4); ctx.lineTo(x + 1, floor - 1); ctx.lineTo(x + 5, floor - 4 - k * 5); ctx.lineTo(x + 7, floor); ctx.stroke(); const g = ctx.createRadialGradient(x, floor, 0, x, floor, 14); g.addColorStop(0, rgba('#c8ff5a', 0.35 * k)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 14, floor - 14, 28, 14); } ctx.restore(); }
  const draw = (c) => {
    c.save(); c.beginPath(); c.rect(b.x - 60, floor - 200, b.w + 120, 200); c.clip(); // nothing below the floor
    c.translate(cx, floor); const rise = floor - b.y; // how far it has surfaced (0..h)
    c.translate(0, -(rise - b.h)); c.scale(b.facing, 1);
    if (b.state === 'thorns_tele' || b.state === 'emerge') c.translate((Math.random() - 0.5) * 2, 0);
    // roots fanning out
    c.strokeStyle = '#3a4a2a'; c.lineWidth = 5; c.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { const sw = Math.sin(t * 1.5 + i) * 3; c.beginPath(); c.moveTo(i * 6, 0); c.quadraticCurveTo(i * 16 + sw, -20, i * 24 + sw * 2, -36 - Math.abs(i) * 2); c.stroke(); }
    c.strokeStyle = '#5a7a3a'; c.lineWidth = 2; for (let i = -3; i <= 3; i++) { const sw = Math.sin(t * 1.5 + i) * 3; c.beginPath(); c.moveTo(i * 6, -2); c.quadraticCurveTo(i * 16 + sw, -22, i * 24 + sw * 2, -38 - Math.abs(i) * 2); c.stroke(); }
    // bulb head
    const open = b.state === 'spit' || b.state === 'lash' ? 1 : b.state === 'thorns_tele' ? 0.5 : 0.15 + Math.sin(t * 2) * 0.1;
    const g = c.createRadialGradient(-6, -30, 4, 0, -24, 30); g.addColorStop(0, '#5a8a3a'); g.addColorStop(0.7, '#2c4a26'); g.addColorStop(1, '#16281a'); c.fillStyle = g;
    c.beginPath(); c.moveTo(-28, -8); c.quadraticCurveTo(-32, -40, -6, -44); c.lineTo(8, -44); c.quadraticCurveTo(32, -40, 28, -8); c.quadraticCurveTo(0, 0, -28, -8); c.closePath(); c.fill();
    // maw
    c.fillStyle = '#120a10'; c.beginPath(); c.moveTo(-18, -18); c.quadraticCurveTo(0, -26 - open * 10, 20, -18); c.quadraticCurveTo(0, -10 + open * 8, -18, -18); c.closePath(); c.fill();
    c.fillStyle = '#e8ffd0'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 5 - 2, -19 - open * 6); c.lineTo(i * 5, -13 - open * 1); c.lineTo(i * 5 + 2, -19 - open * 6); c.fill(); }
    c.globalCompositeOperation = 'lighter'; c.fillStyle = rgba('#c8ff5a', 0.2 + open * 0.3); c.beginPath(); c.ellipse(0, -18, 14, 5 + open * 6, 0, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
    // eyes: clusters of glowing seeds
    const eye = b.state === 'thorns_tele' ? '#ffe36a' : b.phase === 2 ? '#ff9a4a' : '#c8ff5a';
    c.fillStyle = eye; for (const [ex, ey, r] of [[-10, -34, 2.2], [-4, -37, 1.4], [8, -35, 2.4], [14, -31, 1.3]]) { c.beginPath(); c.arc(ex, ey, r, 0, TAU); c.fill(); }
    c.restore();
  };
  if (!b.alive) { const k = clamp(b.deathT / 2.5, 0, 1); ctx.save(); ctx.globalAlpha = 1 - k; drawSpriteMaybeFlash(ctx, R, Object.assign({}, b, { flash: Math.sin(t * 40) > 0 ? 1 : 0 }), draw); ctx.restore(); return; }
  drawSpriteMaybeFlash(ctx, R, b, draw);
}
function drawBell(ctx, R, b, t) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (b.state === 'rain_tele' && b.spots) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const k = clamp(b.t / 0.8, 0, 1); for (const x of b.spots) { ctx.fillStyle = rgba('#8ce0ff', 0.15 + k * 0.35); ctx.beginPath(); ctx.arc(x, (b.arena ? b.arena.y : b.floorY - 200) + 10, 3 + k * 3, 0, TAU); ctx.fill(); ctx.strokeStyle = rgba('#8ce0ff', 0.12 + k * 0.2); ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(x, (b.arena ? b.arena.y : b.floorY - 200) + 14); ctx.lineTo(x, b.floorY); ctx.stroke(); } ctx.restore(); }
  const draw = (c) => {
    c.save(); c.translate(cx, cy);
    if (b.state === 'toll_tele') c.translate((Math.random() - 0.5) * 4, 0);
    const tilt = b.state === 'stunned' ? 0.35 : Math.sin(b.anim * 1.2) * 0.08; c.rotate(tilt);
    // tentacles
    c.lineCap = 'round'; for (let i = -3; i <= 3; i++) { const ph = b.anim * 2.2 + i; c.strokeStyle = rgba(i % 2 ? '#7fd7ff' : '#a0b8ff', 0.75); c.lineWidth = 1.6; c.beginPath(); c.moveTo(i * 5, 10); c.quadraticCurveTo(i * 6 + Math.sin(ph) * 5, 22, i * 5 + Math.sin(ph * 1.3) * 7, 34 + Math.abs(i) * -2); c.stroke(); }
    // bell body
    const g = c.createLinearGradient(-20, -22, 20, 12); g.addColorStop(0, 'rgba(180,230,255,0.85)'); g.addColorStop(0.5, 'rgba(90,150,220,0.8)'); g.addColorStop(1, 'rgba(50,80,160,0.85)'); c.fillStyle = g;
    c.beginPath(); c.moveTo(-20, 10); c.quadraticCurveTo(-22, -22, 0, -22); c.quadraticCurveTo(22, -22, 20, 10); c.quadraticCurveTo(0, 16, -20, 10); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(-14, 6); c.quadraticCurveTo(0, 12, 14, 6); c.stroke();
    // clapper core
    c.globalCompositeOperation = 'lighter'; const pulse = b.state === 'toll_tele' ? 0.9 : 0.5 + Math.sin(t * 3) * 0.2; const cg = c.createRadialGradient(0, -2, 0, 0, -2, 12); cg.addColorStop(0, rgba('#ffffff', pulse)); cg.addColorStop(0.5, rgba('#8ce0ff', pulse * 0.5)); cg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = cg; c.beginPath(); c.arc(0, -2, 12, 0, TAU); c.fill(); c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#dff6ff'; c.beginPath(); c.arc(0, 2, 3.5, 0, TAU); c.fill();
    // drowned faces (eyes) in the bell
    c.fillStyle = b.phase === 2 ? '#ff8ab0' : '#20406a'; c.beginPath(); c.arc(-7, -8, 1.6, 0, TAU); c.arc(7, -8, 1.6, 0, TAU); c.fill();
    c.restore();
  };
  if (!b.alive) { const k = clamp(b.deathT / 2.5, 0, 1); ctx.save(); ctx.globalAlpha = 1 - k; drawSpriteMaybeFlash(ctx, R, Object.assign({}, b, { flash: Math.sin(t * 40) > 0 ? 1 : 0 }), draw); ctx.restore(); return; }
  drawSpriteMaybeFlash(ctx, R, b, draw);
}

function drawProjectile(ctx, pr, t) {
  if (pr.delay > 0) return;
  ctx.save();
  switch (pr.kind) {
    case 'shock': ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,154,74,0.8)'; ctx.beginPath(); ctx.moveTo(pr.x - 6, pr.y + 6); ctx.lineTo(pr.x, pr.y - 6 - Math.sin(t * 40) * 2); ctx.lineTo(pr.x + 6, pr.y + 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,224,160,0.7)'; ctx.beginPath(); ctx.arc(pr.x, pr.y + 2, 3, 0, TAU); ctx.fill(); break;
    case 'bolt': { ctx.globalCompositeOperation = 'lighter'; const ang = Math.atan2(pr.vy, pr.vx); for (let i = 1; i <= 5; i++) { ctx.fillStyle = rgba('#ffb347', 0.35 - i * 0.06); ctx.beginPath(); ctx.arc(pr.x - Math.cos(ang) * i * 5, pr.y - Math.sin(ang) * i * 5, 4 - i * 0.5, 0, TAU); ctx.fill(); } const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 12); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,200,100,0.6)'); g.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pr.x, pr.y, 12, 0, TAU); ctx.fill(); break; }
    case 'gloam': { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(176,160,255,0.9)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(176,160,255,0.3)'; ctx.beginPath(); ctx.arc(pr.x - pr.vx * 0.03, pr.y - pr.vy * 0.03, pr.r * 1.6, 0, TAU); ctx.fill(); break; }
    case 'thorn': { const k = clamp(pr.t / 0.12, 0, 1) * (pr.life < 0.15 ? pr.life / 0.15 : 1); const h = pr.h * k; ctx.fillStyle = '#3a5a2a'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(pr.x + i * 5 - 3, pr.y + 14); ctx.lineTo(pr.x + i * 5 + i * 2, pr.y + 14 - h * (1 - Math.abs(i) * 0.25)); ctx.lineTo(pr.x + i * 5 + 3, pr.y + 14); ctx.closePath(); ctx.fill(); } ctx.strokeStyle = 'rgba(200,255,90,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pr.x, pr.y + 12); ctx.lineTo(pr.x, pr.y + 14 - h); ctx.stroke(); break; }
    case 'vine': { ctx.strokeStyle = '#4f8a3a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pr.x - pr.dir * 30, pr.y + 4); for (let i = 1; i <= 6; i++) ctx.lineTo(pr.x - pr.dir * 30 + pr.dir * i * 6, pr.y + 4 - Math.abs(Math.sin(i * 1.3 + t * 20)) * 8); ctx.stroke(); ctx.fillStyle = '#c8ff5a'; ctx.beginPath(); ctx.moveTo(pr.x + pr.dir * 6, pr.y + 4); ctx.lineTo(pr.x + pr.dir * 14, pr.y - 2); ctx.lineTo(pr.x + pr.dir * 8, pr.y - 6); ctx.closePath(); ctx.fill(); break; }
    case 'ring': { const k = 1 - clamp(pr.t / 0.75, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#8ce0ff', 0.25 + k * 0.6); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.stroke(); ctx.strokeStyle = rgba('#ffffff', 0.5 * k); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.stroke(); break; }
    case 'drop': { ctx.fillStyle = 'rgba(140,224,255,0.9)'; ctx.beginPath(); ctx.moveTo(pr.x, pr.y - 9); ctx.quadraticCurveTo(pr.x + 5, pr.y, pr.x, pr.y + 5); ctx.quadraticCurveTo(pr.x - 5, pr.y, pr.x, pr.y - 9); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(140,224,255,0.3)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 8, 0, TAU); ctx.fill(); break; }
    default: ctx.fillStyle = '#5a7a2a'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(200,255,90,0.8)'; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.55, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- Pickups
function drawPickup(ctx, pk, t) {
  if (pk.taken) return;
  const bob = Math.sin(t * 2.2 + pk.t) * 2; const x = pk.x, y = pk.y + bob;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (pk.type === 'H') { // glowbloom petal
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,140,190,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.globalCompositeOperation = 'source-over'; ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.5 + pk.t) * 0.3 - 0.4);
    const pg = ctx.createLinearGradient(0, -7, 0, 7); pg.addColorStop(0, '#ffd6e8'); pg.addColorStop(1, '#ff6fa0'); ctx.fillStyle = pg;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(6, -3, 0, 7); ctx.quadraticCurveTo(-6, -3, 0, -7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
  } else if (pk.type === 'S') { // heartwood
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,190,90,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.globalCompositeOperation = 'source-over'; ctx.translate(x, y); ctx.rotate(0.5 + Math.sin(t + pk.t) * 0.15);
    ctx.fillStyle = '#7a4a24'; ctx.beginPath(); ctx.roundRect(-5, -3, 10, 6, 2); ctx.fill(); ctx.fillStyle = '#c8803a'; ctx.beginPath(); ctx.roundRect(-4, -2, 8, 4, 1.5); ctx.fill();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,200,100,${0.5 + Math.sin(t * 4) * 0.3})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-1, -1); ctx.lineTo(1, 1); ctx.lineTo(3, 0); ctx.stroke();
  } else if (pk.type === '*') {
    const pulse = 1 + Math.sin(t * 4) * 0.12; const g = ctx.createRadialGradient(x, y, 0, x, y, 26 * pulse); g.addColorStop(0, 'rgba(255,208,96,0.7)'); g.addColorStop(0.4, 'rgba(255,154,48,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 30, y - 30, 60, 60);
    ctx.strokeStyle = 'rgba(255,232,160,0.6)'; ctx.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const r = 8 + ((t * 20 + i * 8) % 16); ctx.globalAlpha = 1 - (r - 8) / 16; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(x, y, 6 * pulse, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff7e0'; ctx.beginPath(); ctx.arc(x - 1.5, y - 1.5, 2.5, 0, TAU); ctx.fill();
  } else {
    const col = ABILITY_COLORS[pk.type]; const pulse = 1 + Math.sin(t * 3 + pk.t) * 0.1;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 20 * pulse); g.addColorStop(0, rgba(col, 0.55)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 22, y - 22, 44, 44);
    ctx.strokeStyle = rgba(col, 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 10 + Math.sin(t * 2) * 1.5, 0, TAU); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 6.5 * pulse, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff';
    if (pk.type === '1') { ctx.beginPath(); ctx.roundRect(x - 4, y - 1, 8, 2, 1); ctx.roundRect(x - 2, y - 3.5, 4, 1.2, 0.6); ctx.roundRect(x - 2, y + 2.3, 4, 1.2, 0.6); ctx.fill(); }
    else if (pk.type === '2') { ctx.beginPath(); ctx.roundRect(x - 4, y - 4, 2, 8, 1); ctx.roundRect(x + 2, y - 4, 2, 8, 1); ctx.fill(); ctx.beginPath(); ctx.arc(x, y, 1.2, 0, TAU); ctx.fill(); }
    else if (pk.type === '3') { ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 4); ctx.lineTo(x + 4, y); ctx.lineTo(x + 2, y); ctx.lineTo(x, y - 2); ctx.lineTo(x - 2, y); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x, y); ctx.lineTo(x + 4, y + 4); ctx.lineTo(x + 2, y + 4); ctx.lineTo(x, y + 2); ctx.lineTo(x - 2, y + 4); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(x, y - 4.5); ctx.quadraticCurveTo(x + 4, y - 1, x, y + 4); ctx.quadraticCurveTo(x - 4, y - 1, x, y - 4.5); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- Decor & characters
function drawDecor(ctx, ent, t, st) {
  const x = ent.tx * TILE, y = ent.ty * TILE; ctx.save();
  switch (ent.type) {
    case 'B': { // hearth: a stone ring with a living ember
      const active = st.game && Math.abs(st.game.benchPos.x - (x + 3)) < 2 && Math.abs(st.game.benchPos.y - (y + TILE - PH)) < 2;
      ctx.fillStyle = '#3a3448'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, 14, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a5470'; for (let i = 0; i < 7; i++) { const a = -0.2 + i * 0.5; ctx.beginPath(); ctx.ellipse(x + 8 + Math.cos(a) * 12, y + 13 + Math.sin(a) * 3, 3, 2, a, 0, TAU); ctx.fill(); }
      const fl = 0.8 + Math.sin(t * 9 + x) * 0.15; ctx.globalCompositeOperation = 'lighter';
      const f1 = Math.sin(t * 11) * 1.5, f2 = Math.cos(t * 13) * 1.2; ctx.fillStyle = rgba('#ff8a3c', 0.9 * fl); ctx.beginPath(); ctx.moveTo(x + 3, y + 12); ctx.quadraticCurveTo(x + 8 + f1, y + 2 + f2, x + 8 + f1 * 0.4, y - 4 - (active ? 4 : 0) + f2); ctx.quadraticCurveTo(x + 10 + f1, y + 4, x + 13, y + 12); ctx.fill();
      ctx.fillStyle = rgba('#ffe08a', 0.9 * fl); ctx.beginPath(); ctx.moveTo(x + 5, y + 12); ctx.quadraticCurveTo(x + 8 + f1 * 0.5, y + 5, x + 8, y + 1 - (active ? 3 : 0)); ctx.quadraticCurveTo(x + 9.5, y + 6, x + 11, y + 12); ctx.fill();
      const g = ctx.createRadialGradient(x + 8, y + 8, 0, x + 8, y + 8, 22); g.addColorStop(0, rgba('#ffb347', 0.3 * fl)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 14, y - 14, 44, 44);
      break;
    }
    case 'T': { // lamp post with a hanging lantern
      ctx.fillStyle = '#3a3448'; ctx.fillRect(x + 7, y - 6, 2, 22); ctx.beginPath(); ctx.ellipse(x + 8, y + 16, 4, 1.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a3448'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 8, y - 6); ctx.quadraticCurveTo(x + 8, y - 12, x + 13, y - 11); ctx.stroke();
      ctx.fillStyle = '#4a4058'; ctx.beginPath(); ctx.roundRect(x + 10.5, y - 10, 5, 7, 1); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; const fl = 0.7 + Math.sin(t * 9 + x) * 0.2; ctx.fillStyle = rgba('#ffd27a', fl); ctx.beginPath(); ctx.roundRect(x + 11.5, y - 9, 3, 5, 1); ctx.fill();
      const g = ctx.createRadialGradient(x + 13, y - 6, 0, x + 13, y - 6, 16); g.addColorStop(0, rgba('#ffb347', 0.35 * fl)); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - 4, y - 22, 34, 34);
      break;
    }
    case '+': {
      ctx.fillStyle = '#c9a0ff'; ctx.beginPath(); ctx.moveTo(x + 4, y + 16); ctx.lineTo(x + 7, y + 3); ctx.lineTo(x + 10, y + 16); ctx.fill();
      ctx.fillStyle = '#ecd0ff'; ctx.beginPath(); ctx.moveTo(x + 9, y + 16); ctx.lineTo(x + 12, y + 7); ctx.lineTo(x + 14, y + 16); ctx.fill();
      ctx.fillStyle = '#a070e0'; ctx.beginPath(); ctx.moveTo(x + 1, y + 16); ctx.lineTo(x + 3, y + 9); ctx.lineTo(x + 6, y + 16); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#ffffff', 0.5 + Math.sin(t * 2 + x) * 0.2); ctx.fillRect(x + 7, y + 6, 1, 3);
      break;
    }
    case 'h': { // lamplighter house facade (background)
      const w = 9 * TILE, h = 6 * TILE; const bx = x, by = y + TILE - h;
      ctx.fillStyle = '#1a1e30'; ctx.fillRect(bx, by + 8, w, h - 8); ctx.fillStyle = '#242a44'; ctx.beginPath(); ctx.moveTo(bx - 4, by + 10); ctx.lineTo(bx + w / 2, by - 6); ctx.lineTo(bx + w + 4, by + 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#12151f'; ctx.fillRect(bx + 8, by + 30, 12, 66); // door
      for (let i = 0; i < 3; i++) { const lit = hash2(ent.tx + i, ent.ty) < 0.5; ctx.fillStyle = lit ? `rgba(255,214,140,${0.55 + Math.sin(t * 2 + i) * 0.15})` : '#0e1018'; ctx.fillRect(bx + 32 + i * 34, by + 26, 14, 16); if (lit) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(bx + 39 + i * 34, by + 34, 0, bx + 39 + i * 34, by + 34, 24); g.addColorStop(0, 'rgba(255,190,100,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(bx + 15 + i * 34, by + 10, 48, 48); ctx.globalCompositeOperation = 'source-over'; } }
      ctx.strokeStyle = 'rgba(120,140,200,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 8.5, w - 1, h - 9);
      break;
    }
    case 'N': { // Wick, the old ember-keeper moth
      const cx = x + 8, by = y + 16; ctx.translate(cx, by);
      const flap = Math.sin(t * 2.5) * 0.15;
      ctx.fillStyle = 'rgba(168,154,200,0.85)'; ctx.save(); ctx.rotate(-0.3 + flap); ctx.beginPath(); ctx.ellipse(-8, -12, 8, 4.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate(0.3 - flap); ctx.beginPath(); ctx.ellipse(8, -12, 8, 4.5, 0, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#5c4f7a'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(-7, -14, 0, -18); ctx.quadraticCurveTo(7, -14, 6, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a6b9c'; ctx.beginPath(); ctx.arc(0, -17, 4.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#d8c8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -21); ctx.quadraticCurveTo(-6, -27, -8, -25); ctx.moveTo(2, -21); ctx.quadraticCurveTo(6, -27, 8, -25); ctx.stroke();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(-1.8, -17, 1.1, 0, TAU); ctx.arc(1.8, -17, 1.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a7a50'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(9, -22); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(9, -23, 2, 0, TAU); ctx.fill();
      break;
    }
    case 'W': { // Old Bramble, a hedge-hermit of twigs and moss
      const cx = x + 8, by = y + 16; ctx.translate(cx, by); const breathe = Math.sin(t * 1.6) * 0.03; ctx.scale(1 + breathe, 1 - breathe);
      ctx.strokeStyle = '#3e4a2a'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; for (let i = 0; i < 9; i++) { const a = -Math.PI + i * (Math.PI / 8); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, -9 + Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 12, -9 + Math.sin(a) * 12 - 1); ctx.stroke(); }
      const g = ctx.createRadialGradient(-2, -11, 1, 0, -9, 9); g.addColorStop(0, '#6a8a4a'); g.addColorStop(1, '#2e3a22'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -9, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#b8c86a'; ctx.beginPath(); ctx.ellipse(-3, -13, 1.6, 1.1, 0, 0, TAU); ctx.ellipse(4, -6, 1.4, 1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(-2.5, -10, 1.2, 0, TAU); ctx.arc(2.5, -10, 1.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-9, -14); ctx.moveTo(-9, -14); ctx.lineTo(-11, -17); ctx.stroke();
      break;
    }
    case 'Q': { // Tallow, the snail cartographer with a lantern shell
      const cx = x + 8, by = y + 16; ctx.translate(cx, by);
      ctx.fillStyle = '#8a7a9a'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-4, -6, 6, -5); ctx.quadraticCurveTo(10, -4, 9, 0); ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(-4, -12, 1, -3, -10, 9); g.addColorStop(0, '#ffd9a0'); g.addColorStop(0.6, '#b07a48'); g.addColorStop(1, '#5a3a24'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(-3, -10, 8, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,20,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(-3, -10, 5, 0, 4.5); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,214,140,${0.5 + Math.sin(t * 3) * 0.2})`; ctx.beginPath(); ctx.arc(-3, -10, 3, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#8a7a9a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(9, -12 + Math.sin(t * 2) * 0.5); ctx.moveTo(8, -5); ctx.lineTo(12, -11 + Math.cos(t * 2.3) * 0.5); ctx.stroke();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(9, -12.5, 1.1, 0, TAU); ctx.arc(12, -11.5, 1.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8dcc0'; ctx.fillRect(-1, -3, 6, 4); ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(4, -1); ctx.moveTo(0, 0.5); ctx.lineTo(3, 0.5); ctx.stroke();
      break;
    }
    case 'K': { // the Bell Ringer, a drowned ghost
      const cx = x + 8, by = y + 12 + Math.sin(t * 1.3) * 2; ctx.translate(cx, by); ctx.globalAlpha = 0.75;
      const g = ctx.createLinearGradient(0, -20, 0, 6); g.addColorStop(0, 'rgba(160,220,255,0.9)'); g.addColorStop(1, 'rgba(120,180,255,0)'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-7, 4); ctx.quadraticCurveTo(-8, -16, 0, -20); ctx.quadraticCurveTo(8, -16, 7, 4); for (let i = 3; i >= -3; i--) ctx.lineTo(i * 2.3, 4 + (i % 2 ? 3 : 0)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0c1a2c'; ctx.beginPath(); ctx.ellipse(-2.5, -13, 1.3, 2, 0, 0, TAU); ctx.ellipse(2.5, -13, 1.3, 2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,230,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(11, -14); ctx.stroke(); ctx.fillStyle = 'rgba(200,220,240,0.9)'; ctx.beginPath(); ctx.moveTo(9, -14); ctx.quadraticCurveTo(13, -20, 14, -14); ctx.lineTo(14.5, -12); ctx.lineTo(8.5, -12); ctx.closePath(); ctx.fill();
      break;
    }
    case 'L': {
      ctx.fillStyle = '#4c4a5e'; ctx.beginPath(); ctx.moveTo(x + 3, y + 16); ctx.lineTo(x + 3, y + 4); ctx.quadraticCurveTo(x + 8, y - 1, x + 13, y + 4); ctx.lineTo(x + 13, y + 16); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6a6880'; ctx.fillRect(x + 4, y + 4, 1, 11);
      ctx.globalCompositeOperation = 'lighter'; const a = 0.6 + Math.sin(t * 2 + x) * 0.25; ctx.fillStyle = rgba('#8ce0ff', a);
      ctx.fillRect(x + 6, y + 5, 4, 1); ctx.fillRect(x + 6, y + 7, 2, 1); ctx.fillRect(x + 9, y + 7, 1, 1); ctx.fillRect(x + 6, y + 9, 4, 1); ctx.fillRect(x + 7, y + 11, 2, 1);
      break;
    }
    case 'G': {
      if (!st.closedGates || !st.closedGates.has(ent.tx + ',' + ent.ty)) break;
      ctx.fillStyle = '#2a2230'; ctx.fillRect(x + 2, y, 3, 16); ctx.fillRect(x + 8, y, 3, 16); ctx.fillRect(x + 13, y, 2, 16);
      ctx.fillStyle = '#5a4a60'; ctx.fillRect(x + 2, y, 1, 16); ctx.fillRect(x + 8, y, 1, 16); ctx.fillRect(x + 13, y, 1, 16);
      ctx.fillStyle = '#3a3040'; ctx.fillRect(x, y + 6, 16, 2);
      break;
    }
  }
  ctx.restore();
}
function drawPrompt(ctx, x, y, t) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const by = y + Math.sin(t * 5) * 1.5; ctx.beginPath(); ctx.moveTo(x - 3, by + 3); ctx.lineTo(x, by - 1); ctx.lineTo(x + 3, by + 3); ctx.closePath(); ctx.fill(); ctx.restore();
}
