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

**Headlight:** the game's night-riding headlamp (`drawHeadlight()` in
`js/render/headlight.js`) is a purely geometric overlay - a beam cone plus a
diffuse pool of light on the ground ahead - anchored at the rig's
approximate handlebar position (`computeRig()`'s `handlebar_x/y`) rather
than any pixel measured off the art. It does **not** need a drawn mount
point in the rig reference to work, so no art changes are required for it;
if a future reference clip does add one anyway (helmet lamp, handlebar-
mounted light), the anchor in `headlight.js` can be retuned to match it, but
that's a nice-to-have, not a requirement.

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

## Animals

Foreground silhouettes glimpsed in the space below the rideable path
(`js/world/animals.js`, `AnimalField`) - purely decorative depth accents
that never affect the bike (no collision, no scoring), drawn under their own
parallax factor so they read as a shallow plane nearer than the main
playfield rather than glued to it. Bottom-anchored like Trees (feet/base at
the canvas bottom-center), one subject per prompt like the biome tables
above, not a contact sheet - each is a genuinely different animal, not style
variants of the same one, unlike Woods/Beach/Mountains/Fields' clutter.

### Fields

| # | Subject + sizing | Save as |
|---|---|---|
| 22 | Sitting/alert rabbit, simple rounded body, upright ears. Canvas 50×60px, bottom-center anchored. | `fields/rabbit-N.png` |
| 23 | Grazing sheep, side view, woolly rounded body, short legs. Canvas 90×70px, bottom-center anchored. | `fields/sheep-N.png` |

### Woods

| # | Subject + sizing | Save as |
|---|---|---|
| 24 | Standing deer, side view, slender legs, small antlers. Canvas 100×110px, bottom-center anchored. | `woods/deer-N.png` |
| 25 | Fox, side view, bushy tail, alert pose. Canvas 80×60px, bottom-center anchored. | `woods/fox-N.png` |

### Beach

| # | Subject + sizing | Save as |
|---|---|---|
| 26 | Standing seagull, side view, folded wings. Canvas 60×70px, bottom-center anchored. | `beach/seagull-N.png` |
| 27 | Crab, side view, claws visible. Canvas 60×40px, bottom-center anchored. | `beach/crab-N.png` |

### Mountains

| # | Subject + sizing | Save as |
|---|---|---|
| 28 | Mountain goat, side view, sturdy legs, small horns. Canvas 90×90px, bottom-center anchored. | `mountains/goat-N.png` |
| 29 | Marmot, side view, low rounded body. Canvas 60×40px, bottom-center anchored. | `mountains/marmot-N.png` |

Save 3-4 numbered variants per species (`rabbit-0.png`, `rabbit-1.png`, …),
matching the smaller existing biome counts - `js/render/spriteManifest.js`'s
`BIOME_ANIMAL_SPECIES` already expects that many for each (see its
`heightMin`/`heightRange` per species for the in-game world-unit size each
should read as).

## Hazards

Ground obstacles from `js/world/hazards.js` that crash the bike on contact -
unlike the biome scenery above, these aren't decorative, so silhouette
readability at speed matters more than any one design.

**Wall: done.** `tools/build_barricade_sprites.py` slices every
`assets/sprites/barricades/*.png` sheet into `hazards/wall-0.png` …
`wall-35.png`: 30 from `more_variations.png`'s grid (wood/rope, stone/wheel,
and icy-mountain barricade designs mixed together) plus 6 higher-detail
"hero" takes on some of those same designs from `beach.png`/`forest.png`/
`mountain.png` (each a captioned 2-up showcase sheet - the tool's second
pass strips the captions by component height, no row/column bookkeeping
needed since there's just one big illustration per side). All 36 land in
one pool, wired in as `HAZARD_WALL_SPRITES` in `js/render/spriteManifest.js`
and picked at random per instance the same way Rock/Tree pick a biome
clutter sprite - style variety doesn't hurt readability here since every
design already reads as "obstacle" on sight, unlike a single hazard that
needs one fixed, learnable silhouette. If more wall variety ever gets
added, drop another same-shape sheet next to its siblings in `barricades/`
and extend the tool rather than hand-slicing it.

**Puddle: done.** `tools/build_puddle_sprites.py` slices
`hazards/puddles.png` (a clean 3x4 grid, no captions, one puddle style per
cell) into `hazards/puddle-0.png` … `puddle-11.png`, wired in as
`HAZARD_PUDDLE_SPRITES` and picked at random per instance, same treatment
as wall above - a dozen water/mud/tar colorways all still read as "puddle"
on sight, so style variety doesn't cost readability here either. Placement
is also restricted to spots the terrain shape says water would actually
collect (`isPoolingSpot()` in `js/world/hazards.js` - flat ground that
isn't a hilltop crest), not just anywhere flat.

## Sky

The sun, moon, and clouds are drawn procedurally in `js/render/sky.js` -
screen-space overlays (fixed on-screen size, not scaled by world distance
like the biome scenery above). Unlike Woods/Beach/Mountains/Fields' tables
above (written before it became clear image-gen tools deliver a labeled
contact sheet of variants more reliably than one clean file per request),
the Sun and Clouds rows below ask for that contact-sheet form directly:
one sheet per category, plain solid white background, several variants
side by side in the exact left-to-right order noted, sliced afterward the
same way `tools/build_scenery_sprites.py` already handles the biome sheets
- add a `SHEETS` entry there for each row once the art exists (row order
already matches the index order needed, since the script's row-detection
just reads variants left to right within a band). The Moon row instead
uses the Player rig's video approach (see below) - already done, wired
into `js/render/sky.js`, and `sky/moon/moon-0.png` … `moon-7.png` exist.

Sun and moon variants are **sequential states**, not random style
choices - whatever wires the sliced sprites in should pick by time-of-day
/ lunar-phase index (the way `player.rig0..rig5` are picked by pedal-angle
bucket), not at random like a tree or rock. Cloud (and Bird, below) variants
ARE random style choices, same as the biome clutter above.

### Sun

**Done, but the 12 delivered variants aren't a clean color gradient** - the
sheet that actually landed (`sky/sun/spritesheet.png`, sliced into
`sun-0.png`…`sun-11.png`) is a grab-bag: about six warm gold/orange/red
tones, two pale "ghost-white" ones, and four purple/mauve/grey "stormy"
ones, in no particular order. `_drawSun()` (`js/render/sky.js`) crossfades
across a **curated** ordered subset - `SUN_TIME_OF_DAY_FRAMES = [4, 2, 0, 8,
7]` (indices into the 12) - picked by eye to read as a believable warm
dawn→noon→dusk sweep (maroon → red-orange → palest/brightest gold → orange →
dark red). The other 6 indices (3, 5, 6, 9, 10, 11) are unused by that sweep
on purpose, kept in the sprite pool as candidates for a future special-sky
feature (eclipse for the ghost-whites, storm for the purples/greys) - not
wired to anything yet. If more sun variants ever get generated, prefer ones
that fit cleanly into the existing warm sweep (or extend it) over more
grab-bag moods; if the curated indices get retuned, update the comment above
`SUN_TIME_OF_DAY_FRAMES` in `sky.js` to match.

| # | Subject + sizing | Save as |
|---|---|---|
| 16 | Sun disc with a soft radiating glow, 3 variants left-to-right for time of day, in this order: warm golden-yellow (midday), deeper orange (late afternoon), red-orange (sunrise/sunset). `_drawSun()` currently fills a flat ~60px-diameter circle with a blurred glow - match that proportion. Canvas 160×160px per variant, disc centered, glow allowed to bleed toward the frame edge. | `sky/sun/spritesheet.png` |

### Moon

Done the same way as the Player rig, not as a static contact sheet: generate
a short **video**, not a still image - a locked-off, static-camera clip of a
flat-vector moon disc animating through one full lunar cycle (new → full →
new), plain solid light background, no camera pan/zoom/drift, crater
shading and a lit/unlit split like `_drawMoon()`'s current off-white
(`rgb(245,245,235)`-ish) disc. `tools/build_moon_sprites.py` pulls 8
evenly-spaced frames out of it and turns them into `sky/moon/moon-0.png` …
`moon-7.png`, in this order: new, waxing crescent, first quarter, waxing
gibbous, full, waning gibbous, last quarter, waning crescent - matching
`js/render/sky.js`'s existing `phase` value (0=new, 0.25=first quarter,
0.5=full, 0.75=last quarter), which is already wired to pick between them
by index.

Run: `uv run tools/build_moon_sprites.py <clip.mp4> version_2/assets/sprites/sky/moon --frames <8 comma-separated indices>`
- **Picking `--frames`:** if the cycle runs at an even pace across the
  whole clip (sample every 10th frame first and eyeball it - a real lunar
  cycle animation usually does, since there's no reason for a renderer to
  ease it), 8 evenly-spaced indices across the clip's full frame count land
  close enough to the 8 named phases. See the script's docstring.

### Clouds

`_drawClouds()` currently has three distinct procedural shapes rather than
one generic cloud - generate each as its own sheet of style variants:

| # | Subject + sizing | Save as |
|---|---|---|
| 18 | Puffy cumulus cloud, 4-5 variants, rounded overlapping lobes, flat-shaded white/pale-grey with a slightly darker, flatter underside. Canvas 500×260px per variant, center-anchored, noticeably wider than tall. | `sky/cumulus/spritesheet.png` |
| 19 | Wispy cirrus cloud, 4-5 variants, thin curved streaks/strands, sparse and airy rather than a solid mass. Canvas 500×160px per variant, center-anchored. | `sky/cirrus/spritesheet.png` |
| 20 | Flat stratus cloud band, 4-5 variants, a low horizontal layer with a soft feathered edge. Canvas 600×140px per variant, center-anchored. | `sky/stratus/spritesheet.png` |

### Birds

Screen-space overlay like Sun/Clouds (not scaled by world distance) -
`Sky._drawBirds()` in `js/render/sky.js` drifts a handful of them across the
upper sky and fades them out at night alongside the stars/moon. Contact-
sheet convention like Clouds, and (unlike Sun/Moon) **random per-instance
style pick**, not sequential - each bird instance just grabs one variant for
its lifetime, the same way a cloud instance does. The flapping motion comes
from the procedural fallback's own animated wing shape, not from swapping
sprite frames, so poses can be static.

| # | Subject + sizing | Save as |
|---|---|---|
| 21 | Small flying bird silhouette, side/three-quarter view, wings in a shallow glide pose, 5-6 variants side by side (a mix of species/colors). Canvas 60×40px per variant, center-anchored. | `sky/birds/spritesheet.png` |

## Notes on sizing

- **Trees/tall objects** are drawn bottom-anchored and scaled so the drawn
  height matches the in-game tree's world height — the canvas pixel height
  given above is what the code scales *from*, so hitting it closely keeps
  proportions (trunk width vs. foliage) looking right at all scales, but
  isn't strict — the code reads each image's actual dimensions at runtime.
- **Clutter (logs, driftwood, boulders, hay bales, flowers, posts, snow
  patches)** are drawn center-anchored and scaled off their pixel *width* as
  a stand-in diameter.
- **Hazards** split across both conventions above rather than following
  either one exactly: `hazards/wall-N.png` is bottom-anchored and scaled by
  *height*, same as Trees; `hazards/puddle-N.png` is bottom-anchored (waterline
  at the canvas bottom edge, not centered) but scaled by *width*, same as
  Clutter. The fallen-log clutter sprite doubles as a third hazard skin
  as-is (`js/world/hazards.js`), no separate hazard-specific log art needed.
- **Sky objects (sun, moon, clouds, birds)** are also center-anchored and
  scaled off pixel width like clutter, but against a fixed on-screen target
  size instead of a world-unit one, since they don't move with the camera -
  see the Sun/Moon/Clouds/Birds rows above for the current on-screen size
  each is matching.
- **Animals** are bottom-anchored and scaled by height, same convention as
  Trees - see the Animals section above.
- **Leg/torso frames**: `build_player_sprites.py` auto-detects each frame's
  hip anchor and normalizes every frame in a group onto a shared canvas so
  they all land on the same anchor point — exact pixel dimensions aren't
  critical, but keeping the hip at roughly the same relative spot across
  every pose in a row is what keeps the pedaling/sway from visibly jumping
  frame to frame.
- Counting every category above (biome scenery, animals, hazards, sky, and
  the player rig) is 21 world groups + the player rig, all optional in the
  sense that each degrades independently back to its procedural look when
  missing - none are required just to get the game running, only to get
  sprite art instead of shapes for that particular piece.
