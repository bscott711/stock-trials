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
    constructor(x, baseY, getPathY, isBackground = false) {
        this.x = x;
        this.baseY = baseY; // Initial reference (for compatibility, but mostly unused)
        this.getPathY = getPathY; // Function to get terrain height
        this.width = Math.random() * 1000 + 200; // 200-1200px
        this.height = Math.random() * 400 + 100; // 100-500px
        this.isBackground = isBackground;

        this.peaks = this.generatePeaks();
        this.baseColor = this.generateBaseColor(isBackground);
        this.snowColor = this.generateSnowColor();
        this.roughness = Math.random() * 0.3 + 0.1; // 10-40% roughness
        this.curveControlPoints = this.precomputeCurveControlPoints();
    }

    generateBaseColor(isBackground) {
        const shade = isBackground 
            ? Math.floor(Math.random() * 40 + 70) // 70-110
            : Math.floor(Math.random() * 60 + 40); // 40-100
        return `hsl(200, 20%, ${shade}%)`;
    }

    generateSnowColor() {
        const blueTint = Math.random() * 0.1;
        return `hsl(210, 50%, ${95 - blueTint * 100}%)`;
    }

    generatePeaks() {
        const peakCount = Math.floor(this.width / 150) + 1;
        const segmentWidth = this.width / peakCount;
        const peaks = [];
        let prevX = this.x - this.width / 2;

        for (let i = 0; i < peakCount; i++) {
            const baseX = prevX + segmentWidth * (Math.random() * 0.5 + 0.75);
            const offsetX = (Math.random() - 0.5) * segmentWidth * 0.3;
            const peakX = Math.max(this.x - this.width / 2, Math.min(this.x + this.width / 2, baseX + offsetX));
            const peakHeight = this.height * (Math.random() * 0.7 + 0.3); // 30-100% height
            peaks.push({ x: peakX, height: peakHeight });
            prevX = peakX - segmentWidth * 0.5;
        }

        // Normalize heights relative to max peak
        const maxPeak = Math.max(...peaks.map(p => p.height));
        peaks.forEach(peak => {
            peak.height = (peak.height / maxPeak) * this.height * 0.9 + this.height * 0.1;
        });

        return peaks;
    }

    precomputeCurveControlPoints() {
        const controlPoints = [];
        let prevPeak = { x: this.x - this.width / 2, y: this.getPathY(this.x - this.width / 2) };

        this.peaks.forEach(peak => {
            const peakBaseY = this.getPathY(peak.x);
            const midX = (prevPeak.x + peak.x) / 2;
            const midBaseY = this.getPathY(midX);
            const midY = (prevPeak.y + (peakBaseY - peak.height)) / 2;
            const controlOffset = (Math.random() - 0.5) * this.height * this.roughness;

            controlPoints.push({
                midX: midX,
                midY: midY + controlOffset
            });

            prevPeak = { x: peak.x, y: peakBaseY - peak.height };
        });

        return controlPoints;
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        const leftX = screenX - this.width / 2;
        const rightX = screenX + this.width / 2;

        // Find the highest peak and lowest base for gradient
        const peakTops = this.peaks.map(p => this.getPathY(p.x) - p.height);
        const highestY = Math.min(...peakTops);
        const baseYs = [this.getPathY(this.x - this.width / 2), this.getPathY(this.x + this.width / 2)];
        this.peaks.forEach(p => baseYs.push(this.getPathY(p.x)));
        const lowestY = Math.max(...baseYs);

        const gradient = ctx.createLinearGradient(
            leftX, highestY - startX, // Top of highest peak
            leftX, lowestY - startX   // Bottom of lowest base
        );
        gradient.addColorStop(0, this.snowColor);
        gradient.addColorStop(0.7, this.shadeColor(this.baseColor, 20));
        gradient.addColorStop(1, this.baseColor);

        // Draw mountain body
        ctx.beginPath();
        const leftBaseY = this.getPathY(this.x - this.width / 2);
        ctx.moveTo(leftX, leftBaseY);

        let prevPeak = { x: leftX, y: leftBaseY };
        this.peaks.forEach((peak, index) => {
            const peakScreenX = peak.x - startX;
            const peakBaseY = this.getPathY(peak.x);
            const peakY = peakBaseY - peak.height;

            const controlPoint = this.curveControlPoints[index];
            const midX = controlPoint.midX - startX;
            const midY = controlPoint.midY;

            ctx.quadraticCurveTo(midX, midY, peakScreenX, peakY);
            prevPeak = { x: peakScreenX, y: peakY };
        });

        // Trace the ground back to the left
        const rightBaseY = this.getPathY(this.x + this.width / 2);
        ctx.lineTo(rightX, rightBaseY);

        // Draw base along terrain (right to left)
        const steps = Math.floor(this.width / 50); // Sample every ~50px
        for (let i = steps; i >= 0; i--) {
            const sampleX = this.x - this.width / 2 + (i / steps) * this.width;
            const sampleScreenX = sampleX - startX;
            const sampleY = this.getPathY(sampleX);
            ctx.lineTo(sampleScreenX, sampleY);
        }

        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw snow caps
        this.peaks.forEach(peak => {
            const peakScreenX = peak.x - startX;
            const peakBaseY = this.getPathY(peak.x);
            const snowHeight = peak.height * (Math.random() * 0.3 + 0.5);

            ctx.beginPath();
            ctx.moveTo(peakScreenX - snowHeight, peakBaseY - snowHeight);

            const snowGradient = ctx.createRadialGradient(
                peakScreenX, peakBaseY - peak.height, 0,
                peakScreenX, peakBaseY - peak.height, snowHeight * 2
            );
            snowGradient.addColorStop(0, this.snowColor);
            snowGradient.addColorStop(1, this.shadeColor(this.snowColor, -30));

            ctx.bezierCurveTo(
                peakScreenX - snowHeight / 2, peakBaseY - snowHeight,
                peakScreenX + snowHeight / 2, peakBaseY - snowHeight,
                peakScreenX + snowHeight, peakBaseY - snowHeight
            );
            ctx.fillStyle = snowGradient;
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

class Beach {
    constructor(x, y, width, getPathY, height = 75) { // Default height if not capped
        this.x = x;
        this.y = y; // Initial reference (terrain height at x)
        this.width = width;
        this.height = height; // Now passed from TerrainAddons, capped to valley depth
        this.slopeWidth = 100; // Width of sloping edges
        this.getPathY = getPathY;
    }

    draw(ctx, visibleStartX) {
        const screenX = this.x - visibleStartX;
        const leftEdge = this.x - this.slopeWidth;
        const rightEdge = this.x + this.width + this.slopeWidth;

        // Draw water first (background layer)
        ctx.fillStyle = 'rgba(0, 191, 255, 0.9)';
        ctx.beginPath();
        const leftBaseY = this.getPathY(leftEdge);
        ctx.moveTo(screenX - this.slopeWidth, leftBaseY);

        // Left water slope up to wave height
        const leftWaterStartX = this.x;
        const leftWaterTopY = this.getPathY(leftWaterStartX) - this.height;
        ctx.quadraticCurveTo(
            screenX - this.slopeWidth / 2,
            this.getPathY(leftEdge + this.slopeWidth / 2) - this.height / 2,
            screenX,
            leftWaterTopY
        );

        // Water top with waves
        for (let wx = 0; wx <= this.width; wx += 10) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            const waveHeight = Math.sin(worldX * 0.1) * 5;
            const waterY = groundY - this.height + waveHeight;
            ctx.lineTo(screenX + wx, waterY);
        }

        // Right water slope down to terrain
        const rightWaterEndX = this.x + this.width;
        const rightWaterTopY = this.getPathY(rightWaterEndX) - this.height;
        ctx.quadraticCurveTo(
            screenX + this.width + this.slopeWidth / 2,
            this.getPathY(rightEdge - this.slopeWidth / 2) - this.height / 2,
            screenX + this.width + this.slopeWidth,
            this.getPathY(rightEdge)
        );

        // Close water shape along terrain
        for (let wx = this.width + this.slopeWidth; wx >= -this.slopeWidth; wx -= 50) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            ctx.lineTo(screenX + wx, groundY);
        }
        ctx.closePath();
        ctx.fill();

        // Draw foam on water (slopes and top)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';

        // Left slope foam
        for (let wx = -this.slopeWidth; wx < 0; wx += 10) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            const t = (wx + this.slopeWidth) / this.slopeWidth;
            const waterY = groundY - this.height * t + Math.sin(worldX * 0.1) * 5;
            if (Math.random() < 0.5) {
                ctx.moveTo(screenX + wx, waterY);
                ctx.lineTo(screenX + wx, waterY - 3);
            }
        }

        // Top edge foam
        for (let wx = 0; wx <= this.width; wx += 10) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            const waveHeight = Math.sin(worldX * 0.1) * 5;
            const waterY = groundY - this.height + waveHeight;
            if (Math.random() < 0.5) {
                ctx.moveTo(screenX + wx, waterY);
                ctx.lineTo(screenX + wx, waterY - 3);
            }
        }

        // Right slope foam
        for (let wx = this.width; wx <= this.width + this.slopeWidth; wx += 10) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            const t = (this.width + this.slopeWidth - wx) / this.slopeWidth;
            const waterY = groundY - this.height * t + Math.sin(worldX * 0.1) * 5;
            if (Math.random() < 0.5) {
                ctx.moveTo(screenX + wx, waterY);
                ctx.lineTo(screenX + wx, waterY - 3);
            }
        }
        ctx.stroke();

        // Draw sand second (foreground layer)
        ctx.fillStyle = '#F4A460';
        ctx.beginPath();
        ctx.moveTo(screenX - this.slopeWidth, this.getPathY(leftEdge));

        // Left sand slope to water edge
        const leftSandTopY = leftWaterTopY + this.height / 2;
        ctx.quadraticCurveTo(
            screenX - this.slopeWidth / 2,
            this.getPathY(leftEdge + this.slopeWidth / 2),
            screenX,
            leftSandTopY
        );

        // Sand across water area (above water)
        for (let wx = 0; wx <= this.width; wx += 10) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            const sandY = groundY - this.height / 2;
            ctx.lineTo(screenX + wx, sandY);
        }

        // Right sand slope back to terrain
        const rightSandTopY = rightWaterTopY + this.height / 2;
        ctx.quadraticCurveTo(
            screenX + this.width + this.slopeWidth / 2,
            this.getPathY(rightEdge - this.slopeWidth / 2),
            screenX + this.width + this.slopeWidth,
            this.getPathY(rightEdge)
        );

        // Trace terrain back to close sand shape
        for (let wx = this.width + this.slopeWidth; wx >= -this.slopeWidth; wx -= 50) {
            const worldX = this.x + wx;
            const groundY = this.getPathY(worldX);
            ctx.lineTo(screenX + wx, groundY);
        }
        ctx.closePath();
        ctx.fill();
    }
}

