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

export const SPRITE_MANIFEST = [
    ...PLAYER_RIG_FRAMES.map((id, i) => ({ id, path: `${BASE}/player/rig-${i}.png` })),

    { id: 'woods.pineTree', path: `${BASE}/woods/pine-tree.png` },
    { id: 'woods.fallenLog', path: `${BASE}/woods/fallen-log.png` },

    { id: 'beach.palmTree', path: `${BASE}/beach/palm-tree.png` },
    { id: 'beach.driftwood', path: `${BASE}/beach/driftwood.png` },
    { id: 'beach.beachUmbrella', path: `${BASE}/beach/beach-umbrella.png` },

    { id: 'mountains.deadTree', path: `${BASE}/mountains/dead-tree.png` },
    { id: 'mountains.boulder', path: `${BASE}/mountains/boulder.png` },
    { id: 'mountains.snowPatch', path: `${BASE}/mountains/snow-patch.png` },

    { id: 'fields.hayBale', path: `${BASE}/fields/hay-bale.png` },
    { id: 'fields.wildflowerClump', path: `${BASE}/fields/wildflower-clump.png` },
    { id: 'fields.fencePost', path: `${BASE}/fields/fence-post.png` },
];

// Which sprites a Tree instance (tall, bottom-anchored) vs a Rock instance
// (clutter, center-anchored) may draw, per biome.
export const BIOME_TALL_SPRITES = {
    fields: [],
    woods: ['woods.pineTree'],
    beach: ['beach.palmTree'],
    mountains: ['mountains.deadTree'],
};

export const BIOME_CLUTTER_SPRITES = {
    fields: ['fields.hayBale', 'fields.wildflowerClump', 'fields.fencePost'],
    woods: ['woods.fallenLog'],
    beach: ['beach.driftwood', 'beach.beachUmbrella'],
    mountains: ['mountains.boulder', 'mountains.snowPatch'],
};
