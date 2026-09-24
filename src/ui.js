// ---- UI layer: HUD, dialogue, menus, map, title, ending (native-res canvas) --
const UI_FONT = "Georgia, 'Times New Roman', serif";
const CONTROLS_TEXT = [
  ['Move', 'Arrows / WASD / Stick'], ['Jump', 'Z / Space / K  (A)'], ['Attack', 'X / J  (X)'], ['Dash', 'C / Shift / L  (B / RB)'],
  ['Focus (heal)', 'hold V / E  (Y)'], ['Up + Attack', 'upward slash'], ['Down + Attack in air', 'pogo bounce'], ['Down + Jump', 'drop through ledges'],
  ['Talk / Read', 'Up  near a stone or friend'], ['Map', 'M / Tab  (Back)'], ['Pause', 'Esc / P  (Start)'],
];
class UI {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.S = 1; this.areaTitle = null; this.toast = null; this.hpShake = 0; this.lastHp = -1;
    this.mapCanvas = document.createElement('canvas'); this.mapDirty = true; this.menuIdx = 0; this.dialogue = null; this.splash = null; this.stats = null;
  }
  resize(scale, w, h) { this.c.width = w; this.c.height = h; this.S = scale; this.ctx.imageSmoothingEnabled = true; }
  showArea(name) { this.areaTitle = { name, t: 0 }; }
  showToast(text, dur = 2.6) { this.toast = { text, t: 0, dur }; }
  // dialogue: lines = [{who, text}]
  startDialogue(lines, onDone) { this.dialogue = { lines, i: 0, shown: 0, t: 0, onDone }; }
  advanceDialogue() {
    const d = this.dialogue; if (!d) return false;
    if (d.shown < d.lines[d.i].text.length) { d.shown = d.lines[d.i].text.length; return true; }
    d.i++; d.shown = 0; if (d.i >= d.lines.length) { const cb = d.onDone; this.dialogue = null; if (cb) cb(); return false; }
    return true;
  }
  showSplash(title, sub, lines, color) { this.splash = { title, sub, lines, color, t: 0 }; }
  update(dt, audio) {
    if (this.areaTitle) { this.areaTitle.t += dt; if (this.areaTitle.t > 4) this.areaTitle = null; }
    if (this.toast) { this.toast.t += dt; if (this.toast.t > this.toast.dur) this.toast = null; }
    if (this.hpShake > 0) this.hpShake -= dt;
    if (this.splash) this.splash.t += dt;
    const d = this.dialogue; if (d) { d.t += dt; const L = d.lines[d.i].text.length; if (d.shown < L) { d.shown = Math.min(L, d.shown + dt * 38); if (audio && Math.floor(d.shown) % 3 === 0) audio.play('text'); } }
  }
  text(str, x, y, size, color = '#fff', align = 'left', bold = false, alpha = 1, font = UI_FONT) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha; c.font = `${bold ? 'bold ' : ''}${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,0.8)'; c.shadowBlur = 3; c.shadowOffsetY = 1; c.fillStyle = color; c.fillText(str, x, y); c.restore();
  }
  glowText(str, x, y, size, color, glow, align = 'center', bold = true) {
    const c = this.ctx; c.save(); c.font = `${bold ? 'bold ' : ''}${size}px ${UI_FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    c.shadowColor = glow; c.shadowBlur = 18; c.fillStyle = color; c.fillText(str, x, y); c.shadowBlur = 6; c.fillText(str, x, y); c.restore();
  }
  panel(x, y, w, h, alpha = 0.82) { const c = this.ctx; c.save(); c.fillStyle = `rgba(8,7,18,${alpha})`; c.strokeStyle = 'rgba(200,190,255,0.35)'; c.lineWidth = 0.8; c.beginPath(); c.roundRect(x, y, w, h, 4); c.fill(); c.stroke(); c.restore(); }
  wrap(str, maxWidth, size) { const c = this.ctx; c.font = `${size}px ${UI_FONT}`; const words = str.split(' '); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

  draw(G) {
    const c = this.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.c.width, this.c.height); c.setTransform(this.S, 0, 0, this.S, 0, 0);
    const st = G.state;
    if (st === 'title') { this.drawTitle(G); return; }
    if (st === 'ending') { this.drawEnding(G); return; }
    this.drawHUD(G);
    if (G.boss && G.boss.alive && G.boss.state !== 'intro') this.drawBossBar(G.boss);
    if (this.areaTitle) { const a = this.areaTitle; const k = a.t < 0.6 ? a.t / 0.6 : a.t > 3.2 ? 1 - (a.t - 3.2) / 0.8 : 1; c.globalAlpha = clamp(k, 0, 1); this.glowText(a.name.toUpperCase(), VIEW_W / 2, 52, 22, '#f2ecff', 'rgba(180,160,255,0.9)'); this.text('— ' + G.world.areaInfo(G.area).sub + ' —', VIEW_W / 2, 68, 9, '#cfc6f0', 'center'); c.globalAlpha = 1; }
    if (this.toast) { const k = this.toast.t < 0.3 ? this.toast.t / 0.3 : this.toast.t > this.toast.dur - 0.5 ? (this.toast.dur - this.toast.t) / 0.5 : 1; c.globalAlpha = clamp(k, 0, 1); this.panel(VIEW_W / 2 - 110, 92, 220, 22); this.text(this.toast.text, VIEW_W / 2, 103, 9.5, '#fff1d0', 'center'); c.globalAlpha = 1; }
    if (this.dialogue) this.drawDialogue();
    if (this.splash) this.drawSplash(G);
    if (st === 'dead') { const k = clamp(G.deathT / 1.2, 0, 1); c.fillStyle = `rgba(0,0,0,${k * 0.75})`; c.fillRect(0, 0, VIEW_W, VIEW_H); if (G.deathT > 0.8) this.glowText('your light fades...', VIEW_W / 2, VIEW_H / 2, 16, '#cfc6f0', 'rgba(120,100,200,0.8)', 'center', false); }
    if (st === 'pause') this.drawPause(G);
    if (st === 'map') this.drawMap(G);
    if (G.fadeAlpha > 0) { c.fillStyle = `rgba(0,0,0,${G.fadeAlpha})`; c.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (G.hint && st === 'play') { this.text(G.hint, VIEW_W / 2, VIEW_H - 14, 8, '#d8d0f0', 'center', false, 0.85); }
  }
  drawHUD(G) {
    const p = G.player; const c = this.ctx;
    if (this.lastHp >= 0 && p.hp < this.lastHp) this.hpShake = 0.4; this.lastHp = p.hp;
    const shake = this.hpShake > 0 ? (Math.random() - 0.5) * 3 : 0;
    // soul vessel
    const sx = 20, sy = 22; c.save(); c.translate(shake, 0);
    c.fillStyle = 'rgba(10,8,22,0.8)'; c.strokeStyle = '#b8b0e0'; c.lineWidth = 1.2; c.beginPath(); c.arc(sx, sy, 9.5, 0, TAU); c.fill(); c.stroke();
    const f = p.soul / PHYS.SOUL_MAX; if (f > 0) { c.save(); c.beginPath(); c.arc(sx, sy, 8, 0, TAU); c.clip(); const pulse = p.focusing ? Math.sin(G.time * 20) * 1.5 : 0; c.fillStyle = f >= PHYS.SOUL_HEAL / PHYS.SOUL_MAX ? '#f4f0ff' : '#9a92c0'; c.fillRect(sx - 9, sy + 8 - f * 16 + pulse, 18, 20); c.restore(); }
    if (p.soul >= PHYS.SOUL_HEAL) { c.shadowColor = '#fff'; c.shadowBlur = 6 + Math.sin(G.time * 4) * 3; c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(sx, sy, 9.5, 0, TAU); c.stroke(); c.shadowBlur = 0; }
    // masks (hp)
    for (let i = 0; i < p.maxHp; i++) {
      const x = 36 + i * 11, y = 16; const full = i < p.hp;
      c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 4, y - 2); c.lineTo(x + 3, y + 5); c.lineTo(x, y + 7); c.lineTo(x - 3, y + 5); c.lineTo(x - 4, y - 2); c.closePath();
      c.fillStyle = full ? '#f6f2ff' : 'rgba(30,26,50,0.8)'; c.fill(); c.strokeStyle = full ? '#d8d0ff' : '#5a5478'; c.lineWidth = 0.8; c.stroke();
      if (full) { c.fillStyle = '#2a2648'; c.fillRect(x - 2, y - 1, 1.2, 2); c.fillRect(x + 1, y - 1, 1.2, 2); }
    }
    c.restore();
    // ability icons (small, bottom-left)
    const ab = p.abilities; const icons = [['dash', '#5ad8ff', 'C'], ['walljump', '#8cff9a', 'W'], ['doublejump', '#d49aff', 'D']];
    let ix = 14; for (const [k, col, letter] of icons) { if (!ab[k]) continue; c.fillStyle = 'rgba(10,8,22,0.7)'; c.beginPath(); c.arc(ix, VIEW_H - 14, 6, 0, TAU); c.fill(); c.strokeStyle = col; c.lineWidth = 1; c.stroke(); this.text(letter, ix, VIEW_H - 14, 7, col, 'center', true); ix += 16; }
    // shard counter
    this.text(`✦ ${G.shardsCollected}/${G.shardsTotal}`, VIEW_W - 12, 16, 9, '#ffb0cc', 'right');
  }
  drawBossBar(b) {
    const c = this.ctx; const w = 200, x = VIEW_W / 2 - w / 2, y = VIEW_H - 22;
    this.text('THE WARDEN', VIEW_W / 2, y - 8, 9, '#ffd0c0', 'center', true);
    c.fillStyle = 'rgba(10,6,10,0.85)'; c.fillRect(x, y, w, 5); const f = b.hp / b.maxHp; c.fillStyle = b.phase === 2 ? '#ff5a3a' : '#ffb347'; c.fillRect(x + 1, y + 1, (w - 2) * f, 3); c.strokeStyle = '#c8a090'; c.lineWidth = 0.7; c.strokeRect(x, y, w, 5);
  }
  drawDialogue() {
    const d = this.dialogue; const line = d.lines[d.i]; const w = 380, h = 54, x = VIEW_W / 2 - w / 2, y = VIEW_H - h - 14;
    this.panel(x, y, w, h, 0.88);
    this.text(line.who, x + 12, y + 11, 9, '#ffd98a', 'left', true);
    const lines = this.wrap(line.text.slice(0, Math.floor(d.shown)), w - 24, 9.5); lines.forEach((ln, i) => this.text(ln, x + 12, y + 25 + i * 11, 9.5, '#efeaff'));
    if (d.shown >= line.text.length && Math.sin(d.t * 6) > 0) this.text('▼', x + w - 12, y + h - 8, 8, '#cfc6f0', 'center');
  }
  drawSplash(G) {
    const s = this.splash; const c = this.ctx; const k = clamp(s.t / 0.4, 0, 1);
    c.fillStyle = `rgba(0,0,0,${0.55 * k})`; c.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 300, h = 100 + s.lines.length * 12, x = VIEW_W / 2 - w / 2, y = VIEW_H / 2 - h / 2 + (1 - k) * 20; c.globalAlpha = k;
    this.panel(x, y, w, h, 0.9);
    this.glowText(s.title, VIEW_W / 2, y + 24, 20, '#ffffff', s.color);
    this.text(s.sub, VIEW_W / 2, y + 44, 9.5, s.color, 'center', false);
    s.lines.forEach((ln, i) => this.text(ln, VIEW_W / 2, y + 62 + i * 12, 9, '#e8e2ff', 'center'));
    if (s.t > 0.8 && Math.sin(s.t * 5) > -0.3) this.text('press Jump or Attack to continue', VIEW_W / 2, y + h - 12, 7.5, '#a8a0c8', 'center');
    c.globalAlpha = 1;
  }
  drawTitle(G) {
    const c = this.ctx; const t = G.time;
    c.fillStyle = 'rgba(4,3,12,0.55)'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    const gl = 0.6 + Math.sin(t * 1.5) * 0.25;
    this.glowText('GLIMMERDEEP', VIEW_W / 2, 78, 40, '#f6f2ff', `rgba(150,140,255,${gl})`);
    this.text('a light in the hollow', VIEW_W / 2, 104, 11, '#cfc6f0', 'center', false, 0.9);
    const opts = G.hasSave ? ['Continue', 'New Game'] : ['New Game'];
    opts.forEach((o, i) => { const sel = i === this.menuIdx; this.text((sel ? '✦ ' : '') + o + (sel ? ' ✦' : ''), VIEW_W / 2, 150 + i * 18, sel ? 13 : 11, sel ? '#ffffff' : '#9a92c0', 'center', sel); });
    if (G.hasSave && this.menuIdx === 1) this.text('(erases your current journey)', VIEW_W / 2, 186, 7.5, '#a08090', 'center');
    this.text('Z / Space / K  ·  jump      X / J  ·  attack      C / Shift / L  ·  dash      hold V / E  ·  focus', VIEW_W / 2, VIEW_H - 30, 7.5, '#8a82b0', 'center');
    this.text('Arrows / WASD to move  ·  M for map  ·  Esc to pause  ·  gamepad supported', VIEW_W / 2, VIEW_H - 18, 7.5, '#8a82b0', 'center');
    if (!G.audioStarted) this.text('(press any key to begin — sound starts on first input)', VIEW_W / 2, 128, 7.5, '#6f6890', 'center');
  }
  drawPause(G) {
    const c = this.ctx; c.fillStyle = 'rgba(2,2,8,0.72)'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    this.glowText('PAUSED', VIEW_W / 2, 30, 20, '#f6f2ff', 'rgba(150,140,255,0.8)');
    const opts = ['Resume', G.resetConfirm ? 'Really erase save? (confirm)' : 'Erase save & restart'];
    opts.forEach((o, i) => { const sel = i === this.menuIdx; this.text((sel ? '✦ ' : '') + o, VIEW_W / 2, 52 + i * 14, sel ? 11 : 10, sel ? '#fff' : '#9a92c0', 'center', sel); });
    const x0 = 60, y0 = 92; this.text('CONTROLS', x0, y0, 9, '#ffd98a', 'left', true);
    CONTROLS_TEXT.forEach(([k, v], i) => { const col = i % 2, row = Math.floor(i / 2); this.text(k, x0 + col * 200, y0 + 14 + row * 11, 8, '#e8e2ff'); this.text(v, x0 + col * 200 + 80, y0 + 14 + row * 11, 8, '#a8a0c8'); });
    const p = G.player; const mm = Math.floor(G.playtime / 60), ss = Math.floor(G.playtime % 60);
    this.text(`Time ${mm}:${String(ss).padStart(2, '0')}   ·   Deaths ${G.deaths}   ·   Shards ${G.shardsCollected}/${G.shardsTotal}   ·   Abilities: ${['dash', 'walljump', 'doublejump'].filter((k) => p.abilities[k]).join(', ') || 'none yet'}`, VIEW_W / 2, VIEW_H - 22, 8, '#cfc6f0', 'center');
  }
  drawMap(G) {
    const c = this.ctx; c.fillStyle = 'rgba(2,2,8,0.85)'; c.fillRect(0, 0, VIEW_W, VIEW_H);
    const W = G.world; const cellsX = Math.ceil(W.w / MAP_CELL), cellsY = Math.ceil(W.h / MAP_CELL);
    const scale = Math.min(430 / W.w, 210 / W.h); const mw = W.w * scale, mh = W.h * scale; const ox = VIEW_W / 2 - mw / 2, oy = 34;
    if (this.mapDirty) {
      const px = 3; const mc = this.mapCanvas; mc.width = W.w * px; mc.height = W.h * px; const m = mc.getContext('2d');
      m.clearRect(0, 0, mc.width, mc.height);
      for (let cy = 0; cy < cellsY; cy++) for (let cx = 0; cx < cellsX; cx++) {
        if (!G.explored[cy * cellsX + cx]) continue;
        for (let ty = cy * MAP_CELL; ty < Math.min(W.h, (cy + 1) * MAP_CELL); ty++) for (let tx = cx * MAP_CELL; tx < Math.min(W.w, (cx + 1) * MAP_CELL); tx++) {
          const ch = W.tile(tx, ty); const pal = PALETTES[W.areaAt(tx, ty)];
          if (ch === '#' || ch === 'I' || ch === 'D') m.fillStyle = mixHex(pal.top, pal.rock, 0.5); else if (ch === '^' || ch === '~') m.fillStyle = '#4a3050'; else m.fillStyle = 'rgba(20,18,40,0.9)';
          m.fillRect(tx * px, ty * px, px, px);
        }
      }
      this.mapDirty = false;
    }
    c.imageSmoothingEnabled = true; c.drawImage(this.mapCanvas, ox, oy, mw, mh);
    c.strokeStyle = 'rgba(200,190,255,0.3)'; c.lineWidth = 0.8; c.strokeRect(ox, oy, mw, mh);
    // markers
    for (const b of G.benchesSeen) { const x = ox + (b[0] + 0.5) * scale, y = oy + (b[1] + 0.5) * scale; c.fillStyle = '#ffd27a'; c.fillRect(x - 2, y - 2, 4, 4); }
    const p = G.player; if (Math.sin(G.time * 8) > -0.2) { const x = ox + (p.x + p.w / 2) / TILE * scale, y = oy + (p.y + p.h / 2) / TILE * scale; c.fillStyle = '#ffffff'; c.shadowColor = '#fff'; c.shadowBlur = 6; c.beginPath(); c.arc(x, y, 2.5, 0, TAU); c.fill(); c.shadowBlur = 0; }
    this.glowText(W.areaInfo(G.area).name.toUpperCase(), VIEW_W / 2, 18, 13, '#f6f2ff', 'rgba(150,140,255,0.8)');
    this.text('■ bench    ● you    ·    M / Tab to close', VIEW_W / 2, VIEW_H - 12, 8, '#a8a0c8', 'center');
  }
  drawEnding(G) {
    const c = this.ctx; const t = G.endingT; const k = clamp(t / 2, 0, 1);
    c.fillStyle = `rgba(255,244,220,${k * 0.92})`; c.fillRect(0, 0, VIEW_W, VIEW_H);
    if (t < 1.5) return;
    const a = clamp((t - 1.5) / 1.5, 0, 1); c.globalAlpha = a;
    this.glowText('THE GLIMMERDEEP BREATHES AGAIN', VIEW_W / 2, 70, 18, '#3a2a10', 'rgba(255,200,100,0.9)');
    const lines = ['The Warden is undone. Warmth returns to the roots of the world,', 'and the little light that walked so far may finally rest.', '', `Time  ${Math.floor(G.playtime / 60)}:${String(Math.floor(G.playtime % 60)).padStart(2, '0')}     Deaths  ${G.deaths}     Life shards  ${G.shardsCollected}/${G.shardsTotal}`];
    lines.forEach((ln, i) => this.text(ln, VIEW_W / 2, 105 + i * 14, 10, '#4a3a20', 'center'));
    if (t > 4) this.text(G.shardsCollected < G.shardsTotal ? 'press Jump to keep exploring — shards still hide in the deep' : 'press Jump to keep exploring — you found everything', VIEW_W / 2, 200, 9, '#6a5a30', 'center');
    c.globalAlpha = 1;
  }
}
const MAP_CELL = 8;
