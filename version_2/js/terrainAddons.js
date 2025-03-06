// terrainAddons.js
export class Rock {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = '#808080';
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        ctx.beginPath();
        ctx.arc(screenX, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

export class Tree {
    constructor(x, y, height) {
        this.x = x;
        this.y = y;
        this.height = height;
        this.trunkWidth = height / 5;
        this.trunkColor = '#8B4513';
        this.foliageColor = '#228B22';
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        const trunkHeight = this.height / 2;
        
        ctx.fillStyle = this.trunkColor;
        ctx.fillRect(screenX - this.trunkWidth / 2, this.y - trunkHeight, this.trunkWidth, trunkHeight);
        
        ctx.beginPath();
        ctx.moveTo(screenX, this.y - this.height);
        ctx.lineTo(screenX - this.trunkWidth * 1.5, this.y - trunkHeight);
        ctx.lineTo(screenX + this.trunkWidth * 1.5, this.y - trunkHeight);
        ctx.closePath();
        ctx.fillStyle = this.foliageColor;
        ctx.fill();
    }
}

export class Mountain {
    constructor(x, baseY, width, height) {
        this.x = x;
        this.baseY = baseY;
        this.width = width;
        this.height = height;
        this.color = '#696969';
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        ctx.beginPath();
        ctx.moveTo(screenX - this.width / 2, this.baseY);
        ctx.lineTo(screenX, this.baseY - this.height);
        ctx.lineTo(screenX + this.width / 2, this.baseY);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

export class Forest {
    constructor(x, y, width, treeCount) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.treeCount = treeCount;
        this.trees = [];
        this.generateTrees();
    }

    generateTrees() {
        for (let i = 0; i < this.treeCount; i++) {
            const treeX = this.x + Math.random() * this.width;
            const height = Math.random() * 30 + 20;
            this.trees.push(new Tree(treeX, this.y, height));
        }
    }

    draw(ctx, startX) {
        const screenLeft = this.x - startX;
        const screenRight = screenLeft + this.width;
        if (screenRight >= 0 && screenLeft <= ctx.canvas.width) {
            this.trees.forEach(tree => tree.draw(ctx, startX));
        }
    }
}

export class Beach {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.sandColor = '#F4A460';
        this.waterColor = '#4682B4';
    }

    draw(ctx, startX) {
        const screenX = this.x - startX;
        const waterHeight = 50;

        ctx.fillStyle = this.sandColor;
        ctx.fillRect(screenX, this.y, this.width, waterHeight / 2);

        ctx.fillStyle = this.waterColor;
        ctx.fillRect(screenX, this.y + waterHeight / 2, this.width, waterHeight);
    }
}

export class TerrainAddons {
    constructor(getPathY) {
        this.getPathY = getPathY;
        this.rocks = [];
        this.trees = [];
        this.mountains = [];
        this.forests = [];
        this.beaches = [];
        this.PIXELS_PER_DAY = 200;
        // Don’t call initializeAddons here; we’ll call it later
    }

    initializeAddons() {
        const terrainLength = 100 * this.PIXELS_PER_DAY;

        this.rocks = [];
        for (let i = 0; i < 20; i++) {
            const worldX = Math.random() * terrainLength;
            const y = this.getPathY(worldX);
            const size = Math.random() * 10 + 5;
            this.rocks.push(new Rock(worldX, y, size));
        }

        this.trees = [];
        for (let i = 0; i < 10; i++) {
            const worldX = Math.random() * terrainLength;
            const y = this.getPathY(worldX);
            const height = Math.random() * 40 + 20;
            this.trees.push(new Tree(worldX, y, height));
        }

        this.mountains = [];
        for (let i = 0; i < 5; i++) {
            const worldX = Math.random() * terrainLength;
            const baseY = this.getPathY(worldX);
            const width = Math.random() * 300 + 200;
            const height = Math.random() * 150 + 100;
            this.mountains.push(new Mountain(worldX, baseY, width, height));
        }

        this.forests = [];
        for (let i = 0; i < 3; i++) {
            const worldX = Math.random() * (terrainLength - 1000);
            const y = this.getPathY(worldX);
            const width = Math.random() * 500 + 300;
            const treeCount = Math.floor(Math.random() * 10) + 5;
            this.forests.push(new Forest(worldX, y, width, treeCount));
        }

        this.beaches = [];
        for (let i = 0; i < 3; i++) {
            const worldX = Math.random() * (terrainLength - 1000);
            const y = this.getPathY(worldX);
            const width = Math.random() * 400 + 200;
            this.beaches.push(new Beach(worldX, y, width));
        }
    }

    draw(ctx, bikeX) {
        const startX = bikeX - ctx.canvas.width / 2;
        const endX = bikeX + ctx.canvas.width / 2;

        this.mountains.forEach(mountain => {
            if (mountain.x - mountain.width / 2 <= endX && mountain.x + mountain.width / 2 >= startX) {
                mountain.draw(ctx, startX);
            }
        });

        this.beaches.forEach(beach => {
            if (beach.x <= endX && beach.x + beach.width >= startX) {
                beach.draw(ctx, startX);
            }
        });

        this.forests.forEach(forest => forest.draw(ctx, startX));

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