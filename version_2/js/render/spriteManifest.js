// Central list of every sprite the game knows how to use, and where its
// PNG lives. None of these files ship by default - see
// assets/sprites/PROMPTS.md for the image-gen prompts that produce them.
// Until a given file exists, assets.getSprite(id) returns null and callers
// fall back to their procedural draw, so this list can be filled in
// incrementally.

const BASE = './assets/sprites';

// Legs pedal in a circle - a single static image (or one image rotated,
// the trick that works for the wheels) can't fake that, so they get their
// own cycle of pose frames instead, indexed by rig.pedal_angle. 8 frames
// is a smooth-reading compromise between motion quality and how much art
// has to be generated and kept consistent (see PROMPTS.md).
export const PLAYER_LEG_FRAME_COUNT = 8;
export const PLAYER_LEG_FRAMES = Array.from(
    { length: PLAYER_LEG_FRAME_COUNT },
    (_, i) => `player.legs${i}`,
);

// Torso sways slightly with each pedal stroke rather than sitting frozen -
// same idea as the legs, just a coarser cycle since the motion is subtler.
// Only 2 of the 4 generated torso-N.png frames are used here: torso-2 and
// torso-3 came out of tools/build_player_sprites.py with their hip anchor
// mis-detected (its bottom_anchor_excl_hand heuristic doesn't track the hip
// correctly on a more hunched-forward lean), landing 15-19px off from
// torso-0/torso-1's anchor. Cycling all 4 visibly snapped the rider's whole
// upper body sideways twice per pedal revolution. torso-0/torso-1 are
// properly registered against each other, so sway is limited to those until
// torso-2/torso-3 are regenerated with a corrected anchor.
export const PLAYER_TORSO_FRAME_COUNT = 2;
export const PLAYER_TORSO_FRAMES = Array.from(
    { length: PLAYER_TORSO_FRAME_COUNT },
    (_, i) => `player.torso${i}`,
);

export const SPRITE_MANIFEST = [
    { id: 'player.bikeRider', path: `${BASE}/player/bike-rider.png` },
    { id: 'player.frame', path: `${BASE}/player/frame.png` },
    { id: 'player.wheelFront', path: `${BASE}/player/wheel-front.png` },
    { id: 'player.wheelBack', path: `${BASE}/player/wheel-back.png` },
    ...PLAYER_LEG_FRAMES.map((id, i) => ({ id, path: `${BASE}/player/legs-${i}.png` })),
    ...PLAYER_TORSO_FRAMES.map((id, i) => ({ id, path: `${BASE}/player/torso-${i}.png` })),

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
