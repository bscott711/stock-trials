import { createLoop } from './core/loop.js';
import { Camera } from './core/camera.js';
import { Input } from './core/input.js';
import { hashString } from './core/rng.js';
import { Terrain, PIXELS_PER_DAY } from './world/terrain.js';
import { Scenery } from './world/scenery.js';
import { PickupField } from './world/pickups.js';
import { HazardField } from './world/hazards.js';
import { Renderer } from './render/renderer.js';
import { Sky } from './render/sky.js';
import { Parallax } from './render/parallax.js';
import { DebugOverlay } from './render/debug.js';
import { Bike, MAX_SPEED } from './game/bike.js';
import { Portfolio } from './game/portfolio.js';
import { Audio } from './game/audio.js';
import { SFX } from './game/sfx.js';
import { loadAssets } from './render/assets.js';
import { SPRITE_MANIFEST } from './render/spriteManifest.js';
import { drawPlayer } from './render/playerSprite.js';

// Entry point. Constructs, owns the loop, dispatches. If this file starts
// growing game logic, that logic belongs in game/ or render/ instead.

// Just over WHEEL_R (30, game/bike.js) - the main hazard-feel tuning knob,
// paired with the anchor-height constants in world/hazards.js.
const HAZARD_HIT_RADIUS = 34;

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
    const pickups = new PickupField(terrain, seed);
    const hazards = new HazardField(terrain, seed);
    const portfolio = new Portfolio();
    const parallax = new Parallax();
    const input = new Input(canvas);
    const bike = new Bike(terrain);
    const audio = new Audio('./music_assets');
    const sfx = new SFX('./sfx_assets');
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

    // Not awaited: every sprite consumer falls back to its procedural draw
    // via getSprite() returning null, so the game is correct on frame 1
    // even before any art has loaded (or if a sprite was never generated).
    loadAssets(SPRITE_MANIFEST);

    let score = 0;
    let wasAirborne = false;
    let justLanded = false; // one-shot edge for the landing dust burst; cleared after render() reads it
    let wasCrashed = false;
    let justCrashed = false; // one-shot edge for the crash dust burst; cleared after render() reads it
    let justCollected = false; // one-shot edge for the pickup sparkle; cleared after render() reads it
    let prevFlipBonus = 0;

    // Floating HUD text ("+$10", "PERFECT", "+100 FLIP"), anchored to a world
    // position and converted to screen space at draw time via
    // camera.worldToScreen - aged out in update() since that's the fixed-step
    // callback with a real dt.
    const popups = [];
    const POPUP_LIFE = 1.0;
    function pushPopup(worldX, worldY, text) {
        popups.push({ x: worldX, y: worldY, text, life: POPUP_LIFE });
    }

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
            if (input.pressed('restart')) { bike.reset(); prevFlipBonus = 0; }
            if (input.pressed('mute')) { audio.toggleMute(); sfx.setMuted(audio.muted); }

            bike.update(dt, input);

            if (!bike.crashed && hazards.hits(bike.x, bike.y, HAZARD_HIT_RADIUS)) {
                bike.crashOn();
            }

            if (wasAirborne && !bike.airborne) {
                justLanded = true;
                if (bike.lastLanding === 'perfect') {
                    pushPopup(bike.x, bike.y - 60, 'PERFECT');
                    sfx.play('landPerfect');
                } else if (bike.lastLanding === 'sloppy') {
                    camera.addTrauma(0.15);
                    sfx.play('landSloppy');
                }
            }
            if (bike.flipBonus > prevFlipBonus) {
                pushPopup(bike.x, bike.y - 90, `+${bike.flipBonus - prevFlipBonus} FLIP`);
                prevFlipBonus = bike.flipBonus;
            }
            wasAirborne = bike.airborne;

            if (!wasCrashed && bike.crashed) {
                justCrashed = true;
                camera.addTrauma(0.8);
                sfx.play('crash');
            }
            wasCrashed = bike.crashed;

            // Cash/dividend pickups: collected on contact, valued higher the
            // choppier the terrain was and the faster the bike was going -
            // "buy the dip, ride it fast" made literal.
            for (const p of pickups.collectAt(bike.x, bike.y, 60)) {
                const gained = portfolio.collect(p.value, terrain.localVolatility(p.x), bike.vx / MAX_SPEED);
                pushPopup(p.x, p.y - 20, `+$${Math.round(gained)}`);
                justCollected = true;
                sfx.play('pickup');
            }

            // One sun-and-moon arc == one trading day, so the celestials and
            // the day counter are the same clock by construction.
            sky.update(dt, terrain.dayAt(bike.x), terrain.dayFraction(bike.x));

            camera.follow(
                { x: bike.x, y: bike.y, vx: bike.vx, airborne: bike.airborne },
                dt,
            );
            camera.update(dt);

            for (let i = popups.length - 1; i >= 0; i--) {
                popups[i].life -= dt / POPUP_LIFE;
                if (popups[i].life <= 0) popups.splice(i, 1);
            }

            // Distance points are granular; a trading day is now 3000px wide,
            // so scoring per day would leave the number sitting still.
            score = Math.max(0, Math.floor(bike.x / 100)) + bike.flipBonus + Math.floor(portfolio.cash);
            debug.setTarget(bike.x, bike.y);

            input.endFrame();
        },

        render() {
            renderer.draw({
                camera, sky, terrain, scenery, pickups, hazards, parallax, debug, seed,

                drawPlayfield(ctx, darkness) {
                    ctx.save();
                    ctx.translate(bike.x, bike.y);
                    ctx.rotate(bike.angle);
                    drawPlayer(ctx, {
                        distance: bike.distance, darkness, airborne: bike.airborne,
                        justLanded, justCrashed, justCollected,
                    });
                    ctx.restore();
                    justLanded = false;
                    justCrashed = false;
                    justCollected = false;
                },

                drawHud(ctx, w, h) {
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 20px Arial';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 4;
                    ctx.fillText(`Portfolio $${score}`, 20, 18);
                    ctx.font = '14px Arial';
                    const pct = Math.round(terrain.dayFraction(bike.x) * 100);
                    ctx.fillText(`Day ${terrain.dayAt(bike.x) + 1} · ${pct}%   ${Math.round(bike.vx)} px/s   Flips ${bike.flips}`, 20, 44);

                    for (const p of popups) {
                        const s = camera.worldToScreen(p.x, p.y - (1 - p.life) * 40);
                        ctx.globalAlpha = Math.max(0, p.life);
                        ctx.textAlign = 'center';
                        ctx.font = 'bold 16px Arial';
                        ctx.fillStyle = p.text.startsWith('+$') ? '#f4c542' : '#ffffff';
                        ctx.fillText(p.text, s.x, s.y);
                    }
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = 'white';

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
