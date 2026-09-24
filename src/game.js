// ---- Game: state machine, main loop, world/entity orchestration ----------------
const ABILITY_INFO = {
  1: { key: 'dash', title: 'MOTE DASH', sub: 'the light leaps forward', color: 'rgba(90,216,255,0.9)', lines: ['Press C / Shift / L to dash.', 'Cross wide chasms, and shatter cracked walls.', 'You can dash once in the air; it resets on landing.'] },
  2: { key: 'walljump', title: 'CLINGING WILL', sub: 'the walls remember you', color: 'rgba(140,255,154,0.9)', lines: ['Touch a wall while falling to slide.', 'Press Jump while sliding to leap off it.', 'Climb tall shafts by bounding wall to wall.'] },
  3: { key: 'doublejump', title: 'TWIN WINGS', sub: 'the air itself holds you', color: 'rgba(212,154,255,0.9)', lines: ['Press Jump again while airborne.', 'Reach the high ledges that once refused you.', 'Combine with dash for great distances.'] },
};
const NPC_LINES = {
  start: [{ who: 'Elder Pell', text: 'Ah... a mote of light, still burning. I had thought the last of you had gone out.' }, { who: 'Elder Pell', text: 'The Warden sleeps at the top of the Ashen Spire, and while it sleeps, the deep goes dark. Someone small must climb.' }, { who: 'Elder Pell', text: 'East lies Mossgrove. The old shrines there still hold a little of what we were. Take what you can find, child.' }],
  dash: [{ who: 'Elder Pell', text: 'You move like the wind now. Cracked stone will not hold against that.' }, { who: 'Elder Pell', text: 'There is a sealed way below the west of the Hollow. What sleeps in the Sunken Depths is old, but not unkind.' }],
  walljump: [{ who: 'Elder Pell', text: 'The walls remember you! The shaft above this hall leads to the Crystal Heights. Bound upward, and do not look down.' }],
  doublejump: [{ who: 'Elder Pell', text: 'Twin wings... then the Spire is open to you. Cross from the Heights into the ash, and wake the Warden. Rest first. Please.' }],
  done: [{ who: 'Elder Pell', text: 'The deep breathes again, little light. Explore as you wish - the shards you missed are still out there, glinting.' }],
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d');
    this.uiCanvas = document.getElementById('ui'); this.ui = new UI(this.uiCanvas);
    this.input = new Input(); this.audio = new AudioSys(); this.fx = new FX();
    this.world = new World(MAP); this.renderer = new Renderer(this.world);
    this.state = 'title'; this.time = 0; this.playtime = 0; this.deaths = 0; this.acc = 0; this.last = 0; this.fadeAlpha = 0; this.hint = null;
    this.hasSave = !!loadGame(); this.audioStarted = false; this.resetConfirm = false;
    this.cam = { x: 0, y: 0, lookX: 0 }; this.area = null; this.endingT = 0; this.deathT = 0;
    this.explored = new Uint8Array(Math.ceil(this.world.w / MAP_CELL) * Math.ceil(this.world.h / MAP_CELL)); this.benchesSeen = [];
    this.setupWorld(loadGame());
    window.addEventListener('resize', () => this.resize()); this.resize();
    requestAnimationFrame((t) => this.frame(t));
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ww = window.innerWidth, wh = window.innerHeight;
    let scale = Math.max(1, Math.floor(Math.min(ww / VIEW_W, wh / VIEW_H)));
    if (ww / VIEW_W < 1 || wh / VIEW_H < 1) scale = Math.min(ww / VIEW_W, wh / VIEW_H);
    const cw = Math.round(VIEW_W * scale), chh = Math.round(VIEW_H * scale);
    const stage = document.getElementById('stage'); stage.style.width = cw + 'px'; stage.style.height = chh + 'px';
    this.canvas.style.width = cw + 'px'; this.canvas.style.height = chh + 'px';
    this.uiCanvas.style.width = cw + 'px'; this.uiCanvas.style.height = chh + 'px';
    this.ui.resize(scale * dpr, Math.round(cw * dpr), Math.round(chh * dpr));
  }
  // ---------- world setup / reset
  setupWorld(save) {
    const W = this.world; this.save = save;
    const start = W.findEntity('P'); this.startPos = { x: start.tx * TILE + 3, y: start.ty * TILE + TILE - PH };
    this.player = makePlayer(this.startPos.x, this.startPos.y);
    this.pickups = W.entities.filter((e) => PICKUP_CHARS.has(e.type)).map(makePickup);
    this.shardsTotal = this.pickups.filter((p) => p.type === 'H').length;
    this.decor = W.entities.filter((e) => ['B', 'T', '+', 'N', 'L', 'G'].includes(e.type));
    this.lights = []; this.projectiles = []; this.boss = null; this.bossDefeated = false; this.bossActive = false; this.collected = new Set(); this.loreRead = new Set();
    this.benchPos = { x: this.startPos.x, y: this.startPos.y }; this.talked = {};
    if (save) {
      const p = this.player; Object.assign(p.abilities, save.abilities || {}); p.maxHp = save.maxHp || 5; p.hp = p.maxHp;
      (save.collected || []).forEach((id) => this.collected.add(id)); this.pickups.forEach((pk) => { if (this.collected.has(pk.id)) pk.taken = true; });
      W.applyBroken(save.broken || []); this.bossDefeated = !!save.bossDefeated; this.deaths = save.deaths || 0; this.playtime = save.playtime || 0;
      if (save.bench) { this.benchPos = { x: save.bench.x, y: save.bench.y }; p.x = save.bench.x; p.y = save.bench.y; }
      if (save.explored) { const arr = save.explored; for (let i = 0; i < Math.min(arr.length, this.explored.length); i++) this.explored[i] = arr[i]; }
      this.benchesSeen = save.benchesSeen || []; this.talked = save.talked || {};
      if (this.bossDefeated) { const heart = this.pickups.find((k) => k.type === '*'); if (heart && !heart.taken) heart.visible = true; }
    }
    this.spawnEnemies();
    this.shardsCollected = [...this.collected].filter((id) => id.startsWith('H_')).length;
    const pc = pCenter(this.player); this.cam.x = pc.x - VIEW_W / 2; this.cam.y = pc.y - VIEW_H / 2; this.clampCam();
    this.area = W.areaAt(Math.floor(pc.x / TILE), Math.floor(pc.y / TILE)); this.audio.setArea(this.area);
    this.ui.mapDirty = true;
  }
  spawnEnemies() { this.enemies = this.world.entities.filter((e) => ENEMY_CHARS.has(e.type)).map(makeEnemy); }
  persist() {
    const p = this.player;
    saveGame({ abilities: p.abilities, maxHp: p.maxHp, collected: [...this.collected], broken: this.world.brokenWalls, bench: this.benchPos, bossDefeated: this.bossDefeated, deaths: this.deaths, playtime: this.playtime, explored: Array.from(this.explored), benchesSeen: this.benchesSeen, talked: this.talked });
    this.hasSave = true;
  }
  newGame() { clearSave(); this.world = new World(MAP); this.renderer = new Renderer(this.world); this.explored.fill(0); this.benchesSeen = []; this.deaths = 0; this.playtime = 0; this.setupWorld(null); this.fx = new FX(); }
  // ---------- main loop
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dtReal = Math.min(0.1, (t - this.last) / 1000 || 0); this.last = t;
    this.input.pollGamepad();
    if (!this.audioStarted && this.input.anyKeyPressed) { this.audio.init(); this.audioStarted = true; }
    this.audio.resume();
    this.time += dtReal;
    const STEP = 1 / 60; this.acc += dtReal * this.fx.slowmo; let steps = 0;
    while (this.acc >= STEP && steps < 5) { this.tick(STEP); this.acc -= STEP; steps++; }
    if (steps === 0) this.input.endTick();
    this.ui.update(dtReal, this.audioStarted ? this.audio : null);
    this.render();
  }
  tick(dt) {
    const inp = this.input; const st = this.state;
    if (st === 'title') { this.tickTitle(); }
    else if (st === 'pause') { this.tickPause(); }
    else if (st === 'map') { if (inp.isPressed('map') || inp.isPressed('back') || inp.isPressed('pause')) { this.state = 'play'; this.audio.play('ui'); } }
    else if (st === 'ending') { this.endingT += dt; this.fx.update(dt); if (this.endingT > 4 && (inp.isPressed('jump') || inp.isPressed('confirm'))) { this.state = 'play'; this.fadeAlpha = 0; } }
    else if (st === 'dead') { this.deathT += dt; this.fx.update(dt); if (this.deathT > 2.2) this.respawn(); }
    else if (st === 'dialogue') { this.fx.update(dt); this.tickWorldPassive(dt); if (inp.isPressed('confirm') || inp.isPressed('jump') || inp.isPressed('up')) { if (!this.ui.advanceDialogue()) this.state = 'play'; } }
    else if (st === 'splash') { this.fx.update(dt); if (this.ui.splash.t > 0.6 && (inp.isPressed('jump') || inp.isPressed('attack') || inp.isPressed('confirm'))) { this.ui.splash = null; this.state = 'play'; this.audio.play('ui'); } }
    else if (st === 'play') {
      if (inp.isPressed('pause')) { this.state = 'pause'; this.ui.menuIdx = 0; this.resetConfirm = false; this.audio.play('ui'); }
      else if (inp.isPressed('map')) { this.state = 'map'; this.audio.play('ui'); }
      else this.tickPlay(dt);
    }
    inp.endTick();
  }
  tickTitle() {
    const inp = this.input; const n = this.hasSave ? 2 : 1;
    if (inp.isPressed('down')) { this.ui.menuIdx = (this.ui.menuIdx + 1) % n; this.audio.play('ui'); }
    if (inp.isPressed('up')) { this.ui.menuIdx = (this.ui.menuIdx + n - 1) % n; this.audio.play('ui'); }
    if (inp.isPressed('confirm')) {
      if (this.hasSave && this.ui.menuIdx === 1) this.newGame();
      this.startPlay();
    }
    this.fx.update(1 / 60);
  }
  startPlay() {
    this.state = 'play'; this.audio.play('ui'); this.ui.showArea(this.world.areaInfo(this.area).name);
    if (!this.save) { this.hint = 'Arrows / WASD to move · Z / Space to jump · X to attack'; setTimeout(() => { if (this.hint && this.hint.startsWith('Arrows')) this.hint = null; }, 9000); }
  }
  tickPause() {
    const inp = this.input;
    if (inp.isPressed('pause') || inp.isPressed('map')) { this.state = 'play'; this.audio.play('ui'); return; }
    if (inp.isPressed('down') || inp.isPressed('up')) { this.ui.menuIdx = 1 - this.ui.menuIdx; this.resetConfirm = false; this.audio.play('ui'); }
    if (inp.isPressed('confirm')) {
      if (this.ui.menuIdx === 0) { this.state = 'play'; this.audio.play('ui'); }
      else if (!this.resetConfirm) this.resetConfirm = true;
      else { this.newGame(); this.state = 'play'; this.resetConfirm = false; this.ui.showArea(this.world.areaInfo(this.area).name); }
    }
  }
  // ---------- gameplay tick
  tickWorldPassive(dt) { for (const pk of this.pickups) pk.t += dt; }
  tickPlay(dt) {
    const p = this.player, W = this.world, fx = this.fx, inp = this.input.snapshot();
    this.playtime += dt;
    if (fx.hitstop > 0) { fx.hitstop -= dt; fx.update(dt * 0.25); return; }
    const wasHp = p.hp;
    updatePlayer(p, inp, W, dt);
    for (const ev of p.events) this.handlePlayerEvent(ev);
    // interactables
    this.nearInteract = null;
    const pc = pCenter(p);
    for (const d of this.decor) {
      if (!['N', 'L', 'B'].includes(d.type)) continue;
      const dx = d.tx * TILE + 8 - pc.x, dy = d.ty * TILE + 8 - pc.y;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 20 && p.onGround) { this.nearInteract = d; break; }
    }
    if (this.nearInteract && this.input.isPressed('up') && !p.sitting && p.hurtTimer <= 0) this.interact(this.nearInteract);
    // trail
    const tail = p.anim.tail; tail.push({ x: pc.x, y: pc.y }); if (tail.length > 9) tail.shift();
    if (Math.abs(p.vx) < 5 && Math.abs(p.vy) < 5) tail.length = 0;
    // run dust & steps
    if (p.onGround && Math.abs(p.vx) > 100 && Math.random() < 0.25) fx.dust(pc.x - p.facing * 4, p.y + p.h, 1, -p.facing);
    if (p.onGround && Math.abs(p.vx) > 100 && Math.floor(p.anim.run) !== Math.floor(p.anim.run - dt * Math.abs(p.vx) / 14)) this.audio.play('step');
    if (p.wallSliding && Math.random() < 0.4) fx.dust(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h - 2, 1, 0);
    if (p.dashing > 0) fx.add({ x: pc.x, y: pc.y, vx: -p.dashDir * 30, vy: rand(-20, 20), life: 0.3, size: 3, color: '#cfe0ff', glow: true });
    if (p.focusing && Math.random() < 0.5) fx.add({ x: pc.x + rand(-18, 18), y: pc.y + rand(-14, 14), vx: 0, vy: -20, life: 0.6, size: 1.5, color: '#ffe0a0', glow: true, shape: 'soul', tx: pc.x, ty: pc.y });
    // attack resolution
    if (p.attackTimer > 0) this.resolveAttack();
    // enemies
    const ctxE = { spawnProjectile: (pr) => this.projectiles.push(pr), minionCount: () => this.enemies.filter((e) => e.alive && e.summoned).length, summon: () => this.summonMinions() };
    for (const e of this.enemies) {
      if (!e.alive) { e.deathT = (e.deathT || 0) + dt; continue; }
      const ec = eCenter(e); if (Math.abs(ec.x - pc.x) > VIEW_W * 1.2 || Math.abs(ec.y - pc.y) > VIEW_H * 1.2) continue;
      updateEnemy(e, p, W, dt, ctxE);
      for (const ev of e.events) this.handleEnemyEvent(e, ev);
      if (p.invuln <= 0 && !p.dead && aabb(p, e)) { if (hurtPlayer(p, e.def.dmg, ec.x, ec.y)) this.onPlayerHurt(); }
    }
    // boss
    if (this.boss) {
      const b = this.boss; updateBoss(b, p, W, dt, ctxE);
      for (const ev of b.events) this.handleBossEvent(b, ev);
      if (b.alive && p.invuln <= 0 && !p.dead && aabb(p, { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 4 })) { if (hurtPlayer(p, b.state === 'charge' && b.phase === 2 ? 2 : 1, eCenter(b).x, eCenter(b).y)) this.onPlayerHurt(); }
      if (!b.alive) this.tickBossDeath(b, dt);
    }
    // projectiles
    this.projectiles = this.projectiles.filter((pr) => {
      const ok = updateProjectile(pr, W, dt);
      if (!ok) { fx.burst(pr.x, pr.y, 5, { speed: 40, life: 0.3, size: 1.5, color: pr.kind === 'shock' ? '#ff9a4a' : '#c8ff5a', glow: true }); return false; }
      if (p.invuln <= 0 && !p.dead && aabb(p, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) { if (hurtPlayer(p, 1, pr.x, pr.y)) { this.onPlayerHurt(); return false; } }
      return true;
    });
    // pickups
    for (const pk of this.pickups) {
      pk.t += dt; if (pk.taken) continue; if (pk.type === '*' && !pk.visible) continue;
      if (Math.abs(pk.x - pc.x) < 14 && Math.abs(pk.y - pc.y) < 16) this.collect(pk);
      else if (Math.random() < 0.05 && Math.abs(pk.x - pc.x) < VIEW_W) fx.add({ x: pk.x + rand(-8, 8), y: pk.y + rand(-6, 6), vx: rand(-6, 6), vy: rand(-18, -6), life: 0.8, size: 1.2, color: pk.type === 'H' ? '#ffb0cc' : pk.type === '*' ? '#ffe0a0' : ABILITY_COLORS[pk.type], glow: true });
    }
    // boss arena trigger
    const ptx = Math.floor(pc.x / TILE), pty = Math.floor(pc.y / TILE);
    if (!this.bossDefeated && !this.bossActive && W.inRect(ptx, pty, MAP.bossArena.trigger) && p.onGround) this.startBoss();
    // area change
    const area = W.areaAt(ptx, pty);
    if (area !== this.area) { this.area = area; this.ui.showArea(W.areaInfo(area).name); if (!this.bossActive) this.audio.setArea(area); }
    // exploration
    const cw = Math.ceil(W.w / MAP_CELL);
    for (let cy = Math.floor(this.cam.y / TILE / MAP_CELL); cy <= Math.floor((this.cam.y + VIEW_H) / TILE / MAP_CELL); cy++) for (let cx = Math.floor(this.cam.x / TILE / MAP_CELL); cx <= Math.floor((this.cam.x + VIEW_W) / TILE / MAP_CELL); cx++) {
      const i = cy * cw + cx; if (cx >= 0 && cy >= 0 && cx < cw && i < this.explored.length && !this.explored[i]) { this.explored[i] = 1; this.ui.mapDirty = true; }
    }
    // ambient particles
    this.ambient(dt);
    fx.update(dt);
    this.updateCamera(dt);
    if (p.dead && this.state === 'play') this.onDeath();
  }
  handlePlayerEvent(ev) {
    const p = this.player, fx = this.fx, pc = pCenter(p), A = this.audio;
    const name = typeof ev === 'string' ? ev : ev.type;
    switch (name) {
      case 'jump': A.play('jump'); fx.dust(pc.x, p.y + p.h, 5, 0); p.anim.land = 0; break;
      case 'djump': A.play('djump'); fx.glowBurst(pc.x, p.y + p.h - 2, 10, ['#d49aff', '#ffffff'], 70, 0.4); fx.add({ x: pc.x, y: p.y + p.h, life: 0.25, size: 12, color: '#e0c8ff', shape: 'arc', dir: 'down', shrink: false }); break;
      case 'walljump': A.play('walljump'); fx.dust(p.x + (p.facing < 0 ? p.w : 0), p.y + p.h - 4, 6, -p.facing); break;
      case 'wallgrab': fx.dust(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h - 4, 3, 0); break;
      case 'dash': A.play('dash'); fx.shake(1.5, 0.1); fx.glowBurst(pc.x, pc.y, 8, ['#a8c8ff', '#ffffff'], 50, 0.3); break;
      case 'bonk': fx.shake(2, 0.1); fx.sparks(p.x + (p.dashDir > 0 ? p.w : 0), pc.y, p.dashDir > 0 ? Math.PI : 0, '#cfd8ff'); break;
      case 'land': { const s = clamp(ev.speed / 430, 0.2, 1.2); A.play('land', { strength: s }); fx.land(pc.x, p.y + p.h, s); if (s > 0.9) fx.shake(1.2, 0.08); break; }
      case 'slash': { A.play('slash'); const hb = attackHitbox(p); const dir = p.attackDir; const ax = dir === 'right' ? p.x + p.w + 2 : dir === 'left' ? p.x - 2 : pc.x; const ay = dir === 'up' ? p.y - 4 : dir === 'down' ? p.y + p.h + 4 : pc.y; fx.slashArc(ax, ay, dir, '#e8f0ff'); if (p.onGround) p.recoil = 0; break; }
      case 'hurt': this.onPlayerHurt(); break;
      case 'hazard': A.play('hurt'); fx.shake(4, 0.25); fx.doFlash(0.5, '#ff4040'); fx.glowBurst(pc.x, pc.y, 14, ['#ffffff', '#ff8080'], 90, 0.5); break;
      case 'respawn': fx.glowBurst(pc.x, pc.y, 12, ['#ffffff', '#c8d0ff'], 60, 0.5); break;
      case 'heal': A.play('heal'); fx.glowBurst(pc.x, pc.y, 22, ['#ffe0a0', '#ffffff'], 90, 0.6); this.hint = null; break;
      case 'focusstart': A.play('focus'); break;
      case 'die': break;
      case 'stand': break;
      case 'break': { A.play('break'); fx.shake(5, 0.3); fx.stop(0.05); this.renderer.invalidateTiles(ev.tiles); for (const [tx, ty] of ev.tiles) { fx.burst(tx * TILE + 8, ty * TILE + 8, 6, { speed: 90, life: 0.7, size: 3, color: [PALETTES[this.area].rock, PALETTES[this.area].edge, '#e8d8ff'], grav: 300, shape: 'square', spin: 6 }); } this.ui.mapDirty = true; this.persist(); break; }
    }
  }
  onPlayerHurt() { const p = this.player, pc = pCenter(p); this.audio.play('hurt'); this.fx.shake(5, 0.3); this.fx.stop(0.08); this.fx.doFlash(0.35, '#ff3030'); this.fx.glowBurst(pc.x, pc.y, 12, ['#ff9090', '#ffffff'], 100, 0.5); if (p.dead) this.onDeath(); }
  onDeath() {
    if (this.state === 'dead') return;
    const p = this.player, pc = pCenter(p); this.state = 'dead'; this.deathT = 0; this.deaths++;
    this.audio.play('death'); this.fx.shake(6, 0.4); this.fx.stop(0.15); this.fx.glowBurst(pc.x, pc.y, 40, ['#ffffff', '#c8d0ff', '#8090ff'], 140, 1.2); this.fx.doFlash(0.6, '#ffffff');
    if (this.bossActive) this.endBoss(false);
  }
  respawn() {
    const p = this.player; const keep = { abilities: p.abilities, maxHp: p.maxHp };
    Object.assign(p, makePlayer(this.benchPos.x, this.benchPos.y)); p.abilities = keep.abilities; p.maxHp = keep.maxHp; p.hp = p.maxHp; p.soul = 0;
    this.spawnEnemies(); this.projectiles = []; this.state = 'play'; this.fadeAlpha = 1;
    const pc = pCenter(p); this.cam.x = pc.x - VIEW_W / 2; this.cam.y = pc.y - VIEW_H / 2; this.clampCam(); this.persist();
    this.fx.glowBurst(pc.x, pc.y, 20, ['#ffffff', '#c8d0ff'], 60, 0.8);
  }
  resolveAttack() {
    const p = this.player, hb = attackHitbox(p), fx = this.fx, pc = pCenter(p); let hitSomething = false; let pogoed = false;
    const gainSoul = () => { p.soul = Math.min(PHYS.SOUL_MAX, p.soul + PHYS.SOUL_HIT); };
    for (const e of this.enemies) {
      if (!e.alive || p.attackHit.has(e.id)) continue;
      if (aabb(hb, e)) {
        p.attackHit.add(e.id); hitSomething = true; const ec = eCenter(e); gainSoul(); fx.soul(ec.x, ec.y, pc.x, pc.y);
        const killed = damageEnemy(e, 1, pc.x); const ang = Math.atan2(ec.y - pc.y, ec.x - pc.x);
        fx.sparks((ec.x + pc.x) / 2, (ec.y + pc.y) / 2, ang, ['#ffffff', '#ffe0a0']);
        if (killed) { this.audio.play('kill'); fx.death(ec.x, ec.y, e.def.color); fx.stop(0.07); fx.shake(3, 0.15); p.soul = Math.min(PHYS.SOUL_MAX, p.soul + 6); }
        else { this.audio.play('hit'); fx.stop(0.04); fx.shake(1.5, 0.1); }
        if (p.attackDir === 'down') pogoed = true; else if (p.onGround) { p.recoil = 0.08; p.vx = -p.facing * 90; }
      }
    }
    if (this.boss && this.boss.alive && !p.attackHit.has('boss') && aabb(hb, this.boss)) {
      p.attackHit.add('boss'); hitSomething = true; const bc = eCenter(this.boss); gainSoul(); fx.soul(bc.x, bc.y, pc.x, pc.y);
      const killed = damageBoss(this.boss, 1); const ang = Math.atan2(bc.y - pc.y, bc.x - pc.x);
      fx.sparks(pc.x + Math.cos(ang) * 16, pc.y + Math.sin(ang) * 10, ang, ['#ffffff', '#ffb080']);
      if (killed) this.onBossKilled(); else { this.audio.play('hit'); fx.stop(0.05); fx.shake(2, 0.1); }
      if (p.attackDir === 'down') pogoed = true; else if (p.onGround) { p.recoil = 0.08; p.vx = -p.facing * 110; }
    }
    // projectiles can be swatted
    this.projectiles = this.projectiles.filter((pr) => { if (pr.kind !== 'shock' && aabb(hb, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) { fx.burst(pr.x, pr.y, 8, { speed: 70, life: 0.35, size: 2, color: '#c8ff5a', glow: true }); this.audio.play('hit'); if (p.attackDir === 'down') pogoed = true; return false; } return true; });
    // pogo on spikes
    if (p.attackDir === 'down' && !pogoed && this.world.rectHas(hb.x + 6, hb.y, hb.w - 12, hb.h - 8, (tx, ty) => this.world.isSpike(tx, ty))) { pogoed = true; fx.sparks(pc.x, p.y + p.h + 8, -Math.PI / 2, ['#ffffff', '#d8dce8']); }
    if (pogoed) { pogo(p); this.audio.play('pogo'); fx.dust(pc.x, p.y + p.h + 4, 4, 0); }
  }
  handleEnemyEvent(e, ev) {
    const ec = eCenter(e), fx = this.fx;
    switch (ev) {
      case 'spit': this.audio.play('spit'); fx.burst(ec.x, ec.y - 6, 5, { speed: 40, life: 0.3, size: 1.5, color: '#c8ff5a', glow: true }); break;
      case 'charge': this.audio.play('charge'); fx.dust(ec.x, e.y + e.h, 8, -e.facing); break;
      case 'alert': fx.add({ x: ec.x, y: e.y - 8, vy: -20, life: 0.5, size: 2, color: '#ff8080', glow: true }); break;
      case 'lunge': this.audio.play('dash'); break;
      case 'bonk': fx.shake(3, 0.15); fx.sparks(e.x + (e.facing > 0 ? e.w : 0), ec.y, e.facing > 0 ? Math.PI : 0, ['#ffd0a0']); this.audio.play('hit'); break;
    }
  }
  summonMinions() { const a = MAP.bossArena.rect; const spots = [[a[0] + 3, a[1] + a[3] - 2], [a[0] + a[2] - 4, a[1] + a[3] - 2]]; for (const [tx, ty] of spots) { const e = makeEnemy({ type: 'e', tx, ty, id: 'minion_' + Math.random() }); e.summoned = true; this.enemies.push(e); this.fx.glowBurst(e.x + 7, e.y + 5, 10, ['#ff8a3c', '#ffffff'], 60, 0.5); } }
  handleBossEvent(b, ev) {
    const bc = eCenter(b), fx = this.fx;
    if (ev === 'roar') { this.audio.play('roar'); fx.shake(5, 0.8); }
    else if (ev === 'charge') { this.audio.play('charge'); fx.dust(bc.x, b.y + b.h, 12, -b.facing); }
    else if (ev === 'leap') { this.audio.play('jump'); fx.dust(bc.x, b.y + b.h, 10, 0); }
    else if (ev === 'slam') { this.audio.play('slam'); fx.shake(8, 0.4); fx.stop(0.05); fx.land(bc.x, b.y + b.h, 3); }
    else if (ev === 'spit') this.audio.play('spit');
    else if (ev === 'bonk') { this.audio.play('slam'); fx.shake(6, 0.3); fx.sparks(b.x + (b.facing > 0 ? b.w : 0), bc.y, b.facing > 0 ? Math.PI : 0, ['#ffd0a0', '#ffffff']); }
    else if (ev === 'phase2') { this.audio.play('roar'); fx.shake(6, 0.6); fx.doFlash(0.3, '#ff6030'); fx.glowBurst(bc.x, bc.y, 30, ['#ff6a3a', '#ffd080'], 120, 0.8); this.ui.showToast('The Warden burns with fury!', 2.5); }
    else if (ev === 'summon') this.audio.play('roar');
  }
  startBoss() {
    const X = this.world.findEntity('X'); this.boss = makeBoss(X.tx * TILE + 8, X.ty * TILE + TILE); this.bossActive = true;
    this.world.gatesClosed = true; this.hint = null; this.audio.play('gate'); this.audio.setBoss(true); this.fx.shake(4, 0.5);
    for (const g of this.world.entitiesOf('G')) this.fx.dust(g.tx * TILE + 8, g.ty * TILE + 16, 4, 0);
  }
  endBoss(won) { this.world.gatesClosed = false; this.bossActive = false; this.audio.setBoss(false); if (!won) this.boss = null; this.enemies = this.enemies.filter((e) => !e.summoned); }
  onBossKilled() {
    const b = this.boss, bc = eCenter(b); this.audio.play('bossdeath'); this.fx.stop(0.3); this.fx.slow(0.35, 1.6); this.fx.shake(10, 1.5); this.fx.doFlash(0.8, '#ffffff');
    this.bossDefeated = true; this.endBoss(true); this.projectiles = []; this.persist();
  }
  tickBossDeath(b, dt) {
    const bc = eCenter(b);
    if (Math.random() < 0.5) this.fx.burst(bc.x + rand(-20, 20), bc.y + rand(-14, 14), 6, { speed: 90, life: 0.6, size: 3, color: ['#ff8a3c', '#ffffff', '#3a2a3a'], glow: true, grav: 60 });
    if (b.deathT > 2.5) { this.fx.death(bc.x, bc.y, '#3a2a3a'); this.fx.glowBurst(bc.x, bc.y, 60, ['#ffe0a0', '#ffffff', '#ff8a3c'], 160, 1.4); this.audio.play('gate'); const heart = this.pickups.find((k) => k.type === '*'); if (heart) heart.visible = true; this.boss = null; this.ui.showToast('The gates open.', 2.5); }
  }
  collect(pk) {
    const p = this.player, pc = pCenter(p); pk.taken = true; this.collected.add(pk.id);
    if (pk.type === 'H') { p.maxHp++; p.hp = p.maxHp; this.shardsCollected++; this.audio.play('shard'); this.fx.glowBurst(pk.x, pk.y, 24, ['#ff6fa0', '#ffffff'], 90, 0.7); this.fx.stop(0.1); this.ui.showToast(`Life Shard — your light grows (${this.shardsCollected}/${this.shardsTotal})`); }
    else if (pk.type === '*') { this.audio.play('ability'); this.fx.doFlash(1, '#fff4dc'); this.fx.slow(0.4, 1.5); this.state = 'ending'; this.endingT = 0; }
    else { const info = ABILITY_INFO[pk.type]; p.abilities[info.key] = true; this.audio.play('ability'); this.fx.stop(0.2); this.fx.glowBurst(pk.x, pk.y, 40, [ABILITY_COLORS[pk.type], '#ffffff'], 120, 1); this.fx.doFlash(0.5, ABILITY_COLORS[pk.type]); this.ui.showSplash(info.title, info.sub, info.lines, info.color); this.state = 'splash'; }
    this.persist();
  }
  interact(d) {
    const p = this.player;
    if (d.type === 'B') { p.sitting = true; p.benchTimer = 0; p.hp = p.maxHp; p.x = d.tx * TILE + 3; const key = [d.tx, d.ty]; this.benchPos = { x: p.x, y: p.y }; if (!this.benchesSeen.some((b) => b[0] === d.tx && b[1] === d.ty)) this.benchesSeen.push(key); this.spawnEnemies(); this.projectiles = []; this.audio.play('bench'); this.fx.glowBurst(pCenter(p).x, pCenter(p).y, 20, ['#ffd27a', '#ffffff'], 50, 1); this.ui.showToast('You rest. Your light is restored, and the deep remembers this place.', 3); this.persist(); }
    else if (d.type === 'L') { this.state = 'dialogue'; this.ui.startDialogue([{ who: 'Ancient Stone', text: d.text }]); this.loreRead.add(d.id); this.audio.play('ui'); }
    else if (d.type === 'N') { const A = p.abilities; const key = this.bossDefeated ? 'done' : A.doublejump ? 'doublejump' : A.walljump ? 'walljump' : A.dash ? 'dash' : 'start'; this.state = 'dialogue'; this.ui.startDialogue(NPC_LINES[key]); this.talked[key] = true; this.audio.play('ui'); }
  }
  ambient(dt) {
    const pal = PALETTES[this.area]; const fx = this.fx; if (Math.random() > dt * 14) return;
    const x = this.cam.x + Math.random() * VIEW_W, y = this.cam.y + Math.random() * VIEW_H;
    switch (pal.ambient) {
      case 'dust': fx.add({ x, y, vx: rand(-4, 4), vy: rand(-6, 2), life: 3, size: 0.9, color: '#b8b0e0', glow: true, shrink: false, alpha: 0.5 }); break;
      case 'spore': fx.add({ x, y, vx: rand(-6, 6), vy: rand(-10, -3), life: 4, size: 1.3, color: pick(['#9be05f', '#d0ff9a']), glow: true, shrink: false, alpha: 0.6 }); break;
      case 'bubble': fx.add({ x, y: this.cam.y + VIEW_H, vx: rand(-3, 3), vy: rand(-30, -14), life: 5, size: 1.2, color: '#8ce0ff', glow: true, shrink: false, alpha: 0.5 }); break;
      case 'sparkle': fx.add({ x, y, vx: 0, vy: rand(-3, 3), life: 1.2, size: 1.2, color: pick(['#ffffff', '#ecc0ff']), glow: true, alpha: 0.9 }); break;
      case 'ember': fx.add({ x, y: this.cam.y + VIEW_H + 4, vx: rand(-8, 8), vy: rand(-40, -18), life: 3.5, size: 1.4, color: pick(['#ff8a3c', '#ffd080']), glow: true, drag: 0.3, alpha: 0.8 }); break;
    }
  }
  updateCamera(dt) {
    const p = this.player, pc = pCenter(p); const cam = this.cam;
    cam.lookX = lerp(cam.lookX, p.facing * 26 + clamp(p.vx, -80, 80) * 0.15, dt * 3);
    const tx = pc.x + cam.lookX - VIEW_W / 2; const ty = pc.y - VIEW_H / 2 + (p.vy > 200 ? 30 : 0) - 10;
    const k = 1 - Math.pow(0.001, dt);
    cam.x = lerp(cam.x, tx, k * 0.8); cam.y = lerp(cam.y, ty, k * 0.6);
    this.clampCam();
  }
  clampCam() {
    const cam = this.cam, W = this.world; let x0 = TILE, y0 = TILE, x1 = W.w * TILE - TILE, y1 = W.h * TILE - TILE;
    const pc = pCenter(this.player); const ptx = Math.floor(pc.x / TILE), pty = Math.floor(pc.y / TILE);
    for (const r of MAP.cameraLocks || []) if (W.inRect(ptx, pty, r)) { x0 = r[0] * TILE; y0 = r[1] * TILE; x1 = (r[0] + r[2]) * TILE; y1 = (r[1] + r[3]) * TILE; }
    cam.x = clamp(cam.x, x0, Math.max(x0, x1 - VIEW_W)); cam.y = clamp(cam.y, y0, Math.max(y0, y1 - VIEW_H));
  }
  // ---------- render
  render() {
    const ctx = this.ctx, R = this.renderer, cam = this.cam, t = this.time, W = this.world, fx = this.fx;
    const [shx, shy] = fx.shakeOffset(); const c = { x: Math.round(cam.x + shx), y: Math.round(cam.y + shy) };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    R.drawBackground(ctx, c, this.area, t);
    R.drawTiles(ctx, c);
    ctx.save(); ctx.translate(-c.x, -c.y);
    // decor & interactables
    const lights = []; const p = this.player, pc = pCenter(p);
    for (const d of this.decor) {
      const dx = d.tx * TILE, dy = d.ty * TILE; if (dx < c.x - 40 || dx > c.x + VIEW_W + 40 || dy < c.y - 40 || dy > c.y + VIEW_H + 40) continue;
      drawDecor(ctx, d, t, { gatesClosed: W.gatesClosed });
      if (d.type === 'B') lights.push({ x: dx + 23, y: dy - 8, r: 70, a: 0.9, color: '#ffb347', glow: 0.2 });
      else if (d.type === 'T') lights.push({ x: dx + 8, y: dy - 2, r: 80 + Math.sin(t * 9 + dx) * 4, a: 0.9, color: '#ff8a3c', glow: 0.22 });
      else if (d.type === '+') lights.push({ x: dx + 8, y: dy + 8, r: 44, a: 0.8, color: '#c9a0ff', glow: 0.2 });
      else if (d.type === 'L') lights.push({ x: dx + 8, y: dy + 8, r: 26, a: 0.6, color: '#8ce0ff', glow: 0.12 });
      else if (d.type === 'N') lights.push({ x: dx + 8, y: dy, r: 40, a: 0.7, color: '#c8ff5a', glow: 0.1 });
    }
    for (const pk of this.pickups) { if (pk.taken || (pk.type === '*' && !pk.visible)) continue; if (Math.abs(pk.x - pc.x) > VIEW_W || Math.abs(pk.y - pc.y) > VIEW_H) continue; drawPickup(ctx, pk, t); lights.push({ x: pk.x, y: pk.y, r: pk.type === '*' ? 90 : 40, a: 0.85, color: pk.type === 'H' ? '#ff6fa0' : pk.type === '*' ? '#ffd060' : ABILITY_COLORS[pk.type], glow: 0.18 }); }
    for (const e of this.enemies) { if (!e.alive) continue; const ec = eCenter(e); if (Math.abs(ec.x - pc.x) > VIEW_W || Math.abs(ec.y - pc.y) > VIEW_H) continue; drawEnemy(ctx, R, e, t); if (e.type === 's' && e.state === 'charge') lights.push({ x: ec.x, y: ec.y - 6, r: 30, a: 0.6, color: '#c8ff5a', glow: 0.15 }); if (e.type === 'g') lights.push({ x: ec.x, y: ec.y, r: 22, a: 0.5, color: '#ffd24a', glow: 0.1 }); }
    if (this.boss) { drawBoss(ctx, R, this.boss, t); const bc = eCenter(this.boss); lights.push({ x: bc.x, y: bc.y, r: 80, a: 0.7, color: this.boss.phase === 2 ? '#ff5a3a' : '#ff9a4a', glow: 0.12 }); }
    if (this.nearInteract && this.state === 'play') drawPrompt(ctx, this.nearInteract.tx * TILE + 8, this.nearInteract.ty * TILE - 8, t);
    drawPlayer(ctx, p, t);
    for (const pr of this.projectiles) { drawProjectile(ctx, pr, t); lights.push({ x: pr.x, y: pr.y, r: 22, a: 0.6, color: pr.kind === 'shock' ? '#ff9a4a' : '#c8ff5a', glow: 0.15 }); }
    R.drawParticles(ctx, { x: 0, y: 0 }, fx);
    ctx.restore();
    if (!p.dead) lights.unshift({ x: pc.x, y: pc.y, r: p.focusing ? 150 : 128, a: 0.95, color: p.focusing ? '#ffd080' : '#b8c4ff', glow: p.focusing ? 0.3 : 0.14 });
    R.drawLighting(ctx, c, lights, PALETTES[this.area]);
    if (fx.flash > 0) { ctx.globalAlpha = fx.flash; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, VIEW_W, VIEW_H); ctx.globalAlpha = 1; }
    if (this.fadeAlpha > 0) this.fadeAlpha = Math.max(0, this.fadeAlpha - 0.02);
    this.ui.draw(this);
  }
}
window.addEventListener('load', () => { window.game = new Game(); });
// Debug helper: render the whole world into a data URL (used by tests to eyeball the map)
Game.prototype.renderOverview = function () {
  const R = this.renderer, W = this.world; const scale = 0.25; const c = document.createElement('canvas'); c.width = Math.ceil(W.w * TILE * scale); c.height = Math.ceil(W.h * TILE * scale);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, c.width, c.height); ctx.imageSmoothingEnabled = true;
  for (let cy = 0; cy * CHUNK < W.h; cy++) for (let cx = 0; cx * CHUNK < W.w; cx++) ctx.drawImage(R.getChunk(cx, cy), cx * CHUNK * TILE * scale, cy * CHUNK * TILE * scale, CHUNK * TILE * scale, CHUNK * TILE * scale);
  const colors = { H: '#ff6fa0', 1: '#5ad8ff', 2: '#8cff9a', 3: '#d49aff', '*': '#ffd060', B: '#ffb347', P: '#ffffff', X: '#ff3030', e: '#ff8', f: '#8ff', s: '#8f8', c: '#f88', g: '#fc8', L: '#aef', N: '#cf8', T: '#fa4', G: '#f0f' };
  for (const e of W.entities) { ctx.fillStyle = colors[e.type] || '#fff'; ctx.fillRect(e.tx * TILE * scale, e.ty * TILE * scale, 4, 4); }
  return c.toDataURL('image/png');
};
