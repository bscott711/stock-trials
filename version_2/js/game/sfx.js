// Minimal one-shot sound effects, independent of music_manager.js's
// background-music jukebox (which only ever plays the one ambient track).
// Same "art may not exist yet" tolerance as render/assets.js's getSprite():
// a missing clip is a normal, permanent state, not an error, so nothing here
// may throw.

const POOL_SIZE = 3; // clones per sound, so two overlapping plays don't cut each other off

const SOUNDS = {
    crash: 'crash.mp3',
    landPerfect: 'land-perfect.mp3',
    landSloppy: 'land-sloppy.mp3',
    pickup: 'pickup.mp3',
};

export class SFX {
    constructor(basePath = './sfx_assets') {
        this.muted = false;
        this._cursor = {};
        this._pools = {};
        for (const [name, file] of Object.entries(SOUNDS)) {
            this._pools[name] = Array.from({ length: POOL_SIZE }, () => {
                const a = new Audio(`${basePath}/${file}`);
                a.volume = 0.6;
                a.addEventListener('error', () => { a.dataset.missing = '1'; });
                return a;
            });
        }
    }

    play(name) {
        if (this.muted) return;
        const pool = this._pools[name];
        if (!pool) return;

        const i = (this._cursor[name] || 0) % pool.length;
        this._cursor[name] = i + 1;
        const a = pool[i];
        if (a.dataset.missing) return;

        a.currentTime = 0;
        // Rejection here is routine (autoplay policy, clip still missing) -
        // never surface it as an error.
        a.play().catch(() => {});
    }

    setMuted(muted) {
        this.muted = muted;
    }
}
