// Central list of every sprite the game knows how to use, and where its
// PNG lives. None of these files ship by default - see
// assets/sprites/PROMPTS.md for the image-gen prompts that produce them.
// Until a given file exists, assets.getSprite(id) returns null and callers
// fall back to their procedural draw, so this list can be filled in
// incrementally.

const BASE = './assets/sprites';

// The whole bike+rider (frame, torso, legs, wheels - everything) as one
// fused image per pedal-angle bucket, extracted from a locked-off video of
// one pedal-stroke cycle (tools/build_player_rig.py) rather than assembled
// from independently-generated frame/torso/legs pieces. Older approach hit
// its ceiling on exactly the problem this sidesteps: separately-generated
// parts have no shared scale or reach, which is what js/drawbike.js's
// SEAT_X/HANDLEBAR_X/crank_center measurements were hand-tuning around. A
// fused frame can't have that mismatch - whatever the source draws is
// exactly what renders. Since rig.pedal_angle and rig.wheel_angle are the
// same value (js/drawbike.js computeRig()), each frame's baked-in wheel
// position is also already correct for its bucket - no separate rotating
// wheel sprite needed. 6 frames is this clip's pedal-stroke cycle divided
// evenly; see tools/build_player_rig.py's docstring to regenerate with a
// different frame count or a different source clip.
export const PLAYER_RIG_FRAME_COUNT = 6;
export const PLAYER_RIG_FRAMES = Array.from(
    { length: PLAYER_RIG_FRAME_COUNT },
    (_, i) => `player.rig${i}`,
);

// Each scenery object has several hand-drawn style variants (sliced from a
// single contact-sheet PNG per biome by tools/build_scenery_sprites.py, one
// row per object) rather than one canonical image - `variantIds`/
// `variantEntries` expand a `<namespace>0..N-1` id run and its matching
// `<dir>/<slug>-0..N-1.png` paths so every variant is just another entry a
// biome's sprite pool can randomly draw from (see Tree/Rock in
// world/scenery.js, which already picks a random pool entry per instance).
function variantIds(namespace, count) {
    return Array.from({ length: count }, (_, i) => `${namespace}${i}`);
}

function variantEntries(namespace, dir, slug, count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `${namespace}${i}`,
        path: `${BASE}/${dir}/${slug}-${i}.png`,
    }));
}

const WOODS_PINE_TREE = variantIds('woods.pineTree', 5);
const WOODS_FALLEN_LOG = variantIds('woods.fallenLog', 6);
const BEACH_PALM_TREE = variantIds('beach.palmTree', 5);
const BEACH_DRIFTWOOD = variantIds('beach.driftwood', 5);
const BEACH_UMBRELLA = variantIds('beach.beachUmbrella', 5);
const MOUNTAINS_DEAD_TREE = variantIds('mountains.deadTree', 5);
const MOUNTAINS_BOULDER = variantIds('mountains.boulder', 5);
const MOUNTAINS_SNOW_PATCH = variantIds('mountains.snowPatch', 5);
const FIELDS_HAY_BALE = variantIds('fields.hayBale', 8);
const FIELDS_WILDFLOWER_CLUMP = variantIds('fields.wildflowerClump', 6);
const FIELDS_FENCE_POST = variantIds('fields.fencePost', 6);

// The moon's 8 phase frames, extracted from one locked-off video of a full
// lunar cycle (tools/build_moon_sprites.py) rather than drawn as separate
// style variants - unlike the biome pools above, these are picked by
// PHASE INDEX (js/render/sky.js maps its existing 0..1 phase value onto
// this array), not at random, since a moon only ever looks like whichever
// phase it actually is right now.
export const MOON_PHASE_FRAMES = variantIds('sky.moon', 8);

// The sun has no phase concept (unlike the moon) - these are just cosmetic
// style/color variants, one of which sky.js rolls at random ONCE PER DAY
// (same "roll once, keep it for the whole day" pattern as cloudFreeDay),
// not per-instance like the biome pools since there's only ever one sun.
export const SUN_FRAMES = variantIds('sky.sun', 12);

// Cloud variants ARE per-instance random style choices (like the biome
// clutter pools) - each of Sky's pooled cloud instances picks one from its
// type's array once at init, same as Tree/Rock. Two source sheets per type
// (tools/build_scenery_sprites.py's GRID_SHEETS/SHEETS start_index) land in
// one contiguous pool per type.
export const CLOUD_CUMULUS_FRAMES = variantIds('sky.cumulus', 17);
export const CLOUD_CIRRUS_FRAMES = variantIds('sky.cirrus', 16);
export const CLOUD_STRATUS_FRAMES = variantIds('sky.stratus', 17);

