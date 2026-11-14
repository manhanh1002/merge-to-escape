"""Cut the two icon sheets into individual transparent PNG assets.

For each sheet: detect the 10x5 grid of icon tiles from the flat sheet background,
crop every tile, remove the tile's painted background (dark + coloured glow) with
rembg, trim to the object, pad to a square and save under public/assets/icons/<set>/.

Needs: pip install "rembg[cpu]" pillow numpy   (run inside a venv)
Usage: python scripts/extract_icons.py [--preview /tmp/preview_dir]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "icons"

# Row-major names, 10 per row, matching what is painted on each tile.
SHEETS = {
    "craft": {
        "file": "RPG-Craft-Resources-Game-Icons-Pack2.png",
        "names": [
            "wood_logs", "wood_log", "rough_planks", "wood_planks", "red_wood_planks",
            "pale_wood_plank", "golden_planks", "red_wood_board", "golden_roots", "golden_shavings",
            "iron_ore", "stone_pile", "copper_ore", "gold_ore", "ruby_ore",
            "amethyst_stone", "blue_crystal", "sandstone", "tin_ore", "sapphire_stone",
            "amethyst_ingot", "copper_ingot", "silver_ingot", "gold_ingot", "sapphire_crystals",
            "green_scales", "olive_hide", "hide_strips", "beast_hide", "red_scale",
            "leather_roll", "leather_hide", "golden_fur", "white_fur", "rope",
            "orange_cloth", "silk_cloth", "thread_spool", "green_cloth_roll", "herb_fibers",
            "feather", "yarn_ball", "cotton", "wooden_gear", "water_bowl",
            "metal_plates", "nails", "gold_powder", "sand_pile", "bone",
        ],
    },
    "loot": {
        "file": "RPG-Kobold-Loot-Icons2.png",
        "names": [
            "backpack", "pickaxe", "emerald_ore_rock", "stew_cauldron", "green_gourd",
            "skull_chest", "goblin_claw", "goblin_ear", "leather_collar", "fossil_stone",
            "emerald_shard", "geode_rocks", "skeleton_remains", "amulet", "treasure_map",
            "leather_pouch", "bone_bundle", "ragged_shirt", "rat_tail", "old_parchment",
            "amber_rock_shard", "gem_sack", "sapphire_ring", "rune_stone", "amber_nuggets",
            "plumed_helmet", "waterskin", "spellbook", "shadow_fang", "gold_nugget",
            "candle", "burlap_cloth", "rock_pile", "gold_bars", "pearl_ore",
            "skull", "magic_staff", "shovel", "skeleton_hand", "coin_string",
            "magic_orb", "skeleton_king_hoard", "ore_crate", "magma_stone", "torch",
            "leather_bracer", "gold_ring", "skull_treasure_pile", "boulder", "cloth_sack",
        ],
    },
}


# Icons whose background removal fails (object lost, or background glow kept), checked
# by eye on the preview sheets. They are skipped instead of being exported broken.
SKIP = {
    "craft": {"amethyst_ingot", "copper_ingot", "silk_cloth", "thread_spool", "herb_fibers", "feather"},
    "loot": {
        "backpack", "geode_rocks", "skeleton_remains", "bone_bundle", "amber_rock_shard", "gem_sack",
        "sapphire_ring", "spellbook", "burlap_cloth", "rock_pile", "magic_staff", "magic_orb",
        "skeleton_king_hoard", "ore_crate", "gold_ring", "skull_treasure_pile",
    },
}


def runs(profile, threshold, min_gap=3):
    """Contiguous index ranges where profile > threshold; tiny gaps are bridged."""
    out, start = [], None
    for i, on in enumerate(profile > threshold):
        if on and start is None:
            start = i
        elif not on and start is not None:
            out.append([start, i])
            start = None
    if start is not None:
        out.append([start, len(profile)])
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [r for r in merged if r[1] - r[0] > 20]


def detect_grid(img):
    a = np.asarray(img.convert("RGB")).astype(int)
    border = np.concatenate([a[:5].reshape(-1, 3), a[-5:].reshape(-1, 3), a[:, :5].reshape(-1, 3), a[:, -5:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    mask = np.abs(a - bg).max(axis=2) > 14
    cols = runs(mask.mean(axis=0), 0.3)
    rows = runs(mask.mean(axis=1), 0.3)
    return rows, cols


def trim_and_square(icon, margin_ratio=0.06):
    alpha = np.asarray(icon.getchannel("A"))
    ys, xs = np.nonzero(alpha > 8)
    if not len(xs):
        return icon
    obj = icon.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = int(max(obj.size) * (1 + 2 * margin_ratio))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2), obj)
    return canvas


def main():
    preview_dir = Path(sys.argv[sys.argv.index("--preview") + 1]) if "--preview" in sys.argv else None
    session = new_session("isnet-general-use")
    manifest = {}
    for set_name, sheet in SHEETS.items():
        img = Image.open(ROOT / sheet["file"]).convert("RGBA")
        rows, cols = detect_grid(img)
        assert len(rows) == 5 and len(cols) == 10, f"{set_name}: expected 5x10 grid, got {len(rows)}x{len(cols)}"
        out_dir = OUT / set_name
        out_dir.mkdir(parents=True, exist_ok=True)
        icons = []
        for r, (y0, y1) in enumerate(rows):
            for c, (x0, x1) in enumerate(cols):
                name = sheet["names"][r * 10 + c]
                if name in SKIP[set_name]:
                    continue
                tile = img.crop((x0, y0, x1, y1))
                cut = remove(tile, session=session, post_process_mask=True)
                icon = trim_and_square(cut)
                icon.save(out_dir / f"{name}.png", optimize=True)
                icons.append(icon)
                manifest.setdefault(set_name, []).append({"name": name, "file": f"/assets/icons/{set_name}/{name}.png", "size": icon.width})
        print(f"{set_name}: {len(icons)} icons -> {out_dir.relative_to(ROOT)}")
        if preview_dir:
            preview_dir.mkdir(parents=True, exist_ok=True)
            cell = 140
            sheet_img = Image.new("RGBA", (cell * 10, cell * 5))
            # checkerboard so transparency is visible
            for y in range(0, sheet_img.height, 10):
                for x in range(0, sheet_img.width, 10):
                    shade = 205 if (x // 10 + y // 10) % 2 else 245
                    sheet_img.paste((shade, shade, shade, 255), (x, y, x + 10, y + 10))
            for i, icon in enumerate(icons):
                thumb = icon.copy()
                thumb.thumbnail((cell - 8, cell - 8), Image.LANCZOS)
                x, y = (i % 10) * cell + (cell - thumb.width) // 2, (i // 10) * cell + (cell - thumb.height) // 2
                sheet_img.alpha_composite(thumb, (x, y))
            sheet_img.save(preview_dir / f"{set_name}_preview.png")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
