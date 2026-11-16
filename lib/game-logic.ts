// Pure game rules for Merge to Escape. No React, no config imports: everything the
// rules need is passed in, so this module can be unit-tested directly with Node.

export type WallType = 'vertical' | 'horizontal'
export type Wall = { row: number; col: number; type: WallType }
export type EquipmentType = 'sword' | 'armor' | 'gauntlet'
export type EquipmentItem = { type: EquipmentType; power: number }
export type FloorGift =
  | { type: 'gold'; amount: number }
  | { type: 'key' }
  | { type: 'equipment'; item: EquipmentItem }
  | { type: 'scroll'; targetValue: 2 | 4 }
export type FloorGifts = Record<number, FloorGift>

export type NumberedStone = { type: 'numbered_stone'; value: number }
export type Boss = { type: 'boss'; hp: number; maxHp: number }
export type Tile = number | 'stone' | 'player' | 'exit' | 'locked_exit' | NumberedStone | Boss | null

export type Direction = 'left' | 'right' | 'up' | 'down'

export type LevelConfig = {
  id: number
  size: number
  target: number
  targetFormula: number[]
  walls: Wall[]
  stoneCoords: [number, number][]
  numberedStones: { coord: [number, number]; value: number }[]
  spikeTraps: [number, number][]
  hasBoss: boolean
  bossHp: number
}

type ItemRule = { minTile: number; dropRate: number; basePower?: number }
export type EconomyConfig = {
  goldDropRules: { minTile: number; gold: number; dropRate: number }[]
  itemDropRates: Record<'sword' | 'armor' | 'gauntlet' | 'purgeScroll4' | 'purgeScroll2' | 'key', ItemRule>
  bossRewards?: { goldRange: [number, number]; bonusKeys: number }
  /** On boss levels attack tomes drop more often (rolled before any other gift). */
  bossTomeDrop?: { minTile: number; dropRate: number }
  /** Tomes needed to kill a boss without gear: each tome deals ceil(maxHp / hits) + Power. */
  bossTomeHits?: { mid: number; final: number }
}

export type Rng = () => number

/** Where a piece went this move, for animation. `merged`: one of two pieces that combined
 *  at `to`. `vanish`: the piece flew into `to` and was used up (crash into stone/boss). */
export type Motion = { from: number; to: number; merged?: boolean; vanish?: boolean }

/** Small deterministic PRNG so initial layouts are stable (and SSR/hydration safe). */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function isWallBetween(a: number, b: number, size: number, walls: Wall[]): boolean {
  const r1 = Math.floor(a / size), c1 = a % size
  const r2 = Math.floor(b / size), c2 = b % size
  return walls.some((w) =>
    (w.type === 'vertical' && r1 === w.row && r2 === w.row && Math.min(c1, c2) === w.col && Math.abs(c1 - c2) === 1) ||
    (w.type === 'horizontal' && c1 === w.col && c2 === w.col && Math.min(r1, r2) === w.row && Math.abs(r1 - r2) === 1))
}

export function spikeCells(level: LevelConfig): Set<number> {
  return new Set((level.spikeTraps ?? []).map(([r, c]) => r * level.size + c))
}

export const isFusionLevel = (level: LevelConfig) => level.targetFormula.length === 2

/** Fixed pieces that split a line. The player and bosses are NOT obstacles: they slide all
 *  the way like items that never merge. */
const isObstacle = (cell: Tile) => cell !== null && typeof cell !== 'number' && !isBoss(cell) && cell !== 'player'
const isNumberedStone = (cell: Tile): cell is NumberedStone =>
  typeof cell === 'object' && cell !== null && cell.type === 'numbered_stone'
export const isBoss = (cell: Tile): cell is Boss =>
  typeof cell === 'object' && cell !== null && cell.type === 'boss'

