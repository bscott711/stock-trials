import { lerpColor, rgb, clamp } from '../core/math.js';
import { getSprite } from './assets.js';
import {
    MOON_PHASE_FRAMES, SUN_FRAMES,
    CLOUD_CUMULUS_FRAMES, CLOUD_CIRRUS_FRAMES, CLOUD_STRATUS_FRAMES,
} from './spriteManifest.js';

const CLOUD_SPRITE_POOLS = {
    cumulus: CLOUD_CUMULUS_FRAMES,
    cirrus: CLOUD_CIRRUS_FRAMES,
    stratus: CLOUD_STRATUS_FRAMES,
};

// Sky, celestials and clouds. Legitimately screen-space: the sun and moon
// should read as infinitely distant, so they do not parallax at all.
//
// Ported from the old environment.js with one behavioural fix: time now
// advances per SECOND (`time += DAY_SPEED * dt`) rather than per frame. The
// old `time += 0.01` ran the day/night cycle at double speed on a 120Hz
// display, and at half speed if the frame rate dropped.

const CYCLE_DURATION = 120;

// The sky is driven by DISTANCE, not by wall clock: one sun-and-moon arc is
// exactly one trading day, so the day counter in the HUD and the celestials can
// never disagree. Previously they were two unrelated clocks - the counter came
// from worldX while the sun ran on its own timer - which read as a bug.
//
// (The original code half-intended this: game.js set `vibes.time = bike.x /
// PIXELS_PER_DAY`, but nothing ever read that value.)
//
// Offset so worldX = 0 starts mid-morning rather than at midnight, and so the
// day rolls over in the morning like a real trading session.
const PHASE_OFFSET = 0.1;

const PREDAWN = { r: 40, g: 40, b: 80 };
const SUNRISE = { r: 255, g: 180, b: 50 };
const DAY = { r: 135, g: 206, b: 235 };
const SUNSET = { r: 255, g: 100, b: 80 };
const NIGHT = { r: 20, g: 20, b: 60 };
const DARK_HORIZON = { r: 10, g: 10, b: 30 };

export class Sky {
    constructor(rngSeedless = Math.random) {
        this._phase = PHASE_OFFSET;
        this._phaseOverride = undefined;
        this.dayIndex = 0;
        this.cloudFreeDay = rngSeedless() > 0.5;
        this.sunVariant = Math.floor(rngSeedless() * SUN_FRAMES.length);
        this.moonPhaseOffset = Math.floor(rngSeedless() * 28);
        this.stars = [];
        this.clouds = [];
        this._w = 0;
        this._h = 0;
    }

    resize(w, h) {
        if (w === this._w && h === this._h) return;
        this._w = w;
        this._h = h;
        this._initStars();
        this._initClouds();
    }

    _initStars() {
        this.stars = [];
        for (let i = 0; i < 110; i++) {
            this.stars.push({
                x: Math.random() * this._w,
                y: Math.random() * this._h * 0.75,
                radius: Math.random() * 1.5 + 0.5,
                twinkle: Math.random() > 0.8,
                opacity: Math.random() * 0.3 + 0.4,
            });
        }
    }

