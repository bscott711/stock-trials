import { mulberry32 } from '../core/rng.js';
import { getSprite } from '../render/assets.js';

// Ground-anchored obstacles that crash the bike on contact, generated lazily
// per segment exactly like world/scenery.js's rocks/trees and
// world/pickups.js's cash/dividends (seeded per-segment RNG so re-entry
// rebuilds identically, cull-and-evict draw()). No sprite art exists for
// these yet, so they always fall back to the procedural draw below - same
// "sprite optional" contract as Pickup.
//
// Two kinds, both requiring a real reaction, not a rare surprise: a common,
// low 'puddle' any real hop clears, and a rarer, taller 'wall' that only
// clears near the top of a jump's arc - biased into choppier terrain via
// terrain.localVolatility, the same stretches pickups already bias
// elevated, higher-value pickups into. Every segment spawns at least one, so
// riding without ever jumping is guaranteed to end the run before long
// rather than being something that just happens to a player eventually.
//
// Like Pickup, `y` is the single anchor used for BOTH drawing and hit
// testing (main.js's hazards.hits() call), not the ground contact point -
// `groundY` is kept separately just so the procedural draw can still root
// the silhouette at the terrain surface.

const SEGMENT = 3000;
const SAFE_START_X = 1000; // no hazard before this - the player needs a runway
const WALL_CHANCE = 0.3;

// A grounded bike's axle sits at groundY - WHEEL_R (30, game/bike.js), and
// main.js tests hits with a ~34 radius (HAZARD_HIT_RADIUS), so clearing a
// hazard needs the bike's elevation above ground to exceed anchorHeight +
// HAZARD_HIT_RADIUS. A plain jump (JUMP_IMPULSE=520, GRAVITY=1600 in
// bike.js) peaks ~84.5 above its own launch point (same math pickups.js
// uses for ELEVATED_HEIGHT_MIN) - that ceiling is why WALL_ANCHOR's max
// (41 + 34 = 75) sits well under it rather than near the pickup-style 55-90
// band: anything past ~50 would need more lift than a jump can ever produce,
// making some rolls literally uncrossable instead of just hard to time.
// Puddle anchors sit low enough that any real hop clears them with room to
// spare; wall anchors sit high enough that only a jump timed close to its
// own apex when crossing the wall's x clears it.
const PUDDLE_ANCHOR_MIN = 10;
const PUDDLE_ANCHOR_RANGE = 15;
const WALL_ANCHOR_MIN = 30;
const WALL_ANCHOR_RANGE = 11;

const PUDDLE_VISUAL_WIDTH = 64;
const PUDDLE_VISUAL_HEIGHT = 22;
const WALL_VISUAL_WIDTH = 30;
const WALL_VISUAL_HEIGHT = 64;
const SPRITE_TARGET_SIZE = 56;

class Hazard {
    constructor(x, groundY, anchorHeight, kind) {
        this.x = x;
        this.groundY = groundY;
        this.y = groundY - anchorHeight;
        this.kind = kind;
    }

    draw(ctx) {
        const img = getSprite(this.kind === 'wall' ? 'hazard.wall' : 'hazard.puddle');
        if (img) {
            const s = SPRITE_TARGET_SIZE / img.width;
            const w = img.width * s, h = img.height * s;
            ctx.drawImage(img, this.x - w / 2, this.groundY - h, w, h);
            return;
        }

        if (this.kind === 'wall') {
            const w = WALL_VISUAL_WIDTH, h = WALL_VISUAL_HEIGHT;
            ctx.fillStyle = '#b5342c';
            ctx.strokeStyle = '#4a1310';
            ctx.lineWidth = 3;
            ctx.fillRect(this.x - w / 2, this.groundY - h, w, h);
            ctx.strokeRect(this.x - w / 2, this.groundY - h, w, h);
            ctx.fillStyle = '#f4d63a';
            const stripeH = h / 4;
            ctx.fillRect(this.x - w / 2, this.groundY - h, w, stripeH);
            ctx.fillRect(this.x - w / 2, this.groundY - h + stripeH * 2, w, stripeH);
        } else {
            // Flush with the ground and unmissably blue, rather than
            // something that could be mistaken for scenery.js's earth-toned
            // decorative rocks.
            const rx = PUDDLE_VISUAL_WIDTH / 2, ry = PUDDLE_VISUAL_HEIGHT / 2;
            const cy = this.groundY - ry;
            ctx.beginPath();
            ctx.ellipse(this.x, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#2f6f8f';
            ctx.fill();
            ctx.strokeStyle = '#16394a';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(this.x - rx * 0.2, cy - ry * 0.3, rx * 0.35, ry * 0.3, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fill();
        }
    }
}

export class HazardField {
    constructor(terrain, seed = 0x4A2A1D) {
        this.terrain = terrain;
        this.seed = seed >>> 0;
        this.segments = new Map(); // segmentStart -> Hazard[]
    }

    _segment(start) {
        let seg = this.segments.get(start);
        if (seg) return seg;

        const rng = mulberry32((this.seed ^ Math.imul(start | 0, 0xC2B2AE35)) >>> 0);
        const hazards = [];
        const count = Math.floor(rng() * 3) + 1; // 1-3 per segment - never zero

        for (let i = 0; i < count; i++) {
            const x = start + rng() * SEGMENT;
            if (x < SAFE_START_X) continue;

            const groundY = this.terrain.sampleY(x);
            const volatility = this.terrain.localVolatility(x);

            const kind = rng() < WALL_CHANCE ? 'wall' : 'puddle';
            const anchorHeight = kind === 'wall'
                ? WALL_ANCHOR_MIN + volatility * WALL_ANCHOR_RANGE * rng()
                : PUDDLE_ANCHOR_MIN + rng() * PUDDLE_ANCHOR_RANGE;

            hazards.push(new Hazard(x, groundY, anchorHeight, kind));
        }

        seg = hazards;
        this.segments.set(start, seg);
        return seg;
    }

    _segmentsInRange(left, right) {
        const first = Math.floor(left / SEGMENT) * SEGMENT;
        const last = Math.floor(right / SEGMENT) * SEGMENT;
        const out = [];
        for (let s = first; s <= last; s += SEGMENT) out.push(this._segment(s));
        return out;
    }

    draw(ctx, bounds) {
        for (const seg of this._segmentsInRange(bounds.left, bounds.right)) {
            for (const h of seg) {
                if (h.x > bounds.left - 60 && h.x < bounds.right + 60) h.draw(ctx);
            }
        }

        // Bound memory, same as Scenery.draw()/PickupField.draw().
        if (this.segments.size > 12) {
            const first = Math.floor(bounds.left / SEGMENT) * SEGMENT;
            const last = Math.floor(bounds.right / SEGMENT) * SEGMENT;
            for (const key of this.segments.keys()) {
                if (key < first - SEGMENT * 2 || key > last + SEGMENT * 2) this.segments.delete(key);
            }
        }
    }

    /** Returns the first hazard within radius of (x, y), or null. */
    hits(x, y, radius) {
        for (const seg of this._segmentsInRange(x - radius, x + radius)) {
            for (const h of seg) {
                const dx = h.x - x, dy = h.y - y;
                if (dx * dx + dy * dy <= radius * radius) return h;
            }
        }
        return null;
    }
}
