export function drawBike(ctx, distance_traveled) {
    // Optimized bike parameters
    const r = 30; // Wheel radius
    const d = 100; // Wheelbase
    const h = 75; // Increased seat height
    const k = 100; // Increased handlebar height
    const head_r = 20; // Larger head radius
    const crank_length = 12; // Longer crank arms
    const leg_length1 = 45; // Upper leg length
    const leg_length2 = 45; // Lower leg length
  
    // Animation calculations
    const wheel_angle = (distance_traveled / r) % (2 * Math.PI);
    const pedal_angle = wheel_angle;
  
    // Position references
    const back_wheel_x = -d / 2;
    const back_wheel_y = 0;
    const front_wheel_x = d / 2;
    const front_wheel_y = 0;
  
    // Centralized seat position
    const seat_x = -d * 0.2; // Centered seat
    const seat_y = -h;
  
    const handlebar_x = front_wheel_x * 0.8;
    const handlebar_y = -k;
  
    // Centralized crank position
    const crank_center_x = 0; // Moved closer to center
    const crank_center_y = -15;
  
    // Colors
    const frameColor = "#0057b7";
    const wheelColor = "#57b799";
    const tireColor = "#333";
    const spokesColor = "#999";
    const seatColor = "#663300";
    const riderColor = "#444";
    const pedalColor = "#555";
  
    // WHEELS
  
    // Back wheel
    // Tire
    ctx.strokeStyle = tireColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(back_wheel_x, back_wheel_y, r, 0, 2 * Math.PI);
    ctx.stroke();
  
    // Rim
    ctx.strokeStyle = wheelColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(back_wheel_x, back_wheel_y, r - 2, 0, 2 * Math.PI);
    ctx.stroke();
  
    // Hub
    ctx.beginPath();
    ctx.arc(back_wheel_x, back_wheel_y, 2, 0, 2 * Math.PI);
    ctx.fill();
  
    // Spokes - more of them for realism
    ctx.strokeStyle = spokesColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      let angle = wheel_angle + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(back_wheel_x, back_wheel_y);
      ctx.lineTo(
        back_wheel_x + (r - 2) * Math.cos(angle),
        back_wheel_y + (r - 2) * Math.sin(angle)
      );
      ctx.stroke();
    }
  
    // Front wheel
    // Tire
    ctx.strokeStyle = tireColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(front_wheel_x, front_wheel_y, r, 0, 2 * Math.PI);
    ctx.stroke();
  
    // Rim
    ctx.strokeStyle = wheelColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(front_wheel_x, front_wheel_y, r - 2, 0, 2 * Math.PI);
    ctx.stroke();
  
    // Hub
    ctx.beginPath();
    ctx.arc(front_wheel_x, front_wheel_y, 2, 0, 2 * Math.PI);
    ctx.fill();
  
    // Spokes
    ctx.strokeStyle = spokesColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      let angle = wheel_angle + (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(front_wheel_x, front_wheel_y);
      ctx.lineTo(
        front_wheel_x + (r - 2) * Math.cos(angle),
        front_wheel_y + (r - 2) * Math.sin(angle)
      );
      ctx.stroke();
    }
  
    // Seat
    ctx.fillStyle = seatColor;
    ctx.beginPath();
    ctx.ellipse(seat_x, seat_y, 10, 4, 0, 0, 2 * Math.PI);
    ctx.fill();
  
    // Handlebars
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(handlebar_x - 8, handlebar_y);
    ctx.lineTo(handlebar_x + 8, handlebar_y);
    ctx.stroke();
  
    // Pedal crank Leg 1
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(
      crank_center_x + crank_length * Math.cos(pedal_angle),
      crank_center_y + crank_length * Math.sin(pedal_angle)
    );
    ctx.stroke();
  
    // Pedal crank Leg 2
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(
      crank_center_x + crank_length * -Math.cos(pedal_angle),
      crank_center_y + crank_length * -Math.sin(pedal_angle)
    );
    ctx.stroke();
  
    // Chain ring (gear)
    ctx.beginPath();
    ctx.arc(crank_center_x, crank_center_y, 7, 0, 2 * Math.PI);
    ctx.stroke();
  
    // Left Pedal
    const pedal_x = crank_center_x + crank_length * Math.cos(pedal_angle);
    const pedal_y = crank_center_y + crank_length * Math.sin(pedal_angle);
    ctx.fillStyle = pedalColor;
    ctx.beginPath();
    ctx.rect(pedal_x - 4, pedal_y - 1, 8, 2);
    ctx.fill();
  
    // Right Pedal
    const pedal_x2 = crank_center_x + crank_length * -Math.cos(pedal_angle);
    const pedal_y2 = crank_center_y + crank_length * -Math.sin(pedal_angle);
    ctx.fillStyle = pedalColor;
    ctx.beginPath();
    ctx.rect(pedal_x2 - 4, pedal_y2 - 1, 8, 2);
    ctx.fill();
    
    // Chain
    ctx.beginPath();
    ctx.moveTo(back_wheel_x, back_wheel_y);
    ctx.lineTo(crank_center_x, crank_center_y); // Chain stay
    ctx.stroke();
    
  
    // FRAME - Optimized geometry
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 3;
  
    // Main Triangle
    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y); // Chain stay
    ctx.lineTo(seat_x, seat_y); // Seat tube
    ctx.lineTo(handlebar_x, handlebar_y + 20); // Top tube
    ctx.closePath();
    ctx.stroke();
  
    // Front fork
    ctx.beginPath();
    ctx.moveTo(front_wheel_x, front_wheel_y);
    ctx.lineTo(handlebar_x, handlebar_y); // Stem
    ctx.stroke();
    
  // Back fork
    ctx.beginPath();
    ctx.moveTo(back_wheel_x, back_wheel_y);
    ctx.lineTo(seat_x, seat_y);
    ctx.stroke();
    
    // RIDER - Improved proportions
    ctx.strokeStyle = riderColor;
    ctx.lineWidth = 2;
  
    // Longer torso
    const torso_length = 60;
  
    // Head position
    const head_x = seat_x - 2;
    const head_y = seat_y - torso_length - head_r;
  
    // Face features - profile view (looking forward)
    // For profile view, we'll position features on the side of the head
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
    const hair_color = "#8B4513"; // Brown hair
    ctx.strokeStyle = hair_color;
    ctx.lineWidth = 1.5;
  
    // Create flowing hair strands with wave pattern
    const wind_direction = -1; // -1 is flowing backwards
    const hair_length = head_r * 1.5;
    const num_strands = 64;
  
    for (let i = 0; i < num_strands; i++) {
      // Distribute hair around back of head
      const angle = Math.PI + (i * Math.PI) / (num_strands * 1.2);
      const hair_start_x = head_x + Math.cos(angle) * head_r * 0.9;
      const hair_start_y = head_y + Math.sin(angle) * head_r * 0.9;
  
      ctx.beginPath();
      ctx.moveTo(hair_start_x, hair_start_y);
  
      // Create a wavy pattern for each strand
      const wave_amplitude = head_r * 0.5;
      const wave_frequency = 0.6;
      const strand_length = hair_length * (0.7 + Math.random() * 0.4); // Varied length
  
      // Control points for Bezier curve to create flowing hair effect
      const cp1x = hair_start_x + wind_direction * strand_length * 0.3;
      const cp1y =
        hair_start_y +
        strand_length * 0.1 +
        Math.sin(i * wave_frequency) * wave_amplitude;
      const cp2x = hair_start_x + wind_direction * strand_length * 0.6;
      const cp2y =
        hair_start_y +
        strand_length * 0.2 +
        Math.sin(i * wave_frequency + 1) * wave_amplitude;
      const end_x = hair_start_x + wind_direction * strand_length;
      const end_y =
        hair_start_y +
        strand_length * 0.3 +
        Math.sin(i * wave_frequency + 2) * wave_amplitude;
  
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end_x, end_y);
      ctx.stroke();
    }
  
    // Hat - adjusted for profile view
    const hat_color = "#3A5F8F"; // Navy blue hat
    ctx.fillStyle = hat_color;
  
    // Hat main portion
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
  
    // Hat brim - adjusted to show from side
    ctx.beginPath();
    ctx.moveTo(head_x - head_r * 0.9, head_y - head_r * 0.5);
    ctx.lineTo(head_x + head_r * 1.4, head_y - head_r * 0.5);
    ctx.lineTo(head_x + head_r * 1.6, head_y - head_r * 0.3);
    ctx.lineTo(head_x - head_r * 1.1, head_y - head_r * 0.3);
    ctx.closePath();
    ctx.fill();
  
    // Reset stroke style for the rest of the drawing
    ctx.strokeStyle = riderColor;
    ctx.lineWidth = 2;
  
    // Body
    ctx.beginPath();
    ctx.arc(head_x, head_y, head_r, 0, 2 * Math.PI); // Head
    ctx.moveTo(head_x, head_y + head_r);
    ctx.lineTo(seat_x, seat_y); // Torso
    ctx.stroke();
  
    // Arms with elbow
    const shoulder_x = head_x;
    const shoulder_y = head_y + head_r * 1.5;
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
  
    // Calculate elbow position - add a slight bend
    const vector_x = handlebar_x - shoulder_x;
    const vector_y = handlebar_y - shoulder_y;
    const norm = Math.sqrt(vector_x * vector_x + vector_y * vector_y);
    const unit_vector_x = vector_x / norm;
    const unit_vector_y = vector_y / norm;
  
    // Add a slight offset to the elbow to create a natural bend
    const elbow_offset_factor = 0.2;
    const perpendicular_x = -unit_vector_y;
    const perpendicular_y = unit_vector_x;
  
    const elbow_x =
      shoulder_x +
      unit_vector_x * arm_length1 +
      perpendicular_x * elbow_offset_factor * arm_length1;
    const elbow_y =
      shoulder_y +
      unit_vector_y * arm_length1 +
      perpendicular_y * elbow_offset_factor * arm_length1;
  
    // Draw arm with elbow
    ctx.beginPath();
    ctx.moveTo(shoulder_x, shoulder_y); // Shoulder
    ctx.lineTo(elbow_x, elbow_y); // Upper arm to elbow
    ctx.lineTo(handlebar_x, handlebar_y); // Forearm to handlebar
    ctx.stroke();
  
    // Legs with improved IK
    function findKneePosition(hip, pedal, l1, l2) {
      // Improved inverse kinematics calculation
      const dx = pedal.x - hip.x;
      const dy = pedal.y - hip.y;
      const D = Math.sqrt(dx * dx + dy * dy);
      const a = Math.acos((l1 * l1 + D * D - l2 * l2) / (2 * l1 * D));
      return {
        x: hip.x + l1 * Math.cos(Math.atan2(dy, dx) - a),
        y: hip.y + l1 * Math.sin(Math.atan2(dy, dx) - a),
      };
    }
  
    // Pedal positions
    // const pedal_x = crank_center_x + crank_length * Math.cos(pedal_angle);
    // const pedal_y = crank_center_y + crank_length * Math.sin(pedal_angle);
    const hip = { x: seat_x, y: seat_y };
  
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
    const leftPedalAngle = pedal_angle + Math.PI;
    const leftPedal_x = crank_center_x + crank_length * Math.cos(leftPedalAngle);
    const leftPedal_y = crank_center_y + crank_length * Math.sin(leftPedalAngle);
    const leftKnee = findKneePosition(
      hip,
      { x: leftPedal_x, y: leftPedal_y },
      leg_length1,
      leg_length2
    );
  
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(leftKnee.x, leftKnee.y);
    ctx.lineTo(leftPedal_x, leftPedal_y);
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
  