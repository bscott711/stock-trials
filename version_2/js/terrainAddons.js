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
        this.width = Math.random() * 1000 + 200;
        this.height = Math.random() * 400 + 100;
        this.isBackground = isBackground;
        this.peaks = this.generatePeaks();
        this.baseColor = this.generateBaseColor(isBackground);
        this.snowColor = this.generateSnowColor();
        this.roughness = Math.random() * 0.3 + 0.1;
        this.curveControlPoints = this.precomputeCurveControlPoints();
    }

    generateBaseColor(isBackground) {
        const shade = isBackground 
            ? Math.floor(Math.random() * 40 + 70)
            : Math.floor(Math.random() * 60 + 40);
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
            const peakHeight = this.height * (Math.random() * 0.7 + 0.3);
            peaks.push({ x: peakX, height: peakHeight });
            prevX = peakX - segmentWidth * 0.5;
        }

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

        const gradient = ctx.createLinearGradient(leftX, this.baseY - this.height, leftX, this.baseY);
        gradient.addColorStop(0, this.snowColor);
        gradient.addColorStop(0.7, this.shadeColor(this.baseColor, 20));
        gradient.addColorStop(1, this.baseColor);

        ctx.beginPath();
        ctx.moveTo(leftX, this.baseY);

        let prevPeak = { x: leftX, y: this.baseY };
        this.peaks.forEach((peak, index) => {
            const peakScreenX = peak.x - startX;
            const peakY = this.baseY - peak.height;

            const controlPoint = this.curveControlPoints[index];
            const midX = controlPoint.midX - startX;
            const midY = controlPoint.midY;

            ctx.quadraticCurveTo(midX, midY, peakScreenX, peakY);
            prevPeak = { x: peakScreenX, y: peakY };
        });

        ctx.lineTo(rightX, this.baseY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        this.peaks.forEach(peak => {
            const peakScreenX = peak.x - startX;
            const snowHeight = peak.height * (Math.random() * 0.3 + 0.5);

            ctx.beginPath();
            ctx.moveTo(peakScreenX - snowHeight, this.baseY - snowHeight);

            const snowGradient = ctx.createRadialGradient(
                peakScreenX, this.baseY - peak.height, 0,
                peakScreenX, this.baseY - peak.height, snowHeight * 2
            );
            snowGradient.addColorStop(0, this.snowColor);
            snowGradient.addColorStop(1, this.shadeColor(this.snowColor, -30));

            ctx.bezierCurveTo(
                peakScreenX - snowHeight / 2, this.baseY - snowHeight,
                peakScreenX + snowHeight / 2, this.baseY - snowHeight,
                peakScreenX + snowHeight, this.baseY - snowHeight
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

export class Beach {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.sandColor = this.generateSandColor();
        this.waterColor = this.generateWaterColor();
        this.wavePoints = this.generateWavePoints();
        this.sandGradient = this.generateSandGradient();
        this.waterGradient = this.generateWaterGradient();
    }

    generateSandColor() {
        const hue = Math.floor(Math.random() * 10 + 30);
        const saturation = Math.floor(Math.random() * 20 + 60);
        const lightness = Math.floor(Math.random() * 10 + 75);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    generateWaterColor() {
        const hue = Math.floor(Math.random() * 20 + 200);
        const saturation = Math.floor(Math.random() * 20 + 60);
        const lightness = Math.floor(Math.random() * 10 + 55);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    generateWavePoints() {
        const numPoints = Math.floor(this.width / 20);
        const points = [];
        const waveHeight = 10;

        for (let i = 0; i < numPoints; i++) {
            const x = (this.width / numPoints) * i;
            const y = this.y + (Math.random() - 0.5) * waveHeight;
            points.push({ x, y });
        }

        return points;
    }

    generateSandGradient() {
        const gradient = {};
        gradient.light = this.shadeColor(this.sandColor, 10);
        gradient.dark = this.shadeColor(this.sandColor, -5);
        return gradient;
    }

    generateWaterGradient() {
        const gradient = {};
        gradient.light = this.shadeColor(this.waterColor, 15);
        gradient.dark = this.shadeColor(this.waterColor, -5);
        return gradient;
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        const sandHeight = 25;
        const waterHeight = 25;

        ctx.beginPath();
        ctx.moveTo(screenX, this.y);
        this.wavePoints.forEach(point => {
            const adjustedX = screenX + point.x;
            ctx.lineTo(adjustedX, point.y);
        });
        ctx.lineTo(screenX + this.width, this.y);
        ctx.closePath();

        const sandGradient = ctx.createLinearGradient(screenX, this.y, screenX, this.y + sandHeight);
        sandGradient.addColorStop(0, this.sandGradient.light);
        sandGradient.addColorStop(0.6, this.sandColor);
        sandGradient.addColorStop(1, this.sandGradient.dark);

        ctx.fillStyle = sandGradient;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screenX, this.y + sandHeight + waterHeight);
        this.wavePoints.forEach(point => {
            const adjustedX = screenX + point.x;
            ctx.lineTo(adjustedX, point.y);
        });
        ctx.lineTo(screenX + this.width, this.y + sandHeight + waterHeight);
        ctx.closePath();

        const waterGradient = ctx.createLinearGradient(screenX, this.y + sandHeight, screenX, this.y + sandHeight + waterHeight);
        waterGradient.addColorStop(0, this.waterGradient.light);
        waterGradient.addColorStop(0.6, this.waterColor);
        waterGradient.addColorStop(1, this.waterGradient.dark);

        ctx.fillStyle = waterGradient;
        ctx.fill();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        this.wavePoints.forEach((point, index) => {
            if (index % 2 === 0) {
                const adjustedX = screenX + point.x;
                ctx.moveTo(adjustedX, point.y);
                ctx.lineTo(adjustedX, point.y - 3);
            }
        });
        ctx.stroke();
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

export class TerrainAddons {
    constructor(getPathY) {
        this.getPathY = getPathY;
        this.rocks = [];
        this.trees = [];
        this.mountains = [];
        this.beaches = [];
        this.PIXELS_PER_DAY = 200;
    }

    initializeAddons() {
        // Use the full path length from Environment
        const terrainLength = 1000 * this.PIXELS_PER_DAY; // Match extended ground (200,000px)

        this.rocks = [];
        for (let i = 0; i < 200; i++) { // Scale up to 200 rocks for longer terrain
            const worldX = Math.random() * terrainLength;
            const y = this.getPathY(worldX);
            const size = Math.random() * 10 + 5;
            this.rocks.push(new Rock(worldX, y, size));
        }

        this.trees = [];
        for (let i = 0; i < 100; i++) { // Scale up to 100 individual trees
            const worldX = Math.random() * terrainLength;
            const y = this.getPathY(worldX);
            const height = Math.random() * 40 + 20;
            this.trees.push(new Tree(worldX, y, height));
        }

        for (let i = 0; i < 30; i++) { // Scale up to 30 forest clusters
            const forestX = Math.random() * (terrainLength - 1000);
            const forestWidth = Math.random() * 500 + 300;
            const treeCount = Math.floor(Math.random() * 10) + 5;
            for (let j = 0; j < treeCount; j++) {
                const treeX = forestX + Math.random() * forestWidth;
                const y = this.getPathY(treeX);
                const height = Math.random() * 30 + 20;
                this.trees.push(new Tree(treeX, y, height));
            }
        }

        this.mountains = [];
        for (let i = 0; i < 50; i++) { // Scale up to 50 mountains
            const worldX = Math.random() * terrainLength;
            const baseY = this.getPathY(worldX);
            const isBackground = i < 20; // First 20 as background
            this.mountains.push(new Mountain(worldX, baseY, isBackground));
        }

        this.beaches = [];
        for (let i = 0; i < 30; i++) { // Scale up to 30 beaches
            const worldX = Math.random() * (terrainLength - 1000);
            const y = this.getPathY(worldX);
            const width = Math.random() * 400 + 200;
            this.beaches.push(new Beach(worldX, y, width));
        }
    }

    draw(ctx, bikeX) {
        const startX = bikeX - ctx.canvas.width / 2;
        const endX = bikeX + ctx.canvas.width / 2;

        this.mountains.filter(m => m.isBackground).forEach(mountain => {
            if (mountain.x - mountain.width / 2 <= endX && mountain.x + mountain.width / 2 >= startX) {
                mountain.draw(ctx, startX);
            }
        });

        this.beaches.forEach(beach => {
            if (beach.x <= endX && beach.x + beach.width >= startX) {
                beach.draw(ctx, startX);
            }
        });

        this.mountains.filter(m => !m.isBackground).forEach(mountain => {
            if (mountain.x - mountain.width / 2 <= endX && mountain.x + mountain.width / 2 >= startX) {
                mountain.draw(ctx, startX);
            }
        });

        this.trees.forEach(tree => {
            if (tree.x >= startX && tree.x <= endX) {
                tree.draw(ctx, startX);
            }
        });

        this.rocks.forEach(rock => {
            if (rock.x >= startX && rock.x <= endX) {
                rock.draw(ctx, startX);
            }
        });
    }
}