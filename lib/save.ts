// Player progress persisted in localStorage. Pure helpers (no window access) so they can
// be unit-tested; the page does the actual reading/writing.
import type { FloorGift, FloorGifts, Tile } from './game-logic'

export const SAVE_KEY = 'merge-to-escape:save:v1'

/** The level being played right now, so a reload resumes the same board (no undo history). */
export type RunState = {
  level: number
  board: Tile[]
  floorGifts: FloorGifts
  moves: number
  score: number
  keys: number
  power: number
  hearts: number
  scrolls: { 2: number; 4: number }
}

export type LevelRecord = { bestMoves: number; bestScore: number }
export type SaveData = {
  version: 1
  /** Highest level index the player may pick (0-based). */
  unlocked: number
  /** Level index to resume on. */
  current: number
  gold: number
  /** Best results per cleared level index. */
  records: Record<number, LevelRecord>
  /** Unfinished level in progress, if any. */
  run?: RunState
}

export const freshSave = (): SaveData => ({ version: 1, unlocked: 0, current: 0, gold: 0, records: {} })

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback

const isCount = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0

function isTile(t: unknown): t is Tile {
  if (t === null || t === 'stone' || t === 'player' || t === 'exit' || t === 'locked_exit') return true
  if (typeof t === 'number') return Number.isInteger(t) && t >= 2 && (t & (t - 1)) === 0
  if (!t || typeof t !== 'object') return false
  const o = t as Record<string, unknown>
  if (o.type === 'numbered_stone') return isCount(o.value)
  if (o.type === 'boss') return isCount(o.hp) && isCount(o.maxHp) && (o.hp as number) > 0
  return false
}

function isGift(g: unknown): g is FloorGift {
  if (!g || typeof g !== 'object') return false
  const o = g as Record<string, unknown>
  if (o.type === 'gold') return isCount(o.amount)
  if (o.type === 'key') return true
  if (o.type === 'scroll') return o.targetValue === 2 || o.targetValue === 4
  if (o.type === 'equipment') {
    const item = o.item as Record<string, unknown> | undefined
    return !!item && ['sword', 'armor', 'gauntlet'].includes(item.type as string) && isCount(item.power)
  }
  return false
}

/** Returns the run if it is a playable board for an unlocked level, otherwise undefined. */
function parseRun(r: unknown, unlocked: number, sizeOf?: (level: number) => number): RunState | undefined {
  if (!r || typeof r !== 'object') return undefined
  const o = r as Record<string, unknown>
  if (!isCount(o.level) || (o.level as number) > unlocked) return undefined
  if (!Array.isArray(o.board) || !o.board.every(isTile)) return undefined
  if (sizeOf && o.board.length !== sizeOf(o.level as number) ** 2) return undefined
  if (o.board.filter((t) => t === 'player').length !== 1) return undefined
  if (!o.floorGifts || typeof o.floorGifts !== 'object') return undefined
  const floorGifts: FloorGifts = {}
  for (const [key, g] of Object.entries(o.floorGifts)) {
    const idx = Number(key)
    if (!Number.isInteger(idx) || idx < 0 || idx >= o.board.length || !isGift(g)) return undefined
    floorGifts[idx] = g
  }
  const scrolls = o.scrolls as Record<string, unknown> | undefined
  if (![o.moves, o.score, o.keys, o.power, o.hearts, scrolls?.[2], scrolls?.[4]].every(isCount)) return undefined
  if ((o.hearts as number) < 1) return undefined
  return {
    level: o.level as number,
    board: o.board as Tile[],
    floorGifts,
    moves: o.moves as number,
    score: o.score as number,
    keys: o.keys as number,
    power: o.power as number,
    hearts: o.hearts as number,
    scrolls: { 2: scrolls![2] as number, 4: scrolls![4] as number },
  }
}

/** Parses stored JSON; anything missing, corrupt or out of range falls back to safe values.
 *  `sizeOf(level)` (board side length) lets a saved run be checked against its level. */
export function parseSave(raw: string | null, levelCount: number, sizeOf?: (level: number) => number): SaveData {
  if (!raw) return freshSave()
  let data: unknown
  try { data = JSON.parse(raw) } catch { return freshSave() }
  if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 1) return freshSave()
  const d = data as Partial<SaveData>
  const last = Math.max(0, levelCount - 1)
  const unlocked = clampInt(d.unlocked, 0, last, 0)
  const records: Record<number, LevelRecord> = {}
  if (d.records && typeof d.records === 'object') {
    for (const [key, rec] of Object.entries(d.records)) {
      const idx = Number(key)
      if (!Number.isInteger(idx) || idx < 0 || idx > last || !rec || typeof rec !== 'object') continue
      const r = rec as Partial<LevelRecord>
      if (typeof r.bestMoves !== 'number' || typeof r.bestScore !== 'number') continue
      records[idx] = { bestMoves: Math.max(1, Math.floor(r.bestMoves)), bestScore: Math.max(0, Math.floor(r.bestScore)) }
    }
  }
  const current = clampInt(d.current, 0, unlocked, 0)
  const run = parseRun(d.run, unlocked, sizeOf)
  return {
    version: 1,
    unlocked,
    current,
    gold: clampInt(d.gold, 0, Number.MAX_SAFE_INTEGER, 0),
    records,
    // a run only resumes on the level the player was on
    ...(run && run.level === current ? { run } : {}),
  }
}

/** Clearing a level unlocks the next one and keeps the best moves/score. */
export function recordWin(save: SaveData, levelIndex: number, moves: number, score: number, levelCount: number): SaveData {
  const prev = save.records[levelIndex]
  return {
    ...save,
    unlocked: Math.min(levelCount - 1, Math.max(save.unlocked, levelIndex + 1)),
    run: undefined,
    records: {
      ...save.records,
      [levelIndex]: {
        bestMoves: prev ? Math.min(prev.bestMoves, moves) : moves,
        bestScore: prev ? Math.max(prev.bestScore, score) : score,
      },
    },
  }
}