export function makeBoard(level: LevelConfig): Tile[] {
  const size = level.size
  const board: Tile[] = Array(size * size).fill(null)
  // The player is placed first and nothing may overwrite it (a numbered stone on the
  // start cell used to erase the player and make the level unwinnable).
  board[0] = 'player'
  const place = (r: number, c: number, tile: Tile) => {
    const k = r * size + c
    if (r < 0 || r >= size || c < 0 || c >= size || board[k] !== null) {
      console.warn(`Level ${level.id}: cannot place ${JSON.stringify(tile)} at [${r},${c}]`)
      return
    }
    board[k] = tile
  }
  if (level.hasBoss) place(size - 1, size - 1, { type: 'boss', hp: level.bossHp, maxHp: level.bossHp })
  level.stoneCoords?.forEach(([r, c]) => place(r, c, 'stone'))
  level.numberedStones?.forEach((ns) => place(ns.coord[0], ns.coord[1], { type: 'numbered_stone', value: ns.value }))

  // Starting tiles: spread out (seeded per level) instead of packed next to the player.
  const spikes = spikeCells(level)
  const rng = seededRng(level.id)
  const empty = board.flatMap((cell, i) => (cell === null && !spikes.has(i) ? [i] : []))
  for (const value of [2, 2, 4]) {
    if (!empty.length) break
    const [k] = empty.splice(Math.floor(rng() * empty.length), 1)
    board[k] = value
  }
  return board
}

export function addRandomTile(board: Tile[], rng: Rng = Math.random): Tile[] {
  const empty = board.flatMap((cell, index) => (cell === null ? [index] : []))
  if (!empty.length) return board
  const next = [...board]
  next[empty[Math.floor(rng() * empty.length)]] = rng() < 0.9 ? 2 : 4
  return next
}

/** Decide which gift (if any) drops when a merge produces `value`. At most one per merge. */
/** `bossLevel`: a boss is alive (tomes are the priority drop). `allowTomes`: false once the
 *  boss of this level is dead — attack tomes have nothing left to hit, so none drop. */
export function rollGift(value: number, economy: EconomyConfig, rng: Rng, bossLevel = false, allowTomes = true): FloorGift | null {
  const items = economy.itemDropRates
  const hit = (rule: ItemRule | undefined) => !!rule && value >= rule.minTile && rng() < rule.dropRate
  // While a boss is alive, attack tomes (the "sword" slot) are the priority drop.
  if (bossLevel && hit(economy.bossTomeDrop ?? { minTile: 4, dropRate: 0.5 })) {
    return { type: 'equipment', item: { type: 'sword', power: items.sword?.basePower ?? 0 } }
  }
  if (hit(items.key)) return { type: 'key' }
  for (const type of ['gauntlet', 'armor', 'sword'] as const) {
    if (type === 'sword' && !allowTomes) continue
    if (hit(items[type])) return { type: 'equipment', item: { type, power: items[type].basePower ?? 0 } }
  }
  if (hit(items.purgeScroll4)) return { type: 'scroll', targetValue: 4 }
  if (hit(items.purgeScroll2)) return { type: 'scroll', targetValue: 2 }
  const goldRule = economy.goldDropRules
    .filter((r) => value >= r.minTile)
    .sort((a, b) => b.minTile - a.minTile)[0]
  if (goldRule && rng() < goldRule.dropRate) return { type: 'gold', amount: goldRule.gold }
  return null
}

type SlideContext = {
  targetFormula: number[]
  /** True while a portal pair may still fuse into a door (no door yet this move or before). */
  fusionAvailable: boolean
  gifts: FloorGifts
  economy: EconomyConfig
  rng: Rng
  /** A boss is alive: tomes drop more often. */
  bossLevel: boolean
  /** False on a boss level whose boss is already dead: no tomes drop. */
  allowTomes: boolean
  /** Where the player ended its slide (set by slideSegment). */
  playerLanding?: number
}

/** Slides one wall/obstacle-free segment toward its first cell. Numbers merge; the player
 *  and a boss slide along like items that never merge. */
