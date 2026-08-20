import { lerpColor, rgb, clamp } from '../core/math.js';
import { getSprite } from './assets.js';
import {
    MOON_PHASE_FRAMES, SUN_FRAMES, BIRD_FRAMES,
    CLOUD_CUMULUS_FRAMES, CLOUD_CIRRUS_FRAMES, CLOUD_STRATUS_FRAMES,
} from './spriteManifest.js';

const CLOUD_SPRITE_POOLS = {
    cumulus: CLOUD_CUMULUS_FRAMES,
    cirrus: CLOUD_CIRRUS_FRAMES,
    stratus: CLOUD_STRATUS_FRAMES,
};

// Sky, celestials and clouds. Legitimately screen-space: the sun and moon
// should read as infinitely distant, so they do not parallax at all.

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

// Phase boundaries shared by every dusk/night/dawn-dependent draw below
// (darkness, horizon color, stars, sky gradient, sun/moon visibility+arc) -
// reading them all from one set of constants instead of each function
// hardcoding its own magic numbers is what keeps them in sync when the
// window changes, rather than drifting apart the next time night length
// gets retuned.
const DUSK_START = 0.55;      // darkness begins ramping up, moon starts rising
const NIGHT_START = 0.62;     // full dark reached, stars start fading in
const NIGHT_END = 0.93;       // dawn ramp begins, moon sets, sun returns
const DAWN_END = 1.0;         // dawn ramp ends
const DUSK_SUN_LINGER = 0.05; // sun stays visible this long past NIGHT_START
const STAR_FADE_IN = 0.05;
const HORIZON_LAG = 0.15;     // horizon glow lags the overhead sky/darkness
const MOON_ARC_PEAK = 0.15;   // moon's arc apex height fraction (sun's is 0.1)

// horizonColor()'s five-stop wheel keeps the same proportions the original
// hardcoded breakpoints had relative to the old NIGHT_START(0.70)/
// NIGHT_END(0.95) anchors, scaled to fit the new NIGHT_START..NIGHT_END gap -
// widening night changes the wheel's span, not its shape.
const NIGHT_GAP = NIGHT_END - NIGHT_START;
const DAY_GAP = 1 - NIGHT_GAP;
const SUNSET_TO_NIGHT_RAMP = NIGHT_GAP * 0.8;
const NIGHT_TO_PREDAWN_RAMP = NIGHT_GAP * 0.2;
const PREDAWN_TO_SUNRISE_RAMP = DAY_GAP * (0.10 / 0.75);
const SUNRISE_TO_DAY_RAMP = DAY_GAP * (0.35 / 0.75);
const DAY_TO_SUNSET_RAMP = DAY_GAP * (0.30 / 0.75);

const PREDAWN = { r: 40, g: 40, b: 80 };
const SUNRISE = { r: 255, g: 180, b: 50 };
const DAY = { r: 135, g: 206, b: 235 };
const SUNSET = { r: 255, g: 100, b: 80 };
const NIGHT = { r: 20, g: 20, b: 60 };
const DARK_HORIZON = { r: 10, g: 10, b: 30 };

// Curated subset of SUN_FRAMES's 12 variants that actually reads as a warm
// dawn->noon->dusk sweep, picked by eye off assets/sprites/sky/sun/
// spritesheet.png: 4 and 7 are dark red/maroon "horizon" tones, 2 is
// red-orange, 8 mid orange, 0 the palest/brightest gold (used as midday).
// Indices 3, 5, 6, 9, 10, 11 (two pale "eclipse" ghost-whites, four
// purple/mauve/grey "stormy" tones) are deliberately left out of this sweep
// and stay unused here - candidates for a future special-sky (eclipse/storm)
// feature, not wired to anything yet.
const SUN_TIME_OF_DAY_FRAMES = [4, 2, 0, 8, 7].map(i => SUN_FRAMES[i]);

/** Nearest pair of entries in `list` to `progress` (0..1), plus the blend fraction between them. */
function frameBlend(list, progress) {
    const n = list.length;
    const fp = clamp(progress, 0, 1) * (n - 1);
    const idx0 = Math.min(n - 2, Math.floor(fp));
    return { a: list[idx0], b: list[idx0 + 1], frac: fp - idx0 };
}

const BIRD_COUNT = 8;
const BIRD_FLAP_SPEED = 6; // radians/sec, procedural wing-flap fallback only

export class Sky {
    constructor(rngSeedless = Math.random) {
        this._phase = PHASE_OFFSET;
        this._phaseOverride = undefined;
        this.dayIndex = 0;
        this.cloudFreeDay = rngSeedless() > 0.5;
        this.moonPhaseOffset = Math.floor(rngSeedless() * 28);
        this.stars = [];
        this.clouds = [];
        this.birds = [];
        this._w = 0;
        this._h = 0;
    }

