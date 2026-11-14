// Rebalances level targets in lib/game_config.json so every level is finishable in a
// reasonable session. Bot runs (scripts/simulate_levels.mjs) showed targets of 2048-8192
// needed 1000-4000 moves and were near-unwinnable from level 72 on. Rule now:
//   - chapters 1-4 keep their authored targets (16 .. 256+64)
//   - chapters 5-10 never exceed 512 (fusion pairs at most 512+128); later chapters get
//     harder through their obstacle budget (walls, stones, spikes), not bigger numbers
// Board size grows in rounds: 20 levels 4x4 (L1-20), 20 levels 5x5 (L21-40),
// 30 levels 6x6 (L41-70), 30 levels 7x7 (L71-100).
// After changing sizes, re-run scripts/generate_level_layouts.mjs to re-place obstacles.
// Also keeps derived fields in sync: target = sum(formula), numbered stone = max/2.
// Idempotent. Usage: node scripts/rebalance_targets.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const path = new URL('../lib/game_config.json', import.meta.url)
const config = JSON.parse(readFileSync(path, 'utf8'))

// One 10-slot pattern per chapter group; slots 5 and 10 are boss levels.
const PATTERNS = {
  5: [[256], [256, 64], [256], [512], [256], [256, 128], [512], [256, 64], [512], [512]],
  6: [[256], [512], [256, 128], [512], [512], [256, 64], [512], [512, 128], [512], [512]],
  7: [[256], [512], [256, 128], [512], [512], [256, 64], [512], [512, 128], [512], [512]],
  // Slot 2 is 256+64 here: 512+128 fusions on these crowded boards were near-unwinnable
  // in bot runs (L72 8/20, L92 0/20). Slot 7 keeps 512+128 as the chapter's hard level.
  8: [[512], [256, 64], [512], [256, 128], [512], [512], [512, 128], [512], [256, 128], [512]],
  9: [[512], [256, 64], [512], [256, 128], [512], [512], [512, 128], [512], [256, 128], [512]],
  10: [[512], [256, 64], [512], [256, 128], [512], [512], [512, 128], [512], [256, 128], [512]],
}

const boardSize = (id) => (id <= 20 ? 4 : id <= 40 ? 5 : id <= 70 ? 6 : 7)

// Per-level wall caps. L10: two walls stacked mid-board on a 4x4 with a boss gave a 73%
// bot win rate; with one wall it is 87%, in line with L6-L9 (boss HP made no difference).
// After the 20/20/30/30 board-size rounds, levels that moved to a smaller board were
// re-measured (40 bot runs each) and eased where they fell well below their neighbours:
//   L16 4 walls on 4x4: 53% -> cap 2      L20 boss + 3 walls on 4x4: 38% -> cap 1
//   L40 boss + 2 walls + stone on 5x5: 55% -> cap 1
const MAX_WALLS = { 10: 1, 16: 2, 20: 1, 40: 1 }

// Targets that are too big for the (now smaller) board:
//   L33 256+64 with 2 stones on 5x5: 20% -> 128+64
const TARGET_OVERRIDES = { 33: [128, 64] }

