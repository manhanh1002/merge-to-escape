// Out-of-game talent tree (plan 9.2). Stars earned on first clears buy permanent levels in
// five branches; this module holds the pure rules — costs, upgrading, and how talent levels
// change a run (drop rates, starting Power and hearts, gear Power). No React, no storage.
import type { EconomyConfig } from './game-logic'
import type { SaveData } from './save'

export const TALENT_IDS = ['goldRate', 'weaponRate', 'basePower', 'bonusHearts', 'weaponBonusPower'] as const
export type TalentId = (typeof TALENT_IDS)[number]

/** = economyConfig.talentTreeConfig in game_config.json */
export type TalentConfig = {
  /** Effect per level: goldRate / weaponRate add to drop rates, basePower adds Power. */
  statsBonusPerLevel: { goldRate: number; weaponRate: number; basePower: number }
  maxLevel: number
  /** bonusHearts: +1 heart in boss rooms at each of these levels. */
  heartLevels: number[]
  /** weaponBonusPower ("Gear Mastery"): +1 starting armor at each of these levels. */
  armorLevels: number[]
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

/** Stars currently invested across all branches. */
export const starsSpent = (talents: TalentLevels) =>
  Object.values(talents).reduce((sum: number, lv) => sum + spentFor(lv ?? 0), 0)

/** Resets every branch to 0 and gives back all the stars spent on them. */
export function refundAll(save: SaveData): SaveData {
  return { ...save, stars: save.stars + starsSpent(save.talents), talents: {} }
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

/** What a run starts with: Power from basePower, boss-room hearts from bonusHearts, and
 *  armor charges from Gear Mastery (stored under its original id, weaponBonusPower). */
export function startingRun(talents: TalentLevels, cfg: TalentConfig): { power: number; hearts: number; armor: number } {
  const reached = (levels: number[], lv: number | undefined) => levels.filter((at) => (lv ?? 0) >= at).length
  return {
    power: (talents.basePower ?? 0) * cfg.statsBonusPerLevel.basePower,
    hearts: BASE_HEARTS + reached(cfg.heartLevels, talents.bonusHearts),
    armor: reached(cfg.armorLevels, talents.weaponBonusPower),
  }
}

/** Player-facing names. */
export const TALENT_NAMES: Record<TalentId, string> = {
  goldRate: 'Golden Touch',
  weaponRate: 'Treasure Sense',
  basePower: 'Arcane Might',
  bonusHearts: 'Stout Heart',
  weaponBonusPower: 'Gear Mastery',
}

/** Effect text at `level` and at the next level (null when maxed), for the upgrades screen. */
export function describeTalent(id: TalentId, level: number, cfg: TalentConfig): { name: string; now: string; next: string | null } {
  const per = cfg.statsBonusPerLevel
  // one decimal when needed (weaponRate is 1.5% per level), float noise removed
  const pct = (lv: number, rate: number) => `${Number((lv * rate * 100).toFixed(1))}%`
  const effect = (lv: number): string => {
    switch (id) {
      case 'goldRate': return `+${pct(lv, per.goldRate)} gold drop chance`
      case 'weaponRate': return `+${pct(lv, per.weaponRate)} tome & gear drop chance`
      case 'basePower': return `+${lv * per.basePower} starting Power (added to every Fire Tome)`
      case 'weaponBonusPower': {
        const armor = startingRun({ weaponBonusPower: lv }, cfg).armor
        return armor ? `Start each chamber with ${armor} armor` : 'No starting armor yet'
      }
      case 'bonusHearts': return `${startingRun({ bonusHearts: lv }, cfg).hearts} hearts in boss rooms`
    }
  }
  const now = level === 0 && id !== 'bonusHearts' && id !== 'weaponBonusPower' ? 'No bonus yet' : effect(level)
  let next: string | null = level >= cfg.maxLevel ? null : effect(level + 1)
  // hearts and armor only change at certain levels: point at the next one
  const steps = id === 'bonusHearts' ? cfg.heartLevels : id === 'weaponBonusPower' ? cfg.armorLevels : null
  if (steps && next !== null && !steps.includes(level + 1)) {
    const at = steps.find((lv) => lv > level)
    next = at === undefined ? null : id === 'bonusHearts'
      ? `${startingRun({ bonusHearts: at }, cfg).hearts} hearts at Lv ${at}`
      : `${startingRun({ weaponBonusPower: at }, cfg).armor} starting armor at Lv ${at}`
  }
  return { name: TALENT_NAMES[id], now, next }
}
