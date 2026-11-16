// Attack tomes (the config's "sword" slot) look grander as the wizard's Power grows. Power
// comes only from the Arcane Might talent (+25 per level, 0..350), so each tier is a visible
// reward for investing in it. Purely cosmetic: damage is still ceil(maxHp / hits) + Power.

export type TomeTier = {
  /** Lowest Power that shows this tier. */
  minPower: number
  name: string
  /** File name in public/assets/icons/items (scripts/import_icon_packs.py). */
  icon: string
}

export const TOME_TIERS: readonly TomeTier[] = [
  { minPower: 0, name: 'Worn Tome', icon: 'tome_worn' },
  { minPower: 50, name: 'Ember Tome', icon: 'tome_ember' },
  { minPower: 100, name: 'Fire Tome', icon: 'tome_fire' },
  { minPower: 175, name: 'Blaze Tome', icon: 'tome_blaze' },
  { minPower: 250, name: 'Inferno Codex', icon: 'tome_inferno' },
  { minPower: 350, name: 'Phoenix Grimoire', icon: 'spellbook_fire' },
]

/** The tier shown for a given Power (negative or NaN Power counts as 0). */
export function tomeFor(power: number): TomeTier {
  let tier = TOME_TIERS[0]
  for (const t of TOME_TIERS) if (power >= t.minPower) tier = t
  return tier
}

/** The next tier to unlock, or null at the top. */
export function nextTome(power: number): TomeTier | null {
  return TOME_TIERS.find((t) => t.minPower > Math.max(0, power || 0)) ?? null
}
