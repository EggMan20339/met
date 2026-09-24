// ---- Enemies, boss, projectiles, pickups (DOM-free logic) --------------------
const ENEMY_DEFS = {
  e: { name: 'Gloom Beetle', hp: 2, w: 14, h: 11, speed: 34, dmg: 1, ground: true, color: '#3a2f4a', eye: '#ffb347' },
  f: { name: 'Wisp Moth', hp: 1, w: 10, h: 10, speed: 72, dmg: 1, ground: false, color: '#2d2a3e', eye: '#7fd7ff' },
  s: { name: 'Spore Bulb', hp: 3, w: 14, h: 16, dmg: 1, ground: true, color: '#3f4a2f', eye: '#c8ff5a' },
  c: { name: 'Husk Ram', hp: 4, w: 22, h: 15, speed: 38, chargeSpeed: 275, dmg: 1, ground: true, color: '#4a2f2f', eye: '#ff6a4a' },
  g: { name: 'Ash Shade', hp: 2, w: 12, h: 12, speed: 60, lunge: 260, dmg: 1, ground: false, color: '#3e2626', eye: '#ffd24a' },
};
const ENEMY_CHARS = new Set(Object.keys(ENEMY_DEFS));

function makeEnemy(ent) {
  const d = ENEMY_DEFS[ent.type];
  const x = ent.tx * TILE + (TILE - d.w) / 2, y = ent.ty * TILE + TILE - d.h;
  return { id: ent.id, type: ent.type, def: d, x, y, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp, facing: Math.random() < 0.5 ? -1 : 1, state: 'idle', t: 0, alive: true, flash: 0, spawn: { x, y }, anim: Math.random() * 10, events: [], aggro: false, dropThrough: 0 };
}
const eCenter = (e) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

