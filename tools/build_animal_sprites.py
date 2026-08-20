# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Slice the foreground-depth-animal contact sheets
(assets/sprites/animals/{woods,beach,mountains,fields}.png) into individual
sprites at the paths js/render/spriteManifest.js expects
(<biome>/<kind>-0.png .. <kind>-N.png).

Same two sheet shapes build_scenery_sprites.py already handles, and this
ports its core helpers (remove_background_arr, detect_rows, split_wide,
crop, even_spans) rather than importing them - these are standalone `uv run`
scripts with no shared package, so every sibling tool duplicates instead of
importing (see build_barricade_sprites.py's own note on this).

woods.png and beach.png are LOOSE contact sheets - a title caption per
species, then a free-scattered row (or, for fox/crab, two sub-rows) of
illustrations with no ruled borders. detect_rows' connected-component +
text-height filter handles these directly, same as the biome scenery sheets.

fields.png and mountains.png are RULED GRIDS instead (a bordered box per
cell) - like build_scenery_sprites.py's GRID_SHEETS, sliced by known cell
geometry (row_spans/col_spans measured directly off each sheet's border
lines, not even_spans(), since the two species blocks in EACH sheet use
slightly different column counts/positions). Unlike cirrus/stratus's grid
cells, fields.png's captions are baked INSIDE each cell (above the art, not
cleared by a fixed inset - a 1-line caption and this sheet's one 2-line
caption ("RABBIT 6: alert Sitting, Different Colors") don't share a height,
so no single inset clears both without also eating into the art below it).
slice_grid here therefore ALSO runs the same text-height component filter
detect_rows uses, scoped to one cell, rather than trusting inset alone -
mountains.png's captions sit outside/below each grid box already (like
cirrus/stratus's corner labels), so the filter is a no-op there but costs
nothing to also apply.

Usage:
    uv run tools/build_animal_sprites.py --report   # detect + print only
    uv run tools/build_animal_sprites.py             # detect + write PNGs
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

SPRITE_ROOT = "version_2/assets/sprites"
SHEET_ROOT = f"{SPRITE_ROOT}/animals"
TEXT_MAX_H = 45  # tallest caption/number glyph row is well under this; every animal is well over it
PAD = 6

# (sheet path, out_dir, row_gap_px) -> rows top-to-bottom as (slug, expected_count)
SHEETS = [
    # Title, "DEER VARIATIONS" caption, one loose row of 6; "FOX VARIATIONS"
    # caption, two loose sub-rows (5 + 3) merged into one band by row_gap_px,
    # same "8 hay bales laid out 3x3ish" treatment build_scenery_sprites.py
    # already relies on for fields/spritesheet.png.
    (f"{SHEET_ROOT}/woods.png", "woods", 70, [
        ("deer", 6),
        ("fox", 8),
    ]),
    # "SEAGULL VARIATIONS", one loose row of 6 (some pairs sit close/
    # touching - split_wide's fuse-repair handles it via expected_counts,
    # same mechanism driftwood already needed). "CRAB VARIATIONS", two loose
    # sub-rows (4 + 3, one crab perched on a small sand mound whose shape
    # stays attached to that crab's own component either way).
    (f"{SHEET_ROOT}/beach.png", "beach", 70, [
        ("seagull", 6),
        ("crab", 7),
    ]),
]


def even_spans(total, n, offset=0):
    step = (total - offset) / n
    return [(int(round(offset + i * step)), int(round(offset + (i + 1) * step))) for i in range(n)]


# (sheet path, out_dir, row_spans, col_spans, inset, slug, start_index)
# Spans are the measured gridline pixel rows/cols (found by scanning for
# rows/columns that are >50% near-black - the ruled border lines - see the
# module docstring), NOT even_spans(): each sheet's two species blocks don't
# share identical column geometry, and mountains.png's two blocks aren't
# even the same row-height (title text between them isn't part of the grid).
GRID_SHEETS = [
    (f"{SHEET_ROOT}/fields.png", "fields",
     [(106, 393)], [(28, 211), (211, 396), (396, 583), (583, 772), (772, 956), (956, 1139)],
     (8, 8, 8, 8), "rabbit", 0),
    (f"{SHEET_ROOT}/fields.png", "fields",
     [(452, 666), (666, 883)], [(28, 299), (299, 583), (583, 868), (868, 1139)],
     (8, 8, 8, 8), "sheep", 0),
    (f"{SHEET_ROOT}/mountains.png", "mountains",
     [(168, 416)], [(44, 250), (250, 440), (440, 631), (631, 825), (825, 1013), (1013, 1218)],
     (6, 6, 6, 6), "goat", 0),
    (f"{SHEET_ROOT}/mountains.png", "mountains",
     [(600, 783)], [(44, 250), (250, 448), (448, 631), (631, 828), (828, 1013), (1013, 1218)],
     (6, 6, 6, 6), "marmot", 0),
]


