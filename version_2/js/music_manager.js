// music_manager.js
class MusicLoader {
    constructor(musicPath = '../music_assets') {
        this.musicPath = musicPath;
        this.tracks = [];
        console.log(`MusicLoader initialized with path: ${this.musicPath}`);
    }

    async loadTrackList() {
        try {
            console.log(`Attempting to fetch tracklist from: ${this.musicPath}/tracklist.txt`);
            const response = await fetch(`${this.musicPath}/tracklist.txt`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const tracklistText = await response.text();
            console.log('Tracklist content:', tracklistText);
            
            this.tracks = tracklistText
                .split('\n')
                .filter(filename => 
                    filename.trim() !== '' && 
                    filename !== 'tracklist.txt' && 
                    filename.endsWith('.mp3')
                )
                .map(filename => {
                    const fullPath = `${this.musicPath}/${filename}`;
                    console.log(`Processed track path: ${fullPath}`);
                    return fullPath;
                });

            console.log('Processed tracks:', this.tracks);
            return this.tracks;
        } catch (error) {
            console.error('Error loading tracklist:', error);
            return [];
        }
    }
}

class MusicManager {
    constructor(musicPath = '../music_assets') {
        console.log(`MusicManager initialized with path: ${musicPath}`);
        this.musicLoader = new MusicLoader(musicPath);
        this.audioTracks = [];
        this.currentTrackIndex = -1;
        this.currentAudio = null;
        this.masterVolume = 0.5; // Default to 50% volume
        this.onTrackChange = null; // Callback for track changes
        this.isAutoplayBlocked = false;
    }

    async initializeMusic() {
        console.log('Initializing music...');
        try {
            const trackPaths = await this.musicLoader.loadTrackList();
            
            console.log(`Number of tracks loaded: ${trackPaths.length}`);
            
            this.audioTracks = trackPaths.map((path, index) => {
                console.log(`Creating audio object for track: ${path}`);
                const audio = new Audio(path);
                
                audio.addEventListener('loadedmetadata', () => {
                    console.log(`Metadata loaded for track ${index}: ${path}`);
                });
                
                audio.addEventListener('canplaythrough', () => {
                    console.log(`Can play through track ${index}: ${path}`);
                });
                
                audio.addEventListener('error', (e) => {
                    console.error(`Error loading track ${index}: ${path}`, e);
                });
                
                audio.preload = 'auto';
                audio.volume = this.masterVolume;
                
                audio.addEventListener('ended', () => {
                    console.log(`Track ended: ${path}`);
                    this.playNextTrack();
                });
                
                return audio;
            });

            this.shuffle();
            console.log('Music initialization complete');
            return this;
        } catch (error) {
            console.error('Music initialization failed:', error);
            throw error;
        }
    }

    shuffle() {
        console.log('Shuffling tracks');
        for (let i = this.audioTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.audioTracks[i], this.audioTracks[j]] = [this.audioTracks[j], this.audioTracks[i]];
        }
        this.currentTrackIndex = -1;
        return this;
    }

    playNextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.audioTracks.length;
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        this.currentAudio = this.audioTracks[this.currentTrackIndex];
        
        if (!this.currentAudio) {
            console.error('No valid audio track at index:', this.currentTrackIndex);
            return this;
        }

        if (this.isAutoplayBlocked) {
            window.dispatchEvent(new Event('musicAutoplayBlocked'));
            return this;
        }

        try {
            this.currentAudio.play()
                .then(() => {
                    this.isAutoplayBlocked = false;
                })
                .catch((error) => {
                    if (error.name === 'NotAllowedError') {
                        this.isAutoplayBlocked = true;
                        window.dispatchEvent(new Event('musicAutoplayBlocked'));
                    } else {
                        console.error('Error playing track:', error);
                    }
                });
        } catch (error) {
            console.error('Unexpected error when playing track:', error);
        }

        if (typeof this.onTrackChange === 'function') {
            this.onTrackChange();
        }
        return this;
    }

    playPreviousTrack() {
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.audioTracks.length) % this.audioTracks.length;
        if (this.currentAudio) {
            this.currentAudio.pause();
        }
        this.currentAudio = this.audioTracks[this.currentTrackIndex];
        
        if (!this.currentAudio) {
            console.error('No valid audio track at index:', this.currentTrackIndex);
            return this;
        }

        if (this.isAutoplayBlocked) {
            window.dispatchEvent(new Event('musicAutoplayBlocked'));
            return this;
        }

        try {
            this.currentAudio.play()
                .then(() => {
                    this.isAutoplayBlocked = false;
                })
                .catch((error) => {
                    if (error.name === 'NotAllowedError') {
                        this.isAutoplayBlocked = true;
                        window.dispatchEvent(new Event('musicAutoplayBlocked'));
                    } else {
                        console.error('Error playing track:', error);
                    }
                });
        } catch (error) {
            console.error('Unexpected error when playing track:', error);
        }

        if (typeof this.onTrackChange === 'function') {
            this.onTrackChange();
        }
        return this;
    }

    startPlaylist() {
        if (this.audioTracks.length > 0) {
            this.playNextTrack();
        }
        return this;
    }

    // Method to start playback after user interaction
    startPlaybackAfterInteraction() {
        if (this.isAutoplayBlocked && this.currentAudio) {
            console.log('Attempting to start playback after user interaction');
            this.currentAudio.play()
                .then(() => {
                    this.isAutoplayBlocked = false;
                    console.log('Playback started successfully');
                })
                .catch((error) => {
                    console.error('Still unable to start playback:', error);
                });
        }
    }

    getCurrentTrackName() {
        if (this.currentAudio) {
            const path = this.currentAudio.src;
            return decodeURIComponent(path.split('/').pop());
        }
        return 'No track playing';
    }

    startPlaylist() {
        console.log('Starting playlist');
        if (this.audioTracks.length > 0) {
            this.playNextTrack();
        } else {
            console.warn('No tracks in playlist');
        }
        return this;
    }

    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        console.log(`Volume set to: ${this.masterVolume}`);
        this.audioTracks.forEach(track => {
            track.volume = this.masterVolume;
        });
        return this;
    }

    pause() {
        if (this.currentAudio) {
            console.log('Pausing current track');
            this.currentAudio.pause();
        }
        return this;
    }

    resume() {
        if (this.currentAudio) {
            console.log('Resuming current track');
            this.currentAudio.play()
                .catch((error) => console.error('Error resuming track:', error));
        }
        return this;
    }

    stop() {
        if (this.currentAudio) {
            console.log('Stopping current track');
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        this.currentTrackIndex = -1;
        return this;
    }
}

export { MusicManager };