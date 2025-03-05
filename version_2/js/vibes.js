// vibes.js
import { Environment } from './environment.js';
import { MusicManager } from './music_manager.js';

export const vibes = (function () {
    let canvas = document.getElementById('gameCanvas');
    let time = 0;
    let environment; // Defer instantiation
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

    async function initialize() {
        try {
            // Set canvas dimensions BEFORE creating Environment
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Now instantiate Environment with a properly sized canvas
            environment = new Environment(canvas);

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
        } catch (error) {
            console.error('Vibes initialization failed:', error);
        }
    }

    // Start initialization when DOM is ready
    document.addEventListener('DOMContentLoaded', initialize);

    return {
        get time() {
            return time;
        },
        set time(value) {
            time = value;
        },
        set canvas(newCanvas) {
            canvas = newCanvas;
            if (environment) {
                environment.canvas = newCanvas; // Update environment's canvas reference
            }
        },
        update() {
            if (environment) {
                environment.update();
            }
        }
    };
})();