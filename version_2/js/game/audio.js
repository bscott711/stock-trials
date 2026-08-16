import { MusicManager } from '../music_manager.js';

// Music + its DOM controls. Previously this lived in vibes.js, which also ran
// two of the three requestAnimationFrame loops - including one whose only job
// was moving the progress bar. The progress bar is now updated from the single
// main loop.

export class Audio {
    constructor(musicPath = './music_assets') {
        this.manager = new MusicManager(musicPath);
        this.muted = false;
        this._preMuteVolume = 0.5;
        this._els = {};
    }

    async init() {
        await this.manager.initializeMusic();

        const $ = (id) => document.getElementById(id);
        const els = this._els = {
            track: $('currentTrack'),
            volumeDown: $('volumeDown'),
            volumeUp: $('volumeUp'),
            pausePlay: $('pausePlay'),
            back: $('backBtn'),
            skip: $('skipBtn'),
            progress: $('progressBar'),
            notice: $('autoplayBlockedNotice'),
        };

        const refresh = () => {
            if (els.track) els.track.textContent = `Now Playing: ${this.manager.getCurrentTrackName()}`;
            if (els.progress) els.progress.value = '0';
        };
        this.manager.onTrackChange = refresh;

        window.addEventListener('musicAutoplayBlocked', () => {
            if (els.notice) els.notice.style.display = 'block';
        });

        els.notice?.addEventListener('click', () => {
            this.manager.startPlaylist();
            els.notice.style.display = 'none';
        });

        els.back?.addEventListener('click', () => this.manager.playPreviousTrack());
        els.skip?.addEventListener('click', () => this.manager.playNextTrack());
        els.volumeDown?.addEventListener('click', () => this.manager.setVolume(this.manager.masterVolume - 0.1));
        els.volumeUp?.addEventListener('click', () => this.manager.setVolume(this.manager.masterVolume + 0.1));

        let paused = false;
        els.pausePlay?.addEventListener('click', () => {
            if (!this.manager.currentAudio) {
                this.manager.startPlaylist();
                els.pausePlay.textContent = '⏸️';
                return;
            }
            paused = !paused;
            paused ? this.manager.pause() : this.manager.resume();
            els.pausePlay.textContent = paused ? '▶️' : '⏸️';
        });

        els.progress?.addEventListener('input', () => {
            const a = this.manager.currentAudio;
            if (a && isFinite(a.duration)) a.currentTime = (els.progress.value / 100) * a.duration;
        });
    }

    /**
     * Start playback if nothing is going yet. Must be called from a user
     * gesture - dismissing the controls overlay is one, which is why the
     * separate "click to start music" prompt is usually never needed.
     */
    startIfIdle() {
        if (this.manager.currentAudio && !this.manager.currentAudio.paused) return;
        this.manager.startPlaylist();
        const notice = this._els.notice;
        if (notice) notice.style.display = 'none';
    }

    /** Called once per rendered frame by the main loop - no separate rAF. */
    updateProgressUI() {
        const a = this.manager.currentAudio;
        const bar = this._els.progress;
        if (!a || !bar || a.paused || !isFinite(a.duration)) return;
        bar.value = String((a.currentTime / a.duration) * 100);
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this._preMuteVolume = this.manager.masterVolume;
            this.manager.setVolume(0);
        } else {
            this.manager.setVolume(this._preMuteVolume);
        }
    }
}
