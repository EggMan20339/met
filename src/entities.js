// ---- Enemies, bosses, projectiles, pickups (DOM-free logic) ------------------
const ENEMY_DEFS = {
  e: { name: 'Dimling', hp: 2, w: 14, h: 11, speed: 34, dmg: 1, ground: true, color: '#3a2f4a', eye: '#ffb347' },
  f: { name: 'Hushmoth', hp: 1, w: 10, h: 10, speed: 72, dmg: 1, ground: false, color: '#2d2a3e', eye: '#7fd7ff' },
  s: { name: 'Sporeling', hp: 3, w: 14, h: 16, dmg: 1, ground: true, color: '#3f4a2f', eye: '#c8ff5a' },
  c: { name: 'Rootram', hp: 4, w: 22, h: 15, speed: 38, chargeSpeed: 275, dmg: 1, ground: true, color: '#4a2f2f', eye: '#ff6a4a' },
  g: { name: 'Snuffer', hp: 2, w: 12, h: 12, speed: 60, lunge: 260, dmg: 1, ground: false, color: '#3e2626', eye: '#ffd24a' },
  a: { name: 'Emberback', hp: 4, w: 18, h: 13, speed: 26, dmg: 1, ground: true, armored: true, color: '#4a3020', eye: '#ffb347' },
  r: { name: 'Gloamwing', hp: 2, w: 12, h: 10, speed: 55, dmg: 1, ground: false, color: '#2a2a44', eye: '#b0a0ff' },
  j: { name: 'Springfoot', hp: 3, w: 14, h: 12, speed: 30, dmg: 1, ground: true, color: '#2f4a3a', eye: '#ffe66a' },
  k: { name: 'Lampwright Husk', hp: 14, w: 18, h: 26, speed: 42, dmg: 1, ground: true, big: true, color: '#3a3448', eye: '#ffd080' },
};
const ENEMY_CHARS = new Set(Object.keys(ENEMY_DEFS));

function makeEnemy(ent) {
  const d = ENEMY_DEFS[ent.type];
  const x = ent.tx * TILE + (TILE - d.w) / 2, y = ent.ty * TILE + TILE - d.h;
  return { id: ent.id, type: ent.type, def: d, x, y, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp, facing: Math.random() < 0.5 ? -1 : 1, state: 'idle', t: 0, alive: true, flash: 0, spawn: { x, y }, anim: Math.random() * 10, events: [], aggro: false, dropThrough: 0, hitbox: null, hits: 0 };
}
const eCenter = (e) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });
const groundedE = (e, world) => world.rectSolid(e.x, e.y + e.h, e.w, 1) || world.rectHas(e.x, e.y + e.h, e.w, 1, (tx, ty) => world.isOneWay(tx, ty));

