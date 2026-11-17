// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshSave } from '../lib/save.ts'
import {
  TALENT_IDS, canUpgrade, effectiveEconomy, refundAll, startingRun, talentLevel, upgrade, upgradeCost,
} from '../lib/talents.ts'

const config = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8'))
const economy = config.economyConfig
const cfg = economy.talentTreeConfig
const withStars = (stars, talents = {}) => ({ ...freshSave(), stars, talents })

test('there are exactly five talent branches, keyRate replaced by bonusHearts', () => {
  assert.deepEqual(TALENT_IDS, ['goldRate', 'weaponRate', 'basePower', 'bonusHearts', 'weaponBonusPower'])
})

test('cost: going to level L costs L stars; one branch to Lv 14 costs 105', () => {
  assert.equal(upgradeCost(0), 1)
  assert.equal(upgradeCost(13), 14)
  assert.equal(Array.from({ length: 14 }, (_, l) => upgradeCost(l)).reduce((a, b) => a + b, 0), 105)
})

test('upgrade spends stars and raises the level; all five to Lv 14 costs 525', () => {
  let s = withStars(525)
  for (const id of TALENT_IDS) for (let l = 0; l < 14; l++) s = upgrade(s, id, cfg)
  assert.equal(s.stars, 0)
  for (const id of TALENT_IDS) assert.equal(talentLevel(s, id), 14)
})

test('cannot upgrade without enough stars or past the max level', () => {
  const poor = withStars(2, { goldRate: 2 }) // next level costs 3
  assert.equal(canUpgrade(poor, 'goldRate', cfg), false)
  assert.equal(upgrade(poor, 'goldRate', cfg), poor, 'unchanged')
  const maxed = withStars(100, { basePower: 14 })
  assert.equal(canUpgrade(maxed, 'basePower', cfg), false)
  assert.equal(upgrade(maxed, 'basePower', cfg), maxed)
  assert.equal(canUpgrade(withStars(1), 'basePower', cfg), true)
})

test('refundAll gives back every star spent and resets all levels', () => {
  const s = refundAll(withStars(4, { goldRate: 3, basePower: 2 })) // 6 + 3 spent
  assert.equal(s.stars, 13)
  assert.deepEqual(s.talents, {})
})

test('goldRate Lv 5 adds +10% to every gold drop rate (capped at 100%)', () => {
  const e = effectiveEconomy(economy, { goldRate: 5 }, cfg)
  economy.goldDropRules.forEach((r, i) => assert.ok(Math.abs(e.goldDropRules[i].dropRate - (r.dropRate + 0.1)) < 1e-9))
  const capped = effectiveEconomy({ ...economy, goldDropRules: [{ minTile: 16, gold: 10, dropRate: 0.97 }] }, { goldRate: 5 }, cfg)
  assert.equal(capped.goldDropRules[0].dropRate, 1)
})

test('weaponRate Lv 4 adds +6% to tome/armor/gauntlet drops and half that (+3%) to the boss tome drop', () => {
  const e = effectiveEconomy(economy, { weaponRate: 4 }, cfg)
  for (const type of ['sword', 'armor', 'gauntlet']) {
    assert.ok(Math.abs(e.itemDropRates[type].dropRate - (economy.itemDropRates[type].dropRate + 0.06)) < 1e-9, type)
  }
  assert.ok(Math.abs(e.bossTomeDrop.dropRate - (economy.bossTomeDrop.dropRate + 0.03)) < 1e-9)
  assert.equal(e.itemDropRates.key.dropRate, economy.itemDropRates.key.dropRate, 'keys untouched')
})

test('effectiveEconomy with no talents changes nothing and never mutates the base config', () => {
  const before = JSON.stringify(economy)
  assert.deepEqual(effectiveEconomy(economy, {}, cfg), economy)
  effectiveEconomy(economy, { goldRate: 14, weaponRate: 14 }, cfg)
  assert.equal(JSON.stringify(economy), before)
})

