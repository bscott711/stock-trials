// vibes.js
import { Environment } from './environment.js';
import { MusicManager } from './music_manager.js';

export const vibes = (function () {
    let canvas = document.getElementById('gameCanvas');
    let time = 0;
    let environment = null; // Explicitly initialize as null
    const musicManager = new MusicManager('./music_assets');

    // DOM elements
    const currentTrackDisplay = document.getElementById('currentTrack');
    const volumeDownBtn = document.getElementById('volumeDown');
    const volumeUpBtn = document.getElementById('volumeUp');
    const pausePlayBtn = document.getElementById('pausePlay');
    const backBtn = document.getElementById('backBtn');
    const skipBtn = document.getElementById('skipBtn');
    const progressBar = document.getElementById('progressBar');
    const autoplayBlockedNotice = document.getElementById('autoplayBlockedNotice');

    // Promise to track initialization
    let initPromiseResolve;
    const initPromise = new Promise(resolve => {
        initPromiseResolve = resolve;
    });

    async function initialize() {
        try {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            environment = new Environment(canvas); // Assign to the outer environment
            console.log('Environment created:', environment); // Debug: Check creation
            await environment.initializeGround(); // Wait for ground data
            console.log('Ground initialized, environment:', environment); // Debug: Post-ground

            await musicManager.initializeMusic();

            function updateTrackDisplay() {
                const trackName = musicManager.getCurrentTrackName();
                currentTrackDisplay.textContent = `Now Playing: ${trackName}`;
                progressBar.value = '0';
                progressBar.max = musicManager.currentAudio ? musicManager.currentAudio.duration : 100;
            }

            musicManager.onTrackChange = updateTrackDisplay;

            window.addEventListener('musicAutoplayBlocked', () => {
                autoplayBlockedNotice.style.display = 'block';
            });

            autoplayBlockedNotice.addEventListener('click', () => {
                musicManager.startPlaylist();
                autoplayBlockedNotice.style.display = 'none';
            });

            if (!musicManager.currentAudio || musicManager.isAutoplayBlocked) {
                autoplayBlockedNotice.style.display = 'block';
            }

            backBtn.addEventListener('click', () => musicManager.playPreviousTrack());
            skipBtn.addEventListener('click', () => musicManager.playNextTrack());

            function updateProgress() {
                if (musicManager.currentAudio && !musicManager.currentAudio.paused) {
                    const progress = (musicManager.currentAudio.currentTime / musicManager.currentAudio.duration) * 100;
                    progressBar.value = isNaN(progress) ? 0 : progress;
                }
                requestAnimationFrame(updateProgress);
            }
            updateProgress();

            progressBar.addEventListener('input', () => {
                if (musicManager.currentAudio) {
                    const seekTime = (progressBar.value / 100) * musicManager.currentAudio.duration;
                    musicManager.currentAudio.currentTime = seekTime;
                }
            });

            volumeDownBtn.addEventListener('click', () => {
                musicManager.setVolume(Math.max(0, musicManager.masterVolume - 0.1));
            });

            volumeUpBtn.addEventListener('click', () => {
                musicManager.setVolume(Math.min(1, musicManager.masterVolume + 0.1));
            });

            let isPaused = false;
            pausePlayBtn.addEventListener('click', () => {
                if (isPaused) {
                    musicManager.resume();
                    pausePlayBtn.textContent = '⏸️';
                } else {
                    musicManager.pause();
                    pausePlayBtn.textContent = '▶️';
                }
                isPaused = !isPaused;
            });

            function animate() {
                environment.update();
                requestAnimationFrame(animate);
            }
            animate();

            console.log('Before resolving vibes.ready, environment:', environment); // Debug: Pre-resolve
            initPromiseResolve();
        } catch (error) {
            console.error('Vibes initialization failed:', error);
            throw error; // Ensure the promise rejects on error
        }
    }

    document.addEventListener('DOMContentLoaded', initialize);

    // Return object with environment explicitly included
    return {
        get time() { return time; },
        set time(value) { time = value; },
        set canvas(newCanvas) {
            canvas = newCanvas;
            if (environment) environment.canvas = newCanvas;
        },
        update(bikeX) {
            if (environment) environment.update(bikeX);
        },
        get environment() { return environment; }, // Use a getter for clarity
        ready: initPromise
    };
})();