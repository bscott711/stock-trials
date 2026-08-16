import { createLoop } from './core/loop.js';
import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { hashString } from './core/rng.js';
import { Terrain, PIXELS_PER_DAY } from './world/terrain.js';
import { Scenery } from './world/scenery.js';
import { Renderer } from './render/renderer.js';
import { Sky } from './render/sky.js';
import { Parallax } from './render/parallax.js';
import { DebugOverlay } from './render/debug.js';
import { Bike } from './game/bike.js';
import { Audio } from './game/audio.js';
import { drawBike } from './drawbike.js';
import { drawRider } from './drawrider.js';

// Entry point. Constructs, owns the loop, dispatches. If this file starts
// growing game logic, that logic belongs in game/ or render/ instead.

async function main() {
    const params = new URLSearchParams(location.search);
    const canvas = document.getElementById('gameCanvas');

    const seedParam = params.get('seed');
    const seed = seedParam ? hashString(seedParam) : 0xC0FFEE;

    const camera = new Camera();
    const renderer = new Renderer(canvas);
    const sky = new Sky();
    const terrain = new Terrain(seed);
    const scenery = new Scenery(terrain, seed);
    const parallax = new Parallax();
    const input = new Input(canvas);
    const bike = new Bike(terrain);
    const audio = new Audio('./music_assets');
    const debug = new DebugOverlay(params.get('debug') === 'camera');

    const daytime = params.get('daytime');
    if (daytime !== null) sky.setPhase(parseFloat(daytime) || 0);

    renderer.resize(camera, sky);
    camera.snapTo(bike.x, bike.y - camera.viewH * 0.12);
    window.addEventListener('resize', () => renderer.resize(camera, sky));

    // Tilt needs a user gesture to be granted on iOS; the first touch is one.
    canvas.addEventListener('pointerdown', function once(e) {
        if (e.pointerType === 'touch') {
            input.enableTilt();
            canvas.removeEventListener('pointerdown', once);
        }
    });

    try {
        await audio.init();
    } catch (err) {
        console.error('Audio init failed, continuing without music:', err);
    }

    let score = 0;

    // --- controls overlay ------------------------------------------------
    // Shown at startup (paused) so the controls are never a mystery, and
    // reachable again from the "?" button or H.
    const helpOverlay = document.getElementById('helpOverlay');
    const helpBtn = document.getElementById('helpBtn');
    let paused = true;

    function showHelp() {
        paused = true;
        // Otherwise a key held when the panel opens stays "down" the whole
        // time it is up, and fires the moment it closes.
        input.clear();
        helpOverlay.classList.remove('hidden');
    }

    function hideHelp() {
        if (!paused) return;
        paused = false;
        helpOverlay.classList.add('hidden');
        // This runs inside a real user gesture, so it is also the right moment
        // to start audio and ask for tilt permission.
        audio.startIfIdle();
        if (matchMedia('(hover: none)').matches) input.enableTilt();
    }

    helpOverlay.addEventListener('click', hideHelp);
    helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        paused ? hideHelp() : showHelp();
    });
    // Capture phase so the dismissing keypress is swallowed rather than also
    // being read as a game input on the same frame.
    window.addEventListener('keydown', (e) => {
        if (!paused) return;
        if (e.key === 'Tab') return; // keep the panel keyboard-navigable
        e.preventDefault();
        e.stopPropagation();
        hideHelp();
    }, true);

    const loop = createLoop({
        update(dt) {
            if (paused) {
                // Keep clouds drifting behind the panel, but freeze the ride.
                sky.update(dt, terrain.dayAt(bike.x), terrain.dayFraction(bike.x));
                camera.update(dt);
                input.endFrame();
                return;
            }

            if (input.pressed('help')) { showHelp(); input.endFrame(); return; }
            if (input.pressed('restart')) bike.reset();
            if (input.pressed('mute')) audio.toggleMute();

            bike.update(dt, input);
            // One sun-and-moon arc == one trading day, so the celestials and
            // the day counter are the same clock by construction.
            sky.update(dt, terrain.dayAt(bike.x), terrain.dayFraction(bike.x));

            camera.follow(
                { x: bike.x, y: bike.y, vx: bike.vx, airborne: bike.airborne },
                dt,
            );
            camera.update(dt);

            // Distance points are granular; a trading day is now 3000px wide,
            // so scoring per day would leave the number sitting still.
            score = Math.max(0, Math.floor(bike.x / 100)) + bike.flipBonus;
            debug.setTarget(bike.x, bike.y);

            input.endFrame();
        },

        render() {
            renderer.draw({
                camera, sky, terrain, scenery, parallax, debug,

                drawPlayfield(ctx, darkness) {
                    ctx.save();
                    ctx.translate(bike.x, bike.y);
                    ctx.rotate(bike.angle);
                    const rig = drawBike(ctx, bike.distance, darkness);
                    drawRider(ctx, rig);
                    ctx.restore();
                },

                drawHud(ctx, w, h) {
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 4;
                    ctx.fillText(`Score ${score}`, 20, 18);
                    ctx.font = '14px Arial';
                    const pct = Math.round(terrain.dayFraction(bike.x) * 100);
                    ctx.fillText(`Day ${terrain.dayAt(bike.x) + 1} · ${pct}%   ${Math.round(bike.vx)} px/s   Flips ${bike.flips}`, 20, 44);

                    if (bike.crashed) {
                        ctx.textAlign = 'center';
                        ctx.font = 'bold 44px Arial';
                        ctx.fillText('CRASHED', w / 2, h / 2 - 40);
                        ctx.font = '18px Arial';
                        ctx.fillText('press R to retry', w / 2, h / 2 + 12);
                    }
                    ctx.shadowBlur = 0;
                },
            });

            audio.updateProgressUI();
        },
    });

    loop.start();
}

main().catch((err) => {
    console.error('Failed to start:', err);
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas?.getContext('2d');
    if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '16px monospace';
        ctx.fillText('Failed to start: ' + err.message, 24, 48);
    }
});
