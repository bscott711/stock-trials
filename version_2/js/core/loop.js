// The single requestAnimationFrame in the codebase.
//
// There used to be three (two of them repainting the whole canvas against
// different camera origins, which is what made the background flicker). If you
// are adding another rAF, you almost certainly want a state in states.js
// instead.

/**
 * Fixed-timestep loop with an interpolating render.
 *
 * A fixed step is required rather than merely nice: the suspension model is a
 * stiff spring system that goes unstable under variable dt, and anything that
 * advances per-frame instead of per-second runs at double speed on a 120Hz
 * display.
 */
export function createLoop({ update, render, fixedStep = 1 / 120, maxFrame = 0.25 }) {
    let rafId = null;
    let last = 0;
    let accumulator = 0;
    let running = false;

    function frame(timestamp) {
        if (!running) return;
        rafId = requestAnimationFrame(frame);

        if (!last) last = timestamp;
        // Clamp so a backgrounded tab doesn't return and spiral into hundreds
        // of catch-up substeps.
        const elapsed = Math.min((timestamp - last) / 1000, maxFrame);
        last = timestamp;

        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= fixedStep && steps < 8) {
            update(fixedStep);
            accumulator -= fixedStep;
            steps++;
        }
        if (steps === 8) accumulator = 0;

        render(accumulator / fixedStep, elapsed);
    }

    return {
        start() {
            if (running) return;
            running = true;
            last = 0;
            accumulator = 0;
            rafId = requestAnimationFrame(frame);
        },
        stop() {
            running = false;
            if (rafId !== null) cancelAnimationFrame(rafId);
            rafId = null;
        },
        get running() { return running; },
    };
}