function updateEnemy(e, p, world, dt, ctx) {
  e.t += dt; e.anim += dt; e.events.length = 0; if (e.flash > 0) e.flash -= dt; e.hitbox = null;
  if (!e.alive) return;
  const pc = pCenter(p), ec = eCenter(e); const dx = pc.x - ec.x, dy = pc.y - ec.y; const d = Math.hypot(dx, dy);
  const D = e.def; const grav = () => { e.vy = Math.min(e.vy + 1500 * dt, 400); };
  switch (e.type) {
    case 'e': {
      if (e.state === 'idle') e.state = 'walk';
      if (e.state === 'hurt') { e.t2 = (e.t2 || 0) + dt; e.vx = approach(e.vx, 0, 400 * dt); if (e.t2 > 0.3) { e.state = 'walk'; e.t2 = 0; } }
      else e.vx = e.facing * D.speed;
      grav();
      const hitX = moveX(e, e.vx * dt, world); if (hitX) { e.facing *= -1; e.vx = 0; }
      const hitY = moveY(e, e.vy * dt, world); if (hitY > 0) e.vy = 0;
      const aheadX = e.facing > 0 ? e.x + e.w + 1 : e.x - 1;
      if (hitY > 0 && !world.rectSolid(aheadX, e.y + e.h + 1, 1, 1) && !world.rectHas(aheadX, e.y + e.h + 1, 1, 1, (tx, ty) => world.isOneWay(tx, ty))) e.facing *= -1;
      break;
    }
    case 'f': {
      const home = e.spawn; const nearP = d < 130 && Math.abs(dy) < 90;
      if (nearP && !e.aggro) { e.aggro = true; e.events.push('alert'); }
      if (e.aggro && d > 260) e.aggro = false;
      let tx, ty;
      if (e.aggro) { tx = pc.x; ty = pc.y - 6; } else { tx = home.x + Math.sin(e.anim * 0.7) * 30; ty = home.y + Math.cos(e.anim * 1.1) * 14; }
      const ang = Math.atan2(ty - ec.y, tx - ec.x); const sp = e.aggro ? D.speed : 30;
      e.vx = approach(e.vx, Math.cos(ang) * sp, 260 * dt); e.vy = approach(e.vy, Math.sin(ang) * sp + Math.sin(e.anim * 6) * 12, 260 * dt);
      if (moveX(e, e.vx * dt, world)) e.vx *= -0.5; if (moveY(e, e.vy * dt, world)) e.vy *= -0.5;
      if (Math.abs(e.vx) > 5) e.facing = sign(e.vx);
      break;
    }
    case 'g': {
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
    case 's': {
      grav(); if (moveY(e, e.vy * dt, world) > 0) e.vy = 0;
      e.facing = dx < 0 ? -1 : 1;
      const inRange = d < 170 && Math.abs(dy) < 80;
      if (e.state === 'idle') { if (inRange && e.t > 1.2) { e.state = 'charge'; e.t = 0; } }
      else if (e.state === 'charge') { if (e.t > 0.6) { e.state = 'idle'; e.t = 0; const sp = 150; const a = Math.atan2(dy - d * 0.35, dx); ctx.spawnProjectile({ x: ec.x, y: ec.y - 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, grav: 260, kind: 'spore', life: 3 }); e.events.push('spit'); } }
      break;
    }
    case 'c': {
      grav();
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
    case 'a': { // emberback: armored front & top; turns toward the player slowly
      grav();
      if (e.state === 'idle') e.state = 'walk';
      if (e.state === 'shell') { e.vx = approach(e.vx, 0, 500 * dt); if (e.t > 0.7) { e.state = 'walk'; e.t = 0; } }
      else {
        const near = Math.abs(dx) < 160 && Math.abs(dy) < 40;
        if (near && e.t > 1.1 && sign(dx) !== e.facing) { e.facing = sign(dx) || e.facing; e.t = 0; e.events.push('turn'); }
        e.vx = approach(e.vx, e.facing * D.speed * (near ? 1.6 : 1), 300 * dt);
      }
      const hitX = moveX(e, e.vx * dt, world); if (hitX) { e.vx = 0; if (!e.t2 || e.t > 0.6) { e.facing *= -1; } }
      const hitY = moveY(e, e.vy * dt, world); if (hitY > 0) e.vy = 0;
      const aheadX = e.facing > 0 ? e.x + e.w + 1 : e.x - 1;
      if (hitY > 0 && !world.rectSolid(aheadX, e.y + e.h + 1, 1, 1)) { e.facing *= -1; e.vx = 0; }
      break;
    }
    case 'r': { // gloamwing: keeps its distance in the air and fires paired bolts
      const want = 120; const nearP = d < 230 && Math.abs(dy) < 150;
      if (nearP && !e.aggro) { e.aggro = true; e.events.push('alert'); e.t = 0.6; }
      if (e.aggro && d > 320) e.aggro = false;
      let tx = e.spawn.x + Math.sin(e.anim * 0.6) * 24, ty = e.spawn.y + Math.cos(e.anim * 0.8) * 10;
      if (e.aggro) { const away = d < want ? -1 : 1; tx = ec.x + sign(dx) * away * 40; ty = pc.y - 58 + Math.sin(e.anim * 2) * 8; }
      const ang = Math.atan2(ty - ec.y, tx - ec.x); const sp = e.aggro ? D.speed : 22; const dist2 = Math.hypot(tx - ec.x, ty - ec.y);
      e.vx = approach(e.vx, dist2 > 6 ? Math.cos(ang) * sp : 0, 220 * dt); e.vy = approach(e.vy, dist2 > 6 ? Math.sin(ang) * sp : 0, 220 * dt);
      if (moveX(e, e.vx * dt, world)) e.vx *= -0.5; if (moveY(e, e.vy * dt, world)) e.vy *= -0.5;
      e.facing = dx < 0 ? -1 : 1;
      if (e.aggro) { e.t += 0; if (e.t > 2.4) { e.t = 0; e.state = 'fire'; e.events.push('spit'); for (let i = 0; i < 2; i++) { const a = Math.atan2(dy, dx) + (i - 0.5) * 0.18; ctx.spawnProjectile({ x: ec.x + Math.cos(a) * 8, y: ec.y + Math.sin(a) * 8, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, r: 3.5, grav: 0, kind: 'gloam', life: 2.2, delay: i * 0.12 }); } } }
      break;
    }
    case 'j': { // springfoot: hops in arcs toward the player
      grav(); const onG = groundedE(e, world);
      if (onG) {
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.state === 'air') { e.state = 'land'; e.t = 0; e.events.push('land'); }
        if (e.state !== 'land' || e.t > 0.35) {
          if (e.state !== 'wait') { e.state = 'wait'; e.t = 0; }
          const near = Math.abs(dx) < 220 && Math.abs(dy) < 120;
          if (e.t > (near ? 0.55 : 1.6)) { e.state = 'air'; e.t = 0; e.facing = near ? (sign(dx) || e.facing) : (Math.random() < 0.5 ? -1 : 1); const big = near && Math.abs(dx) > 90; e.vy = big ? -360 : -290; e.vx = e.facing * (big ? 150 : 90); e.events.push('hop'); }
        }
      }
      const hitX = moveX(e, e.vx * dt, world); if (hitX) { e.vx *= -0.4; e.facing *= -1; }
      const hitY = moveY(e, e.vy * dt, world); if (hitY > 0) e.vy = 0; else if (hitY < 0) e.vy = 0;
      break;
    }
    case 'k': { // lampwright husk: mini-boss with a lantern swing and a lunge
      grav();
      const near = Math.abs(dx) < 200 && Math.abs(dy) < 60;
      if (e.state === 'idle') { e.vx = approach(e.vx, 0, 600 * dt); if (near) { e.state = 'walk'; e.t = 0; e.events.push('alert'); } }
      else if (e.state === 'walk') {
        e.facing = sign(dx) || e.facing; e.vx = approach(e.vx, e.facing * D.speed, 400 * dt);
        if (Math.abs(dx) < 34 && Math.abs(dy) < 30 && e.t > 0.5) { e.state = 'swing_tele'; e.t = 0; e.events.push('swing_tele'); }
        else if (Math.abs(dx) > 70 && Math.abs(dx) < 190 && e.t > 1.4 && Math.random() < 0.02) { e.state = 'lunge_tele'; e.t = 0; e.events.push('lunge_tele'); }
        if (!near && e.t > 3) { e.state = 'idle'; e.t = 0; }
      }
      else if (e.state === 'swing_tele') { e.vx = approach(e.vx, 0, 800 * dt); if (e.t > 0.42) { e.state = 'swing'; e.t = 0; e.events.push('swing'); } }
      else if (e.state === 'swing') { e.vx = approach(e.vx, 0, 800 * dt); if (e.t < 0.18) e.hitbox = { x: e.facing > 0 ? e.x + e.w - 4 : e.x - 26, y: e.y - 2, w: 30, h: 26, dmg: 1 }; if (e.t > 0.6) { e.state = 'walk'; e.t = 0; } }
      else if (e.state === 'lunge_tele') { e.vx = approach(e.vx, 0, 800 * dt); e.facing = sign(dx) || e.facing; if (e.t > 0.38) { e.state = 'lunge'; e.t = 0; e.events.push('lunge'); } }
      else if (e.state === 'lunge') { e.vx = e.facing * 250; e.hitbox = { x: e.x - 2, y: e.y + 4, w: e.w + 4, h: e.h - 4, dmg: 1 }; if (e.t > 0.32) { e.state = 'walk'; e.t = 0; e.vx *= 0.3; } }
      else if (e.state === 'stagger') { e.vx = approach(e.vx, 0, 500 * dt); if (e.t > 0.9) { e.state = 'walk'; e.t = 0; } }
      const hitX = moveX(e, e.vx * dt, world); if (hitX) { e.vx = 0; if (e.state === 'lunge') { e.state = 'stagger'; e.t = 0; e.events.push('bonk'); } }
      const hitY = moveY(e, e.vy * dt, world); if (hitY > 0) e.vy = 0;
      break;
    }
  }
}
// Returns 'killed' | 'hit' | 'blocked'
function damageEnemy(e, dmg, fromX, fromDir, isBolt) {
  if (!e.alive) return 'none';
  const dir = sign(eCenter(e).x - fromX) || 1; // push direction (away from attacker)
  if (e.def.armored && !isBolt) {
    const fromFront = (fromX - eCenter(e).x) * e.facing > 0;
    if (fromFront || fromDir === 'down') { e.state = 'shell'; e.t = 0; e.vx = dir * 90; e.events.push('blocked'); return 'blocked'; }
  }
  e.hp -= dmg; e.flash = 0.12; e.hits++;
  if (e.def.ground) { if (!e.def.big) e.vx = dir * 120; if (e.type === 'e') { e.state = 'hurt'; e.t2 = 0; } if (e.type === 'k' && e.hits % 4 === 0 && e.state !== 'lunge') { e.state = 'stagger'; e.t = 0; e.events.push('stagger'); } }
  else { e.vx += dir * 140; e.vy -= 60; }
  if (e.hp <= 0) { e.alive = false; e.deathT = 0; e.events.push('death'); return 'killed'; }
  e.events.push('hurt'); return 'hit';
}

// ---- Bosses -------------------------------------------------------------------
const BOSS_DEFS = {
  lightless: { w: 46, h: 36, hp: 36, phase2: 24, phase3: 12, chargeSpeed: 300 },
  gulletroot: { w: 60, h: 44, hp: 26, phase2: 13 },
  bell: { w: 40, h: 44, hp: 28, phase2: 14 },
};
function makeBoss(kind, x, y) {
  const D = BOSS_DEFS[kind];
  return { kind, def: D, x: x - D.w / 2, y: y - D.h, w: D.w, h: D.h, vx: 0, vy: 0, hp: D.hp, maxHp: D.hp, facing: -1, state: 'intro', t: 0, alive: true, flash: 0, events: [], anim: 0, phase: 1, summonCd: 6, attacks: 0, dropThrough: 0, lastAttack: '', home: { x, y }, floorY: y, vulnerable: false, hitboxes: [] };
}
function updateBoss(b, p, world, dt, ctx) {
  b.t += dt; b.anim += dt; b.events.length = 0; if (b.flash > 0) b.flash -= dt; b.hitboxes = [];
  if (!b.alive) { b.deathT = (b.deathT || 0) + dt; return; }
  if (b.kind === 'lightless') updateLightless(b, p, world, dt, ctx);
  else if (b.kind === 'gulletroot') updateGulletroot(b, p, world, dt, ctx);
  else updateBell(b, p, world, dt, ctx);
}
function updateLightless(b, p, world, dt, ctx) {
  const D = b.def; const pc = pCenter(p), bc = eCenter(b); const dx = pc.x - bc.x, dy = pc.y - bc.y;
  const grounded = world.rectSolid(b.x, b.y + b.h, b.w, 1);
  const gravity = () => { b.vy = Math.min(b.vy + 1400 * dt, 520); };
  if (b.hp <= D.phase3 && b.phase === 2) { b.phase = 3; b.state = 'roar'; b.t = 0; b.events.push('phase3'); }
  if (b.hp <= D.phase2 && b.phase === 1) { b.phase = 2; b.state = 'roar'; b.t = 0; b.events.push('phase2'); }
  const speedMul = b.phase === 3 ? 1.3 : b.phase === 2 ? 1.2 : 1;
  b.vulnerable = !['intro', 'roar', 'blink'].includes(b.state);
  switch (b.state) {
    case 'intro': b.facing = sign(dx) || -1; gravity(); if (b.t > 1.2) { b.state = 'roar'; b.t = 0; b.events.push('roar'); } break;
    case 'roar': gravity(); b.vx = 0; if (b.t > 1.1) { b.state = 'idle'; b.t = 0; } break;
    case 'idle': {
      gravity(); b.vx = approach(b.vx, 0, 900 * dt); b.facing = sign(dx) || b.facing;
      const wait = (b.phase >= 2 ? 0.5 : 0.8);
      if (b.t > wait && grounded) {
        b.t = 0; b.attacks++;
        const far = Math.abs(dx) > 120; const r = Math.random(); let pick;
        if (b.phase >= 2 && b.summonCd <= 0 && ctx.minionCount() < 2) { pick = 'summon'; b.summonCd = 11; }
        else if (b.phase === 3 && r < 0.28 && b.lastAttack !== 'beam_tele') pick = 'beam_tele';
        else if (b.phase === 3 && r < 0.5 && b.lastAttack !== 'blink') pick = 'blink';
        else if (b.phase >= 2 && r < 0.62 && b.lastAttack !== 'spit') pick = 'spit';
        else if (far ? r < 0.82 : r < 0.5) pick = 'charge_tele'; else pick = 'leap_tele';
        if (pick === b.lastAttack && Math.random() < 0.5) pick = pick === 'charge_tele' ? 'leap_tele' : 'charge_tele';
        b.lastAttack = pick; b.state = pick; b.events.push('tele:' + pick);
      }
      break;
    }
    case 'charge_tele': gravity(); b.vx = 0; b.facing = sign(dx) || b.facing; if (b.t > (b.phase >= 2 ? 0.45 : 0.6)) { b.state = 'charge'; b.t = 0; b.events.push('charge'); } break;
    case 'charge': gravity(); b.vx = b.facing * D.chargeSpeed * speedMul; if (b.t > 1.6) { b.state = 'idle'; b.t = 0; } break;
    case 'leap_tele': gravity(); b.vx = 0; b.facing = sign(dx) || b.facing; if (b.t > 0.45) { b.state = 'leap'; b.t = 0; b.vy = -560; b.vx = clamp(dx / 0.8, -260, 260) * speedMul; b.events.push('leap'); } break;
    case 'leap': gravity(); if (b.t > 0.2 && grounded) { b.state = 'slam'; b.t = 0; b.vx = 0; b.events.push('slam'); ctx.spawnProjectile({ x: b.x - 4, y: b.y + b.h - 6, vx: -190, vy: 0, r: 6, grav: 0, kind: 'shock', life: 1.6 }); ctx.spawnProjectile({ x: b.x + b.w + 4, y: b.y + b.h - 6, vx: 190, vy: 0, r: 6, grav: 0, kind: 'shock', life: 1.6 }); } break;
    case 'slam': gravity(); b.vx = 0; if (b.t > 0.7) { b.state = 'idle'; b.t = 0; } break;
    case 'spit': {
      gravity(); b.vx = 0; b.facing = sign(dx) || b.facing;
      if (!b.spat && b.t > 0.5) { b.spat = true; b.events.push('spit'); for (let i = -1; i <= 1; i++) { const a = Math.atan2(dy - 120, dx) + i * 0.32; const sp = 210; ctx.spawnProjectile({ x: bc.x + b.facing * 14, y: b.y + 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, grav: 300, kind: 'spore', life: 3 }); } }
      if (b.t > 1.0) { b.state = 'idle'; b.t = 0; b.spat = false; }
      break;
    }
    case 'summon': gravity(); b.vx = 0; if (!b.spat && b.t > 0.4) { b.spat = true; b.events.push('summon'); ctx.summon(); } if (b.t > 1.0) { b.state = 'idle'; b.t = 0; b.spat = false; } break;
    case 'blink': { // vanish, reappear beside the player, charge
      b.vx = 0; b.vy = 0;
      if (!b.spat) { b.spat = true; b.events.push('blink_out'); }
      if (b.t > 0.7) { const side = Math.random() < 0.5 ? -1 : 1; const nx = clamp(pc.x + side * 150, ctx.arena.x + 30, ctx.arena.x + ctx.arena.w - 30 - b.w); b.x = nx; b.y = b.floorY - b.h; b.facing = sign(pc.x - (b.x + b.w / 2)) || 1; b.state = 'charge_tele'; b.t = 0.2; b.spat = false; b.events.push('blink_in'); }
      break;
    }
    case 'beam_tele': gravity(); b.vx = 0; b.facing = sign(dx) || b.facing; if (b.t > 0.85) { b.state = 'beam'; b.t = 0; b.events.push('beam'); } break;
    case 'beam': { gravity(); b.vx = 0; const y = b.floorY - 30; b.hitboxes.push({ x: ctx.arena.x, y: y - 8, w: ctx.arena.w, h: 16, dmg: 1 }); if (b.t > 0.55) { b.state = 'idle'; b.t = 0; } break; }
    case 'stun': gravity(); b.vx = approach(b.vx, 0, 800 * dt); if (b.t > 1.3) { b.state = 'idle'; b.t = 0; } break;
  }
  b.summonCd -= dt;
  const hitX = moveX(b, b.vx * dt, world);
  if (hitX) { if (b.state === 'charge') { b.state = 'stun'; b.t = 0; b.events.push('bonk'); } b.vx = 0; }
  const hitY = moveY(b, b.vy * dt, world); if (hitY !== 0) b.vy = 0;
}
function updateGulletroot(b, p, world, dt, ctx) {
  const D = b.def; const pc = pCenter(p); const bc = eCenter(b); const dx = pc.x - bc.x;
  if (b.hp <= D.phase2 && b.phase === 1) { b.phase = 2; b.state = 'submerge'; b.t = 0; b.events.push('phase2'); }
  const fast = b.phase === 2 ? 0.7 : 1;
  b.vulnerable = ['idle', 'thorns_tele', 'thorns', 'lash', 'spit', 'hurt'].includes(b.state);
  b.facing = sign(dx) || b.facing;
  const surfaceY = b.floorY - b.h; // fully surfaced y
  switch (b.state) {
    case 'intro': b.y = b.floorY - b.h * clamp(b.t / 1.5, 0, 1); if (b.t > 1.5) { b.state = 'idle'; b.t = 0; b.events.push('roar'); } break;
    case 'idle': {
      b.y = surfaceY + Math.sin(b.anim * 2) * 2;
      if (b.t > 0.9 * fast) {
        b.t = 0; b.attacks++; let pick; const r = Math.random();
        if (b.attacks % 4 === 0) pick = 'submerge'; else if (r < 0.42) pick = 'thorns_tele'; else if (r < 0.75) pick = 'lash'; else pick = 'spit';
        if (pick === b.lastAttack && pick !== 'submerge') pick = pick === 'lash' ? 'thorns_tele' : 'lash';
        b.lastAttack = pick; b.state = pick; b.events.push('tele:' + pick);
        if (pick === 'thorns_tele') { const spots = [pc.x]; const n = b.phase === 2 ? 4 : 2; for (let i = 1; i <= n; i++) spots.push(pc.x + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 52); b.spots = spots.map((x) => clamp(x, ctx.arena.x + 12, ctx.arena.x + ctx.arena.w - 12)); }
      }
      break;
    }
    case 'thorns_tele': if (b.t > 0.7 * fast) { b.state = 'thorns'; b.t = 0; b.events.push('thorns'); for (const x of b.spots) ctx.spawnProjectile({ x, y: b.floorY - 14, vx: 0, vy: 0, r: 8, grav: 0, kind: 'thorn', life: 0.6, h: 30 }); } break;
    case 'thorns': if (b.t > 0.9) { b.state = 'idle'; b.t = 0; } break;
    case 'lash': {
      if (!b.spat && b.t > 0.5 * fast) { b.spat = true; b.events.push('lash'); const dir = sign(dx) || 1; ctx.spawnProjectile({ x: bc.x + dir * 30, y: b.floorY - 8, vx: dir * 230, vy: 0, r: 7, grav: 0, kind: 'vine', life: 1.4, dir }); if (b.phase === 2) ctx.spawnProjectile({ x: bc.x - dir * 30, y: b.floorY - 8, vx: -dir * 230, vy: 0, r: 7, grav: 0, kind: 'vine', life: 1.4, dir: -dir }); }
      if (b.t > 1.2) { b.state = 'idle'; b.t = 0; b.spat = false; }
      break;
    }
    case 'spit': {
      if (!b.spat && b.t > 0.45 * fast) { b.spat = true; b.events.push('spit'); for (let i = -1; i <= 1; i++) { const a = Math.atan2(-150, dx) + i * 0.35; const sp = 190 + Math.abs(dx) * 0.3; ctx.spawnProjectile({ x: bc.x, y: b.y + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 5, grav: 320, kind: 'spore', life: 3 }); } }
      if (b.t > 1.0) { b.state = 'idle'; b.t = 0; b.spat = false; }
      break;
    }
    case 'submerge': {
      b.y = surfaceY + b.h * clamp(b.t / 0.6, 0, 1);
      if (!b.spat && b.t > 0.6) { b.spat = true; b.events.push('submerged'); if (ctx.minionCount() < 2) ctx.summon('j'); }
      if (b.t > 2.2) { b.state = 'emerge'; b.t = 0; b.spat = false; const anchors = [ctx.arena.x + ctx.arena.w * 0.25, ctx.arena.x + ctx.arena.w * 0.5, ctx.arena.x + ctx.arena.w * 0.75].filter((ax) => Math.abs(ax - bc.x) > 40); const ax = pick(anchors); b.x = ax - b.w / 2; b.events.push('emerge'); }
      break;
    }
    case 'emerge': b.y = b.floorY - b.h * clamp(b.t / 0.5, 0, 1); if (b.t > 0.5) { b.state = 'idle'; b.t = 0; } break;
  }
}
function updateBell(b, p, world, dt, ctx) {
  const D = b.def; const pc = pCenter(p); const bc = eCenter(b); const dx = pc.x - bc.x;
  if (b.hp <= D.phase2 && b.phase === 1) { b.phase = 2; b.events.push('phase2'); b.state = 'toll_tele'; b.t = 0; }
  const fast = b.phase === 2 ? 0.75 : 1; const hoverY = b.floorY - 96;
  b.vulnerable = !['intro'].includes(b.state);
  b.facing = sign(dx) || b.facing;
  const drift = (target, sp) => { b.vx = approach(b.vx, clamp(target - bc.x, -1, 1) * sp, 200 * dt); };
  switch (b.state) {
    case 'intro': b.y = lerp(b.floorY - 200, hoverY, easeOut(clamp(b.t / 1.6, 0, 1))); b.vx = 0; if (b.t > 1.8) { b.state = 'hover'; b.t = 0; b.events.push('toll'); } break;
    case 'hover': {
      drift(pc.x, 60 * fast); b.y = approach(b.y, hoverY + Math.sin(b.anim * 1.5) * 6, 120 * dt);
      if (b.t > 1.1 * fast) {
        b.t = 0; b.attacks++; const r = Math.random(); let pick;
        if (b.phase === 2 && b.summonCd <= 0 && ctx.minionCount() < 2) { pick = 'summon'; b.summonCd = 12; }
        else if (r < 0.34) pick = 'toll_tele'; else if (r < 0.68) pick = 'slam_tele'; else pick = 'rain_tele';
        if (pick === b.lastAttack) pick = pick === 'toll_tele' ? 'slam_tele' : 'toll_tele';
        b.lastAttack = pick; b.state = pick; b.events.push('tele:' + pick);
      }
      break;
    }
    case 'toll_tele': b.vx = approach(b.vx, 0, 300 * dt); if (b.t > 0.7 * fast) { b.state = 'toll'; b.t = 0; b.events.push('toll'); ctx.spawnProjectile({ x: bc.x, y: bc.y, vx: 0, vy: 0, r: 8, grav: 0, kind: 'ring', life: 0.75, maxR: b.phase === 2 ? 120 : 100 }); } break;
    case 'toll': if (b.t > 0.9) { b.state = 'hover'; b.t = 0; } break;
    case 'slam_tele': { drift(pc.x, 150); b.y = approach(b.y, hoverY - 40, 140 * dt); if (b.t > 0.55) { b.state = 'slam'; b.t = 0; b.vx = 0; b.events.push('dive'); } break; }
    case 'slam': {
      b.vy = Math.min(b.vy + 2600 * dt, 640); const ny = b.y + b.vy * dt;
      if (ny + b.h >= b.floorY) { b.y = b.floorY - b.h; b.vy = 0; b.state = 'stunned'; b.t = 0; b.events.push('slam'); ctx.spawnProjectile({ x: b.x - 4, y: b.floorY - 6, vx: -200, vy: 0, r: 6, grav: 0, kind: 'shock', life: 1.4 }); ctx.spawnProjectile({ x: b.x + b.w + 4, y: b.floorY - 6, vx: 200, vy: 0, r: 6, grav: 0, kind: 'shock', life: 1.4 }); }
      else b.y = ny;
      break;
    }
    case 'stunned': b.vx = 0; if (b.t > (b.phase === 2 ? 1.1 : 1.5)) { b.state = 'rise'; b.t = 0; } break;
    case 'rise': b.y = approach(b.y, hoverY, 160 * dt); if (Math.abs(b.y - hoverY) < 2) { b.state = 'hover'; b.t = 0; } break;
    case 'rain_tele': {
      b.vx = approach(b.vx, 0, 300 * dt);
      if (!b.spat) { b.spat = true; const n = b.phase === 2 ? 7 : 5; b.spots = []; for (let i = 0; i < n; i++) b.spots.push(ctx.arena.x + 20 + (ctx.arena.w - 40) * (i + Math.random() * 0.6) / n); b.events.push('rain_tele'); }
      if (b.t > 0.8) { b.state = 'rain'; b.t = 0; b.spat = false; b.events.push('rain'); b.spots.forEach((x, i) => ctx.spawnProjectile({ x, y: ctx.arena.y + 8, vx: 0, vy: 40, r: 5, grav: 520, kind: 'drop', life: 2.2, delay: i * 0.08 })); }
      break;
    }
    case 'rain': b.y = approach(b.y, hoverY, 100 * dt); if (b.t > 1.0) { b.state = 'hover'; b.t = 0; } break;
    case 'summon': b.vx = 0; if (!b.spat && b.t > 0.4) { b.spat = true; b.events.push('summon'); ctx.summon('f'); } if (b.t > 0.9) { b.state = 'hover'; b.t = 0; b.spat = false; } break;
  }
  b.summonCd -= dt;
  if (b.state !== 'slam') { const hitX = moveX(b, b.vx * dt, world); if (hitX) b.vx = 0; }
}
function damageBoss(b, dmg) {
  if (!b.alive || !b.vulnerable) return 'blocked';
  b.hp -= dmg; b.flash = 0.12; b.events.push('hurt');
  if (b.hp <= 0) { b.hp = 0; b.alive = false; b.deathT = 0; b.state = 'dead'; b.events.push('death'); return 'killed'; }
  return 'hit';
}

// ---- Projectiles --------------------------------------------------------------
const STATIC_KINDS = new Set(['thorn', 'ring', 'beam']);
function updateProjectile(pr, world, dt) {
  pr.t = (pr.t || 0) + dt;
  if (pr.delay > 0) { pr.delay -= dt; return true; }
  pr.life -= dt; if (pr.life <= 0) return false;
  if (pr.kind === 'ring') { pr.r = lerp(8, pr.maxR, easeOut(clamp(pr.t / 0.75, 0, 1))); return true; }
  if (STATIC_KINDS.has(pr.kind)) return true;
  pr.vy += (pr.grav || 0) * dt; pr.x += pr.vx * dt; pr.y += pr.vy * dt;
  if (pr.kind === 'shock' || pr.kind === 'vine') {
    if (world.rectSolid(pr.x - pr.r, pr.y - pr.r, pr.r * 2, pr.r * 2)) return false;
    if (!world.rectSolid(pr.x - 2, pr.y + pr.r + 1, 4, 2)) pr.y += 60 * dt;
    return true;
  }
  if (world.rectSolid(pr.x - pr.r * 0.6, pr.y - pr.r * 0.6, pr.r * 1.2, pr.r * 1.2)) return false;
  return true;
}
// Does the player overlap this projectile's hazard shape?
function projectileHits(pr, box) {
  if (pr.delay > 0) return false;
  if (pr.kind === 'ring') { const cx = box.x + box.w / 2, cy = box.y + box.h / 2; const d = Math.hypot(cx - pr.x, cy - pr.y); return Math.abs(d - pr.r) < 9 && pr.t > 0.1; }
  if (pr.kind === 'thorn') return pr.t > 0.08 && aabb(box, { x: pr.x - 7, y: pr.y - pr.h + 14, w: 14, h: pr.h });
  if (pr.kind === 'vine') return aabb(box, { x: pr.x - 12, y: pr.y - 6, w: 24, h: 12 });
  return aabb(box, { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 });
}

// ---- Pickups ------------------------------------------------------------------
const PICKUP_CHARS = new Set(['H', '1', '2', '3', '4', 'S', '*']);
function makePickup(ent) {
  return { id: ent.id, type: ent.type, x: ent.tx * TILE + TILE / 2, y: ent.ty * TILE + TILE / 2, taken: false, t: Math.random() * 10, visible: true };
}
