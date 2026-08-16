import { hash01 } from '../core/rng.js';

// The ride surface, drawn in world space under the camera transform.
//
// The old grass was pre-baked against the terrain for world-X 0..2*canvasWidth
// and then TILED periodically. That is a category error - you can only tile
// something that is actually periodic - so past two screens the blades floated
// over valleys and sank into hills, and negative world X left a bare gap.
//
// Here each blade is a pure function of its integer slot index: stable frame to
// frame, correct at any world position including negative, and needing no cache.

const BLADE_SPACING = 7;
const SURFACE_STEP = 8;

export function drawGround(ctx, terrain, bounds) {
    const left = Math.floor(bounds.left / SURFACE_STEP) * SURFACE_STEP - SURFACE_STEP;
    const right = bounds.right + SURFACE_STEP;
    const bottom = bounds.bottom + 200;

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
    g.addColorStop(0, '#4a7c30');
    g.addColorStop(0.35, '#3d6428');
    g.addColorStop(1, '#2a3f22');
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
    ctx.fillStyle = '#5c8f38';
    ctx.fill();
    ctx.restore();

    // Surface line
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.strokeStyle = '#24381c';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    drawGrass(ctx, terrain, left, right);
}

function drawGrass(ctx, terrain, left, right) {
    const first = Math.floor(left / BLADE_SPACING);
    const last = Math.ceil(right / BLADE_SPACING);

    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';

    for (let i = first; i <= last; i++) {
        const x = i * BLADE_SPACING + hash01(i, 1) * BLADE_SPACING;
        const y = terrain.sampleY(x);

        const r1 = hash01(i, 2);
        const r2 = hash01(i, 3);
        const r3 = hash01(i, 4);

        const height = 7 + r1 * 9;
        // Lean blades with the local slope so they sprout out of the hill
        // rather than all leaning the same way regardless of terrain.
        const slope = terrain.sampleSlope(x);
        const lean = (r2 - 0.5) * 0.9 - slope * 0.5;

        const tipX = x + lean * height;
        const tipY = y - height;

        ctx.beginPath();
        ctx.moveTo(x, y + 1);
        ctx.quadraticCurveTo(x + lean * height * 0.3, y - height * 0.6, tipX, tipY);
        ctx.strokeStyle = `rgb(${Math.round(60 + r3 * 40)}, ${Math.round(130 + r3 * 70)}, ${Math.round(45 + r3 * 30)})`;
        ctx.stroke();
    }
}
