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

# Bottom-anchored (world.js Tree) sprites get 0 bottom padding - see crop()'s
# pad_bottom docstring for why any padding here becomes a visible gap once
# scaled up to world-unit height. Clutter is center-anchored and keeps
# uniform padding, so it isn't listed here.
TALL_SLUGS = {"pine-tree", "palm-tree", "dead-tree"}

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
    # A plain 2x6 grid, no captions - one row_gap_px bigger than the ~28px
    # gap between the two grid rows merges them into a single 12-item pool
    # (order doesn't matter, sun.js picks one at random per day).
    (f"{SPRITE_ROOT}/sky/sun/spritesheet.png", "sky/sun", 50, [
        ("sun", 12),
    ]),
    # Each cloud type came as two separate sheets (no captions/labels on
    # either) - a single row of 5, and a denser 3x4 grid of 12. Continuing
    # the index via start_index instead of starting both at 0 keeps every
    # variant from both files in the one pool cloud rendering picks from.
    (f"{SPRITE_ROOT}/sky/clouds/cumulus.png", "sky/clouds", 60, [
        ("cumulus", 5, 0),
    ]),
    (f"{SPRITE_ROOT}/sky/clouds/cumulus_pt2.png", "sky/clouds", 40, [
        ("cumulus", 4, 5),
        ("cumulus", 4, 9),
        ("cumulus", 4, 13),
    ]),
    # stratus.png is a loose, non-grid layout (2/1/2 across 3 visual
    # sub-rows) with nothing else on the sheet to accidentally merge with,
    # so a huge row_gap_px just folds every sub-row into one 5-item band.
    (f"{SPRITE_ROOT}/sky/clouds/stratus.png", "sky/clouds", 900, [
        ("stratus", 5, 0),
    ]),
]


def remove_background_arr(arr, tolerance=14):
    """Flood-fill transparency from THIS ARRAY'S OWN border inward, matching
    pixels within `tolerance` of its own border color. Only background
    connected to the array's border becomes transparent, so light details
    fully enclosed inside the artwork are left alone. Operating per-array
    (not just once on the whole sheet) matters for a ruled grid sheet: a
    cell fully enclosed by border lines has no path for a whole-sheet
    flood-fill to reach its interior white background at all, leaving it
    opaque - see slice_grid, which calls this once per cell on just that
    cell's own pixels. Ported from build_player_sprites.py.

    Background color is the MEDIAN of every border pixel, not just the 4
    corners - a grid cell's corner can land right on a ruled border line
    (especially once its inset is nudged to clear other artifacts), and a
    single bad corner poisons a corner-only estimate badly enough that nothing
    reads as background anymore. The median shrugs off a few line/art pixels
    among the hundreds of genuine background pixels around a cell's edge.
    """
    arr = arr.copy()
    rgb = arr[..., :3].astype(np.int16)
    h, w = rgb.shape[:2]
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


def remove_background(path_in, tolerance=14):
    img = Image.open(path_in).convert("RGBA")
    return remove_background_arr(np.array(img), tolerance)


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
    # No binary_closing: it was bridging the few-px gap between a category
    # caption (e.g. "ANGULAR BOULDERS") and the art directly below it into
    # one fused component - since the combined height clears text_max_h,
    # the text was never getting filtered out (baked into mountains/
    # boulder-0.png as visible caption text). Raw 8-connectivity already
    # gives every sheet its correct component count (checked against every
    # row's expected_counts), so nothing here actually needed closing.
    labels, n = ndimage.label(alpha, structure=np.ones((3, 3)))
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


def crop(arr, b, pad=PAD, pad_bottom=None):
    """Crop to bbox+pad, masking out any pixel that isn't part of this
    component/split-half - a plain rectangular crop would pull in slivers
    of a neighboring sprite whenever art gets close to (or, pre-split,
    touches) another item, which happens throughout these dense sheets.

    `pad_bottom` overrides the bottom margin specifically - the game draws
    bottom-anchored sprites (trees) with their exact last pixel row planted
    on the ground, so any padding below the trunk's true base becomes a gap
    between the tree and the grass once the sprite is scaled up to its
    world-unit height (a 6px pad is invisible at a small scale, but reads
    as "floating" once that same 6px is stretched by a large scale factor).
    Center-anchored clutter doesn't have this problem, so it keeps uniform
    padding.
    """
    if pad_bottom is None:
        pad_bottom = pad
    h, w = arr.shape[:2]
    y0, y1 = max(0, b["y0"] - pad), min(h, b["y1"] + pad_bottom + 1)
    x0, x1 = max(0, b["x0"] - pad), min(w, b["x1"] + pad + 1)
    sub = arr[y0:y1, x0:x1].copy()
    mask = b["mask"][y0:y1, x0:x1]
    sub[~mask, 3] = 0
    return sub


# A handful of sheets came as an explicit bordered grid (with a title bar
# and/or a small per-cell number label) rather than a loose contact sheet -
# connected-component labeling would just pick up the border lines and
# labels as extra junk "sprites", so these are sliced by known cell
# geometry instead: explicit (start,end) pixel spans per row and per
# column (even_spans() for a plain grid, hand-measured for one with a
# title bar - see below), inset by (top,right,bottom,left) to clear the
# border/label, then tightly crop whatever ink remains inside that inset.
#
# (sheet path, output dir, row_spans, col_spans, inset, slug, start_index)
def even_spans(total, n, offset=0):
    step = (total - offset) / n
    return [(int(round(offset + i * step)), int(round(offset + (i + 1) * step))) for i in range(n)]