    _initClouds() {
        this.clouds = [];
        const types = ['cumulus', 'cirrus', 'stratus'];
        for (let i = 0; i < 10; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            // One cloud in five is a big one, so the sky isn't uniformly
            // small puffs - a few outsized formations read as more natural.
            const bigCloud = Math.random() < 0.2 ? (Math.random() * 1.2 + 1.6) : 1;
            const c = {
                x: Math.random() * this._w,
                y: Math.random() * (this._h / 3) + this._h / 4,
                maxSize: (Math.random() * 50 + 20) * bigCloud,
                speed: (Math.random() * 0.5 + 0.2) * 18, // px/s
                opacity: Math.random() * 0.3 + 0.4,
                // Sprite art has its own outlines/shading baked in, unlike
                // the flat procedural shapes opacity was originally tuned
                // for - at that low alpha a cloud drawn over the sun or
                // moon reads as a wash the celestial shines through rather
                // than something actually in front of it, so sprites get
                // their own near-opaque alpha.
                spriteOpacity: Math.random() * 0.15 + 0.85,
                type,
                noise: Math.random() * 0.2,
                // Style variant this instance may draw instead of the
                // procedural shape, chosen once so it's stable for the
                // cloud's lifetime (same per-instance-random pattern as
                // Tree/Rock in world/scenery.js).
                spriteId: CLOUD_SPRITE_POOLS[type][Math.floor(Math.random() * CLOUD_SPRITE_POOLS[type].length)],
            };
            if (type === 'cumulus') {
                c.y += this._h / 16;
                c.puffs = [
                    { ox: -c.maxSize * 0.2, oy: -c.maxSize * 0.15, rx: c.maxSize * 0.8, ry: c.maxSize * 0.5, rot: Math.random() * 0.2 - 0.1 },
                    { ox: c.maxSize * 0.1, oy: -c.maxSize * 0.1, rx: c.maxSize * 0.7, ry: c.maxSize * 0.4, rot: Math.random() * 0.2 - 0.1 },
                    { ox: c.maxSize * 0.3, oy: c.maxSize * 0.1, rx: c.maxSize * 0.6, ry: c.maxSize * 0.35, rot: Math.random() * 0.2 - 0.1 },
                ];
                c.opacity *= 0.9;
                c.shadow = { ox: c.maxSize * 0.15, oy: c.maxSize * 0.15 };
            } else if (type === 'cirrus') {
                c.y -= this._h / 8;
                c.wisps = [
                    { oy: 0, curve: 0.2, width: 1 },
                    { oy: c.maxSize * 0.4, curve: -0.15, width: 0.8 },
                    { oy: -c.maxSize * 0.3, curve: 0.1, width: 0.7 },
                ];
                c.opacity *= 0.8;
            } else {
                c.y += this._h / 12;
                c.layers = [
                    { oy: 0, width: 1, opacity: 1 },
                    { oy: c.maxSize * 0.3, width: 0.85, opacity: 0.8 },
                    { oy: c.maxSize * 0.6, width: 0.7, opacity: 0.6 },
                ];
            }
            this.clouds.push(c);
        }
    }

    /**
     * @param dt        seconds, for cloud drift only
     * @param day       integer trading-day index
     * @param fraction  0..1 progress through that day
     */
    update(dt, day, fraction) {
        if (this._phaseOverride === undefined) {
            if (day !== this.dayIndex) {
                this.dayIndex = day;
                this.cloudFreeDay = Math.random() > 0.5;
                this.sunVariant = Math.floor(Math.random() * SUN_FRAMES.length);
            }
            this._phase = (fraction + PHASE_OFFSET) % 1;
        }

        // Clouds still drift in real time - they are weather, not a clock.
        for (const c of this.clouds) {
            c.x -= c.speed * dt;
            if (c.x + c.maxSize * 2 < 0) c.x = this._w + c.maxSize * 2;
        }
    }

    get t() {
        return this._phaseOverride !== undefined ? this._phaseOverride : this._phase;
    }

    /** Pin the cycle to a fixed point (0..1). Used by ?daytime= for testing. */
    setPhase(t) {
        this._phaseOverride = ((t % 1) + 1) % 1;
    }

    /** 0 = full daylight, 1 = fully dark. Drives the night pass and headlight. */
    getDarkness() {
        const t = this.t;
        if (t >= 0.65 && t < 0.7) return (t - 0.65) / 0.05;
        if (t >= 0.7 && t < 0.95) return 1;
        if (t >= 0.95) return 1 - (t - 0.95) / 0.05;
        return 0;
    }

    /** Horizon colour, so distant parallax layers can tint toward it. */
    horizonColor() {
        const t = this.t;
        let sky;
        if (t >= 0.9 && t < 0.95) sky = lerpColor(NIGHT, PREDAWN, (t - 0.9) * 20);
        else if (t >= 0.95 || t < 0.05) sky = lerpColor(PREDAWN, SUNRISE, t >= 0.95 ? (t - 0.95) * 10 : (t + 0.05) * 10);
        else if (t < 0.4) sky = lerpColor(SUNRISE, DAY, (t - 0.05) / 0.35);
        else if (t < 0.7) sky = lerpColor(DAY, SUNSET, (t - 0.4) / 0.3);
        else sky = lerpColor(SUNSET, NIGHT, (t - 0.7) / 0.2);
        return sky;
    }