test('startingRun: basePower gives 10 Power (+10% tome damage) per level; bonusHearts +1 heart at Lv 5, 10, 14', () => {
  assert.deepEqual(startingRun({ basePower: 3 }, cfg), { power: 30, hearts: 3, armor: 0 })
  assert.equal(startingRun({ bonusHearts: 4 }, cfg).hearts, 3)
  assert.equal(startingRun({ bonusHearts: 5 }, cfg).hearts, 4)
  assert.equal(startingRun({ bonusHearts: 10 }, cfg).hearts, 5)
  assert.equal(startingRun({ bonusHearts: 14 }, cfg).hearts, 6)
})

test('Gear Mastery (weaponBonusPower) gives 1 / 2 / 3 starting armor at Lv 5 / 10 / 14', () => {
  assert.equal(startingRun({ weaponBonusPower: 4 }, cfg).armor, 0)
  assert.equal(startingRun({ weaponBonusPower: 5 }, cfg).armor, 1)
  assert.equal(startingRun({ weaponBonusPower: 10 }, cfg).armor, 2)
  assert.equal(startingRun({ weaponBonusPower: 14 }, cfg).armor, 3)
})

test('describeTalent: names and current -> next effect text for every branch', async () => {
  const { describeTalent } = await import('../lib/talents.ts')
  assert.deepEqual(describeTalent('goldRate', 0, cfg), { name: 'Golden Touch', now: 'No bonus yet', next: '+2% gold drop chance' })
  assert.deepEqual(describeTalent('goldRate', 5, cfg), { name: 'Golden Touch', now: '+10% gold drop chance', next: '+12% gold drop chance' })
  assert.equal(describeTalent('weaponRate', 4, cfg).now, '+6% tome & gear drop chance')
  assert.equal(describeTalent('weaponRate', 1, cfg).now, '+1.5% tome & gear drop chance', 'no rounding up to 2%')
  assert.equal(describeTalent('basePower', 3, cfg).now, '+30% tome damage · Ember Tome')
  assert.deepEqual(describeTalent('weaponBonusPower', 0, cfg), { name: 'Gear Mastery', now: 'No starting armor yet', next: '1 starting armor at Lv 5' })
  assert.equal(describeTalent('weaponBonusPower', 9, cfg).next, 'Start each chamber with 2 armor')
  assert.equal(describeTalent('weaponBonusPower', 10, cfg).now, 'Start each chamber with 2 armor')
  assert.equal(describeTalent('weaponBonusPower', 14, cfg).next, null, 'maxed: no next level')
})

test('describeTalent: hearts only change at Lv 5 / 10 / 14', async () => {
  const { describeTalent } = await import('../lib/talents.ts')
  assert.deepEqual(describeTalent('bonusHearts', 0, cfg), { name: 'Stout Heart', now: '3 hearts per chamber', next: '4 hearts at Lv 5' })
  assert.equal(describeTalent('bonusHearts', 4, cfg).next, '4 hearts per chamber')
  assert.equal(describeTalent('bonusHearts', 5, cfg).now, '4 hearts per chamber')
  assert.equal(describeTalent('bonusHearts', 6, cfg).next, '5 hearts at Lv 10')
  assert.equal(describeTalent('bonusHearts', 13, cfg).next, '6 hearts per chamber')
  assert.equal(describeTalent('bonusHearts', 14, cfg).now, '6 hearts per chamber')
})

test('starsSpent counts the stars invested across branches', async () => {
  const { starsSpent } = await import('../lib/talents.ts')
  assert.equal(starsSpent({}), 0)
  assert.equal(starsSpent({ goldRate: 3, basePower: 2 }), 9)
  assert.equal(starsSpent({ goldRate: 14, weaponRate: 14, basePower: 14, bonusHearts: 14, weaponBonusPower: 14 }), 525)
})
