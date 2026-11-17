// Player progress persisted in localStorage. Pure helpers (no window access) so they can
// be unit-tested; the page does the actual reading/writing.
import type { FloorGift, FloorGifts, Tile } from './game-logic'

/** Current save (v2). The v1 save is only read once, to migrate, and is left as a backup. */
export const SAVE_KEY = 'merge-to-escape:save:v2'
export const LEGACY_SAVE_KEY = 'merge-to-escape:save:v1'

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
  /** Gear charges (armor absorbs a hit, gauntlets shatter a stone); 0 in older saves. */
  armor: number
  gauntlets: number
  /** Walls dissolved by a Rune of Passage (indices into the level's walls); [] in older saves. */
  brokenWalls: number[]
}

export type LevelRecord = { bestMoves: number; bestScore: number }

/** Fields shared by every save version. */
type CoreSave = {
  /** Highest level index the player may pick (0-based). */
  unlocked: number
  /** Level index to resume on. */
  current: number
  gold: number
  /** Best results per cleared level index (a record means the level was cleared). */
  records: Record<number, LevelRecord>
  /** Unfinished level in progress, if any. */
  run?: RunState
}
export type SaveDataV1 = { version: 1 } & CoreSave

/** Consumables bought in the shop (phase 9.7). */
export type Stash = { hammer: number; purge2: number; purge4: number; heartPotion: number; wallRune: number; undoCharm: number }
export const STASH_ITEMS: (keyof Stash)[] = ['hammer', 'purge2', 'purge4', 'heartPotion', 'wallRune', 'undoCharm']

/** Permanent shop perks (bought once). */
export type Perks = { goldMagnet: boolean; itemMagnet: boolean }
export const PERK_IDS: (keyof Perks)[] = ['goldMagnet', 'itemMagnet']
export const MAX_TALENT_LEVEL = 14

export type SaveData = { version: 2 } & CoreSave & {
  /** Unspent stars, earned by clearing levels for the first time. */
  stars: number
  /** Talent levels by id (0..14). Ids come from the talent config (phase 9.2). */
  talents: Record<string, number>
  stash: Stash
  /** How many times each shop entry was bought (each purchase raises its price). */
  purchases: Record<string, number>
  perks: Perks
  settings: { sound: boolean }
}

const emptyStash = (): Stash => ({ hammer: 0, purge2: 0, purge4: 0, heartPotion: 0, wallRune: 0, undoCharm: 0 })
export const freshSave = (): SaveData => ({
  version: 2, unlocked: 0, current: 0, gold: 0, records: {},
  stars: 0, talents: {}, stash: emptyStash(), purchases: {}, perks: { goldMagnet: false, itemMagnet: false }, settings: { sound: true },
})

/** Stars for clearing a level the first time: 1 for levels 1-10 ... 10 for 91-100. */
export const starsForLevel = (levelIndex: number) => Math.ceil((levelIndex + 1) / 10)

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
  const gear = (v: unknown) => (v === undefined ? 0 : isCount(v) ? Math.min(v as number, 9) : -1)
  const armor = gear(o.armor), gauntlets = gear(o.gauntlets)
  if (armor < 0 || gauntlets < 0) return undefined
  const brokenWalls = o.brokenWalls === undefined ? [] : o.brokenWalls
  if (!Array.isArray(brokenWalls) || !brokenWalls.every(isCount) || new Set(brokenWalls).size !== brokenWalls.length) return undefined
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
    armor,
    gauntlets,
    brokenWalls: brokenWalls as number[],
  }
}

type SizeOf = (level: number) => number

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null
  } catch { return null }
}

/** Validates the fields every version shares; anything out of range falls back to safe values.
 *  `sizeOf(level)` (board side length) lets a saved run be checked against its level. */
function parseCore(d: Record<string, unknown>, levelCount: number, sizeOf?: SizeOf): CoreSave {
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
    unlocked,
    current,
    gold: clampInt(d.gold, 0, Number.MAX_SAFE_INTEGER, 0),
    records,
    // a run only resumes on the level the player was on
    ...(run && run.level === current ? { run } : {}),
  }
}

