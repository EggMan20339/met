// ---- Player physics & state (DOM-free so it can run in node for the solver) --
const PHYS = {
  GRAV: 1500, MAX_FALL: 430, RUN: 165, GROUND_ACC: 2400, GROUND_FRIC: 2800, AIR_ACC: 1500, AIR_DEC: 900,
  JUMP_V: -420, DJUMP_V: -390, WALLJUMP_VX: 230, WALLJUMP_VY: -400, WALL_LOCK: 0.14, WALL_SLIDE: 70,
  COYOTE: 0.1, JUMP_BUFFER: 0.15, DASH_SPEED: 520, DASH_TIME: 0.14, DASH_CD: 0.35, ACTION_BUFFER: 0.18,
  ATTACK_CD: 0.28, ATTACK_TIME: 0.11, POGO_V: -380, FOCUS_TIME: 0.9, FOCUS_WARM: 0.45, SOUL_MAX: 100, SOUL_HIT: 12, SOUL_HEAL: 35, SPELL_COST: 30,
  INVULN: 1.1, HURT_TIME: 0.22, APEX_THRESH: 60, BOUNCE_V: -640, TAP_TIME: 0.2,
};
const PW = 10, PH = 15; // hitbox size

function makePlayer(x, y) {
  return {
    x, y, w: PW, h: PH, vx: 0, vy: 0, facing: 1,
    onGround: false, wasOnGround: false, wallDir: 0, wallSliding: false, dashing: 0, dashDir: 1, dashCd: 0, canDash: true,
    canDoubleJump: true, coyote: 0, jumpBuffer: 0, lockout: 0, jumpHeld: false, jumpedFromGround: false,
    attackTimer: 0, attackCd: 0, attackDir: 'right', attackHit: null, recoil: 0, attackBuffer: 0, dashBuffer: 0,
    hp: 5, maxHp: 5, soul: 0, focusTimer: 0, focusing: false, invuln: 0, hurtTimer: 0, dead: false, deathTimer: 0,
    hazardTimer: 0, lastSafe: { x, y }, sitting: false, benchTimer: 0,
    abilities: { dash: false, walljump: false, doublejump: false, spell: false }, damage: 1, warm: false, focusHeld: 0, castTimer: 0, flareCd: 0,
    anim: { t: 0, squash: 1, stretch: 1, run: 0, land: 0, blink: 0, tail: [] },
    events: [], // transient events for fx/sound: strings
  };
}
const pCenter = (p) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });

// Axis-separated tile collision. Returns collision flags.
function moveX(p, dx, world) {
  if (dx === 0) return false;
  const nx = p.x + dx;
  if (!world.rectSolid(nx, p.y, p.w, p.h)) { p.x = nx; return false; }
  // step toward the wall pixel by pixel (max 9px/tick so cheap)
  const s = sign(dx); let moved = 0;
  while (Math.abs(moved) < Math.abs(dx)) {
    const step = Math.min(1, Math.abs(dx) - Math.abs(moved)) * s;
    if (world.rectSolid(p.x + step, p.y, p.w, p.h)) break;
    p.x += step; moved += step;
  }
  return true;
}
function groundCheck(p, world, inp) {
  // solid or one-way directly under the feet
  const fy = p.y + p.h;
  if (world.rectSolid(p.x, fy, p.w, 1)) return true;
  // one-way: feet must be at platform top within 1px and not dropping
  const ty = Math.floor(fy / TILE);
  if (Math.abs(fy - ty * TILE) < 0.01 || fy % TILE === 0) {
    const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.001) / TILE);
    for (let tx = x0; tx <= x1; tx++) if (world.isOneWay(tx, ty) && !(p.dropThrough > 0)) return true;
  }
  return false;
}
function moveY(p, dy, world) {
  if (dy === 0) return 0;
  const s = sign(dy); let moved = 0; let hit = 0;
  while (Math.abs(moved) < Math.abs(dy)) {
    const step = Math.min(1, Math.abs(dy) - Math.abs(moved)) * s;
    const ny = p.y + step;
    if (world.rectSolid(p.x, ny, p.w, p.h)) { hit = s; break; }
    if (s > 0 && !(p.dropThrough > 0)) {
      // one-way platforms: crossing a tile top boundary while falling
      const prevBottom = p.y + p.h, newBottom = ny + p.h;
      const rowPrev = Math.floor((prevBottom - 0.001) / TILE), rowNew = Math.floor((newBottom - 0.001) / TILE);
      if (rowNew > rowPrev) {
        const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.001) / TILE); let plat = false;
        for (let tx = x0; tx <= x1; tx++) if (world.isOneWay(tx, rowNew)) plat = true;
        if (plat) { p.y = rowNew * TILE - p.h; hit = 1; break; }
      }
    }
    p.y = ny; moved += step;
  }
  if (hit > 0) p.y = Math.round(p.y); // land on integer pixel
  return hit;
}

