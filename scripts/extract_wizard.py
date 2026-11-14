"""Turn the wizard sprite sheet into game-ready animations.

Source: "2D-Fantasy-Wizards-Sprite-Sheets-4 (1).png" (7 actions x 5 frames on a yellow
gradient). For every frame: locate it from the yellow background, cut it out with rembg,
drop stray detached bits (the flying spell orb is exported separately as an FX sprite),
then place it on one shared square canvas anchored at the feet + robe centre so frames
don't jitter when animated.

Outputs in public/assets/sprites/wizard/:
  frames/<action>_<n>.png   single frames (transparent)
  <action>.png              horizontal sprite strip (for CSS steps() animation)
  <action>.webp             animated WebP with full alpha
  <action>.gif              animated GIF (1-bit alpha, edges matted for dark UIs)
  fx_magic_bolt.png         the spell projectile from the attack row
  manifest.json             frame size, frame count, fps, loop per action

Needs: pip install "rembg[cpu]" pillow numpy scipy
Usage: python scripts/extract_wizard.py [--preview /tmp/dir]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "2D-Fantasy-Wizards-Sprite-Sheets-4 (1).png"
OUT = ROOT / "public" / "assets" / "sprites" / "wizard"
FRAME = 256          # output frame size (square)
LABEL_COLUMN = 1100  # sheet x before which only the action names are painted
MATTE = (22, 21, 42)  # GIF edge matte = game background, avoids yellow/white halos

# Row order on the sheet, with playback settings for each action.
ACTIONS = [
    ("idle", 8, True),
    ("walk", 12, True),
    ("run", 14, True),
    ("jump", 10, False),
    ("attack", 12, False),
    ("hurt", 12, False),
    ("die", 8, False),
]


def background_mask(rgb_img):
    hsv = np.asarray(rgb_img.convert("HSV")).astype(np.float32)
    h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    return (h >= 28) & (h <= 68) & (s > 0.30) & (v > 0.55)


def runs(flags, min_len):
    out, start = [], None
    for i, on in enumerate(flags):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    if start is not None and len(flags) - start >= min_len:
        out.append((start, len(flags)))
    return out


def find_frames(img):
    """Returns rows of frame boxes (x0, y0, x1, y1) plus boxes of detached FX blobs."""
    fg = ~background_mask(img)
    fg[:, :LABEL_COLUMN] = False
    fg = ndi.binary_opening(fg, iterations=2)
    bands = runs(fg.mean(axis=1) > 0.002, 60)
    assert len(bands) == len(ACTIONS), f"expected {len(ACTIONS)} rows, found {len(bands)}"
    rows, fx = [], []
    for y0, y1 in bands:
        lab, n = ndi.label(ndi.binary_dilation(fg[y0:y1], iterations=6))
        sizes = ndi.sum(fg[y0:y1], lab, range(1, n + 1))
        boxes = [(int(sizes[i]), sl) for i, sl in enumerate(ndi.find_objects(lab)) if sizes[i] > 300]
        boxes.sort(key=lambda b: -b[0])
        chars = sorted(boxes[:5], key=lambda b: b[1][1].start)
        for size, sl in boxes[5:]:
            fx.append((sl[1].start, sl[0].start + y0, sl[1].stop, sl[0].stop + y0))
        rows.append([(sl[1].start, sl[0].start + y0, sl[1].stop, sl[0].stop + y0) for _, sl in chars])
    return rows, fx


def cut_out(img, box, session, pad=24):
    x0, y0, x1, y1 = box
    crop = img.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    cut = remove(crop, session=session, post_process_mask=True)
    rgba = np.asarray(cut).copy()
    # Keep only the character plus anything touching it (staff sparks); drop detached blobs.
    # Always applied (even with a single blob) so faint low-alpha haze far from the
    # character is cleared too; it would otherwise inflate the shared canvas.
    solid = rgba[..., 3] > 40
    lab, n = ndi.label(solid)
    if n:
        sizes = ndi.sum(solid, lab, range(1, n + 1))
        main = lab == (int(np.argmax(sizes)) + 1)
        near = ndi.binary_dilation(main, iterations=12)
        keep_labels = set(np.unique(lab[near & solid])) - {0}
        keep = np.isin(lab, list(keep_labels))
        rgba[..., 3] = np.where(ndi.binary_dilation(keep, iterations=2), rgba[..., 3], 0)
    # Kill residual yellow background spill in soft edges.
    sheet_bg = background_mask(Image.fromarray(rgba[..., :3]))
    rgba[..., 3] = np.where(sheet_bg & (rgba[..., 3] < 200), 0, rgba[..., 3])
    return Image.fromarray(rgba)


def anchor_of(frame):
    """(x, y) anchor: horizontal centre of the dark-blue robe, y at the lowest opaque pixel."""
    a = np.asarray(frame).astype(int)
    alpha = a[..., 3] > 128
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    robe = alpha & (b > r + 15) & (np.maximum(np.maximum(r, g), b) < 140)
    ys, xs = np.nonzero(alpha)
    rx = np.nonzero(robe)[1]
    cx = float(rx.mean()) if len(rx) > 500 else float(xs.mean())
    return cx, float(ys.max())


def to_gif_frame(frame):
    """1-bit alpha GIF frame with semi-transparent edges blended onto the game background."""
    a = np.asarray(frame).astype(np.float32)
    alpha = a[..., 3:4] / 255
    rgb = a[..., :3] * alpha + np.array(MATTE, np.float32) * (1 - alpha)
    out = np.concatenate([rgb, np.where(alpha > 0.35, 255, 0)], axis=2).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    pal = im.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    idx = np.asarray(pal).copy()
    idx[out[..., 3] == 0] = 255
    gif = Image.fromarray(idx, "P")
    palette = pal.getpalette()[: 255 * 3] + [0, 0, 0]
    gif.putpalette(palette)
    gif.info["transparency"] = 255
    return gif


def main():
    preview_dir = Path(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
    img = Image.open(SRC).convert("RGB")
    rows, fx_boxes = find_frames(img)
    session = new_session("isnet-general-use")

    cut = [[cut_out(img, box, session) for box in row] for row in rows]
    anchors = [[anchor_of(f) for f in row] for row in cut]

    # One shared canvas for every action so the wizard never changes size between actions.
    left = right = up = 0.0
    for row, arow in zip(cut, anchors):
        for f, (ax, ay) in zip(row, arow):
            ys, xs = np.nonzero(np.asarray(f)[..., 3] > 40)
            left, right = max(left, ax - xs.min()), max(right, xs.max() + 1 - ax)
            up = max(up, ay - ys.min())
    half = max(left, right)
    side = max(2 * half, up) * 1.04
    scale = FRAME / side
    base_y = FRAME - 4  # feet sit just above the bottom edge

    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    manifest = {"frameSize": FRAME, "actions": {}}
    for (name, fps, loop), row, arow in zip(ACTIONS, cut, anchors):
        frames = []
        for i, (f, (ax, ay)) in enumerate(zip(row, arow)):
            w, h = round(f.width * scale), round(f.height * scale)
            small = f.resize((w, h), Image.LANCZOS)
            canvas = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
            canvas.alpha_composite(small, (round(FRAME / 2 - ax * scale), round(base_y - ay * scale)))
            canvas.save(OUT / "frames" / f"{name}_{i + 1}.png", optimize=True)
            frames.append(canvas)
        strip = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
        for i, fr in enumerate(frames):
            strip.alpha_composite(fr, (i * FRAME, 0))
        strip.save(OUT / f"{name}.png", optimize=True)
        duration = round(1000 / fps)
        frames[0].save(OUT / f"{name}.webp", save_all=True, append_images=frames[1:], duration=duration,
                       loop=0, lossless=False, quality=90, method=6, disposal=2)
        gif_frames = [to_gif_frame(fr) for fr in frames]
        gif_frames[0].save(OUT / f"{name}.gif", save_all=True, append_images=gif_frames[1:], duration=duration,
                           loop=0, disposal=2, transparency=255, optimize=False)
        manifest["actions"][name] = {
            "strip": f"/assets/sprites/wizard/{name}.png",
            "webp": f"/assets/sprites/wizard/{name}.webp",
            "gif": f"/assets/sprites/wizard/{name}.gif",
            "frames": len(frames),
            "fps": fps,
            "loop": loop,
        }
        print(f"{name}: {len(frames)} frames")

    # Spell projectile from the attack row (largest detached blob).
    if fx_boxes:
        bolt_box = max(fx_boxes, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        x0, y0, x1, y1 = bolt_box
        bolt = remove(img.crop((x0 - 20, y0 - 20, x1 + 20, y1 + 20)), session=session, post_process_mask=True)
        bolt = bolt.resize((round(bolt.width * scale), round(bolt.height * scale)), Image.LANCZOS)
        bolt.save(OUT / "fx_magic_bolt.png", optimize=True)
        manifest["fx"] = {"magicBolt": "/assets/sprites/wizard/fx_magic_bolt.png"}

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    if preview_dir:
        preview_dir.mkdir(parents=True, exist_ok=True)
        sheet = Image.new("RGBA", (FRAME * 5, FRAME * len(ACTIONS)), MATTE + (255,))
        for r, (name, _, _) in enumerate(ACTIONS):
            strip = Image.open(OUT / f"{name}.png")
            sheet.alpha_composite(strip, (0, r * FRAME))
        sheet.save(preview_dir / "wizard_preview.png")


if __name__ == "__main__":
    main()