// Big boards need more obstacles or they get easier than small ones: with the authored
// counts, bot win rates were 4x4 84% -> 5x5 92% -> 6x6 99% -> 7x7 98% (inverted curve).
// Each entry ramps linearly from the first to the last level of its size block and acts
// as a floor (authored counts above it are kept). Stones stay <= 3 (plan 1); boss levels
// never get spikes (plan 3). New entries are placeholders: generate_level_layouts.mjs
// places them.
const OBSTACLE_FLOOR = {
  // 6x6: at most one numbered stone — on 512 levels it is worth 256, and two of them plus
  // 3 stones left many layouts unwinnable (bot 10-20%).
  6: { from: 41, to: 70, walls: [3, 6], stones: [2, 3], numbered: [1, 1], spikes: [1, 2] },
  // 7x7: walls/spikes barely bite on a board this size (bot 94%); numbered stones do.
  // Even after layout tuning, 7x7 stayed ~13 pts easier than the target curve with the
  // previous floor (numbered 3-4, spikes 3-4, walls 8-12), so it ramps higher here.
  // Spikes: once the wizard slides all the way, a spike threatens its whole row and column;
  // 3-6 of them left many 7x7 boards with no safe swipe (bot "stuck", L91 23%), so 2-3 max.
  7: { from: 71, to: 100, walls: [8, 14], stones: [3, 3], numbered: [3, 5], spikes: [2, 3], spikesMax: true },
}
// Enemy Points per obstacle (plan 1): wall 1, numbered stone 2, stone 3, spike 5, beast 6.
const enemyPoints = (l) => l.walls.length + 2 * l.numberedStones.length + 3 * l.stoneCoords.length
  + 5 * l.spikeTraps.length + 6 * l.wanderingBeasts.length

function applyObstacleFloor(level) {
  const floor = OBSTACLE_FLOOR[level.size]
  if (!floor) return 0
  const t = (level.id - floor.from) / (floor.to - floor.from)
  const at = ([a, b]) => Math.round(a + (b - a) * t)
  let added = 0
  while (level.walls.length < at(floor.walls)) {
    level.walls.push({ row: 0, col: 0, type: level.walls.length % 2 ? 'horizontal' : 'vertical' }); added++
  }
  const stones = Math.min(3, at(floor.stones))
  while (level.stoneCoords.length < stones) { level.stoneCoords.push([0, 0]); added++ }
  level.initialStones = level.stoneCoords.length
  while (level.numberedStones.length < at(floor.numbered)) { level.numberedStones.push({ coord: [0, 0], value: 0 }); added++ }
  if (!level.hasBoss) {
    while (level.spikeTraps.length < at(floor.spikes)) { level.spikeTraps.push([0, 0]); added++ }
    // `spikesMax`: the ramp is also a ceiling (extra spikes are removed)
    if (floor.spikesMax && level.spikeTraps.length > at(floor.spikes)) {
      added -= level.spikeTraps.length - at(floor.spikes)
      level.spikeTraps = level.spikeTraps.slice(0, at(floor.spikes))
    }
  }
  return added
}

let changed = 0
let resized = 0
let addedObstacles = 0
for (const level of config.levels) {
  const size = boardSize(level.id)
  if (level.size !== size) { level.size = size; resized++ }
  if (MAX_WALLS[level.id] !== undefined) level.walls = level.walls.slice(0, MAX_WALLS[level.id])
  const pattern = PATTERNS[level.chapter]
  if (!pattern && TARGET_OVERRIDES[level.id]) {
    if (JSON.stringify(TARGET_OVERRIDES[level.id]) !== JSON.stringify(level.targetFormula)) changed++
    level.targetFormula = TARGET_OVERRIDES[level.id]
  }
  if (pattern) {
    const formula = TARGET_OVERRIDES[level.id] ?? pattern[(level.id - 1) % 10]
    if (JSON.stringify(formula) !== JSON.stringify(level.targetFormula)) changed++
    level.targetFormula = formula
  }
  addedObstacles += applyObstacleFloor(level)
  level.target = level.targetFormula.reduce((a, b) => a + b, 0)
  const stoneValue = Math.max(...level.targetFormula) / 2
  level.numberedStones = level.numberedStones.map((ns) => ({ ...ns, value: stoneValue }))
  level.enemyPointsBudget = enemyPoints(level)
}

writeFileSync(path, JSON.stringify(config, null, 2) + '\n')
const max = Math.max(...config.levels.map((l) => l.target))
console.log(`Updated ${changed} level targets, resized ${resized} boards, obstacles ${addedObstacles >= 0 ? '+' : ''}${addedObstacles}; highest target is now ${max}`)
if (resized || addedObstacles) console.log('Layout changed: run `node scripts/generate_level_layouts.mjs` to place obstacles.')
