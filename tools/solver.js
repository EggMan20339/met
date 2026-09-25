// Reachability solver: searches over "stable" player states (grounded / wall-sliding)
// using macro-action input scripts run through the REAL player physics.
// Usage: node tools/solver.js [--abilities dash,walljump,doublejump] [--dump out.txt] [--start x,y]
const { loadGameContext } = require('./load');
const G = loadGameContext();
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const abilities = (opt('--abilities', '') || '').split(',').filter(Boolean);
const world = new G.World(G.MAP);
const TILE = G.TILE, PHYS = G.PHYS, DT = 1 / 60;
const startEnt = G.world_start = world.findEntity('P');
const startArg = opt('--start', null);
const startX = startArg ? +startArg.split(',')[0] * TILE + 3 : startEnt.tx * TILE + 3;
const startY = startArg ? +startArg.split(',')[1] * TILE + TILE - G.PH : startEnt.ty * TILE + TILE - G.PH;

function freshPlayer(x, y) { const p = G.makePlayer(x, y); p.hp = 999; p.maxHp = 999; for (const a of abilities) p.abilities[a] = true; return p; }
function clone(p) { const q = Object.assign({}, p); q.abilities = p.abilities; q.lastSafe = { x: p.lastSafe.x, y: p.lastSafe.y }; q.anim = { t: 0, squash: 1, stretch: 1, run: 0, land: 0, blink: 0, tail: [] }; q.events = []; q.attackHit = null; return q; }
const NONE = { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, jumpReleased: false, attack: false, attackPressed: false, dash: false, dashPressed: false, focus: false };
function inp(o) { return Object.assign({}, NONE, o); }

// visited coverage at 4px granularity of the player's center
const CW = Math.ceil(world.w * TILE / 4), CH = Math.ceil(world.h * TILE / 4);
const cover = new Uint8Array(CW * CH);
function mark(p) { const cx = Math.floor((p.x + p.w / 2) / 4), cy = Math.floor((p.y + p.h / 2) / 4); if (cx >= 0 && cy >= 0 && cx < CW && cy < CH) cover[cy * CW + cx] = 1; }

