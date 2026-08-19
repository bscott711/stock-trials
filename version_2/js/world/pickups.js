import { mulberry32 } from '../core/rng.js';
import { getSprite } from '../render/assets.js';

// Cash and dividend pickups scattered along the terrain, generated lazily per
// segment exactly like world/scenery.js's rocks and trees (seeded per-segment
// RNG so re-entry rebuilds identically, cull-and-evict draw()). No sprite art
// exists for these yet, so they always fall back to the procedural draw below
// - same "sprite optional" contract as Rock/Tree in scenery.js.
//
// Placement is theme-driven: most pickups sit low enough to collect just by
// riding through, but a chunk sit elevated over choppy terrain (scaled by
// terrain.localVolatility), so reaching them takes a real jump - routing over
// the terrain's own intraday noise instead of around it.

const SEGMENT = 2500;
const CASH_VALUE = 10;
const DIVIDEND_VALUE = 50;
const ELEVATED_CHANCE = 0.4;

class Pickup {
    constructor(x, y, value, kind) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.kind = kind;
        this.collected = false;
    }

    draw(ctx) {
        if (this.collected) return;

        const img = getSprite(this.kind === 'dividend' ? 'pickup.dividend' : 'pickup.cash');
        if (img) {
            const s = 28 / img.width;
            const w = img.width * s, h = img.height * s;
            ctx.drawImage(img, this.x - w / 2, this.y - h, w, h);
            return;
        }

        if (this.kind === 'dividend') {
            ctx.fillStyle = '#2e8b46';
            ctx.strokeStyle = '#1c5c2c';
            ctx.lineWidth = 2;
            ctx.fillRect(this.x - 16, this.y - 34, 32, 20);
            ctx.strokeRect(this.x - 16, this.y - 34, 32, 20);
            ctx.fillStyle = '#eafff0';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', this.x, this.y - 24);
        } else {
            ctx.fillStyle = '#f4c542';
            ctx.strokeStyle = '#a8791a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y - 22, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#7a5410';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', this.x, this.y - 22);
        }
    }
}

export class PickupField {
    constructor(terrain, seed = 0xCA5411) {
        this.terrain = terrain;
        this.seed = seed >>> 0;
        this.segments = new Map(); // segmentStart -> Pickup[]
    }

    _segment(start) {
        let seg = this.segments.get(start);
        if (seg) return seg;

        const rng = mulberry32((this.seed ^ Math.imul(start | 0, 0x85EBCA6B)) >>> 0);
        const pickups = [];
        const count = Math.floor(rng() * 4) + 3; // 3-6 per segment

        for (let i = 0; i < count; i++) {
            const x = start + rng() * SEGMENT;
            const groundY = this.terrain.sampleY(x);
            const volatility = this.terrain.localVolatility(x);

            if (rng() < ELEVATED_CHANCE) {
                const height = 30 + volatility * 130 * rng();
                pickups.push(new Pickup(x, groundY - height, DIVIDEND_VALUE, 'dividend'));
            } else {
                pickups.push(new Pickup(x, groundY - rng() * 30, CASH_VALUE, 'cash'));
            }
        }

        seg = pickups;
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
            for (const p of seg) {
                if (p.x > bounds.left - 40 && p.x < bounds.right + 40) p.draw(ctx);
            }
        }

        // Bound memory, same as Scenery.draw().
        if (this.segments.size > 12) {
            const first = Math.floor(bounds.left / SEGMENT) * SEGMENT;
            const last = Math.floor(bounds.right / SEGMENT) * SEGMENT;
            for (const key of this.segments.keys()) {
                if (key < first - SEGMENT * 2 || key > last + SEGMENT * 2) this.segments.delete(key);
            }
        }
    }

    /** Collect any uncollected pickup within radius of (x, y). Returns the newly-collected ones. */
    collectAt(x, y, radius) {
        const collected = [];
        for (const seg of this._segmentsInRange(x - radius, x + radius)) {
            for (const p of seg) {
                if (p.collected) continue;
                const dx = p.x - x, dy = p.y - y;
                if (dx * dx + dy * dy <= radius * radius) {
                    p.collected = true;
                    collected.push(p);
                }
            }
        }
        return collected;
    }
}
