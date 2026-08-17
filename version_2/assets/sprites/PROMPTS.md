# Sprite generation prompts

None of these PNGs ship by default — the game runs entirely on its
procedural canvas fallback until a file listed below actually exists at the
given path. Generate each with an external image-gen tool (Midjourney,
DALL·E, SDXL, etc.), export as a **transparent-background PNG**, and save it
at the exact path shown. Drop in as many or as few as you like — every
sprite slot degrades independently back to the procedural look when its file
is missing.

## ⚠️ Real transparency, not a white/checkerboard background

Two rounds of the player sprite came back looking transparent but weren't:
one had no alpha channel at all (a checkerboard pattern baked into opaque
pixels), the other had an alpha channel but every pixel was set to fully
opaque over a flattened white background. Both show up in-game as a solid
grey or white box behind the character instead of blending into the sky.

Before saving a file, check it actually has per-pixel transparency — the
background must read as *see-through*, not just "looks checkered/white in
my preview." If your tool has an explicit "remove background" step
(separate from just "export as PNG"), use it. A quick sanity check: open the
PNG over a brightly colored background in an image viewer/editor — if you
still see a white or checkered box around the subject, it's not
transparent yet.

## Style anchor

Prepend this verbatim to every prompt below, so a human running them
independently gets a stylistically matching set:

> Flat vector game-art illustration, side-view (profile) orthographic,
> isolated on a fully transparent background (PNG). Bold clean 2–3px dark
> outline around every shape. Flat, lightly cel-shaded fills using only 3–4
> flat colors per object plus outline — no gradients, no photographic
> texture, no soft airbrushing, no background scenery, no ground shadow
> baked in. Simple, slightly rounded, chunky geometric shapes that read
> clearly at small size, in the style of a cheerful stylized arcade
> bike-trials game. Warm, soft directional lighting from the upper-left
> suggested only by one shade-tone shift per shape, not by gradients.

## Player (required for the sprite bike+rider to appear at all)

Legs pedal in a circle, so — unlike the wheels, which can just be one image
rotated every frame — a single static leg pose would look frozen mid-stroke
while the wheels spin under it. The body sprite below leaves legs out
entirely; a separate 8-frame leg cycle (one pose per 45° of pedal rotation)
is layered on top of it and swapped frame-to-frame in sync with the wheels.

| # | Subject + sizing | Save as |
|---|---|---|
| 1 | Fused bicycle+rider, facing/riding right, torso leaning forward, one arm reaching to the handlebar. Blue frame, rider in cap + jacket. **No legs and no wheels** — leave the leg/hip area of the jacket ending at the seat, and leave two transparent ~64px circular gaps centered at (110,200) and (210,200) for the wheels. Canvas 320×260px. | `player/bike-rider.png` |
| 2 | A single sprite sheet: the same rider's near-side leg only (upper leg, lower leg, foot/shoe — matching the pants/shoe colors from #1), **no bike frame, no torso, no arm**, isolated on transparent background, repeated 8 times side by side in one horizontal strip. Each of the 8 poses shows the knee bent naturally with the foot at a different point around the pedal's circular path, evenly spaced one per 45° (e.g. picture a clock face for the foot position: 12 o'clock, 1:30, 3, 4:30, 6, 7:30, 9, 10:30). Each cell is its own fixed 140×160px frame, with the hip joint (top of the leg) at the same local position in every cell: x=70, y=24 from that cell's top-left corner. | `player/legs-0.png` … `player/legs-7.png` (one file per pose, in clock order — split the strip into 8 equal-width crops) |
| 3 | Bicycle wheel, side view, dark tire, lighter rim, even spoke pattern (no unique landmark — it rotates every frame). Canvas 80×80px, wheel centered at (40,40), radius ~34px. | `player/wheel-front.png` |
| 4 | Same brief as #3 (reuse the same image, or add a faint rear-gear hint for variety). Canvas 80×80px, centered at (40,40), radius ~34px. | `player/wheel-back.png` |

## Woods

| # | Subject + sizing | Save as |
|---|---|---|
| 5 | Conifer/pine tree, tall narrow silhouette, 2-3 stacked green tiers, short brown trunk sliver. Canvas 140×220px, bottom-center anchored (trunk base at x=70,y=214). | `woods/pine-tree.png` |
| 6 | Fallen mossy log, horizontal, visible end rings, 1-2 moss patches. Canvas 110×60px, centered. | `woods/fallen-log.png` |

## Beach

| # | Subject + sizing | Save as |
|---|---|---|
| 7 | Curved palm tree, bent tan trunk, fan of 5-6 green fronds. Canvas 150×230px, bottom-center anchored (trunk base at x=75,y=224). | `beach/palm-tree.png` |
| 8 | Bleached driftwood, gnarled branch shape, tiny shell detail. Canvas 110×50px, centered. | `beach/driftwood.png` |
| 9 *(optional)* | Closed beach umbrella on a simple pole stand, striped fabric. Canvas 110×150px, bottom-center anchored. | `beach/beach-umbrella.png` |

## Mountains

| # | Subject + sizing | Save as |
|---|---|---|
| 10 | Bare dead tree, grey-brown gnarled branches, no leaves, windswept lean. Canvas 130×210px, bottom-center anchored (base at x=65,y=204). | `mountains/dead-tree.png` |
| 11 | Large angular grey boulder, a few flat facets, optional thin snow cap. Canvas 110×90px, centered. | `mountains/boulder.png` |
| 12 *(optional)* | Low irregular patch of pale snow, flat and ground-hugging. Canvas 100×36px, centered. | `mountains/snow-patch.png` |

## Fields

| # | Subject + sizing | Save as |
|---|---|---|
| 13 | Rolled hay bale, side view (oval + 2 horizontal binding lines), gold/straw color. Canvas 90×90px, centered. | `fields/hay-bale.png` |
| 14 | Small wildflower clump, a few green stems, 4-5 simple colorful flower dots. Canvas 70×70px, bottom-weighted (base near x=35,y=60). | `fields/wildflower-clump.png` |
| 15 *(optional)* | Weathered wooden fence post, 1-2 short horizontal rail stubs. Canvas 40×100px, bottom-center anchored. | `fields/fence-post.png` |

## Notes on sizing

- **Trees/tall objects** are drawn bottom-anchored and scaled so the drawn
  height matches the in-game tree's world height — the canvas pixel height
  given above is what the code scales *from*, so hitting it closely keeps
  proportions (trunk width vs. foliage) looking right at all scales, but
  isn't strict — the code reads each image's actual dimensions at runtime.
- **Clutter (logs, driftwood, boulders, hay bales, flowers, posts, snow
  patches)** are drawn center-anchored and scaled off their pixel *width* as
  a stand-in diameter.
- **Leg frames** are drawn at a fixed 140×160px box with the hip anchor at
  (70,24), same idea as the body/wheels: the code stretches whatever you
  give it to that box, so exact pixel dimensions aren't critical, but
  keeping the hip at roughly the same relative spot across all 8 frames is
  what keeps the pedaling from visibly jumping around frame to frame.
- 14 sprites (11 world + 3 player pieces, the legs counting as one
  8-pose set) are required to cover every biome and get the player fully
  animated; the 3 marked *(optional)* round each biome out to 3-4 pieces.
