// Generates the SVG stills in art/ from the templates in tools/art/ (listed in tools/art/index.js), plus
// art/manifest.json. Animated character modules export every named pose as art/<name>_<pose>.svg (a pose called
// 'default' becomes art/<name>.svg); sheet modules export each still under its own name. Modules that fail to load
// are reported and their existing files and manifest entries are kept.
const fs = require('fs'); const path = require('path');
const { toSvg } = require('./art/lib');
// --check <module> [--out <dir>]: export only that module's stills into <dir> (default: a temp folder) and leave art/ alone
const argv = process.argv; const ci = argv.indexOf('--check'); const only = ci >= 0 ? argv[ci + 1] : null; const oi = argv.indexOf('--out');
const out = only ? (oi >= 0 ? argv[oi + 1] : fs.mkdtempSync(path.join(require('os').tmpdir(), 'art-check-'))) : path.join(__dirname, '..', 'art'); fs.mkdirSync(out, { recursive: true }); const manifestFile = path.join(out, 'manifest.json');
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
let count = 0, failed = 0;
const write = (name, scene, meta) => { fs.writeFileSync(path.join(out, name + '.svg'), toSvg(scene) + '\n'); manifest[name] = meta; count++; };
for (const modName of (only ? [only] : require('./art/index.js'))) {
  const file = path.join(__dirname, 'art', modName + '.js'); if (!fs.existsSync(file)) { console.warn(`- ${modName}: not written yet, skipped`); continue; }
  let mod; try { mod = require(file); } catch (e) { console.error(`! ${modName}: ${e.message}`); failed++; continue; }
  try {
    if (mod.make && mod.params) { // animated character
      const meta = { w: mod.w, h: mod.h, anchor: mod.anchor };
      for (const [pose, partial] of Object.entries(mod.poses || { default: {} })) write(pose === 'default' ? mod.name : `${mod.name}_${pose}`, mod.make(Object.assign({}, mod.params, partial)), meta);
    } else if (mod.stills) for (const [name, a] of Object.entries(mod.stills)) write(name, a.make(), { w: a.w, h: a.h, anchor: a.anchor });
    else { console.warn(`- ${modName}: exports neither a character (make + params) nor stills, skipped`); }
  } catch (e) { console.error(`! ${modName}: ${e.stack}`); failed++; }
}
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 1) + '\n');
console.log(`wrote ${count} assets to ${out}${failed ? ` (${failed} module(s) failed, their previous files were kept)` : ''}`);
if (failed) process.exitCode = 1;
