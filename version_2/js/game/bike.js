import { clamp, wrapPi } from '../core/math.js';

// Interim bike. Phase 4 replaces this with a rigid chassis on two
// spring-damper wheel contacts; the interface (x, y, angle, vx, airborne)
// is what the camera and renderer already consume, and does not change.
//
// `y` is the AXLE line, not the ground line. drawbike.js places both wheel
// centres at local y=0 with radius 30, so riding at surfaceY put the wheels
// a full radius underground.

export const WHEEL_R = 30;

const DRIVE = 190;
const BRAKE = 320;
export const MAX_SPEED = 620;
const MIN_SPEED = 60;
const GRAVITY = 1600;
const JUMP_IMPULSE = 520;
// AIR_TORQUE was 9 rad/s^2 - simulating this update() loop standalone found
// held-full-lean rotation reaches only ~97 degrees over a flat-ground jump's
// ~0.63s hang time, and needs ~1.28s of continuous max lean to complete a
// single 360 degree rotation at all. The landing check at the time only
// tolerated +/-55 degrees off upright, so that meant partial rotation never
// landed safely and a full rotation was outside the reachable hang-time
// range on all but the biggest drops - a flip could not actually be landed.
// Raised so a full
// flip's rotation completes within realistic hang times (a plain jump
// through a big drop, roughly 0.65-1.15s) with a real, if imperfect, window
// to release lean and land on it - the physics-budget bug, not the timing
// skill, was what made this unlandable before.
const AIR_TORQUE = 40;
const AIR_DAMP = 0.4;
const MAX_ANGVEL = 14;
const LAND_PERFECT = 0.31;  // ~18deg
const COYOTE_TIME = 0.10;
const JUMP_BUFFER = 0.12;

// Rider head position in the rig's local (pre-rotation) space, relative to
// the same wheelbase-midpoint origin computeRig() uses - hand-copied from
// js/drawrider.js (head_x = seat_x - 2, head_y = seat_y - TORSO_LENGTH -
// HEAD_R off js/drawbike.js's SEAT_X/Y) rather than imported, since physics
// doesn't otherwise depend on the render/rig modules (see WHEEL_R above).
// Re-measure if that geometry ever changes.
const HEAD_LOCAL_X = -25.5;
const HEAD_LOCAL_Y = -134.2;

// Auto-level: a plain Space-only jump never rotates the bike (no lean input
// means zero torque below), so it lands at whatever angle it took off at.
// Terrain slope changes fast enough over a typical ~0.65s hang time that
// this alone was enough to cross CRASH_ANGLE on most jumps. This is a
// critically-damped spring pulling angle back toward level (0), active only
// when the player isn't actively steering AND isn't mid-trick.
//
// "Mid-trick" used to be judged by instantaneous spin rate (angVel above a
// cutoff), but that cutoff was tuned back when AIR_TORQUE was 9 - at 40, a
// lean tap held for barely 60ms now crosses it, permanently disabling
// recovery for the rest of the jump over a few accidental degrees of spin
// (confirmed by simulating single-jump lean taps standalone: a 50ms tap
// self-corrects and lands perfectly, a 70ms tap - only ~5 degrees of actual
// rotation at release - never recovers and crashes with 500ms of untouched
// air time left to do it in). Gating on ACCUMULATED rotation instead fixes
// this without touching real flips: a committed flip blows past this cutoff
// within ~150-200ms of holding lean (well before the ~300ms hold a flip
// actually needs to complete), so it's already spinning too far to trip this
// the same way an accidental tap never gets close.
const AUTO_LEVEL_OMEGA = 4;            // rad/s natural frequency
const AUTO_LEVEL_ZETA = 1;             // 1 = critically damped, no overshoot
const AUTO_LEVEL_ROTATION_CUTOFF = Math.PI / 3; // ~60deg accumulated - past this, a trick is in progress
const LEAN_DEADZONE = 0.05;

export class Bike {
    constructor(terrain) {
        this.terrain = terrain;
        this.reset();
    }

    reset(x = 0) {
        this.x = x;
        this.y = this.terrain.sampleY(x) - WHEEL_R;
        this.vx = 220;
        this.vy = 0;
        this.angle = Math.atan(this.terrain.sampleSlope(x));
        this.angVel = 0;
        this.airborne = false;
        this.distance = 0;

        this.totalRotation = 0;
        this.airTimer = 0;
        this._coyote = 0;
        this._jumpBuffer = 0;

        this.crashed = false;
        this.flips = 0;
        this.flipBonus = 0;
        this.lastLanding = null;
    }

