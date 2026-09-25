// ---- Game: state machine, main loop, world/entity orchestration, story -----------
const GIFT_INFO = {
  1: { key: 'dash', title: 'WINDSTEP', sub: 'the lamplighters moved like this', color: 'rgba(90,216,255,0.9)', lines: ['Press C / Shift / L to step through the air like wind.', 'Cross wide drops, and shatter cracked stone.', 'One step in the air; it returns when you land or grip a wall.'] },
  2: { key: 'walljump', title: 'ROOTGRIP', sub: 'the walls remember you now', color: 'rgba(140,255,154,0.9)', lines: ['Touch a wall while falling to cling and slide.', 'Press Jump while clinging to bound away from it.', 'Climb tall shafts by leaping wall to wall. Chimeglass cannot be gripped.'] },
  3: { key: 'doublejump', title: 'SKYLEAF', sub: 'the air itself will hold you once', color: 'rgba(212,154,255,0.9)', lines: ['Press Jump again while airborne for a second leap.', 'Reach the ledges that once refused you.', 'Pair it with Windstep to cross the widest dark.'] },
  4: { key: 'spell', title: 'CINDER', sub: 'a thrown piece of your own warmth', color: 'rgba(255,179,71,0.9)', lines: ['Tap V / E to hurl a cinder that burns for two.', 'It costs ember; strike foes to gather more.', 'Cinders pierce the shells of emberbacks, which your splinter cannot.'] },
};
const INTRO_PAGES = [
  ['Once, light lived here. It poured down from the Hearthroot, the great sleeping tree, and the lamplighters of the Lanternry caught it in glass and carried it into every tunnel of the Glimmerdeep.'],
  ['Then Sorrel, first of the lamplighters, grew afraid of the dark. He built a lantern large enough to hold all the light at once, and climbed with it into the Cinderthroat, and the light never came back down.', 'What remained was the hush: a quiet that eats warmth, and the things it leaves behind.'],
  ['You are a mote, the last spark Wick could coax from the embers. Small. Warm. Stubborn.', 'Find the gifts the lamplighters hid. Climb. Break the lantern.'],
];
const NPC_LINES = {
  wick: {
    start: [{ who: 'Wick', text: 'There you are, little spark. I was afraid the embers had nothing left in them.' }, { who: 'Wick', text: 'The hush has taken the deep, tunnel by tunnel. It began in the Cinderthroat, where Sorrel carried our light and never returned.' }, { who: 'Wick', text: 'You will need the gifts the lamplighters hid: Windstep, Rootgrip, Skyleaf. East, in Fernwake, something guards the first. Before that, the cradle up-left of this hall holds a cinder for you.' }],
    spell: [{ who: 'Wick', text: 'A cinder, thrown well, burns hotter than any splinter. Keep your lantern full and it will guard you, too; a full lantern flares instead of breaking.' }, { who: 'Wick', text: 'Fernwake lies east. Mind the sporelings. And the roots. Especially the roots.' }],
    dash: [{ who: 'Wick', text: 'You move like the old lamplighters now. Cracked stone will not stand against that.' }, { who: 'Wick', text: 'West of here the passage past the cradle leads to Bramblehush, where Old Bramble still keeps a hut. And below the west caves, past cracked stone, the Drownwell waits. The Bell Ringer there is... not unkind.' }],
    walljump: [{ who: 'Wick', text: 'Rootgrip! Then the shaft above this hall is open to you. It climbs into Chimeglass Reach, where every step rings. Skyleaf waits at its far end.' }],
    doublejump: [{ who: 'Wick', text: 'Skyleaf. Then the bridge past the glass will carry you to the Lanternry, my old home, and beyond it to the Cinderthroat.' }, { who: 'Wick', text: 'Sorrel was my friend, once. Whatever he is now, he will not thank you for freeing the light. Rest first, spark. Please.' }],
    done: [{ who: 'Wick', text: 'The deep breathes again. I can feel warmth in the roots for the first time in an age.' }, { who: 'Wick', text: 'Wander as you like. Petals still sleep in the dark for those who look, and the tree above will not mind a little more light.' }],
  },
  bramble: {
    first: [{ who: 'Old Bramble', text: 'Hm. A mote, in my thicket. The hush must be desperate or you must be.' }, { who: 'Old Bramble', text: 'That splinter of yours is Hearthroot wood, same as my hut. Bring me two pieces of heartwood, the amber kind that still glows, and I will carve it keen.' }, { who: 'Old Bramble', text: 'There is a piece up top, past the thorns, but a husk of a lamplighter wanders there. It did not use to. Careful.' }],
    hasOne: [{ who: 'Old Bramble', text: 'One piece of heartwood. Good. The other I last saw in the Puffcap Warrens, under Fernwake, where the ground bounces and the spores bite. Bring it and I carve.' }],
    carve: [{ who: 'Old Bramble', text: 'Two pieces. Hold still, this is fiddly work.' }, { who: 'Old Bramble', text: 'There. Keen as it was the day Sorrel cut the first one. Strike true, spark.' }],
    carved: [{ who: 'Old Bramble', text: 'The edge is holding? Good. Go on, then. The hush will not unmake itself.' }],
    done: [{ who: 'Old Bramble', text: 'Warm again, all the way down. I might even leave the thicket. Might. Don\'t hold your breath.' }],
  },
  tallow: {
    first: [{ who: 'Tallow', text: 'Oh! A visitor! I had stopped expecting those. Tallow, cartographer, last lamplighter of the Row. Well. Last one still lit.' }, { who: 'Tallow', text: 'The others went dark one by one when Sorrel took the light. Not dead, exactly. Emptied. They wander the Row with their lamps out. You will meet one.' }, { who: 'Tallow', text: 'Here, I have marked what I know of these streets and the throat above on your map. Sorrel is up there. He was kind, once. Do not let that slow your hand.' }],
    again: [{ who: 'Tallow', text: 'East along the Row and up: the Cinderthroat. There is a hearth by the gate; the lamplighters built it for the climb. Use it.' }],
    done: [{ who: 'Tallow', text: 'The lamps are lighting themselves again, one by one. I keep counting them. I cannot stop counting them.' }],
  },
  ringer: {
    first: [{ who: 'the Bell Ringer', text: '...you can hear me? It has been long since anyone could. I rang the bell when the water rose. I rang it until it took me.' }, { who: 'the Bell Ringer', text: 'It hangs below, still. It has learned to ring itself. The drowned gather to it and it keeps them. The gift Sorrel hid is beneath it.' }, { who: 'the Bell Ringer', text: 'Strike it when it falls to the floor. Leave the ground when it tolls. And do not stand where the water drips.' }],
    again: [{ who: 'the Bell Ringer', text: 'Below. Fall, and be quick. When it tolls, be in the air.' }],
    done: [{ who: 'the Bell Ringer', text: 'Quiet. I had forgotten quiet. Thank you, spark. I think I can rest now.' }],
  },
};

