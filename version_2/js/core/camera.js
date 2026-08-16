import { clamp, smoothDamp } from './math.js';

// The only place that converts world coordinates to screen coordinates.
//
// Previously every draw site did `wx - startX` by hand and terrain Y was
// generated directly in screen space, which meant there was no vertical camera
// at all and resizing the window invalidated the world.

export class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.viewW = 1;
        this.viewH = 1;
        this.dpr = 1;

        this.trauma = 0;
        this._shakeX = 0;
        this._shakeY = 0;

        this._vx = { v: 0 };
        this._vy = { v: 0 };
    }

    setViewport(cssW, cssH, dpr) {
        this.viewW = cssW;
        this.viewH = cssH;
        this.dpr = dpr;
    }

    snapTo(x, y) {
        this.x = x;
        this.y = y;
        this._vx.v = 0;
        this._vy.v = 0;
    }

    /**
     * @param target  { x, y, vx, airborne }
     */
    follow(target, dt) {
        // Look ahead in the direction of travel so the player sees what they
        // are about to hit rather than what they just passed.
        const lookahead = clamp(target.vx * 0.45, -200, 400);
        this.x = smoothDamp(this.x, target.x + lookahead, this._vx, 0.15, dt);

        if (target.airborne) {
            // Deadzone: let the bike move within a band before the camera
            // reacts, so hops don't yank the whole world.
            const band = this.viewH * 0.15;
            const dy = target.y - this.y;
            if (dy > band) this.y = smoothDamp(this.y, target.y - band, this._vy, 0.25, dt);
            else if (dy < -band) this.y = smoothDamp(this.y, target.y + band, this._vy, 0.25, dt);
            // Hard clamp so the bike can never leave the viewport entirely.
            this.y = clamp(this.y, target.y - this.viewH * 0.3, target.y + this.viewH * 0.3);
        } else {
            // Sit the surface slightly below centre; a slower response keeps
            // small bumps from inducing nausea.
            this.y = smoothDamp(this.y, target.y - this.viewH * 0.12, this._vy, 0.35, dt);
        }
    }

    addTrauma(amount) {
        this.trauma = clamp(this.trauma + amount, 0, 1);
    }

    update(dt) {
        if (this.trauma > 0) {
            this.trauma = Math.max(0, this.trauma - dt * 1.5);
            // Squaring makes small trauma fall off fast and reads better than
            // a linear ramp.
            const mag = this.trauma * this.trauma * 18;
            this._shakeX = (Math.random() * 2 - 1) * mag;
            this._shakeY = (Math.random() * 2 - 1) * mag;
        } else {
            this._shakeX = 0;
            this._shakeY = 0;
        }
    }

    /** World space -> device pixels. Everything in world/ draws under this. */
    applyTo(ctx) {
        const s = this.zoom * this.dpr;
        ctx.setTransform(
            s, 0, 0, s,
            this.dpr * (this.viewW / 2 - (this.x + this._shakeX) * this.zoom),
            this.dpr * (this.viewH / 2 - (this.y + this._shakeY) * this.zoom),
        );
    }

    /** Background layers: same as applyTo but at a fraction of camera motion. */
    applyParallax(ctx, px, py) {
        const s = this.zoom * this.dpr;
        ctx.setTransform(
            s, 0, 0, s,
            this.dpr * (this.viewW / 2 - (this.x + this._shakeX) * px * this.zoom),
            this.dpr * (this.viewH / 2 - (this.y + this._shakeY) * py * this.zoom),
        );
    }

    /** CSS pixels from the top-left. HUD and full-screen passes use this. */
    applyScreen(ctx) {
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    worldToScreen(wx, wy) {
        return {
            x: (wx - this.x) * this.zoom + this.viewW / 2,
            y: (wy - this.y) * this.zoom + this.viewH / 2,
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.viewW / 2) / this.zoom + this.x,
            y: (sy - this.viewH / 2) / this.zoom + this.y,
        };
    }

    /** World-space rectangle currently on screen, for culling and generation. */
    visibleBounds(margin = 0) {
        const halfW = this.viewW / (2 * this.zoom) + margin;
        const halfH = this.viewH / (2 * this.zoom) + margin;
        return {
            left: this.x - halfW,
            right: this.x + halfW,
            top: this.y - halfH,
            bottom: this.y + halfH,
        };
    }
}
