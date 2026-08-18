# Sprite generation prompts

None of these PNGs ship by default — the game runs entirely on its
procedural canvas fallback until a file listed below actually exists at the
given path. Generate each with an external image-gen tool (Midjourney,
DALL·E, SDXL, etc.), export on a **plain solid white background** (see
below — not transparency), and save it at the exact path shown. Drop in as
many or as few as you like — every sprite slot degrades independently back
to the procedural look when its file is missing.

## Background: solid white, not transparency

Earlier rounds asked the image-gen tool for a transparent background and it
never reliably delivered one — one export had no alpha channel at all (a
checkerboard *pattern* baked into opaque pixels, not real transparency),
another had an alpha channel but every pixel set fully opaque over a
flattened white background. Both showed up in-game as a solid grey/white box
behind the character instead of blending into the sky.

Asking for transparency and hoping the tool did it right isn't reliable.
Instead: **ask for a plain solid white background**, then let
`tools/build_player_sprites.py` / `tools/build_bike_frame.py` strip it in
post — both already flood-fill transparency inward from the image border by
sampling the corner color (see `remove_background()` in either script), so a
clean flat white background is exactly what they're built to remove, and
it's a much more consistent ask for an image-gen tool than "transparent PNG."
No prompt below should mention transparency — say "plain solid white
background" instead.

## Style anchor

Prepend this verbatim to every prompt below, so a human running them
independently gets a stylistically matching set:

> Flat vector game-art illustration, side-view (profile) orthographic, on a
> plain solid white background (no scenery, no ground shadow). Bold clean
> 2–3px dark outline around every shape. Flat, lightly cel-shaded fills using
> only 3–4 flat colors per object plus outline — no gradients, no
> photographic texture, no soft airbrushing. Simple, slightly rounded,
> chunky geometric shapes that read clearly at small size, in the style of a
> cheerful stylized arcade bike-trials game. Warm, soft directional lighting
> from the upper-left suggested only by one shade-tone shift per shape, not
> by gradients.

## Player (required for the sprite bike+rider to appear at all)

Generate a short **video**, not a static sheet: a locked-off, static-camera,
side-view clip of the bike+rider pedaling in place for a few seconds, plain
solid white/light background, no camera pan/zoom/drift. `tools/build_player_rig.py`
pulls evenly-spaced frames covering one full pedal rotation out of it and
turns them into the game's rig sprites - one **fused** whole bike+rider+legs
image per pedal-angle bucket (`player/rig-0.png` … `rig-N.png`), rather than
separate frame/torso/legs pieces layered at runtime.

This replaced an earlier approach that generated legs/torso/frame as
independent still images (a sheet of leg poses, a sheet of torso poses, a
separate bike-frame reference) and layered them at runtime with hand-tuned
anchor offsets. That's exactly what caused the proportion/registration
mismatches worked around in `js/drawbike.js` for a while: every independent
generation is a fresh roll with no guarantee it agrees with its neighbors on
scale or reach. A video generation holds the character/bike consistent
across frames far better, since it's one continuous generation instead of
many - and since this game's `pedal_angle` and `wheel_angle` are the same
value (`computeRig()` in `js/drawbike.js`), each frame's baked-in wheel
position is automatically correct for its bucket too, so no separate
rotating wheel sprite is needed either. `tools/build_player_sprites.py` and
`tools/build_bike_frame.py` still exist for that older piecewise approach if
ever needed again, but the video → fused-rig pipeline is the current one.

**Picking which frames to use:** the clip needs a genuinely locked-off
camera and one clean, evenly-paced pedal-stroke loop - `build_player_rig.py`
shares a single scale/anchor across every frame you give it (unlike the
per-frame independent measurement the old pipeline did), so it depends on
the source staying put more than that older approach did. A clip that jumps,
lands, or pans partway through is still fine as long as you only pick frames
from the stable, cleanly-looping span - `build_player_rig.py` warns if the
frames you picked don't actually share a consistent wheelbase. To find that
span and the loop period: crop each candidate frame to the crank/pedal area
and compare pixel-wise to frame 0 - the lowest-error non-trivial match is one
full revolution later, and evenly-spaced frames between there and frame 0
are your pose set.

**Headlight:** the game's night-riding headlight cone (`drawHeadlight()` in
`js/drawbike.js`) isn't currently wired up to any rig art - it was dropped
when this BMX-style reference didn't have an obvious mount point for one. If
a future reference clip has a light built into the design (helmet lamp,
handlebar-mounted light), pixel-measure its position the same way the old
`HEADLIGHT_X/Y` constants were measured off `frame.png`, then wire
`drawHeadlight()` back into `js/render/playerSprite.js`'s `drawPlayer()`.

Run: `uv run tools/build_player_rig.py <clip.mp4> version_2/assets/sprites/player --frames 0,4,7,11,14,18`
(see the script's own docstring for exactly what each step does, and for how
`--frames` and the frame count interact with
`PLAYER_RIG_FRAME_COUNT` in `js/render/spriteManifest.js`).

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
| 12 | Low irregular patch of pale snow, flat and ground-hugging. Canvas 100×36px, centered. | `mountains/snow-patch.png` |

## Fields

| # | Subject + sizing | Save as |
|---|---|---|
| 13 | Rolled hay bale, side view (oval + 2 horizontal binding lines), gold/straw color. Canvas 90×90px, centered. | `fields/hay-bale.png` |
| 14 | Small wildflower clump, a few green stems, 4-5 simple colorful flower dots. Canvas 70×70px, bottom-weighted (base near x=35,y=60). | `fields/wildflower-clump.png` |
| 15 | Weathered wooden fence post, 1-2 short horizontal rail stubs. Canvas 40×100px, bottom-center anchored. | `fields/fence-post.png` |

## Notes on sizing

- **Trees/tall objects** are drawn bottom-anchored and scaled so the drawn
  height matches the in-game tree's world height — the canvas pixel height
  given above is what the code scales *from*, so hitting it closely keeps
  proportions (trunk width vs. foliage) looking right at all scales, but
  isn't strict — the code reads each image's actual dimensions at runtime.
- **Clutter (logs, driftwood, boulders, hay bales, flowers, posts, snow
  patches)** are drawn center-anchored and scaled off their pixel *width* as
  a stand-in diameter.
- **Leg/torso frames**: `build_player_sprites.py` auto-detects each frame's
  hip anchor and normalizes every frame in a group onto a shared canvas so
  they all land on the same anchor point — exact pixel dimensions aren't
  critical, but keeping the hip at roughly the same relative spot across
  every pose in a row is what keeps the pedaling/sway from visibly jumping
  frame to frame.
- 14 sprite groups (11 world + player frame/legs/torso/wheels) are required
  to cover every biome and get the player fully animated; the items marked
  *(optional)* round each biome out to 3-4 pieces.
