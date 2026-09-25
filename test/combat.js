// Scripted combat loop test: slash a beetle, gain soul, take damage, heal with focus.
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForTimeout(500);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // stand just left of the first beetle in the Hollow (spawned at tile 118,78), facing right
  const near = () => page.evaluate(() => { const g = window.game, p = g.player; const e = g.enemies.find((e) => e.id === 'e_118_78'); return { ehp: e.hp, alive: e.alive, ex: Math.round(e.x), px: Math.round(p.x), soul: p.soul, hp: p.hp, maxHp: p.maxHp }; });
  await page.evaluate(() => { const g = window.game, p = g.player; const e = g.enemies.find((e) => e.id === 'e_118_78'); p.x = e.x - 22; p.y = 79 * 16 - p.h; p.vx = 0; p.facing = 1; p.invuln = 3; });
  await page.waitForTimeout(100); const before = await near();
  let hits = 0;
  for (let i = 0; i < 12 && (await near()).alive; i++) { await page.evaluate(() => { const g = window.game, p = g.player; const e = g.enemies.find((e) => e.id === 'e_118_78'); p.x = e.x - 20; p.facing = 1; p.invuln = 3; }); await page.keyboard.press('KeyX'); hits++; await page.waitForTimeout(380); }
  const afterKill = await near();
  // take damage from the second beetle (spawned at 138,78)
  await page.evaluate(() => { const g = window.game, p = g.player; const e = g.enemies.find((e) => e.id === 'e_138_78'); p.x = e.x - 4; p.y = e.y; p.invuln = 0; p.vx = 0; });
  await page.waitForTimeout(300); const hurt = await near();
  // focus-heal: give enough soul, stand still on the floor and hold V
  await page.evaluate(() => { const g = window.game, p = g.player; p.soul = 66; p.x = 100 * 16; p.y = 79 * 16 - p.h; p.vx = 0; p.invuln = 5; for (const e of g.enemies) e.alive = false; });
  await page.waitForTimeout(200); const preHeal = await near();
  await page.keyboard.down('KeyV'); await page.waitForTimeout(1300); await page.keyboard.up('KeyV');
  const healed = await near();
  // cinder spell: tap V with full ember spawns a bolt
  await page.evaluate(() => { const g = window.game, p = g.player; p.abilities.spell = true; p.soul = 100; });
  await page.keyboard.down('KeyV'); await page.waitForTimeout(40); await page.keyboard.up('KeyV'); await page.waitForTimeout(150);
  const cast = await page.evaluate(() => ({ bolts: window.game.projectiles.filter((q) => q.kind === 'bolt').length, soul: window.game.player.soul }));
  // ember flare: at full ember a hit is absorbed instead of costing a petal
  await page.evaluate(() => { const g = window.game, p = g.player; p.soul = 100; p.invuln = 0; p.flareCd = 0; p.hp = p.maxHp; const e = g.enemies.find((e) => e.id === 'e_138_78'); e.alive = true; e.hp = 2; p.x = e.x - 4; p.y = e.y; p.vx = 0; });
  await page.waitForTimeout(250); const flare = await near();
  console.log(JSON.stringify({ before, hits, afterKill, hurt, preHeal, healed, cast, flare, errors }));
  await browser.close(); server.close();
  const ok = before.alive && !afterKill.alive && afterKill.soul > before.soul && hurt.hp < afterKill.hp && healed.hp === preHeal.hp + 1 && healed.soul === preHeal.soul - 35 && cast.bolts === 1 && cast.soul === 70 && flare.hp === flare.maxHp && flare.soul === 0 && errors.length === 0;
  console.log(ok ? 'COMBAT TEST OK' : 'COMBAT TEST FAILED'); process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
