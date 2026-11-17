// Which level the play screen opens (pure, unit-tested).
import type { SaveData } from './save'

/**
 * `param` is the 1-based `?level=` value. No param continues the player's current level
 * (resuming its saved run). A level the player has not unlocked, or anything that is not a
 * whole level number, returns null — the caller sends the player back to Home.
 */
export function resolveStartLevel(
  param: string | null,
  save: Pick<SaveData, 'unlocked' | 'current' | 'run'>,
  levelCount: number,
): { level: number; resume: boolean } | null {
  const resumeIf = (level: number) => ({ level, resume: !!save.run && save.run.level === level })
  if (param === null || param === '') return resumeIf(save.current)
  if (!/^\d+$/.test(param)) return null
  const level = Number(param) - 1
  if (level < 0 || level >= levelCount || level > save.unlocked) return null
  return level === save.current ? resumeIf(level) : { level, resume: false }
}
