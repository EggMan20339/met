# Glimmerdeep

*A spark against the hush.* A complete metroidvania in vanilla JavaScript on an HTML5 canvas: no build step, no dependencies, no downloaded assets. The cave walls, lighting, sound effects and music are generated in code; the characters, creatures, bosses, props and painted backgrounds are original vector illustrations (see [Artwork](#artwork)), all drawn at your screen's native resolution.

Once, light poured down from the Hearthroot, the great sleeping tree, and the lamplighters of the Lanternry carried it into every tunnel of the Glimmerdeep. Then Sorrel, first of the lamplighters, grew afraid of the dark, built a lantern big enough to hold all the light at once, and climbed with it into the Cinderthroat. What remained was the hush: a quiet that eats warmth, and the things it leaves behind. You are **Mote**, the last spark Wick could coax from the embers.

## Play

Open `index.html` in any modern browser, or serve the folder:

```
npm start            # http://localhost:8080  (uses npx serve)
python3 -m http.server 8080
```

The game saves to `localStorage` whenever you rest at a hearth, pick something up, break a wall or fell a boss. "Continue" on the title screen resumes your journey; "New Game" plays the intro.

### Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | Arrows / WASD | Left stick / D-pad |
| Jump (hold for height) | Z / Space / K | A |
| Strike (Up + strike = upward, Down + strike in air = bounce) | X / J | X |
| Windstep *(once earned)* | C / Shift / L | B / RB |
| Cinder: tap to throw an ember bolt *(once earned)* | V / E / Q | Y |
| Rekindle: hold to spend ember and regrow a petal | V / E / Q | Y |
| Talk / read / rest | Up near a friend, waystone or hearth | Up |
| Drop through a ledge | Down + Jump | Down + A |
| Map | M / Tab | Back |
| Pause | Esc / P | Start |

### How it plays

- **Petals and ember.** Your health is the glowbloom: each petal is one hit. Striking foes fills the ember lantern. Hold Rekindle while standing still to spend ember on a new petal; it is twice as fast beside a hearth, a lamp or a chime crystal. A **full lantern flares** instead of losing a petal, throwing nearby foes back.
- **Cinder.** Tap the rekindle key to hurl a burning bolt for two damage. It is the only thing that pierces an emberback's shell head-on.
- **Bounce everything.** Down-strike in the air bounces you off enemies, projectiles, thorn beds and puffcaps. Some secrets are only reachable that way.
- **Four gifts.** Cinder waits in the Ember Cradle beside the start. **Windstep** (dash, breaks cracked stone) is guarded by Gulletroot beneath Fernwake. **Rootgrip** (wall slide and wall jump) lies under the Drowned Bell in the Drownwell. **Skyleaf** (double jump) rings at the far end of Chimeglass Reach. Chimeglass is too smooth to grip, so some ledges truly need wings.
- **Heartwood.** Two pieces, one in Bramblehush and one in the Puffcap Warrens. Bring both to Old Bramble and your splinter strikes for two.
- **Hearths** restore every petal, set your respawn and wake the deep's creatures again.
- **Seven glowbloom petals** are hidden across eight areas; each permanently extends your health. Find them all and carve the splinter for the fuller ending.
- **Three bosses and a wandering husk.** Gulletroot (thorns, lashes, seeds, burrowing), the Drowned Bell (tolls, slams, rain), and the Lightless at the top of the Cinderthroat (charges, leaps, spit, blinks and a lantern beam across the arena). Two Lampwright Husks patrol Bramblehush and the Lanternry.

## The world

```
Chimeglass Reach ── Chime Bridge ── The Lanternry ── Cinderthroat (the Lightless)
        │ (Rootgrip shaft)
Bramblehush ── Ember Cradle ── Rootshade (start) ── Fernwake ── Fernwake Maw (Gulletroot)
                                    │ (cracked stone)                    │ (drop)
                              The Drownwell ── Bell Chamber (the Drowned Bell) ── Puffcap Warrens
```

Cast: Wick the ember-keeper (Rootshade), Old Bramble the splinter-carver (Bramblehush), the Bell Ringer (Drownwell), Tallow the cartographer (the Lanternry). Waystones across the deep tell the rest.

## Artwork

Everything you see that is not rock is an original illustration in the game's own "Emberline" style: inky creatures each carrying one dimmed or stolen light, a luminous Mote with ember-leaf ears, three bosses, four friends, every pickup and prop, and two painted parallax layers per area. The style guide is `art/STYLE.md`.

- `art/*.svg` are the finished pieces (92 of them) and `art/manifest.json` records each one's size and anchor.
- `tools/art/*.js` are the editable sources. Each file is a small template (Mote's thirteen poses come from one pose table, every enemy from one function per creature) built on the helpers in `tools/art/lib.js`.
- `src/artdata.js` is generated: the SVGs embedded as strings so the game works from `file://` with no loading of separate files. Do not edit it by hand.
- `src/art.js` rasterises each illustration once per zoom level into an offscreen canvas and draws it in world units, so the art is as sharp at 4K as at 720p. Until the images have decoded (a few frames) every drawing routine falls back to its older procedural version, so nothing depends on the art being present.

To change a piece, edit its template and regenerate:

```
node tools/make-art.js      # tools/art/*.js  ->  art/*.svg + art/manifest.json
node tools/bundle-art.js    # art/*.svg       ->  src/artdata.js
```

`tools/art-sheet.html` (open it from a local server, `?scale=4` to enlarge) shows every asset on one contact sheet.

## Development

Everything lives in `src/`:

| File | Role |
| --- | --- |
| `mapdata.js` | The whole world as ASCII rooms stitched onto solid rock, plus areas, camera locks and boss arenas. Edit here to build levels. |
| `world.js` | Tile grid, collision queries, breakable walls, gates, areas. |
| `player.js` | Movement feel: coyote time, input buffering, apex hang, wall slide, dash, bounce, rekindle, cinder, flare. |
| `entities.js` | Nine enemy types, three boss state machines, projectiles, pickups. |
| `render.js` | Organic vector terrain (traced outlines with rounded, jittered edges), per-area texture and rims, the painted parallax backgrounds, half-resolution lighting. |
| `art.js` / `artdata.js` | The illustration loader and rasteriser, and the generated bundle of every SVG (see [Artwork](#artwork)). |
| `sprites.js` | Chooses and draws the illustrated pose for the player, creatures, bosses, friends, pickups and props; keeps the procedural drawings as fallbacks. |
| `audio.js` | Web Audio synth for effects and a generative ambient score per area. |
| `ui.js` | Petal and lantern HUD, dialogue, boss cards, map, menus, intro and endings. |
| `game.js` | State machine, fixed-step loop, camera, story flags, boss orchestration. |

Tools and tests (Node 18+; the browser tests need `npm install` and `npx playwright install chromium` once):

```
npm run check    # stitches the map, verifies required entities and connectivity, lists sealed pockets
npm run solve    # physics-accurate reachability search: which pickups each ability set can reach
npm test         # map check + headless smoke test + combat test + scripted fights against all bosses
```

The solver simulates the real `player.js` physics with a library of input macros (jumps, dash-jumps, wall climbs, reactive bounces) and reports every shrine, petal, hearth and waystone as reachable or not. Run it with `--abilities dash,walljump` to confirm gates hold before a gift is earned.

## Level legend

```
#  rock          .  air          ^  thorns        ~  dark water     %  puffcap (bounces you)
=  one-way ledge D  cracked wall I  chimeglass (no grip)            G  boss gate
B  hearth        H  petal        S  heartwood     *  the Great Lantern's heart
1  Windstep      2  Rootgrip     3  Skyleaf       4  Cinder
e  dimling       f  hushmoth     s  sporeling     c  rootram        g  snuffer
a  emberback     r  gloamwing    j  springfoot    k  lampwright husk
Y  Gulletroot    Z  Drowned Bell X  the Lightless
P  start  L  waystone  N  Wick  W  Old Bramble  Q  Tallow  K  Bell Ringer  T  lamp  +  chime crystal  h  house
```
