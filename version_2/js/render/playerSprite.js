import { getSprite } from './assets.js';
import { computeRig, drawBikeFrame, drawProceduralWheel } from '../drawbike.js';
import { drawRiderUpperBody, drawRiderLegs } from '../drawrider.js';
import { DustEmitter } from './dust.js';
import { PLAYER_RIG_FRAME_COUNT } from './spriteManifest.js';

// The whole bike+rider is one fused sprite per pedal-angle bucket (see
// spriteManifest.js for why) - drawPlayer just picks the right frame and
// blits it, or falls all the way back to the bare procedural rider+bike
// when no rig art has been generated yet.

// Back-wheel-hub pixel position shared by every rig-N.png (printed by
// tools/build_player_rig.py as RIG_ANCHOR_X/Y - re-run it and paste the new
// values here if the source clip changes). Anchoring on the hub, same as
// the wheels themselves, is what keeps the frame's wheels lined up with
// rig.back_wheel_x/y under the bike's own lean/rotation transform in
// main.js.
const RIG_ANCHOR_X = 32.62;
const RIG_ANCHOR_Y = 122.26;

// Headlight is dropped for now: this BMX-style rig has no drawn mount point
// for one (unlike the old bike), so there's nowhere honest to anchor the
// light. Revisit if/when a reference frame has one built in.

const dustEmitter = new DustEmitter();

/** state = { distance, darkness, airborne, justLanded, justCrashed, justCollected } */
export function drawPlayer(ctx, state) {
    const rig = computeRig(state.distance);

    const frameIndex = angleFrameIndex(rig.pedal_angle, PLAYER_RIG_FRAME_COUNT);
    const rigSprite = getSprite(`player.rig${frameIndex}`);

    if (rigSprite) {
        ctx.drawImage(
            rigSprite,
            rig.back_wheel_x - RIG_ANCHOR_X, rig.back_wheel_y - RIG_ANCHOR_Y,
            rigSprite.width, rigSprite.height,
        );
    } else {
        drawProceduralWheel(ctx, rig.back_wheel_x, rig.back_wheel_y, rig.wheel_angle);
        drawProceduralWheel(ctx, rig.front_wheel_x, rig.front_wheel_y, rig.wheel_angle);
        drawBikeFrame(ctx, rig);
        drawRiderUpperBody(ctx, rig);
        drawRiderLegs(ctx, rig);
    }

    dustEmitter.updateAndDraw(ctx, rig, state);

    return rig;
}

/** Index 0..count-1 from pedal_angle, evenly split around one full crank rotation. */
function angleFrameIndex(pedalAngle, count) {
    const normalized = ((pedalAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return Math.min(count - 1, Math.floor((normalized / (2 * Math.PI)) * count));
}