    draw(ctx, w, h) {
        this._drawSkyGradient(ctx, w, h);
        this._drawStars(ctx);
        this._drawSun(ctx, w, h);
        this._drawMoon(ctx, w, h);
        this._drawClouds(ctx);
    }

    _drawSkyGradient(ctx, w, h) {
        const t = this.t;
        const skyColor = this.horizonColor();

        const lighten = { r: -40, g: -20, b: -20 };
        const lit = {
            r: Math.max(skyColor.r + lighten.r, 0),
            g: Math.max(skyColor.g + lighten.g, 0),
            b: Math.max(skyColor.b + lighten.b, 0),
        };
        let horizon;
        if (t < 0.3) horizon = DARK_HORIZON;
        else if (t < 0.5) horizon = lerpColor(DARK_HORIZON, lit, (t - 0.3) * 5);
        else if (t < 0.7) horizon = lit;
        else if (t < 0.9) horizon = lerpColor(lit, DARK_HORIZON, (t - 0.7) * 5);
        else horizon = DARK_HORIZON;

        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, rgb(skyColor));
        g.addColorStop(1, rgb(horizon));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    _drawStars(ctx) {
        const t = this.t;
        let vis = 0;
        if (t >= 0.7 && t < 0.75) vis = (t - 0.7) / 0.05;
        else if (t >= 0.75 && t < 0.95) vis = 1;
        else if (t >= 0.95) vis = Math.max(0, 1 - (t - 0.95) / 0.05);
        if (vis <= 0) return;

        for (const s of this.stars) {
            if (s.twinkle && Math.random() > 0.97) s.radius = Math.random() * 1.5 + 0.5;
            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 255, 255, ${vis * s.opacity})`;
            ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _arc(progress, w, h, peak) {
        const x = w * progress;
        const hh = w / 2;
        const k = peak * h;
        const a = (h - k) / (hh * hh);
        return { x, y: a * (x - hh) * (x - hh) + k };
    }

    _drawSun(ctx, w, h) {
        const t = this.t;
        if (!(t >= 0.95 || t < 0.75)) return;
        const progress = t >= 0.95 ? ((t - 0.95) / 0.05) * 0.25 : t + 0.25;
        const { x, y } = this._arc(progress, w, h, 0.1);

        // this.sunVariant is rolled once per day (see update()), not by
        // time of day - the art's own color IS the day's look, so this
        // replaces the time-of-day tint below rather than picking a frame
        // per t bucket the way the moon picks by phase.
        const sprite = getSprite(SUN_FRAMES[this.sunVariant]);
        if (sprite) {
            // Sprite art already bakes in its own glow rings (unlike the
            // moon's plain disc), so it's drawn bigger than the procedural
            // circle's 30px radius to keep those rings visible, with no
            // extra ctx.shadowBlur layered on top.
            const size = 100;
            const scale = size / sprite.width;
            const w2 = sprite.width * scale, h2 = sprite.height * scale;
            ctx.drawImage(sprite, x - w2 / 2, y - h2 / 2, w2, h2);
            return;
        }

        let r = 255, g = 255, b = 0;
        if (t >= 0.95 || t < 0.05) {
            const d = t >= 0.95 ? (t - 0.95) / 0.1 : (t + 0.05) / 0.1;
            g = 160 + (255 - 160) * d;
            b = 60 + (0 - 60) * d;
        } else if (t >= 0.65 && t < 0.75) {
            const d = (t - 0.65) / 0.1;
            g = 255 - (255 - 160) * d;
            b = 0 + 60 * d;
        }

        ctx.save();
        ctx.shadowBlur = 24;
        ctx.shadowColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b / 2)}, 0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        ctx.fill();
        ctx.restore();
    }

    _drawMoon(ctx, w, h) {
        const t = this.t;
        if (!(t >= 0.7 && t < 0.95)) return;
        const { x, y } = this._arc((t - 0.7) / 0.25, w, h, 0.4);
        const radius = 25;

        // Real lunar month, advancing one trading day at a time.
        const phase = (((this.dayIndex + this.moonPhaseOffset) % 28) + 28) % 28 / 28;

        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';

        // MOON_PHASE_FRAMES[0..7] are new, waxing crescent, first quarter,
        // waxing gibbous, full, waning gibbous, last quarter, waning
        // crescent in order (tools/build_moon_sprites.py) - phase 0..1 maps
        // onto those 8 evenly-spaced points the same way phase 0.25/0.5/0.75
        // already line up with first-quarter/full/last-quarter below, so a
        // sprite is just picked by nearest bucket instead of drawn.
        const frameCount = MOON_PHASE_FRAMES.length;
        const sprite = getSprite(MOON_PHASE_FRAMES[Math.round(phase * frameCount) % frameCount]);

        if (sprite) {
            const size = radius * 2;
            ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
            ctx.restore();
            return;
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgb(245, 245, 235)';
        ctx.fill();
        ctx.restore();

        if (phase !== 0.5) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.clip();
            const offset = phase < 0.5
                ? -radius - 2 * (phase - 0.5) * radius
                : radius - 2 * (phase - 0.5) * radius;
            ctx.beginPath();
            ctx.arc(x + offset, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(30, 30, 45, 0.85)';
            ctx.fill();
            ctx.restore();
        }
    }

    _drawClouds(ctx) {
        if (this.cloudFreeDay) return;
        const t = this.t;
        const vis = 1 - Math.min(1, Math.abs(t - 0.6) / 0.3);
        if (vis <= 0) return;

        for (const c of this.clouds) {
            const o = clamp(vis * c.opacity, 0, 1);

            const sprite = getSprite(c.spriteId);
            if (sprite) {
                // Target width matches each type's existing procedural
                // footprint (cumulus/cirrus/stratus below use the same
                // maxSize multipliers) so swapping in art doesn't change
                // how much sky a cloud instance visually occupies; height
                // follows the sprite's own aspect ratio rather than being
                // forced, since silhouette shape varies a lot per variant.
                const targetW = c.maxSize * (c.type === 'cumulus' ? 1.6 : c.type === 'cirrus' ? 2 : 2.5);
                const scale = targetW / sprite.width;
                const w = sprite.width * scale, h = sprite.height * scale;
                ctx.save();
                ctx.globalAlpha = clamp(vis * c.spriteOpacity, 0, 1);
                ctx.drawImage(sprite, c.x - w / 2, c.y - h / 2, w, h);
                ctx.restore();
                continue;
            }

            if (c.type === 'cumulus') {
                ctx.beginPath();
                ctx.ellipse(c.x + c.shadow.ox, c.y + c.shadow.oy, c.maxSize * 0.5, c.maxSize * 0.3, 0, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(220, 220, 240, ${o * 0.7})`;
                ctx.fill();
                ctx.fillStyle = `rgba(255, 255, 255, ${o})`;
                for (const p of c.puffs) {
                    ctx.beginPath();
                    ctx.ellipse(c.x + p.ox, c.y + p.oy, p.rx, p.ry, p.rot, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (c.type === 'cirrus') {
                const width = c.maxSize * 2;
                const height = c.maxSize * 0.4;
                ctx.strokeStyle = `rgba(255, 255, 255, ${o * 0.7})`;
                for (const wsp of c.wisps) {
                    ctx.beginPath();
                    for (let i = 0; i <= 20; i++) {
                        const tt = i / 20;
                        const x = c.x - width / 2 + width * tt;
                        const y = c.y + wsp.oy + Math.sin(tt * Math.PI) * height * wsp.curve + c.noise * height * 0.3;
                        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.lineWidth = height * 0.2 * wsp.width;
                    ctx.stroke();
                }
            } else {
                const width = c.maxSize * 2.5;
                const height = c.maxSize * 0.6;
                for (const l of c.layers) {
                    const lw = width * l.width;
                    const lo = o * l.opacity;
                    const g = ctx.createLinearGradient(c.x - lw / 2, 0, c.x + lw / 2, 0);
                    g.addColorStop(0, `rgba(255, 255, 255, ${lo * 0.4})`);
                    g.addColorStop(0.5, `rgba(255, 255, 255, ${lo})`);
                    g.addColorStop(1, `rgba(255, 255, 255, ${lo * 0.4})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(c.x - lw / 2, c.y + l.oy - height * 0.25, lw, height * 0.5);
                }
            }
        }
    }
}
