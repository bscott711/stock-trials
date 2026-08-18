# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Slice the hand-made scenery contact sheets (assets/sprites/{trees,beach,
mountain,fields}/spritesheet.png) into individual transparent-background
sprites and write them at the paths js/render/spriteManifest.js expects.

Each sheet is a labelled contact sheet: a title, then for each object type a
category caption ("PINE TREES"), a row of style-variant illustrations, and a
row of A/B/C... letters under them. Background is a near-white flat fill
(see PROMPTS.md), not real transparency.

Approach:
  1. Flood-fill transparency in from the sheet border (remove_background,
     ported from build_player_sprites.py's version of the same function).
  2. Connected-component label the result, drop anything shorter than
     TEXT_MAX_H - this sheet's caption/letter text tops out well under that
     (all glyph rows), while every hand-drawn object is taller, so height
     alone cleanly separates art from text without needing to know where
     the text sits.
  3. Merge surviving components into row BANDS by y-interval overlap/
     proximity (detect_rows), not by a single aligned point - items in one
     category may share a baseline (trees standing on a shelf) or scatter
     across several sub-rows of a grid (8 hay bales laid out 3x3ish), so
     center/bottom alignment alone isn't reliable, but every sheet leaves a
     bigger y-gap between categories than within one category's sub-rows.
     Each row band is then assigned to the next (slug, count) pair in that
     sheet's config, top to bottom, matching PROMPTS.md's table order.
  4. If a row is short of its expected count, its widest component(s) are
     probably >1 sprite whose art visually touched and got fused by
     connected-component labeling (driftwood branches do this constantly) -
     split_wide cuts that component's own mask (not just its bbox) at its
     internal ink valleys, so a fused pair becomes two clean pieces.
  5. Every crop is masked to its own component/split-half, not just bbox-
     sliced - a plain rectangular crop pulls in slivers of whatever
     neighboring sprite happens to sit inside that rectangle, which is
     common across these dense sheets. Saved as `<slug>-<i>.png`.

Usage:
    uv run tools/build_scenery_sprites.py --report   # detect + print only
    uv run tools/build_scenery_sprites.py             # detect + write PNGs
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SPRITE_ROOT = "version_2/assets/sprites"
TEXT_MAX_H = 45  # tallest caption/letter glyph row is well under this; every object is well over it
PAD = 6

# (sheet path, output dir, row_gap_px) -> rows top-to-bottom as (slug, expected_count)
# row_gap_px is the y-gap that separates one category's row-band from the
# next; it varies per sheet because some sheets pack categories much closer
# together than others (see detect_rows' docstring comment).
SHEETS = [
    (f"{SPRITE_ROOT}/trees/spritesheet.png", "woods", 60, [
        ("pine-tree", 5),
        ("fallen-log", 6),
    ]),
    (f"{SPRITE_ROOT}/beach/spritesheet.png", "beach", 60, [
        ("palm-tree", 5),
        ("driftwood", 5),
        ("beach-umbrella", 5),
    ]),
    (f"{SPRITE_ROOT}/mountain/spritesheet.png", "mountains", 4, [
        ("dead-tree", 5),
        ("boulder", 5),
        ("snow-patch", 5),
    ]),
    (f"{SPRITE_ROOT}/fields/spritesheet.png", "fields", 60, [
        ("hay-bale", 8),
        ("wildflower-clump", 6),
        ("fence-post", 6),
    ]),
]


def remove_background(path_in, tolerance=14):
    """Flood-fill transparency from the border inward, matching pixels
    within `tolerance` of the sampled corner color. Only background
    connected to the border becomes transparent, so light details fully
    enclosed inside the artwork are left alone. Ported from
    build_player_sprites.py.
    """
    img = Image.open(path_in).convert("RGBA")
    arr = np.array(img)
    rgb = arr[..., :3].astype(np.int16)
    h, w = rgb.shape[:2]
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]], dtype=np.float64)
    bg = corners.mean(axis=0)
    diff = np.abs(rgb - bg).max(axis=-1)
    bg_like = diff <= tolerance
    labels, _ = ndimage.label(bg_like, structure=np.ones((3, 3)))
    border_labels = set(labels[0, :].tolist()) | set(labels[-1, :].tolist()) \
        | set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border_labels.discard(0)
    remove_mask = np.isin(labels, list(border_labels))
    arr[remove_mask, 3] = 0
    return arr


