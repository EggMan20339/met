// Captures the whole filmstrip gallery (every subject in its key states) into one folder, for reviewing animation
// after a change: node tools/filmstrip-all.js [outDir] [filter]   (filter matches the strip name)
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const outDir = process.argv[2] || path.join(__dirname, '..', 'test', 'strips'); const filter = process.argv[3] || '';
fs.mkdirSync(outDir, { recursive: true });
const S = (name, args) => ({ name, args });
const STRIPS = [
  S('mote-idle', '--subject player --scenario idle --frames 16 --every 4'), S('mote-run', '--subject player --scenario run --frames 16 --every 2'),
  S('mote-jump', '--subject player --scenario jump --frames 16 --every 2'), S('mote-land', '--subject player --scenario land --frames 16 --every 2'),
  S('mote-dash', '--subject player --scenario dash --frames 16 --every 2'), S('mote-strike', '--subject player --scenario strike --frames 16 --every 2'),
  S('mote-cast', '--subject player --scenario cast --frames 16 --every 2'), S('mote-focus', '--subject player --scenario focus --frames 16 --every 3'),
  S('mote-cling', '--subject player --scenario cling --frames 16 --every 2'), S('mote-hurt', '--subject player --scenario hurt --frames 16 --every 2'), S('mote-sit', '--subject player --scenario sit --frames 16 --every 3'),
  S('dimling', '--subject enemy:e --frames 16 --every 3'), S('dimling-hit', '--subject enemy:e --poke --frames 12 --every 2'),
  S('hushmoth', '--subject enemy:f --frames 16 --every 2'), S('hushmoth-aggro', "--subject enemy:f --set {\"aggro\":true} --frames 16 --every 2"),
  S('sporeling', "--subject enemy:s --set {\"state\":\"charge\",\"t\":0} --frames 20 --every 2"),
  S('rootram', '--subject enemy:c --frames 16 --every 3'), S('rootram-charge', "--subject enemy:c --set {\"state\":\"tele\",\"t\":0} --frames 24 --every 2"), S('rootram-stun', "--subject enemy:c --set {\"state\":\"stun\",\"t\":0} --frames 12 --every 3"),
  S('snuffer', "--subject enemy:g --set {\"state\":\"tele\",\"t\":0} --frames 24 --every 2"),
  S('emberback', '--subject enemy:a --frames 16 --every 3'), S('emberback-shell', "--subject enemy:a --set {\"state\":\"shell\",\"t\":0,\"vx\":-90} --frames 16 --every 2"),
  S('gloamwing', "--subject enemy:r --set {\"aggro\":true,\"t\":2.2} --frames 20 --every 2"),
  S('springfoot', '--subject enemy:j --frames 20 --every 2'),
  S('husk-walk', '--subject enemy:k --frames 16 --every 3'), S('husk-swing', "--subject enemy:k --set {\"state\":\"swing_tele\",\"t\":0} --frames 24 --every 2"), S('husk-lunge', "--subject enemy:k --set {\"state\":\"lunge_tele\",\"t\":0} --frames 24 --every 2"), S('husk-stagger', "--subject enemy:k --set {\"state\":\"stagger\",\"t\":0} --frames 16 --every 2"),
  S('gulletroot', '--subject boss:gulletroot --skip 2500 --frames 24 --every 3'), S('gulletroot-lash', "--subject boss:gulletroot --skip 2000 --set {\"state\":\"lash\",\"t\":0} --frames 24 --every 2"),
  S('bell', '--subject boss:bell --skip 2500 --frames 24 --every 3'), S('bell-slam', "--subject boss:bell --skip 2500 --set {\"state\":\"slam_tele\",\"t\":0} --frames 28 --every 2"),
  S('lightless', '--subject boss:lightless --skip 2500 --frames 24 --every 3'), S('lightless-charge', "--subject boss:lightless --skip 2500 --set {\"state\":\"charge_tele\",\"t\":0} --frames 28 --every 2"), S('lightless-p3', "--subject boss:lightless --skip 2500 --set {\"phase\":3,\"hp\":8,\"state\":\"roar\",\"t\":0} --frames 24 --every 2"),
  S('wick', '--subject decor:N --frames 20 --every 6'), S('bramble', '--subject decor:W --frames 20 --every 6'), S('tallow', '--subject decor:Q --frames 20 --every 6'), S('ringer', '--subject decor:K --frames 20 --every 6'),
  S('hearth-lit', '--subject decor:B --lit --active --frames 16 --every 2'), S('hearth-cold', '--subject decor:B --frames 12 --every 4'), S('lamp', '--subject decor:T --frames 16 --every 3'), S('crystal', '--subject decor:+ --frames 16 --every 3'),
  S('puffcap-bounce', '--subject tile:% --scenario bounce --frames 16 --every 2'),
  S('pickup-petal', '--subject pickup:H --frames 16 --every 3'), S('pickup-heartwood', '--subject pickup:S --frames 16 --every 3'), S('pickup-gift', '--subject pickup:1 --frames 16 --every 3'), S('pickup-heart', '--subject pickup:* --frames 16 --every 3'),
];
let ok = 0, failed = [];
for (const s of STRIPS) {
  if (filter && !s.name.includes(filter)) continue;
  const args = s.args.match(/(?:[^\s"]+|"[^"]*")+/g).map((a) => a.replace(/^"|"$/g, ''));
  const r = spawnSync('node', [path.join(__dirname, 'filmstrip.js'), ...args, '--out', path.join(outDir, s.name + '.png')], { encoding: 'utf8', timeout: 120000 });
  if (r.status === 0) { ok++; process.stdout.write(`ok   ${s.name}\n`); } else { failed.push(s.name); process.stdout.write(`FAIL ${s.name}: ${(r.stderr || r.stdout).trim().split('\n').pop()}\n`); }
}
console.log(`${ok} strips in ${outDir}${failed.length ? `, failed: ${failed.join(', ')}` : ''}`);
if (failed.length) process.exit(1);
