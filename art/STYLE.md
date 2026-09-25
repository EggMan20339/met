# Glimmerdeep art guide — "Emberline"

Original artwork for Glimmerdeep. Every asset in this folder is a hand-designed vector illustration
(generated from the templates in `tools/art/`, which are the editable source). The game rasterises
these SVGs at the current zoom, so they stay crisp at any resolution.

## The look
- **Ink and ember.** Creatures of the hush are inky silhouettes (`#1a1526`, `#2a2238`) with one warm
  or cold light source inside them: a dim lantern, a burning crack, a candle-flame eye. Light is the
  story, so every character carries some.
- **Rounded, chunky silhouettes** that read at 32–64 screen pixels. No thin limbs without a thick body.
- **One rim light**, upper-left, a lighter tone of the body colour. **One shadow**, lower-right, an
  ink tone at ~35% opacity. Nothing else models the form; the game's lighting does the rest.
- **Eyes are large.** Mote's are dark with a single glint. Hushed creatures have glowing eyes with no
  pupil, the same colour as their inner light.
- **Line work** is a darker tone of the fill at 1.2 px, only on the outer silhouette, never inside.
- **Backgrounds** are painted flats: two parallax layers per area, big soft shapes, the area's fog
  colour, no outlines. They tile horizontally at 1024 px.

## Palette anchors
| use | colour |
| --- | --- |
| ink | `#1a1526` |
| ink light | `#2a2238` |
| Mote body | `#fff7e8` → `#d8ccff` |
| Mote ember | `#ffb347` |
| dim lantern glass | `#ffd27a` at 45% |
| hush glow (cold) | `#7fd7ff` |
| root / bark | `#4a2f1e` / `#8a5a34` |
| fern green | `#8fd45a` |
| chimeglass | `#c9a0ff` / `#e6d3ff` |
| cinder | `#ff6a2a` |

## Assets
`tools/make-art.js` writes every `.svg` here plus `manifest.json` (size and anchor of each sprite);
`tools/bundle-art.js` embeds them into `src/artdata.js` so the game also works from `file://`.
Edit a template, then run `node tools/make-art.js && node tools/bundle-art.js`.
