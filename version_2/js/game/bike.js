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
const MAX_SPEED = 620;
const MIN_SPEED = 60;
const GRAVITY = 1600;
const JUMP_IMPULSE = 520;
const AIR_TORQUE = 9;
const AIR_DAMP = 0.4;
const MAX_ANGVEL = 12;
const CRASH_ANGLE = 0.96;   // ~55deg
const LAND_PERFECT = 0.31;  // ~18deg
const COYOTE_TIME = 0.10;
const JUMP_BUFFER = 0.12;

// Auto-level: a plain Space-only jump never rotates the bike (no lean input
// means zero torque below), so it lands at whatever angle it took off at.
// Terrain slope changes fast enough over a typical ~0.65s hang time that
// this alone was enough to cross CRASH_ANGLE on most jumps. This is a
// critically-damped spring pulling angle back toward level (0), active only
// when the player isn't actively steering AND isn't mid-trick, so it never
// fights a deliberate flip (which needs sustained angVel well above the
// cutoff to complete a rotation in one hang time).
const AUTO_LEVEL_OMEGA = 4;         // rad/s natural frequency
const AUTO_LEVEL_ZETA = 1;          // 1 = critically damped, no overshoot
const AUTO_LEVEL_SPIN_CUTOFF = 2.5; // rad/s - at/above this a trick is in progress
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

            if (Math.abs(lean) < LEAN_DEADZONE && Math.abs(this.angVel) < AUTO_LEVEL_SPIN_CUTOFF) {
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

        // Three bands, not two. A single pass/fail threshold is what makes
        // trials games feel arbitrary.
        if (diff >= CRASH_ANGLE) {
            this.crashed = true;
            this.lastLanding = 'crash';
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