function slideSegment(segment: { val: Tile; idx: number }[], ctx: SlideContext) {
  const values = segment.filter((item) => typeof item.val === 'number' || isBoss(item.val) || item.val === 'player') as
    { val: number | Boss | 'player'; idx: number }[]
  const out: Tile[] = []
  const motions: Motion[] = []
  let gained = 0
  const [a, b] = ctx.targetFormula
  for (let i = 0; i < values.length; i++) {
    const v1 = values[i].val
    const v2 = i < values.length - 1 ? values[i + 1].val : undefined
    if (typeof v1 === 'number' && typeof v2 === 'number' && v1 === v2) {
      const merged = v1 * 2
      const landing = segment[out.length].idx
      motions.push({ from: values[i].idx, to: landing, merged: true }, { from: values[i + 1].idx, to: landing, merged: true })
      out.push(merged)
      gained += merged
      if (!ctx.gifts[landing]) {
        const gift = rollGift(merged, ctx.economy, ctx.rng, ctx.bossLevel, ctx.allowTomes)
        if (gift) ctx.gifts[landing] = gift
      }
      i++
    } else if (
      typeof v1 === 'number' && typeof v2 === 'number' && ctx.targetFormula.length === 2 && ctx.fusionAvailable &&
      ((v1 === a && v2 === b) || (v1 === b && v2 === a))
    ) {
      const landing = segment[out.length].idx
      motions.push({ from: values[i].idx, to: landing, merged: true }, { from: values[i + 1].idx, to: landing, merged: true })
      out.push('exit')
      gained += v1 + v2
      ctx.fusionAvailable = false // only one door per level
      i++
    } else {
      const landing = segment[out.length].idx
      if (landing !== values[i].idx) motions.push({ from: values[i].idx, to: landing })
      if (v1 === 'player') ctx.playerLanding = landing
      out.push(v1)
    }
  }
  while (out.length < segment.length) out.push(null)
  const moved = out.some((val, i) => val !== segment[i].val)
  return { cells: out.map((val, i) => ({ val, idx: segment[i].idx })), gained, moved, motions }
}

export type MoveResult = {
  board: Tile[]
  floorGifts: FloorGifts
  changed: boolean
  gained: number
  playerMoved: boolean
  reachedDoor: boolean
  steppedOnSpike: boolean
  /** Player tried to step but a wall was in the way. */
  bumpedWall: boolean
  /** Numbered stones shattered this move. */
  shattered: number
  /** Everything the player slid over and picked up this move, in path order. */
  collected: FloorGift[]
  doorOpen: boolean
  /** Damage attack tomes dealt to the boss this move (the player slid over them). */
  bossDamage: number
  /** How many of the collected tomes were cast at the boss (the rest are plain gear). */
  tomesCast: number
  /** Unused tomes removed from the floor because the boss died this move. */
  tomesFaded: number
  /** Boss died this move; the reward is granted once. */
  bossDefeated: boolean
  bossReward: { gold: number; keys: number } | null
  /** The boss hit the player: they came into contact this move (either one slid next to
   *  the other, or the player walked into it). The page takes a heart. */
  bossHitPlayer: boolean
  /** The player walked into the boss (no step taken). */
  bumpedBoss: boolean
  /** Boss cell after sliding this move (where it died, if it died); -1 if no boss. */
  bossAt: number
  /** Player tried to enter the door while the boss still guards it. */
  doorSealed: boolean
  /** How pieces moved (tiles, crashes, the player), for animating the board. */
  motions: Motion[]
}

/**
 * Applies one swipe: slide tiles (walls, stones, player, exit, boss act as barriers),
 * resolve numbered-stone crashes, move the player one step, collect gifts, and open the
 * door. Does NOT spawn the random tile — the caller does that, so this can also be used
 * to test whether any move is still possible.
 */
