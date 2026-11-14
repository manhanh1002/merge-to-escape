// Balance check: a simple greedy bot plays every level N times and reports win rate and
// average moves. It is weaker than a human, so treat low win rates as "too hard" and very
// high move counts as "too long".
//   node scripts/simulate_levels.mjs [--runs 20] [--from 1] [--to 100] [--boss]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { computeMove, hasAnyMove, makeBoard, addRandomTile } from '../lib/game-logic.ts'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}
const RUNS = arg('runs', 20)
const FROM = arg('from', 1)
const TO = arg('to', 100)
const BOSS_ONLY = process.argv.includes('--boss')
const MAX_MOVES = 4000

const config = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8'))
const economy = config.economyConfig
const DIRS = ['left', 'right', 'up', 'down']
const noDrops = () => 1

const isTome = (g) => g?.type === 'equipment' && g.item.type === 'sword'
const dist = (a, b, size) => Math.abs((a % size) - (b % size)) + Math.abs(Math.floor(a / size) - Math.floor(b / size))

/** Greedy look-ahead of one swipe. Everything (the wizard too) slides all the way, so the
 *  bot judges each swipe by its outcome: escape, tome blasts and pickups first, then
 *  getting closer to the door (or to a tome while the boss lives), then free space. */
function scoreOf(res, gifts, size) {
  if (res.reachedDoor) return 1e6
  const player = res.board.indexOf('player')
  const bossAlive = res.board.some((c) => c && typeof c === 'object' && c.type === 'boss')
  let score = res.gained + res.bossDamage * 5 + res.collected.length * 25 - (res.bossHitPlayer ? 400 : 0)
  score += res.board.filter((c) => c === null).length * 3
  if (player !== -1) {
    const exit = res.board.indexOf('exit')
    if (!bossAlive && exit !== -1) score -= dist(player, exit, size) * 15
    if (bossAlive) {
      const tomes = Object.entries(res.floorGifts).filter(([, g]) => isTome(g)).map(([k]) => Number(k))
      if (tomes.length) score -= Math.min(...tomes.map((t) => dist(player, t, size))) * 10
    }
  }
  return score + Math.random() * 6
}

export function play(level) {
  let board = makeBoard(level)
  let gifts = {}
  let power = 0
  let hearts = 3
  let bossKilledAt = null
  for (let m = 0; m < MAX_MOVES; m++) {
    const options = DIRS
      .map((d) => [d, computeMove(board, gifts, level, economy, d, noDrops, power)])
      .filter(([, r]) => r.changed && !r.steppedOnSpike && !r.doorSealed && !(r.bumpedBoss && r.motions.length === 0))
    if (!options.length) return { win: false, moves: m, why: 'stuck' }
    options.sort((a, b) => scoreOf(b[1], gifts, level.size) - scoreOf(a[1], gifts, level.size))
    const choice = options[0][0]
    const res = computeMove(board, gifts, level, economy, choice, Math.random, power)
    let castLeft = res.tomesCast
    for (const g of res.collected) {
      if (g.type !== 'equipment') continue
      if (isTome(g) && castLeft > 0) { castLeft--; continue }
      power += g.item.power
    }
    if (res.bossDefeated) bossKilledAt = m + 1
    if (res.bossHitPlayer && --hearts <= 0) return { win: false, moves: m + 1, why: 'boss' }
    if (res.reachedDoor) return { win: true, moves: m + 1, bossKilledAt }
    board = addRandomTile(res.board)
    gifts = res.floorGifts
    if (!hasAnyMove(board, gifts, level, economy, power)) return { win: false, moves: m + 1, why: 'no moves' }
  }
  return { win: false, moves: MAX_MOVES, why: 'timeout' }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain) console.log('level\tsize\ttarget\tboss\twins\tavgMoves\tlosses')
if (isMain) for (const level of config.levels.filter((l) => l.id >= FROM && l.id <= TO && (!BOSS_ONLY || l.hasBoss))) {
  const results = Array.from({ length: RUNS }, () => play(level))
  const wins = results.filter((r) => r.win)
  const losses = {}
  results.filter((r) => !r.win).forEach((r) => { losses[r.why] = (losses[r.why] ?? 0) + 1 })
  const avg = wins.length ? Math.round(wins.reduce((s, r) => s + r.moves, 0) / wins.length) : '-'
  const killed = wins.filter((r) => r.bossKilledAt)
  const bossInfo = level.hasBoss
    ? `hp ${level.bossHp}, killed@${killed.length ? Math.round(killed.reduce((s, r) => s + r.bossKilledAt, 0) / killed.length) : '-'}`
    : ''
  console.log(`L${level.id}\t${level.size}x${level.size}\t${level.targetFormula.join('+')}\t${bossInfo}\t${wins.length}/${RUNS}\t${avg}\t${JSON.stringify(losses)}`)
}
