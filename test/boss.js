// Scripted boss-fight & death/respawn test in headless Chromium (player made invulnerable for determinism).
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const root = path.join(__dirname, '..'); const outDir = process.env.SHOT_DIR || path.join(root, 'test', 'shots');
fs.mkdirSync(outDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const st = () => page.evaluate(() => { const g = window.game, p = g.player, b = g.boss; return { state: g.state, x: Math.round(p.x), y: Math.round(p.y), hp: p.hp, gates: g.world.gatesClosed, bossDefeated: g.bossDefeated, boss: b ? { hp: b.hp, state: b.state, phase: b.phase, alive: b.alive } : null, enemies: g.enemies.filter((e) => e.alive).length, area: g.area, benchX: Math.round(g.benchPos.x) }; });
  // --- death & respawn: kill the player, expect respawn at the bench with full hp
  await page.evaluate(() => { const g = window.game; g.player.x += 200; g.player.hp = 1; window.game.player.invuln = 0; });
  await page.evaluate(() => { const g = window.game; hurtPlayer(g.player, 5, g.player.x + 5, g.player.y); });
  await page.waitForTimeout(400); const dead = await st(); await page.waitForTimeout(2500); const respawned = await st();
  // --- teleport to the spire corridor with all abilities
  await page.evaluate(() => { const g = window.game; const p = g.player; p.abilities.dash = p.abilities.walljump = p.abilities.doublejump = true; p.maxHp = 9; p.hp = 9; p.x = 219 * 16; p.y = 16 * 16 - p.h; p.vx = 0; p.vy = 0; p.invuln = 1e9; g.cam.x = p.x - 240; g.cam.y = p.y - 135; });
  await page.waitForTimeout(300);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(1400); await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(1500); const started = await st();
  await page.screenshot({ path: path.join(outDir, '07-boss-intro.png') });
  // --- fight: face the boss and slash whenever close; keep the player invulnerable
  let last = null; const t0 = Date.now(); let shots = 0;
  while (Date.now() - t0 < 150000) {
    const s = await page.evaluate(() => { const g = window.game, p = g.player, b = g.boss; p.invuln = 1e9; if (!b) return { done: true, bossDefeated: g.bossDefeated, state: g.state }; const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, pc = { x: p.x + p.w / 2, y: p.y + p.h / 2 }; return { dx: bc.x - pc.x, dy: bc.y - pc.y, hp: b.hp, state: b.state, alive: b.alive, phase: b.phase }; });
    if (s.done) { last = s; break; }
    const dir = s.dx > 0 ? 'ArrowRight' : 'ArrowLeft';
    if (Math.abs(s.dx) > 34) { await page.keyboard.down(dir); await page.waitForTimeout(120); await page.keyboard.up(dir); }
    else { await page.keyboard.down(dir); await page.keyboard.press('KeyX'); await page.waitForTimeout(80); await page.keyboard.up(dir); await page.waitForTimeout(260); }
    if (s.phase === 2 && shots === 0) { await page.screenshot({ path: path.join(outDir, '08-boss-phase2.png') }); shots++; }
  }
  await page.waitForTimeout(3500); const afterBoss = await st();
  // collect the heart: walk to it
  for (let i = 0; i < 40; i++) { const s = await page.evaluate(() => { const g = window.game, p = g.player; const h = g.pickups.find((k) => k.type === '*'); if (!h || h.taken) return { done: true, state: g.state }; return { dx: h.x - (p.x + p.w / 2), dy: h.y - (p.y + p.h / 2), visible: h.visible }; }); if (s.done) break; const dir = s.dx > 0 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(dir); if (s.dy < -10) await page.keyboard.press('Space'); await page.waitForTimeout(120); await page.keyboard.up(dir); }
  await page.waitForTimeout(4500); await page.screenshot({ path: path.join(outDir, '09-ending.png') }); const ending = await st();
  console.log(JSON.stringify({ dead, respawned, started, last, afterBoss, ending, errors }, null, 1));
  await browser.close(); server.close();
  const ok = dead.state === 'dead' && respawned.state === 'play' && respawned.hp === 5 && Math.abs(respawned.x - respawned.benchX) < 2 && started.boss && started.gates && afterBoss.bossDefeated && !afterBoss.gates && ending.state === 'ending' && errors.length === 0;
  console.log(ok ? 'BOSS TEST OK' : 'BOSS TEST FAILED'); process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
