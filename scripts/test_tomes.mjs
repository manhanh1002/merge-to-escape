// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { TOME_TIERS, nextTome, tomeFor } from '../lib/tomes.ts'
import { describeTalent } from '../lib/talents.ts'

const cfg = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8')).economyConfig.talentTreeConfig
const per = cfg.statsBonusPerLevel.basePower

test('no Power wields the plainest tome; max Arcane Might reaches the top tier', () => {
  assert.equal(tomeFor(0).name, 'Worn Tome')
  assert.equal(tomeFor(cfg.maxLevel * per), TOME_TIERS.at(-1))
})

test('tiers switch exactly at their thresholds and never go down as Power grows', () => {
  for (const t of TOME_TIERS) {
    assert.equal(tomeFor(t.minPower), t)
    if (t.minPower > 0) assert.notEqual(tomeFor(t.minPower - 1), t)
  }
  let last = -1
  for (let p = 0; p <= 400; p += 5) {
    const i = TOME_TIERS.indexOf(tomeFor(p))
    assert.ok(i >= last); last = i
  }
})

test('every tier is reachable with whole Arcane Might levels and has its icon file', () => {
  const reachable = new Set(Array.from({ length: cfg.maxLevel + 1 }, (_, lv) => tomeFor(lv * per)))
  assert.equal(reachable.size, TOME_TIERS.length)
  for (const t of TOME_TIERS) assert.ok(existsSync(new URL(`../public/assets/icons/items/${t.icon}.png`, import.meta.url)), t.icon)
})

test('odd Power values fall back to the first tier', () => {
  assert.equal(tomeFor(-10), TOME_TIERS[0])
  assert.equal(tomeFor(NaN), TOME_TIERS[0])
  assert.equal(nextTome(NaN), TOME_TIERS[1])
  assert.equal(nextTome(cfg.maxLevel * per), null)
})

test('Arcane Might description names the tome its Power brings', () => {
  assert.match(describeTalent('basePower', 2, cfg).now, /\+20% tome damage .*Ember Tome/)
  assert.match(describeTalent('basePower', 13, cfg).next, /Phoenix Grimoire/)
})
