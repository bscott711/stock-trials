import { getSprite } from './assets.js';
import { computeRig, drawBikeFrame, drawProceduralWheel, drawHeadlight } from '../drawbike.js';
import { drawRider } from '../drawrider.js';
import { DustEmitter } from './dust.js';

// Orchestrates the bike+rider draw, branching sprite-vs-procedural per
// piece. Each of the three sprite slots (fused body, front wheel, back
// wheel) degrades independently to its procedural equivalent when its PNG
// hasn't been generated yet - see assets/sprites/PROMPTS.md.
//
// Sprite convention: the fused body image is 320x260, wheel-axle line at
// local y=200, horizontally centered (drawn at -160,-200), with the wheels
// themselves left transparent so the independently-rotating wheel sprites
// underneath show through at local (-50,0)/(50,0) - the same hub positions
// computeRig() already uses for the procedural rig.
const BODY_W = 320;
const BODY_H = 260;
const BODY_ORIGIN_X = 160;
const BODY_ORIGIN_Y = 200;
const WHEEL_SPRITE_SIZE = 80;

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
        drawBikeFrame(ctx, rig);
        drawRider(ctx, rig);
    }

    drawHeadlight(ctx, rig, state.darkness);
    dustEmitter.updateAndDraw(ctx, rig, state);

    return rig;
}

function drawWheel(ctx, x, y, wheelAngle, sprite) {
    if (!sprite) {
        drawProceduralWheel(ctx, x, y, wheelAngle);
        return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(wheelAngle);
    ctx.drawImage(sprite, -WHEEL_SPRITE_SIZE / 2, -WHEEL_SPRITE_SIZE / 2, WHEEL_SPRITE_SIZE, WHEEL_SPRITE_SIZE);
    ctx.restore();
}
