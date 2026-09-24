// Static checks + ASCII dump of the stitched world.
const { loadGameContext } = require('./load');
const ctx = loadGameContext();
const world = new ctx.World(ctx.MAP);
const counts = {};
for (const e of world.entities) counts[e.type] = (counts[e.type] || 0) + 1;
console.log('World', world.w, 'x', world.h, 'tiles; entities:', JSON.stringify(counts));
const req = { P: 1, 1: 1, 2: 1, 3: 1, X: 1, '*': 1 };
let ok = true;
for (const k in req) if ((counts[k] || 0) !== req[k]) { console.error(`Expected ${req[k]} of '${k}', found ${counts[k] || 0}`); ok = false; }
if (!counts.B) { console.error('No benches'); ok = false; }
// flood fill through non-solid tiles (treating D as passable) from the player start
const P = world.findEntity('P'); const seen = new Uint8Array(world.w * world.h); const stack = [[P.tx, P.ty]];
while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= world.w || y >= world.h) continue; const i = y * world.w + x; if (seen[i]) continue; const c = world.tile(x, y); if (c === '#' || c === 'I') continue; seen[i] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
for (const e of world.entities) if (!seen[e.ty * world.w + e.tx]) { console.error(`Entity ${e.type} at ${e.tx},${e.ty} (${e.room}) is sealed off from the start`); ok = false; }
// find open tiles not reachable (isolated pockets) just for information
let openUnreached = 0; for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (!seen[y * world.w + x] && world.tile(x, y) !== '#') openUnreached++;
console.log('Open tiles sealed from start:', openUnreached);
if (process.argv.includes('--dump')) {
  const lines = []; for (let y = 0; y < world.h; y++) { let s = ''; for (let x = 0; x < world.w; x++) s += world.tile(x, y); lines.push(s); }
  require('fs').writeFileSync(process.argv[process.argv.indexOf('--dump') + 1] || '/dev/stdout', lines.join('\n') + '\n');
}
console.log(ok ? 'MAP OK' : 'MAP HAS ERRORS'); process.exit(ok ? 0 : 1);
