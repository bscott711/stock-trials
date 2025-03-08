// drawbike.js
export function drawBike(ctx, distance_traveled, darknessLevel) {
    // Bike parameters
    const r = 30; // Wheel radius
    const d = 100; // Wheelbase
    const h = 75; // Seat height
    const k = 100; // Handlebar height
    const crank_length = 12; // Crank arms

    // Animation
    const wheel_angle = (distance_traveled / r) % (2 * Math.PI);
    const pedal_angle = wheel_angle;

    // Positions
    const back_wheel_x = -d / 2;
    const back_wheel_y = 0;
    const front_wheel_x = d / 2;
    const front_wheel_y = 0;
    const seat_x = -d * 0.2; // Centered seat
    const seat_y = -h;
    const handlebar_x = front_wheel_x * 0.8;
    const handlebar_y = -k;
    const crank_center_x = 0;
    const crank_center_y = -15;

    // Colors
    const frameColor = "#0057b7";
    const wheelColor = "#57b799";
    const tireColor = "#333";
    const spokesColor = "#999";
    const seatColor = "#663300";
    const pedalColor = "#555";

    // Wheels
    // Back wheel
    ctx.strokeStyle = tireColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(back_wheel_x, back_wheel_y, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = wheelColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(back_wheel_x, back_wheel_y, r - 2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(back_wheel_x, back_wheel_y, 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = spokesColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
        const angle = wheel_angle + (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(back_wheel_x, back_wheel_y);
        ctx.lineTo(
            back_wheel_x + (r - 2) * Math.cos(angle),
            back_wheel_y + (r - 2) * Math.sin(angle)
        );
        ctx.stroke();
    }

    // Front wheel
    ctx.strokeStyle = tireColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(front_wheel_x, front_wheel_y, r, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = wheelColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(front_wheel_x, front_wheel_y, r - 2, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(front_wheel_x, front_wheel_y, 2, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = spokesColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
        const angle = wheel_angle + (i * Math.PI) / 4;
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

    // Pedal cranks
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(
        crank_center_x + crank_length * Math.cos(pedal_angle),
        crank_center_y + crank_length * Math.sin(pedal_angle)
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(crank_center_x, crank_center_y);
    ctx.lineTo(
        crank_center_x + crank_length * -Math.cos(pedal_angle),
        crank_center_y + crank_length * -Math.sin(pedal_angle)
    );
    ctx.stroke();

    // Chain ring
    ctx.beginPath();
    ctx.arc(crank_center_x, crank_center_y, 7, 0, 2 * Math.PI);
    ctx.stroke();

    // Pedals
    const pedal_x = crank_center_x + crank_length * Math.cos(pedal_angle);
    const pedal_y = crank_center_y + crank_length * Math.sin(pedal_angle);
    ctx.fillStyle = pedalColor;
    ctx.beginPath();
    ctx.rect(pedal_x - 4, pedal_y - 1, 8, 2);
    ctx.fill();

    const pedal_x2 = crank_center_x + crank_length * -Math.cos(pedal_angle);
    const pedal_y2 = crank_center_y + crank_length * -Math.sin(pedal_angle);
    ctx.beginPath();
    ctx.rect(pedal_x2 - 4, pedal_y2 - 1, 8, 2);
    ctx.fill();

    // Chain
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

    // Headlight logic
        const headlightIntensity = Math.min(1, darknessLevel); // Clamp intensity between 0 and 1
        const headlightX = handlebar_x + 7; // Position the headlight at the handlebars
        const headlightY = handlebar_y + 20; // Meets where the tube meets the handlebars
        const headlightLength = 600; // Length of the cone (how far the light extends)
        const headlightWidth = 80; // Width of the cone at its base
        const coneAngle = 30;
    
        // Save the current context state
        ctx.save();
    
        // Create a clipping path for the cone shape
        ctx.beginPath();
        ctx.moveTo(headlightX, headlightY); // Start at the headlight bulb
        ctx.lineTo(
            headlightX + headlightLength * Math.cos(coneAngle),
            headlightY - headlightWidth / 2 * Math.sin(coneAngle)
        ); // Top edge of the cone
        ctx.lineTo(
            headlightX + headlightLength * Math.cos(coneAngle),
            headlightY + headlightWidth / 2 * Math.sin(coneAngle)
        ); // Bottom edge of the cone
        ctx.closePath(); // Close the triangle
        ctx.clip(); // Clip everything outside the cone
    
        // Create a linear gradient for the cone
        const gradient = ctx.createLinearGradient(
            headlightX, headlightY, // Start of the gradient (at the bulb)
            headlightX + headlightLength * Math.cos(coneAngle), headlightY // End of the gradient (end of the cone)
        );
    
        // Define the gradient colors (bright near the bulb, fading to transparent)
        gradient.addColorStop(0, `rgba(255, 255, 200, ${0.8 * headlightIntensity})`); // Bright center
        gradient.addColorStop(0.5, `rgba(255, 255, 200, ${0.4 * headlightIntensity})`); // Mid-range glow
        gradient.addColorStop(1, "rgba(255, 255, 200, 0)"); // Fully transparent edge
    
        // Draw the cone of light
        ctx.globalCompositeOperation = "lighter"; // Blend mode for glowing effect
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(headlightX, headlightY); // Start at the headlight bulb
        ctx.lineTo(
            headlightX + headlightLength * Math.cos(coneAngle),
            headlightY - headlightWidth / 2 * Math.sin(coneAngle)
        ); // Top edge of the cone
        ctx.lineTo(
            headlightX + headlightLength * Math.cos(coneAngle),
            headlightY + headlightWidth / 2 * Math.sin(coneAngle)
        ); // Bottom edge of the cone
        ctx.closePath(); // Close the triangle
        ctx.fill();
    
        // Restore the context state
        ctx.restore();
    
        // Optionally, draw a small white circle to represent the headlight bulb
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(headlightX, headlightY, 5, 0, 2 * Math.PI);
        ctx.fill();

        const bulbGradient = ctx.createRadialGradient(
            headlightX, headlightY, 0,
            headlightX, headlightY, 10
        );
        bulbGradient.addColorStop(0, `rgba(255, 255, 200, ${0.8 * headlightIntensity})`);
        bulbGradient.addColorStop(1, "rgba(255, 255, 200, 0)");
        ctx.fillStyle = bulbGradient;
        ctx.beginPath();
        ctx.arc(headlightX, headlightY, 10, 0, 2 * Math.PI);
        ctx.fill();

    // Return rider attachment points
    return {
        seat_x,
        seat_y,
        handlebar_x,
        handlebar_y,
        pedal_x,
        pedal_y,
        pedal_x2,
        pedal_y2,
        pedal_angle,
    };
}