# Sprite generation prompts

None of these PNGs ship by default — the game runs entirely on its
procedural canvas fallback until a file listed below actually exists at the
given path. Generate each with an external image-gen tool (Midjourney,
DALL·E, SDXL, etc.), export as a **transparent-background PNG**, and save it
at the exact path shown. Drop in as many or as few as you like — every
sprite slot degrades independently back to the procedural look when its file
is missing.

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

| # | Subject + sizing | Save as |
|---|---|---|
| 1 | Fused bicycle+rider, facing/riding right, mid-pedal pose, one arm to the handlebar, torso leaning forward. Blue frame, rider in cap + jacket. Canvas 320×260px. **Leave the wheels out** — two transparent ~64px circular gaps centered at (110,200) and (210,200), since wheels are animated separately underneath. | `player/bike-rider.png` |
| 2 | Bicycle wheel, side view, dark tire, lighter rim, even spoke pattern (no unique landmark — it rotates every frame). Canvas 80×80px, wheel centered at (40,40), radius ~34px. | `player/wheel-front.png` |
| 3 | Same brief as #2 (reuse the same image, or add a faint rear-gear hint for variety). Canvas 80×80px, centered at (40,40), radius ~34px. | `player/wheel-back.png` |

## Woods

| # | Subject + sizing | Save as |
|---|---|---|
| 4 | Conifer/pine tree, tall narrow silhouette, 2-3 stacked green tiers, short brown trunk sliver. Canvas 140×220px, bottom-center anchored (trunk base at x=70,y=214). | `woods/pine-tree.png` |
| 5 | Fallen mossy log, horizontal, visible end rings, 1-2 moss patches. Canvas 110×60px, centered. | `woods/fallen-log.png` |

## Beach

| # | Subject + sizing | Save as |
|---|---|---|
| 6 | Curved palm tree, bent tan trunk, fan of 5-6 green fronds. Canvas 150×230px, bottom-center anchored (trunk base at x=75,y=224). | `beach/palm-tree.png` |
| 7 | Bleached driftwood, gnarled branch shape, tiny shell detail. Canvas 110×50px, centered. | `beach/driftwood.png` |
| 8 *(optional)* | Closed beach umbrella on a simple pole stand, striped fabric. Canvas 110×150px, bottom-center anchored. | `beach/beach-umbrella.png` |

## Mountains

| # | Subject + sizing | Save as |
|---|---|---|
| 9 | Bare dead tree, grey-brown gnarled branches, no leaves, windswept lean. Canvas 130×210px, bottom-center anchored (base at x=65,y=204). | `mountains/dead-tree.png` |
| 10 | Large angular grey boulder, a few flat facets, optional thin snow cap. Canvas 110×90px, centered. | `mountains/boulder.png` |
| 11 *(optional)* | Low irregular patch of pale snow, flat and ground-hugging. Canvas 100×36px, centered. | `mountains/snow-patch.png` |

## Fields

| # | Subject + sizing | Save as |
|---|---|---|
| 12 | Rolled hay bale, side view (oval + 2 horizontal binding lines), gold/straw color. Canvas 90×90px, centered. | `fields/hay-bale.png` |
| 13 | Small wildflower clump, a few green stems, 4-5 simple colorful flower dots. Canvas 70×70px, bottom-weighted (base near x=35,y=60). | `fields/wildflower-clump.png` |
| 14 *(optional)* | Weathered wooden fence post, 1-2 short horizontal rail stubs. Canvas 40×100px, bottom-center anchored. | `fields/fence-post.png` |

## Notes on sizing

- **Trees/tall objects** are drawn bottom-anchored and scaled so the drawn
  height matches the in-game tree's world height — the canvas pixel height
  given above is what the code scales *from*, so hitting it closely keeps
  proportions (trunk width vs. foliage) looking right at all scales, but
  isn't strict — the code reads each image's actual dimensions at runtime.
- **Clutter (logs, driftwood, boulders, hay bales, flowers, posts, snow
  patches)** are drawn center-anchored and scaled off their pixel *width* as
  a stand-in diameter.
- 11 sprites are required to cover every biome with at least 2 pieces of
  clutter; the 3 marked *(optional)* round each biome out to 3-4 pieces.
