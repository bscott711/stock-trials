// Seeded randomness.
//
// Worldgen must be reproducible: retrying after a crash has to rebuild the
// identical world, or checkpoints and score comparison are meaningless.
// Nothing under world/ may call Math.random().

/** Fast 32-bit PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** FNV-1a over a string, for turning a ticker symbol into a seed. */
export function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/**
 * Stateless hash of an integer to [0, 1).
 * Lets world-anchored detail (grass blades, tufts) be regenerated on demand at
 * any position without storing it or depending on draw order.
 */
export function hash01(n, salt = 0) {
    let h = (n | 0) ^ Math.imul(salt | 0, 0x9E3779B9);
    h = Math.imul(h ^ (h >>> 16), 0x45D9F3B);
    h = Math.imul(h ^ (h >>> 16), 0x45D9F3B);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** Approximately standard-normal, via the central limit theorem. */
export function gauss(rng) {
    return (rng() + rng() + rng() + rng() + rng() + rng() - 3) / 0.7071;
}
