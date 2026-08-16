// Sprite loader/registry. Loading is fire-and-forget from main.js: every
// consumer below reads through getSprite() and falls back to its own
// procedural draw when an id isn't loaded yet (or never will be, if the
// artist hasn't generated that sprite). Nothing here may throw or reject -
// a missing PNG is a normal, permanent state, not an error.

const registry = new Map(); // id -> HTMLImageElement | null

export function loadAssets(manifest) {
    return Promise.all(manifest.map(({ id, path }) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { registry.set(id, img); resolve(); };
        img.onerror = () => { registry.set(id, null); resolve(); };
        img.src = path;
    })));
}

export function getSprite(id) {
    return registry.get(id) || null;
}
