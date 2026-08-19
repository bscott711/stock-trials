# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Slice the barricades/ sheets into individual hazard-wall sprites at the
path js/render/spriteManifest.js expects (hazards/wall-0.png .. wall-N.png).

Two different sheet shapes, handled in two passes that share one output
index so every sprite lands in one contiguous 0..N-1 pool:

PASS 1 - more_variations.png: a pure grid with no captions AND no uniform
cell size - two side-by-side blocks (a "wood/rope" block, an "ice/stone"
block), each 4 rows tall, but individual item WIDTH varies row to row (some
rows are 3 wide items, others 4 narrower ones) and item HEIGHT varies too
(the icy rows run much taller than the wood rows). Neither of
build_scenery_sprites.py's two slicing modes fits: detect_rows' caption-
height filter has nothing to filter (no captions), and GRID_SHEETS'
even_spans()/fixed spans assume uniform cells, which cuts several of the
wider items in half here. Approach instead:
  1. Column split per half is fixed (measured once from the sheet's outer
     margins - see LEFT_X0/LEFT_X1/RIGHT_X0/RIGHT_X1).
  2. Row Y-bands are fixed too (ROWS_Y, measured from the sheet's actual
     background gutters - the third band is intentionally cut short at 530
     rather than 566: the icy row directly below it has tall spike tips
     that bleed upward past 530, and including them fused a stray ice-spike
     fragment onto the mossy-frame sprites sharing that row).
  3. WITHIN a row, item count varies (COUNTS) and item boundaries are found
     by column-ink-density valleys (find_boundaries), not an even split -
     the "hollow/gapped" mossy frame and the wide icy-bones pile both
     span a different fraction of their row than their neighbors, so an
     even split cuts through their middle instead of the gap beside them.
  4. Each resulting cell is background-removed and tightly cropped to
     whatever ink survives inside it (remove_background_arr, ported from
     build_scenery_sprites.py), unioning every component above MIN_AREA so
     a design's disjoint parts (e.g. a dropped chain lying just apart from
     the ice blocks) still save as one sprite.

PASS 2 - beach.png/forest.png/mountain.png: two big "hero" illustrations per
sheet (each a higher-detail, differently-composed take on a design also
present in more_variations.png - still worth keeping as separate pool
entries for the extra variety, not just discarding as a duplicate) with
bold captions above (and, on forest.png, below too). This one DOES fit
build_scenery_sprites.py's height-filter idea, just simpler: every caption
component tops out under 60px tall, every illustration is 450px+, so
SHOWCASE_MIN_ART_H separates them outright with no row/column bookkeeping
needed - connected-component label the sheet, keep only components taller
than that, sort left to right, done.

Usage:
    uv run tools/build_barricade_sprites.py --report   # detect + print only
    uv run tools/build_barricade_sprites.py             # detect + write PNGs
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SHEET = "version_2/assets/sprites/barricades/more_variations.png"
SHOWCASE_SHEETS = [
    "version_2/assets/sprites/barricades/beach.png",
    "version_2/assets/sprites/barricades/forest.png",
    "version_2/assets/sprites/barricades/mountain.png",
]
SHOWCASE_MIN_ART_H = 300  # captions top out ~55px tall; art components are 450px+
OUT_DIR = "version_2/assets/sprites/hazards"
SLUG = "wall"
PAD = 6
MIN_AREA = 400

LEFT_X0, LEFT_X1 = 37, 708
RIGHT_X0, RIGHT_X1 = 749, 1374
# (y0, y1) per row band, top to bottom. Band 3 stops at 530, not the sheet's
# real gutter at ~566, to stay clear of the icy row below it - see module
# docstring.
ROWS_Y = [(30, 192), (199, 366), (391, 530), (566, 742)]
COUNTS = {  # (half, row_index) -> item count in that row
    ("L", 0): 4, ("L", 1): 4, ("L", 2): 4, ("L", 3): 3,
    ("R", 0): 3, ("R", 1): 4, ("R", 2): 4, ("R", 3): 4,
}


