// Filmstrip: runs the game headless, drives one subject through a scenario and saves a strip of frames around it,
// so animation can be reviewed frame by frame. Needs playwright (npm install, or PW_MODULE=<path to playwright>).
//
//   node tools/filmstrip.js --subject player --scenario run --out shots/run.png
//   node tools/filmstrip.js --subject enemy:c --scenario default --set '{"state":"charge","t":0}' --frames 16 --every 3
//   node tools/filmstrip.js --subject boss:bell --skip 2500 --frames 24 --every 4
//   node tools/filmstrip.js --subject decor:B --frames 12 --every 6      (hearth)    decor types: B T + L G h N W Q K
//   node tools/filmstrip.js --subject pickup:H --frames 12 --every 6
//   node tools/filmstrip.js --subject tile:% --scenario bounce            (a puffcap; the player drops onto it)
//   node tools/filmstrip.js --subject decor:B --lit --active              (a kindled hearth that is the current rest point)
//   node tools/filmstrip.js --subject boss:lightless --skip 2500 --set '{"phase":3,"hp":8}'   (--set applies to the boss once it has appeared)
//
// Options: --frames N (default 16), --every K (capture every K rendered frames, default 3), --skip ms (wait before capturing),
// --set JSON (assign fields on the subject before capturing), --poke (strike the subject once capturing starts),
// --size W,H (world units around the subject), --zoom Z (scene pixels per world unit, default 4), --out file.png,
// --artsrc file.js (serve this bundle as src/artsrc.js, e.g. one built with `node tools/bundle-src.js --out file.js`)
// Player scenarios: idle run jump land dash strike strike-up pogo cast focus cling hurt flare sit doublejump
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const subject = arg('subject', 'player'), scenario = arg('scenario', 'idle'), frames = +arg('frames', 16), every = +arg('every', 3), skip = +arg('skip', 0), setJson = arg('set', null), zoom = +arg('zoom', 4);
const size = (arg('size', '') || '').split(',').map(Number); const out = arg('out', path.join(root, 'test', 'shots', `strip-${subject.replace(':', '-')}-${scenario}.png`));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const artsrc = arg('artsrc', null);
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const p = artsrc && u === '/src/artsrc.js' ? path.resolve(artsrc) : path.join(root, u === '/' ? 'index.html' : u); if ((!p.startsWith(root) && p !== path.resolve(artsrc || '')) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch(); const vw = Math.round(400 * zoom), vh = Math.round(240 * zoom); const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForTimeout(1200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); };
  // ---- place the subject and the player, install the capture hook
  const info = await page.evaluate(([subject, scenario, setJson, size, frames, every, flags]) => {
    const g = window.game, p = g.player; const set = setJson ? JSON.parse(setJson) : null; g.ui.areaTitle = null; g.hint = null;
    const [kind, type] = subject.split(':'); let target = null, rect = null; let w = size[0] || 80, h = size[1] || 64;
    const tp = (x, y) => { p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.invuln = 1e9; p.flareCd = 1e9; p.hp = p.maxHp; g.cam.x = x - g.viewW / 2; g.cam.y = y - g.viewH / 2; g.clampCam(); };
    const nearest = (list, x, y) => list.slice().sort((a, b) => Math.hypot(a.tx * 16 - x, a.ty * 16 - y) - Math.hypot(b.tx * 16 - x, b.ty * 16 - y))[0];
    if (kind === 'player') {
      target = p; p.abilities.dash = p.abilities.walljump = p.abilities.doublejump = p.abilities.spell = true;
      if (scenario === 'cast' || scenario === 'focus' || scenario === 'flare') p.soul = 100; if (scenario === 'focus') p.hp = 2;
      if (scenario === 'sit') { const b = nearest(g.decor.filter((d) => d.type === 'B'), p.x, p.y); tp(b.tx * 16 + 3, b.ty * 16 + 16 - p.h); p.onGround = true; }
      if (scenario === 'cling') { // find a tall wall to the right at the player's height and hang beside it in the air
        const W = g.world; const ty = Math.floor((p.y + p.h / 2) / 16); let tx = Math.floor(p.x / 16) + 1;
        while (tx < W.w && !(W.isSolid(tx, ty - 1) && W.isSolid(tx, ty - 2) && W.isSolid(tx, ty - 3) && !W.isSolid(tx - 1, ty - 2) && !W.isSolid(tx - 1, ty - 3))) tx++;
        tp(tx * 16 - p.w - 0.5, (ty - 3) * 16); p.invuln = 1e9;
      }
      if (set) Object.assign(p, set);
      rect = () => ({ x: p.x + p.w / 2 - w / 2, y: p.y + p.h - h + 12 });
    } else if (kind === 'enemy') {
      const e = g.enemies.find((q) => q.type === type && q.alive); if (!e) return { error: 'no enemy of type ' + type }; target = e;
      tp(e.x - 70, e.y + e.h - p.h); e.facing = 1; e.anim = 0; if (set) Object.assign(e, set);
      rect = () => ({ x: e.x + e.w / 2 - w / 2, y: e.y + e.h - h + 10 });
    } else if (kind === 'boss') {
      const spots = { gulletroot: [226, 89, 1], bell: [8, 110, -1], lightless: [284, 15, -1] }; const s = spots[type]; if (!s) return { error: 'unknown boss ' + type };
      if (!size[0]) { w = 170; h = 130; } p.abilities.dash = p.abilities.walljump = p.abilities.doublejump = p.abilities.spell = true; p.maxHp = 9; p.hp = 9;
      const a = g.arenas.find((q) => q.id === type); if (a) a.done = false; tp(s[0] * 16, s[1] * 16 + 16 - p.h); target = { dir: s[2] };
      rect = () => { const b = g.boss; if (!b) return { x: p.x - w / 2, y: p.y - h / 2 }; return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h - h + 16 }; };
    } else if (kind === 'decor') {
      const d = g.decor.find((q) => q.type === type); if (!d) return { error: 'no decor ' + type }; target = d; if (type === 'h' && !size[0]) { w = 170; h = 120; }
      tp(d.tx * 16 - 50, d.ty * 16 + 16 - p.h); if (type === 'G') g.world.closedGates.add(d.tx + ',' + d.ty); if (set) Object.assign(d, set);
      if (flags.lit) g.benchesSeen.push([d.tx, d.ty]); if (flags.active) g.benchPos = { x: d.tx * 16 + 3, y: d.ty * 16 + 16 - p.h };
      rect = () => ({ x: d.tx * 16 + 8 - w / 2, y: d.ty * 16 + 16 - h + 8 });
    } else if (kind === 'tile') {
      const W = g.world; let found = null; for (let y = 0; y < W.h && !found; y++) for (let x = 0; x < W.w; x++) if (W.tile(x, y) === type) { found = [x, y]; break; }
      if (!found) return { error: 'no tile ' + type }; target = { tx: found[0], ty: found[1] };
      if (scenario === 'bounce') tp(found[0] * 16 + 8 - p.w / 2, found[1] * 16 - 70); else tp(found[0] * 16 - 50, found[1] * 16 + 16 - p.h);
      rect = () => ({ x: found[0] * 16 + 8 - w / 2, y: found[1] * 16 + 16 - h + 8 });
    } else if (kind === 'pickup') {
      const pk = g.pickups.find((q) => q.type === type); if (!pk) return { error: 'no pickup ' + type }; target = pk; pk.visible = true; pk.taken = false;
      tp(pk.x - 60, pk.y + 30); if (set) Object.assign(pk, set);
      rect = () => ({ x: pk.x - w / 2, y: pk.y - h / 2 });
    } else return { error: 'unknown subject ' + subject };
    g.state = 'play';
    // pin the render scale: headless rendering is slow enough to trigger the game's adaptive resolution, which would change
    // the zoom (and the crop) mid-capture
    g.adaptQuality = () => {}; g.renderScale = 1; g.resize();
    // capture hook: after every render, copy the region around the subject into the strip
    const cols = Math.min(8, frames); const z = g.zoom; const cw = Math.round(w * z), ch = Math.round(h * z);
    const strip = document.createElement('canvas'); strip.width = cols * cw; strip.height = Math.ceil(frames / cols) * (ch + 14); const sx = strip.getContext('2d'); sx.fillStyle = '#101018'; sx.fillRect(0, 0, strip.width, strip.height);
    const cap = { n: 0, k: 0, armed: false, done: false, t0: 0 };
    const orig = g.render.bind(g);
    g.render = () => { if (kind === 'boss' && g.boss) { const b = g.boss; g.cam.x = b.x + b.w / 2 - g.viewW / 2; g.cam.y = b.y + b.h / 2 - g.viewH / 2 + 20; g.clampCam(); } // keep a boss in frame whatever the player does
      orig(); if (!cap.armed || cap.done) return; cap.k++; if (cap.k % every) return; const r = rect(); const i = cap.n; const dx = (i % cols) * cw, dy = Math.floor(i / cols) * (ch + 14);
      const zz = g.zoom; sx.drawImage(g.canvas, (r.x - g.cam.x) * zz, (r.y - g.cam.y) * zz, w * zz, h * zz, dx, dy, cw, ch); sx.strokeStyle = '#333'; sx.strokeRect(dx + 0.5, dy + 0.5, cw - 1, ch - 1); sx.fillStyle = '#ffd9a0'; sx.font = '11px Georgia'; sx.fillText(`${i}  +${((g.time - cap.t0) * 1000).toFixed(0)}ms`, dx + 3, dy + ch + 11);
      cap.n++; if (cap.n >= frames) cap.done = true; };
    window.__cap = { cap, strip, arm: () => { cap.armed = true; cap.t0 = g.time; }, target };
    return { ok: true, zoom: z, w, h, area: g.area };
  }, [subject, scenario, setJson, size, frames, every, { lit: has('lit'), active: has('active') }]);
  if (info.error) { console.error(info.error); process.exit(1); }
  const arm = () => page.evaluate(() => window.__cap.arm());
  const poke = () => page.evaluate(() => { const g = window.game; const t = window.__cap.target; if (t && t.def) damageEnemy(t, 1, t.x - 20, 'right', false); else if (g.boss) damageBoss(g.boss, 1); });
  const [kind] = subject.split(':');
  if (kind === 'boss') { const dir = info && (await page.evaluate(() => window.__cap.target.dir)); await hold(dir > 0 ? 'ArrowRight' : 'ArrowLeft', 1500); }
  if (skip) await page.waitForTimeout(skip);
  if (kind === 'boss' && setJson) await page.evaluate((s) => { if (window.game.boss) Object.assign(window.game.boss, JSON.parse(s)); }, setJson);
  if (kind === 'player') {
    const sc = scenario;
    if (sc === 'run') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await arm(); await page.waitForTimeout(20 * every * frames); await page.keyboard.up('ArrowRight'); }
    else if (sc === 'jump' || sc === 'land') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(200); if (sc === 'jump') await arm(); await page.keyboard.down('Space'); await page.waitForTimeout(sc === 'land' ? 420 : 160); if (sc === 'land') await arm(); await page.keyboard.up('Space'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowRight'); }
    else if (sc === 'doublejump') { await page.keyboard.down('ArrowRight'); await page.keyboard.press('Space'); await page.waitForTimeout(250); await arm(); await page.keyboard.press('Space'); await page.waitForTimeout(1200); await page.keyboard.up('ArrowRight'); }
    else if (sc === 'dash') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await arm(); await page.keyboard.press('KeyC'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight'); }
    else if (sc === 'strike') { await arm(); await page.keyboard.press('KeyX'); await page.waitForTimeout(450); await page.keyboard.press('KeyX'); await page.waitForTimeout(600); }
    else if (sc === 'strike-up') { await arm(); await page.keyboard.down('ArrowUp'); await page.keyboard.press('KeyX'); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(600); }
    else if (sc === 'pogo') { await page.keyboard.press('Space'); await page.waitForTimeout(200); await arm(); await page.keyboard.down('ArrowDown'); await page.keyboard.press('KeyX'); await page.keyboard.up('ArrowDown'); await page.waitForTimeout(800); }
    else if (sc === 'cast') { await arm(); await page.keyboard.press('KeyV'); await page.waitForTimeout(900); }
    else if (sc === 'focus') { await arm(); await hold('KeyV', 1400); await page.waitForTimeout(400); }
    else if (sc === 'cling') { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(100); await arm(); await page.waitForTimeout(900); await page.keyboard.press('Space'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight'); }
    else if (sc === 'hurt') { await arm(); await page.evaluate(() => { const g = window.game, p = g.player; p.invuln = 0; p.soul = 0; hurtPlayer(p, 1, p.x + 20, p.y); p.invuln = 1e9; }); await page.waitForTimeout(900); }
    else if (sc === 'flare') { await arm(); await page.evaluate(() => { const g = window.game, p = g.player; p.invuln = 0; hurtPlayer(p, 1, p.x + 20, p.y); p.invuln = 1e9; }); await page.waitForTimeout(900); }
    else if (sc === 'sit') { await page.waitForTimeout(150); await arm(); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(2500); }
    else { await arm(); await page.waitForTimeout(100 + 17 * every * frames); }
  } else { await arm(); if (has('poke')) { await page.waitForTimeout(120); await poke(); } await page.waitForTimeout(100 + 17 * every * frames); }
  // headless frames can take 60-100 ms each, so wait for the strip to fill rather than assuming 60 fps
  const limit = Date.now() + Math.max(8000, frames * every * 150 + 5000);
  while (Date.now() < limit) { const done = await page.evaluate(() => window.__cap.cap.done); if (done) break; await page.waitForTimeout(100); }
  const res = await page.evaluate(() => ({ frames: window.__cap.cap.n, png: window.__cap.strip.toDataURL('image/png') }));
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, Buffer.from(res.png.split(',')[1], 'base64'));
  console.log(JSON.stringify({ subject, scenario, frames: res.frames, out, errors }));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