    update(dt, input) {
        if (this.crashed) {
            // Let it coast to a stop rather than freezing mid-air.
            this.vx *= 0.94;
            if (this.airborne) {
                this.vy += GRAVITY * dt;
                this.y += this.vy * dt;
                this.angle += this.angVel * dt;
                const surface = this.terrain.sampleY(this.x) - WHEEL_R;
                if (this.y >= surface) { this.y = surface; this.airborne = false; this.angVel = 0; }
            }
            this.x += this.vx * dt;
            return;
        }

        // Throttle / brake
        const accel = input.value('accel');
        const brake = input.value('brake');
        if (accel > 0) this.vx += DRIVE * accel * dt;
        if (brake > 0) this.vx -= BRAKE * brake * dt;
        if (accel === 0 && brake === 0) this.vx += (240 - this.vx) * 0.4 * dt;
        this.vx = clamp(this.vx, MIN_SPEED, MAX_SPEED);

        this.x += this.vx * dt;
        this.distance += this.vx * dt;

        if (this._jumpBuffer > 0) this._jumpBuffer -= dt;
        if (input.pressed('jump')) this._jumpBuffer = JUMP_BUFFER;

        if (this.airborne) {
            this.airTimer += dt;
            this.vy += GRAVITY * dt;
            this.y += this.vy * dt;

            const lean = input.lean();
            this.angVel += lean * AIR_TORQUE * dt;

            if (Math.abs(lean) < LEAN_DEADZONE && Math.abs(this.totalRotation) < AUTO_LEVEL_ROTATION_CUTOFF) {
                const wrapped = wrapPi(this.angle);
                const omega2 = AUTO_LEVEL_OMEGA * AUTO_LEVEL_OMEGA;
                const restoring = -omega2 * wrapped - 2 * AUTO_LEVEL_ZETA * AUTO_LEVEL_OMEGA * this.angVel;
                this.angVel += restoring * dt;
            }

            this.angVel *= Math.exp(-AIR_DAMP * dt);
            this.angVel = clamp(this.angVel, -MAX_ANGVEL, MAX_ANGVEL);
            this.angle += this.angVel * dt;
            this.totalRotation += this.angVel * dt;

            const surface = this.terrain.sampleY(this.x) - WHEEL_R;
            if (this.y >= surface) this._land(surface);
        } else {
            this._coyote = COYOTE_TIME;
            const surface = this.terrain.sampleY(this.x) - WHEEL_R;
            this.y = surface;
            this.angle = Math.atan(this.terrain.sampleSlope(this.x));
            this.angVel = 0;

            if (this._jumpBuffer > 0) {
                this._jumpBuffer = 0;
                this.airborne = true;
                this.airTimer = 0;
                this.totalRotation = 0;
                this.vy = -JUMP_IMPULSE;
            }
        }
    }

    _land(surface) {
        this.y = surface;
        const surfaceAngle = Math.atan(this.terrain.sampleSlope(this.x));
        const diff = Math.abs(wrapPi(this.angle - surfaceAngle));

        // A landing only crashes if the rider's actual head would be in the
        // ground, not off some fixed lean-angle cutoff - a wheelie (rear
        // wheel down) or a stoppie (front wheel down) is a real landing this
        // rig's geometry can take well past what a flat angle threshold used
        // to allow; only going far enough over the bars or the back to bring
        // the head down is a genuine crash.
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const headX = this.x + HEAD_LOCAL_X * cos - HEAD_LOCAL_Y * sin;
        const headY = this.y + HEAD_LOCAL_X * sin + HEAD_LOCAL_Y * cos;
        const headClearance = this.terrain.sampleY(headX) - headY;

        if (headClearance <= 0) {
            this.crashed = true;
            this.lastLanding = 'crash';
            // Already sitting on the surface (this.y was just clamped above),
            // so it's landed, not still falling - without this the crashed-
            // coast branch in update() re-applies gravity for one extra step
            // before its own clamp catches up.
            this.airborne = false;
            this.vy = 0;
            this.angVel = 0;
            return;
        }

        if (this.airTimer > 0.15) {
            const spins = Math.floor(Math.abs(this.totalRotation) / (Math.PI * 2));
            if (spins > 0) {
                this.flips += spins;
                this.flipBonus += spins * 100;
            }
        }

        if (diff < LAND_PERFECT) {
            this.lastLanding = 'perfect';
        } else {
            this.lastLanding = 'sloppy';
            this.vx *= 0.6;
        }

        this.airborne = false;
        this.vy = 0;
        this.angVel = 0;
        this.angle = surfaceAngle;
        // Reset on every ground contact. The old code reset only on jump, so
        // consecutive hops banked free flips forever.
        this.totalRotation = 0;
        this.airTimer = 0;
    }
}