/** Parses a v1 save (used only to migrate). Invalid input gives an empty v1 save. */
export function parseSaveV1(raw: string | null, levelCount: number, sizeOf?: SizeOf): SaveDataV1 {
  const d = parseJson(raw)
  if (!d || d.version !== 1) return { version: 1, unlocked: 0, current: 0, gold: 0, records: {} }
  return { version: 1, ...parseCore(d, levelCount, sizeOf) }
}

/** Parses a v2 save; anything missing, corrupt or out of range falls back to safe values. */
export function parseSave(raw: string | null, levelCount: number, sizeOf?: SizeOf): SaveData {
  const d = parseJson(raw)
  if (!d || d.version !== 2) return freshSave()
  const talents: Record<string, number> = {}
  if (d.talents && typeof d.talents === 'object') {
    for (const [id, lv] of Object.entries(d.talents)) {
      if (/^[A-Za-z]\w*$/.test(id)) talents[id] = clampInt(lv, 0, MAX_TALENT_LEVEL, 0)
    }
  }
  const stashIn = (d.stash && typeof d.stash === 'object' ? d.stash : {}) as Record<string, unknown>
  const stash = emptyStash()
  for (const item of STASH_ITEMS) stash[item] = clampInt(stashIn[item], 0, 999, 0)
  const settings = (d.settings && typeof d.settings === 'object' ? d.settings : {}) as Record<string, unknown>
  const purchases: Record<string, number> = {}
  if (d.purchases && typeof d.purchases === 'object') {
    for (const id of [...STASH_ITEMS, ...PERK_IDS] as string[]) {
      const n = clampInt((d.purchases as Record<string, unknown>)[id], 0, 999, 0)
      if (n) purchases[id] = n
    }
  }
  const perksIn = (d.perks && typeof d.perks === 'object' ? d.perks : {}) as Record<string, unknown>
  return {
    version: 2,
    ...parseCore(d, levelCount, sizeOf),
    stars: clampInt(d.stars, 0, 100000, 0),
    talents,
    stash,
    purchases,
    perks: { goldMagnet: perksIn.goldMagnet === true, itemMagnet: perksIn.itemMagnet === true },
    settings: { sound: settings.sound !== false },
  }
}

/** v1 -> v2: keeps progress, gold, records and the run; back-pays stars for cleared levels. */
export function migrateV1(v1: SaveDataV1): SaveData {
  const stars = Object.keys(v1.records).reduce((sum, k) => sum + starsForLevel(Number(k)), 0)
  const { version: _v, ...core } = v1
  return { ...freshSave(), ...core, version: 2, stars }
}

/** Picks the save to use: a valid v2 save wins; otherwise a v1 save is migrated. */
export function loadSave(rawV2: string | null, rawV1: string | null, levelCount: number, sizeOf?: SizeOf): { save: SaveData; migrated: boolean } {
  if (parseJson(rawV2)?.version === 2) return { save: parseSave(rawV2, levelCount, sizeOf), migrated: false }
  if (parseJson(rawV1)?.version === 1) return { save: migrateV1(parseSaveV1(rawV1, levelCount, sizeOf)), migrated: true }
  return { save: freshSave(), migrated: false }
}

/** Clearing a level unlocks the next one, keeps the best moves/score, and pays stars the
 *  first time the level is cleared (replays pay none). */
export function recordWin(save: SaveData, levelIndex: number, moves: number, score: number, levelCount: number): { save: SaveData; starsEarned: number } {
  const prev = save.records[levelIndex]
  const starsEarned = prev ? 0 : starsForLevel(levelIndex)
  return {
    starsEarned,
    save: {
      ...save,
      stars: save.stars + starsEarned,
      unlocked: Math.min(levelCount - 1, Math.max(save.unlocked, levelIndex + 1)),
      run: undefined,
      records: {
        ...save.records,
        [levelIndex]: {
          bestMoves: prev ? Math.min(prev.bestMoves, moves) : moves,
          bestScore: prev ? Math.max(prev.bestScore, score) : score,
        },
      },
    },
  }
}
