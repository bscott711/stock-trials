import { mulberry32 } from '../core/rng.js';
import { getSprite } from '../render/assets.js';
import { BIOME_ANIMAL_SPECIES } from '../render/spriteManifest.js';
import { biomeForRegion, regionIndexAt } from './biome.js';

// Foreground silhouettes glimpsed in the space below the rideable path -
// purely decorative depth accents, generated lazily per segment exactly
// like Scenery's rocks/trees, but deliberately NOT sharing the playfield's
// exact camera transform (see render/renderer.js's ANIMAL_PARALLAX): these
// are a separate depth plane below the real ground, not standing on it, so
// a small screen-position drift from the rideable surface as the camera
// moves is the intended depth cue here, not something to avoid the way
// Rock/Tree must stay pixel-locked to terrain.sampleY().
//
// No update(), no hits() - static position, no bike interaction, no
// collision, no scoring. Just depth.

const SEGMENT = 6000;
const FOREGROUND_DROP_MIN = 20; // world-units below the local ground sample
const FOREGROUND_DROP_RANGE = 50;

const hsl = (h, s, l) => `hsl(${h}, ${s}%, ${l}%)`;

// One shared silhouette routine parameterized per kind, rather than eight
// fully bespoke shapes - same effort level as Rock/Tree's own procedural
// draw in world/scenery.js.
const SILHOUETTE_RECIPES = {
    rabbit: { hue: 30, legs: 2, feature: 'ears' },
    sheep: { hue: 40, legs: 4, feature: 'wool' },
    deer: { hue: 25, legs: 4, feature: 'antlers' },
    fox: { hue: 20, legs: 4, feature: 'tail' },
    seagull: { hue: 0, sat: 0, legs: 2, feature: 'wings' },
    crab: { hue: 10, legs: 4, feature: 'claws' },
    goat: { hue: 35, legs: 4, feature: 'horns' },
    marmot: { hue: 28, legs: 4, feature: 'none' },
};

