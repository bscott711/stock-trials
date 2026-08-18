import { getSprite } from './assets.js';
import { computeRig, drawBikeFrame, drawProceduralWheel, drawHeadlight, drawPedals } from '../drawbike.js';
import { drawRiderUpperBody, drawRiderLegs } from '../drawrider.js';
import { DustEmitter } from './dust.js';
import { PLAYER_LEG_FRAME_COUNT, PLAYER_TORSO_FRAME_COUNT } from './spriteManifest.js';

// Orchestrates the bike+rider draw, branching sprite-vs-procedural per
// piece. Each sprite slot degrades independently to its procedural
// equivalent when its PNG hasn't been generated yet - see
// assets/sprites/PROMPTS.md.
//
// Two body conventions are supported, tried in this order:
//  1. A single fused 320x260 body image (torso+arms+head+bike frame, no
//     legs, no wheels) - the original plan, for a from-scratch art pass.
//  2. Procedural bike frame + a separate torso sprite - for a kit-of-parts
//     art pass like the current one, where frame-only art doesn't exist yet
//     but torso/legs/wheels do.
// Legs are always their own layer either way, since (unlike the wheels) a
// single leg image can't be rotated to fake pedaling - a bent leg doesn't
// look right spun around a pivot the way a symmetric wheel does. Same
// reasoning is why the torso gets its own small cycle instead of being
// baked into whichever body path is active.
const BODY_W = 320;
const BODY_H = 260;
const BODY_ORIGIN_X = 160;
const BODY_ORIGIN_Y = 200;

// Anchor offsets below are baked into the CURRENT art batch by
// tools/build_player_sprites.py (see assets/sprites/player/FullSprite.png):
// every legs-N.png shares one hip pixel position, every torso-N.png shares
// one hip/seat pixel position, and wheel-front/back.png are exactly
// centered - so the game only needs one constant per group instead of
// per-frame data. Regenerate via that script (which reprints these numbers)
// if the art changes enough to shift them.
const LEG_ANCHOR_X = 13.2;
const LEG_ANCHOR_Y = 4.0;
const TORSO_ANCHOR_X = 24.4;
const TORSO_ANCHOR_Y = 84.0;

// frame.png is built by tools/build_bike_frame.py from a full bike
// reference image: it locates the two wheels, derives a scale from the
// wheelbase, and cuts them out (the game already has separately-rotating
// wheel sprites - keeping the frame's own static ones would hide those).
// This anchor is the back wheel's hub position in the cut/scaled image, so
// the frame lands with both hub holes exactly on rig.back_wheel_x/y and
// rig.front_wheel_x/y (100 world units apart, matching WHEELBASE).
const FRAME_ANCHOR_X = 36.52;
const FRAME_ANCHOR_Y = 78.19;

const dustEmitter = new DustEmitter();

/** state = { distance, darkness, airborne, justLanded } */
export function drawPlayer(ctx, state) {
    const rig = computeRig(state.distance);

    drawWheel(ctx, rig.back_wheel_x, rig.back_wheel_y, rig.wheel_angle, getSprite('player.wheelBack'));
    drawWheel(ctx, rig.front_wheel_x, rig.front_wheel_y, rig.wheel_angle, getSprite('player.wheelFront'));

    const body = getSprite('player.bikeRider');
    if (body) {
        ctx.drawImage(body, -BODY_ORIGIN_X, -BODY_ORIGIN_Y, BODY_W, BODY_H);
    } else {
        drawFrame(ctx, rig);
        drawTorso(ctx, rig);
    }

    // Legs drawn last (on top), matching the reference art where the leg
    // overlaps the frame's down tube rather than sitting behind it.
    drawLegs(ctx, rig);

    drawHeadlight(ctx, rig, state.darkness);
    dustEmitter.updateAndDraw(ctx, rig, state);

    return rig;
}

/** Index 0..count-1 from pedal_angle, evenly split around one full crank rotation. */
function angleFrameIndex(pedalAngle, count) {
    const normalized = ((pedalAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return Math.min(count - 1, Math.floor((normalized / (2 * Math.PI)) * count));
}

function drawFrame(ctx, rig) {
    const frameSprite = getSprite('player.frame');

    if (frameSprite) {
        ctx.drawImage(
            frameSprite,
            rig.back_wheel_x - FRAME_ANCHOR_X, rig.back_wheel_y - FRAME_ANCHOR_Y,
            frameSprite.width, frameSprite.height,
        );
        // frame.png bakes a static, non-rotating crank graphic - draw the
        // real rotating pedals over it (drawBikeFrame's procedural fallback
        // already includes them, so this only applies to the sprite path).
        drawPedals(ctx, rig);
    } else {
        drawBikeFrame(ctx, rig);
    }
}

function drawTorso(ctx, rig) {
    const frameIndex = angleFrameIndex(rig.pedal_angle, PLAYER_TORSO_FRAME_COUNT);
    const torsoSprite = getSprite(`player.torso${frameIndex}`);

    if (torsoSprite) {
        ctx.drawImage(
            torsoSprite,
            rig.seat_x - TORSO_ANCHOR_X, rig.seat_y - TORSO_ANCHOR_Y,
            torsoSprite.width, torsoSprite.height,
        );
    } else {
        drawRiderUpperBody(ctx, rig);
    }
}

function drawLegs(ctx, rig) {
    const frameIndex = angleFrameIndex(rig.pedal_angle, PLAYER_LEG_FRAME_COUNT);
    const legSprite = getSprite(`player.legs${frameIndex}`);

    if (legSprite) {
        ctx.drawImage(
            legSprite,
            rig.seat_x - LEG_ANCHOR_X, rig.seat_y - LEG_ANCHOR_Y,
            legSprite.width, legSprite.height,
        );
    } else {
        drawRiderLegs(ctx, rig);
    }
}

function drawWheel(ctx, x, y, wheelAngle, sprite) {
    if (!sprite) {
        drawProceduralWheel(ctx, x, y, wheelAngle);
        return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wheelAngle);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
    ctx.restore();
}
