// game.js
import { drawBike } from './drawbike.js';
import { vibes } from './vibes.js';

document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Game constants
    const CANVAS_WIDTH = canvas.width;
    const CANVAS_HEIGHT = canvas.height;
    const offsetX = CANVAS_WIDTH / 2;
    const BIKE_SPEED = 200; // px/s
    const GRAVITY = 500; // px/s²
    const JUMP_VELOCITY = 200; // px/s upward
    const PIXELS_PER_DAY = 200;

    // Game state
    let path = [];
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
    let gameOver = false;
    let lastTime = 0;

    // Fetch stock data for terrain generation
    async function fetchStockData() {
        try {
            const response = await fetch('https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=98QKC7GE5OJVUCOE');
            const data = await response.json();
            if (!data['Time Series (Daily)']) throw new Error('Invalid API response');

            const timeSeries = data['Time Series (Daily)'];
            const dates = Object.keys(timeSeries).sort();
            const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);

            path = prices.map((price, i) => [
                i * PIXELS_PER_DAY,
                canvas.height - ((price - minPrice) / (maxPrice - minPrice)) * 300
            ]);
        } catch (error) {
            console.error('Error fetching stock data:', error);
            generateSamplePath();
        }
    }

    function generateSamplePath() {
        path = Array.from({ length: 100 }, (_, i) => [
            i * PIXELS_PER_DAY,
            canvas.height - Math.random() * 300
        ]);
    }

    // Interpolate path y-value at world_x
    function getPathY(worldX) {
        const index = Math.floor(worldX / PIXELS_PER_DAY);
        if (index < 0 || index >= path.length - 1) return path[0][1];
        const [x1, y1] = path[index];
        const [x2, y2] = path[index + 1];
        const t = (worldX - x1) / (x2 - x1);
        return y1 + t * (y2 - y1);
    }

    // Get slope at world_x
    function getPathSlope(worldX) {
        const index = Math.floor(worldX / PIXELS_PER_DAY);
        if (index < 0 || index >= path.length - 1) return 0;
        const [x1, y1] = path[index];
        const [x2, y2] = path[index + 1];
        return (y2 - y1) / (x2 - x1);
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

        // Use vibes.js to update the environment and music
        vibes.time = bike.x / PIXELS_PER_DAY;
        vibes.update();

        renderTerrain();
        renderBike();
        renderHUD();

        requestAnimationFrame(gameLoop);
    }

    function updateScore() {
        score = Math.floor(bike.x / PIXELS_PER_DAY) * 100;
    }

    function updateBike(deltaTime) {
        if (gameOver) return;
        // Bike physics and controls
        bike.x += BIKE_SPEED * deltaTime;

        if (bike.state === 'on_ground') {
            bike.y = getPathY(bike.x);
            bike.angle = Math.atan(getPathSlope(bike.x));
        } else {
            // In air
            bike.v_y += GRAVITY * deltaTime;
            bike.y += bike.v_y * deltaTime;
            bike.angle += bike.rotationSpeed * deltaTime;
            bike.totalRotation += bike.rotationSpeed * deltaTime;

            // Check for landing
            const pathY = getPathY(bike.x);
            if (bike.y >= pathY) {
                bike.y = pathY;
                const pathAngle = Math.atan(getPathSlope(bike.x));
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

    function renderTerrain() {
        // Draw terrain (below the path)
        const startX = bike.x - CANVAS_WIDTH / 2;
        const endX = bike.x + CANVAS_WIDTH / 2;
        const startIndex = Math.max(0, Math.floor(startX / PIXELS_PER_DAY));
        const endIndex = Math.min(path.length - 1, Math.ceil(endX / PIXELS_PER_DAY));

        // Grass option
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT); // Bottom-left corner
        for (let i = startIndex; i <= endIndex; i++) {
            const [wx, wy] = path[i];
            ctx.lineTo(wx + offsetX, wy);
        }
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT); // Bottom-right corner
        ctx.closePath();
        ctx.fillStyle = '#32CD32'; // Green grass
        ctx.fill();

        // Draw path (ground line)
        ctx.beginPath();
        for (let i = startIndex; i < endIndex; i++) {
            const [wx1, wy1] = path[i];
            const [wx2, wy2] = path[i + 1];
            ctx.moveTo(wx1 + offsetX, wy1);
            ctx.lineTo(wx2 + offsetX, wy2);
        }
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2; // Thicker line for clarity
        ctx.stroke();
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

    // Initialize game
    await fetchStockData();
    bike.y = getPathY(0);
    bike.angle = Math.atan(getPathSlope(0));
    requestAnimationFrame(gameLoop);
});