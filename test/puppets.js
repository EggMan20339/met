// Puppet health check: every live art module must load, animate every entity it is used for without errors,
// keep its parameters finite (a NaN makes a creature silently vanish), and stay cheap (op count and draw time).
// Run: node test/puppets.js   (PW_MODULE=<path to playwright> if it is not in node_modules)
const path = require('path'); const fs = require('fs'); const http = require('http');
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const root = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); const p = path.join(root, u === '/' ? 'index.html' : u); if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, r)); const port = server.address().port;
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://localhost:${port}/index.html`); await page.waitForTimeout(1200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  const report = await page.evaluate(async () => {
    const g = window.game; const out = { modules: {}, problems: [] }; const dt = 1 / 60;
    const live = Object.keys(ARTSRC).filter((k) => k !== 'lib' && ARTSRC[k] && ARTSRC[k].make && ARTSRC[k].control);
    const finite = (v, where) => { if (typeof v === 'number') { if (!Number.isFinite(v)) out.problems.push(`${where}: ${v}`); } else if (Array.isArray(v)) v.forEach((x, i) => finite(x, where + '[' + i + ']')); else if (v && typeof v === 'object') for (const k in v) if (k !== 'children' || true) finite(v[k], where + '.' + k); };
    const countOps = (ops) => ops.reduce((n, op) => n + 1 + (op.children ? countOps(op.children) : 0), 0);
    // one representative entity per module, driven through its own states by the game for a while
    const subjects = [];
    subjects.push({ mod: 'mote', ent: g.player, kind: 'player' });
    for (const e of g.enemies) { const m = PUPPET_OF.enemy[e.type]; if (m && !subjects.some((s) => s.mod === m)) subjects.push({ mod: m, ent: e, kind: 'enemy' }); }
    for (const d of g.decor) { const m = PUPPET_OF.decor[d.type]; if (m && !subjects.some((s) => s.mod === m)) subjects.push({ mod: m, ent: d, kind: 'decor', type: d.type }); }
    for (const pk of g.pickups) if (!subjects.some((s) => s.mod === 'pickups' && s.ent.type === pk.type)) subjects.push({ mod: 'pickups', ent: pk, kind: 'pickup' });
    for (const kind of ['gulletroot', 'bell', 'lightless']) subjects.push({ mod: kind, ent: makeBoss(kind, g.player.x, g.player.y + g.player.h), kind: 'boss' });
    subjects.push({ mod: 'puffcap', ent: { tx: 10, ty: 10, type: '%' }, kind: 'tile' });
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const ctx = c.getContext('2d');
    for (const s of subjects) {
      const def = ARTSRC[s.mod]; if (!def || !def.make || !def.control) { out.modules[s.mod] = { missing: true }; continue; }
      const ent = s.ent; const scale = typeof def.scale === 'function' ? def.scale(ent) : (def.scale || Art.scale(def.name));
      const pup = new Puppet(def); pup.scale = scale; const info = { dt, t: 0, game: g, lit: true, active: false, glowAt: () => {} };
      // drive the entity through a few states so control sees transitions (bosses and enemies by their own update)
      const states = s.kind === 'enemy' ? ['idle', 'walk', 'tele', 'charge', 'stun', 'shell', 'fire', 'wait', 'air', 'land', 'swing_tele', 'swing', 'lunge_tele', 'lunge', 'stagger', 'hurt'] : s.kind === 'boss' ? ['intro', 'roar', 'idle', 'charge_tele', 'charge', 'leap_tele', 'leap', 'slam', 'spit', 'blink', 'beam_tele', 'beam', 'stun', 'thorns_tele', 'thorns', 'lash', 'hurt', 'submerge', 'emerge', 'hover', 'toll_tele', 'toll', 'slam_tele', 'stunned', 'rise', 'rain_tele', 'rain', 'summon'] : [null];
      let maxOps = 0, t0 = performance.now(), frames = 0;
      try {
        for (const st of states) {
          if (st) { ent.state = st; ent.t = 0; ent.anim = 0; ent.vx = st === 'walk' || st === 'charge' ? 60 : 0; if (s.kind === 'boss' && st === 'intro') ent.phase = 1; }
          for (let i = 0; i < 40; i++) { if (ent.t !== undefined) ent.t += dt; if (ent.anim !== undefined) ent.anim += dt; if (ent.flash !== undefined) ent.flash = i === 5 ? 0.2 : 0; if (ent.hp !== undefined && i === 20) ent.hp = Math.max(1, ent.hp - 1);
            info.t += dt; def.control(ent, pup, info); pup.update(dt); const sc = pup.scene(); maxOps = Math.max(maxOps, countOps(sc.ops)); frames++;
            if (i % 10 === 0) { finite(pup.P, s.mod + '.P'); finite(sc.ops, s.mod + '.scene'); }
            ctx.setTransform(3, 0, 0, 3, 0, 0); Vec.draw(ctx, sc, 60, 80, { anchor: def.anchor, scale, flip: i % 2 === 0 }); }
          if (s.kind === 'boss' || s.kind === 'enemy') { ent.state = 'idle'; }
        }
      } catch (e) { out.problems.push(`${s.mod}: ${e.message}`); }
      const perFrame = (performance.now() - t0) / frames;
      out.modules[s.mod] = { maxOps, usPerFrame: +(perFrame * 1000).toFixed(0), params: Object.keys(pup.P).length };
      if (maxOps > 90) out.problems.push(`${s.mod}: ${maxOps} ops in one scene (keep under ~60)`);
      if (perFrame > 1.5) out.problems.push(`${s.mod}: ${perFrame.toFixed(2)} ms per frame for control+update+draw`);
    }
    out.live = live; return out;
  });
  console.log(JSON.stringify({ modules: report.modules, problems: report.problems, errors }, null, 1));
  await browser.close(); server.close();
  if (report.problems.length || errors.length) { console.error('PUPPET TEST FAILED'); process.exit(1); }
  console.log('PUPPET TEST OK');
})().catch((e) => { console.error(e); process.exit(1); });