function drawAnimalSilhouette(ctx, x, groundY, height, kind) {
    const recipe = SILHOUETTE_RECIPES[kind] || SILHOUETTE_RECIPES.rabbit;
    const bodyColor = hsl(recipe.hue, recipe.sat ?? 35, 32);
    const w = height * 1.1;
    const bodyRx = w * 0.4, bodyRy = height * 0.28;
    const bodyCx = x, bodyCy = groundY - bodyRy;
    const headR = height * 0.16;
    const headCx = x + bodyRx * 0.75, headCy = bodyCy - bodyRy * 0.7;

    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = hsl(recipe.hue, recipe.sat ?? 35, 16);
    ctx.lineWidth = 1.5;

    // Legs, drawn first so the body/head overlap their tops.
    const legCount = recipe.legs;
    for (let i = 0; i < legCount; i++) {
        const lx = x - bodyRx * 0.6 + (bodyRx * 1.2 * i) / Math.max(1, legCount - 1);
        ctx.beginPath();
        ctx.moveTo(lx, bodyCy + bodyRy * 0.6);
        ctx.lineTo(lx, groundY);
        ctx.stroke();
    }

    // Body.
    ctx.beginPath();
    ctx.ellipse(bodyCx, bodyCy, bodyRx, bodyRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Head.
    ctx.beginPath();
    ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // One distinguishing feature.
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = hsl(recipe.hue, recipe.sat ?? 35, 16);
    if (recipe.feature === 'ears') {
        ctx.beginPath();
        ctx.moveTo(headCx - headR * 0.4, headCy - headR * 0.6);
        ctx.lineTo(headCx - headR * 0.6, headCy - headR * 2.2);
        ctx.lineTo(headCx - headR * 0.1, headCy - headR * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (recipe.feature === 'antlers') {
        ctx.beginPath();
        ctx.moveTo(headCx, headCy - headR * 0.8);
        ctx.lineTo(headCx - headR * 0.5, headCy - headR * 2.4);
        ctx.moveTo(headCx, headCy - headR * 0.8);
        ctx.lineTo(headCx + headR * 0.3, headCy - headR * 2.2);
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (recipe.feature === 'horns') {
        ctx.beginPath();
        ctx.moveTo(headCx - headR * 0.3, headCy - headR * 0.8);
        ctx.quadraticCurveTo(headCx - headR * 1.3, headCy - headR * 1.3, headCx - headR * 0.9, headCy - headR * 2);
        ctx.lineWidth = 2;
        ctx.stroke();
    } else if (recipe.feature === 'tail') {
        ctx.beginPath();
        ctx.moveTo(x - bodyRx, bodyCy);
        ctx.quadraticCurveTo(x - bodyRx * 1.6, bodyCy - bodyRy, x - bodyRx * 1.3, bodyCy - bodyRy * 1.6);
        ctx.lineWidth = height * 0.12;
        ctx.strokeStyle = bodyColor;
        ctx.stroke();
    } else if (recipe.feature === 'wool') {
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(bodyCx - bodyRx * 0.4 + bodyRx * 0.4 * i, bodyCy - bodyRy * 0.5, bodyRy * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (recipe.feature === 'wings') {
        ctx.beginPath();
        ctx.moveTo(bodyCx, bodyCy - bodyRy * 0.3);
        ctx.lineTo(bodyCx - bodyRx * 0.6, bodyCy - bodyRy);
        ctx.lineTo(bodyCx - bodyRx * 0.2, bodyCy);
        ctx.closePath();
        ctx.fill();
    } else if (recipe.feature === 'claws') {
        ctx.beginPath();
        ctx.arc(headCx + headR * 0.8, headCy, headR * 0.5, 0, Math.PI * 2);
        ctx.arc(headCx - headR * 0.4, headCy - headR * 0.3, headR * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Animal {
    constructor(x, groundY, height, kind, spriteId) {
        this.x = x;
        this.groundY = groundY;
        this.height = height;
        this.kind = kind;
        this.spriteId = spriteId;
    }

    draw(ctx) {
        const img = this.spriteId && getSprite(this.spriteId);
        if (img) {
            // Bottom-anchored and scaled by height, like Tree in
            // world/scenery.js.
            const scale = this.height / img.height;
            const w = img.width * scale;
            ctx.drawImage(img, this.x - w / 2, this.groundY - this.height, w, this.height);
            return;
        }
        drawAnimalSilhouette(ctx, this.x, this.groundY, this.height, this.kind);
    }
}

export class AnimalField {
    constructor(terrain, seed = 0xA7A1F) {
        this.terrain = terrain;
        this.seed = seed >>> 0;
        this.segments = new Map(); // segmentStart -> Animal[]
    }

    _segment(start) {
        let seg = this.segments.get(start);
        if (seg) return seg;

        const rng = mulberry32((this.seed ^ Math.imul(start | 0, 0x27D4EB2F)) >>> 0);
        const animals = [];

        const biome = biomeForRegion(regionIndexAt(start + SEGMENT / 2), this.seed);
        const pool = BIOME_ANIMAL_SPECIES[biome] || [];

        if (pool.length) {
            const spawnCount = rng() < 0.4 ? (rng() < 0.1 ? 2 : 1) : 0;
            for (let i = 0; i < spawnCount; i++) {
                const species = pool[Math.floor(rng() * pool.length)];
                const spriteId = species.sprites.length
                    ? species.sprites[Math.floor(rng() * species.sprites.length)]
                    : null;
                const height = species.heightMin + rng() * species.heightRange;
                const x = start + rng() * SEGMENT;
                const groundY = this.terrain.sampleY(x) + FOREGROUND_DROP_MIN + rng() * FOREGROUND_DROP_RANGE;
                animals.push(new Animal(x, groundY, height, species.kind, spriteId));
            }
        }

        seg = animals;
        this.segments.set(start, seg);
        return seg;
    }

    draw(ctx, bounds) {
        const first = Math.floor(bounds.left / SEGMENT) * SEGMENT;
        const last = Math.floor(bounds.right / SEGMENT) * SEGMENT;

        for (let s = first; s <= last; s += SEGMENT) {
            for (const a of this._segment(s)) {
                if (a.x > bounds.left - 80 && a.x < bounds.right + 80) a.draw(ctx);
            }
        }

        // Bound memory, same as Scenery.draw()/HazardField.draw().
        if (this.segments.size > 12) {
            for (const key of this.segments.keys()) {
                if (key < first - SEGMENT * 2 || key > last + SEGMENT * 2) this.segments.delete(key);
            }
        }
    }
}
