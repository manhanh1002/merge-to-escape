// Picks, for each level in a range, the obstacle arrangement whose bot win rate is closest
// to a target difficulty curve. Obstacle COUNTS are not changed (rebalance_targets.mjs owns
// those) — only where they sit, via a per-level `layoutSeed` stored in game_config.json.
//
//   node scripts/tune_layouts.mjs [--from 41] [--to 100] [--seeds 6] [--runs 24]
//
// Target bot win rate (the bot is weaker than a human, so real players do better):
//   6x6 (L41-70): 85% -> 70%      7x7 (L71-100): 75% -> 60%
import { readFileSync, writeFileSync } from 'node:fs'
import { layoutLevel, validateLevel } from './generate_level_layouts.mjs'
import { play } from './simulate_levels.mjs'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}
const FROM = arg('from', 41)
const TO = arg('to', 100)
const SEEDS = arg('seeds', 6)
const RUNS = arg('runs', 24)

const CURVE = [
  { from: 41, to: 70, start: 0.85, end: 0.70 },
  { from: 71, to: 100, start: 0.75, end: 0.60 },
]
const targetRate = (id) => {
  const seg = CURVE.find((c) => id >= c.from && id <= c.to)
  if (!seg) return null
  return seg.start + ((seg.end - seg.start) * (id - seg.from)) / (seg.to - seg.from)
}

const path = new URL('../lib/game_config.json', import.meta.url)
const config = JSON.parse(readFileSync(path, 'utf8'))
const winRate = (level) => Array.from({ length: RUNS }, () => play(level)).filter((r) => r.win).length / RUNS

for (let i = 0; i < config.levels.length; i++) {
  const level = config.levels[i]
  const target = targetRate(level.id)
  if (target === null || level.id < FROM || level.id > TO) continue
  let best = null
  for (let seed = 0; seed < SEEDS; seed++) {
    const candidate = layoutLevel({ ...level, layoutSeed: seed })
    if (validateLevel(candidate).length) continue
    const rate = winRate(candidate)
    if (!best || Math.abs(rate - target) < Math.abs(best.rate - target)) best = { seed, rate, candidate }
    if (Math.abs(rate - target) <= 0.04) break // close enough
  }
  config.levels[i] = { ...best.candidate, layoutSeed: best.seed }
  console.log(`L${level.id}\ttarget ${Math.round(target * 100)}%\tchose seed ${best.seed}\t-> ${Math.round(best.rate * 100)}%`)
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n') // save progress as we go
}
