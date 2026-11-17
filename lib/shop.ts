// Shop (pure): gold buys consumables for the permanent stash, and permanent perks.
// Every purchase raises that entry's next price by `PRICE_STEP` (15%).
import { PERK_IDS, STASH_ITEMS, type Perks, type SaveData, type Stash } from './save.ts'
import type { Magnet } from './game-logic'

export type ShopItem = keyof Stash
export type PerkId = keyof Perks
export type ShopEntry = ShopItem | PerkId
export const SHOP_ITEMS: ShopItem[] = STASH_ITEMS
export const SHOP_PERKS: PerkId[] = PERK_IDS
export type ShopPrices = Record<ShopEntry, number>

/** Each purchase of an entry makes its next one this much more expensive. */
export const PRICE_STEP = 0.15

const isEntry = (id: string): id is ShopEntry => (SHOP_ITEMS as string[]).includes(id) || (SHOP_PERKS as string[]).includes(id)
const isPerk = (id: ShopEntry): id is PerkId => (SHOP_PERKS as string[]).includes(id)

/** Current price: the base price raised 15% (compounded) per earlier purchase. */
export function priceOf(save: SaveData, id: ShopEntry, prices: Partial<ShopPrices>): number | undefined {
  const base = prices[id]
  if (base === undefined) return undefined
  return Math.round(base * (1 + PRICE_STEP) ** (save.purchases[id] ?? 0))
}

/** Buys one item or perk; returns the new save, or null if it is unknown, already owned
 *  (perks) or not affordable. */
export function buy(save: SaveData, id: string, prices: Partial<ShopPrices>): SaveData | null {
  if (!isEntry(id)) return null
  const price = priceOf(save, id, prices)
  if (price === undefined || save.gold < price) return null
  if (isPerk(id) && save.perks[id]) return null
  const purchases = { ...save.purchases, [id]: (save.purchases[id] ?? 0) + 1 }
  const paid = { ...save, gold: save.gold - price, purchases }
  return isPerk(id)
    ? { ...paid, perks: { ...save.perks, [id]: true } }
    : { ...paid, stash: { ...save.stash, [id]: save.stash[id] + 1 } }
}

/** The loot magnet a save has: the item magnet also pulls gold. */
export const magnetOf = (perks: Perks): Magnet => (perks.itemMagnet ? 'all' : perks.goldMagnet ? 'gold' : 'none')
