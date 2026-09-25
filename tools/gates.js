// Runs the reachability solver for each ability set and asserts the intended gating.
// Usage: node tools/gates.js   (slow: several minutes per ability set)
const { spawnSync } = require('child_process');
const path = require('path');
const EXPECT = {
  '': { reach: ['4', '1', 'H@193,89', 'N', 'L@76,64'], miss: ['2', '3', 'H@221,85', 'H@45,69', 'W', 'S@4,71', 'B@38,92', 'L@175,101', 'H@54,18', 'Q', 'X'] },
  'dash': { reach: ['2', 'H@221,85', 'W', 'S@4,71', 'k@8,71', 'B@38,92', 'H@148,108', 'K'], miss: ['3', 'H@45,69', 'L@175,101', 'S@278,134', 'H@54,18', 'Q', 'X', 'L@166,26'] },
  'dash,walljump': { reach: ['3', 'S@278,134', 'H@54,18', 'B@209,134', 'B@50,34'], miss: ['H@45,69', 'H@188,21', 'Q', 'X', 'L@166,26', '*'] },
  'dash,walljump,doublejump': { reach: ['H@45,69', 'H@188,21', 'Q', 'X', '*', 'k@216,27', 'H@283,22'], miss: [] },
};
let failed = false;
for (const [abilities, exp] of Object.entries(EXPECT)) {
  const args = [path.join(__dirname, 'solver.js')]; if (abilities) args.push('--abilities', abilities);
  const t0 = Date.now(); const res = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (res.status !== 0) { console.error('solver failed for', abilities || 'none', res.stderr.slice(-500)); failed = true; continue; }
  const lines = res.stdout.split('\n').filter((l) => /^(REACH|MISS)/.test(l));
  const status = (key) => { // key: type or type@x,y
    const [type, at] = key.split('@');
    const hits = lines.filter((l) => { const m = l.match(/^(REACH|MISS)\s+(\S)\s.*@(\d+,\d+)/); return m && m[2] === type && (!at || m[3] === at); });
    if (!hits.length) return 'ABSENT';
    return hits.every((l) => l.startsWith('REACH')) ? 'REACH' : hits.every((l) => l.startsWith('MISS')) ? 'MISS' : 'MIXED';
  };
  const problems = [];
  for (const k of exp.reach) { const s = status(k); if (s !== 'REACH') problems.push(`expected REACH ${k}, got ${s}`); }
  for (const k of exp.miss) { const s = status(k); if (s !== 'MISS') problems.push(`expected MISS ${k}, got ${s}`); }
  console.log(`[${abilities || 'none'}] ${((Date.now() - t0) / 1000).toFixed(0)}s  ${problems.length ? 'PROBLEMS' : 'ok'}`);
  for (const p of problems) console.log('   ', p);
  if (problems.length) failed = true;
}
console.log(failed ? 'GATES: FAILED' : 'GATES: OK'); process.exit(failed ? 1 : 0);
