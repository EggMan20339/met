// Generates every SVG in art/ from the templates in tools/art/, plus art/manifest.json.
const fs = require('fs'); const path = require('path');
const out = path.join(__dirname, '..', 'art');
const mote = require('./art/mote'); const enemies = require('./art/enemies'); const npcs = require('./art/npcs'); const bosses = require('./art/bosses'); const props = require('./art/props'); const backgrounds = require('./art/backgrounds');
const manifest = {}; let count = 0;
const write = (name, svg, meta) => { fs.writeFileSync(path.join(out, name + '.svg'), svg + '\n'); manifest[name] = meta; count++; };
for (const pose of mote.names) write('mote_' + pose, mote.make(pose), mote.meta);
for (const sheet of [enemies, npcs, bosses, props, backgrounds]) for (const [name, a] of Object.entries(sheet)) write(name, a.make(), { w: a.w, h: a.h, anchor: a.anchor });
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`wrote ${count} assets to art/`);