function updatePlayer(p, inp, world, dt) {
  const ev = p.events; ev.length = 0;
  const A = p.abilities;
  const dec = (k) => { if (p[k] > 0) p[k] = Math.max(0, p[k] - dt); };
  ['dashCd', 'coyote', 'jumpBuffer', 'lockout', 'attackTimer', 'attackCd', 'invuln', 'hurtTimer', 'recoil', 'dropThrough', 'attackBuffer', 'dashBuffer', 'castTimer', 'flareCd'].forEach(dec);
  // Buffer attack / dash presses so a press during cooldown, hurt or a dash still fires as soon as it can
  if (inp.attackPressed) p.attackBuffer = PHYS.ACTION_BUFFER;
  if (inp.dashPressed) p.dashBuffer = PHYS.ACTION_BUFFER;
  p.anim.t += dt;
  if (p.dead) { p.deathTimer += dt; return; }
  if (p.hazardTimer > 0) { p.hazardTimer -= dt; if (p.hazardTimer <= 0) { p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.vx = 0; p.vy = 0; p.invuln = 0.8; ev.push('respawn'); } return; }
  if (p.sitting) {
    p.benchTimer += dt;
    if (p.benchTimer > 0.4 && (inp.left || inp.right || inp.jumpPressed || inp.dashPressed || inp.attackPressed)) { p.sitting = false; ev.push('stand'); }
    p.vx = 0; return;
  }
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  p.wasOnGround = p.onGround;
  p.onGround = p.vy >= 0 && groundCheck(p, world, inp);
  if (p.onGround) { p.coyote = PHYS.COYOTE; p.canDoubleJump = true; p.canDash = true; p.jumpedFromGround = false; }
  // wall contact
  p.wallDir = 0;
  if (!p.onGround) {
    const cl = (x) => world.rectHas(x, p.y + 2, 1, p.h - 4, (tx, ty) => world.isClingable(tx, ty));
    if (cl(p.x - 1)) p.wallDir = -1; else if (cl(p.x + p.w)) p.wallDir = 1;
  }
  const wasSliding = p.wallSliding;
  p.wallSliding = !p.onGround && p.wallDir !== 0 && p.vy > 0 && A.walljump && !p.dashing;
  if (p.wallSliding) { p.canDoubleJump = true; p.canDash = true; if (!wasSliding) ev.push('wallgrab'); }
  if (inp.jumpPressed) p.jumpBuffer = PHYS.JUMP_BUFFER;
  if (inp.jump === false) p.jumpHeld = false;

  // Rekindle key: a tap throws a Cinder (spell), a hold rekindles a petal (faster near warmth)
  if (inp.focus) p.focusHeld += dt; 
  const tapped = !inp.focus && p.focusHeld > 0 && p.focusHeld < PHYS.TAP_TIME;
  if (!inp.focus) p.focusHeld = 0;
  if (tapped && A.spell && p.soul >= PHYS.SPELL_COST && !p.dashing && p.hurtTimer <= 0 && p.castTimer <= 0) { p.soul -= PHYS.SPELL_COST; p.castTimer = 0.35; p.attackTimer = 0; ev.push('cast'); }
  const canFocus = inp.focus && p.focusHeld >= PHYS.TAP_TIME && p.onGround && dir === 0 && p.soul >= PHYS.SOUL_HEAL && p.hp < p.maxHp && p.attackTimer <= 0 && !p.dashing && p.hurtTimer <= 0;
  if (canFocus) {
    if (!p.focusing) ev.push('focusstart');
    p.focusing = true; p.focusTimer += dt * (p.warm ? PHYS.FOCUS_TIME / PHYS.FOCUS_WARM : 1);
    if (p.focusTimer >= PHYS.FOCUS_TIME) { p.hp++; p.soul -= PHYS.SOUL_HEAL; p.focusTimer = 0; ev.push('heal'); if (p.hp >= p.maxHp || p.soul < PHYS.SOUL_HEAL) p.focusing = false; }
  } else { if (p.focusing) ev.push('focusend'); p.focusing = false; p.focusTimer = 0; }

  // Dash
  if (p.dashBuffer > 0 && A.dash && p.canDash && p.dashCd <= 0 && !p.dashing && p.hurtTimer <= 0) {
    p.dashBuffer = 0; p.dashing = PHYS.DASH_TIME; p.dashDir = dir || p.facing; p.facing = p.dashDir; p.dashCd = PHYS.DASH_CD;
    if (!p.onGround) p.canDash = false;
    p.vy = 0; p.focusing = false; p.focusTimer = 0; p.attackTimer = 0; ev.push('dash');
  }
  if (p.dashing > 0) {
    p.dashing -= dt; p.vx = p.dashDir * PHYS.DASH_SPEED; p.vy = 0;
    if (p.dashing <= 0) { p.dashing = 0; p.vx = p.dashDir * PHYS.RUN * 0.7; }
  } else if (p.focusing) {
    p.vx = approach(p.vx, 0, PHYS.GROUND_FRIC * dt);
    p.vy = Math.min(p.vy + PHYS.GRAV * dt, PHYS.MAX_FALL);
  } else {
    // horizontal
    if (p.hurtTimer > 0) { p.vx = approach(p.vx, 0, (p.onGround ? 900 : 300) * dt); }
    else if (p.lockout > 0) { p.vx = approach(p.vx, sign(p.vx) * PHYS.RUN, PHYS.AIR_DEC * dt); }
    else if (p.recoil > 0) { p.vx = approach(p.vx, 0, PHYS.GROUND_FRIC * dt); }
    else if (dir !== 0) {
      const acc = p.onGround ? PHYS.GROUND_ACC : PHYS.AIR_ACC;
      if (p.onGround && sign(p.vx) === -dir && Math.abs(p.vx) > 60) ev.push('turn');
      p.vx = approach(p.vx, dir * PHYS.RUN, acc * dt); p.facing = dir;
    } else p.vx = approach(p.vx, 0, (p.onGround ? PHYS.GROUND_FRIC : PHYS.AIR_DEC) * dt);
    // gravity with apex hang
    let g = PHYS.GRAV;
    if (!p.onGround && Math.abs(p.vy) < PHYS.APEX_THRESH && inp.jump && p.jumpHeld) g *= 0.45;
    p.vy = Math.min(p.vy + g * dt, PHYS.MAX_FALL);
    if (p.wallSliding) p.vy = Math.min(p.vy, PHYS.WALL_SLIDE);
    // jumps
    if (p.jumpBuffer > 0 && p.hurtTimer <= 0) {
      if (inp.down && p.onGround && world.rectHas(p.x, p.y + p.h, p.w, 1, (tx, ty) => world.isOneWay(tx, ty)) && !world.rectSolid(p.x, p.y + p.h, p.w, 1)) {
        p.dropThrough = 0.2; p.onGround = false; p.coyote = 0; p.jumpBuffer = 0; p.y += 1;
      } else if (p.onGround || p.coyote > 0) {
        p.vy = PHYS.JUMP_V; p.jumpBuffer = 0; p.coyote = 0; p.onGround = false; p.jumpHeld = true; p.jumpedFromGround = true; ev.push('jump');
      } else if (p.wallDir !== 0 && A.walljump) {
        p.vy = PHYS.WALLJUMP_VY; p.vx = -p.wallDir * PHYS.WALLJUMP_VX; p.facing = -p.wallDir; p.lockout = PHYS.WALL_LOCK;
        p.jumpBuffer = 0; p.jumpHeld = true; p.canDoubleJump = true; p.wallSliding = false; ev.push('walljump');
      } else if (A.doublejump && p.canDoubleJump) {
        p.vy = PHYS.DJUMP_V; p.canDoubleJump = false; p.jumpBuffer = 0; p.jumpHeld = true; ev.push('djump');
      }
    }
    if (inp.jumpReleased && p.vy < 0 && p.jumpHeld) { p.vy *= 0.45; p.jumpHeld = false; }
  }
  // Attack
  if (p.attackBuffer > 0 && p.attackCd <= 0 && !p.dashing && p.hurtTimer <= 0 && !p.focusing) {
    p.attackBuffer = 0; p.attackCd = PHYS.ATTACK_CD; p.attackTimer = PHYS.ATTACK_TIME; p.attackHit = new Set();
    p.attackDir = inp.up ? 'up' : (inp.down && !p.onGround ? 'down' : (p.facing > 0 ? 'right' : 'left'));
    ev.push('slash');
  }
  // Move
  const prevVy = p.vy;
  const hitX = moveX(p, p.vx * dt, world);
  if (hitX) {
    if (p.dashing > 0) {
      // dash into a breakable wall?
      const tx = Math.floor((p.dashDir > 0 ? p.x + p.w + 1 : p.x - 1) / TILE);
      const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.001) / TILE); let broke = false;
      for (let ty = y0; ty <= y1; ty++) if (world.tile(tx, ty) === 'D') { const list = world.breakWall(tx, ty); ev.push({ type: 'break', tiles: list }); broke = true; }
      if (!broke) { p.dashing = 0; p.vx = 0; ev.push('bonk'); }
    } else p.vx = 0;
  }
  const hitY = moveY(p, p.vy * dt, world);
  if (hitY > 0) {
    if (world.rectHas(p.x + 2, p.y + p.h, p.w - 4, 2, (tx, ty) => world.isBouncer(tx, ty))) { p.vy = PHYS.BOUNCE_V; p.onGround = false; p.coyote = 0; p.canDoubleJump = true; p.canDash = true; p.jumpHeld = false; ev.push('bounce'); }
    else { if (!p.onGround) { p.onGround = true; ev.push({ type: 'land', speed: prevVy }); } p.vy = 0; }
  } else if (hitY < 0) { p.vy = 0; p.jumpHeld = false; }
  // Hazards
  if (p.invuln <= 0 && p.hazardTimer <= 0) {
    const hz = world.rectHas(p.x + 2, p.y + 2, p.w - 4, p.h - 3, (tx, ty) => world.isHazard(tx, ty));
    if (hz) { p.hp -= 1; ev.push('hazard'); if (p.hp <= 0) { p.dead = true; p.deathTimer = 0; ev.push('die'); } else { p.hazardTimer = 0.55; p.invuln = 1.3; } }
  }
  // Remember last safe standing spot (solid ground, no hazards nearby)
  if (p.onGround && !p.dashing && p.hurtTimer <= 0) {
    const nearHazard = world.rectHas(p.x - 20, p.y - 8, p.w + 40, p.h + 24, (tx, ty) => world.isHazard(tx, ty));
    const groundIsOneWay = world.rectHas(p.x, p.y + p.h, p.w, 1, (tx, ty) => world.isOneWay(tx, ty)) && !world.rectSolid(p.x, p.y + p.h, p.w, 1);
    if (!nearHazard && !groundIsOneWay) { p.lastSafe.x = p.x; p.lastSafe.y = p.y; }
  }
  // Animation helpers
  const an = p.anim;
  if (p.onGround && !p.wasOnGround) { an.land = 1; }
  an.land = Math.max(0, an.land - dt * 6);
  if (p.onGround && Math.abs(p.vx) > 20) an.run += dt * Math.abs(p.vx) / 14; else an.run = 0;
}