export const SPRITE_MANIFEST = [
    ...PLAYER_RIG_FRAMES.map((id, i) => ({ id, path: `${BASE}/player/rig-${i}.png` })),

    ...variantEntries('woods.pineTree', 'woods', 'pine-tree', WOODS_PINE_TREE.length),
    ...variantEntries('woods.fallenLog', 'woods', 'fallen-log', WOODS_FALLEN_LOG.length),

    ...variantEntries('beach.palmTree', 'beach', 'palm-tree', BEACH_PALM_TREE.length),
    ...variantEntries('beach.driftwood', 'beach', 'driftwood', BEACH_DRIFTWOOD.length),
    ...variantEntries('beach.beachUmbrella', 'beach', 'beach-umbrella', BEACH_UMBRELLA.length),

    ...variantEntries('mountains.deadTree', 'mountains', 'dead-tree', MOUNTAINS_DEAD_TREE.length),
    ...variantEntries('mountains.boulder', 'mountains', 'boulder', MOUNTAINS_BOULDER.length),
    ...variantEntries('mountains.snowPatch', 'mountains', 'snow-patch', MOUNTAINS_SNOW_PATCH.length),

    ...variantEntries('fields.hayBale', 'fields', 'hay-bale', FIELDS_HAY_BALE.length),
    ...variantEntries('fields.wildflowerClump', 'fields', 'wildflower-clump', FIELDS_WILDFLOWER_CLUMP.length),
    ...variantEntries('fields.fencePost', 'fields', 'fence-post', FIELDS_FENCE_POST.length),

    // Hazards (world/hazards.js) - single canonical image each, not a random
    // style pool, since a hazard's silhouette is part of reading it as
    // "jump this" at speed rather than a decorative style roll.
    { id: 'hazard.puddle', path: `${BASE}/hazards/puddle.png` },
    { id: 'hazard.wall', path: `${BASE}/hazards/wall.png` },

    ...variantEntries('sky.moon', 'sky/moon', 'moon', MOON_PHASE_FRAMES.length),

    ...variantEntries('sky.sun', 'sky/sun', 'sun', SUN_FRAMES.length),

    ...variantEntries('sky.cumulus', 'sky/clouds', 'cumulus', CLOUD_CUMULUS_FRAMES.length),
    ...variantEntries('sky.cirrus', 'sky/clouds', 'cirrus', CLOUD_CIRRUS_FRAMES.length),
    ...variantEntries('sky.stratus', 'sky/clouds', 'stratus', CLOUD_STRATUS_FRAMES.length),
];

// Which sprites a Tree instance (tall, bottom-anchored) vs a Rock instance
// (clutter, center-anchored) may draw, per biome - Tree/Rock pick a random
// entry from these pools per instance (world/scenery.js), so listing every
// variant here is what gives each biome its visual variety.
// dead-tree-3 (mountains/dead-tree-3.png) draws a fallen branch sprawling
// sideways, not a standing trunk - Tree (world/scenery.js) bottom-center-
// anchors everything in BIOME_TALL_SPRITES on the assumption there's one
// trunk touching the ground directly below the sprite's x, which left most
// of that variant's mass floating above the terrain with nothing under it.
// It reads correctly through Rock's center-anchor instead (the same fix
// woods/fallen-log already gets by living in the clutter pool, not the tall
// one), so it moves to BIOME_CLUTTER_SPRITES.mountains below.
const MOUNTAINS_DEAD_TREE_STANDING = MOUNTAINS_DEAD_TREE.filter((_, i) => i !== 3);
const MOUNTAINS_DEAD_TREE_FALLEN = [MOUNTAINS_DEAD_TREE[3]];

export const BIOME_TALL_SPRITES = {
    fields: [],
    woods: WOODS_PINE_TREE,
    beach: BEACH_PALM_TREE,
    mountains: MOUNTAINS_DEAD_TREE_STANDING,
};

export const BIOME_CLUTTER_SPRITES = {
    fields: [...FIELDS_HAY_BALE, ...FIELDS_WILDFLOWER_CLUMP, ...FIELDS_FENCE_POST],
    woods: WOODS_FALLEN_LOG,
    beach: [...BEACH_DRIFTWOOD, ...BEACH_UMBRELLA],
    mountains: [...MOUNTAINS_BOULDER, ...MOUNTAINS_SNOW_PATCH, ...MOUNTAINS_DEAD_TREE_FALLEN],
};