export function computeMove(
  board: Tile[],
  floorGifts: FloorGifts,
  level: LevelConfig,
  economy: EconomyConfig,
  direction: Direction,
  rng: Rng = Math.random,
  /** Player Power from gear; added to every tome's damage. */
  power = 0,
): MoveResult {
  const size = level.size
  const walls = level.walls ?? []
  const base = [...board]
  const next = [...board]
  const gifts: FloorGifts = { ...floorGifts }
  const ctx: SlideContext = {
    targetFormula: level.targetFormula,
    fusionAvailable: isFusionLevel(level) && !base.includes('exit'),
    gifts,
    economy,
    rng,
    bossLevel: base.some(isBoss),
    allowTomes: !(level.hasBoss && !base.some(isBoss)),
  }
  let changed = false
  let gained = 0
  let shattered = 0
  let bossDamage = 0
  let bossDefeated = false
  const motions: Motion[] = []
  /** A tile that ended at `at` then flew on into `into` and was used up. */
  const crashInto = (at: number, into: number) => {
    const arriving = motions.filter((x) => x.to === at && !x.vanish) // both halves of a merge
    if (arriving.length) arriving.forEach((m) => { m.to = into; m.vanish = true })
    else motions.push({ from: at, to: into, vanish: true })
  }

  for (let line = 0; line < size; line++) {
    const cells = [...Array(size)].map((_, k) => (direction === 'left' || direction === 'right' ? line * size + k : k * size + line))
    // Tiles always travel toward ordered[0].
    const ordered = direction === 'right' || direction === 'down' ? cells.reverse() : cells
    let segment: { val: Tile; idx: number }[] = []
    const flush = () => {
      if (!segment.length) return
      const res = slideSegment(segment, ctx)
      res.cells.forEach(({ val, idx }) => { next[idx] = val })
      motions.push(...res.motions)
      changed ||= res.moved
      gained += res.gained
      segment = []
    }
    for (let i = 0; i < ordered.length; i++) {
      const idx = ordered[i]
      const cell = base[idx]
      if (isObstacle(cell)) {
        flush()
        next[idx] = cell
      } else {
        segment.push({ val: cell, idx })
      }
      if (i < ordered.length - 1 && isWallBetween(idx, ordered[i + 1], size, walls)) flush()
    }
    flush()

    // Numbered stones: the tile that crashes into a stone comes from BEHIND it in the
    // travel direction (ordered[i + 1]) and must not be separated from it by a wall.
    for (let i = 0; i < ordered.length - 1; i++) {
      const idx = ordered[i]
      const stone = base[idx]
      if (!isNumberedStone(stone) || next[idx] !== stone) continue
      const behind = ordered[i + 1]
      if (next[behind] === stone.value && !isWallBetween(idx, behind, size, walls)) {
        crashInto(behind, idx)
        next[idx] = null
        next[behind] = null
        gained += stone.value
        shattered++
        changed = true
      }
    }

  }

  // Player: slid with the line above (all the way, like an item). Now resolve its path:
  // pick up everything it slid over, die on any spike it crossed, walk into a door straight
  // ahead, and note bumps into walls / the boss when it could not move.
  const player = base.indexOf('player')
  const [dr, dc] = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[direction]
  const landing = ctx.playerLanding ?? player
  let playerMoved = landing !== player
  let reachedDoor = false
  let steppedOnSpike = false
  let bumpedWall = false
  let bumpedBoss = false
  let bossDiedAt = -1
  let doorSealed = false
  let tomesCast = 0
  const collected: FloorGift[] = []
  if (player !== -1) {
    // Cells passed over, from just after the start up to and including the landing cell.
    const path: number[] = []
    for (let cur = player, steps = 0; cur !== landing && steps < size; steps++) {
      cur = (Math.floor(cur / size) + dr) * size + (cur % size) + dc
      path.push(cur)
    }
    const spikes = spikeCells(level)
    steppedOnSpike = path.some((k) => spikes.has(k))
    for (const k of path) {
      if (gifts[k]) { collected.push(gifts[k]); delete gifts[k] }
    }
    if (playerMoved) changed = true

    // What is straight ahead of where the player stopped?
    const fr = Math.floor(landing / size) + dr, fc = (landing % size) + dc
    const front = fr >= 0 && fr < size && fc >= 0 && fc < size ? fr * size + fc : -1
    const openAhead = front !== -1 && !isWallBetween(landing, front, size, walls)
    if (front !== -1 && !openAhead && !playerMoved) bumpedWall = true
    if (openAhead && next[front] === 'exit' && !steppedOnSpike) {
      if (next.some(isBoss)) doorSealed = true
      else {
        // Walk on through the door: the door stays drawn where the player escaped.
        reachedDoor = true
        next[landing] = null
        next[front] = 'exit'
        const m = motions.find((x) => x.from === player && !x.vanish)
        if (m) m.to = front
        else motions.push({ from: player, to: front })
        playerMoved = true
        changed = true
      }
    }
    if (openAhead && isBoss(next[front]) && !playerMoved) { bumpedBoss = true; changed = true }

    // Attack tomes picked up while a boss lives are cast at it, one blast each.
    const bossIdx = next.findIndex(isBoss)
    bossDiedAt = bossIdx
    const hits = economy.bossTomeHits ?? { mid: 2, final: 3 }
    for (const gift of collected) {
      if (gift.type === 'equipment' && gift.item.type === 'sword' && isBoss(next[bossIdx])) tomesCast++
      const boss = next[bossIdx]
      if (!isBoss(boss) || gift.type !== 'equipment' || gift.item.type !== 'sword') continue
      const damage = Math.ceil(boss.maxHp / (level.id % 10 === 0 ? hits.final : hits.mid)) + power
      const dealt = Math.min(damage, boss.hp)
      bossDamage += dealt
      gained += dealt
      if (boss.hp - damage <= 0) { next[bossIdx] = null; bossDefeated = true }
      else next[bossIdx] = { ...boss, hp: boss.hp - damage }
    }
  }

  // Classic levels: the first tile reaching the target turns into the door.
  // Fusion levels only open via the A + B fusion (reaching a big tile is not enough).
  if (!isFusionLevel(level) && !next.includes('exit')) {
    const doorIdx = next.findIndex((cell) => typeof cell === 'number' && cell >= level.target)
    if (doorIdx !== -1) next[doorIdx] = 'exit'
  }

  // Contact: the boss hits the player when they newly end up side by side (one of them
  // moved into contact, or the player walked into it). Standing still together is safe.
  const adjacent = (b: number, p: number) => b !== -1 && p !== -1 &&
    Math.abs(Math.floor(b / size) - Math.floor(p / size)) + Math.abs((b % size) - (p % size)) === 1 &&
    !isWallBetween(b, p, size, walls)
  const bossBefore = base.findIndex(isBoss), bossAfter = next.findIndex(isBoss)
  const bossAt = bossAfter !== -1 ? bossAfter : bossDiedAt
  const playerAfter = next.indexOf('player')
  const bossMoved = bossAfter !== -1 && bossAfter !== bossBefore
  const bossHitPlayer = !bossDefeated && !reachedDoor && (bumpedBoss ||
    (adjacent(bossAfter, playerAfter) && (!adjacent(bossBefore, player) || bossMoved || playerMoved)))

  let bossReward: MoveResult['bossReward'] = null
  let tomesFaded = 0
  if (bossDefeated) {
    const [lo, hi] = economy.bossRewards?.goldRange ?? [100, 300]
    bossReward = { gold: Math.round(lo + rng() * (hi - lo)), keys: economy.bossRewards?.bonusKeys ?? 1 }
    // With the boss gone, leftover attack tomes on the floor have nothing to hit: they fade.
    for (const [k, g] of Object.entries(gifts)) {
      if (g.type === 'equipment' && g.item.type === 'sword') { delete gifts[Number(k)]; tomesFaded++ }
    }
  }

  return {
    board: next, floorGifts: gifts, changed, gained, playerMoved, reachedDoor, steppedOnSpike, bumpedWall, shattered,
    collected, doorOpen: next.includes('exit'), bossDamage, bossDefeated, bossReward, bossHitPlayer, bumpedBoss, bossAt, doorSealed, tomesCast, tomesFaded,
    motions,
  }
}

