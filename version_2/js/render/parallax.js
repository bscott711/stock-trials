import { mulberry32 } from '../core/rng.js';
import { lerpColor, rgb } from '../core/math.js';

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

const TILE_WIDTH = 2048;

class Ridge {
    constructor({ parallaxX, parallaxY, baseY, amplitude, color, seed, octaves = 5, treeline = false }) {
        this.parallaxX = parallaxX;
        this.parallaxY = parallaxY;
        this.baseY = baseY;
        this.amplitude = amplitude;
        this.color = color;
        this.treeline = treeline;

        const rng = mulberry32(seed);
        this.waves = [];
        for (let k = 1; k <= octaves; k++) {
            this.waves.push({
                k,
                amp: (amplitude / k) * (0.6 + rng() * 0.8),
                phase: rng() * Math.PI * 2,
            });
        }
        this.treeRng = mulberry32(seed ^ 0xABCD);
    }

    heightAt(x) {
        let y = 0;
        for (const w of this.waves) {
            y += w.amp * Math.sin((Math.PI * 2 * w.k * x) / TILE_WIDTH + w.phase);
        }
        return this.baseY + y;
    }

    draw(ctx, camera, tint, tintAmount) {
        const halfW = camera.viewW / (2 * camera.zoom);
        const halfH = camera.viewH / (2 * camera.zoom);
        // Visible range expressed in this layer's own (parallax-scaled) space.
        const left = camera.x * this.parallaxX - halfW;
        const right = camera.x * this.parallaxX + halfW;
        const bottom = camera.y * this.parallaxY + halfH;

        const step = 16;
        const startX = Math.floor(left / step) * step;

        ctx.beginPath();
        ctx.moveTo(startX, bottom);
        for (let x = startX; x <= right + step; x += step) {
            ctx.lineTo(x, this.heightAt(x));
        }
        ctx.lineTo(right + step, bottom);
        ctx.closePath();

        const base = typeof this.color === 'string' ? this.color : rgb(lerpColor(this.color, tint, tintAmount));
        ctx.fillStyle = base;
        ctx.fill();

        if (this.treeline) this._drawTreeline(ctx, startX, right, base);
    }

    _drawTreeline(ctx, startX, right, fill) {
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
            const y = this.heightAt(x);
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
            new Ridge({ parallaxX: 0.15, parallaxY: 0.06, baseY: -120, amplitude: 70, color: { r: 96, g: 116, b: 150 }, seed: 101, octaves: 4 }),
            new Ridge({ parallaxX: 0.32, parallaxY: 0.14, baseY: -40, amplitude: 90, color: { r: 72, g: 100, b: 112 }, seed: 202, octaves: 5 }),
            new Ridge({ parallaxX: 0.58, parallaxY: 0.30, baseY: 40, amplitude: 70, color: { r: 48, g: 82, b: 70 }, seed: 303, octaves: 5, treeline: true }),
        ];
        // Distant things sit closer to the horizon colour (atmospheric
        // perspective), and the same lerp doubles as the night tint.
        this.tintAmounts = [0.65, 0.42, 0.2];
    }

    draw(ctx, camera, horizonColor) {
        this.layers.forEach((layer, i) => {
            camera.applyParallax(ctx, layer.parallaxX, layer.parallaxY);
            layer.draw(ctx, camera, horizonColor, this.tintAmounts[i]);
        });
    }
}
