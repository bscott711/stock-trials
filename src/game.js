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

const autoplayBlockedNotice = document.createElement('div');
autoplayBlockedNotice.textContent = 'Click here to start music';
autoplayBlockedNotice.style.color = 'white';
autoplayBlockedNotice.style.cursor = 'pointer';
autoplayBlockedNotice.style.display = 'none';
autoplayBlockedNotice.style.position = 'absolute';
autoplayBlockedNotice.style.top = '10px';
autoplayBlockedNotice.style.left = '10px';
autoplayBlockedNotice.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
autoplayBlockedNotice.style.padding = '10px';
autoplayBlockedNotice.style.zIndex = '1000';
document.body.appendChild(autoplayBlockedNotice);
console.log('Notice added to DOM:', document.body.contains(autoplayBlockedNotice));


// Initialize the music manager
console.log('Creating MusicManager...');
const musicManager = new MusicManager('./music_assets');

// Initialize the environment
const environment = new Environment(canvas);

async function initializeGame() {
    console.log('Initializing game...');
    try {
        // Initialize music first (load tracks, but don’t play yet)
        await musicManager.initializeMusic();

        // Update current track display
        function updateTrackDisplay() {
            const trackName = musicManager.getCurrentTrackName();
            console.log(`Track changed to: ${trackName}`);
            currentTrackDisplay.textContent = `Now Playing: ${trackName}`;
        }

        musicManager.onTrackChange = updateTrackDisplay;

        window.addEventListener('musicAutoplayBlocked', () => {
            console.log('Autoplay blocked - showing notice');
            autoplayBlockedNotice.style.display = 'block';
        });

        autoplayBlockedNotice.addEventListener('click', () => {
            console.log('Notice clicked - starting playlist');
            musicManager.startPlaylist();
            autoplayBlockedNotice.style.display = 'none';
        });

        if (!musicManager.currentAudio || musicManager.isAutoplayBlocked) {
            console.log('No music playing yet - showing notice');
            console.log('Current audio:', musicManager.currentAudio);
            console.log('Autoplay blocked:', musicManager.isAutoplayBlocked);
            autoplayBlockedNotice.style.display = 'block';
            console.log('Notice display set to:', autoplayBlockedNotice.style.display);
        }

        // Music control event listeners (unchanged)
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

        // Animation loop
        function animate() {
            environment.update();
            requestAnimationFrame(animate);
        }
        // Start the animation
        animate();
        
        console.log('Game initialization complete');
    } catch (error) {
        console.error('Game initialization failed:', error);
    }
}

// Start the game
initializeGame();