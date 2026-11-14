// Regenerates obstacle placement (stones, numbered stones, walls, spike traps, beasts)
// for every level in lib/game_config.json. Counts/values are kept as authored; only
// coordinates are re-rolled so that:
//   - no obstacle sits on the player start (0,0), its two neighbours, or the boss cell
//   - no two floor/board objects overlap
//   - walls are on real interior edges and never box in the start cell
//   - every non-blocked cell stays reachable from the start (no sealed pockets)
// Deterministic: seeded by level id, so re-running gives the same result.
//
// Usage: node scripts/generate_level_layouts.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const configPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'game_config.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const checkOnly = process.argv.includes('--check')

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const wallKey = (w) => `${w.type}:${w.row}:${w.col}`

function isWallBetween(a, b, size, walls) {
  const r1 = Math.floor(a / size), c1 = a % size, r2 = Math.floor(b / size), c2 = b % size
  return walls.some((w) =>
    (w.type === 'vertical' && r1 === w.row && r2 === w.row && Math.min(c1, c2) === w.col && Math.abs(c1 - c2) === 1) ||
    (w.type === 'horizontal' && c1 === w.col && c2 === w.col && Math.min(r1, r2) === w.row && Math.abs(r1 - r2) === 1))
}

/** Returns a list of problems; empty when the level layout is valid. */
export function validateLevel(lvl) {
  const problems = []
  const s = lvl.size, n = s * s
  const bossCell = lvl.hasBoss ? n - 1 : -1
  const occupied = new Map()
  const put = (coord, what) => {
    const [r, c] = coord
    if (!(r >= 0 && r < s && c >= 0 && c < s)) { problems.push(`${what} out of bounds ${coord}`); return }
    const k = r * s + c
    if (k === 0) problems.push(`${what} on player start`)
    if (k === bossCell) problems.push(`${what} on boss cell`)
    if (occupied.has(k)) problems.push(`${what} overlaps ${occupied.get(k)} at ${coord}`)
    occupied.set(k, what)
  }
  lvl.stoneCoords.forEach((c) => put(c, 'stone'))
  lvl.numberedStones.forEach((ns) => put(ns.coord, 'numbered stone'))
  lvl.spikeTraps.forEach((c) => put(c, 'spike'))
  lvl.wanderingBeasts.forEach((b) => put(b.coord, 'beast'))
  if (lvl.stoneCoords.length !== lvl.initialStones) problems.push(`initialStones=${lvl.initialStones} but ${lvl.stoneCoords.length} coords`)
  if (lvl.stoneCoords.length > 3) problems.push('more than 3 stones')
  if (lvl.hasBoss && lvl.spikeTraps.length) problems.push('spike trap on boss level')
  const seen = new Set()
  for (const w of lvl.walls) {
    if (w.type === 'vertical' && !(w.row >= 0 && w.row < s && w.col >= 0 && w.col < s - 1)) problems.push(`vertical wall not on interior edge ${wallKey(w)}`)
    if (w.type === 'horizontal' && !(w.row >= 0 && w.row < s - 1 && w.col >= 0 && w.col < s)) problems.push(`horizontal wall not on interior edge ${wallKey(w)}`)
    if (seen.has(wallKey(w))) problems.push(`duplicate wall ${wallKey(w)}`)
    seen.add(wallKey(w))
  }
  // Reachability: every free cell must be reachable from the start for the player.
  const blocked = new Set([...occupied.keys()])
  if (bossCell >= 0) blocked.add(bossCell)
  const visited = new Set([0])
  const queue = [0]
  while (queue.length) {
    const cur = queue.shift()
    const r = Math.floor(cur / s), c = cur % s
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nr = r + dr, nc = c + dc
      if (nr < 0 || nr >= s || nc < 0 || nc >= s) continue
      const nb = nr * s + nc
      if (visited.has(nb) || blocked.has(nb) || isWallBetween(cur, nb, s, lvl.walls)) continue
      visited.add(nb); queue.push(nb)
    }
  }
  const free = n - blocked.size
  if (visited.size !== free) problems.push(`only ${visited.size}/${free} free cells reachable from start`)
  return problems
}

/** Lays out one level. `layoutSeed` (optional, set by tune_layouts.mjs) picks an alternative
 *  arrangement with the same obstacle counts. */
export function layoutLevel(lvl) {
  const s = lvl.size, n = s * s
  for (let attempt = 0; attempt < 500; attempt++) {
    const rand = mulberry32(lvl.id * 1000 + (lvl.layoutSeed ?? 0) * 100003 + attempt)
    const reserved = new Set([0, 1, s])
    if (lvl.hasBoss) { reserved.add(n - 1); reserved.add(n - 2); reserved.add(n - 1 - s) }
    const pick = () => {
      const free = [...Array(n).keys()].filter((k) => !reserved.has(k))
      const k = free[Math.floor(rand() * free.length)]
      reserved.add(k)
      return [Math.floor(k / s), k % s]
    }
    const candidate = {
      ...lvl,
      stoneCoords: Array.from({ length: lvl.initialStones }, pick),
      numberedStones: lvl.numberedStones.map((ns) => ({ ...ns, coord: pick() })),
      spikeTraps: lvl.hasBoss ? [] : lvl.spikeTraps.map(pick),
      wanderingBeasts: lvl.wanderingBeasts.map((b) => ({ ...b, coord: pick() })),
    }
    const walls = []
    const used = new Set()
    for (const w of lvl.walls) {
      for (let tries = 0; tries < 100; tries++) {
        const type = w.type
        const row = Math.floor(rand() * (type === 'horizontal' ? s - 1 : s))
        const col = Math.floor(rand() * (type === 'vertical' ? s - 1 : s))
        const wall = { row, col, type }
        // Never wall off the start cell's own edges.
        if (row === 0 && col === 0) continue
        if (used.has(wallKey(wall))) continue
        used.add(wallKey(wall)); walls.push(wall); break
      }
    }
    candidate.walls = walls
    if (walls.length === lvl.walls.length && validateLevel(candidate).length === 0) return candidate
  }
  throw new Error(`Could not lay out level ${lvl.id}`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (!isMain) {
  // imported as a module
} else if (checkOnly) {
  let bad = 0
  for (const lvl of config.levels) {
    const p = validateLevel(lvl)
    if (p.length) { bad++; console.log(`Level ${lvl.id}: ${p.join('; ')}`) }
  }
  console.log(bad ? `${bad} invalid levels` : `All ${config.levels.length} levels valid`)
  process.exit(bad ? 1 : 0)
} else {
  config.levels = config.levels.map(layoutLevel)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  console.log(`Re-laid out ${config.levels.length} levels`)
}
