// ---- UI layer: HUD, dialogue, menus, map, title, intro, ending (native-res canvas) --
const UI_FONT = "Georgia, 'Times New Roman', serif";
const CONTROLS_TEXT = [
  ['Move', 'Arrows / WASD / Stick'], ['Jump', 'Z / Space / K  (A)'], ['Strike', 'X / J  (X)'], ['Windstep (dash)', 'C / Shift / L  (B / RB)'],
  ['Cinder (spell)', 'tap V / E  (Y)'], ['Rekindle (heal)', 'hold V / E  (Y)'], ['Up + Strike', 'strike upward'], ['Down + Strike in air', 'bounce off foes & thorns'],
  ['Down + Jump', 'drop through ledges'], ['Talk / Read / Rest', 'Up near someone or something'], ['Map', 'M / Tab  (Back)'], ['Pause', 'Esc / P  (Start)'],
];
const MAP_CELL = 8;
class UI {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.S = 1; this.W = VIEW_W; this.H = VIEW_H;
    this.areaTitle = null; this.toast = null; this.hpShake = 0; this.lastHp = -1; this.petalGrow = 0; this.emberPulse = 0; this.lastSoul = 0;
    this.mapCanvas = document.createElement('canvas'); this.mapDirty = true; this.menuIdx = 0; this.dialogue = null; this.splash = null; this.bossCard = null; this.intro = null;
  }
  resize(scale, w, h, viewW, viewH) { this.c.width = w; this.c.height = h; this.S = scale; this.W = viewW; this.H = viewH; this.ctx.imageSmoothingEnabled = true; }
  showArea(name) { this.areaTitle = { name, t: 0 }; }
  showToast(text, dur = 2.6) { this.toast = { text, t: 0, dur }; }
  showBossCard(name, sub) { this.bossCard = { name, sub, t: 0 }; }
  startDialogue(lines, onDone) { this.dialogue = { lines, i: 0, shown: 0, t: 0, onDone }; }
  advanceDialogue() {
    const d = this.dialogue; if (!d) return false;
    if (d.shown < d.lines[d.i].text.length) { d.shown = d.lines[d.i].text.length; return true; }
    d.i++; d.shown = 0; if (d.i >= d.lines.length) { const cb = d.onDone; this.dialogue = null; if (cb) cb(); return false; }
    return true;
  }
  showSplash(title, sub, lines, color) { this.splash = { title, sub, lines, color, t: 0 }; }
  startIntro(pages) { this.intro = { pages, i: 0, t: 0 }; }
  update(dt, audio) {
    if (this.areaTitle) { this.areaTitle.t += dt; if (this.areaTitle.t > 4) this.areaTitle = null; }
    if (this.toast) { this.toast.t += dt; if (this.toast.t > this.toast.dur) this.toast = null; }
    if (this.bossCard) { this.bossCard.t += dt; if (this.bossCard.t > 4.2) this.bossCard = null; }
    if (this.hpShake > 0) this.hpShake -= dt; if (this.petalGrow > 0) this.petalGrow -= dt; if (this.emberPulse > 0) this.emberPulse -= dt;
    if (this.splash) this.splash.t += dt; if (this.intro) this.intro.t += dt;
    const d = this.dialogue; if (d) { d.t += dt; const L = d.lines[d.i].text.length; if (d.shown < L) { d.shown = Math.min(L, d.shown + dt * 38); if (audio && Math.floor(d.shown) % 3 === 0) audio.play('text'); } }
  }
  text(str, x, y, size, color = '#fff', align = 'left', bold = false, alpha = 1, font = UI_FONT) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.font = `${bold ? 'bold ' : ''}${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillText(str, x + 0.6, y + 0.9); c.fillStyle = color; c.fillText(str, x, y); c.restore(); // cheap offset shadow instead of shadowBlur
  }
  glowText(str, x, y, size, color, glow, align = 'center', bold = true) {
    const c = this.ctx; c.save(); c.font = `${bold ? 'bold ' : ''}${size}px ${UI_FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    c.shadowColor = glow; c.shadowBlur = 18; c.fillStyle = color; c.fillText(str, x, y); c.shadowBlur = 6; c.fillText(str, x, y); c.restore();
  }
  panel(x, y, w, h, alpha = 0.82) { const c = this.ctx; c.save(); c.fillStyle = `rgba(8,7,18,${alpha})`; c.strokeStyle = 'rgba(255,214,140,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.roundRect(x, y, w, h, 4); c.fill(); c.stroke(); c.restore(); }
  wrap(str, maxWidth, size) { const c = this.ctx; c.font = `${size}px ${UI_FONT}`; const words = str.split(' '); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

  draw(G) {
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.c.width, this.c.height); c.setTransform(this.S, 0, 0, this.S, 0, 0);
    const st = G.state; const W = this.W, H = this.H;
    if (st === 'title') { this.drawTitle(G); return; }
    if (st === 'intro') { this.drawIntro(G); return; }
    if (st === 'ending') { this.drawEnding(G); return; }
    this.drawHUD(G);
    if (G.boss && G.boss.alive && G.boss.state !== 'intro') this.drawBossBar(G);
    if (this.bossCard) { const a = this.bossCard; const k = a.t < 0.5 ? a.t / 0.5 : a.t > 3.4 ? 1 - (a.t - 3.4) / 0.8 : 1; c.globalAlpha = clamp(k, 0, 1); this.glowText(a.name, W / 2, H * 0.3, 26, '#ffe0c0', 'rgba(255,90,60,0.9)'); this.text('— ' + a.sub + ' —', W / 2, H * 0.3 + 18, 10, '#f0c8b0', 'center'); c.globalAlpha = 1; }
    else if (this.areaTitle) { const a = this.areaTitle; const k = a.t < 0.6 ? a.t / 0.6 : a.t > 3.2 ? 1 - (a.t - 3.2) / 0.8 : 1; c.globalAlpha = clamp(k, 0, 1); this.glowText(a.name.toUpperCase(), W / 2, 52, 22, '#f2ecff', 'rgba(255,200,120,0.8)'); this.text('— ' + G.world.areaInfo(G.area).sub + ' —', W / 2, 68, 9, '#e0d0c0', 'center'); c.globalAlpha = 1; }
    if (this.toast) { const k = this.toast.t < 0.3 ? this.toast.t / 0.3 : this.toast.t > this.toast.dur - 0.5 ? (this.toast.dur - this.toast.t) / 0.5 : 1; c.globalAlpha = clamp(k, 0, 1); const lines = this.wrap(this.toast.text, 260, 9.5); this.panel(W / 2 - 140, 88, 280, 12 + lines.length * 11); lines.forEach((ln, i) => this.text(ln, W / 2, 99 + i * 11, 9.5, '#fff1d0', 'center')); c.globalAlpha = 1; }
    if (this.dialogue) this.drawDialogue();
    if (this.splash) this.drawSplash(G);
    if (st === 'dead') { const k = clamp(G.deathT / 1.2, 0, 1); c.fillStyle = `rgba(0,0,0,${k * 0.75})`; c.fillRect(0, 0, W, H); if (G.deathT > 0.8) this.glowText('the last petal falls...', W / 2, H / 2, 16, '#f0d8c0', 'rgba(255,120,80,0.8)', 'center', false); }
    if (st === 'pause') this.drawPause(G);
    if (st === 'map') this.drawMap(G);
    if (G.fadeAlpha > 0) { c.fillStyle = `rgba(0,0,0,${G.fadeAlpha})`; c.fillRect(0, 0, W, H); }
    if (G.hint && st === 'play') this.text(G.hint, W / 2, H - 14, 8, '#e8dcc8', 'center', false, 0.85);
  }
  // Health = petals of the glowbloom arranged around an ember lantern
  drawHUD(G) {
    const p = G.player; const c = this.ctx; const t = G.time;
    if (this.lastHp >= 0 && p.hp < this.lastHp) this.hpShake = 0.4; if (this.lastHp >= 0 && p.hp > this.lastHp) this.petalGrow = 0.6; this.lastHp = p.hp;
    if (p.soul > this.lastSoul) this.emberPulse = 0.3; this.lastSoul = p.soul;
    const shake = this.hpShake > 0 ? (Math.random() - 0.5) * 3 : 0;
    const lx = 30, ly = 30; c.save(); c.translate(shake, 0);
    // lantern body (art/icon_lantern.svg, or a drawn one until it has loaded)
    const art = Art.ready && Art.draw(c, 'icon_lantern', lx, ly, { scale: 0.9 });
    if (!art) {
      c.fillStyle = 'rgba(12,10,22,0.85)'; c.strokeStyle = '#8a7a5a'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(lx - 8, ly - 11, 16, 22, 3); c.fill(); c.stroke();
      c.fillStyle = '#6a5a3a'; c.fillRect(lx - 4, ly - 15, 8, 4); c.beginPath(); c.arc(lx, ly - 16, 3, Math.PI, 0); c.stroke();
    }
    const glass = art ? [lx - 5.7, ly - 7.5, 11.4, 16.8, 2.2] : [lx - 6, ly - 9, 12, 18, 2], body = art ? [lx - 6.3, ly - 8.1, 12.6, 18, 2.7] : [lx - 8, ly - 11, 16, 22, 3];
    const f = p.soul / PHYS.SOUL_MAX; const full = p.soul >= PHYS.SOUL_MAX; const gb = glass[1] + glass[3], gh = glass[3];
    c.save(); c.beginPath(); c.roundRect(...glass); c.clip();
    const eg = c.createLinearGradient(0, gb - f * gh, 0, gb); eg.addColorStop(0, full ? '#fff4d0' : '#ffb347'); eg.addColorStop(1, '#ff6a2a'); c.fillStyle = eg; const wob = Math.sin(t * 6) * 0.6 + (this.emberPulse > 0 ? this.emberPulse * 3 : 0);
    c.fillRect(glass[0] - 1, gb - f * gh - wob, glass[2] + 2, gh + 4); c.restore();
    if (full) { c.shadowColor = '#ffd080'; c.shadowBlur = 10 + Math.sin(t * 5) * 5; c.strokeStyle = 'rgba(255,220,150,0.8)'; c.lineWidth = 1; c.beginPath(); c.roundRect(...body); c.stroke(); c.shadowBlur = 0; }
    else if (p.soul >= PHYS.SOUL_HEAL) { c.shadowColor = '#ffb347'; c.shadowBlur = 6; c.strokeStyle = 'rgba(255,180,100,0.5)'; c.beginPath(); c.roundRect(...body); c.stroke(); c.shadowBlur = 0; }
    // petals fan out to the right of the lantern
    for (let i = 0; i < p.maxHp; i++) {
      const ang = -1.15 + i * (2.3 / Math.max(1, p.maxHp - 1)); const r = 24; const px = lx + 8 + Math.cos(ang * 0.55) * r * 0.9, py = ly + Math.sin(ang) * r;
      const alive = i < p.hp; const grow = alive && i === p.hp - 1 && this.petalGrow > 0 ? 1 + this.petalGrow * 0.6 : 1;
      c.save(); c.translate(px, py); c.rotate(ang * 0.55 + Math.PI / 2 + Math.sin(t * 2 + i) * 0.05); c.scale(grow, grow);
      if (Art.ready && Art.has('icon_petal')) { if (alive) { c.shadowColor = 'rgba(255,140,190,0.8)'; c.shadowBlur = 6; } Art.draw(c, 'icon_petal', 0, 0, { scale: 0.85, alpha: alive ? 1 : 0.22 }); c.shadowBlur = 0; }
      else {
        if (alive) { const pg = c.createLinearGradient(0, -6, 0, 6); pg.addColorStop(0, '#ffe2ec'); pg.addColorStop(1, '#ff7aa8'); c.fillStyle = pg; c.shadowColor = 'rgba(255,140,190,0.8)'; c.shadowBlur = 6; }
        else { c.fillStyle = 'rgba(40,30,50,0.85)'; }
        c.beginPath(); c.moveTo(0, -6.5); c.quadraticCurveTo(4.5, -2, 0, 6); c.quadraticCurveTo(-4.5, -2, 0, -6.5); c.fill();
        c.shadowBlur = 0; c.strokeStyle = alive ? 'rgba(255,255,255,0.6)' : 'rgba(150,120,160,0.5)'; c.lineWidth = 0.7; c.stroke();
      }
      c.restore();
    }
    c.restore();
    // splinter damage + gifts (bottom-left)
    const ab = p.abilities; const icons = [['dash', '#5ad8ff', 'W'], ['walljump', '#8cff9a', 'R'], ['doublejump', '#d49aff', 'S'], ['spell', '#ffb347', 'C']];
    let ix = 14; for (const [k, col, letter] of icons) { if (!ab[k]) continue; c.fillStyle = 'rgba(10,8,22,0.7)'; c.beginPath(); c.arc(ix, this.H - 14, 6, 0, TAU); c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke(); this.text(letter, ix, this.H - 14, 7, col, 'center', true); ix += 16; }
    if (p.damage > 1) this.text('keen splinter', ix + 4, this.H - 14, 7.5, '#ffd9a0', 'left');
    this.text(`❀ ${G.petalsFound}/${G.petalsTotal}`, this.W - 12, 16, 9, '#ffb0cc', 'right');
    if (G.heartwood > 0 || G.heartwoodUsed > 0) this.text(`✦ heartwood ${G.heartwood}`, this.W - 12, 28, 8, '#ffd9a0', 'right');
  }
  drawBossBar(G) {
    const b = G.boss; const c = this.ctx; const w = 200, x = this.W / 2 - w / 2, y = this.H - 22;
    this.text(G.bossName || '', this.W / 2, y - 8, 9, '#ffd0c0', 'center', true);
    c.fillStyle = 'rgba(10,6,10,0.85)'; c.fillRect(x, y, w, 5); const f = b.hp / b.maxHp; c.fillStyle = b.phase >= 2 ? '#ff5a3a' : '#ffb347'; c.fillRect(x + 1, y + 1, (w - 2) * f, 3); c.strokeStyle = '#c8a090'; c.lineWidth = 0.7; c.strokeRect(x, y, w, 5);
  }
  drawDialogue() {
    const d = this.dialogue; const line = d.lines[d.i]; const w = Math.min(380, this.W - 30), h = 58, x = this.W / 2 - w / 2, y = this.H - h - 14;
    this.panel(x, y, w, h, 0.9);
    this.text(line.who, x + 12, y + 11, 9, '#ffd98a', 'left', true);
    const lines = this.wrap(line.text.slice(0, Math.floor(d.shown)), w - 24, 9.5); lines.forEach((ln, i) => this.text(ln, x + 12, y + 25 + i * 11, 9.5, '#efeaff'));
    if (d.shown >= line.text.length && Math.sin(d.t * 6) > 0) this.text('▼', x + w - 12, y + h - 8, 8, '#cfc6f0', 'center');
  }
  drawSplash(G) {
    const s = this.splash; const c = this.ctx; const k = clamp(s.t / 0.4, 0, 1);
    c.fillStyle = `rgba(0,0,0,${0.55 * k})`; c.fillRect(0, 0, this.W, this.H);
    const w = 300, h = 100 + s.lines.length * 12, x = this.W / 2 - w / 2, y = this.H / 2 - h / 2 + (1 - k) * 20; c.globalAlpha = k;
    this.panel(x, y, w, h, 0.9);
    this.glowText(s.title, this.W / 2, y + 24, 20, '#ffffff', s.color);
    this.text(s.sub, this.W / 2, y + 44, 9.5, s.color, 'center', false);
    s.lines.forEach((ln, i) => this.text(ln, this.W / 2, y + 62 + i * 12, 9, '#e8e2ff', 'center'));
    if (s.t > 0.8 && Math.sin(s.t * 5) > -0.3) this.text('press Jump or Strike to continue', this.W / 2, y + h - 12, 7.5, '#a8a0c8', 'center');
    c.globalAlpha = 1;
  }
  drawTitle(G) {
    const c = this.ctx; const t = G.time; const W = this.W, H = this.H;
    c.fillStyle = 'rgba(4,3,12,0.55)'; c.fillRect(0, 0, W, H);
    const gl = 0.6 + Math.sin(t * 1.5) * 0.25;
    const logo = Art.ready && Art.has('logo');
    if (logo) { c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, 120); g.addColorStop(0, `rgba(255,170,90,${gl * 0.35})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); Art.draw(c, 'logo', W / 2, H * 0.3, { scale: Math.min(0.72, (W - 40) / 420) }); }
    else this.glowText('GLIMMERDEEP', W / 2, H * 0.3, 40, '#fff4e0', `rgba(255,180,100,${gl})`);
    this.text('a spark against the hush', W / 2, H * 0.3 + (logo ? 37 : 26), 11, '#e0d0c0', 'center', false, 0.9);
    const opts = G.hasSave ? ['Continue', 'New Game'] : ['New Game'];
    opts.forEach((o, i) => { const sel = i === this.menuIdx; this.text((sel ? '✦ ' : '') + o + (sel ? ' ✦' : ''), W / 2, H * 0.58 + i * 18, sel ? 13 : 11, sel ? '#ffffff' : '#9a92c0', 'center', sel); });
    if (G.hasSave && this.menuIdx === 1) this.text('(erases your current journey)', W / 2, H * 0.58 + 36, 7.5, '#a08090', 'center');
    this.text('Z / Space / K · jump      X / J · strike      C / Shift / L · windstep      V / E · tap to throw a cinder, hold to rekindle', W / 2, H - 30, 7.5, '#8a82b0', 'center');
    this.text('Arrows / WASD to move  ·  M for map  ·  Esc to pause  ·  gamepad supported', W / 2, H - 18, 7.5, '#8a82b0', 'center');
    if (!G.audioStarted) this.text('(press any key to begin — sound starts on first input)', W / 2, H * 0.3 + (logo ? 53 : 46), 7.5, '#6f6890', 'center');
  }
  drawIntro(G) {
    const c = this.ctx; const it = this.intro; const W = this.W, H = this.H;
    c.fillStyle = '#05040c'; c.fillRect(0, 0, W, H);
    if (!it) return;
    const page = it.pages[it.i]; const k = clamp(it.t / 1.2, 0, 1);
    c.globalAlpha = k;
    // an ember drifting up behind the words
    c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(W / 2, H * 0.62 - it.t * 6, 0, W / 2, H * 0.62 - it.t * 6, 60); g.addColorStop(0, 'rgba(255,170,90,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
    const lines = []; for (const para of page) lines.push(...this.wrap(para, Math.min(360, W - 60), 11), '');
    const y0 = H / 2 - (lines.length * 14) / 2;
    lines.forEach((ln, i) => { const lk = clamp((it.t - 0.3 - i * 0.25) / 0.8, 0, 1); this.text(ln, W / 2, y0 + i * 14, 11, '#e8dcc8', 'center', false, lk); });
    if (it.t > 1.5 + lines.length * 0.25) this.text(it.i < it.pages.length - 1 ? 'Jump · continue' : 'Jump · begin', W / 2, H - 22, 8, '#a89880', 'center', false, 0.5 + Math.sin(it.t * 4) * 0.3);
    this.text('Esc · skip', W - 14, H - 22, 7.5, '#6a6070', 'right');
    c.globalAlpha = 1;
  }
  drawPause(G) {
    const c = this.ctx; const W = this.W, H = this.H; c.fillStyle = 'rgba(2,2,8,0.72)'; c.fillRect(0, 0, W, H);
    this.glowText('PAUSED', W / 2, 26, 20, '#f6f2ff', 'rgba(255,180,100,0.8)');
    const opts = ['Resume', G.resetConfirm ? 'Really erase save? (confirm)' : 'Erase save & restart'];
    opts.forEach((o, i) => { const sel = i === this.menuIdx; this.text((sel ? '✦ ' : '') + o, W / 2, 46 + i * 13, sel ? 11 : 10, sel ? '#fff' : '#9a92c0', 'center', sel); });
    const x0 = W / 2 - 180, y0 = 82; this.text('CONTROLS', x0, y0, 9, '#ffd98a', 'left', true);
    CONTROLS_TEXT.forEach(([k, v], i) => { const col = i % 2, row = Math.floor(i / 2); this.text(k, x0 + col * 185, y0 + 14 + row * 11, 8, '#e8e2ff'); this.text(v, x0 + col * 185 + 82, y0 + 14 + row * 11, 8, '#a8a0c8'); });
    const p = G.player; const mm = Math.floor(G.playtime / 60), ss = Math.floor(G.playtime % 60);
    this.text(`${mm}:${String(ss).padStart(2, '0')} played  ·  ${G.deaths} falls  ·  petals ${G.petalsFound}/${G.petalsTotal}  ·  gifts: ${[['dash', 'Windstep'], ['walljump', 'Rootgrip'], ['doublejump', 'Skyleaf'], ['spell', 'Cinder']].filter(([k]) => p.abilities[k]).map(([, n]) => n).join(', ') || 'none yet'}`, W / 2, H - 22, 8, '#cfc6f0', 'center');
  }
  drawMap(G) {
    const c = this.ctx; const W = this.W, H = this.H; c.fillStyle = 'rgba(2,2,8,0.85)'; c.fillRect(0, 0, W, H);
    const Wd = G.world; const cellsX = Math.ceil(Wd.w / MAP_CELL), cellsY = Math.ceil(Wd.h / MAP_CELL);
    const scale = Math.min((W - 50) / Wd.w, (H - 62) / Wd.h); const mw = Wd.w * scale, mh = Wd.h * scale; const ox = W / 2 - mw / 2, oy = 34;
    if (this.mapDirty) {
      const px = 3; const mc = this.mapCanvas; mc.width = Wd.w * px; mc.height = Wd.h * px; const m = mc.getContext('2d');
      m.clearRect(0, 0, mc.width, mc.height);
      for (let cy = 0; cy < cellsY; cy++) for (let cx = 0; cx < cellsX; cx++) {
        if (!G.explored[cy * cellsX + cx]) continue;
        for (let ty = cy * MAP_CELL; ty < Math.min(Wd.h, (cy + 1) * MAP_CELL); ty++) for (let tx = cx * MAP_CELL; tx < Math.min(Wd.w, (cx + 1) * MAP_CELL); tx++) {
          const ch = Wd.tile(tx, ty); const pal = PALETTES[Wd.areaAt(tx, ty)];
          if (ch === '#' || ch === 'I' || ch === 'D') m.fillStyle = mixHex(pal.top, pal.rock, 0.5); else if (ch === '^' || ch === '~') m.fillStyle = '#4a3050'; else m.fillStyle = 'rgba(20,18,40,0.9)';
          m.fillRect(tx * px, ty * px, px, px);
        }
      }
      this.mapDirty = false;
    }
    c.imageSmoothingEnabled = true; c.drawImage(this.mapCanvas, ox, oy, mw, mh);
    c.strokeStyle = 'rgba(255,214,140,0.3)'; c.lineWidth = 0.8; c.strokeRect(ox, oy, mw, mh);
    for (const b of G.benchesSeen) { const x = ox + (b[0] + 0.5) * scale, y = oy + (b[1] + 0.5) * scale; c.fillStyle = '#ffb347'; c.beginPath(); c.arc(x, y, 2, 0, TAU); c.fill(); }
    const p = G.player; if (Math.sin(G.time * 8) > -0.2) { const x = ox + (p.x + p.w / 2) / TILE * scale, y = oy + (p.y + p.h / 2) / TILE * scale; c.fillStyle = '#ffffff'; c.shadowColor = '#fff'; c.shadowBlur = 6; c.beginPath(); c.arc(x, y, 2.5, 0, TAU); c.fill(); c.shadowBlur = 0; }
    this.glowText(Wd.areaInfo(G.area).name.toUpperCase(), W / 2, 18, 13, '#f6f2ff', 'rgba(255,180,100,0.8)');
    this.text('● hearth    ○ you    ·    M / Tab to close', W / 2, H - 12, 8, '#a8a0c8', 'center');
  }
  drawEnding(G) {
    const c = this.ctx; const t = G.endingT; const k = clamp(t / 2, 0, 1); const W = this.W, H = this.H;
    c.fillStyle = `rgba(255,244,220,${k * 0.92})`; c.fillRect(0, 0, W, H);
    if (t < 1.5) return;
    const a = clamp((t - 1.5) / 1.5, 0, 1); c.globalAlpha = a;
    const complete = G.petalsFound >= G.petalsTotal && G.heartwoodUsed >= 2;
    this.glowText(complete ? 'THE HEARTHROOT WAKES' : 'THE GLIMMERDEEP BREATHES AGAIN', W / 2, 62, 18, '#3a2a10', 'rgba(255,200,100,0.9)');
    const lines = complete
      ? ['The Great Lantern breaks, and the light Sorrel hoarded pours back into the roots.', 'Every petal you gathered opens at once; the tree above stirs in its sleep and dreams of morning.', 'Wick says the hush will not return while a single spark remembers it. He is looking at you.']
      : ['The Great Lantern breaks, and the light Sorrel hoarded pours back into the roots.', 'The hush loosens its grip on the deep. Somewhere far below, a bell rings once, and is answered.', 'Petals still sleep in the dark, and old heartwood waits to be carved. The deep is not finished with you.'];
    let y = 92; for (const ln of lines) { const ws = this.wrap(ln, Math.min(380, W - 60), 10); ws.forEach((w2) => { this.text(w2, W / 2, y, 10, '#4a3a20', 'center'); y += 13; }); y += 4; }
    this.text(`Time  ${Math.floor(G.playtime / 60)}:${String(Math.floor(G.playtime % 60)).padStart(2, '0')}     Falls  ${G.deaths}     Petals  ${G.petalsFound}/${G.petalsTotal}     Heartwood carved  ${G.heartwoodUsed}/2`, W / 2, y + 6, 9.5, '#5a4a30', 'center');
    if (t > 4) this.text('press Jump to keep exploring', W / 2, H - 28, 9, '#6a5a30', 'center');
    c.globalAlpha = 1;
  }
}
