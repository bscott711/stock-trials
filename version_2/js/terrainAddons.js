// terrainAddons.js
export class Rock {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size * (Math.random() * 0.5 + 0.75);
        this.baseColor = this.generateBaseColor();
        this.mossColor = this.generateMossColor();
        this.shapePoints = this.generateShapePoints();
        this.gradient = this.generateGradient();
        this.mossPatches = this.generateMossPatches();
    }

    generateBaseColor() {
        const hue = Math.floor(Math.random() * 10 + 175);
        const saturation = Math.floor(Math.random() * 10 + 10);
        const lightness = Math.floor(Math.random() * 20 + 70);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    generateMossColor() {
        const hue = Math.floor(Math.random() * 40 + 80);
        const saturation = Math.floor(Math.random() * 30 + 50);
        const lightness = Math.floor(Math.random() * 20 + 40);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    generateShapePoints() {
        const numPoints = Math.floor(Math.random() * 4) + 6;
        const points = [];
        const angleStep = (Math.PI * 2) / numPoints;

        for (let i = 0; i < numPoints; i++) {
            const angle = angleStep * i;
            const radius = this.size * (Math.random() * 0.3 + 0.85);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            points.push({ x, y });
        }

        return points;
    }

    generateGradient() {
        const lightColor = this.shadeColor(this.baseColor, 20);
        const darkColor = this.shadeColor(this.baseColor, -5);
        return { light: lightColor, dark: darkColor };
    }

    generateMossPatches() {
        const mossPatches = [];
        const patchCount = Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < patchCount; i++) {
            const patchSize = this.size * (Math.random() * 0.3 + 0.1);
            const angle = Math.random() * Math.PI * 2;
            const distance = this.size * (Math.random() * 0.5 + 0.5);
            const patchX = Math.cos(angle) * distance;
            const patchY = Math.sin(angle) * distance;

            mossPatches.push({
                x: patchX,
                y: patchY,
                size: patchSize
            });
        }

        return mossPatches;
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;

        ctx.beginPath();
        ctx.moveTo(screenX + this.shapePoints[0].x, this.y + this.shapePoints[0].y);

        this.shapePoints.forEach(point => {
            ctx.lineTo(screenX + point.x, this.y + point.y);
        });

        ctx.closePath();

        const gradient = ctx.createRadialGradient(screenX, this.y, 0, screenX, this.y, this.size);
        gradient.addColorStop(0, this.gradient.light);
        gradient.addColorStop(0.6, this.baseColor);
        gradient.addColorStop(1, this.gradient.dark);

        ctx.fillStyle = gradient;
        ctx.fill();

        this.mossPatches.forEach(patch => {
            ctx.beginPath();
            ctx.arc(screenX + patch.x, this.y + patch.y, patch.size, 0, Math.PI * 2);
            ctx.fillStyle = this.mossColor;
            ctx.fill();
        });
    }

    shadeColor(color, percent) {
        let num = parseInt(color.slice(1), 16);
        let amt = Math.round(2.55 * percent);
        let R = (num >> 16) + amt;
        let G = (num >> 8 & 0x00FF) + amt;
        let B = (num & 0x0000FF) + amt;
        return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255)
            * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255)
            * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16)
            .slice(1)}`;
    }
}

export class Tree {
    constructor(x, y, height) {
        this.x = x;
        this.y = y;
        this.height = height * (Math.random() * 0.5 + 1.2);
        this.trunkWidth = this.height / 4.5;
        this.trunkHeight = this.height / 2.5;
        this.trunkColor = this.generateTrunkColor();
        this.foliageColor = this.generateFoliageColor();
        this.foliageWidth = this.height * (Math.random() * 0.3 + 0.9);
    }

    generateTrunkColor() {
        const hue = Math.floor(Math.random() * 10 + 25);
        const saturation = Math.floor(Math.random() * 20 + 60);
        const lightness = Math.floor(Math.random() * 10 + 30);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    generateFoliageColor() {
        const hue = Math.floor(Math.random() * 20 + 100);
        const saturation = Math.floor(Math.random() * 20 + 50);
        const lightness = Math.floor(Math.random() * 10 + 40);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;

        ctx.fillStyle = this.trunkColor;
        ctx.fillRect(
            screenX - this.trunkWidth / 2,
            this.y - this.trunkHeight,
            this.trunkWidth,
            this.trunkHeight
        );

        ctx.beginPath();
        ctx.moveTo(screenX, this.y - this.height);
        ctx.lineTo(screenX - this.foliageWidth / 2, this.y - this.trunkHeight);
        ctx.lineTo(screenX + this.foliageWidth / 2, this.y - this.trunkHeight);
        ctx.closePath();
        ctx.fillStyle = this.foliageColor;
        ctx.fill();
    }
}

export class Mountain {
    constructor(x, baseY, isBackground = false) {
        this.x = x;
        this.baseY = baseY;
        this.width = Math.random() * 1000 + 200; // Random width: 200-1200px
        this.height = Math.random() * 400 + 100; // Random height: 100-500px
        this.isBackground = isBackground;

        // Precompute all random values during initialization
        this.peaks = this.generatePeaks();
        this.baseColor = this.generateBaseColor(isBackground);
        this.snowColor = this.generateSnowColor();
        this.roughness = Math.random() * 0.3 + 0.1; // 10-40% roughness
        this.curveControlPoints = this.precomputeCurveControlPoints(); // Store control points for curves
    }

    generateBaseColor(isBackground) {
        const shade = isBackground 
            ? Math.floor(Math.random() * 40 + 70) // Distant: 70-110
            : Math.floor(Math.random() * 60 + 40); // Closer: 40-100
        return `hsl(200, 20%, ${shade}%)`; // Fully opaque HSL color
    }

    generateSnowColor() {
        const blueTint = Math.random() * 0.1;
        return `hsl(210, 50%, ${95 - blueTint * 100}%)`; // Fully opaque HSL color
    }

    generatePeaks() {
        const peakCount = Math.floor(this.width / 150) + 1; // More peaks for wider mountains
        const segmentWidth = this.width / peakCount;
        const peaks = [];
        let prevX = this.x - this.width / 2;

        for (let i = 0; i < peakCount; i++) {
            const baseX = prevX + segmentWidth * (Math.random() * 0.5 + 0.75);
            const offsetX = (Math.random() - 0.5) * segmentWidth * 0.3;
            const peakX = Math.max(this.x - this.width / 2,
                                 Math.min(this.x + this.width / 2, baseX + offsetX));

            const peakHeight = this.height * (Math.random() * 0.7 + 0.3); // 30-100% height
            peaks.push({ x: peakX, height: peakHeight });

            prevX = peakX - segmentWidth * 0.5;
        }

        // Ensure at least one dominant peak
        const maxPeak = Math.max(...peaks.map(p => p.height));
        peaks.forEach(peak => {
            peak.height = (peak.height / maxPeak) * this.height * 0.9 + this.height * 0.1;
        });

        return peaks;
    }

    precomputeCurveControlPoints() {
        const controlPoints = [];
        let prevPeak = { x: this.x - this.width / 2, y: this.baseY };

        this.peaks.forEach(peak => {
            const midX = (prevPeak.x + peak.x) / 2;
            const midY = (prevPeak.y + (this.baseY - peak.height)) / 2;
            const controlOffset = (Math.random() - 0.5) * this.height * this.roughness;

            controlPoints.push({
                midX: midX,
                midY: midY + controlOffset
            });

            prevPeak = { x: peak.x, y: this.baseY - peak.height };
        });

        return controlPoints;
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        const leftX = screenX - this.width / 2;
        const rightX = screenX + this.width / 2;

        // Create mountain gradient
        const gradient = ctx.createLinearGradient(
            leftX, this.baseY - this.height, // Start at the top
            leftX, this.baseY               // End at the base
        );
        gradient.addColorStop(0, this.snowColor); // Snow at the top
        gradient.addColorStop(0.7, this.shadeColor(this.baseColor, 20)); // Lighter midsection
        gradient.addColorStop(1, this.baseColor); // Dark base

        // Draw mountain body with precomputed curves
        ctx.beginPath();
        ctx.moveTo(leftX, this.baseY);

        let prevPeak = { x: leftX, y: this.baseY };
        this.peaks.forEach((peak, index) => {
            const peakScreenX = peak.x - startX;
            const peakY = this.baseY - peak.height;

            const controlPoint = this.curveControlPoints[index];
            const midX = controlPoint.midX - startX;
            const midY = controlPoint.midY;

            ctx.quadraticCurveTo(
                midX,
                midY,
                peakScreenX,
                peakY
            );

            prevPeak = { x: peakScreenX, y: peakY };
        });

        ctx.lineTo(rightX, this.baseY);
        ctx.closePath();

        // Ensure fully opaque fill
        ctx.fillStyle = gradient; // Gradient is fully opaque since baseColor and snowColor are opaque
        ctx.fill();

        // Draw snow caps with texture
        this.peaks.forEach(peak => {
            const peakScreenX = peak.x - startX;
            const snowHeight = peak.height * (Math.random() * 0.3 + 0.5); // 50-80%

            ctx.beginPath();
            ctx.moveTo(peakScreenX - snowHeight, this.baseY - snowHeight);

            // Create snow gradient
            const snowGradient = ctx.createRadialGradient(
                peakScreenX,
                this.baseY - peak.height,
                0,
                peakScreenX,
                this.baseY - peak.height,
                snowHeight * 2
            );
            snowGradient.addColorStop(0, this.snowColor);
            snowGradient.addColorStop(1, this.shadeColor(this.snowColor, -30));

            // Draw snow with bezier curve
            ctx.bezierCurveTo(
                peakScreenX - snowHeight / 2, this.baseY - snowHeight,
                peakScreenX + snowHeight / 2, this.baseY - snowHeight,
                peakScreenX + snowHeight, this.baseY - snowHeight
            );

            // Ensure fully opaque fill
            ctx.fillStyle = snowGradient; // Gradient is fully opaque since snowColor is opaque
            ctx.fill();
        });
    }

    shadeColor(color, percent) {
        // Helper function to adjust color brightness
        let num = parseInt(color.slice(1), 16);
        let amt = Math.round(2.55 * percent);
        let R = (num >> 16) + amt;
        let G = (num >> 8 & 0x00FF) + amt;
        let B = (num & 0x0000FF) + amt;
        return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255)
            * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255)
            * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16)
            .slice(1)}`;
    }
}

