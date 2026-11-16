// Per-level economy tweaks layered on top of the talent-adjusted economy.
// Early levels target 16/32, so merges rarely reach the 16+ tiles that drop gold and the
// shop stays out of reach. The early gold boost lets small merges drop a little gold and
// raises every gold chance, strongest at level 1 and fading to nothing after `untilLevel`.
import type { EconomyConfig } from './game-logic'

/** 1 at level 1, falling linearly to 1/untilLevel at `untilLevel`, 0 after. */
export function earlyGoldFade(levelId: number, untilLevel: number): number {
  if (!(untilLevel > 0) || levelId > untilLevel) return 0
  return (untilLevel - Math.max(1, levelId) + 1) / untilLevel
}

/** The economy for one level. Never mutates `base`. */
export function levelEconomy(base: EconomyConfig, levelId: number): EconomyConfig {
  const boost = base.earlyGoldBoost
  const fade = boost ? earlyGoldFade(levelId, boost.untilLevel) : 0
  if (!boost || fade === 0) return base
  const known = new Set(base.goldDropRules.map((r) => r.minTile))
  const rules = [
    ...boost.smallMerges.filter((r) => !known.has(r.minTile)).map((r) => ({ ...r, dropRate: r.dropRate * fade })),
    ...base.goldDropRules.map((r) => ({ ...r, dropRate: Math.min(1, r.dropRate + boost.extraDropRate * fade) })),
  ]
  return { ...base, goldDropRules: rules }
}