    resize(w, h) {
        if (w === this._w && h === this._h) return;
        this._w = w;
        this._h = h;
        this._initStars();
        this._initClouds();
        this._initBirds();
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

    _initBirds() {
        this.birds = [];
        for (let i = 0; i < BIRD_COUNT; i++) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            this.birds.push({
                x: Math.random() * this._w,
                y: this._h * 0.08 + Math.random() * this._h * 0.27,
                speed: Math.random() * 50 + 40, // px/s
                dir,
                // Style variant this instance may draw instead of the
                // procedural chevron, chosen once - same per-instance-random
                // pattern as clouds above.
                spriteId: BIRD_FRAMES[Math.floor(Math.random() * BIRD_FRAMES.length)],
                flapPhase: Math.random() * Math.PI * 2,
            });
        }
    }

    /**
     * @param dt        seconds, for cloud/bird drift only
     * @param day       integer trading-day index
     * @param fraction  0..1 progress through that day
     */
    update(dt, day, fraction) {
        if (this._phaseOverride === undefined) {
            if (day !== this.dayIndex) {
                this.dayIndex = day;
                this.cloudFreeDay = Math.random() > 0.5;
            }
            this._phase = (fraction + PHASE_OFFSET) % 1;
        }

        // Clouds and birds still drift/flap in real time - they're weather
        // and wildlife, not a clock.
        for (const c of this.clouds) {
            c.x -= c.speed * dt;
            if (c.x + c.maxSize * 2 < 0) c.x = this._w + c.maxSize * 2;
        }
        for (const b of this.birds) {
            b.x -= b.speed * b.dir * dt;
            if (b.dir > 0 && b.x < -40) b.x = this._w + 40;
            else if (b.dir < 0 && b.x > this._w + 40) b.x = -40;
            b.flapPhase += dt * BIRD_FLAP_SPEED;
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
    getDarkness(t = this.t) {
        if (t >= DUSK_START && t < NIGHT_START) return (t - DUSK_START) / (NIGHT_START - DUSK_START);
        if (t >= NIGHT_START && t < NIGHT_END) return 1;
        if (t >= NIGHT_END && t < DAWN_END) return 1 - (t - NIGHT_END) / (DAWN_END - NIGHT_END);
        return 0;
    }

    /** Horizon colour, so distant parallax layers can tint toward it. */
    horizonColor() {
        const t = this.t;
        const nightColorAt = NIGHT_START + SUNSET_TO_NIGHT_RAMP; // == NIGHT_END - NIGHT_TO_PREDAWN_RAMP
        const sunriseColorAt = (NIGHT_END + PREDAWN_TO_SUNRISE_RAMP) % 1;
        const dayColorAt = sunriseColorAt + SUNRISE_TO_DAY_RAMP;
        let sky;
        if (t >= nightColorAt && t < NIGHT_END) {
            sky = lerpColor(NIGHT, PREDAWN, (t - nightColorAt) / NIGHT_TO_PREDAWN_RAMP);
        } else if (t >= NIGHT_END || t < sunriseColorAt) {
            const d = t >= NIGHT_END ? (t - NIGHT_END) : (t + (1 - NIGHT_END));
            sky = lerpColor(PREDAWN, SUNRISE, d / PREDAWN_TO_SUNRISE_RAMP);
        } else if (t < dayColorAt) {
            sky = lerpColor(SUNRISE, DAY, (t - sunriseColorAt) / SUNRISE_TO_DAY_RAMP);
        } else if (t < NIGHT_START) {
            sky = lerpColor(DAY, SUNSET, (t - dayColorAt) / DAY_TO_SUNSET_RAMP);
        } else {
            sky = lerpColor(SUNSET, NIGHT, (t - NIGHT_START) / SUNSET_TO_NIGHT_RAMP);
        }
        return sky;
    }

    draw(ctx, w, h) {
        this._drawSkyGradient(ctx, w, h);
        this._drawStars(ctx);
        this._drawSun(ctx, w, h);
        this._drawMoon(ctx, w, h);
        this._drawClouds(ctx);
        this._drawBirds(ctx);
    }

    _drawSkyGradient(ctx, w, h) {
        const skyColor = this.horizonColor();

        const lighten = { r: -40, g: -20, b: -20 };
        const lit = {
            r: Math.max(skyColor.r + lighten.r, 0),
            g: Math.max(skyColor.g + lighten.g, 0),
            b: Math.max(skyColor.b + lighten.b, 0),
        };
        // Horizon lag: the glow right at the horizon lingers behind the
        // overhead sky's own darkness, matching the old hand-tuned gradient's
        // "dusk settles up top before it reaches the horizon" look, but now
        // permanently in sync with getDarkness() instead of five more
        // independently hand-tuned breakpoints that could drift apart.
        const horizonT = ((this.t - HORIZON_LAG) % 1 + 1) % 1;
        const horizon = lerpColor(lit, DARK_HORIZON, this.getDarkness(horizonT));

        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, rgb(skyColor));
        g.addColorStop(1, rgb(horizon));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }

    _drawStars(ctx) {
        const t = this.t;
        let vis = 0;
        if (t >= NIGHT_START && t < NIGHT_START + STAR_FADE_IN) vis = (t - NIGHT_START) / STAR_FADE_IN;
        else if (t >= NIGHT_START + STAR_FADE_IN && t < NIGHT_END) vis = 1;
        else if (t >= NIGHT_END) vis = Math.max(0, 1 - (t - NIGHT_END) / (DAWN_END - NIGHT_END));
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
        const duskEnd = NIGHT_START + DUSK_SUN_LINGER;
        if (!(t < duskEnd || t >= NIGHT_END)) return;
        const sunVisibleWidth = (1 - NIGHT_END) + duskEnd;
        const progress = (((t - NIGHT_END) % 1 + 1) % 1) / sunVisibleWidth;
        const { x, y } = this._arc(progress, w, h, 0.1);

        // Sun sprites are picked by time-of-day (this same `progress`, the
        // single source of truth for "how far through the visible arc"),
        // crossfaded between the two nearest curated frames - see
        // SUN_TIME_OF_DAY_FRAMES above for which of the 12 sky.sun variants
        // made the cut and why.
        const { a, b, frac } = frameBlend(SUN_TIME_OF_DAY_FRAMES, progress);
        const s0 = getSprite(a);
        const s1 = getSprite(b);
        if (s0 || s1) {
            // Sprite art already bakes in its own glow rings (unlike the
            // moon's plain disc), so it's drawn bigger than the procedural
            // circle's 30px radius to keep those rings visible, with no
            // extra ctx.shadowBlur layered on top.
            const size = 100;
            const drawOne = (sprite, alpha) => {
                if (!sprite || alpha <= 0) return;
                const scale = size / sprite.width;
                const w2 = sprite.width * scale, h2 = sprite.height * scale;
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, x - w2 / 2, y - h2 / 2, w2, h2);
            };
            // True crossfade (source-over + alpha, not 'lighter') so the
            // overlap never exceeds either frame's own brightness. If only
            // one of the pair has loaded, draw it at full alpha rather than
            // fading toward nothing - a partially-populated sprite pool is
            // a normal state (see PROMPTS.md), not an edge case.
            if (s0 && s1) { drawOne(s0, 1 - frac); drawOne(s1, frac); }
            else drawOne(s0 || s1, 1);
            ctx.globalAlpha = 1;
            return;
        }

        let r = 255, g = 255, b2 = 0;
        const sunriseEnd = (NIGHT_END + 0.1) % 1;
        if (t >= NIGHT_END || t < sunriseEnd) {
            const d = t >= NIGHT_END ? (t - NIGHT_END) / 0.1 : (t + (1 - NIGHT_END)) / 0.1;
            g = 160 + (255 - 160) * d;
            b2 = 60 + (0 - 60) * d;
        } else if (t >= DUSK_START && t < DUSK_START + 0.1) {
            const d = (t - DUSK_START) / 0.1;
            g = 255 - (255 - 160) * d;
            b2 = 0 + 60 * d;
        }

        ctx.save();
        ctx.shadowBlur = 24;
        ctx.shadowColor = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b2 / 2)}, 0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b2)})`;
        ctx.fill();
        ctx.restore();
    }

    _drawMoon(ctx, w, h) {
        const t = this.t;
        if (!(t >= DUSK_START && t < NIGHT_END)) return;
        const { x, y } = this._arc((t - DUSK_START) / (NIGHT_END - DUSK_START), w, h, MOON_ARC_PEAK);
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

    _drawBirds(ctx) {
        // Fade out with the same darkness ramp everything else uses, rather
        // than a new independent threshold - birds have gone to roost by the
        // time it's fully dark.
        const vis = 1 - this.getDarkness();
        if (vis <= 0) return;

        for (const b of this.birds) {
            const sprite = getSprite(b.spriteId);
            if (sprite) {
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.scale(b.dir, 1); // faces its direction of travel
                ctx.globalAlpha = vis;
                const size = 32;
                const scale = size / sprite.width;
                const w = sprite.width * scale, h = sprite.height * scale;
                ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
                ctx.restore();
                continue;
            }

            // Simple animated chevron/"M" wing shape, flapping via flapPhase.
            const flap = Math.sin(b.flapPhase) * 6 + 8;
            ctx.strokeStyle = `rgba(60, 60, 70, ${vis * 0.8})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(b.x - 8, b.y - flap);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(b.x + 8, b.y - flap);
            ctx.stroke();
        }
    }
}
