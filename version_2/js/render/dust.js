import { WHEEL_R } from '../drawbike.js';

// Wheel dust. Two bugs fixed versus the old inline version in drawbike.js:
// it used to emit unconditionally every render call (including mid-air,
// trailing a flying bike), and its cleanup was `forEach` + `splice(index,1)`,
// which skips the element that shifts into a just-removed slot, so old
// particles never fully cleared and the array grew without bound.

export class DustEmitter {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, color = '150, 100, 50') {
        for (let i = 0; i < count; i++) {
            const offsetX = Math.random() * 30 - 10;
            const offsetY = Math.random() * 10;
            const size = Math.random() * 2 + 1;
            const opacity = Math.random() * 0.5 + 0.3;
            this.particles.push({ x: x + offsetX, y: y + offsetY, size, opacity, color, kind: 'drift' });
        }
    }

    /**
     * Wider, radial spread with real velocity and gravity, unlike emit()'s
     * gentle upward drift - for one-shot impacts (crash, pickup collection)
     * rather than continuous wheel dust.
     */
    burst(x, y, count, color = '150, 100, 50') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1.5;
            const size = Math.random() * 3 + 1.5;
            const opacity = Math.random() * 0.4 + 0.5;
            this.particles.push({
                x: x + (Math.random() * 16 - 8),
                y: y + (Math.random() * 16 - 8),
                size, opacity, color, kind: 'burst',
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
            });
        }
    }

    updateAndDraw(ctx, rig, state) {
        if (!state.airborne) {
            this.emit(rig.back_wheel_x - WHEEL_R / 2, rig.back_wheel_y + WHEEL_R, 10);
            this.emit(rig.front_wheel_x - WHEEL_R / 2, rig.front_wheel_y + WHEEL_R, 10);
        }
        if (state.justLanded) {
            this.emit(rig.back_wheel_x - WHEEL_R / 2, rig.back_wheel_y + WHEEL_R, 24);
        }
        if (state.justCrashed) {
            this.burst(rig.back_wheel_x, rig.back_wheel_y - WHEEL_R, 36, '110, 60, 40');
        }
        if (state.justCollected) {
            this.burst(rig.back_wheel_x, rig.back_wheel_y - WHEEL_R * 2, 16, '244, 197, 66');
        }

        this.particles = this.particles.filter((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
            ctx.fill();

            if (p.kind === 'burst') {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.15;
            } else {
                p.x -= 1 + Math.random() * 2;
                p.y -= 0.01 + Math.random() * 2;
            }
            p.opacity -= 0.015;
            return p.opacity > 0;
        });
    }
}
