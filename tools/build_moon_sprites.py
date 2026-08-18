# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy", "opencv-python-headless"]
# ///
"""Extract the 8 lunar-phase frames from a locked-off moon-phase video
(assets/sprites/moon/moonpt1.mp4) into the game's moon sprite frames, in
PROMPTS.md's Moon phase order: new, waxing crescent, first quarter, waxing
gibbous, full, waning gibbous, last quarter, waning crescent.

Same idea as tools/build_player_rig.py (video -> frames -> background
removal -> shared-canvas normalization) but much simpler: no wheel
detection or scale derivation is needed since the moon's outer silhouette
is the same size circle in every phase - only the lit/unlit split inside
it changes - so frames just need center-anchored normalization.

Usage:
    uv run tools/build_moon_sprites.py <clip.mp4> version_2/assets/sprites/sky/moon \
        --frames 0,30,60,90,120,150,180,210

--frames picking: this clip runs one full cycle new->full->new over its
whole length on an even pace (confirmed by sampling every 10th frame and
checking the phase progresses monotonically and symmetrically around the
full-moon midpoint), so 8 evenly-spaced indices land close to the 8 named
phases. For a different clip, sample frames across the whole length first
and eyeball where each phase actually falls instead of assuming even
spacing.
"""
import os
import sys
import argparse
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage


def remove_background(arr, tolerance=14):
    """Flood-fill transparency from the border inward, matching pixels
    within `tolerance` of the sampled corner color. Ported from
    build_scenery_sprites.py - this clip's background is a flat, shadow-
    free light grey on every frame, so the simple border flood-fill is
    enough (no need for build_player_rig.py's extra shadow-eating pass,
    which exists for a live-action ground-contact shadow this clip
    doesn't have).
    """
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('out_root')
    parser.add_argument('--frames', required=True, help='comma-separated frame indices, e.g. 0,30,60,90,120,150,180,210')
    parser.add_argument('--pad', type=int, default=6)
    args = parser.parse_args()

    frame_idx = [int(x) for x in args.frames.split(',')]

    cap = cv2.VideoCapture(args.video)
    raw = []
    for i in frame_idx:
        cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, bgr = cap.read()
        if not ok:
            raise SystemExit(f"couldn't read frame {i}")
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        arr = np.dstack([rgb, np.full(rgb.shape[:2], 255, dtype=np.uint8)])
        raw.append(remove_background(arr))
    cap.release()

    # Crop each frame to its own alpha bbox + pad, tracking its own center
    # (not a detected feature like the player rig's wheel hub - the moon
    # disc has no natural off-center anchor, so geometric center is right).
    pad = args.pad
    crops, centers = [], []
    for a in raw:
        alpha = a[..., 3] > 8
        ys, xs = np.where(alpha)
        y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1)
        x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)
        crop = a[y0:y1, x0:x1]
        crops.append(crop)
        centers.append((crop.shape[1] / 2.0, crop.shape[0] / 2.0))

    # Normalize onto one shared canvas, every frame's own center landing at
    # the same shared pixel position - guards against a stray pixel of
    # flood-fill noise shifting one frame's bbox by a pixel or two; the
    # frames should already be nearly identical in size since the moon's
    # silhouette doesn't change across phases.
    left = max(cx for cx, cy in centers) + pad
    right = max(c.shape[1] - cx for c, (cx, cy) in zip(crops, centers)) + pad
    above = max(cy for cx, cy in centers) + pad
    below = max(c.shape[0] - cy for c, (cx, cy) in zip(crops, centers)) + pad
    W, H = int(round(left + right)), int(round(above + below))
    AX, AY = int(round(left)), int(round(above))

    os.makedirs(args.out_root, exist_ok=True)
    for i, (c, (cx, cy)) in enumerate(zip(crops, centers)):
        canvas = np.zeros((H, W, 4), dtype=np.uint8)
        ox, oy = int(round(AX - cx)), int(round(AY - cy))
        ch, cw = c.shape[:2]
        dx0, dy0 = max(0, ox), max(0, oy)
        dx1, dy1 = min(W, ox + cw), min(H, oy + ch)
        sx0, sy0 = dx0 - ox, dy0 - oy
        sx1, sy1 = sx0 + (dx1 - dx0), sy0 + (dy1 - dy0)
        canvas[dy0:dy1, dx0:dx1] = c[sy0:sy1, sx0:sx1]

        Image.fromarray(canvas, 'RGBA').save(os.path.join(args.out_root, f"moon-{i}.png"))

    print(f"wrote {len(crops)} frames, size={(W, H)} -> {args.out_root}/moon-0..{len(crops)-1}.png")


if __name__ == "__main__":
    main()