/** True if at least one swipe direction would change the board. */
export function hasAnyMove(board: Tile[], floorGifts: FloorGifts, level: LevelConfig, economy: EconomyConfig, power = 0): boolean {
  const noDrops: Rng = () => 1 // never roll gifts during the probe
  // Just walking into the boss (nothing else moves) is not a way out.
  return (['left', 'right', 'up', 'down'] as const).some((d) => {
    const res = computeMove(board, floorGifts, level, economy, d, noDrops, power)
    return res.changed && !(res.bumpedBoss && res.motions.length === 0 && res.shattered === 0)
  })
}

// ---------- Boosters (plan 9.7): consumables from the stash, used between moves ----------

/** Hammer: smashes one stone or numbered stone. Returns the new board, or null if `index`
 *  holds anything else (boss, player, door, tiles, empty floor). */
export function applyHammer(board: Tile[], index: number): Tile[] | null {
  const cell = board[index]
  if (cell !== 'stone' && !isNumberedStone(cell)) return null
  const next = [...board]
  next[index] = null
  return next
}

/** Purge scroll: removes every tile of `value` (2 or 4). */
export function applyPurge(board: Tile[], value: 2 | 4): { board: Tile[]; removed: number[] } {
  const removed = board.flatMap((cell, i) => (cell === value ? [i] : []))
  return { board: board.map((cell) => (cell === value ? null : cell)), removed }
}

/** Heart potion: one more heart, never above the maximum (null when already full). */
export function applyHeartPotion(hearts: number, maxHearts: number): number | null {
  return hearts >= maxHearts ? null : hearts + 1
}
