// game.js
import { Environment } from './environment.js';
import { MusicManager } from './music_manager.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const currentTrackDisplay = document.getElementById('currentTrack');
    const volumeDownBtn = document.getElementById('volumeDown');
    const volumeUpBtn = document.getElementById('volumeUp');
    const pausePlayBtn = document.getElementById('pausePlay');
    const backBtn = document.getElementById('backBtn');
    const skipBtn = document.getElementById('skipBtn');
    const progressBar = document.getElementById('progressBar');
    const autoplayBlockedNotice = document.getElementById('autoplayBlockedNotice');

    if (!autoplayBlockedNotice) {
        console.error('AutoplayBlockedNotice not found in DOM');
        return;
    }

    const musicManager = new MusicManager('./music_assets');
    const environment = new Environment(canvas);

    async function initializeGame() {
        try {
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

            backBtn.addEventListener('click', () => {
                musicManager.playPreviousTrack();
            });

            skipBtn.addEventListener('click', () => {
                musicManager.playNextTrack();
            });

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

            function animate() {
                environment.update();
                requestAnimationFrame(animate);
            }

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

            animate();
        } catch (error) {
            console.error('Game initialization failed:', error);
        }
    }

    initializeGame();
});