// Image paths shared by every screen (exports in public/assets, built by scripts/).
const loot = (name: string) => `/assets/icons/loot/${name}.png`
const craft = (name: string) => `/assets/icons/craft/${name}.png`
const item = (name: string) => `/assets/icons/items/${name}.png`

// CraftPix fantasy icon packs (scripts/import_icon_packs.py) for items and HUD;
// the painted sheets still provide the board art (boulders, scrolls, brand).
export const ART = {
  gold: item('coins_gold'),
  key: item('key'),
  power: item('spellbook_arcane'),
  padlock: item('padlock'),
  medal: item('medal'),
  trophy: item('trophy'),
  hammer: item('hammer'),
  scroll: loot('old_parchment'),
  // The config's "sword" slot is the wizard's weapon: an attack spellbook.
  sword: item('spellbook_fire'),
  armor: item('chest_armor'),
  gauntlet: item('gauntlets'),
  stone: loot('boulder'),
  brand: craft('sapphire_stone'),
  treasureMap: loot('treasure_map'),
  spellbook: item('spellbook_arcane'),
  chest: loot('skull_chest'),
}

/** Bigger gold drops look richer: copper pile, silver pile, gold pile. */
export const goldArt = (amount: number) => item(amount >= 250 ? 'coins_gold' : amount >= 60 ? 'coins_silver' : 'coins_copper')
