import { clamp } from '../core/math.js';
import { mulberry32 } from '../core/rng.js';

// Terrain lives in WORLD coordinates: +X right, +Y down, Y=0 is the reference
// line. It must never reference canvas dimensions - that coupling is what made
// the old path depend on viewport height and break on resize.
//
// The surface is the sum of two curves:
//   1. a DAY curve, one control point per trading day
//   2. an intra-day DETAIL curve, higher frequency
//
// That split exists because a trading day has exactly one closing price, but a
// day is wide enough on screen that interpolating between two closes alone
// leaves a long featureless ramp. Phase 3 keeps this structure: the day curve
// becomes real closes sampled through PCHIP, and the detail curve becomes the
// kickers/whoops/gaps derived from that day's return.

// A day has to be wide, because the sun and moon are driven from it: one arc
// is one trading day.
//
// Size this against MAX speed (620 px/s in game/bike.js), not cruising speed -
// a player holding the throttle down is the worst case, and that is where the
// sky strobes. At 20000px a flat-out day lasts ~32s and a relaxed one ~80s.
// For reference: 3000px/day cycled every ~5s, 10000px/day every ~16s.
export const PIXELS_PER_DAY = 20000;
export const TERRAIN_MIN_Y = -520;
export const TERRAIN_MAX_Y = 520;

// With days this wide, the day-to-day walk is only slow drift; essentially all
// of the rideable character comes from these octaves. Wavelengths are
// deliberately non-harmonic so the pattern does not visibly repeat.
//
// Peak combined slope is sum(amplitude * k) ~= 0.87, i.e. about 41 degrees, so
// even a worst-case alignment of all four stays under the 55-degree crash
// threshold.
const DETAIL = [
    { wavelength: 2600, amplitude: 130 },
    { wavelength: 1100, amplitude: 40 },
    { wavelength: 430, amplitude: 12 },
    { wavelength: 170, amplitude: 4 },
];

export class Terrain {
    constructor(seed = 12345) {
        this.seed = seed >>> 0;
        this.rng = mulberry32(this.seed);
        this.ys = [];
        this._walkV = 0;
        this._walkY = 0;

        const phaseRng = mulberry32((this.seed ^ 0x1234567) >>> 0);
        this.detail = DETAIL.map(d => ({
            k: (Math.PI * 2) / d.wavelength,
            amp: d.amplitude,
            phase: phaseRng() * Math.PI * 2,
        }));

        this.ensureGenerated(PIXELS_PER_DAY * 4);
    }

    /**
     * Extend the day series far enough to cover worldX.
     *
     * The old implementation tiled a 100-day block ten times with odd repeats
     * MIRRORED vertically, which inverts the meaning of the data and leaves a
     * hard discontinuity at every seam. A momentum walk continues smoothly and
     * without bound.
     */
    ensureGenerated(worldX) {
        const needed = Math.ceil(worldX / PIXELS_PER_DAY) + 8;
        while (this.ys.length < needed) {
            this._walkV = this._walkV * 0.72 + (this.rng() - 0.5) * 620;
            this._walkY += this._walkV;
            if (this._walkY < TERRAIN_MIN_Y || this._walkY > TERRAIN_MAX_Y) {
                this._walkY = clamp(this._walkY, TERRAIN_MIN_Y, TERRAIN_MAX_Y);
                this._walkV *= -0.5; // bounce off the band instead of flattening
            }
            this.ys.push(this._walkY);
        }
    }

    _detailY(worldX) {
        let y = 0;
        for (const d of this.detail) y += d.amp * Math.sin(worldX * d.k + d.phase);
        return y;
    }

    _detailSlope(worldX) {
        let m = 0;
        for (const d of this.detail) m += d.amp * d.k * Math.cos(worldX * d.k + d.phase);
        return m;
    }

    sampleY(worldX) {
        if (worldX < 0) return this.ys[0] + this._detailY(0);
        this.ensureGenerated(worldX);
        const i = Math.floor(worldX / PIXELS_PER_DAY);
        const t = worldX / PIXELS_PER_DAY - i;
        return this.ys[i] + t * (this.ys[i + 1] - this.ys[i]) + this._detailY(worldX);
    }

    sampleSlope(worldX) {
        if (worldX < 0) return 0;
        this.ensureGenerated(worldX);
        const i = Math.floor(worldX / PIXELS_PER_DAY);
        return (this.ys[i + 1] - this.ys[i]) / PIXELS_PER_DAY + this._detailSlope(worldX);
    }

    /** Unit normal pointing up out of the surface. */
    sampleNormal(worldX) {
        const m = this.sampleSlope(worldX);
        const len = Math.hypot(1, m);
        return { x: -m / len, y: -1 / len };
    }

    /** Day index at a world position, for scoring and date lookup. */
    dayAt(worldX) {
        return Math.floor(worldX / PIXELS_PER_DAY);
    }

    /** 0..1 progress through the current day. Drives the sun and moon. */
    dayFraction(worldX) {
        const f = (worldX / PIXELS_PER_DAY) % 1;
        return f < 0 ? f + 1 : f;
    }
}
