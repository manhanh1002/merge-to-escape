// Display data for stash items, shared by the shop and the in-game booster bar.
import type { PerkId, ShopItem } from '../lib/shop'

export const BOOSTERS: Record<ShopItem, { name: string; short: string; blurb: string; icon: string; badge?: string }> = {
  hammer: {
    name: 'Dungeon Hammer',
    short: 'Hammer',
    blurb: 'Smash one stone or numbered stone that blocks your path.',
    icon: '/assets/icons/items/hammer.png',
  },
  purge2: {
    name: 'Purge Scroll [2]',
    short: 'Purge 2',
    blurb: 'Clears every 2 tile from the board at once.',
    icon: '/assets/icons/loot/old_parchment.png',
    badge: '2',
  },
  purge4: {
    name: 'Purge Scroll [4]',
    short: 'Purge 4',
    blurb: 'Clears every 4 tile from the board at once.',
    icon: '/assets/icons/loot/old_parchment.png',
    badge: '4',
  },
  heartPotion: {
    name: 'Heart Potion',
    short: 'Potion',
    blurb: 'Restores one heart (up to your maximum).',
    icon: '/assets/icons/loot/green_gourd.png',
  },
  wallRune: {
    name: 'Rune of Passage',
    short: 'Rune',
    blurb: 'Dissolves one magic wall line for the rest of the chamber.',
    icon: '/assets/icons/loot/rune_stone.png',
  },
  undoCharm: {
    name: 'Amulet of Rewind',
    short: 'Rewind',
    blurb: 'One extra Undo once the 3 free Undos of a chamber are used up.',
    icon: '/assets/icons/loot/amulet.png',
  },
}

/** Items used from the booster bar (the amulet is spent by the Undo button instead). */
export const BOOSTER_BAR: ShopItem[] = ['hammer', 'purge2', 'purge4', 'heartPotion', 'wallRune']

/** Permanent perks sold once in the shop. */
export const PERKS: Record<PerkId, { name: string; blurb: string; icon: string }> = {
  goldMagnet: {
    name: 'Gilded Lodestone',
    blurb: 'Permanent: after every move the wizard pulls in gold from the 8 cells around him.',
    icon: '/assets/icons/loot/gold_nugget.png',
  },
  itemMagnet: {
    name: 'Arcane Lodestone',
    blurb: 'Permanent: pulls in every item (gold, keys, gear, tomes) from the 8 cells around him.',
    icon: '/assets/icons/loot/emerald_shard.png',
  },
}
