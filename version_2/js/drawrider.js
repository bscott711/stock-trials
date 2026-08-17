// Split from one drawRider() into two pieces so each can independently be a
// sprite or the procedural fallback (see render/playerSprite.js). Upper body
// (head/hair/hat/torso/arms) barely moves while riding, so one static image
// works fine there - but legs actually pedal in a circle, which a single
// static image or a naively-rotated image can't fake (a wheel looks the same
// from any angle; a bent leg doesn't). Legs get their own function so they
// can be swapped between multiple pose frames driven by pedal_angle instead.

const RIDER_COLOR = '#444444';
const HAIR_COLOR = '#8B4513';
const HAT_COLOR = '#3A5F8F';
const GLOW_COLOR = 'rgba(255, 255, 255, 0.1)'; // Faint glow
const EYE_COLOR = '#FFFFFF';
const FACE_DETAIL_COLOR = '#000000';

const HEAD_R = 20;
const TORSO_LENGTH = 60;
const LEG_LENGTH1 = 45; // upper leg
const LEG_LENGTH2 = 45; // lower leg

export function drawRiderUpperBody(ctx, rig) {
    const { seat_x, seat_y, handlebar_x, handlebar_y } = rig;

    // Rider positions
    const head_x = seat_x - 2;
    const head_y = seat_y - TORSO_LENGTH - HEAD_R;
    const shoulder_x = head_x;
    const shoulder_y = head_y + HEAD_R * 1.5;

    const vector_x = handlebar_x - shoulder_x;
    const vector_y = handlebar_y - shoulder_y;
    const norm = Math.sqrt(vector_x * vector_x + vector_y * vector_y);
    const unit_vector_x = vector_x / norm;
    const unit_vector_y = vector_y / norm;
    const arm_length1 = norm * 0.5;
    const arm_length2 = norm * 0.55;
    const elbow_offset_factor = 0.2;
    const perpendicular_x = -unit_vector_y;
    const perpendicular_y = unit_vector_x;
    const elbow_x = shoulder_x + unit_vector_x * arm_length1 + perpendicular_x * elbow_offset_factor * arm_length1;
    const elbow_y = shoulder_y + unit_vector_y * arm_length2 + perpendicular_y * elbow_offset_factor * arm_length2;

    // Glow effect around body (drawn first)
    ctx.strokeStyle = GLOW_COLOR;
    ctx.lineWidth = 6;

    // Head glow
    ctx.beginPath();
    ctx.arc(head_x, head_y, HEAD_R + 2, 0, 2 * Math.PI);
    ctx.stroke();

    // Torso glow
    ctx.beginPath();
    ctx.moveTo(head_x, head_y + HEAD_R);
    ctx.lineTo(seat_x, seat_y);
    ctx.stroke();

    // Arms glow
    ctx.beginPath();
    ctx.moveTo(shoulder_x, shoulder_y);
    ctx.lineTo(elbow_x, elbow_y);
    ctx.lineTo(handlebar_x, handlebar_y);
    ctx.stroke();

    // Actual body drawing
    ctx.strokeStyle = RIDER_COLOR;
    ctx.lineWidth = 2;

    // Filled head
    ctx.beginPath();
    ctx.arc(head_x, head_y, HEAD_R, 0, 2 * Math.PI);
    ctx.fillStyle = RIDER_COLOR;
    ctx.fill();
    ctx.stroke();

    // Face features - profile view
    const face_direction = 1; // Looking right

    // Nose
    ctx.strokeStyle = FACE_DETAIL_COLOR;
    ctx.beginPath();
    ctx.moveTo(head_x + face_direction * HEAD_R * 0.5, head_y - HEAD_R * 0.35);
    ctx.quadraticCurveTo(
        head_x + face_direction * HEAD_R * 0.9,
        head_y + HEAD_R * 0.3,
        head_x + face_direction * HEAD_R * 0.5,
        head_y + HEAD_R * 0.25
    );
    ctx.stroke();

    // Eye
    const eye_x = head_x + face_direction * HEAD_R * 0.5;
    const eye_y = head_y - HEAD_R * 0.2;
    const eye_size = HEAD_R * 0.15;
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(eye_x, eye_y, eye_size, 0, 2 * Math.PI);
    ctx.fill();

    // Pupil
    const pupil_size = eye_size * 0.5;
    ctx.fillStyle = FACE_DETAIL_COLOR;
    ctx.beginPath();
    ctx.arc(eye_x, eye_y, pupil_size, 0, 2 * Math.PI);
    ctx.fill();

    // Mouth
    ctx.strokeStyle = FACE_DETAIL_COLOR;
    ctx.beginPath();
    ctx.moveTo(head_x + face_direction * HEAD_R * 0.2, head_y + HEAD_R * 0.53);
    ctx.lineTo(head_x + face_direction * HEAD_R * 0.6, head_y + HEAD_R * 0.45);
    ctx.stroke();

    // Hair
    ctx.strokeStyle = HAIR_COLOR;
    ctx.lineWidth = 1.5;
    const wind_direction = -1;
    const hair_length = HEAD_R * 1.5;
    const num_strands = 64;
    for (let i = 0; i < num_strands; i++) {
        const angle = Math.PI + (i * Math.PI) / (num_strands * 1.2);
        const hair_start_x = head_x + Math.cos(angle) * HEAD_R * 0.9;
        const hair_start_y = head_y + Math.sin(angle) * HEAD_R * 0.9;
        ctx.beginPath();
        ctx.moveTo(hair_start_x, hair_start_y);

        const wave_amplitude = HEAD_R * 0.5;
        const wave_frequency = 0.6;
        const strand_length = hair_length * (0.7 + Math.random() * 0.4);
        const cp1x = hair_start_x + wind_direction * strand_length * 0.3;
        const cp1y = hair_start_y + strand_length * 0.1 + Math.sin(i * wave_frequency) * wave_amplitude;
        const cp2x = hair_start_x + wind_direction * strand_length * 0.6;
        const cp2y = hair_start_y + strand_length * 0.2 + Math.sin(i * wave_frequency + 1) * wave_amplitude;
        const end_x = hair_start_x + wind_direction * strand_length;
        const end_y = hair_start_y + strand_length * 0.3 + Math.sin(i * wave_frequency + 2) * wave_amplitude;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end_x, end_y);
        ctx.stroke();
    }

    // Hat
    ctx.fillStyle = HAT_COLOR;
    ctx.beginPath();
    ctx.ellipse(head_x, head_y - HEAD_R * 0.5, HEAD_R * 1.1, HEAD_R * 0.8, 0, 0, Math.PI, true);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(head_x - HEAD_R * 0.9, head_y - HEAD_R * 0.5);
    ctx.lineTo(head_x + HEAD_R * 1.4, head_y - HEAD_R * 0.5);
    ctx.lineTo(head_x + HEAD_R * 1.6, head_y - HEAD_R * 0.3);
    ctx.lineTo(head_x - HEAD_R * 1.1, head_y - HEAD_R * 0.3);
    ctx.closePath();
    ctx.fill();

    // Torso
    ctx.strokeStyle = RIDER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(head_x, head_y + HEAD_R);
    ctx.lineTo(seat_x, seat_y);
    ctx.stroke();

    // Arms
    ctx.beginPath();
    ctx.moveTo(shoulder_x, shoulder_y);
    ctx.lineTo(elbow_x, elbow_y);
    ctx.lineTo(handlebar_x, handlebar_y);
    ctx.stroke();
}

