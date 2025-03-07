export function drawRider(ctx, bikeData) {
    const { seat_x, seat_y, handlebar_x, handlebar_y, pedal_x, pedal_y, pedal_x2, pedal_y2 } = bikeData;

    // Rider parameters
    const head_r = 20; // Head radius
    const torso_length = 60; // Torso length
    const leg_length1 = 45; // Upper leg
    const leg_length2 = 45; // Lower leg
    const riderColor = "#444444";
    const hair_color = "#8B4513";
    const hat_color = "#3A5F8F";

    // Rider positions
    const head_x = seat_x - 2;
    const head_y = seat_y - torso_length - head_r;
    const shoulder_x = head_x;
    const shoulder_y = head_y + head_r * 1.5;
    const hip = { x: seat_x, y: seat_y };

    ctx.strokeStyle = riderColor;
    ctx.lineWidth = 2;

    // Face features - profile view (looking forward)
    const face_direction = 1; // 1 for looking right, -1 for looking left

    // Profile contour - slight bump for the nose
    ctx.beginPath();
    ctx.moveTo(head_x + face_direction * head_r * 0.5, head_y - head_r * 0.35);
    ctx.quadraticCurveTo(
        head_x + face_direction * head_r * 0.9,
        head_y + head_r * 0.3,
        head_x + face_direction * head_r * 0.5,
        head_y + head_r * 0.25
    );
    ctx.stroke();

    // Single eye on the visible side
    const eye_x = head_x + face_direction * head_r * 0.5;
    const eye_y = head_y - head_r * 0.2;
    const eye_size = head_r * 0.15;

    ctx.beginPath();
    ctx.arc(eye_x, eye_y, eye_size, 0, 2 * Math.PI);
    ctx.fill();

    // Small line for the mouth - slight smile
    ctx.beginPath();
    ctx.moveTo(head_x + face_direction * head_r * 0.2, head_y + head_r * 0.53);
    ctx.lineTo(head_x + face_direction * head_r * 0.6, head_y + head_r * 0.45);
    ctx.stroke();

    // Wind-blown hair - flowing backwards (as if from movement)
    ctx.strokeStyle = hair_color;
    ctx.lineWidth = 1.5;

    const wind_direction = -1; // -1 is flowing backwards
    const hair_length = head_r * 1.5;
    const num_strands = 64;

    for (let i = 0; i < num_strands; i++) {
        const angle = Math.PI + (i * Math.PI) / (num_strands * 1.2);
        const hair_start_x = head_x + Math.cos(angle) * head_r * 0.9;
        const hair_start_y = head_y + Math.sin(angle) * head_r * 0.9;

        ctx.beginPath();
        ctx.moveTo(hair_start_x, hair_start_y);

        const wave_amplitude = head_r * 0.5;
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

    // Hat - adjusted for profile view
    ctx.fillStyle = hat_color;

    ctx.beginPath();
    ctx.ellipse(
        head_x,
        head_y - head_r * 0.5,
        head_r * 1.1,
        head_r * 0.8,
        0,
        0,
        Math.PI,
        true
    );
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(head_x - head_r * 0.9, head_y - head_r * 0.5);
    ctx.lineTo(head_x + head_r * 1.4, head_y - head_r * 0.5);
    ctx.lineTo(head_x + head_r * 1.6, head_y - head_r * 0.3);
    ctx.lineTo(head_x - head_r * 1.1, head_y - head_r * 0.3);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.strokeStyle = riderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(head_x, head_y, head_r, 0, 2 * Math.PI); // Head
    ctx.moveTo(head_x, head_y + head_r);
    ctx.lineTo(seat_x, seat_y); // Torso
    ctx.stroke();

    // Arms with elbow
    const arm_length1 =
        Math.sqrt(
            Math.pow(handlebar_x - shoulder_x, 2) +
            Math.pow(handlebar_y - shoulder_y, 2)
        ) * 0.5;
    const arm_length2 =
        Math.sqrt(
            Math.pow(handlebar_x - shoulder_x, 2) +
            Math.pow(handlebar_y - shoulder_y, 2)
        ) * 0.55;

    const vector_x = handlebar_x - shoulder_x;
    const vector_y = handlebar_y - shoulder_y;
    const norm = Math.sqrt(vector_x * vector_x + vector_y * vector_y);
    const unit_vector_x = vector_x / norm;
    const unit_vector_y = vector_y / norm;

    const elbow_offset_factor = 0.2;
    const perpendicular_x = -unit_vector_y;
    const perpendicular_y = unit_vector_x;

    const elbow_x =
        shoulder_x +
        unit_vector_x * arm_length1 +
        perpendicular_x * elbow_offset_factor * arm_length1;
    const elbow_y =
        shoulder_y +
        unit_vector_y * arm_length2 +
        perpendicular_y * elbow_offset_factor * arm_length2;

    ctx.beginPath();
    ctx.moveTo(shoulder_x, shoulder_y); // Shoulder
    ctx.lineTo(elbow_x, elbow_y); // Upper arm to elbow
    ctx.lineTo(handlebar_x, handlebar_y); // Forearm to handlebar
    ctx.stroke();

    // Right leg
    const knee = findKneePosition(
        hip,
        { x: pedal_x, y: pedal_y },
        leg_length1,
        leg_length2
    );
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(pedal_x, pedal_y);
    ctx.stroke();

    // Left leg (opposite phase)
    const leftKnee = findKneePosition(
        hip,
        { x: pedal_x2, y: pedal_y2 },
        leg_length1,
        leg_length2
    );
    
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(leftKnee.x, leftKnee.y);
    ctx.lineTo(pedal_x2, pedal_y2);
    ctx.stroke();

    // Helper function to calculate knee position for leg animation
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
}