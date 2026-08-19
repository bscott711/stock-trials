import { drawGround } from './ground.js';
import { rgb } from '../core/math.js';

// Owns the canvas, the device-pixel-ratio contract and the layer order.
// No other module touches ctx transform state.

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = 1;
        this.cssW = 0;
        this.cssH = 0;
    }

    resize(camera, sky) {
        // Cap DPR at 2: 3x on phones costs 2.25x the fill rate for no visible
        // gain. Everything outside this method works in CSS pixels.
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.cssW = window.innerWidth;
        this.cssH = window.innerHeight;

        this.canvas.width = Math.round(this.cssW * this.dpr);
        this.canvas.height = Math.round(this.cssH * this.dpr);
        this.canvas.style.width = this.cssW + 'px';
        this.canvas.style.height = this.cssH + 'px';

        camera.setViewport(this.cssW, this.cssH, this.dpr);
        if (sky) sky.resize(this.cssW, this.cssH);
    }

    draw({ camera, sky, terrain, scenery, pickups, parallax, drawPlayfield, drawHud, debug, seed }) {
        const ctx = this.ctx;
        const darkness = sky.getDarkness();

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Sky and celestials - screen space, no parallax at all.
        camera.applyScreen(ctx);
        sky.draw(ctx, this.cssW, this.cssH);

        // 2. Distant silhouettes.
        parallax.draw(ctx, camera, sky.horizonColor(), seed);

        // 3. Playfield ground and scenery.
        const bounds = camera.visibleBounds(120);
        camera.applyTo(ctx);
        drawGround(ctx, terrain, bounds, seed);
        scenery.draw(ctx, bounds);
        if (pickups) pickups.draw(ctx, bounds);

        // 4. Night pass. Order is the whole trick: darken the world FIRST, then
        //    draw additive lights on top. The old code composited the headlight
        //    with 'lighter' over an undarkened world, where it was invisible.
        if (darkness > 0.01) {
            camera.applyScreen(ctx);
            ctx.globalCompositeOperation = 'multiply';
            const tint = sky.horizonColor();
            ctx.fillStyle = `rgba(${Math.round(40 + tint.r * 0.1)}, ${Math.round(50 + tint.g * 0.1)}, ${Math.round(90 + tint.b * 0.1)}, ${darkness * 0.72})`;
            ctx.fillRect(0, 0, this.cssW, this.cssH);
            ctx.globalCompositeOperation = 'source-over';
        }

        // 5. Bike, rider and their lights.
        camera.applyTo(ctx);
        if (drawPlayfield) drawPlayfield(ctx, darkness);

        if (debug) {
            camera.applyTo(ctx);
            debug.drawWorld(ctx, camera, terrain, bounds);
        }

        // 6. HUD.
        camera.applyScreen(ctx);
        if (drawHud) drawHud(ctx, this.cssW, this.cssH);
        if (debug) debug.drawScreen(ctx, camera, this.cssW, this.cssH);
    }
}

export { rgb };