export class TerrainAddons {
    constructor(getPathY, ctx) {
        this.getPathY = getPathY;
        this.ctx = ctx;
        this.rocks = [];
        this.trees = [];
        this.mountains = [];
        this.beaches = [];
        this.PIXELS_PER_DAY = 200;
        this.generatedRanges = new Map();
    }

    initializeAddons() {
        // Keeping it empty as per your version
    }

    generateAddonsInRange(startX, endX) {
        const segmentSize = 5000;
        const startSegment = Math.floor(startX / segmentSize) * segmentSize;
        const endSegment = Math.ceil(endX / segmentSize) * segmentSize;

        for (let x = startSegment; x < endSegment; x += segmentSize) {
            const segmentStart = x;

            if (this.generatedRanges.has(segmentStart)) continue;
            this.generatedRanges.set(segmentStart, true);

            const rockOffset = Math.random() * segmentSize * 0.5;
            const treeOffset = Math.random() * segmentSize * 0.5;
            const forestOffset = Math.random() * segmentSize * 0.5;
            const mountainOffset = Math.random() * segmentSize * 0.5;
            const beachOffset = Math.random() * segmentSize * 0.5;

            // Rocks: ~1 per 1000px, with clusters
            const rockCount = Math.floor(segmentSize / 1000); // 5 rocks per 5000px
            for (let i = 0; i < rockCount; i++) {
                if (Math.random() < 0.3) { // 30% chance of a cluster
                    const clusterX = segmentStart + rockOffset + Math.random() * segmentSize;
                    const clusterWidth = Math.random() * 150 + 100; // 100-250px wide
                    const clusterRockCount = Math.floor(Math.random() * 4) + 3; // 3-6 rocks
                    for (let j = 0; j < clusterRockCount; j++) {
                        const rockX = clusterX + (Math.random() - 0.5) * clusterWidth;
                        const y = this.getPathY(rockX);
                        const size = Math.random() * 15 + 5; // 5-20px base size
                        this.rocks.push(new Rock(rockX, y, size));
                    }
                } else { // 70% chance of a single rock
                    const worldX = segmentStart + rockOffset + Math.random() * segmentSize;
                    const y = this.getPathY(worldX);
                    const size = Math.random() * 10 + 5; // 5-15px base size
                    this.rocks.push(new Rock(worldX, y, size));
                }
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
                const isBackground = Math.random() < 0.4;
                this.mountains.push(new Mountain(worldX, baseY, this.getPathY, isBackground));
            }

            // Beaches: ~1 per 6667px, at valley base with capped height
            const beachCount = Math.floor(segmentSize / 6667);
            for (let i = 0; i < Math.max(1, beachCount); i++) {
                const baseX = segmentStart + beachOffset + Math.random() * (segmentSize - 1000);
                const width = Math.random() * 400 + 200; // 200-600px

                // Find the valley base within the potential width
                let lowestX = baseX;
                let lowestY = this.getPathY(baseX);
                const leftBound = baseX - width / 2;
                const rightBound = baseX + width / 2;
                for (let sampleX = leftBound; sampleX <= rightBound; sampleX += 10) {
                    const sampleY = this.getPathY(sampleX);
                    if (sampleY > lowestY) { // Higher y = lower on canvas
                        lowestX = sampleX;
                        lowestY = sampleY;
                    }
                }

                // Check if it's a valley and get its depth
                const leftEdge = lowestX - width / 2;
                const rightEdge = lowestX + width / 2;
                const leftY = this.getPathY(leftEdge);
                const rightY = this.getPathY(rightEdge);
                const valleyThreshold = 20; // Min dip
                if (lowestY > leftY - valleyThreshold && lowestY > rightY - valleyThreshold) {
                    // Cap height to valley depth (min distance to edges)
                    const valleyDepth = Math.min(lowestY - leftY, lowestY - rightY);
                    const cappedHeight = Math.min(75, valleyDepth * 0.9); // 90% of depth, max 75px
                    this.beaches.push(new Beach(lowestX, lowestY, width, this.getPathY, cappedHeight));
                }
            }
        }

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

        this.mountains.filter(m => !m.isBackground).forEach(mountain => {
            if (mountain.x - mountain.width / 2 <= visibleEndX && mountain.x + mountain.width / 2 >= visibleStartX) {
                mountain.draw(ctx, visibleStartX);
            }
        });

        this.beaches.forEach(beach => {
            if (beach.x <= visibleEndX && beach.x + beach.width >= visibleStartX) {
                beach.draw(ctx, visibleStartX);
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