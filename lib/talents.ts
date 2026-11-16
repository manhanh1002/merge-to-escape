// Out-of-game talent tree (plan 9.2). Stars earned on first clears buy permanent levels in
// five branches; this module holds the pure rules — costs, upgrading, and how talent levels
// change a run (drop rates, starting Power and hearts, gear Power). No React, no storage.
import type { EconomyConfig } from './game-logic'
import type { SaveData } from './save'

export const TALENT_IDS = ['goldRate', 'weaponRate', 'basePower', 'bonusHearts', 'weaponBonusPower'] as const
export type TalentId = (typeof TALENT_IDS)[number]

/** = economyConfig.talentTreeConfig in game_config.json */
export type TalentConfig = {
  /** Effect per level: goldRate / weaponRate add to drop rates, basePower adds Power,
   *  weaponBonusPower multiplies gear Power by (1 + level x value). */
  statsBonusPerLevel: { goldRate: number; weaponRate: number; basePower: number; weaponBonusPower: number }
  maxLevel: number
  /** bonusHearts: +1 heart in boss rooms at each of these levels. */
  heartLevels: number[]
}

/** Hearts every boss room starts with before talents. */
export const BASE_HEARTS = 3

export type TalentLevels = Partial<Record<string, number>>

export const talentLevel = (save: Pick<SaveData, 'talents'>, id: TalentId) => save.talents[id] ?? 0

/** Going from `level` to `level + 1` costs `level + 1` stars. */
export const upgradeCost = (level: number) => level + 1

/** Total stars spent to reach `level` (1 + 2 + ... + level). */
const spentFor = (level: number) => (level * (level + 1)) / 2

export function canUpgrade(save: SaveData, id: TalentId, cfg: TalentConfig): boolean {
  const level = talentLevel(save, id)
  return level < cfg.maxLevel && save.stars >= upgradeCost(level)
}

/** Buys the next level of `id`; returns the same save object if it is not affordable/maxed. */
export function upgrade(save: SaveData, id: TalentId, cfg: TalentConfig): SaveData {
  if (!canUpgrade(save, id, cfg)) return save
  const level = talentLevel(save, id)
  return { ...save, stars: save.stars - upgradeCost(level), talents: { ...save.talents, [id]: level + 1 } }
}

/** Resets every branch to 0 and gives back all the stars spent on them. */
export function refundAll(save: SaveData): SaveData {
  const refund = Object.values(save.talents).reduce((sum: number, lv) => sum + spentFor(lv ?? 0), 0)
  return { ...save, stars: save.stars + refund, talents: {} }
}

const capRate = (rate: number) => Math.min(1, rate)

/** The economy a run plays with: base drop rates plus the goldRate / weaponRate bonuses.
 *  Never mutates `base`. */
export function effectiveEconomy(base: EconomyConfig, talents: TalentLevels, cfg: TalentConfig): EconomyConfig {
  const gold = (talents.goldRate ?? 0) * cfg.statsBonusPerLevel.goldRate
  const weapon = (talents.weaponRate ?? 0) * cfg.statsBonusPerLevel.weaponRate
  const items = { ...base.itemDropRates }
  for (const type of ['sword', 'armor', 'gauntlet'] as const) {
    items[type] = { ...items[type], dropRate: capRate(items[type].dropRate + weapon) }
  }
  return {
    ...base,
    goldDropRules: base.goldDropRules.map((r) => ({ ...r, dropRate: capRate(r.dropRate + gold) })),
    itemDropRates: items,
    ...(base.bossTomeDrop ? { bossTomeDrop: { ...base.bossTomeDrop, dropRate: capRate(base.bossTomeDrop.dropRate + weapon) } } : {}),
  }
}

/** What a run starts with: Power from basePower, hearts from bonusHearts. */
export function startingRun(talents: TalentLevels, cfg: TalentConfig): { power: number; hearts: number } {
  const hearts = BASE_HEARTS + cfg.heartLevels.filter((lv) => (talents.bonusHearts ?? 0) >= lv).length
  return { power: (talents.basePower ?? 0) * cfg.statsBonusPerLevel.basePower, hearts }
}

/** Power a picked-up item really gives, boosted by weaponBonusPower. */
export function gearPower(itemPower: number, talents: TalentLevels, cfg: TalentConfig): number {
  return Math.round(itemPower * (1 + (talents.weaponBonusPower ?? 0) * cfg.statsBonusPerLevel.weaponBonusPower))
}
