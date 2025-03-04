// game.js

import { Environment } from 'environment.js';

// Select the canvas and set its dimensions
const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize the environment
const environment = new Environment(canvas);

// Animation loop
function animate() {
  // Update the environment
  environment.update();

  // Request the next frame
  requestAnimationFrame(animate);
}

// Start the animation
animate();