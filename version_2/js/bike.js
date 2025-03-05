// game.js
import { drawBike } from './drawbike.js'; // Import drawBike from external file

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const BIKE_SPEED = 200;       // Pixels per second
const GRAVITY = 500;          // Pixels per second squared
const JUMP_VELOCITY = 200;    // Pixels per second upward
const ROTATION_FACTOR = Math.PI / 90; // Max 1 rotation/sec at 90° tilt
const CRASH_THRESHOLD = Math.PI / 6;  // 30 degrees
const PIXELS_PER_DAY = 100;    // Horizontal spacing per day

// Game state
let path = []; // Array of [world_x, path_y] pairs
let bike = {
    x: 0,          // World x position
    y: 0,          // Canvas y position
    angle: 0,      // Radians
    v_y: 0,        // Vertical velocity
    state: 'on_ground',
    rotationSpeed: 0,
    totalRotation: 0,
    jumpStartAngle: 0
};
let score = 0;
let flipBonus = 0;
let gameOver = false;
let lastTime = 0;

// Cloud data (world coordinates)
const clouds = [
    { x: 200, y: 50, size: 30 },
    { x: 500, y: 80, size: 25 },
    { x: 800, y: 40, size: 35 },
    { x: 1200, y: 60, size: 20 },
    { x: 1600, y: 70, size: 30 }
];

// Fetch real stock data using your Alpha Vantage API key
async function fetchStockData() {
    try {
        const response = await fetch('https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=98QKC7GE5OJVUCOE');
        const data = await response.json();
        if (!data['Time Series (Daily)']) {
            throw new Error('Invalid API response or API limit reached');
        }
        const timeSeries = data['Time Series (Daily)'];
        const dates = Object.keys(timeSeries).sort();
        const prices = dates.map(date => parseFloat(timeSeries[date]['4. close']));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        // Map prices to canvas y-coordinates (100 to 400)
        path = prices.map((price, i) => {
            let y = 400 - ((price - minPrice) / (maxPrice - minPrice)) * 300;
            return [i * PIXELS_PER_DAY, y];
        });
    } catch (error) {
        console.error('Error fetching stock data:', error);
        // Fallback to a sample path if API fails
        generateSamplePath();
    }
}

// Generate a sample path (fallback if API fails)
function generateSamplePath() {
    let prices = Array.from({ length: 100 }, () => 100 + Math.random() * 1000);
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    path = prices.map((price, i) => {
        let y = 400 - ((price - minPrice) / (maxPrice - minPrice)) * 300; // Adjusted for better range
        return [i * PIXELS_PER_DAY, y];
    });
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

// Event listeners for controls
canvas.addEventListener('touchstart', () => {
    if (bike.state === 'on_ground' && !gameOver) {
        bike.v_y = -JUMP_VELOCITY;
        bike.state = 'in_air';
        bike.totalRotation = 0;
        bike.jumpStartAngle = bike.angle;
    }
});

window.addEventListener('deviceorientation', (event) => {
    const gamma = event.gamma || 0; // -90 to 90 degrees
    bike.rotationSpeed = (gamma / 90) * 2 * Math.PI; // Radians per second
});

// Update game state
function update(deltaTime) {
    if (gameOver) return;

    // Move bike forward
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

    // Update score
    score = Math.floor(bike.x / 10) + flipBonus;
}

// Function to draw a single cloud
function drawCloud(ctx, x, y, size) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#D3D3D3'; // Light gray outline
    ctx.lineWidth = 1;

    // Draw overlapping circles to form a cloud
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI); // Main body
    ctx.arc(x - size * 0.7, y + size * 0.5, size * 0.8, 0, 2 * Math.PI); // Bottom left
    ctx.arc(x + size * 0.7, y + size * 0.5, size * 0.8, 0, 2 * Math.PI); // Bottom right
    ctx.arc(x - size * 0.4, y - size * 0.5, size * 0.6, 0, 2 * Math.PI); // Top left
    ctx.arc(x + size * 0.4, y - size * 0.5, size * 0.6, 0, 2 * Math.PI); // Top right
    ctx.fill();
    ctx.stroke();
}

// Render game
function render() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw sky (above the path)
    const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    skyGradient.addColorStop(0, '#87CEEB'); // Light blue at top
    skyGradient.addColorStop(1, '#E0F6FF'); // Lighter near horizon
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw clouds
    const offsetX = CANVAS_WIDTH / 2 - bike.x;
    clouds.forEach(cloud => {
        const canvasX = cloud.x + offsetX;
        // Only draw if cloud is within canvas bounds
        if (canvasX + cloud.size > 0 && canvasX - cloud.size < CANVAS_WIDTH) {
            drawCloud(ctx, canvasX, cloud.y, cloud.size);
        }
    });

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

    // Draw bike using imported function
    ctx.save();
    ctx.translate(CANVAS_WIDTH / 2, bike.y);
    ctx.rotate(bike.angle);
    drawBike(ctx, bike.x);
    ctx.restore();

    // Draw score or game over
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    if (gameOver) {
        ctx.fillText(`Game Over! Score: ${score}`, CANVAS_WIDTH / 2 - 100, 50);
    } else {
        ctx.fillText(`Score: ${score}`, 10, 20);
    }
}

// Game loop
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

// Initialize and start
fetchStockData().then(() => {
    bike.y = getPathY(bike.x);
    bike.angle = Math.atan(getPathSlope(bike.x));
    requestAnimationFrame(gameLoop);
}).catch((error) => {
    console.error('Failed to start game:', error);
    // Start with sample path as fallback
    generateSamplePath();
    bike.y = getPathY(bike.x);
    bike.angle = Math.atan(getPathSlope(bike.x));
    requestAnimationFrame(gameLoop);
});