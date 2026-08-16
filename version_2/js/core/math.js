// Small numeric helpers shared across world, game and render code.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

export const smoothstep = (t) => t * t * (3 - 2 * t);

/** Wrap an angle into (-PI, PI]. */
export function wrapPi(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
}

/**
 * Critically damped spring toward `target`.
 *
 * Framerate-independent, unlike the `x += (target - x) * k` form, which
 * converges at a rate that depends on how often it happens to be called.
 * `velRef` is a mutable carrier ({ v }) owned by the caller.
 */
export function smoothDamp(current, target, velRef, smoothTime, dt, maxSpeed = Infinity) {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / smoothTime;
    const x = omega * dt;
    const expo = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

    let change = current - target;
    const maxChange = maxSpeed * smoothTime;
    change = clamp(change, -maxChange, maxChange);

    const temp = (velRef.v + omega * change) * dt;
    velRef.v = (velRef.v - omega * temp) * expo;

    let output = (current - change) + (change + temp) * expo;

    // Prevent overshooting past the target.
    if ((target - current > 0) === (output > target)) {
        output = target;
        velRef.v = (output - target) / dt;
    }
    return output;
}

export const lerpColor = (c1, c2, t) => ({
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t)),
});

export const rgb = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;
