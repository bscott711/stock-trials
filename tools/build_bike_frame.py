# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "scipy", "opencv-python-headless"]
# ///
"""Turn a full bike-frame reference image (drawn WITH wheels, since that's
how they render naturally) into a game-ready frame-only sprite.

Usage:
    uv run tools/build_bike_frame.py <bike.png> version_2/assets/sprites/player/frame.png

What it does:
  1. Removes the source image's solid background via flood-fill from the
     border (see build_player_sprites.py's `remove_background` for why
     that's safer than a global color threshold).
  2. Finds the two wheels via a Hough circle transform (color-based
     connected-component detection doesn't work here - the frame's own
     dark paint touches and fuses with the wheels, since a bike frame and
     a tire are both "dark", so shape-based circle detection is what
     actually separates them).
  3. Derives a scale factor from the detected wheelbase (pixel distance
     between wheel centers) vs. the game's WHEELBASE=100 world-unit
     constant (js/drawbike.js), so this works regardless of the source
     image's resolution or the character's apparent size in it.
  4. Masks out both wheel discs (they're redundant - the game already has
     separately-rotating wheel-front/back.png sprites; keeping this
     image's own static wheels would either double them up or, since
     frame is drawn on top, hide the spinning ones entirely).
  5. Saves the frame at the derived scale, and prints the back-wheel-hub
     anchor point (in final scaled pixels) to paste into
     FRAME_ANCHOR_X/Y in js/render/playerSprite.js - that's the point the
     game aligns to rig.back_wheel_x/y so the two wheel sprites land in
     the holes this script cut.
"""
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage

WHEELBASE_WORLD = 100  # js/drawbike.js WHEELBASE constant


def remove_background(arr, tolerance=14, min_enclosed_area=40):
    """Border-connected background is the obvious case. But a bike frame's
    main triangle is a closed loop of dark outline with background-colored
    pixels trapped inside it - those never touch the image border, so a
    flood-fill from the border alone leaves them opaque (this bit a real
    run: the frame rendered with a solid white triangle behind it in-game).
    Clear those too, gated on size so a genuinely small enclosed light
    detail (an eye highlight, a bolt glint) isn't mistaken for a background
    pocket and erased.
    """
    rgb = arr[..., :3].astype(np.int16)
    h, w = rgb.shape[:2]
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]], dtype=np.float64)
    bg = corners.mean(axis=0)
    diff = np.abs(rgb - bg).max(axis=-1)
    bg_like = diff <= tolerance
    labels, n = ndimage.label(bg_like, structure=np.ones((3, 3)))
    sizes = ndimage.sum(bg_like, labels, range(1, n + 1))
    keep = {i + 1 for i, s in enumerate(sizes) if s >= min_enclosed_area}
    remove_mask = np.isin(labels, list(keep))
    arr[remove_mask, 3] = 0
    return arr


def find_wheel_pair(arr):
    gray = cv2.cvtColor(arr[..., :3], cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 1.2)
    circles = cv2.HoughCircles(gray, cv2.HOUGH_GRADIENT, dp=1.2, minDist=100,
                                param1=80, param2=40, minRadius=40, maxRadius=140)
    if circles is None:
        raise SystemExit("No circles detected - can't locate the wheels. "
                          "Try adjusting min/maxRadius for this image's scale.")
    circles = circles[0]
    # Real wheels sit on the same ground line; pick whichever pair of
    # detected circles has the closest y (rejects false positives like the
    # handlebar loop, which sits much higher).
    best = None
    for i in range(len(circles)):
        for j in range(i + 1, len(circles)):
            dy = abs(circles[i][1] - circles[j][1])
            if best is None or dy < best[0]:
                best = (dy, circles[i], circles[j])
    _, a, b = best
    a, b = (a, b) if a[0] < b[0] else (b, a)  # a = back (left), b = front (right)
    return a, b  # each is (cx, cy, r)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, out_path = sys.argv[1], sys.argv[2]

    arr = np.array(Image.open(src).convert("RGBA"))
    arr = remove_background(arr)

    back, front = find_wheel_pair(arr)
    print(f"back wheel:  center=({back[0]:.1f},{back[1]:.1f}) r={back[2]:.1f}")
    print(f"front wheel: center=({front[0]:.1f},{front[1]:.1f}) r={front[2]:.1f}")

    px_wheelbase = front[0] - back[0]
    scale = WHEELBASE_WORLD / px_wheelbase
    print(f"px wheelbase={px_wheelbase:.1f} -> scale={scale:.4f} world-units/px")

    yy, xx = np.mgrid[0:arr.shape[0], 0:arr.shape[1]]
    for cx, cy, r in (back, front):
        dist2 = (xx - cx) ** 2 + (yy - cy) ** 2
        arr[dist2 <= (r * 1.08) ** 2, 3] = 0

    img = Image.fromarray(arr, "RGBA")
    w, h = img.size
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    img.save(out_path)

    anchor_x = back[0] * scale
    anchor_y = back[1] * scale
    print(f"wrote {out_path} size={img.size}")
    print(f"\nFRAME_ANCHOR_X = {anchor_x:.2f};")
    print(f"FRAME_ANCHOR_Y = {anchor_y:.2f};")
    print("-> paste these into js/render/playerSprite.js")


if __name__ == "__main__":
    main()