GRID_SHEETS = [
    # 1x4, thin vertical divider lines between cells, no title/labels.
    (f"{SPRITE_ROOT}/sky/clouds/cirrus.png", "sky/clouds",
     even_spans(512, 1), even_spans(2064, 4), (5, 15, 5, 15), "cirrus", 0),
    # 4x3 with a title bar and ruled borders (no per-cell labels). Spans are
    # the exact gridline pixel rows/cols measured from the sheet, NOT
    # even_spans() - the ~50px of slack below the last row (whatever margin
    # the sheet has past the grid before the image edge) would otherwise get
    # divided into every row's height too, so an evenly-computed cell would
    # run ~13px taller than the real one and cross into the next cell's
    # border/content.
    (f"{SPRITE_ROOT}/sky/clouds/cirrus_pt2.png", "sky/clouds",
     [(94, 249), (251, 406), (408, 562), (564, 718)],
     [(43, 484), (486, 921), (922, 1364)],
     (4, 4, 4, 4), "cirrus", 4),
    # 4x3, ruled borders AND a small number label in each cell's top-left -
    # no title bar, and no leftover margin past the grid (confirmed one
    # measured gridline landed exactly on the even-split boundary), so
    # even_spans() is safe here. Generous top/left inset clears both the
    # label and the border.
    (f"{SPRITE_ROOT}/sky/clouds/stratus_pt2.png", "sky/clouds",
     even_spans(848, 4), even_spans(1264, 3), (35, 20, 20, 35), "stratus", 5),
]


def slice_grid(path, row_spans, col_spans, inset, pad=PAD, min_area=150):
    # Background removal happens PER CELL (remove_background_arr on each
    # cell's own pixels), not once for the whole sheet - a cell fully
    # enclosed by ruled border lines has no path for a whole-sheet flood-
    # fill to ever reach its interior white background, leaving it opaque
    # (baked into cirrus/stratus-N.png as a visible white box).
    raw = np.array(Image.open(path).convert("RGBA"))
    inset_top, inset_right, inset_bottom, inset_left = inset

    crops = []
    for ry0, ry1 in row_spans:
        for cx0, cx1 in col_spans:
            y0, y1 = ry0 + inset_top, ry1 - inset_bottom
            x0, x1 = cx0 + inset_left, cx1 - inset_right

            arr = remove_background_arr(raw[y0:y1, x0:x1])
            alpha = arr[..., 3] > 8
            ys, xs = np.where(alpha)
            if ys.size < min_area:
                continue
            ay0, ay1 = max(0, ys.min() - pad), min(alpha.shape[0], ys.max() + pad + 1)
            ax0, ax1 = max(0, xs.min() - pad), min(alpha.shape[1], xs.max() + pad + 1)
            crops.append(arr[ay0:ay1, ax0:ax1].copy())
    return crops


def main():
    report_only = "--report" in sys.argv
    for sheet_path, out_dir, row_gap_px, categories in SHEETS:
        # 3rd element (start_index) is optional - defaults to 0. Sheets that
        # continue a pool another sheet started (e.g. cumulus_pt2.png after
        # cumulus.png) set it so both files' variants land in one
        # contiguous 0..N-1 id run instead of the second overwriting the
        # first's output files.
        categories = [(c[0], c[1], c[2] if len(c) > 2 else 0) for c in categories]
        print(f"\n=== {sheet_path} ===")
        arr = remove_background(sheet_path)
        rows = detect_rows(arr, row_gap_px=row_gap_px, expected_counts=[c[1] for c in categories])
        print(f"detected {len(rows)} art rows: {[len(r) for r in rows]}  "
              f"(expected {[c[1] for c in categories]})")
        if len(rows) != len(categories):
            print("  !! row count mismatch, skipping writes for this sheet - inspect manually")
            continue
        for row, (slug, expected, start_index) in zip(rows, categories):
            if len(row) != expected:
                print(f"  !! {slug}: found {len(row)}, expected {expected} - inspect manually")
            if report_only:
                sizes = [(b["x1"] - b["x0"] + 1, b["y1"] - b["y0"] + 1) for b in row]
                print(f"  {slug}: {len(row)} items, sizes={sizes}")
                continue
            out_subdir = os.path.join("version_2/assets/sprites", out_dir)
            os.makedirs(out_subdir, exist_ok=True)
            pad_bottom = 0 if slug in TALL_SLUGS else None
            for i, b in enumerate(row):
                sub = crop(arr, b, pad_bottom=pad_bottom)
                Image.fromarray(sub, "RGBA").save(os.path.join(out_subdir, f"{slug}-{start_index + i}.png"))
            print(f"  {slug}: wrote {len(row)} -> {out_subdir}/{slug}-{start_index}..{start_index + len(row) - 1}.png")

    for sheet_path, out_dir, row_spans, col_spans, inset, slug, start_index in GRID_SHEETS:
        print(f"\n=== {sheet_path} (grid {len(row_spans)}x{len(col_spans)}) ===")
        crops = slice_grid(sheet_path, row_spans, col_spans, inset)
        expected = len(row_spans) * len(col_spans)
        if len(crops) != expected:
            print(f"  !! found {len(crops)} cells, expected {expected} - inspect manually")
        if report_only:
            print(f"  {slug}: {len(crops)} items, sizes={[im.shape[1::-1] for im in crops]}")
            continue
        out_subdir = os.path.join("version_2/assets/sprites", out_dir)
        os.makedirs(out_subdir, exist_ok=True)
        for i, sub in enumerate(crops):
            Image.fromarray(sub, "RGBA").save(os.path.join(out_subdir, f"{slug}-{start_index + i}.png"))
        print(f"  {slug}: wrote {len(crops)} -> {out_subdir}/{slug}-{start_index}..{start_index + len(crops) - 1}.png")


if __name__ == "__main__":
    main()
