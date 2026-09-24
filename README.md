# Glimmerdeep

*A light in the hollow.* A small, complete metroidvania in the spirit of **Hollow Knight** and **Ori and the Blind Forest**, written in vanilla JavaScript on an HTML5 canvas. No build step, no dependencies, no assets to download: every tile, creature, sound and song is generated in code.

You play **Mote**, the last spark of light in a cave system that is going dark. Find the old shrines, earn their movement gifts, open the ways they unlock, and climb the Ashen Spire to wake — and unmake — the Warden.

## Play

Open `index.html` in any modern browser, or serve the folder:

```
npm start            # http://localhost:8080  (uses npx serve)
python3 -m http.server 8080
```

The game saves automatically to `localStorage` whenever you rest at a bench, pick something up or break a wall. "Continue" on the title screen resumes your journey.

### Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | Arrows / WASD | Left stick / D-pad |
| Jump (hold for height) | Z / Space / K | A |
| Slash (Up + slash = upward, Down + slash in air = pogo) | X / J | X |
| Dash *(once earned)* | C / Shift / L | B / RB |
| Focus: hold to spend Soul and heal | V / E / Q | Y |
| Talk / read / rest | Up near a friend, stone or bench | Up |
| Drop through a ledge | Down + Jump | Down + A |
| Map | M / Tab | Back |
| Pause | Esc / P | Start |

### How it plays

- **Combat that builds Soul.** Every hit fills the vessel in the top-left. Stand still and hold Focus to spend a third of it on one point of health.
- **Pogo everything.** Down-slash in the air bounces you off enemies, projectiles and spike beds. Some secrets are only reachable that way.
- **Three gifts, three gates.** Mossgrove hides the **Dash** (cross chasms, shatter cracked walls). The Sunken Depths hold **Clinging Will** (wall slide and wall jump). The Crystal Heights keep **Twin Wings** (double jump). Crystal is too smooth to cling to, so some ledges truly need wings.
- **Benches** restore your light, set your respawn and respawn the world's creatures, as they should.
- **Six Life Shards** are hidden across five areas, each one permanently extending your health.
- **The Warden** waits at the top of the Ashen Spire: two phases, charges, leaps, spit and summoned beetles. Bounce off its back.

## The world

```
Crystal Heights  ─────  Heights Bridge ─── Ashen Spire (boss)
      │ (wall-jump shaft)
   The Hollow (start) ─── Mossgrove (dash)
      │ (dash wall)
   Sunken Depths (wall jump)
```

## Development

Everything lives in `src/`:

| File | Role |
| --- | --- |
| `mapdata.js` | The whole world as ASCII rooms stitched onto solid rock. Edit here to build levels. |
| `world.js` | Tile grid, collision queries, breakable walls, areas. |
| `player.js` | Movement feel: coyote time, jump buffering, apex hang, wall slide, dash, pogo, focus. |
| `entities.js` | Enemies, the boss state machine, projectiles, pickups. |
| `render.js` / `sprites.js` | Procedural autotiling, parallax backgrounds, 2D lighting, all creature art. |
| `audio.js` | Web Audio synth for effects and a generative ambient score per area. |
| `ui.js` | HUD, dialogue, map, menus, title and ending. |
| `game.js` | State machine, fixed-step loop, camera, orchestration. |

Tools and tests (Node 18+; the browser tests need `npm install` and `npx playwright install chromium` once):

```
npm run check    # stitches the map, verifies required entities and connectivity
npm run solve    # physics-accurate reachability search: which pickups each ability set can reach
npm test         # map check + headless smoke test + scripted boss fight
```

The solver simulates the real `player.js` physics with a library of input macros (jumps, dash-jumps, wall climbs, reactive pogo) and reports every shrine, shard, bench and stone as reachable or not. Run it with `--abilities dash,walljump` to confirm gates hold before an ability is earned.

## Level legend

```
#  rock          .  air          ^  spikes        ~  void water
=  one-way ledge D  cracked wall I  smooth crystal (no wall-cling)
B  bench         H  life shard   1  dash   2  wall jump   3  double jump   *  heart
e  beetle        f  moth         s  spore bulb   c  husk ram   g  ash shade
P  start         X  boss         G  boss gate    L  lore stone   N  elder   T  torch   +  crystal light
```