class Beach {
    constructor(x, y, width) {
        this.x = x;
        this.y = y; // Ground level at this.x
        this.width = width;
        this.height = 75; // Wave height above ground
    }

    draw(ctx, visibleStartX) {
        const screenX = this.x - visibleStartX;
        // Water body from bottom to ground
        ctx.fillStyle = 'rgba(0, 191, 255, 0.9)'; // Less transparent (was 0.7)
        ctx.fillRect(screenX, this.y, this.width, ctx.canvas.height - this.y);

        // Waves at ground level
        ctx.beginPath();
        for (let wx = 0; wx < this.width; wx += 10) {
            const waveHeight = Math.sin((wx + this.x) * 0.1) * 5;
            if (wx === 0) {
                ctx.moveTo(screenX, this.y + waveHeight);
            } else {
                ctx.lineTo(screenX + wx, this.y + waveHeight);
            }
        }
        ctx.lineTo(screenX + this.width, this.y);
        ctx.lineTo(screenX, this.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fill();
    }
}

export class TerrainAddons {
    constructor(getPathY,ctx) {
        this.getPathY = getPathY;
        this.ctx = ctx; // Store ctx for canvas access
        this.rocks = [];
        this.trees = [];
        this.mountains = [];
        this.beaches = [];
        this.PIXELS_PER_DAY = 200;
        this.generatedRanges = new Map(); // Track generated x-ranges
    }

