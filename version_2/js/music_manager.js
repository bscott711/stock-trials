// music_manager.js
class MusicLoader {
    constructor(musicPath = '../music_assets') {
        this.musicPath = musicPath;
        this.tracks = [];
    }

    async loadTrackList() {
        try {
            const response = await fetch(`${this.musicPath}/tracklist.txt`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const tracklistText = await response.text();

            this.tracks = tracklistText
                .split('\n')
                .map(line => line.trim())
                .filter(filename =>
                    filename !== '' &&
                    filename !== 'tracklist.txt' &&
                    filename.endsWith('.mp3')
                )
                .map(filename => `${this.musicPath}/${encodeURIComponent(filename)}`);

            return this.tracks;
        } catch (error) {
            console.error('Error loading tracklist:', error);
            return [];
        }
    }
}

// Tracks are streamed on demand: at most two Audio elements exist at a time,
// the one playing and the one being prefetched near the end of it. Creating an
// element per track with preload='auto' pulls the entire library on page load.
const PREFETCH_LEAD_SECONDS = 15;

class MusicManager {
    constructor(musicPath = '../music_assets') {
        this.musicLoader = new MusicLoader(musicPath);
        this.trackPaths = [];
        this.currentTrackIndex = -1;
        this.currentAudio = null;
        this.masterVolume = 0.5;
        this.onTrackChange = null;
        this.isAutoplayBlocked = false;

        this._prefetch = null;       // { index, audio }
        this._onTimeUpdate = null;
    }

    async initializeMusic() {
        this.trackPaths = await this.musicLoader.loadTrackList();
        if (this.trackPaths.length === 0) {
            console.warn('No music tracks found');
        }
        this.shuffle();
        return this;
    }

    shuffle() {
        for (let i = this.trackPaths.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.trackPaths[i], this.trackPaths[j]] = [this.trackPaths[j], this.trackPaths[i]];
        }
        this.currentTrackIndex = -1;
        this._discardPrefetch();
        return this;
    }

    _createAudio(index, preload) {
        const audio = new Audio();
        audio.preload = preload;
        audio.volume = this.masterVolume;
        audio.src = this.trackPaths[index];
        return audio;
    }

    _discardPrefetch() {
        if (this._prefetch) {
            this._prefetch.audio.removeAttribute('src');
            this._prefetch.audio.load(); // cancels the in-flight request
            this._prefetch = null;
        }
    }

    _teardownCurrent() {
        if (!this.currentAudio) return;
        this.currentAudio.pause();
        if (this._onTimeUpdate) {
            this.currentAudio.removeEventListener('timeupdate', this._onTimeUpdate);
            this._onTimeUpdate = null;
        }
        this.currentAudio.removeAttribute('src');
        this.currentAudio.load();
        this.currentAudio = null;
    }

    // Warm the next track only once the current one is nearly over, so skipping
    // through the playlist does not queue up a download per skip.
    _armPrefetch() {
        const audio = this.currentAudio;
        if (!audio || this.trackPaths.length < 2) return;

        const nextIndex = (this.currentTrackIndex + 1) % this.trackPaths.length;

        this._onTimeUpdate = () => {
            const { duration, currentTime } = audio;
            if (!isFinite(duration)) return;
            if (duration - currentTime > PREFETCH_LEAD_SECONDS) return;
            if (this._prefetch && this._prefetch.index === nextIndex) return;

            this._discardPrefetch();
            this._prefetch = { index: nextIndex, audio: this._createAudio(nextIndex, 'auto') };
            audio.removeEventListener('timeupdate', this._onTimeUpdate);
            this._onTimeUpdate = null;
        };

        audio.addEventListener('timeupdate', this._onTimeUpdate);
    }

    playTrackAt(index) {
        if (this.trackPaths.length === 0) {
            console.warn('No tracks in playlist');
            return this;
        }

        const wrapped = ((index % this.trackPaths.length) + this.trackPaths.length) % this.trackPaths.length;

        // Adopt the prefetched element if it is the track we're about to play.
        let audio = null;
        if (this._prefetch && this._prefetch.index === wrapped) {
            audio = this._prefetch.audio;
            this._prefetch = null;
        }

        this._teardownCurrent();
        this._discardPrefetch();

        this.currentTrackIndex = wrapped;
        this.currentAudio = audio || this._createAudio(wrapped, 'auto');
        this.currentAudio.volume = this.masterVolume;
        this.currentAudio.addEventListener('ended', () => this.playNextTrack(), { once: true });

        this.currentAudio.play()
            .then(() => {
                this.isAutoplayBlocked = false;
                this._armPrefetch();
            })
            .catch((error) => {
                if (error.name === 'NotAllowedError') {
                    this.isAutoplayBlocked = true;
                    window.dispatchEvent(new Event('musicAutoplayBlocked'));
                } else {
                    console.error('Error playing track:', error);
                }
            });

        if (typeof this.onTrackChange === 'function') {
            this.onTrackChange();
        }
        return this;
    }

    playNextTrack() {
        return this.playTrackAt(this.currentTrackIndex + 1);
    }

    playPreviousTrack() {
        return this.playTrackAt(this.currentTrackIndex - 1);
    }

    startPlaylist() {
        if (this.currentAudio && this.isAutoplayBlocked) {
            // The user just gestured; retry the track already queued up.
            this.currentAudio.play()
                .then(() => { this.isAutoplayBlocked = false; this._armPrefetch(); })
                .catch((error) => console.error('Still unable to start playback:', error));
            return this;
        }
        return this.playNextTrack();
    }

    startPlaybackAfterInteraction() {
        return this.startPlaylist();
    }

    getCurrentTrackName() {
        if (this.currentTrackIndex < 0 || !this.trackPaths[this.currentTrackIndex]) {
            return 'No track playing';
        }
        const filename = decodeURIComponent(this.trackPaths[this.currentTrackIndex].split('/').pop());
        return filename.replace(/\.mp3$/i, '');
    }

    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.currentAudio) this.currentAudio.volume = this.masterVolume;
        if (this._prefetch) this._prefetch.audio.volume = this.masterVolume;
        return this;
    }

    pause() {
        if (this.currentAudio) this.currentAudio.pause();
        return this;
    }

    resume() {
        if (this.currentAudio) {
            this.currentAudio.play()
                .catch((error) => console.error('Error resuming track:', error));
        }
        return this;
    }

    stop() {
        this._teardownCurrent();
        this._discardPrefetch();
        this.currentTrackIndex = -1;
        return this;
    }
}

export { MusicManager };