def split_wide(mask, b, target_parts):
    """A component wider than expected is almost certainly >1 sprite whose
    branches/silhouettes touch (e.g. two driftwood pieces overlapping) and
    got fused by connected-component labeling. Split its OWN mask (not just
    its bbox rectangle) at internal vertical "valleys" - the columns with
    the least ink - into `target_parts` pieces, so each piece's saved crop
    only ever contains its own pixels even if a neighboring sprite's art
    physically extends into the same bbox rectangle (driftwood branches do
    this to each other constantly).
    """
    x0, x1 = b["x0"], b["x1"]
    col_ink = mask[b["y0"]:b["y1"] + 1, x0:x1 + 1].sum(axis=0)
    width = x1 - x0 + 1
    parts = []
    part_w = width / target_parts
    prev_cut = 0
    for k in range(1, target_parts):
        center = int(round(k * part_w))
        lo, hi = max(1, center - part_w // 3), min(width - 1, center + part_w // 3)
        if lo >= hi:
            cut = center
        else:
            window = col_ink[int(lo):int(hi)]
            cut = int(lo) + int(np.argmin(window))
        parts.append((prev_cut, cut))
        prev_cut = cut
    parts.append((prev_cut, width))

    out = []
    for lo, hi in parts:
        part_mask = np.zeros_like(mask)
        part_mask[:, x0 + lo:x0 + hi] = mask[:, x0 + lo:x0 + hi]
        ys, xs = np.where(part_mask)
        if ys.size == 0:
            continue
        out.append({
            "mask": part_mask,
            "y0": int(ys.min()), "y1": int(ys.max()),
            "x0": int(xs.min()), "x1": int(xs.max()),
        })
    return out


def detect_rows(arr, text_max_h=TEXT_MAX_H, min_area=150, row_gap_px=60, expected_counts=None):
    alpha = arr[..., 3] > 8
    closed = ndimage.binary_closing(alpha, structure=np.ones((3, 3)), iterations=2)
    labels, n = ndimage.label(closed, structure=np.ones((3, 3)))
    boxes = []
    for i in range(1, n + 1):
        mask = labels == i
        ys, xs = np.where(mask)
        if ys.size < min_area:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        if (y1 - y0 + 1) <= text_max_h:
            continue  # caption/letter text - discard
        boxes.append({"mask": mask, "y0": int(y0), "y1": int(y1), "x0": int(x0), "x1": int(x1)})
    # Merge into row BANDS by y-interval overlap/proximity, not by a single
    # aligned edge - within one category, items may be baseline-aligned
    # (trees standing on a shared ground line) or scattered across several
    # sub-rows of a grid (e.g. 8 hay bales laid out 3x3ish), so no single
    # point (center, bottom) is consistently shared. A gap between a box's
    # top and the current band's bottom-so-far bigger than row_gap_px means
    # a new category has started; this repo's sheets all leave a much
    # bigger gap between categories (~110-140px) than within one category's
    # sub-rows (~45-60px), so a mid-range threshold separates them cleanly.
    boxes.sort(key=lambda b: b["y0"])
    rows = []
    band_end = None
    for b in boxes:
        if rows and b["y0"] <= band_end + row_gap_px:
            rows[-1].append(b)
            band_end = max(band_end, b["y1"])
        else:
            rows.append([b])
            band_end = b["y1"]

    if expected_counts:
        for row, expected in zip(rows, expected_counts):
            if len(row) < expected:
                deficit = expected - len(row)
                widths = sorted((b["x1"] - b["x0"] + 1 for b in row), reverse=True)
                median_w = widths[len(widths) // 2]
                # Fuse-repair: split the widest component(s) - the ones most
                # likely to be >1 sprite whose art visually touched - until
                # the row's count matches what we expect from the sheet.
                for _ in range(deficit):
                    row.sort(key=lambda b: (b["x1"] - b["x0"] + 1), reverse=True)
                    widest = row[0]
                    if (widest["x1"] - widest["x0"] + 1) < median_w * 1.4:
                        break  # nothing left that looks like a merge
                    row.pop(0)
                    row.extend(split_wide(widest["mask"], widest, 2))

    for row in rows:
        row.sort(key=lambda b: (b["y0"], b["x0"]))
    return rows


def crop(arr, b, pad=PAD):
    """Crop to bbox+pad, masking out any pixel that isn't part of this
    component/split-half - a plain rectangular crop would pull in slivers
    of a neighboring sprite whenever art gets close to (or, pre-split,
    touches) another item, which happens throughout these dense sheets.
    """
    h, w = arr.shape[:2]
    y0, y1 = max(0, b["y0"] - pad), min(h, b["y1"] + pad + 1)
    x0, x1 = max(0, b["x0"] - pad), min(w, b["x1"] + pad + 1)
    sub = arr[y0:y1, x0:x1].copy()
    mask = b["mask"][y0:y1, x0:x1]
    sub[~mask, 3] = 0
    return sub


def main():
    report_only = "--report" in sys.argv
    for sheet_path, out_dir, row_gap_px, categories in SHEETS:
        print(f"\n=== {sheet_path} ===")
        arr = remove_background(sheet_path)
        rows = detect_rows(arr, row_gap_px=row_gap_px, expected_counts=[c for _, c in categories])
        print(f"detected {len(rows)} art rows: {[len(r) for r in rows]}  "
              f"(expected {[c for _, c in categories]})")
        if len(rows) != len(categories):
            print("  !! row count mismatch, skipping writes for this sheet - inspect manually")
            continue
        for row, (slug, expected) in zip(rows, categories):
            if len(row) != expected:
                print(f"  !! {slug}: found {len(row)}, expected {expected} - inspect manually")
            if report_only:
                sizes = [(b["x1"] - b["x0"] + 1, b["y1"] - b["y0"] + 1) for b in row]
                print(f"  {slug}: {len(row)} items, sizes={sizes}")
                continue
            out_subdir = os.path.join("version_2/assets/sprites", out_dir)
            os.makedirs(out_subdir, exist_ok=True)
            for i, b in enumerate(row):
                sub = crop(arr, b)
                Image.fromarray(sub, "RGBA").save(os.path.join(out_subdir, f"{slug}-{i}.png"))
            print(f"  {slug}: wrote {len(row)} -> {out_subdir}/{slug}-N.png")


if __name__ == "__main__":
    main()