class Game {
  constructor() {
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d');
    this.uiCanvas = document.getElementById('ui'); this.ui = new UI(this.uiCanvas);
    this.input = new Input(); this.audio = new AudioSys(); this.fx = new FX();
    this.world = new World(MAP); this.renderer = new Renderer(this.world);
    this.state = 'title'; this.time = 0; this.playtime = 0; this.deaths = 0; this.acc = 0; this.last = 0; this.fadeAlpha = 0; this.hint = null;
    this.hasSave = !!loadGame(); this.audioStarted = false; this.resetConfirm = false;
    this.cam = { x: 0, y: 0, lookX: 0 }; this.area = null; this.endingT = 0; this.deathT = 0; this.viewW = VIEW_W; this.viewH = VIEW_H; this.zoom = 1;
    window.addEventListener('resize', () => this.resize()); this.resize();
    this.explored = new Uint8Array(Math.ceil(this.world.w / MAP_CELL) * Math.ceil(this.world.h / MAP_CELL)); this.benchesSeen = [];
    this.setupWorld(loadGame());
    requestAnimationFrame((t) => this.frame(t));
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ww = window.innerWidth, wh = window.innerHeight; const rs = this.renderScale || 1; const W = Math.max(64, Math.round(ww * dpr * rs)), H = Math.max(64, Math.round(wh * dpr * rs));
    this.canvas.width = W; this.canvas.height = H; this.canvas.style.width = ww + 'px'; this.canvas.style.height = wh + 'px';
    const stage = document.getElementById('stage'); stage.style.width = ww + 'px'; stage.style.height = wh + 'px';
    this.uiCanvas.style.width = ww + 'px'; this.uiCanvas.style.height = wh + 'px';
    this.zoom = Math.min(H / VIEW_H, W / 400); this.viewW = W / this.zoom; this.viewH = H / this.zoom;
    this.renderer.setSize(W, H, this.zoom); this.ui.resize(this.zoom, W, H, this.viewW, this.viewH);
  }
  // ---------- world setup / reset
  setupWorld(save) {
    const W = this.world; this.save = save;
    const start = W.findEntity('P'); this.startPos = { x: start.tx * TILE + 3, y: start.ty * TILE + TILE - PH };
    this.player = makePlayer(this.startPos.x, this.startPos.y);
    this.pickups = W.entities.filter((e) => PICKUP_CHARS.has(e.type)).map(makePickup);
    this.petalsTotal = this.pickups.filter((p) => p.type === 'H').length;
    this.decor = W.entities.filter((e) => ['B', 'T', '+', 'N', 'W', 'Q', 'K', 'L', 'G', 'h'].includes(e.type));
    this.lights = []; this.projectiles = []; this.boss = null; this.bossArena = null; this.bossName = ''; this.collected = new Set();
    this.arenas = MAP.bossArenas.map((a) => Object.assign({ done: false }, a));
    this.benchPos = { x: this.startPos.x, y: this.startPos.y }; this.flags = {}; this.heartwood = 0; this.heartwoodUsed = 0;
    if (save) {
      const p = this.player; Object.assign(p.abilities, save.abilities || {}); p.maxHp = save.maxHp || 5; p.hp = p.maxHp; p.damage = save.damage || 1;
      (save.collected || []).forEach((id) => this.collected.add(id)); this.pickups.forEach((pk) => { if (this.collected.has(pk.id)) pk.taken = true; });
      W.applyBroken(save.broken || []); this.deaths = save.deaths || 0; this.playtime = save.playtime || 0;
      for (const id of (save.arenasDone || [])) { const a = this.arenas.find((x) => x.id === id); if (a) a.done = true; }
      if (save.bench && Number.isFinite(save.bench.x) && Number.isFinite(save.bench.y)) { this.benchPos = { x: save.bench.x, y: save.bench.y }; p.x = save.bench.x; p.y = save.bench.y; }
      if (save.explored) { const arr = save.explored; for (let i = 0; i < Math.min(arr.length, this.explored.length); i++) this.explored[i] = arr[i]; }
      this.benchesSeen = save.benchesSeen || []; this.flags = save.flags || {}; this.heartwood = save.heartwood || 0; this.heartwoodUsed = save.heartwoodUsed || 0;
    }
    // boss rewards stay hidden until their guardian is gone
    for (const a of this.arenas) { const pk = this.pickups.find((k) => k.type === a.reward); if (pk) pk.visible = a.done; }
    this.spawnEnemies();
    this.petalsFound = [...this.collected].filter((id) => id.startsWith('H_')).length;
    const pc = pCenter(this.player); this.cam.x = pc.x - this.viewW / 2; this.cam.y = pc.y - this.viewH / 2; this.clampCam();
    this.area = W.areaAt(Math.floor(pc.x / TILE), Math.floor(pc.y / TILE)); this.audio.setArea(this.area);
    this.ui.mapDirty = true;
  }
  spawnEnemies() { this.enemies = this.world.entities.filter((e) => ENEMY_CHARS.has(e.type) && !(e.type === 'k' && this.collected.has(e.id))).map(makeEnemy); }
  persist() {
    const p = this.player;
    saveGame({ abilities: p.abilities, maxHp: p.maxHp, damage: p.damage, collected: [...this.collected], broken: this.world.brokenWalls, bench: this.benchPos, arenasDone: this.arenas.filter((a) => a.done).map((a) => a.id), deaths: this.deaths, playtime: this.playtime, explored: Array.from(this.explored), benchesSeen: this.benchesSeen, flags: this.flags, heartwood: this.heartwood, heartwoodUsed: this.heartwoodUsed });
    this.hasSave = true;
  }
  newGame() { clearSave(); this.audio.setBoss(false); this.darkPhase = false; this.world = new World(MAP); this.renderer = new Renderer(this.world); this.renderer.setSize(this.canvas.width, this.canvas.height, this.zoom); this.explored.fill(0); this.benchesSeen = []; this.deaths = 0; this.playtime = 0; this.setupWorld(null); this.fx = new FX(); }
  // ---------- main loop
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    const dtReal = Math.min(0.1, (t - this.last) / 1000 || 0); this.last = t;
    this.input.pollGamepad();
    if (!this.audioStarted && this.input.anyKeyPressed) { this.audio.init(); this.audioStarted = true; }
    this.audio.resume();
    this.time += dtReal;
    this.adaptQuality(dtReal);
    const STEP = 1 / 60; this.acc += dtReal * (this.state === 'play' ? this.fx.slowmo : 1); let steps = 0;
    while (this.acc >= STEP && steps < 5) { this.tick(STEP); this.acc -= STEP; steps++; }
    if (this.acc > STEP * 5) this.acc = STEP * 5;
    this.ui.update(dtReal, this.audioStarted ? this.audio : null);
    this.render();
  }
  // Adaptive resolution: if frames run long for a while, render at a lower internal scale (and recover when they are fast)
  adaptQuality(dt) {
    this.frameAvg = lerp(this.frameAvg || dt, dt, 0.05); this.qualityT = (this.qualityT || 0) + dt;
    if (this.qualityT < 2.5) return; this.qualityT = 0;
    const rs = this.renderScale || 1;
    if (this.frameAvg > 1 / 38 && rs > 0.5) { this.renderScale = Math.max(0.5, +(rs - 0.15).toFixed(2)); this.resize(); }
    else if (this.frameAvg < 1 / 75 && rs < 1) { this.renderScale = Math.min(1, +(rs + 0.15).toFixed(2)); this.resize(); }
  }
  tick(dt) {
    const inp = this.input; const st = this.state;
    if (st === 'title') this.tickTitle();
    else if (st === 'intro') this.tickIntro();
    else if (st === 'pause') this.tickPause();
    else if (st === 'map') { if (inp.isPressed('map') || inp.isPressed('back') || inp.isPressed('pause')) { this.state = 'play'; this.audio.play('ui'); } }
    else if (st === 'ending') { this.endingT += dt; this.fx.update(dt); if (this.endingT > 4 && (inp.isPressed('jump') || inp.isPressed('confirm'))) { this.state = 'play'; this.fadeAlpha = 0; } }
    else if (st === 'dead') { this.deathT += dt; this.fx.update(dt); if (this.deathT > 2.2) this.respawn(); }
    else if (st === 'dialogue') { this.fx.update(dt); this.tickWorldPassive(dt); if (inp.isPressed('confirm') || inp.isPressed('jump') || inp.isPressed('up')) { if (!this.ui.advanceDialogue()) this.state = 'play'; } }
    else if (st === 'splash') { this.fx.update(dt); if (this.ui.splash.t > 0.6 && (inp.isPressed('jump') || inp.isPressed('attack') || inp.isPressed('confirm'))) { this.ui.splash = null; this.state = 'play'; this.audio.play('ui'); } }
    else if (st === 'play') {
      if (inp.isPressed('pause')) { this.state = 'pause'; this.ui.menuIdx = 0; this.resetConfirm = false; this.audio.play('ui'); }
      else if (inp.isPressed('map')) { this.state = 'map'; this.audio.play('ui'); }
      else if (this.tickPlay(dt) === false) return; // hit-stop: keep presses buffered for the next real tick
    }
    inp.endTick();
  }
  tickTitle() {
    const inp = this.input; const n = this.hasSave ? 2 : 1;
    if (inp.isPressed('down')) { this.ui.menuIdx = (this.ui.menuIdx + 1) % n; this.audio.play('ui'); }
    if (inp.isPressed('up')) { this.ui.menuIdx = (this.ui.menuIdx + n - 1) % n; this.audio.play('ui'); }
    if (inp.isPressed('confirm')) {
      if (!this.hasSave || this.ui.menuIdx === 1) { if (this.hasSave) this.newGame(); this.state = 'intro'; this.ui.startIntro(INTRO_PAGES); this.audio.play('ui'); }
      else this.startPlay();
    }
    this.fx.update(1 / 60);
  }
  tickIntro() {
    const inp = this.input; const it = this.ui.intro;
    if ((inp.isPressed('jump') || inp.isPressed('confirm')) && it && it.t > 0.6) { it.i++; it.t = 0; this.audio.play('ui'); if (it.i >= it.pages.length) { this.ui.intro = null; this.startPlay(); } }
    else if (inp.isPressed('pause')) { this.ui.intro = null; this.startPlay(); }
  }
  startPlay() {
    this.state = 'play'; this.audio.play('ui'); this.ui.showArea(this.world.areaInfo(this.area).name);
    if (!this.save) { this.hint = 'Arrows / WASD to move · Z / Space to jump · X to strike · Up to talk to Wick'; setTimeout(() => { if (this.hint && this.hint.startsWith('Arrows')) this.hint = null; }, 12000); }
  }
  tickPause() {
    const inp = this.input;
    if (inp.isPressed('pause') || inp.isPressed('map')) { this.state = 'play'; this.audio.play('ui'); return; }
    if (inp.isPressed('down') || inp.isPressed('up')) { this.ui.menuIdx = 1 - this.ui.menuIdx; this.resetConfirm = false; this.audio.play('ui'); }
    if (inp.isPressed('confirm')) {
      if (this.ui.menuIdx === 0) { this.state = 'play'; this.audio.play('ui'); }
      else if (!this.resetConfirm) this.resetConfirm = true;
      else { this.newGame(); this.resetConfirm = false; this.state = 'intro'; this.ui.startIntro(INTRO_PAGES); }
    }
  }
  // ---------- gameplay tick
  tickWorldPassive(dt) { for (const pk of this.pickups) pk.t += dt; }
  tickPlay(dt) {
    const p = this.player, W = this.world, fx = this.fx, inp = this.input.snapshot();
    this.playtime += dt;
    if (fx.hitstop > 0) { fx.hitstop -= dt; fx.update(dt * 0.25); return false; }
    const pc0 = pCenter(p);
    // warmth: rekindling is quicker beside a hearth, a lamp or a chime crystal
    p.warm = false; for (const d of this.decor) { if (d.type !== 'B' && d.type !== 'T' && d.type !== '+') continue; const dx = d.tx * TILE + 8 - pc0.x, dy = d.ty * TILE + 4 - pc0.y; if (dx * dx + dy * dy < 70 * 70) { p.warm = true; break; } }
    updatePlayer(p, inp, W, dt);
    for (const ev of p.events) this.handlePlayerEvent(ev); p.events.length = 0;
    // interactables
    this.nearInteract = null; const pc = pCenter(p);
    for (const d of this.decor) {
      if (!['N', 'W', 'Q', 'K', 'L', 'B'].includes(d.type)) continue;
      const dx = d.tx * TILE + 8 - pc.x, dy = d.ty * TILE + 8 - pc.y;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 22 && p.onGround) { this.nearInteract = d; break; }
    }
    if (this.nearInteract && this.input.isPressed('up') && !p.sitting && p.hurtTimer <= 0) this.interact(this.nearInteract);
    const tail = p.anim.tail; tail.push({ x: pc.x, y: pc.y }); if (tail.length > 9) tail.shift();
    if (Math.abs(p.vx) < 5 && Math.abs(p.vy) < 5) tail.length = 0;
    if (p.onGround && Math.abs(p.vx) > 100 && Math.random() < 0.25) fx.dust(pc.x - p.facing * 4, p.y + p.h, 1, -p.facing);
    if (p.onGround && Math.abs(p.vx) > 100 && Math.floor(p.anim.run / 4) !== Math.floor((p.anim.run - dt * Math.abs(p.vx) / 14) / 4)) this.audio.play('step');
    if (p.wallSliding && Math.random() < 0.4) fx.dust(p.x + (p.wallDir > 0 ? p.w : 0), p.y + p.h - 2, 1, 0);
    if (p.dashing > 0) fx.add({ x: pc.x, y: pc.y, vx: -p.dashDir * 30, vy: rand(-20, 20), life: 0.3, size: 3, color: '#cfe0ff', glow: true });
    if (p.focusing && Math.random() < 0.6) fx.add({ x: pc.x + rand(-20, 20), y: pc.y + rand(-16, 16), vx: 0, vy: -22, life: 0.6, size: 1.6, color: p.warm ? '#ffd080' : '#ffe0a0', glow: true });
    if (p.attackTimer > 0) this.resolveAttack();
    // enemies
    const ctxE = { spawnProjectile: (pr) => this.projectiles.push(pr), minionCount: () => this.enemies.filter((e) => e.alive && e.summoned).length, summon: (type) => this.summonMinions(type || 'e'), arena: this.bossArena ? this.bossArena.px : null };
    for (const e of this.enemies) {
      if (!e.alive) { e.deathT = (e.deathT || 0) + dt; continue; }
      const ec = eCenter(e); if (Math.abs(ec.x - pc.x) > this.viewW * 1.2 || Math.abs(ec.y - pc.y) > this.viewH * 1.2) continue;
      updateEnemy(e, p, W, dt, ctxE);
      for (const ev of e.events) this.handleEnemyEvent(e, ev);
      if (p.invuln <= 0 && !p.dead) {
        if (aabb(p, e)) hurtPlayer(p, e.def.dmg, ec.x, ec.y);
        else if (e.hitbox && aabb(p, e.hitbox)) hurtPlayer(p, e.hitbox.dmg, ec.x, ec.y);
      }
    }
    // boss
    if (this.boss) {
      const b = this.boss; updateBoss(b, p, W, dt, ctxE);
      for (const ev of b.events) this.handleBossEvent(b, ev);
      if (b.alive && p.invuln <= 0 && !p.dead) {
        const body = b.kind === 'bell' ? { x: b.x + 8, y: b.y + 2, w: b.w - 16, h: b.h - 18 } : b.kind === 'gulletroot' ? { x: b.x + 10, y: b.y + 6, w: b.w - 20, h: b.h - 6 } : { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: b.h - 4 };
        const touch = b.kind === 'gulletroot' ? (b.state !== 'submerge' && b.state !== 'emerge' && aabb(p, body)) : aabb(p, body);
        const hb = b.hitboxes.find((h) => aabb(p, h));
        if (touch || hb) hurtPlayer(p, hb ? hb.dmg : 1, eCenter(b).x, eCenter(b).y);
      }
      if (!b.alive) this.tickBossDeath(b, dt);
    }
    // projectiles
    this.projectiles = this.projectiles.filter((pr) => {
      const ok = updateProjectile(pr, W, dt);
      if (!ok) { if (pr.kind !== 'ring' && pr.kind !== 'thorn') fx.burst(pr.x, pr.y, 5, { speed: 40, life: 0.3, size: 1.5, color: pr.kind === 'shock' ? '#ff9a4a' : pr.kind === 'bolt' ? '#ffd080' : pr.kind === 'drop' ? '#8ce0ff' : '#c8ff5a', glow: true }); return false; }
      if (pr.kind === 'bolt') return this.resolveBolt(pr);
      if (p.invuln <= 0 && !p.dead && projectileHits(pr, p)) { if (hurtPlayer(p, 1, pr.x, pr.y)) return pr.kind === 'ring' || pr.kind === 'thorn' || pr.kind === 'vine'; }
      return true;
    });
    if (this.clearProjectiles) { this.projectiles = []; this.clearProjectiles = false; }
    // events raised by hits taken this tick (hurt, flare, die)
    for (const ev of p.events) this.handlePlayerEvent(ev); p.events.length = 0;
    // pickups
    for (const pk of this.pickups) {
      pk.t += dt; if (pk.taken || !pk.visible) continue;
      if (Math.abs(pk.x - pc.x) < 14 && Math.abs(pk.y - pc.y) < 16) this.collect(pk);
      else if (Math.random() < 0.05 && Math.abs(pk.x - pc.x) < this.viewW) fx.add({ x: pk.x + rand(-8, 8), y: pk.y + rand(-6, 6), vx: rand(-6, 6), vy: rand(-18, -6), life: 0.8, size: 1.2, color: pk.type === 'H' ? '#ffb0cc' : pk.type === '*' ? '#ffe0a0' : pk.type === 'S' ? '#ffd080' : ABILITY_COLORS[pk.type], glow: true });
    }
    // boss arena triggers
    const ptx = Math.floor(pc.x / TILE), pty = Math.floor(pc.y / TILE);
    if (!this.boss && !p.dead) for (const a of this.arenas) if (!a.done && W.inRect(ptx, pty, a.trigger) && p.onGround) { this.startBoss(a); break; }
    // area change
    const area = W.areaAt(ptx, pty);
    if (area !== this.area) { this.area = area; this.ui.showArea(W.areaInfo(area).name); if (!this.boss) this.audio.setArea(area); }
    // exploration
    const cw = Math.ceil(W.w / MAP_CELL);
    for (let cy = Math.floor(this.cam.y / TILE / MAP_CELL); cy <= Math.floor((this.cam.y + this.viewH) / TILE / MAP_CELL); cy++) for (let cx = Math.floor(this.cam.x / TILE / MAP_CELL); cx <= Math.floor((this.cam.x + this.viewW) / TILE / MAP_CELL); cx++) {
      const i = cy * cw + cx; if (cx >= 0 && cy >= 0 && cx < cw && i < this.explored.length && !this.explored[i]) { this.explored[i] = 1; this.ui.mapDirty = true; }
    }
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
      case 'bounce': A.play('bounce'); fx.shake(2, 0.12); fx.burst(pc.x, p.y + p.h, 12, { speed: 80, angle: -Math.PI / 2, spread: 2, life: 0.5, size: 2.2, color: ['#ff9ad8', '#ffd0f0', '#ffffff'], glow: true, drag: 2 }); break;
      case 'land': { const s = clamp(ev.speed / 430, 0.2, 1.2); A.play('land', { strength: s }); fx.land(pc.x, p.y + p.h, s); if (s > 0.9) fx.shake(1.2, 0.08); break; }
      case 'slash': { A.play('slash'); const dir = p.attackDir; const ax = dir === 'right' ? p.x + p.w + 2 : dir === 'left' ? p.x - 2 : pc.x; const ay = dir === 'up' ? p.y - 4 : dir === 'down' ? p.y + p.h + 4 : pc.y; fx.add({ x: ax, y: ay, life: 0.14, size: p.damage > 1 ? 26 : 22, color: p.damage > 1 ? '#ffe8c0' : '#e8f0ff', shape: 'arc', dir, shrink: false, wide: p.damage > 1 }); break; }
      case 'cast': { A.play('cast'); const up = this.input.isHeld('up'); const vx = up ? 0 : p.facing * 330, vy = up ? -330 : 0; this.projectiles.push({ x: pc.x + p.facing * 6, y: pc.y - 2, vx, vy, r: 5, grav: 0, kind: 'bolt', life: 0.75, owner: 'player' }); fx.glowBurst(pc.x, pc.y, 8, ['#ffb347', '#ffffff'], 60, 0.3); fx.shake(1, 0.08); break; }
      case 'flare': { A.play('flare'); fx.stop(0.1); fx.shake(5, 0.3); fx.doFlash(0.35, '#ffd080'); fx.add({ x: pc.x, y: pc.y, life: 0.5, size: 40, color: '#ffe0a0', shape: 'ring', shrink: false }); fx.glowBurst(pc.x, pc.y, 40, ['#ffd080', '#ffffff', '#ff8a3c'], 150, 0.7); for (const e of this.enemies) { if (!e.alive) continue; const ec = eCenter(e); const d = dist(ec.x, ec.y, pc.x, pc.y); if (d < 90) { const dir = sign(ec.x - pc.x) || 1; if (e.def.armored) { e.vx = dir * 200; } else { const res = damageEnemy(e, 1, pc.x, 'flare', true); e.vx = dir * 220; e.vy = -140; if (res === 'killed') this.onEnemyKilled(e); } } } this.ui.showToast('Your lantern flares! The blow is turned aside.', 2.2); break; }
      case 'hurt': this.onPlayerHurt(); break;
      case 'hazard': A.play('hurt'); fx.shake(4, 0.25); fx.doFlash(0.5, '#ff4040'); fx.glowBurst(pc.x, pc.y, 14, ['#ffffff', '#ff8080'], 90, 0.5); break;
      case 'respawn': fx.glowBurst(pc.x, pc.y, 12, ['#ffffff', '#c8d0ff'], 60, 0.5); break;
      case 'heal': A.play('heal'); fx.glowBurst(pc.x, pc.y, 22, ['#ffe0a0', '#ffffff'], 90, 0.6); fx.add({ x: pc.x, y: pc.y, life: 0.4, size: 18, color: '#ffe0a0', shape: 'ring', shrink: false }); this.hint = null; break;
      case 'focusstart': A.play('focus'); break;
      case 'break': { A.play('break'); fx.shake(5, 0.3); fx.stop(0.05); this.renderer.invalidateTiles(ev.tiles); for (const [tx, ty] of ev.tiles) { fx.burst(tx * TILE + 8, ty * TILE + 8, 6, { speed: 90, life: 0.7, size: 3, color: [PALETTES[this.area].rock, PALETTES[this.area].edge, '#e8d8ff'], grav: 300, shape: 'square', spin: 6 }); } this.ui.mapDirty = true; this.persist(); break; }
    }
  }
  onPlayerHurt() { const p = this.player, pc = pCenter(p); this.audio.play('hurt'); this.fx.shake(5, 0.3); this.fx.stop(0.08); this.fx.doFlash(0.35, '#ff3030'); this.fx.glowBurst(pc.x, pc.y, 12, ['#ff9090', '#ffffff'], 100, 0.5); if (p.dead) this.onDeath(); }
  onDeath() {
    if (this.state === 'dead') return;
    const p = this.player, pc = pCenter(p); this.state = 'dead'; this.deathT = 0; this.deaths++;
    this.audio.play('death'); this.fx.shake(6, 0.4); this.fx.stop(0.15); this.fx.glowBurst(pc.x, pc.y, 40, ['#ffffff', '#ffd0c0', '#ff8080'], 140, 1.2); this.fx.doFlash(0.6, '#ffffff');
    if (this.boss) this.endBoss(false);
  }
  respawn() {
    if (this.boss) this.endBoss(false);
    const p = this.player; const keep = { abilities: p.abilities, maxHp: p.maxHp, damage: p.damage };
    Object.assign(p, makePlayer(this.benchPos.x, this.benchPos.y)); p.abilities = keep.abilities; p.maxHp = keep.maxHp; p.damage = keep.damage; p.hp = p.maxHp; p.soul = 0;
    this.spawnEnemies(); this.projectiles = []; this.state = 'play'; this.fadeAlpha = 1;
    const pc = pCenter(p); this.cam.x = pc.x - this.viewW / 2; this.cam.y = pc.y - this.viewH / 2; this.clampCam(); this.persist();
    this.fx.glowBurst(pc.x, pc.y, 20, ['#ffffff', '#ffd0a0'], 60, 0.8);
  }
  onEnemyKilled(e) {
    const ec = eCenter(e), p = this.player; this.audio.play('kill'); this.fx.death(ec.x, ec.y, e.def.color); this.fx.add({ x: ec.x, y: ec.y, life: 0.35, size: 14, color: '#ffffff', shape: 'ring', shrink: false });
    if (e.def.big) { this.fx.stop(0.14); this.fx.shake(6, 0.4); this.fx.slow(0.35, 0.5); this.fx.glowBurst(ec.x, ec.y, 50, ['#ffd080', '#ffffff', e.def.color], 160, 1.2); this.collected.add(e.id); this.ui.showToast('The husk goes dark for good. Its lamp is finally still.', 3); this.persist(); }
    else { this.fx.stop(0.07); this.fx.shake(3, 0.15); }
    p.soul = Math.min(PHYS.SOUL_MAX, p.soul + 6);
  }
  resolveAttack() {
    const p = this.player, hb = attackHitbox(p), fx = this.fx, pc = pCenter(p); let pogoed = false;
    const gainSoul = () => { p.soul = Math.min(PHYS.SOUL_MAX, p.soul + PHYS.SOUL_HIT); };
    for (const e of this.enemies) {
      if (!e.alive || p.attackHit.has(e.id)) continue;
      if (aabb(hb, e)) {
        p.attackHit.add(e.id); const ec = eCenter(e); const ang = Math.atan2(ec.y - pc.y, ec.x - pc.x);
        const res = damageEnemy(e, p.damage, pc.x, p.attackDir, false);
        if (res === 'blocked') { this.audio.play('blocked'); fx.sparks((ec.x + pc.x) / 2, (ec.y + pc.y) / 2, ang + Math.PI, ['#ffd080', '#ffffff']); fx.stop(0.03); if (p.onGround) { p.recoil = 0.12; p.vx = -p.facing * 150; } this.ui.showToast('Its shell turns your splinter. Strike from behind, or burn it.', 2.2); if (p.attackDir === 'down') pogoed = true; continue; }
        gainSoul(); fx.soul(ec.x, ec.y, pc.x, pc.y);
        fx.sparks((ec.x + pc.x) / 2, (ec.y + pc.y) / 2, ang, ['#ffffff', '#ffe0a0']); fx.add({ x: (ec.x + pc.x) / 2, y: (ec.y + pc.y) / 2, life: 0.22, size: 8, color: '#ffffff', shape: 'ring', shrink: false });
        if (res === 'killed') this.onEnemyKilled(e); else { this.audio.play('hit'); fx.stop(0.04); fx.shake(1.5, 0.1); }
        if (p.attackDir === 'down') pogoed = true; else if (p.onGround) { p.recoil = 0.08; p.vx = -p.facing * 90; }
      }
    }
    if (this.boss && this.boss.alive && !p.attackHit.has('boss') && aabb(hb, this.boss)) {
      p.attackHit.add('boss'); const bc = eCenter(this.boss); const ang = Math.atan2(bc.y - pc.y, bc.x - pc.x);
      const res = damageBoss(this.boss, p.damage);
      if (res === 'blocked') { this.audio.play('blocked'); fx.sparks(pc.x + Math.cos(ang) * 16, pc.y + Math.sin(ang) * 10, ang + Math.PI, ['#c0c0ff']); }
      else { gainSoul(); fx.soul(bc.x, bc.y, pc.x, pc.y); fx.sparks(pc.x + Math.cos(ang) * 16, pc.y + Math.sin(ang) * 10, ang, ['#ffffff', '#ffb080']); fx.add({ x: pc.x + Math.cos(ang) * 16, y: pc.y + Math.sin(ang) * 10, life: 0.25, size: 10, color: '#ffe0c0', shape: 'ring', shrink: false }); if (res === 'killed') this.onBossKilled(); else { this.audio.play('hit'); fx.stop(0.05); fx.shake(2, 0.1); } }
      if (p.attackDir === 'down') pogoed = true; else if (p.onGround) { p.recoil = 0.08; p.vx = -p.facing * 110; }
    }
    this.projectiles = this.projectiles.filter((pr) => { if (['spore', 'gloam', 'drop'].includes(pr.kind) && aabb(hb, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 })) { fx.burst(pr.x, pr.y, 8, { speed: 70, life: 0.35, size: 2, color: '#c8ff5a', glow: true }); this.audio.play('hit'); if (p.attackDir === 'down') pogoed = true; return false; } return true; });
    if (p.attackDir === 'down' && !pogoed && this.world.rectHas(hb.x + 6, hb.y, hb.w - 12, hb.h - 8, (tx, ty) => this.world.isSpike(tx, ty) || this.world.isBouncer(tx, ty))) { pogoed = true; fx.sparks(pc.x, p.y + p.h + 8, -Math.PI / 2, ['#ffffff', '#d8dce8']); }
    if (pogoed) { pogo(p); this.audio.play('pogo'); fx.dust(pc.x, p.y + p.h + 4, 4, 0); }
  }
  resolveBolt(pr) {
    const fx = this.fx, p = this.player; const box = { x: pr.x - 6, y: pr.y - 6, w: 12, h: 12 };
    for (const e of this.enemies) {
      if (!e.alive || !aabb(box, e)) continue;
      const ec = eCenter(e); const res = damageEnemy(e, 2, pr.x, 'bolt', true); p.soul = Math.min(PHYS.SOUL_MAX, p.soul + 6);
      fx.glowBurst(pr.x, pr.y, 14, ['#ffb347', '#ffffff'], 90, 0.4); fx.add({ x: pr.x, y: pr.y, life: 0.3, size: 12, color: '#ffd080', shape: 'ring', shrink: false });
      if (res === 'killed') this.onEnemyKilled(e); else { this.audio.play('hit'); fx.stop(0.04); }
      return false;
    }
    if (this.boss && this.boss.alive && aabb(box, this.boss)) {
      const res = damageBoss(this.boss, 2); fx.glowBurst(pr.x, pr.y, 16, ['#ffb347', '#ffffff'], 100, 0.4);
      if (res === 'killed') this.onBossKilled(); else if (res === 'hit') { this.audio.play('hit'); fx.stop(0.05); p.soul = Math.min(PHYS.SOUL_MAX, p.soul + 6); } else this.audio.play('blocked');
      return false;
    }
    return true;
  }
  handleEnemyEvent(e, ev) {
    const ec = eCenter(e), fx = this.fx;
    switch (ev) {
      case 'spit': this.audio.play('spit'); fx.burst(ec.x, ec.y - 6, 5, { speed: 40, life: 0.3, size: 1.5, color: e.type === 'r' ? '#b0a0ff' : '#c8ff5a', glow: true }); break;
      case 'charge': this.audio.play('charge'); fx.dust(ec.x, e.y + e.h, 8, -e.facing); break;
      case 'alert': fx.add({ x: ec.x, y: e.y - 8, vy: -20, life: 0.5, size: 2, color: '#ff8080', glow: true }); break;
      case 'lunge': this.audio.play('dash'); fx.dust(ec.x, e.y + e.h, 6, -e.facing); break;
      case 'bonk': fx.shake(3, 0.15); fx.sparks(e.x + (e.facing > 0 ? e.w : 0), ec.y, e.facing > 0 ? Math.PI : 0, ['#ffd0a0']); this.audio.play('hit'); break;
      case 'hop': this.audio.play('hop'); fx.dust(ec.x, e.y + e.h, 4, 0); break;
      case 'land': fx.dust(ec.x, e.y + e.h, 3, 0); break;
      case 'blocked': break;
      case 'swing_tele': case 'lunge_tele': fx.add({ x: ec.x, y: e.y - 10, vy: -10, life: 0.4, size: 3, color: '#ff6a4a', glow: true }); break;
      case 'swing': this.audio.play('swing'); fx.add({ x: e.x + (e.facing > 0 ? e.w + 8 : -8), y: e.y + 10, life: 0.16, size: 24, color: '#ffd080', shape: 'arc', dir: e.facing > 0 ? 'right' : 'left', shrink: false, wide: true }); break;
      case 'stagger': fx.glowBurst(ec.x, ec.y, 10, ['#ffd080'], 60, 0.4); break;
    }
  }
  summonMinions(type) { const a = this.bossArena; if (!a) return; const W = this.world; const floorRow = Math.floor((this.boss ? this.boss.floorY : (a.rect[1] + a.rect[3]) * TILE) / TILE); const airRow = (tx) => { let ty = floorRow - 1; while (ty > a.rect[1] && W.isSolid(tx, ty)) ty--; return ty; }; const spots = [[a.rect[0] + 3, airRow(a.rect[0] + 3)], [a.rect[0] + a.rect[2] - 4, airRow(a.rect[0] + a.rect[2] - 4)]]; for (const [tx, ty] of spots) { const e = makeEnemy({ type, tx, ty, id: 'minion_' + Math.random() }); e.summoned = true; this.enemies.push(e); this.fx.glowBurst(e.x + 7, e.y + 5, 10, ['#ff8a3c', '#ffffff'], 60, 0.5); } }
  handleBossEvent(b, ev) {
    const bc = eCenter(b), fx = this.fx, A = this.audio;
    if (ev === 'roar') { A.play(b.kind === 'bell' ? 'bell' : 'roar'); fx.shake(5, 0.8); }
    else if (ev === 'charge') { A.play('charge'); fx.dust(bc.x, b.y + b.h, 12, -b.facing); }
    else if (ev === 'leap' || ev === 'dive') { A.play('jump'); fx.dust(bc.x, b.y + b.h, 10, 0); }
    else if (ev === 'slam') { A.play('slam'); fx.shake(8, 0.4); fx.stop(0.05); fx.land(bc.x, b.floorY, 3); }
    else if (ev === 'spit') A.play('spit');
    else if (ev === 'bonk') { A.play('slam'); fx.shake(6, 0.3); fx.sparks(b.x + (b.facing > 0 ? b.w : 0), bc.y, b.facing > 0 ? Math.PI : 0, ['#ffd0a0', '#ffffff']); }
    else if (ev === 'phase2') { A.play(b.kind === 'bell' ? 'bell' : 'roar'); fx.shake(6, 0.6); fx.doFlash(0.3, b.kind === 'bell' ? '#8ce0ff' : '#ff6030'); fx.glowBurst(bc.x, bc.y, 30, b.kind === 'bell' ? ['#8ce0ff', '#ffffff'] : ['#ff6a3a', '#ffd080'], 120, 0.8); this.ui.showToast(b.kind === 'bell' ? 'The bell rings faster, and the drowned stir.' : b.kind === 'gulletroot' ? 'Gulletroot writhes! Its roots reach further.' : 'The Lightless burns with fury!', 2.5); }
    else if (ev === 'phase3') { A.play('roar'); fx.shake(8, 0.8); fx.doFlash(0.5, '#ffffff'); this.ui.showToast('The lantern inside it cracks. The dark comes off it in waves.', 3); this.darkPhase = true; }
    else if (ev === 'summon') A.play('roar');
    else if (ev === 'thorns') { A.play('thorns'); fx.shake(3, 0.2); for (const x of (b.spots || [])) fx.burst(x, b.floorY, 8, { speed: 80, angle: -Math.PI / 2, spread: 1.5, life: 0.5, size: 2.5, color: ['#3a5a2a', '#c8ff5a'], grav: 300, shape: 'square' }); }
    else if (ev === 'lash') A.play('lash');
    else if (ev === 'submerged') { A.play('rumble'); fx.shake(4, 0.5); fx.burst(bc.x, b.floorY, 20, { speed: 70, angle: -Math.PI / 2, spread: 2.2, life: 0.7, size: 3, color: ['#3a5a2a', '#5a3a20'], grav: 300, shape: 'square' }); }
    else if (ev === 'emerge') { A.play('rumble'); fx.shake(5, 0.5); fx.burst(bc.x, b.floorY, 26, { speed: 90, angle: -Math.PI / 2, spread: 2.2, life: 0.8, size: 3, color: ['#3a5a2a', '#5a3a20', '#c8ff5a'], grav: 300, shape: 'square' }); }
    else if (ev === 'toll') { A.play('bell'); fx.shake(4, 0.4); fx.add({ x: bc.x, y: bc.y, life: 0.5, size: 30, color: '#8ce0ff', shape: 'ring', shrink: false }); }
    else if (ev === 'rain') A.play('lash');
    else if (ev === 'blink_out') { A.play('dash'); fx.glowBurst(bc.x, bc.y, 30, ['#2a1a22', '#ff5a3a'], 120, 0.6); }
    else if (ev === 'blink_in') { A.play('charge'); fx.glowBurst(bc.x, bc.y, 30, ['#ffd080', '#ff5a3a'], 120, 0.6); fx.shake(3, 0.2); }
    else if (ev === 'beam') { A.play('flare'); fx.shake(4, 0.5); fx.doFlash(0.25, '#ffe0c0'); }
  }
  startBoss(a) {
    const W = this.world; const sp = W.findEntity(a.spawn); if (!sp) return;
    const rectPx = { x: a.rect[0] * TILE, y: a.rect[1] * TILE, w: a.rect[2] * TILE, h: a.rect[3] * TILE };
    a.px = rectPx; this.bossArena = a; this.boss = makeBoss(a.id, sp.tx * TILE + 8, sp.ty * TILE + TILE); this.boss.arena = rectPx; this.bossName = a.name; this.darkPhase = false;
    W.closeGatesNear(a.rect); this.audio.play(a.id === 'bell' ? 'bell' : 'gate'); this.audio.setBoss(true); this.fx.shake(4, 0.5); this.ui.showBossCard(a.name, a.sub); this.hint = null;
    for (const g of W.entitiesOf('G')) if (W.closedGates.has(g.tx + ',' + g.ty)) this.fx.dust(g.tx * TILE + 8, g.ty * TILE + 16, 4, 0);
  }
  endBoss(won) { this.world.openGates(); this.audio.setBoss(false); this.audio.setArea(this.area); this.darkPhase = false; if (!won) { this.boss = null; this.bossArena = null; } this.enemies = this.enemies.filter((e) => !e.summoned); }
  onBossKilled() {
    const b = this.boss; this.audio.play('bossdeath'); this.fx.stop(0.3); this.fx.slow(0.35, 1.6); this.fx.shake(10, 1.5); this.fx.doFlash(0.8, '#ffffff');
    this.bossArena.done = true; this.endBoss(true); this.clearProjectiles = true; this.flags['slew_' + this.bossArena.id] = true; this.persist();
  }
  tickBossDeath(b, dt) {
    const bc = eCenter(b);
    if (Math.random() < 0.5) this.fx.burst(bc.x + rand(-20, 20), bc.y + rand(-14, 14), 6, { speed: 90, life: 0.6, size: 3, color: b.kind === 'bell' ? ['#8ce0ff', '#ffffff'] : b.kind === 'gulletroot' ? ['#c8ff5a', '#3a5a2a'] : ['#ff8a3c', '#ffffff', '#3a2a3a'], glow: true, grav: 60 });
    if (b.deathT > 2.5) {
      this.fx.death(bc.x, bc.y, '#3a2a3a'); this.fx.glowBurst(bc.x, bc.y, 60, ['#ffe0a0', '#ffffff', '#ff8a3c'], 160, 1.4); this.audio.play('gate');
      const a = this.bossArena; const reward = this.pickups.find((k) => k.type === a.reward); if (reward) { reward.visible = true; this.fx.glowBurst(reward.x, reward.y, 30, ['#ffffff', ABILITY_COLORS[a.reward] || '#ffd060'], 90, 1); }
      this.boss = null; this.bossArena = null; this.ui.showToast(a.id === 'lightless' ? 'The Great Lantern lies open.' : 'Its gift lies bare. The gates open.', 2.5);
    }
  }
  collect(pk) {
    const p = this.player, pc = pCenter(p); pk.taken = true; this.collected.add(pk.id);
    if (pk.type === 'H') { p.maxHp++; p.hp = p.maxHp; this.petalsFound++; this.audio.play('shard'); this.fx.glowBurst(pk.x, pk.y, 24, ['#ff6fa0', '#ffffff'], 90, 0.7); this.fx.stop(0.1); this.ui.showToast(`A glowbloom petal opens in you. (${this.petalsFound}/${this.petalsTotal})`); }
    else if (pk.type === 'S') { this.heartwood++; this.audio.play('pickup'); this.fx.glowBurst(pk.x, pk.y, 20, ['#ffd080', '#ffffff'], 80, 0.6); this.ui.showToast(this.heartwood >= 2 && p.damage < 2 ? 'Heartwood, still warm. Old Bramble in Bramblehush could carve with two.' : 'Heartwood, still warm. Old Bramble would know what to do with it.', 3); }
    else if (pk.type === '*') { this.audio.play('ability'); this.fx.doFlash(1, '#fff4dc'); this.fx.slow(0.4, 1.5); this.state = 'ending'; this.endingT = 0; }
    else { const info = GIFT_INFO[pk.type]; p.abilities[info.key] = true; this.audio.play('ability'); this.fx.stop(0.2); this.fx.glowBurst(pk.x, pk.y, 40, [ABILITY_COLORS[pk.type], '#ffffff'], 120, 1); this.fx.doFlash(0.5, ABILITY_COLORS[pk.type]); this.ui.showSplash(info.title, info.sub, info.lines, info.color); this.state = 'splash'; }
    this.persist();
  }
  interact(d) {
    const p = this.player; const A = p.abilities; const doneAll = this.arenas.every((a) => a.done);
    const talk = (lines, cb) => { this.state = 'dialogue'; this.ui.startDialogue(lines, cb); this.audio.play('ui'); };
    if (d.type === 'B') { p.sitting = true; p.benchTimer = 0; p.hp = p.maxHp; p.x = d.tx * TILE + 3; const key = [d.tx, d.ty]; this.benchPos = { x: p.x, y: p.y }; if (!this.benchesSeen.some((b) => b[0] === d.tx && b[1] === d.ty)) this.benchesSeen.push(key); this.spawnEnemies(); this.projectiles = []; this.audio.play('bench'); this.fx.glowBurst(pCenter(p).x, pCenter(p).y, 20, ['#ffd27a', '#ffffff'], 50, 1); this.ui.showToast('You rest by the hearth. Every petal opens again, and the deep remembers this place.', 3); this.persist(); }
    else if (d.type === 'L') talk([{ who: 'Waystone', text: d.text }]);
    else if (d.type === 'N') { const key = doneAll ? 'done' : A.doublejump ? 'doublejump' : A.walljump ? 'walljump' : A.dash ? 'dash' : A.spell ? 'spell' : 'start'; talk(NPC_LINES.wick[key]); this.flags['wick_' + key] = true; }
    else if (d.type === 'W') {
      if (doneAll) talk(NPC_LINES.bramble.done);
      else if (p.damage >= 2) talk(NPC_LINES.bramble.carved);
      else if (this.heartwood >= 2) talk(NPC_LINES.bramble.carve, () => { p.damage = 2; this.heartwood -= 2; this.heartwoodUsed = 2; this.audio.play('upgrade'); this.fx.glowBurst(pCenter(p).x, pCenter(p).y, 40, ['#ffd080', '#ffffff'], 120, 1); this.fx.doFlash(0.4, '#ffd080'); this.ui.showToast('Your splinter is keen. It strikes for two.', 3); this.persist(); });
      else if (this.heartwood === 1) talk(NPC_LINES.bramble.hasOne);
      else talk(NPC_LINES.bramble.first);
      this.flags.bramble = true;
    }
    else if (d.type === 'Q') {
      if (doneAll) talk(NPC_LINES.tallow.done);
      else if (!this.flags.tallow) talk(NPC_LINES.tallow.first, () => { this.revealAreas(['lanternry', 'cinderthroat']); this.ui.showToast('Tallow has marked the Lanternry and the Cinderthroat on your map.', 3); this.audio.play('pickup'); });
      else talk(NPC_LINES.tallow.again);
      this.flags.tallow = true; this.persist();
    }
    else if (d.type === 'K') { const bell = this.arenas.find((a) => a.id === 'bell'); talk(bell.done ? NPC_LINES.ringer.done : this.flags.ringer ? NPC_LINES.ringer.again : NPC_LINES.ringer.first); this.flags.ringer = true; this.persist(); }
  }
  revealAreas(ids) { const W = this.world; const cw = Math.ceil(W.w / MAP_CELL); for (const id of ids) { const a = W.areaInfo(id); for (const r of a.rects) for (let cy = Math.floor(r[1] / MAP_CELL); cy <= Math.floor((r[1] + r[3] - 1) / MAP_CELL); cy++) for (let cx = Math.floor(r[0] / MAP_CELL); cx <= Math.floor((r[0] + r[2] - 1) / MAP_CELL); cx++) { const i = cy * cw + cx; if (i < this.explored.length) this.explored[i] = 1; } } this.ui.mapDirty = true; }
  ambient(dt) {
    const pal = PALETTES[this.area]; const fx = this.fx; if (Math.random() > dt * 14) return;
    const x = this.cam.x + Math.random() * this.viewW, y = this.cam.y + Math.random() * this.viewH;
    switch (pal.ambient) {
      case 'dust': fx.add({ x, y, vx: rand(-4, 4), vy: rand(-6, 2), life: 3, size: 0.9, color: '#b8b0e0', glow: true, shrink: false, alpha: 0.5 }); break;
      case 'spore': fx.add({ x, y, vx: rand(-6, 6), vy: rand(-10, -3), life: 4, size: 1.3, color: pick([pal.decor, '#ffffff']), glow: true, shrink: false, alpha: 0.55 }); break;
      case 'bubble': fx.add({ x, y: this.cam.y + this.viewH, vx: rand(-3, 3), vy: rand(-30, -14), life: 5, size: 1.2, color: '#8ce0ff', glow: true, shrink: false, alpha: 0.5 }); break;
      case 'sparkle': fx.add({ x, y, vx: 0, vy: rand(-3, 3), life: 1.2, size: 1.2, color: pick(['#ffffff', '#ecc0ff']), glow: true, alpha: 0.9 }); break;
      case 'ember': fx.add({ x, y: this.cam.y + this.viewH + 4, vx: rand(-8, 8), vy: rand(-40, -18), life: 3.5, size: 1.4, color: pick(['#ff8a3c', '#ffd080']), glow: true, drag: 0.3, alpha: 0.8 }); break;
      case 'rain': for (let i = 0; i < 3; i++) fx.add({ x: this.cam.x + Math.random() * this.viewW, y: this.cam.y - 10, vx: -20, vy: 380, life: 1.2, size: 0.8, color: '#9ab0e0', shape: 'streak', rot: Math.atan2(380, -20), len: 10, alpha: 0.35, shrink: false }); break;
    }
  }
  updateCamera(dt) {
    const p = this.player, pc = pCenter(p); const cam = this.cam;
    cam.lookX = lerp(cam.lookX, p.facing * 26 + clamp(p.vx, -80, 80) * 0.15, dt * 3);
    const tx = pc.x + cam.lookX - this.viewW / 2; const ty = pc.y - this.viewH / 2 + (p.vy > 200 ? 30 : 0) - 10;
    const k = 1 - Math.pow(0.001, dt);
    cam.x = lerp(cam.x, tx, k * 0.8); cam.y = lerp(cam.y, ty, k * 0.6);
    this.clampCam();
  }
  clampCam() {
    const cam = this.cam, W = this.world; let x0 = TILE, y0 = TILE, x1 = W.w * TILE - TILE, y1 = W.h * TILE - TILE;
    const pc = pCenter(this.player); const ptx = Math.floor(pc.x / TILE), pty = Math.floor(pc.y / TILE);
    for (const r of MAP.cameraLocks || []) if (W.inRect(ptx, pty, r)) { x0 = r[0] * TILE; y0 = r[1] * TILE; x1 = (r[0] + r[2]) * TILE; y1 = (r[1] + r[3]) * TILE; }
    cam.x = clamp(cam.x, x0, Math.max(x0, x1 - this.viewW)); cam.y = clamp(cam.y, y0, Math.max(y0, y1 - this.viewH));
  }
  // ---------- render
  render() {
    const ctx = this.ctx, R = this.renderer, cam = this.cam, t = this.time, W = this.world, fx = this.fx; const z = this.zoom, vw = this.viewW, vh = this.viewH;
    const [shx, shy] = fx.shakeOffset(); const c = { x: cam.x + shx, y: cam.y + shy };
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
    R.drawBackground(ctx, c, this.area, t, vw, vh);
    R.drawTerrain(ctx, c, vw, vh, t);
    ctx.setTransform(z, 0, 0, z, -c.x * z, -c.y * z);
    const lights = []; const p = this.player, pc = pCenter(p);
    const inView = (x, y, m = 48) => x > c.x - m && x < c.x + vw + m && y > c.y - m && y < c.y + vh + m;
    for (const d of this.decor) {
      const dx = d.tx * TILE, dy = d.ty * TILE; if (!inView(dx, dy, d.type === 'h' ? 160 : 48)) continue;
      drawDecor(ctx, d, t, { closedGates: W.closedGates, game: this });
      if (d.type === 'B') lights.push({ x: dx + 8, y: dy + 4, r: 80, a: 0.9, color: '#ffb347', glow: 0.22 });
      else if (d.type === 'T') lights.push({ x: dx + 13, y: dy - 6, r: 84 + Math.sin(t * 9 + dx) * 4, a: 0.9, color: '#ffc060', glow: 0.22 });
      else if (d.type === '+') lights.push({ x: dx + 8, y: dy + 8, r: 44, a: 0.8, color: '#c9a0ff', glow: 0.2 });
      else if (d.type === 'L') lights.push({ x: dx + 8, y: dy + 8, r: 26, a: 0.6, color: '#8ce0ff', glow: 0.12 });
      else if (d.type === 'N' || d.type === 'Q' || d.type === 'W' || d.type === 'K') lights.push({ x: dx + 8, y: dy, r: 44, a: 0.7, color: d.type === 'K' ? '#8ce0ff' : '#ffd080', glow: 0.12 });
      else if (d.type === 'h') lights.push({ x: dx + 72, y: dy - 30, r: 90, a: 0.5, color: '#ffd9a0', glow: 0.06 });
    }
    for (const pk of this.pickups) { if (pk.taken || !pk.visible) continue; if (!inView(pk.x, pk.y)) continue; drawPickup(ctx, pk, t); lights.push({ x: pk.x, y: pk.y, r: pk.type === '*' ? 90 : 40, a: 0.85, color: pk.type === 'H' ? '#ff6fa0' : pk.type === '*' ? '#ffd060' : pk.type === 'S' ? '#ffd080' : ABILITY_COLORS[pk.type], glow: 0.18 }); }
    for (const e of this.enemies) { if (!e.alive) continue; const ec = eCenter(e); if (!inView(ec.x, ec.y)) continue; drawEnemy(ctx, R, e, t); if (e.type === 's' && e.state === 'charge') lights.push({ x: ec.x, y: ec.y - 6, r: 30, a: 0.6, color: '#c8ff5a', glow: 0.15 }); if (e.type === 'g') lights.push({ x: ec.x, y: ec.y, r: 22, a: 0.5, color: '#ffd24a', glow: 0.1 }); if (e.type === 'k') lights.push({ x: ec.x + e.facing * 14, y: e.y + 2, r: 50, a: 0.7, color: '#ffd080', glow: 0.14 }); if (e.type === 'a') lights.push({ x: ec.x, y: ec.y, r: 26, a: 0.5, color: '#ff8a3c', glow: 0.1 }); }
    if (this.boss) { drawBoss(ctx, R, this.boss, t); const bc = eCenter(this.boss); lights.push({ x: bc.x, y: bc.y, r: 90, a: 0.7, color: this.boss.kind === 'bell' ? '#8ce0ff' : this.boss.kind === 'gulletroot' ? '#c8ff5a' : this.boss.phase >= 2 ? '#ff5a3a' : '#ff9a4a', glow: 0.14 }); }
    if (this.nearInteract && this.state === 'play') drawPrompt(ctx, this.nearInteract.tx * TILE + 8, this.nearInteract.ty * TILE - 10, t);
    drawPlayer(ctx, p, t);
    for (const pr of this.projectiles) { if (pr.delay > 0) continue; drawProjectile(ctx, pr, t); lights.push({ x: pr.x, y: pr.y, r: pr.kind === 'bolt' ? 40 : 22, a: 0.6, color: pr.kind === 'shock' ? '#ff9a4a' : pr.kind === 'bolt' ? '#ffd080' : pr.kind === 'drop' || pr.kind === 'ring' ? '#8ce0ff' : pr.kind === 'gloam' ? '#b0a0ff' : '#c8ff5a', glow: 0.15 }); }
    R.drawParticles(ctx, fx, c, vw, vh);
    if (!p.dead) lights.unshift({ x: pc.x, y: pc.y, r: p.focusing ? 170 : 150, a: 0.95, color: p.focusing || p.warm ? '#ffd080' : '#b8c4ff', glow: p.focusing ? 0.3 : 0.14 });
    const pal = this.darkPhase ? Object.assign({}, PALETTES[this.area], { dark: 0.62 }) : PALETTES[this.area];
    R.drawLighting(ctx, c, lights, pal, vw, vh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.flash > 0) { ctx.globalAlpha = fx.flash; ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, R.W, R.H); ctx.globalAlpha = 1; }
    if (this.fadeAlpha > 0) this.fadeAlpha = Math.max(0, this.fadeAlpha - 0.02);
    this.ui.draw(this);
  }
}
window.addEventListener('load', () => { window.game = new Game(); });

