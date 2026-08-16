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

    emit(x, y, count) {
        for (let i = 0; i < count; i++) {
            const offsetX = Math.random() * 30 - 10;
            const offsetY = Math.random() * 10;
            const size = Math.random() * 2 + 1;
            const opacity = Math.random() * 0.5 + 0.3;
            this.particles.push({ x: x + offsetX, y: y + offsetY, size, opacity });
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

        this.particles = this.particles.filter((p) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(150, 100, 50, ${p.opacity})`;
            ctx.fill();

            p.x -= 1 + Math.random() * 2;
            p.y -= 0.01 + Math.random() * 2;
            p.opacity -= 0.015;
            return p.opacity > 0;
        });
    }
}
