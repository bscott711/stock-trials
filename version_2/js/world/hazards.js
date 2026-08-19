import { mulberry32 } from '../core/rng.js';
import { getSprite } from '../render/assets.js';

// Ground-anchored obstacles that crash the bike on contact, generated lazily
// per segment exactly like world/scenery.js's rocks/trees and
// world/pickups.js's cash/dividends (seeded per-segment RNG so re-entry
// rebuilds identically, cull-and-evict draw()). No sprite art exists for
// these yet, so they always fall back to the procedural draw below - same
// "sprite optional" contract as Pickup.
//
// Placement mirrors pickups' low/elevated split but inverted toward risk:
// most hazards are low 'rock' obstacles a normal jump clears easily; a
// minority are taller 'barrier' obstacles that only clear near the top of a
// jump's arc, biased into choppier terrain via terrain.localVolatility - the
// same stretches pickups already bias elevated, higher-value pickups into.
// Choppy chart segments end up simultaneously higher-risk and
// higher-reward, instead of hazards being an unrelated bolt-on mechanic.
//
// Like Pickup, `y` is the single anchor used for BOTH drawing and hit
// testing (main.js's hazards.hits() call), not the ground contact point -
// `groundY` is kept separately just so the procedural draw can still root
// the silhouette at the terrain surface.

const SEGMENT = 3000;
const SAFE_START_X = 1600; // no hazard before this - the player needs a runway
const BARRIER_CHANCE = 0.3;

// A grounded bike's axle sits at groundY - WHEEL_R (30, game/bike.js), and
// main.js tests hits with a ~34 radius (HAZARD_HIT_RADIUS), so clearing a
// hazard needs the bike's elevation above ground to exceed anchorHeight +
// HAZARD_HIT_RADIUS. A plain jump (JUMP_IMPULSE=520, GRAVITY=1600 in
// bike.js) peaks ~84.5 above its own launch point (same math pickups.js
// uses for ELEVATED_HEIGHT_MIN) - that ceiling is why BARRIER_ANCHOR's max
// (41 + 34 = 75) sits well under it rather than near the pickup-style 55-90
// band: anything past ~50 would need more lift than a jump can ever produce,
// making some rolls literally uncrossable instead of just hard to time.
// Rock anchors sit low enough that any real hop clears them with room to
// spare; barrier anchors sit high enough that only a jump timed close to its
// own apex when crossing the barrier's x clears it.
const ROCK_ANCHOR_MIN = 10;
const ROCK_ANCHOR_RANGE = 15;
const BARRIER_ANCHOR_MIN = 30;
const BARRIER_ANCHOR_RANGE = 11;

const ROCK_VISUAL_RADIUS = 22;
const BARRIER_VISUAL_WIDTH = 30;
const BARRIER_VISUAL_HEIGHT = 64;
const SPRITE_TARGET_SIZE = 56;

class Hazard {
    constructor(x, groundY, anchorHeight, kind, rng) {
        this.x = x;
        this.groundY = groundY;
        this.y = groundY - anchorHeight;
        this.kind = kind;

        if (kind === 'rock') {
            const n = Math.floor(rng() * 3) + 6;
            this.points = [];
            for (let i = 0; i < n; i++) {
                const a = (Math.PI * 2 / n) * i;
                const r = ROCK_VISUAL_RADIUS * (rng() * 0.3 + 0.85);
                this.points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 });
            }
        }
    }

    draw(ctx) {
        const img = getSprite(this.kind === 'barrier' ? 'hazard.barrier' : 'hazard.rock');
        if (img) {
            const s = SPRITE_TARGET_SIZE / img.width;
            const w = img.width * s, h = img.height * s;
            ctx.drawImage(img, this.x - w / 2, this.groundY - h, w, h);
            return;
        }

        if (this.kind === 'barrier') {
            const w = BARRIER_VISUAL_WIDTH, h = BARRIER_VISUAL_HEIGHT;
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
            ctx.beginPath();
            ctx.moveTo(this.x + this.points[0].x, this.groundY + this.points[0].y);
            for (const p of this.points) ctx.lineTo(this.x + p.x, this.groundY + p.y);
            ctx.closePath();
            ctx.fillStyle = '#7a2f28';
            ctx.strokeStyle = '#3a1512';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
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
        const count = Math.floor(rng() * 3); // 0-2 per segment

        for (let i = 0; i < count; i++) {
            const x = start + rng() * SEGMENT;
            if (x < SAFE_START_X) continue;

            const groundY = this.terrain.sampleY(x);
            const volatility = this.terrain.localVolatility(x);

            const kind = rng() < BARRIER_CHANCE ? 'barrier' : 'rock';
            const anchorHeight = kind === 'barrier'
                ? BARRIER_ANCHOR_MIN + volatility * BARRIER_ANCHOR_RANGE * rng()
                : ROCK_ANCHOR_MIN + rng() * ROCK_ANCHOR_RANGE;

            hazards.push(new Hazard(x, groundY, anchorHeight, kind, rng));
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
