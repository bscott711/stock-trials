# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Slice assets/sprites/hazards/puddles.png (a clean 3x4 grid, no captions,
one puddle style per cell) into individual hazard-puddle sprites at the path
js/render/spriteManifest.js expects (hazards/puddle-0.png .. puddle-11.png).

Unlike barricades/more_variations.png (see build_barricade_sprites.py),
this sheet's gutters ARE clean and every cell is the same size, so it's a
plain fixed-grid slice - no column-ink-valley bookkeeping needed. Row/col
spans below are measured once from the sheet's actual background gutters,
same as build_scenery_sprites.py's GRID_SHEETS entries. Each cell is
background-removed and tightly cropped to whatever ink survives inside it
(remove_background_arr, ported from build_scenery_sprites.py).

Usage:
    uv run tools/build_puddle_sprites.py --report   # detect + print only
    uv run tools/build_puddle_sprites.py             # detect + write PNGs
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SHEET = "version_2/assets/sprites/hazards/puddles.png"
OUT_DIR = "version_2/assets/sprites/hazards"
SLUG = "puddle"
PAD = 6
MIN_AREA = 150

ROW_SPANS = [(21, 190), (211, 413), (427, 577)]
COL_SPANS = [(19, 477), (498, 934), (966, 1310), (1371, 1698)]


def remove_background_arr(arr, tolerance=14):
    """Flood-fill transparency in from THIS ARRAY'S OWN border. Ported from
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


def main():
    report_only = "--report" in sys.argv
    raw = np.array(Image.open(SHEET).convert("RGBA"))

    if not report_only:
        os.makedirs(OUT_DIR, exist_ok=True)

    index = 0
    for y0, y1 in ROW_SPANS:
        for x0, x1 in COL_SPANS:
            cell = remove_background_arr(raw[y0:y1, x0:x1].copy())
            alpha = cell[..., 3] > 8
            labels, ncomp = ndimage.label(alpha, structure=np.ones((3, 3)))
            keep = np.zeros_like(alpha)
            for i in range(1, ncomp + 1):
                comp = labels == i
                if comp.sum() >= MIN_AREA:
                    keep |= comp
            ys, xs = np.where(keep)
            if ys.size == 0:
                print(f"  !! cell at ({x0},{y0}): no content found, skipping")
                continue
            ay0, ay1 = max(0, ys.min() - PAD), min(alpha.shape[0], ys.max() + PAD + 1)
            ax0, ax1 = max(0, xs.min() - PAD), min(alpha.shape[1], xs.max() + PAD + 1)
            sub = cell[ay0:ay1, ax0:ax1].copy()
            sub[~keep[ay0:ay1, ax0:ax1], 3] = 0
            if report_only:
                print(f"  {SLUG}-{index}: {sub.shape[1]}x{sub.shape[0]}")
            else:
                Image.fromarray(sub).save(f"{OUT_DIR}/{SLUG}-{index}.png")
            index += 1

    print(f"{'would write' if report_only else 'wrote'} {index} sprites -> {OUT_DIR}/{SLUG}-0..{index - 1}.png")


if __name__ == "__main__":
    main()
