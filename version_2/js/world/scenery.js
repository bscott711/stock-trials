import { mulberry32 } from '../core/rng.js';
import { getSprite } from '../render/assets.js';
import { BIOME_TALL_SPRITES, BIOME_CLUTTER_SPRITES } from '../render/spriteManifest.js';
import { biomeForRegion, regionIndexAt } from './biome.js';

// Rocks and trees anchored to the terrain surface, generated lazily per
// segment and drawn in WORLD space (the camera transform is already applied).
//
// Differences from the old TerrainAddons:
//  - draw() takes no startX; the camera owns world->screen.
//  - colours are carried as {h,s,l} components rather than formatted strings.
//    The old shadeColor() ran parseInt() over "hsl(...)" strings, which is NaN;
//    since NaN>>16 === 0 it silently returned a constant grey driven only by
//    the percentage, so every rock got the same gradient regardless of colour.
//  - generation is seeded, so the same world rebuilds identically on retry.
//  - Mountain and Beach are gone. Mountains are now parallax silhouettes
//    (see render/parallax.js), which is cheaper and reads as actual distance.

const SEGMENT = 5000;

const hsl = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;
const shade = (c, dl) => hsl(c.h, c.s, Math.max(0, Math.min(100, c.l + dl)));

class Rock {
    constructor(x, y, size, rng, spritePool = []) {
        this.x = x;
        this.y = y;
        this.size = size * (rng() * 0.5 + 0.75);
        this.base = { h: Math.floor(rng() * 10 + 175), s: Math.floor(rng() * 10 + 10), l: Math.floor(rng() * 20 + 55) };
        this.moss = hsl(Math.floor(rng() * 40 + 80), Math.floor(rng() * 30 + 50), Math.floor(rng() * 20 + 30));

        const n = Math.floor(rng() * 4) + 6;
        this.points = [];
        for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 / n) * i;
            const r = this.size * (rng() * 0.3 + 0.85);
            this.points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 });
        }

        this.patches = [];
        const pc = Math.floor(rng() * 3) + 1;
        for (let i = 0; i < pc; i++) {
            const a = rng() * Math.PI * 2;
            const d = this.size * (rng() * 0.5 + 0.4);
            this.patches.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7, size: this.size * (rng() * 0.3 + 0.1) });
        }

        // Biome "clutter" sprite (boulder/driftwood/hay bale/...) this
        // instance may draw instead of the procedural rock, chosen once so
        // it's stable across re-entry. Center-anchored: rock/clutter art
        // reads fine scaled off its own natural width as a stand-in diameter.
        this.spriteId = spritePool.length ? spritePool[Math.floor(rng() * spritePool.length)] : null;
    }

    draw(ctx) {
        const img = this.spriteId && getSprite(this.spriteId);
        if (img) {
            const scale = (this.size * 2) / img.width;
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, this.x - w / 2, this.y - h / 2, w, h);
            return;
        }

        ctx.beginPath();
        ctx.moveTo(this.x + this.points[0].x, this.y + this.points[0].y);
        for (const p of this.points) ctx.lineTo(this.x + p.x, this.y + p.y);
        ctx.closePath();

        const g = ctx.createRadialGradient(
            this.x - this.size * 0.3, this.y - this.size * 0.3, 0,
            this.x, this.y, this.size,
        );
        g.addColorStop(0, shade(this.base, 18));
        g.addColorStop(0.6, hsl(this.base.h, this.base.s, this.base.l));
        g.addColorStop(1, shade(this.base, -22));
        ctx.fillStyle = g;
        ctx.fill();

        ctx.fillStyle = this.moss;
        for (const p of this.patches) {
            ctx.beginPath();
            ctx.arc(this.x + p.x, this.y + p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Tree {
    constructor(x, y, height, rng, spritePool = []) {
        this.x = x;
        this.y = y;
        this.height = height * (rng() * 0.5 + 1.2);
        this.trunkW = this.height / 5;
        this.trunkH = this.height / 2.5;
        this.trunk = hsl(Math.floor(rng() * 10 + 25), Math.floor(rng() * 20 + 60), Math.floor(rng() * 10 + 22));
        const fh = Math.floor(rng() * 20 + 100);
        const fs = Math.floor(rng() * 20 + 45);
        const fl = Math.floor(rng() * 10 + 28);
        this.foliage = { h: fh, s: fs, l: fl };
        this.foliageW = this.height * (rng() * 0.3 + 0.85);
        this.tiers = Math.floor(rng() * 2) + 2;

        // Biome "tall" sprite (pine/palm/dead tree/...) this instance may
        // draw instead of the procedural tiers, chosen once at construction.
        this.spriteId = spritePool.length ? spritePool[Math.floor(rng() * spritePool.length)] : null;
    }

    draw(ctx) {
        const img = this.spriteId && getSprite(this.spriteId);
        if (img) {
            const scale = this.height / img.height;
            const w = img.width * scale;
            ctx.drawImage(img, this.x - w / 2, this.y - this.height, w, this.height);
            return;
        }

        ctx.fillStyle = this.trunk;
        ctx.fillRect(this.x - this.trunkW / 2, this.y - this.trunkH, this.trunkW, this.trunkH);

        // Stacked tiers read as a conifer instead of a single flat triangle.
        for (let i = 0; i < this.tiers; i++) {
            const t = i / this.tiers;
            const w = this.foliageW * (1 - t * 0.45);
            const top = this.y - this.trunkH - (this.height - this.trunkH) * (t + 1 / this.tiers);
            const bot = this.y - this.trunkH - (this.height - this.trunkH) * t;
            ctx.beginPath();
            ctx.moveTo(this.x, top);
            ctx.lineTo(this.x - w / 2, bot);
            ctx.lineTo(this.x + w / 2, bot);
            ctx.closePath();
            ctx.fillStyle = shade(this.foliage, i * 6);
            ctx.fill();
        }
    }
}

export class Scenery {
    constructor(terrain, seed = 0x5EED) {
        this.terrain = terrain;
        this.seed = seed >>> 0;
        this.segments = new Map(); // segmentStart -> { rocks, trees }
    }

    _segment(start) {
        let seg = this.segments.get(start);
        if (seg) return seg;

        // Seed per segment so a segment regenerates identically whether it is
        // reached going forward, or re-entered after being evicted.
        const rng = mulberry32((this.seed ^ Math.imul(start | 0, 0x9E3779B9)) >>> 0);
        const rocks = [];
        const trees = [];

        // One biome per segment (not blended) - trees/rocks are discrete
        // placed objects, so cross-fading two whole object sets near every
        // 5000px segment boundary would cost real generation work for very
        // little payoff. Picked from the segment's midpoint so it lands on
        // whichever side of a region boundary the segment mostly falls in.
        const biome = biomeForRegion(regionIndexAt(start + SEGMENT / 2), this.seed);
        const tallSprites = BIOME_TALL_SPRITES[biome] || [];
        const clutterSprites = BIOME_CLUTTER_SPRITES[biome] || [];

        for (let i = 0; i < 5; i++) {
            if (rng() < 0.3) {
                const cx = start + rng() * SEGMENT;
                const n = Math.floor(rng() * 4) + 3;
                for (let j = 0; j < n; j++) {
                    const x = cx + (rng() - 0.5) * 200;
                    rocks.push(new Rock(x, this.terrain.sampleY(x), rng() * 22 + 8, rng, clutterSprites));
                }
            } else {
                const x = start + rng() * SEGMENT;
                rocks.push(new Rock(x, this.terrain.sampleY(x), rng() * 15 + 8, rng, clutterSprites));
            }
        }

        // Height ranges are well above the rider (~150 world units tall,
        // WHEELBASE_WORLD=100 in tools/build_player_rig.py) so trees read as
        // towering rather than dwarfed by the bike+rider next to them.
        for (let i = 0; i < 3; i++) {
            const x = start + rng() * SEGMENT;
            trees.push(new Tree(x, this.terrain.sampleY(x), rng() * 150 + 100, rng, tallSprites));
        }

        // Forest clumps - shorter than standalone feature trees (denser
        // background mass), but still clearly taller than the rider. fw/fn
        // are sized so the average spacing (fw/fn) comfortably clears a
        // clump tree's own canopy width now that trees are much bigger -
        // at the old fw=300-800/fn=5-14 ranges, average spacing (~58 world
        // units) was already tight for the old small trees and heavily
        // overlapped once tree height (and so canopy width) roughly
        // tripled.
        const fx = start + rng() * (SEGMENT - 1500);
        const fw = rng() * 800 + 700;
        const fn = Math.floor(rng() * 6) + 4;
        for (let j = 0; j < fn; j++) {
            const x = fx + rng() * fw;
            trees.push(new Tree(x, this.terrain.sampleY(x), rng() * 100 + 70, rng, tallSprites));
        }

        seg = { rocks, trees };
        this.segments.set(start, seg);
        return seg;
    }

    draw(ctx, bounds) {
        const first = Math.floor(bounds.left / SEGMENT) * SEGMENT;
        const last = Math.floor(bounds.right / SEGMENT) * SEGMENT;

        const visible = [];
        for (let s = first; s <= last; s += SEGMENT) visible.push(this._segment(s));

        // Trees behind rocks so trunks don't float over boulders.
        for (const seg of visible) {
            for (const t of seg.trees) {
                if (t.x > bounds.left - 100 && t.x < bounds.right + 100) t.draw(ctx);
            }
        }
        for (const seg of visible) {
            for (const r of seg.rocks) {
                if (r.x > bounds.left - 60 && r.x < bounds.right + 60) r.draw(ctx);
            }
        }

        // Bound memory: drop segments well outside the view.
        if (this.segments.size > 12) {
            for (const key of this.segments.keys()) {
                if (key < first - SEGMENT * 2 || key > last + SEGMENT * 2) this.segments.delete(key);
            }
        }
    }
}
