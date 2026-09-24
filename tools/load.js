// Loads the DOM-free game sources into a shared vm context for node tools.
const fs = require('fs'); const path = require('path'); const vm = require('vm');
function loadGameContext() {
  const ctx = { console, Math, Set, Map, Array, Uint8Array, Object, String, Number, Error, JSON, setTimeout, clearTimeout, module: {}, require };
  vm.createContext(ctx);
  for (const f of ['util.js', 'mapdata.js', 'world.js', 'player.js', 'entities.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
    vm.runInContext(src, ctx, { filename: f });
  }
  // top-level const/class bindings live in the context's lexical scope; export them explicitly
  return vm.runInContext('({ World, MAP, PHYS, PW, PH, TILE, makePlayer, updatePlayer, attackHitbox, hurtPlayer, pogo, pCenter, makeEnemy, updateEnemy, damageEnemy, makeBoss, updateBoss, damageBoss, updateProjectile, ENEMY_CHARS, PICKUP_CHARS })', ctx);
}
module.exports = { loadGameContext };
