// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rollGift } from '../lib/game-logic.ts'
import { earlyGoldFade, levelEconomy } from '../lib/economy.ts'

const base = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8')).economyConfig
const until = base.earlyGoldBoost.untilLevel
const goldChance = (eco, value) => {
  const rule = eco.goldDropRules.filter((r) => value >= r.minTile).sort((a, b) => b.minTile - a.minTile)[0]
  return rule ? rule.dropRate : 0
}

test('fade: full at level 1, shrinking each level, gone after untilLevel', () => {
  assert.equal(earlyGoldFade(1, until), 1)
  assert.ok(earlyGoldFade(until, until) > 0)
  assert.equal(earlyGoldFade(until + 1, until), 0)
  for (let id = 2; id <= until; id++) assert.ok(earlyGoldFade(id, until) < earlyGoldFade(id - 1, until))
})

test('early levels: small merges can drop gold and every gold chance is higher', () => {
  const eco = levelEconomy(base, 1)
  assert.ok(goldChance(eco, 4) > 0 && goldChance(eco, 8) > 0)
  assert.equal(goldChance(base, 8), 0)
  for (const v of [16, 32, 64, 512]) assert.ok(goldChance(eco, v) > goldChance(base, v))
  // the rule lookup in rollGift picks the boosted 8-rule
  const gift = rollGift(8, eco, () => 0, false, false) // a regular level: no tomes
  assert.equal(gift?.type, 'gold')
})

test('after the boost window the economy is exactly the base one', () => {
  assert.equal(levelEconomy(base, until + 1), base)
  assert.equal(levelEconomy(base, 80), base)
})

test('the boost never mutates the base economy and caps chances at 100%', () => {
  const before = JSON.stringify(base)
  const eco = levelEconomy({ ...base, earlyGoldBoost: { ...base.earlyGoldBoost, extraDropRate: 5 } }, 1)
  assert.equal(JSON.stringify(base), before)
  assert.ok(eco.goldDropRules.every((r) => r.dropRate <= 1))
})

test('later levels get less of a boost than earlier ones', () => {
  assert.ok(goldChance(levelEconomy(base, 15), 8) < goldChance(levelEconomy(base, 2), 8))
})
