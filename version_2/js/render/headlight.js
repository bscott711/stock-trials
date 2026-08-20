// Geometric (non-sprite) night headlamp, overlaid on the player rig
// regardless of which rig-draw path is active (sprite or procedural
// fallback) - see playerSprite.js. Replaces the old drawHeadlight() in
// drawbike.js, which was fully tuned but never actually called: the fused
// bike+rider rig has no drawn lamp mount point, so there's no honest pixel
// to hang an opaque bulb-housing circle on. This version drops that housing
// entirely and reads purely from light shapes - a forward beam cone (the old
// approach, adapted) plus a new soft diffuse pool of light on the ground
// ahead, which is what actually sells "this is lighting up the environment"
// rather than just casting an abstract shaft into empty space.
//
// Anchored at rig.handlebar_x/y - approximate, not pixel-matched to any
// drawn mount point, but close enough: it sits well inside the rig sprite's
// own silhouette, so the opaque art naturally occludes the cone's base once
// drawn over it.

const CONE_LENGTH = 520;
const CONE_HALF_ANGLE = Math.PI / 13;

const POOL_FORWARD_OFFSET = 70; // ahead of the front wheel
const POOL_RADIUS_X = 130;
const POOL_RADIUS_Y = 24;

/** state = { darkness, airborne, ... } (see playerSprite.js's drawPlayer) */
export function drawHeadlight(ctx, rig, state) {
    const intensity = Math.min(1, state.darkness || 0);
    if (intensity <= 0.01) return;

    const anchorX = rig.handlebar_x;
    const anchorY = rig.handlebar_y;
    const spread = CONE_LENGTH * Math.tan(CONE_HALF_ANGLE);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Forward beam cone.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(anchorX + CONE_LENGTH, anchorY - spread);
    ctx.lineTo(anchorX + CONE_LENGTH, anchorY + spread);
    ctx.closePath();
    ctx.clip();

    const coneGradient = ctx.createLinearGradient(anchorX, anchorY, anchorX + CONE_LENGTH, anchorY);
    coneGradient.addColorStop(0, `rgba(255, 250, 205, ${0.55 * intensity})`);
    coneGradient.addColorStop(0.45, `rgba(255, 250, 205, ${0.22 * intensity})`);
    coneGradient.addColorStop(1, 'rgba(255, 250, 205, 0)');
    ctx.fillStyle = coneGradient;
    ctx.fillRect(anchorX, anchorY - spread, CONE_LENGTH, spread * 2);
    ctx.restore();

    // Diffuse ground-light pool, ahead of the bike - grounded only. Mid-air
    // the bike can rotate freely (flips), and a ground ellipse spinning
    // along with it would look broken, so it's gated on !airborne the same
    // way dust.js already gates wheel-dust emission.
    if (!state.airborne) {
        const poolX = rig.front_wheel_x + POOL_FORWARD_OFFSET;
        const poolY = rig.front_wheel_y;
        ctx.save();
        ctx.translate(poolX, poolY);
        ctx.scale(1, POOL_RADIUS_Y / POOL_RADIUS_X);
        const poolGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, POOL_RADIUS_X);
        poolGradient.addColorStop(0, `rgba(255, 244, 200, ${0.40 * intensity})`);
        poolGradient.addColorStop(0.5, `rgba(255, 244, 200, ${0.18 * intensity})`);
        poolGradient.addColorStop(1, 'rgba(255, 244, 200, 0)');
        ctx.fillStyle = poolGradient;
        ctx.beginPath();
        ctx.arc(0, 0, POOL_RADIUS_X, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}
