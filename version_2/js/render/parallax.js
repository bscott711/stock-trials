import { mulberry32 } from '../core/rng.js';
import { lerpColor, rgb } from '../core/math.js';
import { biomeBlendAt, BIOME_DEFS } from '../world/biome.js';

// Distant silhouette ridges, replacing the old per-instance Mountain objects.
//
// The height function is a sum of sines with an integer number of periods per
// tile, so the tile is seamless BY CONSTRUCTION - there is no seam to hide and
// it can be regenerated at any width on resize.
//
// Tiles are placed with a tile-INDEX loop (Math.floor of a world coordinate),
// never `x % width`. JS `%` is remainder, not modulo: it returns negative for
// negative operands, which is exactly the left-edge gap the old grass tiling
// showed whenever the camera went past x = 0.
//
// Waveform (this.waves) and treeline placement (this.treeRng) are generated
// once per layer and never touched again - only their AMPLITUDE and which
// octaves get summed vary with biome, via heightAt(x, cfg). Regenerating the
// waveform per biome would make ridgelines/treeline dots jump discontinuously
// at every region boundary; scaling a fixed waveform doesn't.

const TILE_WIDTH = 2048;
const MAX_OCTAVES = 5;

class Ridge {
    constructor({ parallaxX, parallaxY, baseY, seed }) {
        this.parallaxX = parallaxX;
        this.parallaxY = parallaxY;
        this.baseY = baseY;

        const rng = mulberry32(seed);
        this.waves = [];
        for (let k = 1; k <= MAX_OCTAVES; k++) {
            this.waves.push({
                k,
                ampFrac: (1 / k) * (0.6 + rng() * 0.8),
                phase: rng() * Math.PI * 2,
            });
        }
        this.treeRng = mulberry32(seed ^ 0xABCD);
    }

    _wave(x, octaves) {
        let y = 0;
        for (let i = 0; i < octaves; i++) {
            const w = this.waves[i];
            y += w.ampFrac * Math.sin((Math.PI * 2 * w.k * x) / TILE_WIDTH + w.phase);
        }
        return y;
    }

    /** `cfg` = { amplitude, octaves, ridged }. */
    heightAt(x, cfg) {
        const y = this._wave(x, cfg.octaves);
        if (cfg.ridged) {
            // Ridge-noise fold: turns rolling sine crests into sharp jagged
            // peaks, since a plain sum-of-sines silhouette reads as hills no
            // matter how tall it's stretched.
            return this.baseY - cfg.amplitude + 2 * Math.abs(y) * cfg.amplitude;
        }
        return this.baseY + y * cfg.amplitude;
    }

    _blendedHeight(x, cfgFrom, cfgTo, t) {
        const hFrom = this.heightAt(x, cfgFrom);
        if (t >= 1) return hFrom;
        const hTo = this.heightAt(x, cfgTo);
        return hFrom + (hTo - hFrom) * t;
    }

    draw(ctx, camera, color, cfgFrom, cfgTo, t) {
        const halfW = camera.viewW / (2 * camera.zoom);
        const halfH = camera.viewH / (2 * camera.zoom);
        const left = camera.x * this.parallaxX - halfW;
        const right = camera.x * this.parallaxX + halfW;
        const bottom = camera.y * this.parallaxY + halfH;

        const step = 16;
        const startX = Math.floor(left / step) * step;

        ctx.beginPath();
        ctx.moveTo(startX, bottom);
        for (let x = startX; x <= right + step; x += step) {
            ctx.lineTo(x, this._blendedHeight(x, cfgFrom, cfgTo, t));
        }
        ctx.lineTo(right + step, bottom);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();

        // Treeline fades in/out across the band rather than popping, when
        // the two biomes disagree on whether this layer has one.
        const treeAlpha = cfgFrom.treeline && cfgTo.treeline ? 1
            : cfgFrom.treeline ? 1 - t
                : cfgTo.treeline ? t
                    : 0;
        if (treeAlpha > 0.01) {
            ctx.save();
            ctx.globalAlpha = treeAlpha;
            this._drawTreeline(ctx, startX, right, color, cfgFrom, cfgTo, t);
            ctx.restore();
        }
    }

    _drawTreeline(ctx, startX, right, fill, cfgFrom, cfgTo, t) {
        // Deterministic per slot index, so trees stay put as the camera moves.
        const spacing = 26;
        const first = Math.floor(startX / spacing);
        const last = Math.ceil(right / spacing);
        ctx.fillStyle = fill;
        for (let i = first; i <= last; i++) {
            const x = i * spacing;
            const r = mulberry32(i >>> 0)();
            if (r < 0.35) continue;
            const h = 10 + r * 16;
            const w = 5 + r * 4;
            const y = this._blendedHeight(x, cfgFrom, cfgTo, t);
            ctx.beginPath();
            ctx.moveTo(x, y - h);
            ctx.lineTo(x - w, y + 2);
            ctx.lineTo(x + w, y + 2);
            ctx.closePath();
            ctx.fill();
        }
    }
}

export class Parallax {
    constructor() {
        // Vertical factors are deliberately smaller than horizontal ones. With
        // equal factors the distant layers slide off the top of the screen
        // whenever the bike drops into a valley.
        this.layers = [
            new Ridge({ parallaxX: 0.15, parallaxY: 0.06, baseY: -120, seed: 101 }),
            new Ridge({ parallaxX: 0.32, parallaxY: 0.14, baseY: -40, seed: 202 }),
            new Ridge({ parallaxX: 0.58, parallaxY: 0.30, baseY: 40, seed: 303 }),
        ];
        // Distant things sit closer to the horizon colour (atmospheric
        // perspective), and the same lerp doubles as the night tint.
        this.tintAmounts = [0.65, 0.42, 0.2];
        // The far two layers keep their original shape everywhere (they're
        // small, blurry silhouettes - shape variation wouldn't read at that
        // distance); only their COLOR varies by biome. Only the near layer
        // (index 2), which is what makes a biome recognizable as "mountains"
        // vs "woods", varies shape too, via each biome's `nearRidge` config.
        this.farShape = [
            { amplitude: 70, octaves: 4, treeline: false, ridged: false },
            { amplitude: 90, octaves: 5, treeline: false, ridged: false },
        ];
    }

    draw(ctx, camera, horizonColor, seed) {
        const blend = biomeBlendAt(camera.x, seed);
        const defFrom = BIOME_DEFS[blend.from];
        const defTo = BIOME_DEFS[blend.to];

        this.layers.forEach((layer, i) => {
            const isNear = i === this.layers.length - 1;
            const cfgFrom = isNear ? defFrom.nearRidge : this.farShape[i];
            const cfgTo = isNear ? defTo.nearRidge : this.farShape[i];

            const biomeColor = lerpColor(defFrom.ridgeColors[i], defTo.ridgeColors[i], blend.t);
            const color = rgb(lerpColor(biomeColor, horizonColor, this.tintAmounts[i]));

            camera.applyParallax(ctx, layer.parallaxX, layer.parallaxY);
            layer.draw(ctx, camera, color, cfgFrom, cfgTo, blend.t);
        });
    }
}