// Debug helper: render the whole world into a data URL (used by tests to eyeball the map)
Game.prototype.renderOverview = function () {
  const W = this.world; const scale = 0.25; const R2 = new Renderer(W); const c = document.createElement('canvas'); c.width = Math.ceil(W.w * TILE * scale); c.height = Math.ceil(W.h * TILE * scale);
  R2.setSize(c.width, c.height, scale); const ctx = c.getContext('2d'); ctx.fillStyle = '#05060c'; ctx.fillRect(0, 0, c.width, c.height);
  R2.drawTerrain(ctx, { x: 0, y: 0 }, W.w * TILE, W.h * TILE, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const colors = { H: '#ff6fa0', 1: '#5ad8ff', 2: '#8cff9a', 3: '#d49aff', 4: '#ffe080', S: '#ffb0ff', '*': '#ffd060', B: '#ffb347', P: '#ffffff', X: '#ff3030', Y: '#ff3030', Z: '#ff3030', e: '#ff8', f: '#8ff', s: '#8f8', c: '#f88', g: '#fc8', a: '#fa8', r: '#8af', j: '#af8', k: '#f4f', L: '#aef', N: '#cf8', Q: '#cf8', W: '#cf8', K: '#cf8', T: '#fa4', G: '#f0f', h: '#889' };
  for (const e of W.entities) { ctx.fillStyle = colors[e.type] || '#fff'; ctx.fillRect(e.tx * TILE * scale - 1, e.ty * TILE * scale - 1, 4, 4); }
  return c.toDataURL('image/png');
};