export function drawRiderLegs(ctx, rig) {
    const { seat_x, seat_y, pedal_x, pedal_y, pedal_x2, pedal_y2 } = rig;
    const hip = { x: seat_x, y: seat_y };

    const rightKnee = findKneePosition(hip, { x: pedal_x, y: pedal_y }, LEG_LENGTH1, LEG_LENGTH2);
    const leftKnee = findKneePosition(hip, { x: pedal_x2, y: pedal_y2 }, LEG_LENGTH1, LEG_LENGTH2);

    // Glow
    ctx.strokeStyle = GLOW_COLOR;
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(rightKnee.x, rightKnee.y);
    ctx.lineTo(pedal_x, pedal_y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(leftKnee.x, leftKnee.y);
    ctx.lineTo(pedal_x2, pedal_y2);
    ctx.stroke();

    // Actual legs
    ctx.strokeStyle = RIDER_COLOR;
    ctx.lineWidth = 2;

    // Right leg
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(rightKnee.x, rightKnee.y);
    ctx.lineTo(pedal_x, pedal_y);
    ctx.stroke();

    // Left leg
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(leftKnee.x, leftKnee.y);
    ctx.lineTo(pedal_x2, pedal_y2);
    ctx.stroke();
}

function findKneePosition(H, P, L1, L2) {
    let dx = P.x - H.x;
    let dy = P.y - H.y;
    let D = Math.sqrt(dx * dx + dy * dy);
    if (D > L1 + L2 || D < Math.abs(L1 - L2)) {
        return { x: H.x + L1 * (dx / D), y: H.y + L1 * (dy / D) };
    }
    let a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
    let h = Math.sqrt(L1 * L1 - a * a);
    let C_mid = { x: H.x + a * (dx / D), y: H.y + a * (dy / D) };
    let perp_dx = -dy / D;
    let perp_dy = dx / D;
    let C1 = { x: C_mid.x + h * perp_dx, y: C_mid.y + h * perp_dy };
    let C2 = { x: C_mid.x - h * perp_dx, y: C_mid.y - h * perp_dy };
    return C1.y < C2.y ? C1 : C2;
}
