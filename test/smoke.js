// Headless smoke test: serves the repo, loads the game, drives it with key presses, screenshots.
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const root = path.join(__dirname, '..'); const outDir = process.env.SHOT_DIR || path.join(root, 'test', 'shots');
fs.mkdirSync(outDir, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForTimeout(800);
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  await page.screenshot({ path: path.join(outDir, '01-title.png') });
  await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, '02-start.png') });
  const state = async () => page.evaluate(() => { const g = window.game, p = g.player; return { state: g.state, x: +p.x.toFixed(1), y: +p.y.toFixed(1), hp: p.hp, onGround: p.onGround, area: g.area, fps: g.fpsEstimate, particles: g.fx.ps.length }; });
  const s0 = await state();
  await hold('ArrowRight', 900); const s1 = await state();
  await page.keyboard.down('ArrowRight'); await page.keyboard.press('Space'); await page.waitForTimeout(250); const sJump = await state(); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyX'); await page.waitForTimeout(120); await page.screenshot({ path: path.join(outDir, '03-slash.png') });
  await hold('ArrowLeft', 1500); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(500); await page.screenshot({ path: path.join(outDir, '04-interact.png') });
  const sDlg = await state();
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.keyboard.press('KeyM'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(outDir, '05-map.png') }); await page.keyboard.press('KeyM'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.screenshot({ path: path.join(outDir, '06-pause.png') }); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const sResumed = await state();
  // area tour: teleport around the world for visual checks of every palette
  const tour = [['10-mossgrove', 200, 91], ['11-depths', 45, 110], ['12-heights', 52, 34], ['13-spire', 190, 27], ['14-westcaves', 60, 78]];
  for (const [name, tx, ty] of tour) {
    await page.evaluate(([tx, ty]) => { const g = window.game, p = g.player; p.x = tx * 16 + 3; p.y = ty * 16 + 16 - p.h; p.vx = 0; p.vy = 0; p.invuln = 1e9; g.cam.x = p.x - 240; g.cam.y = p.y - 135; g.ui.areaTitle = null; }, [tx, ty]);
    await page.waitForTimeout(700); await page.screenshot({ path: path.join(outDir, name + '.png') });
  }
  // save / continue round-trip: grant dash, rest at the start bench, reload, continue
  await page.evaluate(() => { const g = window.game, p = g.player; p.abilities.dash = true; p.x = 87 * 16 + 3; p.y = 79 * 16 - p.h; p.vx = 0; p.vy = 0; p.onGround = true; });
  await page.waitForTimeout(200); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(600);
  const sBench = await page.evaluate(() => ({ sitting: window.game.player.sitting, saved: !!localStorage.getItem('glimmerdeep_save_v1') }));
  await page.reload(); await page.waitForTimeout(600);
  const sTitle = await page.evaluate(() => ({ state: window.game.state, hasSave: window.game.hasSave }));
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const sLoaded = await page.evaluate(() => { const g = window.game, p = g.player; return { state: g.state, dash: p.abilities.dash, x: Math.round(p.x), benchX: Math.round(g.benchPos.x) }; });
  // measure frame time
  const perf = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (n < 120) requestAnimationFrame(f); else res((performance.now() - t0) / n); }; requestAnimationFrame(f); }));
  // world overview render (debug)
  const overview = await page.evaluate(() => window.game.renderOverview ? window.game.renderOverview() : null);
  if (overview) fs.writeFileSync(path.join(outDir, '00-world.png'), Buffer.from(overview.split(',')[1], 'base64'));
  console.log(JSON.stringify({ s0, s1, sJump, sDlg, sResumed: sResumed.state, sBench, sTitle, sLoaded, msPerFrame: +perf.toFixed(2), errors }, null, 1));
  await browser.close(); server.close();
  const moved = s1.x > s0.x + 40; const jumped = !sJump.onGround; const resumed = sResumed.state === 'play';
  const saved = sBench.sitting && sBench.saved && sTitle.hasSave && sLoaded.state === 'play' && sLoaded.dash && Math.abs(sLoaded.x - sLoaded.benchX) < 2;
  if (errors.length || !moved || !jumped || !resumed || !saved) { console.error('SMOKE FAILED', { moved, jumped, resumed, saved, errors }); process.exit(1); }
  console.log('SMOKE OK');
})().catch((e) => { console.error(e); process.exit(1); });