def remove_background_arr(arr, tolerance=14):
    """Flood-fill transparency from THIS ARRAY'S OWN border inward - ported
    from build_scenery_sprites.py, see its own docstring for why per-array
    (not whole-sheet) and median-of-border (not corners-only) matter."""
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
    """Ported unchanged from build_scenery_sprites.py - see its docstring."""
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


def label_components(alpha, text_max_h=TEXT_MAX_H, min_area=150):
    """Connected-component label an alpha mask, dropping caption/number text
    (anything shorter than text_max_h) - the shared filter both detect_rows
    (whole sheet) and slice_grid (one cell at a time) apply."""
    labels, n = ndimage.label(alpha, structure=np.ones((3, 3)))
    boxes = []
    for i in range(1, n + 1):
        mask = labels == i
        ys, xs = np.where(mask)
        if ys.size < min_area:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        if (y1 - y0 + 1) <= text_max_h:
            continue  # caption/number text - discard
        boxes.append({"mask": mask, "y0": int(y0), "y1": int(y1), "x0": int(x0), "x1": int(x1)})
    return boxes


def detect_rows(arr, text_max_h=TEXT_MAX_H, min_area=150, row_gap_px=60, expected_counts=None):
    alpha = arr[..., 3] > 8
    boxes = label_components(alpha, text_max_h, min_area)
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
                for _ in range(deficit):
                    row.sort(key=lambda b: (b["x1"] - b["x0"] + 1), reverse=True)
                    widest = row[0]
                    if (widest["x1"] - widest["x0"] + 1) < median_w * 1.4:
                        break
                    row.pop(0)
                    row.extend(split_wide(widest["mask"], widest, 2))

    for row in rows:
        row.sort(key=lambda b: (b["y0"], b["x0"]))
    return rows


def crop(arr, b, pad=PAD):
    h, w = arr.shape[:2]
    y0, y1 = max(0, b["y0"] - pad), min(h, b["y1"] + pad + 1)
    x0, x1 = max(0, b["x0"] - pad), min(w, b["x1"] + pad + 1)
    sub = arr[y0:y1, x0:x1].copy()
    mask = b["mask"][y0:y1, x0:x1]
    sub[~mask, 3] = 0
    return sub


def slice_grid(path, row_spans, col_spans, inset, pad=PAD, min_area=150):
    """Ported from build_scenery_sprites.py, with one addition: within each
    cell, drop any component shorter than TEXT_MAX_H before taking the
    surviving-ink bbox (see module docstring - fields.png bakes captions
    inside the cell above the art, at a height inset alone can't reliably
    clear). A no-op for grids whose only in-cell text is already outside the
    inset (mountains.png), so this stays safe to apply everywhere."""
    raw = np.array(Image.open(path).convert("RGBA"))
    inset_top, inset_right, inset_bottom, inset_left = inset

    crops = []
    for ry0, ry1 in row_spans:
        for cx0, cx1 in col_spans:
            y0, y1 = ry0 + inset_top, ry1 - inset_bottom
            x0, x1 = cx0 + inset_left, cx1 - inset_right

            arr = remove_background_arr(raw[y0:y1, x0:x1])
            alpha = arr[..., 3] > 8
            boxes = label_components(alpha, TEXT_MAX_H, min_area)
            if not boxes:
                continue
            # Multiple surviving art components in one cell (e.g. a crab
            # plus the separate sand-mound patch it's perched on) belong to
            # the same sprite - union them rather than keeping only the
            # largest, same reasoning build_barricade_sprites.py's PASS 1
            # documents for a design's disjoint parts.
            mask = np.zeros_like(alpha)
            for b in boxes:
                mask |= b["mask"]
            ys, xs = np.where(mask)
            ay0, ay1 = max(0, ys.min() - pad), min(mask.shape[0], ys.max() + pad + 1)
            ax0, ax1 = max(0, xs.min() - pad), min(mask.shape[1], xs.max() + pad + 1)
            sub = arr[ay0:ay1, ax0:ax1].copy()
            sub[~mask[ay0:ay1, ax0:ax1], 3] = 0
            crops.append(sub)
    return crops


def main():
    report_only = "--report" in sys.argv
    for sheet_path, out_dir, row_gap_px, categories in SHEETS:
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
            for i, b in enumerate(row):
                sub = crop(arr, b)
                Image.fromarray(sub, "RGBA").save(os.path.join(out_subdir, f"{slug}-{start_index + i}.png"))
            print(f"  {slug}: wrote {len(row)} -> {out_subdir}/{slug}-{start_index}..{start_index + len(row) - 1}.png")

    for sheet_path, out_dir, row_spans, col_spans, inset, slug, start_index in GRID_SHEETS:
        print(f"\n=== {sheet_path} :: {slug} (grid {len(row_spans)}x{len(col_spans)}) ===")
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
