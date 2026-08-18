# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy", "opencv-python-headless"]
# ///
"""Turn a short pedaling-loop video into the game's fused rider+bike rig
frames - one whole bike+rider+legs image per pedal-angle bucket, instead of
the separate frame/torso/legs pieces build_player_sprites.py produces.

Why fused: independently-generated body parts (old approach) have no shared
scale or reach between pieces, which is what caused the arm/leg/pedal
mismatches worked around in js/drawbike.js. A whole-rig frame can't have that
problem - whatever the source draws is exactly what renders, every time.
Since this game's pedal_angle and wheel_angle are the same value
(js/drawbike.js computeRig()), one frame per pedal-angle bucket also carries
a correctly-posed wheel for free - no separate rotating wheel sprite needed.

Usage:
    uv run tools/build_player_rig.py <clip.mp4> version_2/assets/sprites/player \
        --frames 0,4,7,11,14,18

What it does:
  1. Extracts the given frame indices from the video.
  2. Removes the plain background via border flood-fill (see
     build_bike_frame.py's remove_background - same idea here).
  3. Finds both wheels in every frame via Hough circle detection, derives one
     shared scale from the median wheelbase across all frames (so poses
     don't jitter in size against each other) and normalizes every frame onto
     a shared canvas with the back wheel hub at the same local pixel
     position in each - the single anchor the whole rig needs.
  4. Saves player/rig-0.png ... rig-N.png (N = len(--frames) - 1) and prints
     RIG_ANCHOR_X/Y to paste into js/render/playerSprite.js.

Picking --frames: use a still, camera-locked span of the source clip (a
tracking shot or one that pans/zooms partway through will throw off the
shared-scale assumption here), covering exactly one full pedal rotation,
evenly spaced. A quick way to find that span: crop each candidate frame to
the crank/pedal area and compare pixel-wise to frame 0 - the lowest-error
non-trivial match is one full revolution later.
"""
import sys
import argparse
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

WHEELBASE_WORLD = 100  # js/drawbike.js WHEELBASE constant


def remove_background(arr, tolerance=18, min_enclosed_area=40, shadow_min_brightness=100, shadow_max_sat=20):
    """Same approach as build_bike_frame.py's remove_background: flood-fill
    background connected to the border, plus enclosed background pockets
    trapped inside closed outlines (gated on size so small light details
    aren't mistaken for background). Then a second pass eats a soft ground-
    contact shadow, which the video source bakes in as a gradient - light
    enough at its own edges to already be border-connected background, but
    shading down to a mid-gray blob in the middle that's too different from
    the sampled corner color for the tolerance above to touch. Grow the
    already-removed region into any neighboring pixel that's both grayscale
    (low saturation, like a shadow) and light (like a shadow, not a tire) -
    real character colors are either saturated (red suit, yellow frame,
    skin) or dark-and-grayscale (black tires), so this can't eat those, and
    it can't reach an enclosed light-grayscale detail (a disc brake rotor)
    without first crossing a saturated or dark boundary it won't grow through.
    """
    rgb = arr[..., :3].astype(np.int16)
    h, w = rgb.shape[:2]
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]], dtype=np.float64)
    bg = corners.mean(axis=0)
    diff = np.abs(rgb - bg).max(axis=-1)
    bg_like = diff <= tolerance
    labels, n = ndimage.label(bg_like, structure=np.ones((3, 3)))
    border_labels = set(labels[0, :].tolist()) | set(labels[-1, :].tolist()) \
        | set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border_labels.discard(0)
    sizes = ndimage.sum(bg_like, labels, range(1, n + 1))
    enclosed = {i + 1 for i, s in enumerate(sizes) if s >= min_enclosed_area}
    remove_labels = border_labels | enclosed
    remove_labels.discard(0)
    remove_mask = np.isin(labels, list(remove_labels))

    saturation = rgb.max(axis=-1) - rgb.min(axis=-1)
    brightness = rgb.min(axis=-1)
    shadow_like = (saturation <= shadow_max_sat) & (brightness >= shadow_min_brightness)
    grown = ndimage.binary_propagation(remove_mask, mask=(remove_mask | shadow_like))
    remove_mask = grown
    arr[remove_mask, 3] = 0
    return arr


def detect_circles(arr):
    gray = cv2.cvtColor(arr[..., :3], cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 1.2)
    circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=1.2, minDist=100,
                                param1=80, param2=40, minRadius=40, maxRadius=200)
    if circles is None:
        raise SystemExit("No circles detected - can't locate the wheels in one of the "
                          "frames. Try adjusting min/maxRadius for this clip's scale.")
    return circles[0]


