// Node-only regression test for input buffering in the player simulation (no browser needed).
const { loadGameContext } = require('../tools/load');
const G = loadGameContext(); const world = new G.World(G.MAP); const DT = 1 / 60;
const start = world.findEntity('P');
const NONE = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, jumpReleased: false, attack: false, attackPressed: false, dash: false, dashPressed: false, focus: false };
const inp = (o) => Object.assign({}, NONE, o);
function fresh() { const p = G.makePlayer(start.tx * 16 + 3, start.ty * 16 + 16 - G.PH); p.abilities.dash = true; p.abilities.spell = true; for (let i = 0; i < 30; i++) G.updatePlayer(p, NONE, world, DT); return p; }
let fails = 0; const check = (name, ok) => { console.log((ok ? 'ok   ' : 'FAIL ') + name); if (!ok) fails++; };

// 1. an attack pressed during the cooldown still fires as soon as the cooldown ends
{ const p = fresh(); G.updatePlayer(p, inp({ attackPressed: true, attack: true }), world, DT); check('first attack fires', p.attackTimer > 0);
  for (let i = 0; i < 8; i++) G.updatePlayer(p, NONE, world, DT); // 0.15s into a 0.28s cooldown
  G.updatePlayer(p, inp({ attackPressed: true, attack: true }), world, DT); const fired = p.attackTimer > 0; let later = false;
  for (let i = 0; i < 12; i++) { G.updatePlayer(p, NONE, world, DT); if (p.attackTimer > 0 && p.attackCd > 0.2) later = true; }
  check('attack pressed mid-cooldown is buffered and fires afterwards', !fired && later); }
// 2. a dash pressed during the dash cooldown fires when the cooldown ends
{ const p = fresh(); G.updatePlayer(p, inp({ dashPressed: true, dash: true, right: true }), world, DT); check('first dash fires', p.dashing > 0);
  for (let i = 0; i < 14; i++) G.updatePlayer(p, inp({ right: true }), world, DT); // dash over, cooldown (0.35s) still running
  G.updatePlayer(p, inp({ dashPressed: true, dash: true, right: true }), world, DT); const early = p.dashing > 0; let later = false;
  for (let i = 0; i < 10; i++) { G.updatePlayer(p, inp({ right: true }), world, DT); if (p.dashing > 0) later = true; }
  check('dash pressed mid-cooldown is buffered and fires afterwards', !early && later); }
// 3. a jump pressed shortly before landing jumps on landing
{ const p = fresh(); G.updatePlayer(p, inp({ jumpPressed: true, jump: true }), world, DT); for (let i = 0; i < 20; i++) G.updatePlayer(p, inp({ jump: true }), world, DT);
  let landed = false, jumpedAgain = false; let pressed = false;
  for (let i = 0; i < 90; i++) { const falling = p.vy > 0; const nearGround = falling && world.rectSolid(p.x, p.y + p.h + 6, p.w, 1); const press = nearGround && !pressed; if (press) pressed = true; G.updatePlayer(p, inp({ jumpPressed: press, jump: press }), world, DT); if (p.onGround) landed = true; if (landed && p.vy < -300) { jumpedAgain = true; break; } }
  check('jump buffered before landing fires on landing', pressed && jumpedAgain); }
// 4. tap vs hold on the rekindle key: a tap casts a cinder, a hold does not
{ const p = fresh(); p.soul = 100; G.updatePlayer(p, inp({ focus: true }), world, DT); G.updatePlayer(p, inp({ focus: true }), world, DT); G.updatePlayer(p, NONE, world, DT);
  check('short tap casts a cinder', p.events.includes('cast') && p.soul === 70);
  const q = fresh(); q.soul = 100; q.hp = 3; for (let i = 0; i < 20; i++) G.updatePlayer(q, inp({ focus: true }), world, DT); const castDuringHold = q.events.includes('cast'); for (let i = 0; i < 60; i++) G.updatePlayer(q, inp({ focus: true }), world, DT);
  check('holding rekindles a petal instead of casting', !castDuringHold && q.hp === 4 && q.soul === 65); }
// 5. a full lantern absorbs a hit without losing a petal
{ const p = fresh(); p.soul = 100; const hp = p.hp; G.hurtPlayer(p, 1, p.x + 30, p.y); check('full lantern flares instead of losing a petal', p.hp === hp && p.soul === 0 && p.events.includes('flare')); }
console.log(fails ? `INPUT TEST FAILED (${fails})` : 'INPUT TEST OK'); process.exit(fails ? 1 : 0);
