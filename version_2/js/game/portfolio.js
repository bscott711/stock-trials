// Cash collected from pickups. Kept out of bike.js (physics has no business
// knowing about scoring) and out of world/pickups.js (placement has no
// business knowing about the reward formula) - same separation terrain.js
// and scenery.js already keep from each other.

// How much extra a pickup pays for being collected somewhere volatile and
// fast, on top of its face value. Always a bonus, never a penalty - a slow
// pass through calm terrain still pays baseValue.
const RISK_SCALE = 2.5;

export class Portfolio {
    constructor() {
        this.cash = 0;
    }

    /**
     * @param baseValue   the pickup's face value
     * @param volatility  0..1, terrain.localVolatility() where it sat
     * @param speedFrac   0..1, bike speed at collection / bike.MAX_SPEED
     * @returns the amount actually gained
     */
    collect(baseValue, volatility, speedFrac) {
        const gained = baseValue * (1 + volatility * speedFrac * RISK_SCALE);
        this.cash += gained;
        return gained;
    }
}
