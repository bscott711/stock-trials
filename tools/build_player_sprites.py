# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Turn a hand-generated player sprite sheet into game-ready assets.

Usage:
    uv run tools/build_player_sprites.py <sheet.png> version_2/assets/sprites

What it does:
  1. Removes the sheet's solid background via flood-fill from the image
     border (safe against small legitimately-light details fully enclosed
     inside the artwork, unlike a global color threshold - see the
     `remove_background` docstring).
  2. Auto-slices the sheet into connected-component sprites and clusters
     them into rows by vertical position.
  3. Normalizes each frame within the legs/torso/wheel groups onto a
     shared, tightly-padded canvas so every frame in a group has its
     anchor point (hip for legs, hip for torso, center for wheels) at the
     exact same local pixel position - the game code then only needs one
     anchor constant per group instead of per-frame data. (See
     PLAYER_LEG_FRAME_COUNT/etc in js/render/spriteManifest.js and the
     LEG_ANCHOR_*/TORSO_ANCHOR_* constants in js/render/playerSprite.js -
     re-run this script and copy its printed anchor_px values into those
     constants if the source art changes enough to shift them.)
  4. Bakes a global scale (derived from comparing this sheet's wheel size
     to the game's WHEEL_R=30 world-unit constant) into the saved files,
     so the game code needs no separate runtime scale factor.

This assumes the CURRENT FullSprite.png row layout specifically: row 0 is
8 leg-pose frames, row 1 is a full assembled bike+rider reference (used
only for context, not sliced out), row 2 is 8 pedal-pose frames (not yet
wired into the game - no reliable way to auto-detect the crank pivot
across arbitrary rotations), row 3 is 4 torso-pose frames followed by a
second full-assembly reference (only the first 4 are used), and row 4 is
2 wheels. If you generate a differently laid-out sheet, adjust the row
indices in main() below to match.
"""
import os
import sys
import json
import numpy as np
from PIL import Image
from scipy import ndimage

GLOBAL_SCALE = 0.4  # world-units per source-art pixel; see module docstring


def remove_background(path_in, tolerance=14):
    """Flood-fill transparency from the border inward, matching pixels
    within `tolerance` of the sampled corner color. Only background
    regions connected to the border become transparent, so small
    legitimately-light details fully enclosed inside the artwork (a white
    eye highlight, a light patch on a shoe) are left alone - a plain
    global color threshold would erase those too.
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


def slice_sprites(arr, min_area=200, row_gap_frac=0.03):
    alpha = arr[..., 3] > 8
    closed = ndimage.binary_closing(alpha, structure=np.ones((3, 3)), iterations=2)
    labels, n = ndimage.label(closed, structure=np.ones((3, 3)))
    boxes = []
    for i in range(1, n + 1):
        ys, xs = np.where(labels == i)
        if ys.size < min_area:
            continue
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        boxes.append({"y0": int(y0), "y1": int(y1), "x0": int(x0), "x1": int(x1),
                      "cy": (y0 + y1) / 2, "cx": (x0 + x1) / 2})
    boxes.sort(key=lambda b: b["cy"])
    h = arr.shape[0]
    row_gap = h * row_gap_frac
    rows = []
    for b in boxes:
        if rows and (b["cy"] - rows[-1][-1]["cy"]) < row_gap:
            rows[-1].append(b)
        else:
            rows.append([b])
    for row in rows:
        row.sort(key=lambda b: b["cx"])
    return rows


def crop(arr, b, pad=4):
    h, w = arr.shape[:2]
    y0, y1 = max(0, b["y0"] - pad), min(h, b["y1"] + pad + 1)
    x0, x1 = max(0, b["x0"] - pad), min(w, b["x1"] + pad + 1)
    return arr[y0:y1, x0:x1].copy()


def top_anchor(sub):
    """Hip point for a leg frame: the leg-only crop starts right at the
    hip (nothing drawn above it), so the topmost content row's x-centroid
    is a reliable, consistent hip position across every rotation frame.
    """
    alpha = sub[..., 3] > 8
    ys = np.where(alpha.any(axis=1))[0]
    y0 = ys[0]
    band = alpha[y0:y0 + 3, :]
    xs = np.where(band.any(axis=0))[0]
    return float(xs.mean()), float(y0)


def bottom_anchor_excl_hand(sub, right_excl_frac=0.35):
    """Hip/seat point for a torso frame. The single bottommost pixel is
    often the reaching hand/arm (which swings independently pose to pose),
    not the hoodie hem where it actually meets the seat - restricting the
    scan to the left ~65% of the frame avoids chasing that hand.
    """
    alpha = sub[..., 3] > 8
    h, w = alpha.shape
    limit = int(w * (1 - right_excl_frac))
    region = alpha[:, :limit]
    ys = np.where(region.any(axis=1))[0]
    y1 = ys[-1]
    band = region[max(0, y1 - 2):y1 + 1, :]
    xs = np.where(band.any(axis=0))[0]
    return float(xs.mean()), float(y1)


def center_anchor(sub):
    h, w = sub.shape[:2]
    return w / 2.0, h / 2.0


def normalize_group(subs, anchor_fn, pad=6):
    """Paste every frame onto a shared canvas sized so NO frame clips,
    with each frame's own anchor point landing at the same shared pixel
    position (AX, AY) - computed from the group's worst-case extent in
    each direction, not guessed.
    """
    infos = [(sub, *anchor_fn(sub)) for sub in subs]
    left = max(ax for _, ax, ay in infos) + pad
    right = max(sub.shape[1] - ax for sub, ax, ay in infos) + pad
    above = max(ay for _, ax, ay in infos) + pad
    below = max(sub.shape[0] - ay for sub, ax, ay in infos) + pad
    W, H = int(round(left + right)), int(round(above + below))
    AX, AY = int(round(left)), int(round(above))

    outputs = []
    for sub, ax, ay in infos:
        canvas = np.zeros((H, W, 4), dtype=np.uint8)
        ox, oy = int(round(AX - ax)), int(round(AY - ay))
        sh, sw = sub.shape[:2]
        dx0, dy0 = max(0, ox), max(0, oy)
        dx1, dy1 = min(W, ox + sw), min(H, oy + sh)
        sx0, sy0 = dx0 - ox, dy0 - oy
        sx1, sy1 = sx0 + (dx1 - dx0), sy0 + (dy1 - dy0)
        canvas[dy0:dy1, dx0:dx1] = sub[sy0:sy1, sx0:sx1]
        outputs.append(canvas)
    return outputs, (W, H, AX, AY)


def save_scaled(arr, path):
    img = Image.fromarray(arr, "RGBA")
    w, h = img.size
    new_size = (max(1, round(w * GLOBAL_SCALE)), max(1, round(h * GLOBAL_SCALE)))
    img = img.resize(new_size, Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return img.size


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src = sys.argv[1]
    out_root = sys.argv[2]

    arr = remove_background(src)
    rows = slice_sprites(arr)
    print(f"detected {len(rows)} rows: {[len(r) for r in rows]}")

    legs_boxes = rows[0]
    torso_boxes = rows[3][:4]
    wheel_boxes = rows[4]

    legs_subs = [crop(arr, b) for b in legs_boxes]
    torso_subs = [crop(arr, b) for b in torso_boxes]
    wheel_subs = [crop(arr, b) for b in wheel_boxes]

    legs_norm, legs_box = normalize_group(legs_subs, top_anchor)
    torso_norm, torso_box = normalize_group(torso_subs, bottom_anchor_excl_hand)
    wheel_norm, wheel_box = normalize_group(wheel_subs, center_anchor)

    manifest = {}

    for i, im in enumerate(legs_norm):
        save_scaled(im, os.path.join(out_root, "player", f"legs-{i}.png"))
    manifest["legs"] = {
        "count": len(legs_norm),
        "anchor_px": [round(legs_box[2] * GLOBAL_SCALE, 2), round(legs_box[3] * GLOBAL_SCALE, 2)],
    }

    for i, im in enumerate(torso_norm):
        save_scaled(im, os.path.join(out_root, "player", f"torso-{i}.png"))
    manifest["torso"] = {
        "count": len(torso_norm),
        "anchor_px": [round(torso_box[2] * GLOBAL_SCALE, 2), round(torso_box[3] * GLOBAL_SCALE, 2)],
    }

    names = ["wheel-front", "wheel-back"]
    for i, im in enumerate(wheel_norm):
        save_scaled(im, os.path.join(out_root, "player", f"{names[i]}.png"))
    manifest["wheel"] = {"count": len(wheel_norm)}  # exactly centered by construction, no anchor needed

    with open(os.path.join(out_root, "player-build-manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps(manifest, indent=2))
    print("\nCopy the legs/torso anchor_px values above into LEG_ANCHOR_*/"
          "TORSO_ANCHOR_* in js/render/playerSprite.js if they changed.")


if __name__ == "__main__":
    main()