function updateEnemy(e, p, world, dt, ctx) {
  e.t += dt; e.anim += dt; e.events.length = 0; if (e.flash > 0) e.flash -= dt;
  if (!e.alive) return;
  const pc = pCenter(p), ec = eCenter(e); const dx = pc.x - ec.x, dy = pc.y - ec.y; const d = Math.hypot(dx, dy);
  const D = e.def;
  switch (e.type) {
    case 'e': { // ground crawler: patrol, turn at walls/edges
      if (e.state === 'idle') { e.state = 'walk'; }
      if (e.state === 'hurt') { e.t2 = (e.t2 || 0) + dt; e.vx = approach(e.vx, 0, 400 * dt); if (e.t2 > 0.3) { e.state = 'walk'; e.t2 = 0; } }
      else e.vx = e.facing * D.speed;
      e.vy = Math.min(e.vy + 1500 * dt, 400);
      const hitX = moveX(e, e.vx * dt, world); if (hitX) { e.facing *= -1; e.vx = 0; }
      const hitY = moveY(e, e.vy * dt, world); if (hitY > 0) e.vy = 0;
      // turn at ledges
      const aheadX = e.facing > 0 ? e.x + e.w + 1 : e.x - 1;
      if (hitY > 0 && !world.rectSolid(aheadX, e.y + e.h + 1, 1, 1) && !world.rectHas(aheadX, e.y + e.h + 1, 1, 1, (tx, ty) => world.isOneWay(tx, ty))) e.facing *= -1;
      break;
    }
    case 'f': { // flying moth: hover near spawn, chase player when close
      const home = e.spawn; const nearP = d < 130 && Math.abs(dy) < 90;
      if (nearP && !e.aggro) { e.aggro = true; e.events.push('alert'); }
      if (e.aggro && d > 260) e.aggro = false;
      let tx, ty;
      if (e.aggro) { tx = pc.x; ty = pc.y - 6; }
      else { tx = home.x + Math.sin(e.anim * 0.7) * 30; ty = home.y + Math.cos(e.anim * 1.1) * 14; }
      const ang = Math.atan2(ty - ec.y, tx - ec.x); const sp = e.aggro ? D.speed : 30;
      e.vx = approach(e.vx, Math.cos(ang) * sp, 260 * dt); e.vy = approach(e.vy, Math.sin(ang) * sp + Math.sin(e.anim * 6) * 12, 260 * dt);
      if (moveX(e, e.vx * dt, world)) e.vx *= -0.5; if (moveY(e, e.vy * dt, world)) e.vy *= -0.5;
      if (Math.abs(e.vx) > 5) e.facing = sign(e.vx);
      break;
    }
    case 'g': { // shade: drifts, then lunges at the player
      if (e.state === 'idle') {
        const nearP = d < 150 && Math.abs(dy) < 100;
        const tx = e.spawn.x + Math.sin(e.anim * 0.9) * 26, ty = e.spawn.y + Math.cos(e.anim * 0.6) * 18;
        const ang = Math.atan2((nearP ? pc.y - 20 : ty) - ec.y, (nearP ? pc.x : tx) - ec.x);
        e.vx = approach(e.vx, Math.cos(ang) * (nearP ? D.speed : 25), 200 * dt); e.vy = approach(e.vy, Math.sin(ang) * (nearP ? D.speed : 25), 200 * dt);
        if (nearP && d < 90 && e.t > 1.6) { e.state = 'tele'; e.t = 0; e.events.push('alert'); }
      } else if (e.state === 'tele') { e.vx *= 0.9; e.vy *= 0.9; if (e.t > 0.45) { e.state = 'lunge'; e.t = 0; const a = Math.atan2(dy, dx); e.vx = Math.cos(a) * D.lunge; e.vy = Math.sin(a) * D.lunge; e.events.push('lunge'); } }
      else if (e.state === 'lunge') { e.vx *= 0.985; e.vy *= 0.985; if (e.t > 0.55) { e.state = 'idle'; e.t = 0; } }
      if (moveX(e, e.vx * dt, world)) e.vx *= -0.6; if (moveY(e, e.vy * dt, world)) e.vy *= -0.6;
      if (Math.abs(e.vx) > 5) e.facing = sign(e.vx);
      break;
    }
    case 's': { // spitter: stationary turret
      e.vy = Math.min(e.vy + 1500 * dt, 400); if (moveY(e, e.vy * dt, world) > 0) e.vy = 0;
      e.facing = dx < 0 ? -1 : 1;
      const inRange = d < 170 && Math.abs(dy) < 80;
      if (e.state === 'idle') { if (inRange && e.t > 1.2) { e.state = 'charge'; e.t = 0; } }
      else if (e.state === 'charge') { if (e.t > 0.6) { e.state = 'idle'; e.t = 0; const sp = 150; const a = Math.atan2(dy - d * 0.35, dx); ctx.spawnProjectile({ x: ec.x, y: ec.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, grav: 260, kind: 'spore', life: 3 }); e.events.push('spit'); } }
      break;
    }
    case 'c': { // charger: patrol; charge when the player is level with it
      e.vy = Math.min(e.vy + 1500 * dt, 400);
      if (e.state === 'idle') {
        e.vx = approach(e.vx, e.facing * D.speed, 300 * dt);
        if (Math.abs(dy) < 26 && Math.abs(dx) < 150 && e.t > 0.8) { e.state = 'tele'; e.t = 0; e.facing = sign(dx) || 1; e.events.push('alert'); }
      } else if (e.state === 'tele') { e.vx = approach(e.vx, 0, 600 * dt); if (e.t > 0.5) { e.state = 'charge'; e.t = 0; e.events.push('charge'); } }
      else if (e.state === 'charge') { e.vx = e.facing * D.chargeSpeed; if (e.t > 1.3) { e.state = 'idle'; e.t = 0; } }
      else if (e.state === 'stun') { e.vx = approach(e.vx, 0, 800 * dt); if (e.t > 0.9) { e.state = 'idle'; e.t = 0; e.facing *= -1; } }
      const hitX = moveX(e, e.vx * dt, world);
      if (hitX) { if (e.state === 'charge') { e.state = 'stun'; e.t = 0; e.events.push('bonk'); } else e.facing *= -1; e.vx = 0; }
      const hitY = moveY(e, e.vy * dt, world); if (hitY > 0) e.vy = 0;
      const aheadX = e.facing > 0 ? e.x + e.w + 1 : e.x - 1;
      if (hitY > 0 && e.state !== 'charge' && !world.rectSolid(aheadX, e.y + e.h + 1, 1, 1)) { if (e.state === 'idle') e.facing *= -1; }
      if (hitY > 0 && e.state === 'charge' && !world.rectSolid(aheadX, e.y + e.h + 1, 1, 1)) { e.state = 'stun'; e.t = 0; e.vx = 0; }
      break;
    }
  }
}
function damageEnemy(e, dmg, fromX, ctx) {
  if (!e.alive) return false;
  e.hp -= dmg; e.flash = 0.12;
  const dir = sign(eCenter(e).x - fromX) || 1;
  if (e.def.ground) { e.vx = dir * 120; if (e.type === 'e') { e.state = 'hurt'; e.t2 = 0; } if (e.type === 'c' && e.state !== 'charge') { e.vx = dir * 60; } }
  else { e.vx += dir * 140; e.vy -= 60; }
  if (e.hp <= 0) { e.alive = false; e.deathT = 0; e.events.push('death'); return true; }
  e.events.push('hurt'); return false;
}

