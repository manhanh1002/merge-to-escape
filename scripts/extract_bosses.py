"""Build boss sprite strips from the CraftPix "free top-down boss character 4 direction pack".

The pack already ships transparent PNG sequences (840x720 per frame). This script picks
the actions the game uses, crops every frame of a boss with ONE shared square (so the boss
never shifts or rescales between actions), downsizes to 256px and writes:

  public/assets/sprites/bosses/<boss>/<action>-<dir>.png   horizontal strip
  public/assets/sprites/bosses/<boss>/<action>-<dir>.webp  animated (full alpha)
  public/assets/sprites/bosses/<boss>/<action>-<dir>.gif   animated (edges matted dark)
  public/assets/sprites/bosses/<boss>/dying.{png,webp,gif}
  public/assets/sprites/bosses/manifest.json

Actions: idle (16 frames, every 2nd kept), attack, hurt (10 each) in front/back/left/right,
plus dying (10). License: CraftPix free license (see the pack's license.txt).

Needs: pip install pillow numpy
Usage: python scripts/extract_bosses.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "free-top-down-boss-character-4-direction-pack"
OUT = ROOT / "public" / "assets" / "sprites" / "bosses"
FRAME = 256
MATTE = (22, 21, 42)

BOSSES = {"caveman": "Caveman Boss", "goblin": "Giant Goblin", "viking": "Viking Leader"}
DIRS = {"front": "Front", "back": "Back", "left": "Left", "right": "Right"}
# action -> (pack folder suffix, keep every Nth frame, fps)
ACTIONS = {"idle": ("Idle", 2, 10), "attack": ("Attacking", 1, 18), "hurt": ("Hurt", 1, 18)}
DYING_FPS = 14


def frames_in(folder: Path, step: int = 1):
    files = sorted(folder.glob("*.png"))[::step]
    assert files, f"no frames in {folder}"
    return [Image.open(f).convert("RGBA") for f in files]


def to_gif_frame(frame):
    a = np.asarray(frame).astype(np.float32)
    alpha = a[..., 3:4] / 255
    rgb = a[..., :3] * alpha + np.array(MATTE, np.float32) * (1 - alpha)
    out = np.concatenate([rgb, np.where(alpha > 0.35, 255, 0)], axis=2).astype(np.uint8)
    pal = Image.fromarray(out[..., :3]).quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    idx = np.asarray(pal).copy()
    idx[out[..., 3] == 0] = 255
    gif = Image.fromarray(idx)
    gif.putpalette(pal.getpalette()[: 255 * 3] + [0, 0, 0])
    gif.info["transparency"] = 255
    return gif


def write_anim(frames, path_stem: Path, fps: int, crop):
    tiles = [f.crop(crop).resize((FRAME, FRAME), Image.LANCZOS) for f in frames]
    strip = Image.new("RGBA", (FRAME * len(tiles), FRAME), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        strip.alpha_composite(t, (i * FRAME, 0))
    strip.save(path_stem.with_suffix(".png"), optimize=True)
    duration = round(1000 / fps)
    tiles[0].save(path_stem.with_suffix(".webp"), save_all=True, append_images=tiles[1:], duration=duration,
                  loop=0, quality=88, method=6, disposal=2)
    gifs = [to_gif_frame(t) for t in tiles]
    gifs[0].save(path_stem.with_suffix(".gif"), save_all=True, append_images=gifs[1:], duration=duration,
                 loop=0, disposal=2, transparency=255)
    return len(tiles)


def main():
    manifest = {"frameSize": FRAME, "bosses": {}}
    for key, folder in BOSSES.items():
        seq = PACK / folder / "PNG" / "PNG Sequences"
        clips = {}
        for action, (suffix, step, fps) in ACTIONS.items():
            for d, dname in DIRS.items():
                clips[f"{action}-{d}"] = (frames_in(seq / f"{dname} - {suffix}", step), fps)
        clips["dying"] = (frames_in(seq / "Dying"), DYING_FPS)

        # One square crop that contains every frame of every clip (weapon swings included),
        # centred on the idle body so the boss stands in the middle of its tile.
        boxes = [f.getbbox() for frames, _ in clips.values() for f in frames if f.getbbox()]
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        idle_boxes = [f.getbbox() for f in clips["idle-front"][0]]
        cx = (min(b[0] for b in idle_boxes) + max(b[2] for b in idle_boxes)) / 2
        half = max(cx - x0, x1 - cx, (y1 - y0) / 2) + 6
        bottom = y1 + 6
        crop = (round(cx - half), round(bottom - 2 * half), round(cx + half), round(bottom))

        out = OUT / key
        out.mkdir(parents=True, exist_ok=True)
        entry = {"clips": {}}
        for name, (frames, fps) in clips.items():
            n = write_anim(frames, out / name, fps, crop)
            entry["clips"][name] = {"strip": f"/assets/sprites/bosses/{key}/{name}.png", "frames": n, "fps": fps}
        # How much of the frame the idle body fills, so the game can size the sprite.
        body_h = (max(b[3] for b in idle_boxes) - min(b[1] for b in idle_boxes)) / (2 * half)
        entry["bodyHeight"] = round(body_h, 3)
        manifest["bosses"][key] = entry
        print(f"{key}: {len(clips)} clips, crop {crop}, idle body fills {body_h:.0%} of frame height")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
