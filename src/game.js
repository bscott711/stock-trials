// game.js
import { Environment } from './environment.js';
import { MusicManager } from './music_manager.js';

console.log('Game script starting...');

// Select the canvas and set its dimensions
const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Select music control elements
const currentTrackDisplay = document.getElementById('currentTrack');
const volumeDownBtn = document.getElementById('volumeDown');
const volumeUpBtn = document.getElementById('volumeUp');
const pausePlayBtn = document.getElementById('pausePlay');

// Initialize the music manager
console.log('Creating MusicManager...');
const musicManager = new MusicManager('../music_assets');

// Initialize the environment
const environment = new Environment(canvas);

// Async function to set up game with music
async function initializeGame() {
    console.log('Initializing game...');
    try {
        // Initialize music first
        await musicManager.initializeMusic();
        
        // Start the music playlist
        console.log('Starting playlist...');
        musicManager.startPlaylist();

        // Update current track display
        function updateTrackDisplay() {
            const trackName = musicManager.getCurrentTrackName();
            console.log(`Track changed to: ${trackName}`);
            currentTrackDisplay.textContent = `Now Playing: ${trackName}`;
        }

        // Track change listener
        musicManager.onTrackChange = updateTrackDisplay;

        // Animation loop
        function animate() {
            // Update the environment
            environment.update();
            
            // Request the next frame
            requestAnimationFrame(animate);
        }

        // Music control event listeners
        volumeDownBtn.addEventListener('click', () => {
            const currentVolume = musicManager.masterVolume;
            console.log(`Current volume: ${currentVolume}`);
            musicManager.setVolume(Math.max(0, currentVolume - 0.1));
        });

        volumeUpBtn.addEventListener('click', () => {
            const currentVolume = musicManager.masterVolume;
            console.log(`Current volume: ${currentVolume}`);
            musicManager.setVolume(Math.min(1, currentVolume + 0.1));
        });

        let isPaused = false;
        pausePlayBtn.addEventListener('click', () => {
            if (isPaused) {
                musicManager.resume();
                pausePlayBtn.textContent = '⏸️ Pause';
                console.log('Resuming music');
            } else {
                musicManager.pause();
                pausePlayBtn.textContent = '▶️ Play';
                console.log('Pausing music');
            }
            isPaused = !isPaused;
        });

        // Start the animation
        animate();
        
        console.log('Game initialization complete');
    } catch (error) {
        console.error('Game initialization failed:', error);
    }
}

// Start the game
initializeGame();