// game.js
import { drawBike } from './drawbike.js';
import { vibes } from './vibes.js';

document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Game constants
    const BIKE_SPEED = 200; // px/s
    const GRAVITY = 500; // px/s²
    const JUMP_VELOCITY = 200; // px/s upward
    const CRASH_THRESHOLD = Math.PI / 4; // 45 degrees

    // Game state
    let bike = {
        x: 0,
        y: 0,
        angle: 0,
        v_y: 0,
        state: 'on_ground',
        rotationSpeed: 0,
        totalRotation: 0,
        jumpStartAngle: 0
    };
    let score = 0;
    let flipBonus = 0;
    let gameOver = false;
    let lastTime = 0;

    try {
        await vibes.ready;
        console.log('After vibes.ready, environment:', vibes.environment);
        bike.y = vibes.environment.getPathY(0);
        bike.angle = Math.atan(vibes.environment.getPathSlope(0));
        // Start the game loop
        requestAnimationFrame(gameLoop);
    } catch (error) {
        console.error('Failed to initialize vibes:', error);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('Failed to load game: ' + error.message, 20, 50);
        return; // Stop execution if vibes fails
    }

    // Game loop
    function gameLoop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (gameOver) return;

        // Update bike and score
        updateBike(deltaTime);
        updateScore();

        // Render everything
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update environment with bike's position
        vibes.time = bike.x / vibes.environment.PIXELS_PER_DAY; // Assuming environment exposes PIXELS_PER_DAY
        vibes.update(bike.x); // Pass bike.x to update ground

        renderBike();
        renderHUD();

        requestAnimationFrame(gameLoop);
    }

    function updateScore() {
        score = Math.floor(bike.x / vibes.environment.PIXELS_PER_DAY) * 100 + flipBonus;
    }

    function updateBike(deltaTime) {
        if (gameOver) return;
        bike.x += BIKE_SPEED * deltaTime;
    
        if (bike.state === 'on_ground') {
            bike.y = vibes.environment.getPathY(bike.x);
            bike.angle = Math.atan(vibes.environment.getPathSlope(bike.x));
        } else {
            bike.v_y += GRAVITY * deltaTime;
            bike.y += bike.v_y * deltaTime;
            bike.angle += bike.rotationSpeed * deltaTime;
            bike.totalRotation += bike.rotationSpeed * deltaTime;
    
            // Clamp y to stay on screen
            bike.y = Math.min(canvas.height, Math.max(0, bike.y));
    
            const pathY = vibes.environment.getPathY(bike.x);
            if (bike.y >= pathY) {
                bike.y = pathY;
                const pathAngle = Math.atan(vibes.environment.getPathSlope(bike.x));
                const angleDiff = Math.abs(bike.angle - pathAngle);
                if (angleDiff > CRASH_THRESHOLD) {
                    gameOver = true;
                } else {
                    bike.state = 'on_ground';
                    bike.v_y = 0;
                    const flips = Math.floor(Math.abs(bike.totalRotation) / (2 * Math.PI));
                    flipBonus += flips * 100;
                }
            }
        }
    }

    function renderBike() {
        ctx.save();
        ctx.translate(canvas.width / 2, bike.y);
        ctx.rotate(bike.angle);
        drawBike(ctx, bike.x);
        ctx.restore();
    }

    function renderHUD() {
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`Score: ${score}`, 20, 30);
        if (gameOver) {
            ctx.fillText('GAME OVER', canvas.width / 2 - 80, canvas.height / 2);
        }
    }

    // Event listeners
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        vibes.canvas = canvas; // Update vibes.js canvas dimensions
    });

    canvas.addEventListener('touchstart', () => {
        if (bike.state === 'on_ground' && !gameOver) {
            bike.v_y = -JUMP_VELOCITY;
            bike.state = 'in_air';
            bike.totalRotation = 0;
            bike.jumpStartAngle = bike.angle;
        }
    });

    window.addEventListener('deviceorientation', (event) => {
        bike.rotationSpeed = (event.gamma / 90) * 2 * Math.PI;
    });

});