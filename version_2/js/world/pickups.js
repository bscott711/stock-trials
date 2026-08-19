import { mulberry32 } from '../core/rng.js';
import { getSprite } from '../render/assets.js';

// Cash and dividend pickups scattered along the terrain, generated lazily per
// segment exactly like world/scenery.js's rocks and trees (seeded per-segment
// RNG so re-entry rebuilds identically, cull-and-evict draw()). No sprite art
// exists for these yet, so they always fall back to the procedural draw below
// - same "sprite optional" contract as Rock/Tree in scenery.js.
//
// Placement is theme-driven: a minority of pickups sit low enough to collect
// just by riding through, but most sit elevated over choppy terrain (scaled
// by terrain.localVolatility), so reaching them takes a real jump - routing
// over the terrain's own intraday noise instead of around it. Elevation and
// kind (cash vs. the rarer, higher-value dividend) are rolled independently,
// so jump-gating applies to both, not just the high-value one.

const SEGMENT = 2500;
const CASH_VALUE = 10;
const DIVIDEND_VALUE = 50;
const DIVIDEND_CHANCE = 0.35;
const ELEVATED_CHANCE = 0.65;

// A grounded bike sits at groundY - WHEEL_R (30) and main.js collects within
// a 60px radius, so anything up to ~90 above ground is grabbable without
// ever leaving the ground. ELEVATED_HEIGHT_MIN clears that with margin - a
// plain jump (JUMP_IMPULSE=520, GRAVITY=1600 in game/bike.js) peaks ~84.5
// above its own launch point, so this band is reachable with real timing,
// not free.
const LOW_HEIGHT_MIN = 20;
const LOW_HEIGHT_RANGE = 30;
const ELEVATED_HEIGHT_MIN = 100;
const ELEVATED_HEIGHT_RANGE = 95;

// Procedural draw sizes (no sprite art exists for these yet).
const COIN_RADIUS = 20;
const DIVIDEND_W = 52;
const DIVIDEND_H = 34;
const SPRITE_TARGET_SIZE = 48;

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
            const s = SPRITE_TARGET_SIZE / img.width;
            const w = img.width * s, h = img.height * s;
            ctx.drawImage(img, this.x - w / 2, this.y - h, w, h);
            return;
        }

        if (this.kind === 'dividend') {
            const w = DIVIDEND_W, h = DIVIDEND_H;
            ctx.fillStyle = '#2e8b46';
            ctx.strokeStyle = '#1c5c2c';
            ctx.lineWidth = 3;
            ctx.fillRect(this.x - w / 2, this.y - h, w, h);
            ctx.strokeRect(this.x - w / 2, this.y - h, w, h);
            ctx.fillStyle = '#eafff0';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', this.x, this.y - h / 2);
        } else {
            const r = COIN_RADIUS;
            ctx.fillStyle = '#f4c542';
            ctx.strokeStyle = '#a8791a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x, this.y - r, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#7a5410';
            ctx.font = 'bold 22px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', this.x, this.y - r);
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

            const kind = rng() < DIVIDEND_CHANCE ? 'dividend' : 'cash';
            const value = kind === 'dividend' ? DIVIDEND_VALUE : CASH_VALUE;

            const height = rng() < ELEVATED_CHANCE
                ? ELEVATED_HEIGHT_MIN + volatility * ELEVATED_HEIGHT_RANGE * rng()
                : LOW_HEIGHT_MIN + rng() * LOW_HEIGHT_RANGE;

            pickups.push(new Pickup(x, groundY - height, value, kind));
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
