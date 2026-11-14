"""Import the CraftPix fantasy icon packs (already transparent, 512px) as game assets.

Packs (in the project root):
  free-game-icons-of-fantasy-things-pack-15/PNG/1..10.png
  Free-Game-Icons-of-Fantasy-Knight-Armor-Pack-11/PNG/1..10.png
  daggers 2/PNG/daggers (1..10).png
  free-50-rpg-book-icons/PNG/without background/<n>.png   (attack spellbooks only)

Each icon is trimmed to its content, padded to a square and saved at 256px to
public/assets/icons/items/<name>.png, plus a manifest.json.

Needs: pip install pillow
Usage: python scripts/import_icon_packs.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "icons" / "items"
SIZE = 256

PACKS = [
    ("free-game-icons-of-fantasy-things-pack-15/PNG/{n}.png", [
        "coins_copper", "coins_silver", "coins_gold", "trophy", "key",
        "padlock", "medal", "clover", "anvil", "hammer",
    ]),
    ("Free-Game-Icons-of-Fantasy-Knight-Armor-Pack-11/PNG/{n}.png", [
        "helmet", "helmet_plumed", "chest_armor", "chest_armor_royal", "tasset",
        "tasset_royal", "gauntlets", "gauntlets_royal", "greaves", "greaves_royal",
    ]),
    ("daggers 2/PNG/daggers ({n}).png", [
        "dagger_steel", "dagger_frost", "dagger_jade", "dagger_crescent", "dagger_golden",
        "dagger_thorn", "dagger_leaf", "dagger_twin_amethyst", "dagger_flame", "dagger_flame_curved",
    ]),
    # The wizard fights with magic, so his "weapons" are attack spellbooks (by pack number).
    ("free-50-rpg-book-icons/PNG/without background/{n}.png", {
        14: "spellbook_water", 15: "spellbook_arcane", 16: "spellbook_radiant", 17: "spellbook_ice",
        18: "spellbook_fire", 27: "tome_fire", 28: "tome_wind", 29: "tome_storm",
    }),
]


def square(icon: Image.Image, margin=0.04) -> Image.Image:
    box = icon.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    obj = icon.crop(box) if box else icon
    side = int(max(obj.size) * (1 + 2 * margin))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(obj, ((side - obj.width) // 2, (side - obj.height) // 2), obj)
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for pattern, names in PACKS:
        numbered = names.items() if isinstance(names, dict) else enumerate(names, start=1)
        for i, name in numbered:
            src = ROOT / pattern.format(n=i)
            square(Image.open(src).convert("RGBA")).save(OUT / f"{name}.png", optimize=True)
            manifest[name] = f"/assets/icons/items/{name}.png"
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{len(manifest)} icons -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
