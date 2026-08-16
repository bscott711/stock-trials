import { mulberry32 } from '../core/rng.js';

// The landscape the ride passes through. Independent of terrain.js's
// PIXELS_PER_DAY (trading-day/sun-moon cadence) - biomes are a scenic
// rotation, not a market concept, and decoupling them means either system
// can be retuned without silently resizing the other.
//
// An endless, seeded, no-immediate-repeat sequence: partition regions into
// blocks of BIOMES.length, Fisher-Yates-shuffle each block independently
// (so within a block every biome appears exactly once), then swap the new
// block's first slot if it would repeat the previous block's last slot.
// That swap is always sufficient - the 4 elements of a shuffle are
// distinct, so the post-swap first slot can't equal what it collided with -
// which makes this correct for an unbounded regionIndex, not just "usually
// fine", at O(1) per query (never walks history).

export const REGION_LENGTH = 30000;
const TRANSITION_BAND = REGION_LENGTH * 0.1;

export const BIOMES = ['fields', 'woods', 'beach', 'mountains'];

// fields reproduces today's exact palette, so it reads as the natural
// default and doubles as a visual regression check against the pre-biome
// look.
export const BIOME_DEFS = {
    fields: {
        ridgeColors: [
            { r: 96, g: 116, b: 150 },
            { r: 72, g: 100, b: 112 },
            { r: 48, g: 82, b: 70 },
        ],
        nearRidge: { amplitude: 70, octaves: 5, treeline: true, ridged: false },
        ground: {
            top: { r: 74, g: 124, b: 48 },
            mid: { r: 61, g: 100, b: 40 },
            bottom: { r: 42, g: 63, b: 34 },
            topsoil: { r: 92, g: 143, b: 56 },
            outline: { r: 36, g: 56, b: 28 },
        },
        texture: {
            shape: 'blade',
            density: 1.0,
            color: (r3) => `rgb(${Math.round(60 + r3 * 40)}, ${Math.round(130 + r3 * 70)}, ${Math.round(45 + r3 * 30)})`,
        },
    },
    woods: {
        ridgeColors: [
            { r: 70, g: 88, b: 110 },
            { r: 56, g: 78, b: 70 },
            { r: 40, g: 66, b: 48 },
        ],
        nearRidge: { amplitude: 90, octaves: 5, treeline: true, ridged: false },
        ground: {
            top: { r: 58, g: 90, b: 42 },
            mid: { r: 40, g: 58, b: 32 },
            bottom: { r: 26, g: 32, b: 20 },
            topsoil: { r: 70, g: 80, b: 40 },
            outline: { r: 20, g: 24, b: 14 },
        },
        texture: {
            shape: 'needle',
            density: 0.85,
            color: (r3) => `rgb(${Math.round(70 + r3 * 30)}, ${Math.round(55 + r3 * 25)}, ${Math.round(30 + r3 * 15)})`,
        },
    },
    beach: {
        ridgeColors: [
            { r: 150, g: 160, b: 180 },
            { r: 190, g: 180, b: 150 },
            { r: 210, g: 190, b: 140 },
        ],
        nearRidge: { amplitude: 30, octaves: 2, treeline: false, ridged: false },
        ground: {
            top: { r: 214, g: 196, b: 150 },
            mid: { r: 196, g: 172, b: 120 },
            bottom: { r: 150, g: 128, b: 90 },
            topsoil: { r: 230, g: 214, b: 170 },
            outline: { r: 120, g: 100, b: 70 },
        },
        texture: {
            shape: 'stipple',
            density: 0.35,
            color: (r3) => `rgb(${Math.round(210 + r3 * 20)}, ${Math.round(195 + r3 * 20)}, ${Math.round(150 + r3 * 20)})`,
        },
    },
    mountains: {
        ridgeColors: [
            { r: 120, g: 126, b: 140 },
            { r: 100, g: 106, b: 118 },
            { r: 90, g: 96, b: 104 },
        ],
        nearRidge: { amplitude: 140, octaves: 3, treeline: false, ridged: true },
        ground: {
            top: { r: 150, g: 150, b: 158 },
            mid: { r: 120, g: 120, b: 130 },
            bottom: { r: 90, g: 90, b: 100 },
            topsoil: { r: 170, g: 170, b: 178 },
            outline: { r: 70, g: 70, b: 80 },
        },
        texture: {
            shape: 'scree',
            density: 0.5,
            color: (r3) => `rgb(${Math.round(140 + r3 * 20)}, ${Math.round(140 + r3 * 20)}, ${Math.round(150 + r3 * 20)})`,
        },
    },
};

function shuffledBlock(blockIndex, seed) {
    const arr = BIOMES.slice();
    const rng = mulberry32((seed ^ 0xB10A3E ^ Math.imul(blockIndex | 0, 0x9E3779B9)) >>> 0);
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export function regionIndexAt(worldX) {
    return Math.floor(Math.max(0, worldX) / REGION_LENGTH);
}

export function biomeForRegion(regionIndex, seed) {
    regionIndex = Math.max(0, regionIndex);
    const blockIndex = Math.floor(regionIndex / BIOMES.length);
    const slot = regionIndex - blockIndex * BIOMES.length;
    const block = shuffledBlock(blockIndex, seed);
    if (slot === 0 && blockIndex > 0) {
        const prevLast = shuffledBlock(blockIndex - 1, seed)[BIOMES.length - 1];
        if (block[0] === prevLast) [block[0], block[1]] = [block[1], block[0]];
    }
    return block[slot];
}

/**
 * `{ from, to, t }` - only the entering edge of a region blends in from the
 * previous one, so a boundary is never counted from both sides at once.
 * `t` runs 0..1 across the transition band; elsewhere `from === to` and
 * `t === 1`, so callers can always just lerpColor(from, to, t) unconditionally.
 */
export function biomeBlendAt(worldX, seed) {
    const idx = regionIndexAt(worldX);
    const posInRegion = Math.max(0, worldX) - idx * REGION_LENGTH;
    const current = biomeForRegion(idx, seed);
    if (posInRegion < TRANSITION_BAND && idx > 0) {
        const prev = biomeForRegion(idx - 1, seed);
        return { from: prev, to: current, t: posInRegion / TRANSITION_BAND };
    }
    return { from: current, to: current, t: 1 };
}
