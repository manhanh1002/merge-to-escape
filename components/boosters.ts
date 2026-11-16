// Display data for stash items, shared by the shop and the in-game booster bar.
import type { ShopItem } from '../lib/shop'

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
    blurb: 'Restores one heart in a boss room (up to your maximum).',
    icon: '/assets/icons/loot/green_gourd.png',
  },
}
