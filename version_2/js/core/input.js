// Unified input as an ACTION layer. Nothing downstream ever sees a key code.
//
// Before this, the only handlers in the game were `touchstart` and
// `deviceorientation` - there was no desktop input at all, so on a laptop the
// bike simply rode the terrain and could not jump or flip.

const KEY_MAP = {
    // Keyed by e.code, not e.key: e.key changes with keyboard layout and with
    // Shift held, so e.key bindings silently break for a lot of people.
    ArrowRight: 'accel', KeyD: 'accel', KeyW: 'accel',
    ArrowLeft: 'brake', KeyA: 'brake', KeyS: 'brake',
    ArrowUp: 'leanBack', KeyQ: 'leanBack',
    ArrowDown: 'leanFwd', KeyE: 'leanFwd',
    Space: 'jump',
    KeyR: 'restart',
    Escape: 'pause', KeyP: 'pause',
    KeyM: 'mute',
    KeyH: 'help', Slash: 'help',
};

const PREVENT_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

const ACTIONS = ['accel', 'brake', 'leanBack', 'leanFwd', 'jump', 'restart', 'pause', 'mute', 'help'];

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.state = {};
        this.prev = {};
        // Edges are LATCHED rather than derived by comparing state to prev.
        // A tap whose press and release both land between two update steps
        // leaves state back at 0, so a state-vs-prev comparison never sees it
        // and the input is silently dropped - which cost real jumps.
        this._pressLatch = new Set();
        this._releaseLatch = new Set();
        for (const a of ACTIONS) {
            this.state[a] = 0;
            this.prev[a] = 0;
        }

        this.tiltEnabled = false;
        this._tiltZero = null;
        this._tiltLean = 0;
        this._pointerLean = 0;
        this._lastAnalogSource = 'none';

        this._bindKeyboard();
        this._bindPointer();
        this._bindFocus();
    }

    /** Single point of mutation, so every source gets edge latching. */
    _set(action, value) {
        if (!(action in this.state)) return;
        const was = this.state[action] > 0.001;
        const now = value > 0.001;
        if (!was && now) this._pressLatch.add(action);
        if (was && !now) this._releaseLatch.add(action);
        this.state[action] = value;
    }

    // --- query -----------------------------------------------------------
    value(action) { return this.state[action] || 0; }
    down(action) { return (this.state[action] || 0) > 0.001; }
    pressed(action) { return this._pressLatch.has(action); }
    released(action) { return this._releaseLatch.has(action); }

    /** -1 (lean back) .. +1 (lean forward), from whichever source moved last. */
    lean() {
        const keyLean = this.value('leanFwd') - this.value('leanBack');
        if (Math.abs(keyLean) > 0.001) return keyLean;
        if (this._lastAnalogSource === 'tilt') return this._tiltLean;
        return this._pointerLean;
    }

    /** Drop every held input, e.g. when opening a modal mid-ride. */
    clear() {
        this._clearHeld();
    }

    /** Public entry point for external UI (on-screen buttons) to drive an action. */
    setAction(action, value) {
        this._set(action, value);
    }

    endFrame() {
        this._pressLatch.clear();
        this._releaseLatch.clear();
        for (const a of ACTIONS) this.prev[a] = this.state[a];
    }

    // --- sources ---------------------------------------------------------
    _bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const action = KEY_MAP[e.code];
            if (!action) return;
            if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
            this._set(action, 1);
        });
        window.addEventListener('keyup', (e) => {
            const action = KEY_MAP[e.code];
            if (!action) return;
            if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
            this._set(action, 0);
        });
    }

    _bindPointer() {
        // Pointer Events cover mouse, touch and pen in one path. The old
        // touchstart-only handler had no matching touchend, so it could not
        // represent "held" at all.
        const c = this.canvas;

        const setFromPointer = (e, downState) => {
            // Touch no longer drives accel/brake/jump from canvas position -
            // those are real on-screen buttons now (see main.js). Pointer
            // capture + _updatePointerLean below still handle the drag-to-lean
            // fallback for touch, untouched by this early return.
            if (e.pointerType === 'touch') return;
            if (e.button === 2) this._set('brake', downState);
            else this._set('accel', downState);
        };

        c.addEventListener('pointerdown', (e) => {
            c.setPointerCapture?.(e.pointerId);
            setFromPointer(e, 1);
            this._updatePointerLean(e);
        });
        c.addEventListener('pointermove', (e) => this._updatePointerLean(e));
        c.addEventListener('pointerup', (e) => setFromPointer(e, 0));
        c.addEventListener('pointercancel', () => this._clearHeld());
        c.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _updatePointerLean(e) {
        if (e.pointerType === 'touch' && !e.buttons) return;
        const rect = this.canvas.getBoundingClientRect();
        const dx = (e.clientX - rect.left) - rect.width / 2;
        const v = Math.max(-1, Math.min(1, dx / (rect.width * 0.25)));
        this._pointerLean = v;
        this._lastAnalogSource = 'pointer';
    }

    _bindFocus() {
        // Without this, alt-tabbing away mid-throttle leaves it stuck on.
        const clear = () => this._clearHeld();
        window.addEventListener('blur', clear);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clear();
        });
    }

    _clearHeld() {
        for (const a of ACTIONS) this._set(a, 0);
        this._pointerLean = 0;
    }

    /**
     * Must be called from a user gesture: iOS 13+ requires
     * DeviceOrientationEvent.requestPermission() to originate from one, and
     * silently delivers nothing otherwise.
     */
    async enableTilt() {
        const DOE = window.DeviceOrientationEvent;
        if (!DOE) return false;
        if (typeof DOE.requestPermission === 'function') {
            try {
                if (await DOE.requestPermission() !== 'granted') return false;
            } catch {
                return false;
            }
        }
        window.addEventListener('deviceorientation', (e) => {
            // gamma is null on desktop and near-null when the device is flat.
            if (e.gamma === null || e.gamma === undefined) return;
            if (this._tiltZero === null) this._tiltZero = e.gamma;
            const delta = e.gamma - this._tiltZero;
            if (Math.abs(delta) < 5) { // deadzone: nobody holds a phone at exactly 0
                this._tiltLean = 0;
            } else {
                this._tiltLean = Math.max(-1, Math.min(1, (delta - Math.sign(delta) * 5) / 35));
            }
            this._lastAnalogSource = 'tilt';
        });
        this.tiltEnabled = true;
        return true;
    }
}