// step one frame with a given input; handle spike-pogo like the game does
function step(p, i) {
  G.updatePlayer(p, i, world, DT);
  if (p.attackTimer > 0 && p.attackDir === 'down') {
    const hb = G.attackHitbox(p);
    if (world.rectHas(hb.x + 6, hb.y, hb.w - 12, hb.h - 8, (tx, ty) => world.isSpike(tx, ty))) { G.pogo(p); }
  }
  mark(p);
}
function stable(p) { return (p.onGround && Math.abs(p.vx) < 1) || p.wallSliding; }
function key(p) {
  const gx = Math.floor(p.x / 4), gy = Math.floor(p.y / 2);
  return `${gx},${gy},${p.onGround ? 1 : 0},${p.wallSliding ? p.wallDir : 0},${p.canDoubleJump ? 1 : 0},${p.canDash ? 1 : 0}`;
}
// Macro-action scripts: function(frame) -> input or null when the script is done (then wait until stable)
function scriptRun(p, script, maxFrames = 150) {
  const q = clone(p); let f = 0; let lastJump = false; let lastPressedHazard = false;
  for (; f < maxFrames; f++) {
    let i = script(f, q);
    if (i === null) { i = NONE; }
    i = Object.assign({}, i); i.jumpReleased = lastJump && !i.jump; lastJump = i.jump;
    step(q, i);
    if (q.hazardTimer > 0) return null; // took hazard damage → discard
    const done = script(f + 1, q) === null;
    if (done && stable(q)) return q;
    if (q.wallSliding && f > 2) return q; // reached a wall: new node
  }
  return stable(q) ? q : null;
}
function makeScripts(p) {
  const S = [];
  const add = (name, fn) => S.push({ name, fn });
  for (const d of [-1, 1]) {
    const dirI = d < 0 ? { left: true } : { right: true };
    for (const n of [3, 6, 12, 24, 48]) add(`walk${d}x${n}`, (f) => (f < n ? inp(dirI) : null));
    for (const hold of [2, 6, 18]) for (const dn of [4, 10, 20, 60]) add(`jump${d}h${hold}d${dn}`, (f) => (f === 0 ? inp({ ...dirI, jump: true, jumpPressed: true }) : f < hold ? inp({ ...dirI, jump: true }) : f < dn ? inp(dirI) : f < 60 ? inp({}) : null));
    // jump straight up, then drift
    for (const k of [8, 16]) add(`jumpup${d}k${k}`, (f) => (f === 0 ? inp({ jump: true, jumpPressed: true }) : f < 18 ? inp({ jump: true, ...(f >= k ? dirI : {}) }) : f < 60 ? inp(dirI) : null));
    // jump then reverse direction (for landing on small ledges)
    for (const k of [10, 20]) add(`jumprev${d}k${k}`, (f) => (f === 0 ? inp({ ...dirI, jump: true, jumpPressed: true }) : f < 12 ? inp({ ...dirI, jump: true }) : f < k ? inp(dirI) : f < 50 ? inp(d < 0 ? { right: true } : { left: true }) : null));
    if (p.abilities.dash) {
      add(`dash${d}`, (f) => (f === 0 ? inp({ ...dirI, dash: true, dashPressed: true }) : f < 16 ? inp(dirI) : null));
      for (const k of [2, 8, 14, 22]) add(`jumpdash${d}k${k}`, (f) => (f === 0 ? inp({ ...dirI, jump: true, jumpPressed: true }) : f < 12 ? inp({ ...dirI, jump: true, ...(f === k ? { dash: true, dashPressed: true } : {}) }) : f < 60 ? inp({ ...dirI, ...(f === k ? { dash: true, dashPressed: true } : {}) }) : null));
      for (const k of [6, 14]) add(`walkdash${d}k${k}`, (f) => (f < k ? inp(dirI) : f === k ? inp({ ...dirI, dash: true, dashPressed: true }) : f < 40 ? inp(dirI) : null));
    }
    if (p.abilities.doublejump) {
      for (const k of [10, 18, 26, 34]) add(`djump${d}k${k}`, (f) => (f === 0 || f === k ? inp({ ...dirI, jump: true, jumpPressed: true }) : f < k + 14 ? inp({ ...dirI, jump: true }) : f < 70 ? inp(dirI) : null));
      for (const k of [16, 26]) add(`djumpup${d}k${k}`, (f) => (f === 0 || f === k ? inp({ jump: true, jumpPressed: true, ...(f >= k ? dirI : {}) }) : f < k + 14 ? inp({ jump: true, ...(f >= k ? dirI : {}) }) : f < 70 ? inp(dirI) : null));
      if (p.abilities.dash) for (const k of [18, 30]) add(`djumpdash${d}k${k}`, (f) => (f === 0 || f === 16 ? inp({ ...dirI, jump: true, jumpPressed: true }) : f === k ? inp({ ...dirI, dash: true, dashPressed: true }) : f < 26 ? inp({ ...dirI, jump: true }) : f < 70 ? inp(dirI) : null));
    }
    // pogo bouncing over spikes: reactive (attack when a spike is just below while falling), like a skilled player
    for (const hop of [0, 1]) add(`pogo${d}h${hop}`, (f, q) => { if (f >= 160) return null; const feet = q.y + q.h; const near = q.vy > 0 && world.rectHas(q.x + 2, feet, q.w - 4, 36, (tx, ty) => world.isSpike(tx, ty)); const press = near && q.attackCd <= 0; return inp({ ...dirI, jump: hop && f < 4, jumpPressed: hop && f === 0, down: f >= 4, attack: press, attackPressed: press }); });
  }
  add('pogo0', (f, q) => { if (f >= 160) return null; const feet = q.y + q.h; const near = q.vy > 0 && world.rectHas(q.x + 2, feet, q.w - 4, 36, (tx, ty) => world.isSpike(tx, ty)); const press = near && q.attackCd <= 0; return inp({ jump: f < 4, jumpPressed: f === 0, down: f >= 4, attack: press, attackPressed: press }); });
  add('drop', (f) => (f === 0 ? inp({ down: true, jump: true, jumpPressed: true }) : f < 4 ? inp({ down: true }) : null));
  if (p.wallSliding && p.abilities.walljump) {
    const away = p.wallDir < 0 ? { right: true } : { left: true }, toward = p.wallDir < 0 ? { left: true } : { right: true };
    for (const slide of [0, 6, 14]) {
      add(`wj_climb_s${slide}`, (f) => (f < slide ? inp(toward) : f === slide ? inp({ ...away, jump: true, jumpPressed: true }) : f < slide + 8 ? inp({ ...away, jump: true }) : f < slide + 40 ? inp(toward) : null));
      add(`wj_away_s${slide}`, (f) => (f < slide ? inp(toward) : f === slide ? inp({ ...away, jump: true, jumpPressed: true }) : f < slide + 14 ? inp({ ...away, jump: true }) : f < slide + 60 ? inp(away) : null));
      add(`wj_awayshort_s${slide}`, (f) => (f < slide ? inp(toward) : f === slide ? inp({ ...away, jump: true, jumpPressed: true }) : f < slide + 4 ? inp({ ...away, jump: true }) : f < slide + 30 ? inp(away) : null));
      if (p.abilities.doublejump) add(`wj_dj_s${slide}`, (f) => (f < slide ? inp(toward) : f === slide || f === slide + 14 ? inp({ ...away, jump: true, jumpPressed: true }) : f < slide + 26 ? inp({ ...away, jump: true }) : f < slide + 60 ? inp(away) : null));
      if (p.abilities.dash) add(`wj_dash_s${slide}`, (f) => (f < slide ? inp(toward) : f === slide ? inp({ ...away, jump: true, jumpPressed: true }) : f === slide + 10 ? inp({ ...away, dash: true, dashPressed: true }) : f < slide + 60 ? inp(away) : null));
    }
    add('slide_release', (f) => (f < 30 ? inp({}) : null));
  }
  return S;
}

