// ?debug=camera overlay.
//
// The world-Y migration and the camera landed in one change, because a
// half-migrated world is unrenderable. This overlay is how you tell a camera
// bug from a coordinate bug: if the sample dots do not sit exactly on the drawn
// surface, the problem is the sampler, not the transform.

export class DebugOverlay {
    constructor(enabled) {
        this.enabled = enabled;
        this.target = { x: 0, y: 0 };
    }

    setTarget(x, y) {
        this.target.x = x;
        this.target.y = y;
    }

    drawWorld(ctx, camera, terrain, bounds) {
        if (!this.enabled) return;

        // World origin axes
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
        ctx.beginPath();
        ctx.moveTo(0, bounds.top);
        ctx.lineTo(0, bounds.bottom);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(80, 255, 80, 0.5)';
        ctx.beginPath();
        ctx.moveTo(bounds.left, 0);
        ctx.lineTo(bounds.right, 0);
        ctx.stroke();

        // Sample dots - these must land on the rendered surface.
        ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
        for (let x = Math.floor(bounds.left / 50) * 50; x < bounds.right; x += 50) {
            ctx.fillRect(x - 1.5, terrain.sampleY(x) - 1.5, 3, 3);
        }

        // Camera target vs actual centre
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(this.target.x, this.target.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(camera.x - 12, camera.y);
        ctx.lineTo(camera.x + 12, camera.y);
        ctx.moveTo(camera.x, camera.y - 12);
        ctx.lineTo(camera.x, camera.y + 12);
        ctx.stroke();
    }

    drawScreen(ctx, camera, w, h) {
        if (!this.enabled) return;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(8, h - 78, 250, 68);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        ctx.fillText(`cam   ${camera.x.toFixed(1)}, ${camera.y.toFixed(1)}`, 16, h - 72);
        ctx.fillText(`tgt   ${this.target.x.toFixed(1)}, ${this.target.y.toFixed(1)}`, 16, h - 56);
        ctx.fillText(`view  ${camera.viewW}x${camera.viewH} @${camera.dpr}x`, 16, h - 40);
        ctx.fillText(`zoom  ${camera.zoom.toFixed(2)}`, 16, h - 24);

        // Visible-bounds rectangle, inset so its edges are actually on screen.
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.strokeRect(4, 4, w - 8, h - 8);
    }
}
