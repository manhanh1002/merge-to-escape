// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshSave } from '../lib/save.ts'
import { SHOP_ITEMS, buy } from '../lib/shop.ts'

const prices = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8')).economyConfig.shopPrices

test('the shop sells the five stash items at the config prices', () => {
  assert.deepEqual(SHOP_ITEMS, ['hammer', 'purge2', 'purge4', 'heartPotion', 'wallRune'])
  assert.deepEqual(prices, { hammer: 75, purge2: 100, purge4: 150, heartPotion: 120, wallRune: 120 })
})

test('buying takes the gold and adds the item to the stash', () => {
  const s = buy({ ...freshSave(), gold: 200 }, 'hammer', prices)
  assert.equal(s.gold, 125)
  assert.equal(s.stash.hammer, 1)
  const t = buy(s, 'purge2', prices)
  assert.equal(t.gold, 25)
  assert.deepEqual(t.stash, { hammer: 1, purge2: 1, purge4: 0, heartPotion: 0, wallRune: 0 })
})

test('not enough gold, or an unknown item: nothing happens (null)', () => {
  assert.equal(buy({ ...freshSave(), gold: 74 }, 'hammer', prices), null)
  assert.equal(buy({ ...freshSave(), gold: 9999 }, 'dragon', prices), null)
})
