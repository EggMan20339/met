// Scripted fights against all three bosses plus death/respawn (player made invulnerable for determinism).
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const root = path.join(__dirname, '..'); const outDir = process.env.SHOT_DIR || path.join(root, 'test', 'shots');
fs.mkdirSync(outDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const st = () => page.evaluate(() => { const g = window.game, p = g.player, b = g.boss; return { state: g.state, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, gates: g.world.closedGates.size, arenas: g.arenas.filter((a) => a.done).map((a) => a.id), boss: b ? { kind: b.kind, hp: b.hp, state: b.state, phase: b.phase, alive: b.alive } : null, enemies: g.enemies.filter((e) => e.alive).length, area: g.area, benchX: Math.round(g.benchPos.x) }; });
  // --- death & respawn
  await page.evaluate(() => { const g = window.game; g.player.x += 200; g.player.hp = 1; g.player.invuln = 0; g.player.soul = 0; hurtPlayer(g.player, 5, g.player.x + 5, g.player.y); });
  await page.waitForTimeout(400); const dead = await st(); await page.waitForTimeout(2500); const respawned = await st();
  // --- dying inside an arena must fully end the fight: no boss, open gates, normal music after respawn
  await page.evaluate(() => { const g = window.game, p = g.player; p.x = 226 * 16; p.y = 89 * 16 + 16 - p.h; p.vx = 0; p.vy = 0; p.invuln = 0; g.cam.x = p.x - 200; g.cam.y = p.y - 120; });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(1500);
  const inArena = await st();
  await page.evaluate(() => { const g = window.game, p = g.player; p.hp = 1; p.soul = 0; p.invuln = 0; hurtPlayer(p, 5, p.x + 5, p.y); });
  await page.waitForTimeout(3200); const afterArenaDeath = await page.evaluate(() => { const g = window.game; return { state: g.state, boss: !!g.boss, gates: g.world.closedGates.size, bossMusic: g.audio.boss, x: Math.round(g.player.x), benchX: Math.round(g.benchPos.x) }; });
  const results = {};
  const fight = async (name, tx, ty, dir, shotName) => {
    // clear any lingering fight and teleport in the same evaluate, so no game frame can re-trigger the old arena in between
    await page.evaluate(([tx, ty]) => { const g = window.game; const p = g.player; if (g.boss) { g.boss = null; g.bossArena = null; g.world.openGates(); g.enemies = g.enemies.filter((e) => !e.summoned); g.projectiles = []; } p.abilities.dash = p.abilities.walljump = p.abilities.doublejump = p.abilities.spell = true; p.maxHp = 9; p.hp = 9; p.x = tx * 16; p.y = ty * 16 + 16 - p.h; p.vx = 0; p.vy = 0; p.invuln = 1e9; g.cam.x = p.x - 200; g.cam.y = p.y - 120; }, [tx, ty]);
    await page.waitForTimeout(300);
    await page.keyboard.down(dir); await page.waitForTimeout(1500); await page.keyboard.up(dir); await page.waitForTimeout(2200);
    const started = await st(); await page.screenshot({ path: path.join(outDir, shotName + '-intro.png') });
    let shots = 0; const t0 = Date.now(); let last = null; let maxPhase = 1;
    while (Date.now() - t0 < 240000) {
      const s = await page.evaluate(() => { const g = window.game, p = g.player, b = g.boss; p.invuln = 1e9; if (!b) return { done: true }; const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 }; return { dx: bc.x - pc.x, dy: bc.y - pc.y, hp: b.hp, state: b.state, alive: b.alive, phase: b.phase, vulnerable: b.vulnerable, kind: b.kind }; });
      if (s.done) { last = s; break; }
      maxPhase = Math.max(maxPhase, s.phase);
      const d = s.dx > 0 ? 'ArrowRight' : 'ArrowLeft';
      if (Math.abs(s.dx) > 40) { await page.keyboard.down(d); await page.waitForTimeout(120); await page.keyboard.up(d); }
      else { await page.keyboard.down(d); if (s.dy < -22) { await page.keyboard.down('Space'); await page.waitForTimeout(160); await page.keyboard.down('ArrowUp'); await page.keyboard.press('KeyX'); await page.keyboard.up('ArrowUp'); await page.keyboard.up('Space'); } else { await page.keyboard.press('KeyX'); } await page.waitForTimeout(80); await page.keyboard.up(d); await page.waitForTimeout(240); }
      if (s.phase >= 2 && shots === 0) { await page.screenshot({ path: path.join(outDir, shotName + '-phase2.png') }); shots++; }
    }
    await page.waitForTimeout(3500); const after = await st();
    results[name] = { started, after, maxPhase, ok: !!(started.boss && started.boss.kind === name && after.arenas.includes(name)) };
  };
  await fight('gulletroot', 226, 89, 'ArrowRight', '07-gulletroot');
  await fight('bell', 8, 110, 'ArrowLeft', '08-bell');
  await fight('lightless', 284, 15, 'ArrowLeft', '09-lightless');
  // collect the Great Lantern's heart → ending
  for (let i = 0; i < 60; i++) { const s = await page.evaluate(() => { const g = window.game, p = g.player; const h = g.pickups.find((k) => k.type === '*'); if (!h || h.taken) return { done: true, state: g.state }; return { dx: h.x - (p.x + p.w / 2), dy: h.y - (p.y + p.h / 2), visible: h.visible }; }); if (s.done) break; const dir = s.dx > 0 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(dir); if (s.dy < -10) await page.keyboard.press('Space'); await page.waitForTimeout(120); await page.keyboard.up(dir); }
  await page.waitForTimeout(4500); await page.screenshot({ path: path.join(outDir, '10-ending.png') }); const ending = await st();
  console.log(JSON.stringify({ dead: dead.state, respawned: { state: respawned.state, hp: respawned.hp, atBench: Math.abs(respawned.x - respawned.benchX) < 2 }, inArena: !!inArena.boss, afterArenaDeath, results, ending: ending.state, errors }, null, 1));
  await browser.close(); server.close();
  const arenaDeathOk = !!inArena.boss && afterArenaDeath.state === 'play' && !afterArenaDeath.boss && afterArenaDeath.gates === 0 && !afterArenaDeath.bossMusic && Math.abs(afterArenaDeath.x - afterArenaDeath.benchX) < 2;
  const ok = dead.state === 'dead' && respawned.state === 'play' && respawned.hp === 5 && Math.abs(respawned.x - respawned.benchX) < 2 && arenaDeathOk && Object.values(results).every((r) => r.ok) && ending.state === 'ending' && errors.length === 0;
  console.log(ok ? 'BOSS TEST OK' : 'BOSS TEST FAILED'); process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
