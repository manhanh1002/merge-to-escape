// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshSave } from '../lib/save.ts'
import { SHOP_ITEMS, SHOP_PERKS, buy, magnetOf, priceOf } from '../lib/shop.ts'

const prices = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8')).economyConfig.shopPrices
const rich = (gold = 100000) => ({ ...freshSave(), gold })

test('the shop sells six stash items and two permanent perks, all priced in the config', () => {
  assert.deepEqual(SHOP_ITEMS, ['hammer', 'purge2', 'purge4', 'heartPotion', 'wallRune', 'undoCharm'])
  assert.deepEqual(SHOP_PERKS, ['goldMagnet', 'itemMagnet'])
  for (const id of [...SHOP_ITEMS, ...SHOP_PERKS]) assert.equal(typeof prices[id], 'number', id)
  assert.ok(prices.itemMagnet > prices.goldMagnet && prices.goldMagnet > prices.hammer, 'item magnet is the priciest')
})

test('buying takes the gold and adds the item to the stash', () => {
  const s = buy({ ...freshSave(), gold: 200 }, 'hammer', prices)
  assert.equal(s.gold, 200 - prices.hammer)
  assert.equal(s.stash.hammer, 1)
  assert.equal(s.purchases.hammer, 1)
})

test('each purchase raises that item\'s next price by 15% (compounded), other items unchanged', () => {
  let s = rich()
  const base = prices.hammer
  assert.equal(priceOf(s, 'hammer', prices), base)
  s = buy(s, 'hammer', prices)
  assert.equal(priceOf(s, 'hammer', prices), Math.round(base * 1.15))
  const before = s.gold
  s = buy(s, 'hammer', prices)
  assert.equal(before - s.gold, Math.round(base * 1.15), 'the second one costs the raised price')
  assert.equal(priceOf(s, 'hammer', prices), Math.round(base * 1.15 ** 2))
  assert.equal(priceOf(s, 'purge2', prices), prices.purge2)
})

test('perks are bought once and switch the loot magnet on', () => {
  let s = rich()
  assert.equal(magnetOf(s.perks), 'none')
  s = buy(s, 'goldMagnet', prices)
  assert.equal(s.perks.goldMagnet, true)
  assert.equal(magnetOf(s.perks), 'gold')
  assert.equal(buy(s, 'goldMagnet', prices), null, 'already owned')
  s = buy(s, 'itemMagnet', prices)
  assert.equal(magnetOf(s.perks), 'all', 'the item magnet also pulls gold')
  assert.equal(s.stash.hammer, 0)
})

test('not enough gold, or an unknown item: nothing happens (null)', () => {
  assert.equal(buy({ ...freshSave(), gold: prices.hammer - 1 }, 'hammer', prices), null)
  assert.equal(buy({ ...freshSave(), gold: 9999 }, 'dragon', prices), null)
  const once = buy(rich(prices.hammer * 2), 'hammer', prices)
  assert.equal(buy({ ...once, gold: prices.hammer }, 'hammer', prices), null, 'the raised price is no longer affordable')
})