function attackHitbox(p) {
  const c = pCenter(p);
  switch (p.attackDir) {
    case 'up': return { x: c.x - 12, y: p.y - 22, w: 24, h: 24 };
    case 'down': return { x: c.x - 12, y: p.y + p.h - 4, w: 24, h: 24 };
    case 'left': return { x: p.x - 24, y: p.y - 5, w: 30, h: p.h + 10 };
    default: return { x: p.x + p.w - 6, y: p.y - 5, w: 30, h: p.h + 10 };
  }
}
function hurtPlayer(p, dmg, srcX, srcY) {
  if (p.invuln > 0 || p.dead || p.dashing > 0 || p.hazardTimer > 0) return false;
  if (p.soul >= PHYS.SOUL_MAX && p.flareCd <= 0) { // a full lantern flares instead of losing a petal
    p.soul = 0; p.invuln = PHYS.INVULN; p.flareCd = 2; p.focusing = false; p.focusTimer = 0; p.events.push('flare'); return true;
  }
  p.hp -= dmg; p.invuln = PHYS.INVULN; p.hurtTimer = PHYS.HURT_TIME; p.focusing = false; p.focusTimer = 0; p.sitting = false;
  const c = pCenter(p); const dx = c.x - srcX; p.vx = (dx === 0 ? -p.facing : sign(dx)) * 190; p.vy = -170;
  if (p.hp <= 0) { p.hp = 0; p.dead = true; p.deathTimer = 0; p.events.push('die'); } else p.events.push('hurt');
  return true;
}
function pogo(p) { p.vy = PHYS.POGO_V; p.canDoubleJump = true; p.canDash = true; p.jumpHeld = true; p.jumpedFromGround = false; p.attackTimer = 0; p.attackCd = Math.min(p.attackCd, 0.12); }