    initializeAddons() {
    }

    generateAddonsInRange(startX, endX) {
        const segmentSize = 5000; // Generate in 5000px chunks
        const startSegment = Math.floor(startX / segmentSize) * segmentSize;
        const endSegment = Math.ceil(endX / segmentSize) * segmentSize;

        for (let x = startSegment; x < endSegment; x += segmentSize) {
            const segmentStart = x;
        
            // Skip if already generated
            if (this.generatedRanges.has(segmentStart)) continue;
            this.generatedRanges.set(segmentStart, true);
        
            // Add a random offset to the segment start for each object type
            const rockOffset = Math.random() * segmentSize * 0.5; // Up to 50% of segment size
            const treeOffset = Math.random() * segmentSize * 0.5;
            const forestOffset = Math.random() * segmentSize * 0.5;
            const mountainOffset = Math.random() * segmentSize * 0.5;
            const beachOffset = Math.random() * segmentSize * 0.5;
        
            // Rocks: ~1 per 1000px
            const rockCount = Math.floor(segmentSize / 1000);
            for (let i = 0; i < rockCount; i++) {
                const worldX = segmentStart + rockOffset + Math.random() * segmentSize;
                const y = this.getPathY(worldX);
                const size = Math.random() * 10 + 5;
                this.rocks.push(new Rock(worldX, y, size));
            }
        
            // Trees: ~1 individual per 2000px
            const treeCount = Math.floor(segmentSize / 2000);
            for (let i = 0; i < treeCount; i++) {
                const worldX = segmentStart + treeOffset + Math.random() * segmentSize;
                const y = this.getPathY(worldX);
                const height = Math.random() * 40 + 20;
                this.trees.push(new Tree(worldX, y, height));
            }
        
            // Forests: ~1 cluster per 6667px
            const forestCount = Math.floor(segmentSize / 6667);
            for (let i = 0; i < Math.max(1, forestCount); i++) {
                const forestX = segmentStart + forestOffset + Math.random() * (segmentSize - 1000);
                const forestWidth = Math.random() * 500 + 300;
                const treeCount = Math.floor(Math.random() * 10) + 5;
                for (let j = 0; j < treeCount; j++) {
                    const treeX = forestX + Math.random() * forestWidth;
                    const y = this.getPathY(treeX);
                    const height = Math.random() * 30 + 20;
                    this.trees.push(new Tree(treeX, y, height));
                }
            }
        
            // Mountains: ~1 per 4000px
            const mountainCount = Math.floor(segmentSize / 4000);
            for (let i = 0; i < Math.max(1, mountainCount); i++) {
                const worldX = segmentStart + mountainOffset + Math.random() * segmentSize;
                const baseY = this.getPathY(worldX);
                const isBackground = Math.random() < 0.4; // 40% background
                this.mountains.push(new Mountain(worldX, baseY, isBackground));
            }
        
            // Beaches: ~1 per 6667px
            const beachCount = Math.floor(segmentSize / 6667);
            for (let i = 0; i < Math.max(1, beachCount); i++) {
                const worldX = segmentStart + beachOffset + Math.random() * (segmentSize - 1000);
                const y = this.getPathY(worldX);
                const width = Math.random() * 400 + 200;
                this.beaches.push(new Beach(worldX, y, width));
            }
        }

        // Prune add-ons using this.ctx
        const pruneThreshold = startX - 2 * this.ctx.canvas.width;
        this.rocks = this.rocks.filter(item => item.x >= pruneThreshold);
        this.trees = this.trees.filter(item => item.x >= pruneThreshold);
        this.mountains = this.mountains.filter(item => item.x - item.width / 2 >= pruneThreshold);
        this.beaches = this.beaches.filter(item => item.x >= pruneThreshold);
    }

