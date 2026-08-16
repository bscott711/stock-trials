// Central list of every sprite the game knows how to use, and where its
// PNG lives. None of these files ship by default - see
// assets/sprites/PROMPTS.md for the image-gen prompts that produce them.
// Until a given file exists, assets.getSprite(id) returns null and callers
// fall back to their procedural draw, so this list can be filled in
// incrementally.

const BASE = './assets/sprites';

export const SPRITE_MANIFEST = [
    { id: 'player.bikeRider', path: `${BASE}/player/bike-rider.png` },
    { id: 'player.wheelFront', path: `${BASE}/player/wheel-front.png` },
    { id: 'player.wheelBack', path: `${BASE}/player/wheel-back.png` },

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