def remove_background_arr(arr, tolerance=14):
    """Flood-fill transparency in from THIS ARRAY'S OWN border, matching
    pixels within `tolerance` of its own border color. Ported from
    build_scenery_sprites.py - see that file for the full rationale."""
    arr = arr.copy()
    rgb = arr[..., :3].astype(np.int16)
    border = np.concatenate([rgb[0, :], rgb[-1, :], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(rgb - bg).max(axis=-1)
    bg_like = diff <= tolerance
    labels, _ = ndimage.label(bg_like, structure=np.ones((3, 3)))
    border_labels = set(labels[0, :].tolist()) | set(labels[-1, :].tolist()) \
        | set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border_labels.discard(0)
    remove_mask = np.isin(labels, list(border_labels))
    arr[remove_mask, 3] = 0
    return arr


def _col_ink(rgb_img, x0, x1, y0, y1):
    sub = rgb_img[y0:y1, x0:x1]
    is_bg = (sub > 230).all(axis=2)
    return (~is_bg).sum(axis=0).astype(float)


def _smooth(a, k=11):
    return np.convolve(a, np.ones(k) / k, mode='same')


def find_boundaries(ink, n_items, min_sep=60, edge_margin=20):
    """Split a row of width len(ink) into n_items pieces by repeatedly
    picking the lowest-ink column not already near a previous pick, rather
    than an even split - real item widths in this sheet vary enough that an
    even split lands inside an item instead of the gap beside it."""
    s = _smooth(ink)
    w = len(s)
    candidates = list(range(edge_margin, w - edge_margin))
    pool = s.copy()
    picked = []
    for _ in range(n_items - 1):
        idx = min(candidates, key=lambda i: pool[i])
        picked.append(idx)
        lo, hi = max(0, idx - min_sep), min(w, idx + min_sep)
        pool[lo:hi] = 1e9
        candidates = [i for i in candidates if not (lo <= i < hi)]
    return [0] + sorted(picked) + [w]


def _save_or_report(sub, index, label, report_only):
    if report_only:
        print(f"  {label}: {sub.shape[1]}x{sub.shape[0]}")
    else:
        Image.fromarray(sub).save(f"{OUT_DIR}/{SLUG}-{index}.png")


def slice_grid_sheet(report_only, index):
    raw = np.array(Image.open(SHEET).convert("RGBA"))
    raw_rgb = np.array(Image.open(SHEET).convert("RGB"))

    for half, (hx0, hx1) in [("L", (LEFT_X0, LEFT_X1)), ("R", (RIGHT_X0, RIGHT_X1))]:
        for ri, (y0, y1) in enumerate(ROWS_Y):
            n = COUNTS[(half, ri)]
            ink = _col_ink(raw_rgb, hx0, hx1, y0, y1)
            bounds = find_boundaries(ink, n)
            for ci in range(n):
                cx0, cx1 = hx0 + bounds[ci], hx0 + bounds[ci + 1]
                cell = remove_background_arr(raw[y0:y1, cx0:cx1].copy())
                alpha = cell[..., 3] > 8
                labels, ncomp = ndimage.label(alpha, structure=np.ones((3, 3)))
                keep = np.zeros_like(alpha)
                for i in range(1, ncomp + 1):
                    comp = labels == i
                    if comp.sum() >= MIN_AREA:
                        keep |= comp
                ys, xs = np.where(keep)
                if ys.size == 0:
                    print(f"  !! {half}{ri}{ci}: no content found, skipping")
                    continue
                ay0, ay1 = max(0, ys.min() - PAD), min(alpha.shape[0], ys.max() + PAD + 1)
                ax0, ax1 = max(0, xs.min() - PAD), min(alpha.shape[1], xs.max() + PAD + 1)
                sub = cell[ay0:ay1, ax0:ax1].copy()
                sub[~keep[ay0:ay1, ax0:ax1], 3] = 0
                _save_or_report(sub, index, f"{half}{ri}{ci}", report_only)
                index += 1
    return index


def slice_showcase_sheets(report_only, index):
    for sheet_path in SHOWCASE_SHEETS:
        raw = np.array(Image.open(sheet_path).convert("RGBA"))
        arr = remove_background_arr(raw)
        alpha = arr[..., 3] > 8
        labels, ncomp = ndimage.label(alpha, structure=np.ones((3, 3)))

        items = []  # (x0, y0, y1, x0, x1, mask)
        for i in range(1, ncomp + 1):
            mask = labels == i
            ys, xs = np.where(mask)
            if ys.size < 100:
                continue
            y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
            if (y1 - y0 + 1) < SHOWCASE_MIN_ART_H:
                continue  # caption text
            items.append((x0, y0, y1, x0, x1, mask))
        items.sort(key=lambda t: t[0])  # left to right

        name = os.path.splitext(os.path.basename(sheet_path))[0]
        for i, (_, y0, y1, x0, x1, mask) in enumerate(items):
            ay0, ay1 = max(0, y0 - PAD), min(raw.shape[0], y1 + PAD + 1)
            ax0, ax1 = max(0, x0 - PAD), min(raw.shape[1], x1 + PAD + 1)
            sub = arr[ay0:ay1, ax0:ax1].copy()
            sub[~mask[ay0:ay1, ax0:ax1], 3] = 0
            _save_or_report(sub, index, f"{name}_{i}", report_only)
            index += 1
    return index


def main():
    report_only = "--report" in sys.argv
    if not report_only:
        os.makedirs(OUT_DIR, exist_ok=True)

    index = slice_grid_sheet(report_only, 0)
    index = slice_showcase_sheets(report_only, index)

    print(f"{'would write' if report_only else 'wrote'} {index} sprites -> {OUT_DIR}/{SLUG}-0..{index - 1}.png")


if __name__ == "__main__":
    main()
