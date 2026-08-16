import { hash01 } from '../core/rng.js';
import { lerpColor, rgb } from '../core/math.js';
import { biomeBlendAt, BIOME_DEFS } from '../world/biome.js';

// The ride surface, drawn in world space under the camera transform.
//
// The old grass was pre-baked against the terrain for world-X 0..2*canvasWidth
// and then TILED periodically. That is a category error - you can only tile
// something that is actually periodic - so past two screens the blades floated
// over valleys and sank into hills, and negative world X left a bare gap.
//
// Here each blade is a pure function of its integer slot index: stable frame to
// frame, correct at any world position including negative, and needing no cache.
// The same reasoning is why biome texture stays procedural instead of a tiled
// sprite: an infinite, arbitrarily sloped surface has nothing periodic to tile.

const BLADE_SPACING = 7;
const SURFACE_STEP = 8;

export function drawGround(ctx, terrain, bounds, seed) {
    const left = Math.floor(bounds.left / SURFACE_STEP) * SURFACE_STEP - SURFACE_STEP;
    const right = bounds.right + SURFACE_STEP;
    const bottom = bounds.bottom + 200;

    // One coarse sample for the whole visible span - the body fill is a
    // single vertical CanvasGradient and can't represent a horizontal
    // transition anyway, so a per-blade-exact blend here would be wasted
    // precision. The texture pass below blends per-position instead.
    const blend = biomeBlendAt((bounds.left + bounds.right) / 2, seed);
    const groundFrom = BIOME_DEFS[blend.from].ground;
    const groundTo = BIOME_DEFS[blend.to].ground;
    const ground = {
        top: lerpColor(groundFrom.top, groundTo.top, blend.t),
        mid: lerpColor(groundFrom.mid, groundTo.mid, blend.t),
        bottom: lerpColor(groundFrom.bottom, groundTo.bottom, blend.t),
        topsoil: lerpColor(groundFrom.topsoil, groundTo.topsoil, blend.t),
        outline: lerpColor(groundFrom.outline, groundTo.outline, blend.t),
    };

    // Surface polyline, reused for the fill and the outline.
    const pts = [];
    for (let x = left; x <= right; x += SURFACE_STEP) {
        pts.push([x, terrain.sampleY(x)]);
    }

    // Body
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottom);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], bottom);
    ctx.closePath();

    const top = bounds.top;
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, rgb(ground.top));
    g.addColorStop(0.35, rgb(ground.mid));
    g.addColorStop(1, rgb(ground.bottom));
    ctx.fillStyle = g;
    ctx.fill();

    // Topsoil band hugging the surface, so the ground reads as layered
    // rather than one flat colour.
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 26);
    ctx.closePath();
    ctx.fillStyle = rgb(ground.topsoil);
    ctx.fill();
    ctx.restore();

    // Surface line
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.strokeStyle = rgb(ground.outline);
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    drawGroundTexture(ctx, terrain, left, right, seed);
}

function drawGroundTexture(ctx, terrain, left, right, seed) {
    const first = Math.floor(left / BLADE_SPACING);
    const last = Math.ceil(right / BLADE_SPACING);

    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';

    for (let i = first; i <= last; i++) {
        const x = i * BLADE_SPACING + hash01(i, 1) * BLADE_SPACING;

        // Per-slot stochastic dissolve: near a biome boundary, individual
        // blades resolve to whichever side wins a weighted coin flip, so the
        // mix of "from" and "to" texture shifts gradually across the
        // transition band instead of hard-cutting at one x.
        const blend = biomeBlendAt(x, seed);
        const texture = hash01(i, 6) < blend.t
            ? BIOME_DEFS[blend.to].texture
            : BIOME_DEFS[blend.from].texture;

        if (hash01(i, 5) > texture.density) continue;

        const y = terrain.sampleY(x);
        const r1 = hash01(i, 2);
        const r2 = hash01(i, 3);
        const r3 = hash01(i, 4);
        const slope = terrain.sampleSlope(x);

        ctx.strokeStyle = texture.color(r3);
        ctx.fillStyle = texture.color(r3);
        drawTextureMark(ctx, texture.shape, x, y, slope, r1, r2);
    }
}

function drawTextureMark(ctx, shape, x, y, slope, r1, r2) {
    switch (shape) {
        case 'needle': {
            // Short, mostly-straight pine-needle litter.
            const height = 5 + r1 * 6;
            const lean = (r2 - 0.5) * 1.4 - slope * 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y + 1);
            ctx.lineTo(x + lean * height, y - height);
            ctx.stroke();
            break;
        }
        case 'stipple': {
            // Sand grains: small dots, no lean.
            const r = 0.6 + r1 * 1.1;
            ctx.beginPath();
            ctx.arc(x, y - r, r, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'scree': {
            // Small angular rock chips.
            const len = 3 + r1 * 4;
            const angle = (r2 - 0.5) * Math.PI * 0.8;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(angle) * len, y - Math.sin(angle) * len);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len - len * 0.4);
            ctx.stroke();
            break;
        }
        case 'blade':
        default: {
            const height = 7 + r1 * 9;
            // Lean blades with the local slope so they sprout out of the hill
            // rather than all leaning the same way regardless of terrain.
            const lean = (r2 - 0.5) * 0.9 - slope * 0.5;
            const tipX = x + lean * height;
            const tipY = y - height;
            ctx.beginPath();
            ctx.moveTo(x, y + 1);
            ctx.quadraticCurveTo(x + lean * height * 0.3, y - height * 0.6, tipX, tipY);
            ctx.stroke();
            break;
        }
    }
}