// ---- Boss: The Warden --------------------------------------------------------
const BOSS = { w: 46, h: 36, hp: 30, phase2: 15, chargeSpeed: 300, dmg: 1 };
function makeBoss(x, y) {
  return { kind: 'boss', x: x - BOSS.w / 2, y: y - BOSS.h, w: BOSS.w, h: BOSS.h, vx: 0, vy: 0, hp: BOSS.hp, maxHp: BOSS.hp, facing: -1, state: 'intro', t: 0, alive: true, flash: 0, events: [], anim: 0, phase: 1, summonCd: 6, attacks: 0, dropThrough: 0, lastAttack: '' };
}
function updateBoss(b, p, world, dt, ctx) {
  b.t += dt; b.anim += dt; b.events.length = 0; if (b.flash > 0) b.flash -= dt;
  if (!b.alive) { b.deathT = (b.deathT || 0) + dt; return; }
  const pc = pCenter(p), bc = eCenter(b); const dx = pc.x - bc.x, dy = pc.y - bc.y;
  const grounded = world.rectSolid(b.x, b.y + b.h, b.w, 1);
  const gravity = () => { b.vy = Math.min(b.vy + 1400 * dt, 520); };
  if (b.hp <= BOSS.phase2 && b.phase === 1) { b.phase = 2; b.state = 'roar'; b.t = 0; b.events.push('phase2'); }
  const speedMul = b.phase === 2 ? 1.2 : 1;
  switch (b.state) {
    case 'intro': b.facing = sign(dx) || -1; gravity(); if (b.t > 1.2) { b.state = 'roar'; b.t = 0; b.events.push('roar'); } break;
    case 'roar': gravity(); b.vx = 0; if (b.t > 1.1) { b.state = 'idle'; b.t = 0; } break;
    case 'idle': {
      gravity(); b.vx = approach(b.vx, 0, 900 * dt); b.facing = sign(dx) || b.facing;
      const wait = (b.phase === 2 ? 0.5 : 0.8);
      if (b.t > wait && grounded) {
        b.t = 0; b.attacks++;
        const far = Math.abs(dx) > 120; const r = Math.random();
        let pickAtk;
        if (b.phase === 2 && b.summonCd <= 0 && ctx.minionCount() < 2) { pickAtk = 'summon'; b.summonCd = 11; }
        else if (b.phase === 2 && r < 0.3 && b.lastAttack !== 'spit') pickAtk = 'spit';
        else if (far ? r < 0.7 : r < 0.4) pickAtk = 'charge_tele'; else pickAtk = 'leap_tele';
        if (pickAtk === b.lastAttack && Math.random() < 0.5) pickAtk = pickAtk === 'charge_tele' ? 'leap_tele' : 'charge_tele';
        b.lastAttack = pickAtk; b.state = pickAtk; b.events.push('tele:' + pickAtk);
      }
      break;
    }
    case 'charge_tele': gravity(); b.vx = 0; b.facing = sign(dx) || b.facing; if (b.t > (b.phase === 2 ? 0.45 : 0.6)) { b.state = 'charge'; b.t = 0; b.events.push('charge'); } break;
    case 'charge': {
      gravity(); b.vx = b.facing * BOSS.chargeSpeed * speedMul;
      if (b.t > 1.6) { b.state = 'idle'; b.t = 0; }
      break;
    }
    case 'leap_tele': gravity(); b.vx = 0; b.facing = sign(dx) || b.facing; if (b.t > 0.45) { b.state = 'leap'; b.t = 0; b.vy = -560; b.vx = clamp(dx / 0.8, -260, 260) * speedMul; b.events.push('leap'); } break;
    case 'leap': { gravity(); if (b.t > 0.2 && grounded) { b.state = 'slam'; b.t = 0; b.vx = 0; b.events.push('slam'); ctx.spawnProjectile({ x: b.x - 4, y: b.y + b.h - 6, vx: -190, vy: 0, r: 6, grav: 0, kind: 'shock', life: 1.6 }); ctx.spawnProjectile({ x: b.x + b.w + 4, y: b.y + b.h - 6, vx: 190, vy: 0, r: 6, grav: 0, kind: 'shock', life: 1.6 }); } break; }
    case 'slam': gravity(); b.vx = 0; if (b.t > 0.7) { b.state = 'idle'; b.t = 0; } break;
    case 'spit': {
      gravity(); b.vx = 0; b.facing = sign(dx) || b.facing;
      if (!b.spat && b.t > 0.5) { b.spat = true; b.events.push('spit'); for (let i = -1; i <= 1; i++) { const a = Math.atan2(dy - 120, dx) + i * 0.32; const sp = 210; ctx.spawnProjectile({ x: bc.x + b.facing * 14, y: b.y + 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, grav: 300, kind: 'spore', life: 3 }); } }
      if (b.t > 1.0) { b.state = 'idle'; b.t = 0; b.spat = false; }
      break;
    }
    case 'summon': gravity(); b.vx = 0; if (!b.spat && b.t > 0.4) { b.spat = true; b.events.push('summon'); ctx.summon(); } if (b.t > 1.0) { b.state = 'idle'; b.t = 0; b.spat = false; } break;
    case 'stun': gravity(); b.vx = approach(b.vx, 0, 800 * dt); if (b.t > 1.3) { b.state = 'idle'; b.t = 0; } break;
  }
  b.summonCd -= dt;
  const hitX = moveX(b, b.vx * dt, world);
  if (hitX) { if (b.state === 'charge') { b.state = 'stun'; b.t = 0; b.events.push('bonk'); } b.vx = 0; }
  const hitY = moveY(b, b.vy * dt, world); if (hitY > 0) b.vy = 0; else if (hitY < 0) b.vy = 0;
}
function damageBoss(b, dmg) {
  if (!b.alive || b.state === 'intro' || b.state === 'roar') return false;
  b.hp -= dmg; b.flash = 0.12; b.events.push('hurt');
  if (b.hp <= 0) { b.hp = 0; b.alive = false; b.deathT = 0; b.state = 'dead'; b.events.push('death'); return true; }
  return false;
}

// ---- Projectiles --------------------------------------------------------------
function updateProjectile(pr, world, dt) {
  pr.life -= dt; pr.t = (pr.t || 0) + dt;
  pr.vy += (pr.grav || 0) * dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
  if (pr.life <= 0) return false;
  if (pr.kind === 'shock') {
    // hug the ground: if the tile below is empty, fall; if a wall ahead, die
    if (world.rectSolid(pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) return false;
    if (!world.rectSolid(pr.x - 2, pr.y + pr.r + 1, 4, 2)) pr.y += 60 * dt;
    return true;
  }
  if (world.rectSolid(pr.x - pr.r * 0.6, pr.y - pr.r * 0.6, pr.r * 1.2, pr.r * 1.2)) return false;
  return true;
}

// ---- Pickups ------------------------------------------------------------------
const PICKUP_CHARS = new Set(['H', '1', '2', '3', '*']);
function makePickup(ent) {
  return { id: ent.id, type: ent.type, x: ent.tx * TILE + TILE / 2, y: ent.ty * TILE + TILE / 2, taken: false, t: Math.random() * 10 };
}