// ---- BFS
const start = freshPlayer(startX, startY);
// settle the start (let it land)
for (let i = 0; i < 30; i++) step(start, NONE);
const seen = new Set([key(start)]); const queue = [start]; let expanded = 0; const t0 = Date.now();
const parents = new Map();
while (queue.length) {
  const p = queue.shift(); expanded++;
  const scripts = makeScripts(p);
  for (const s of scripts) {
    const q = scriptRun(p, s.fn);
    if (!q) continue; const k = key(q);
    if (seen.has(k)) continue; seen.add(k); parents.set(k, { from: key(p), via: s.name }); queue.push(q);
  }
  if (expanded % 2000 === 0) console.error(`expanded ${expanded}, queue ${queue.length}, seen ${seen.size}, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
console.log(`Abilities: [${abilities.join(', ') || 'none'}]  nodes: ${seen.size}  time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
// coverage checks for pickups & interactables
function coveredNear(px, py, rx, ry) { for (let y = Math.floor((py - ry) / 4); y <= Math.floor((py + ry) / 4); y++) for (let x = Math.floor((px - rx) / 4); x <= Math.floor((px + rx) / 4); x++) if (x >= 0 && y >= 0 && x < CW && y < CH && cover[y * CW + x]) return true; return false; }
const report = [];
for (const e of world.entities) {
  if (!'H1234S*BLNWQKXYZk'.includes(e.type)) continue;
  const cx = e.tx * TILE + 8, cy = e.ty * TILE + 8;
  const ok = coveredNear(cx, cy, 14, 16);
  report.push(`${ok ? 'REACH ' : 'MISS  '} ${e.type} ${e.room} @${e.tx},${e.ty}`);
}
console.log(report.join('\n'));
const dump = opt('--dump', null);
if (dump) {
  const lines = [];
  for (let y = 0; y < world.h; y++) { let s = ''; for (let x = 0; x < world.w; x++) { const c = world.tile(x, y); let hit = false; for (let yy = 0; yy < 4 && !hit; yy++) for (let xx = 0; xx < 4 && !hit; xx++) if (cover[(y * 4 + yy) * CW + x * 4 + xx]) hit = true; s += hit && c === '.' ? '·' : c; } lines.push(s); }
  require('fs').writeFileSync(dump, lines.join('\n') + '\n');
}
