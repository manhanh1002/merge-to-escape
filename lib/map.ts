// Level-map summaries (pure, unit-tested): per-level status and per-chapter progress.
// .ts extension: lib modules run directly under Node in the tests (allowImportingTsExtensions)
import { starsForLevel, type SaveData } from './save.ts'

export type LevelStatus = 'locked' | 'open' | 'current' | 'cleared'

type MapLevel = { id: number; chapter: number; chapterName: string; size: number; hasBoss: boolean }

export type ChapterSummary = {
  chapter: number
  name: string
  /** First and last level index (0-based) of the chapter. */
  from: number
  to: number
  cleared: number
  starsEarned: number
  starsTotal: number
  /** Level indexes with a boss. */
  bossLevels: number[]
  /** Board sizes used in the chapter (sorted, unique). */
  sizes: number[]
  locked: boolean
  isCurrent: boolean
}

/** `unlocked` is the highest selectable level index (save.unlocked). */
export function levelStatus(index: number, save: Pick<SaveData, 'current' | 'records'>, unlocked: number): LevelStatus {
  if (index > unlocked) return 'locked'
  if (index === save.current) return 'current'
  return save.records[index] ? 'cleared' : 'open'
}

export function chapterSummaries(levels: MapLevel[], save: Pick<SaveData, 'current' | 'records'>, unlocked: number): ChapterSummary[] {
  const byChapter = new Map<number, number[]>()
  levels.forEach((l, i) => byChapter.set(l.chapter, [...(byChapter.get(l.chapter) ?? []), i]))
  return [...byChapter.entries()].sort(([a], [b]) => a - b).map(([chapter, idx]) => {
    const clearedIdx = idx.filter((i) => save.records[i])
    return {
      chapter,
      name: levels[idx[0]].chapterName,
      from: idx[0],
      to: idx[idx.length - 1],
      cleared: clearedIdx.length,
      starsEarned: clearedIdx.reduce((s, i) => s + starsForLevel(i), 0),
      starsTotal: idx.reduce((s, i) => s + starsForLevel(i), 0),
      bossLevels: idx.filter((i) => levels[i].hasBoss),
      sizes: [...new Set(idx.map((i) => levels[i].size))].sort((a, b) => a - b),
      locked: idx[0] > unlocked,
      isCurrent: idx.includes(save.current),
    }
  })
}
