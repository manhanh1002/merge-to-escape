// Balance check: a simple greedy bot plays every level N times and reports win rate and
// average moves. It is weaker than a human, so treat low win rates as "too hard" and very
// high move counts as "too long".
//   node scripts/simulate_levels.mjs [--runs 20] [--from 1] [--to 100] [--boss] [--talents expected]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { computeMove, hasAnyMove, makeBoard, addRandomTile } from '../lib/game-logic.ts'
import { freshSave, starsForLevel } from '../lib/save.ts'
import { levelEconomy } from '../lib/economy.ts'
import { TALENT_IDS, effectiveEconomy, startingRun, talentLevel, upgrade, upgradeCost } from '../lib/talents.ts'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(process.argv[i + 1])
}
const RUNS = arg('runs', 20)
const FROM = arg('from', 1)
const TO = arg('to', 100)
const BOSS_ONLY = process.argv.includes('--boss')
// --talents expected: assume the player spent every star earned before this level
const TALENTS = process.argv.includes('--talents') ? process.argv[process.argv.indexOf('--talents') + 1] : 'none'
const MAX_MOVES = 4000

const config = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8'))
const economy = config.economyConfig
const talentCfg = economy.talentTreeConfig

/** Talents of a player who cleared every level before `levelIndex` once and always bought the
 *  cheapest next level (so the five branches stay even). */
export function expectedTalents(levelIndex) {
  let save = { ...freshSave(), stars: Array.from({ length: levelIndex }, (_, i) => starsForLevel(i)).reduce((a, b) => a + b, 0) }
  for (;;) {
    const id = [...TALENT_IDS].sort((a, b) => talentLevel(save, a) - talentLevel(save, b))[0]
    if (talentLevel(save, id) >= talentCfg.maxLevel || save.stars < upgradeCost(talentLevel(save, id), talentCfg)) return save.talents
    save = upgrade(save, id, talentCfg)
  }
}
const DIRS = ['left', 'right', 'up', 'down']
const noDrops = () => 1

const isTome = (g) => g?.type === 'equipment' && g.item.type === 'sword'
const dist = (a, b, size) => Math.abs((a % size) - (b % size)) + Math.abs(Math.floor(a / size) - Math.floor(b / size))

/** Greedy look-ahead of one swipe. Everything (the wizard too) slides all the way, so the
 *  bot judges each swipe by its outcome: escape, tome blasts and pickups first, then
 *  getting closer to the door (or to a tome while the boss lives), then free space. */
function scoreOf(res, gifts, size, keysShort = 0) {
  if (res.reachedDoor) return 1e6
  const player = res.board.indexOf('player')
  const bossAlive = res.board.some((c) => c && typeof c === 'object' && c.type === 'boss')
  const keysPicked = res.collected.filter((g) => g.type === 'key').length
  let score = res.gained + res.bossDamage * 5 + res.collected.length * 25 + keysPicked * 300
    - (res.bossHitPlayer ? 400 : 0) - res.spikesCrossed * 300
  score += res.board.filter((c) => c === null).length * 3
  if (player !== -1) {
    const exit = res.board.indexOf('exit')
    const keys = Object.entries(res.floorGifts).filter(([, g]) => g.type === 'key').map(([k]) => Number(k))
    // still short of keys: head for the nearest key first, then the door
    if (!bossAlive && keysShort - keysPicked > 0 && keys.length) score -= Math.min(...keys.map((k) => dist(player, k, size))) * 15
    else if (!bossAlive && exit !== -1) score -= dist(player, exit, size) * 15
    if (bossAlive) {
      const tomes = Object.entries(res.floorGifts).filter(([, g]) => isTome(g)).map(([k]) => Number(k))
      if (tomes.length) score -= Math.min(...tomes.map((t) => dist(player, t, size))) * 10
    }
  }
  return score + Math.random() * 6
}

export function play(level, talents = TALENTS === 'expected' ? expectedTalents(level.id - 1) : {}) {
  const economy = levelEconomy(effectiveEconomy(config.economyConfig, talents, talentCfg), level.id)
  const start = startingRun(talents, talentCfg)
  let board = makeBoard(level)
  let gifts = {}
  const power = start.power
  let hearts = start.hearts
  let armor = start.armor
  let gauntlets = 0
  let bossKilledAt = null
  let gold = 0
  let keys = 0
  for (let m = 0; m < MAX_MOVES; m++) {
    const options = DIRS
      .map((d) => [d, computeMove(board, gifts, level, economy, d, noDrops, power, gauntlets, { keys })])
      // never take a swipe whose spikes would cost the last heart
      .filter(([, r]) => r.changed && r.spikesCrossed - armor < hearts && !r.doorSealed && !(r.bumpedBoss && r.motions.length === 0))
    if (!options.length) return { win: false, moves: m, why: 'stuck' }
    const short = Math.max(0, (level.requiredKeys ?? 0) - keys)
    options.sort((a, b) => scoreOf(b[1], gifts, level.size, short) - scoreOf(a[1], gifts, level.size, short))
    const choice = options[0][0]
    const res = computeMove(board, gifts, level, economy, choice, Math.random, power, gauntlets, { keys })
    // gear gives charges: armor absorbs a hit, gauntlets shatter a stone slid into
    gold += res.bossReward?.gold ?? 0
    for (const g of res.collected) {
      if (g.type === 'gold') gold += g.amount
      if (g.type === 'key') keys++
      if (g.type !== 'equipment') continue
      if (g.item.type === 'armor') armor = Math.min(3, armor + 1)
      if (g.item.type === 'gauntlet') gauntlets = Math.min(3, gauntlets + 1)
    }
    if (res.smashedStone !== -1) gauntlets--
    // armor takes spikes first, the rest cost hearts
    const absorbed = Math.min(armor, res.spikesCrossed)
    armor -= absorbed
    hearts -= res.spikesCrossed - absorbed
    if (hearts <= 0) return { win: false, moves: m + 1, why: 'spike' }
    if (res.bossReward) keys += res.bossReward.keys
    if (res.bossDefeated) bossKilledAt = m + 1
    if (res.bossHitPlayer) {
      if (armor > 0) armor--
      else if (--hearts <= 0) return { win: false, moves: m + 1, why: 'boss' }
    }
    if (res.reachedDoor) return { win: true, moves: m + 1, bossKilledAt, gold }
    board = addRandomTile(res.board)
    gifts = res.floorGifts
    if (!hasAnyMove(board, gifts, level, economy, power, gauntlets, { keys })) return { win: false, moves: m + 1, why: 'no moves' }
  }
  return { win: false, moves: MAX_MOVES, why: 'timeout' }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isMain && TALENTS === 'expected') console.log('# talents: expected (all stars from earlier first clears spent evenly)')
if (isMain) console.log('level\tsize\ttarget\tboss\twins\tavgMoves\tlosses\tavgGoldPerWin')
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
  const gold = wins.length ? Math.round(wins.reduce((s, r) => s + r.gold, 0) / wins.length) : '-'
  console.log(`L${level.id}\t${level.size}x${level.size}\t${level.targetFormula.join('+')}\t${bossInfo}\t${wins.length}/${RUNS}\t${avg}\t${JSON.stringify(losses)}\tgold ${gold}`)
}
