// Procedural fallback for the bike rig (frame/seat/pedals/wheels/headlight),
// used by render/playerSprite.js piece-by-piece whenever the matching sprite
// hasn't been generated yet (see assets/sprites/PROMPTS.md). computeRig() is
// the single source of truth for the bike's geometry - render/playerSprite.js
// and js/drawrider.js both consume its output rather than re-deriving it.

export const WHEEL_R = 30; // wheel radius
const WHEELBASE = 100;
const CRANK_LENGTH = 12;

// Seat/handlebar/crank position, in the same back-wheel-hub-relative world
// space as FRAME_ANCHOR_X/Y (js/render/playerSprite.js) - these were
// measured directly off assets/sprites/player/frame.png (a road-bike frame
// with a long top tube and low, forward drop bars), not derived from a
// formula, because the old SEAT_HEIGHT/HANDLEBAR_HEIGHT constants here
// assumed the previous procedural stick-figure bike and left the sprite-art
// rider floating well above the seat with the legs/torso/headlight all
// anchored to points that don't exist on the new frame art. SEAT_X is
// nudged forward of the saddle's own visual center (which sits under the
// rider's hips at roughly x=-26) because the torso/leg art's arm and leg
// reach were authored against a more upright reference bike than this one -
// splitting the difference gets hands/feet close to the bars/pedals without
// visibly lifting the rider off the seat. Re-measure all three (and the
// headlight offset in drawHeadlight below) if frame.png is regenerated.
const SEAT_X = -18;
const SEAT_Y = -58;
const HANDLEBAR_X = 21.5;
const HANDLEBAR_Y = -66;

export function computeRig(distanceTraveled) {
    const wheel_angle = (distanceTraveled / WHEEL_R) % (2 * Math.PI);
    const pedal_angle = wheel_angle;

    const back_wheel_x = -WHEELBASE / 2;
    const back_wheel_y = 0;
    const front_wheel_x = WHEELBASE / 2;
    const front_wheel_y = 0;
    const seat_x = SEAT_X;
    const seat_y = SEAT_Y;
    const handlebar_x = HANDLEBAR_X;
    const handlebar_y = HANDLEBAR_Y;
    const crank_center_x = -1.5;
    const crank_center_y = -3;

    const pedal_x = crank_center_x + CRANK_LENGTH * Math.cos(pedal_angle);
    const pedal_y = crank_center_y + CRANK_LENGTH * Math.sin(pedal_angle);
    const pedal_x2 = crank_center_x - CRANK_LENGTH * Math.cos(pedal_angle);
    const pedal_y2 = crank_center_y - CRANK_LENGTH * Math.sin(pedal_angle);

    return {
        wheel_angle, pedal_angle,
        back_wheel_x, back_wheel_y, front_wheel_x, front_wheel_y,
        seat_x, seat_y, handlebar_x, handlebar_y,
        crank_center_x, crank_center_y,
        pedal_x, pedal_y, pedal_x2, pedal_y2,
    };
}

export function drawProceduralWheel(ctx, x, y, wheelAngle) {
    const r = WHEEL_R;

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = '#57b799';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#999';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
        const angle = wheelAngle + (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r - 2) * Math.cos(angle), y + (r - 2) * Math.sin(angle));
        ctx.stroke();
    }
}

export function drawBikeFrame(ctx, rig) {
    const {
        seat_x, seat_y, handlebar_x, handlebar_y,
        crank_center_x, crank_center_y,
        pedal_x, pedal_y, pedal_x2, pedal_y2, pedal_angle,
        back_wheel_x, back_wheel_y, front_wheel_x, front_wheel_y,
    } = rig;

    const frameColor = '#0057b7';
    const seatColor = '#663300';
    const pedalColor = '#555';

    // Seat
    ctx.fillStyle = seatColor;
    ctx.beginPath();
    ctx.ellipse(seat_x, seat_y, 10, 4, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Handlebars
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handlebar_x - 8, handlebar_y);
    ctx.lineTo(handlebar_x + 8, handlebar_y);
    ctx.stroke();

    // Pedal cranks
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(
        crank_center_x + CRANK_LENGTH * Math.cos(pedal_angle),
        crank_center_y + CRANK_LENGTH * Math.sin(pedal_angle),
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(
        crank_center_x + CRANK_LENGTH * -Math.cos(pedal_angle),
        crank_center_y + CRANK_LENGTH * -Math.sin(pedal_angle),
    );
    ctx.stroke();

    // Chain ring
    ctx.beginPath();
    ctx.arc(crank_center_x, crank_center_y, 7, 0, 2 * Math.PI);
    ctx.stroke();

    // Pedals
    ctx.fillStyle = pedalColor;
    ctx.beginPath();
    ctx.rect(pedal_x - 4, pedal_y - 1, 8, 2);
    ctx.fill();

    ctx.beginPath();
    ctx.rect(pedal_x2 - 4, pedal_y2 - 1, 8, 2);
    ctx.fill();

    // Chain
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(back_wheel_x, back_wheel_y);
    ctx.lineTo(crank_center_x, crank_center_y);
    ctx.stroke();

    // Frame
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(seat_x, seat_y);
    ctx.lineTo(handlebar_x, handlebar_y + 20);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(front_wheel_x, front_wheel_y);
    ctx.lineTo(handlebar_x, handlebar_y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(back_wheel_x, back_wheel_y);
    ctx.lineTo(seat_x, seat_y);
    ctx.stroke();
}

export function drawHeadlight(ctx, rig, darknessLevel) {
    const headlightIntensity = Math.min(1, darknessLevel);
    const headlightX = rig.handlebar_x - 8; // down at the stem, not the grip
    const headlightY = rig.handlebar_y + 13; // meets where the tube meets the handlebars
    const headlightLength = 520; // how far the light reaches
    const CONE_HALF_ANGLE = Math.PI / 13;
    const spread = headlightLength * Math.tan(CONE_HALF_ANGLE);

    if (headlightIntensity > 0.01) {
        ctx.save();

        const cone = () => {
            ctx.beginPath();
            ctx.moveTo(headlightX, headlightY);
            ctx.lineTo(headlightX + headlightLength, headlightY - spread);
            ctx.lineTo(headlightX + headlightLength, headlightY + spread);
            ctx.closePath();
        };

        cone();
        ctx.clip();

        const gradient = ctx.createLinearGradient(
            headlightX, headlightY,
            headlightX + headlightLength, headlightY,
        );
        gradient.addColorStop(0, `rgba(255, 250, 205, ${0.55 * headlightIntensity})`);
        gradient.addColorStop(0.45, `rgba(255, 250, 205, ${0.22 * headlightIntensity})`);
        gradient.addColorStop(1, 'rgba(255, 250, 205, 0)');

        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = gradient;
        cone();
        ctx.fill();

        ctx.restore();
    }

    // Headlight bulb housing, visible whether lit or not.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(headlightX, headlightY, 5, 0, 2 * Math.PI);
    ctx.fill();

    const bulbGradient = ctx.createRadialGradient(
        headlightX, headlightY, 0,
        headlightX, headlightY, 10,
    );
    bulbGradient.addColorStop(0, `rgba(255, 255, 200, ${0.8 * headlightIntensity})`);
    bulbGradient.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = bulbGradient;
    ctx.beginPath();
    ctx.arc(headlightX, headlightY, 10, 0, 2 * Math.PI);
    ctx.fill();
}