    draw(ctx, bikeX) {
        const delayThreshold = this.ctx.canvas.width * 2;
        if (bikeX < delayThreshold) return;

        const startX = bikeX - this.ctx.canvas.width * 2;
        const endX = bikeX + this.ctx.canvas.width * 3;

        this.generateAddonsInRange(startX, endX);

        const visibleStartX = bikeX - this.ctx.canvas.width / 2;
        const visibleEndX = bikeX + this.ctx.canvas.width / 2;

        this.mountains.filter(m => m.isBackground).forEach(mountain => {
            if (mountain.x - mountain.width / 2 <= visibleEndX && mountain.x + mountain.width / 2 >= visibleStartX) {
                mountain.draw(ctx, visibleStartX);
            }
        });

        this.beaches.forEach(beach => {
            if (beach.x <= visibleEndX && beach.x + beach.width >= visibleStartX) {
                beach.draw(ctx, visibleStartX);
            }
        });

        this.mountains.filter(m => !m.isBackground).forEach(mountain => {
            if (mountain.x - mountain.width / 2 <= visibleEndX && mountain.x + mountain.width / 2 >= visibleStartX) {
                mountain.draw(ctx, visibleStartX);
            }
        });

        this.trees.forEach(tree => {
            if (tree.x >= visibleStartX && tree.x <= visibleEndX) {
                tree.draw(ctx, visibleStartX);
            }
        });

        this.rocks.forEach(rock => {
            if (rock.x >= visibleStartX && rock.x <= visibleEndX) {
                rock.draw(ctx, visibleStartX);
            }
        });
    }
}