def find_wheel_pair(circles, expected_dx=None, expected_r=None):
    """Pick the two circles that are the wheels. A locked-off shot of a
    stylized bike+rider has plenty of circular details competing for this
    (helmet, chainring, disc brakes, and arcs Hough fits to body/frame
    outlines) - some coincidentally more level than the real wheels, which
    breaks a pure min-y-difference match, and some survive a spacing check
    too (seen in practice: an arc pair at roughly double the real wheel
    radius, but with a plausible wheelbase-like spacing and near-perfect
    level, outranked the real wheels on dy alone). Once a rough wheelbase
    and wheel radius are known from other frames in the same locked-off
    clip, use both: pick the most-level (smallest dy) pair from those whose
    spacing AND radii are actually plausible, rather than the most-level
    pair overall. Falls back to pure min-dy when no expectation is available
    yet (first pass).
    """
    candidates = []
    for i in range(len(circles)):
        for j in range(i + 1, len(circles)):
            dy = abs(circles[i][1] - circles[j][1])
            dx = abs(circles[i][0] - circles[j][0])
            candidates.append((dy, dx, circles[i], circles[j]))
    if expected_dx is not None:
        plausible = [c for c in candidates if abs(c[1] - expected_dx) < 0.25 * expected_dx]
        if plausible:
            candidates = plausible
    if expected_r is not None:
        plausible = [c for c in candidates
                     if abs(c[2][2] - expected_r) < 0.35 * expected_r
                     and abs(c[3][2] - expected_r) < 0.35 * expected_r]
        if plausible:
            candidates = plausible
    dy, dx, a, b = min(candidates, key=lambda c: c[0])
    a, b = (a, b) if a[0] < b[0] else (b, a)  # a = back (left), b = front (right)
    return a, b  # each is (cx, cy, r)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('out_root')
    parser.add_argument('--frames', required=True, help='comma-separated frame indices, e.g. 0,4,7,11,14,18')
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

    all_circles = [detect_circles(a) for a in raw]

    # Pass 1: naive per-frame guess (no expectation yet) to get a rough
    # wheelbase and wheel radius, robust to the occasional bad frame via the
    # median (a false-positive pair is never the majority across frames).
    rough_wheels = [find_wheel_pair(c) for c in all_circles]
    rough_dx = float(np.median([f[0] - b[0] for b, f in rough_wheels]))
    rough_r = float(np.median([r for b, f in rough_wheels for r in (b[2], f[2])]))

    # Pass 2: re-pick every frame's pair using that expectation, so a frame
    # whose naive guess was a false-positive pair gets corrected too.
    wheels = [find_wheel_pair(c, expected_dx=rough_dx, expected_r=rough_r) for c in all_circles]
    px_wheelbases = [f[0] - b[0] for b, f in wheels]
    scale = WHEELBASE_WORLD / float(np.median(px_wheelbases))
    print(f"px wheelbases={[round(w,1) for w in px_wheelbases]} -> shared scale={scale:.4f}")
    if max(px_wheelbases) - min(px_wheelbases) > 0.1 * np.median(px_wheelbases):
        print("WARNING: wheelbase varies >10% across frames - camera framing "
              "may not be as locked-off as assumed, or a wheel pair is still "
              "mis-detected. Check the output frames before wiring them in.")

    # Crop each frame to its alpha bounding box (+ padding), tracking the
    # back-wheel-hub position in the cropped frame's local coordinates.
    pad = 6
    crops, anchors = [], []
    for a, (back, front) in zip(raw, wheels):
        alpha = a[..., 3] > 8
        ys, xs = np.where(alpha)
        y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1)
        x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)
        crops.append(a[y0:y1, x0:x1])
        anchors.append((back[0] - x0, back[1] - y0))

    # Normalize onto one shared canvas so every frame's back-wheel-hub lands
    # at the same local pixel position (same trick as build_player_sprites.py
    # normalize_group, anchored on the hub instead of a hip heuristic).
    left = max(ax for ax, ay in anchors) + pad
    right = max(c.shape[1] - ax for c, (ax, ay) in zip(crops, anchors)) + pad
    above = max(ay for ax, ay in anchors) + pad
    below = max(c.shape[0] - ay for c, (ax, ay) in zip(crops, anchors)) + pad
    W, H = int(round(left + right)), int(round(above + below))
    AX, AY = int(round(left)), int(round(above))

    for i, (c, (ax, ay)) in enumerate(zip(crops, anchors)):
        canvas = np.zeros((H, W, 4), dtype=np.uint8)
        ox, oy = int(round(AX - ax)), int(round(AY - ay))
        ch, cw = c.shape[:2]
        dx0, dy0 = max(0, ox), max(0, oy)
        dx1, dy1 = min(W, ox + cw), min(H, oy + ch)
        sx0, sy0 = dx0 - ox, dy0 - oy
        sx1, sy1 = sx0 + (dx1 - dx0), sy0 + (dy1 - dy0)
        canvas[dy0:dy1, dx0:dx1] = c[sy0:sy1, sx0:sx1]

        img = Image.fromarray(canvas, 'RGBA')
        new_size = (max(1, round(W * scale)), max(1, round(H * scale)))
        img = img.resize(new_size, Image.LANCZOS)
        img.save(f"{args.out_root}/rig-{i}.png")

    anchor_x, anchor_y = AX * scale, AY * scale
    print(f"wrote {len(crops)} frames, size={new_size}")
    print(f"\nRIG_FRAME_COUNT = {len(crops)};")
    print(f"RIG_ANCHOR_X = {anchor_x:.2f};")
    print(f"RIG_ANCHOR_Y = {anchor_y:.2f};")
    print("-> paste into js/render/playerSprite.js")


if __name__ == "__main__":
    main()
