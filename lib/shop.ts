// Shop (plan 9.7, pure): gold buys consumables that go into the permanent stash.
import { STASH_ITEMS, type SaveData, type Stash } from './save.ts'

export type ShopItem = keyof Stash
export const SHOP_ITEMS: ShopItem[] = STASH_ITEMS
export type ShopPrices = Record<ShopItem, number>

/** Buys one `item`; returns the new save, or null if it is unknown or not affordable. */
export function buy(save: SaveData, item: string, prices: Partial<ShopPrices>): SaveData | null {
  if (!(SHOP_ITEMS as string[]).includes(item)) return null
  const key = item as ShopItem
  const price = prices[key]
  if (price === undefined || save.gold < price) return null
  return { ...save, gold: save.gold - price, stash: { ...save.stash, [key]: save.stash[key] + 1 } }
}
