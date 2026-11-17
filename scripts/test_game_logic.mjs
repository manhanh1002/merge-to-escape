// Run: node --test scripts/test_game_logic.mjs   (Node >= 23 strips TS types natively)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { computeMove, hasAnyMove, makeBoard, rollGift, isWallBetween, tomeDamage, tomesToKill, withoutWalls } from '../lib/game-logic.ts'

const config = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8'))
const economy = config.economyConfig
const never = () => 1 // rng that never drops gifts
const always = () => 0 // rng that always drops gifts

const lvl = (over = {}) => ({
  id: 999, size: 4, target: 16, targetFormula: [16], walls: [], stoneCoords: [], numberedStones: [],
  spikeTraps: [], hasBoss: false, bossHp: 0, ...over,
})
const ns = (value) => ({ type: 'numbered_stone', value })
const P = 'player'
// Build a 4x4 board from rows; player defaults into the bottom-right so it stays out of the way.
const grid = (...rows) => rows.flat()

test('every configured level starts with exactly one player at (0,0) and nothing overlapping', () => {
  for (const level of config.levels) {
    const board = makeBoard(level)
    assert.equal(board.filter((c) => c === 'player').length, 1, `level ${level.id} player count`)
    assert.equal(board[0], 'player', `level ${level.id} player position`)
    assert.equal(board.filter((c) => c === 'stone').length, level.initialStones, `level ${level.id} stones`)
    assert.equal(board.filter((c) => typeof c === 'object' && c?.type === 'numbered_stone').length, level.numberedStones.length)
    assert.equal(board.filter((c) => typeof c === 'number').length, 3, `level ${level.id} start tiles`)
  }
})

test('makeBoard is deterministic (no SSR hydration mismatch)', () => {
  const level = config.levels[11]
  assert.deepEqual(makeBoard(level), makeBoard(level))
})

test('numbered stone shatters when an equal tile crashes into it from behind', () => {
  const board = grid(
    [null, ns(8), null, 8],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, P],
  )
  const res = computeMove(board, {}, lvl(), economy, 'left', never)
  assert.equal(res.board[1], null, 'stone destroyed')
  assert.equal(res.board[2], null, 'tile consumed')
  assert.equal(res.board[3], null)
})

test('numbered stone is NOT destroyed by swiping away from it', () => {
  const board = grid(
    [8, ns(8), null, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, P],
  )
  const res = computeMove(board, {}, lvl(), economy, 'left', never)
  assert.deepEqual(res.board[1], ns(8))
  assert.equal(res.board[0], 8)
})

test('numbered stone is NOT destroyed through a wall', () => {
  const board = grid(
    [null, ns(8), 8, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, P],
  )
  const res = computeMove(board, {}, lvl({ walls: [{ row: 0, col: 1, type: 'vertical' }] }), economy, 'left', never)
  assert.deepEqual(res.board[1], ns(8))
  assert.equal(res.board[2], 8)
})

test('numbered stone with a different value just blocks', () => {
  const board = grid(
    [null, ns(8), null, 4],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, P],
  )
  const res = computeMove(board, {}, lvl(), economy, 'left', never)
  assert.deepEqual(res.board[1], ns(8))
  assert.equal(res.board[2], 4)
})

test('vertical wall blocks horizontal slides only on its own row', () => {
  const walls = [{ row: 0, col: 1, type: 'vertical' }]
  const board = grid(
    [null, null, 2, null],
    [null, null, 2, null],
    [null, null, null, null],
    [null, null, null, P],
  )
  const res = computeMove(board, {}, lvl({ walls }), economy, 'left', never)
  assert.equal(res.board[2], 2, 'row 0 tile stops at wall')
  assert.equal(res.board[4], 2, 'row 1 tile slides to the edge')
  const down = computeMove(board, {}, lvl({ walls }), economy, 'down', never)
  assert.equal(down.board[14], 4, 'vertical slide unaffected (2+2 merge to the bottom of column 2)')
})

test('player cannot walk through a wall', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  const res = computeMove(board, {}, lvl({ walls: [{ row: 0, col: 0, type: 'vertical' }] }), economy, 'right', never)
  assert.equal(res.playerMoved, false)
  assert.equal(res.board[0], P)
  assert.equal(isWallBetween(1, 0, 4, [{ row: 0, col: 0, type: 'vertical' }]), true, 'symmetric')
})

test('player collects a floor gift by sliding over it', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  const res = computeMove(board, { 1: { type: 'gold', amount: 30 } }, lvl(), economy, 'right', never)
  assert.deepEqual(res.collected, [{ type: 'gold', amount: 30 }])
  assert.equal(res.floorGifts[1], undefined)
})

test('the player slides all the way, like an item, and stops behind other pieces', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  const res = computeMove(board, {}, lvl(), economy, 'right', never)
  assert.equal(res.board[3], P)
  assert.deepEqual(res.motions, [{ from: 0, to: 3 }])
  const blocked = grid([P, null, null, 8], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  assert.equal(computeMove(blocked, {}, lvl(), economy, 'right', never).board[2], P, 'stops behind the 8')
  const walled = computeMove(board, {}, lvl({ walls: [{ row: 0, col: 1, type: 'vertical' }] }), economy, 'right', never)
  assert.equal(walled.board[1], P, 'stops at a wall')
})

test('everything slid over is picked up, in path order', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  const gifts = { 1: { type: 'gold', amount: 30 }, 2: { type: 'key' }, 3: { type: 'gold', amount: 10 } }
  const res = computeMove(board, gifts, lvl(), economy, 'right', never)
  assert.deepEqual(res.collected, [gifts[1], gifts[2], gifts[3]])
  assert.deepEqual(res.floorGifts, {})
})

test('sliding over a spike is deadly, even without stopping on it', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  assert.equal(computeMove(board, {}, lvl({ spikeTraps: [[0, 2]] }), economy, 'right', never).steppedOnSpike, true)
  const blocked = grid([P, 4, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  // the 4 slides onto the spike cell (tiles are safe), so the player stops at cell 2 and never crosses it
  assert.equal(computeMove(blocked, {}, lvl({ spikeTraps: [[0, 3]] }), economy, 'right', never).steppedOnSpike, false)
})

test('a door at the end of the slide is entered (win)', () => {
  const board = grid([P, null, null, 'exit'], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  const res = computeMove(board, {}, lvl(), economy, 'right', never)
  assert.equal(res.reachedDoor, true)
  assert.deepEqual(res.motions, [{ from: 0, to: 3 }])
  const walled = computeMove(board, {}, lvl({ walls: [{ row: 0, col: 2, type: 'vertical' }] }), economy, 'right', never)
  assert.equal(walled.reachedDoor, false, 'a wall in front of the door blocks it')
})

test('classic level: reaching the target turns that tile into the door', () => {
  const board = grid([8, 8, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  const res = computeMove(board, {}, lvl(), economy, 'left', never)
  assert.equal(res.board[0], 'exit')
  assert.equal(res.doorOpen, true)
})

test('fusion level: A + B fuses into the door and doorOpen is reported in the same move', () => {
  const level = lvl({ target: 48, targetFormula: [32, 16] })
  const board = grid([32, 16, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  const res = computeMove(board, {}, level, economy, 'left', never)
  assert.equal(res.board[0], 'exit')
  assert.equal(res.doorOpen, true)
})

test('fusion level: making a tile bigger than the target does NOT open the door', () => {
  const level = lvl({ target: 48, targetFormula: [32, 16] })
  const board = grid([32, 32, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  const res = computeMove(board, {}, level, economy, 'left', never)
  assert.equal(res.board[0], 64)
  assert.equal(res.doorOpen, false)
})

test('fusion level: two pairs in one swipe create only one door', () => {
  const level = lvl({ target: 48, targetFormula: [32, 16] })
  const board = grid([32, 16, null, null], [16, 32, null, null], [null, null, null, null], [null, null, null, P])
  const res = computeMove(board, {}, level, economy, 'left', never)
  assert.equal(res.board.filter((c) => c === 'exit').length, 1)
})

test('stepping on an exit wins', () => {
  const board = grid([P, 'exit', null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  const res = computeMove(board, {}, lvl(), economy, 'right', never)
  assert.equal(res.reachedDoor, true)
})

test('stepping on a spike trap kills the player; tiles slide over spikes normally', () => {
  const level = lvl({ spikeTraps: [[0, 1]] })
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null])
  assert.equal(computeMove(board, {}, level, economy, 'right', never).steppedOnSpike, true)
  const tiles = grid([null, null, null, 2], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  assert.equal(computeMove(tiles, {}, level, economy, 'left', never).board[0], 2)
})

test('no moves left is detected (lose condition)', () => {
  const board = grid([P, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4])
  assert.equal(hasAnyMove(board, {}, lvl(), economy), false)
  const open = grid([P, 2, 4, null], [2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4])
  assert.equal(hasAnyMove(open, {}, lvl(), economy), true)
})

test('gifts drop at the merge cell, survive tiles sliding over them, and are collected by the player', () => {
  const level = lvl({ target: 2048, requiredKeys: 1 })
  // wizard far away, so the key is not pulled in at once
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, 64, 64])
  const merge = computeMove(board, {}, level, economy, 'right', always)
  assert.equal(merge.board[15], 128)
  assert.deepEqual(merge.floorGifts[15], { type: 'key' }, 'a needed key is the first drop under the tile')
  // Tile slides away; gift stays on the floor.
  const away = computeMove(merge.board, merge.floorGifts, level, economy, 'up', never)
  assert.deepEqual(away.floorGifts[15], { type: 'key' })
  assert.notEqual(away.board[15], 128)
})

test('an existing gift is not overwritten by a new drop', () => {
  const level = lvl({ target: 2048 })
  const board = grid([null, null, null, null], [null, null, null, null], [null, null, null, null], [P, null, 64, 64])
  const res = computeMove(board, { 15: { type: 'gold', amount: 10 } }, level, economy, 'right', always)
  assert.deepEqual(res.floorGifts[15], { type: 'gold', amount: 10 })
})

test('rollGift uses item tables, and gold for tiles above 2048 uses the top rule', () => {
  assert.deepEqual(rollGift(8, economy, always), { type: 'equipment', item: { type: 'sword', power: 15 } })
  assert.deepEqual(rollGift(8, economy, always, false, true, true), { type: 'key' }, 'a wanted key comes first')
  assert.notEqual(rollGift(128, economy, always, false, false, false)?.type, 'key', 'keys never drop unless wanted')
  assert.equal(rollGift(4, economy, always), null)
  let calls = 0
  const goldOnly = () => (++calls <= 5 ? 1 : 0) // fail the 5 item rolls (no key wanted), hit gold
  assert.deepEqual(rollGift(4096, economy, goldOnly), { type: 'gold', amount: 2000 })
})

test('move result reports shattered stones (drives the attack animation)', () => {
  const board = grid([null, ns(8), null, 8], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  assert.equal(computeMove(board, {}, lvl(), economy, 'left', never).shattered, 1)
  const plain = grid([2, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  assert.equal(computeMove(plain, {}, lvl(), economy, 'left', never).shattered, 0)
})

test('move result reports bumping into a wall (drives the hurt animation)', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, 2], [null, null, null, null])
  const walls = [{ row: 0, col: 0, type: 'vertical' }]
  assert.equal(computeMove(board, {}, lvl({ walls }), economy, 'right', never).bumpedWall, true)
  assert.equal(computeMove(board, {}, lvl(), economy, 'right', never).bumpedWall, false)
  assert.equal(computeMove(board, {}, lvl({ walls }), economy, 'left', never).bumpedWall, false, 'board edge is not a wall')
})

const boss = (hp, maxHp = hp) => ({ type: 'boss', hp, maxHp })
// level 45: past the easier chapter-1 bosses
const bossLvl = (over = {}) => lvl({ id: 15, hasBoss: true, bossHp: 30, ...over })
const tome = { type: 'equipment', item: { type: 'sword', power: 15 } }
const S = null

test('the boss slides with the swipe like an item that never merges', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, 4, S, boss(30)])
  const res = computeMove(board, {}, bossLvl(), economy, 'left', never)
  assert.equal(res.board[12], 4)
  assert.deepEqual(res.board[13], boss(30), 'boss slid in behind the 4')
  assert.ok(res.motions.some((m) => m.from === 15 && m.to === 13), 'boss slide is animated')
})

test('tiles pushed into the boss just stop: no damage', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, 8, boss(30)])
  const res = computeMove(board, {}, bossLvl(), economy, 'right', never)
  assert.deepEqual(res.board[15], boss(30))
  assert.equal(res.board[14], 8)
  assert.equal(res.bossDamage, 0)
})

test('the boss stops at stones and walls', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], ['stone', S, S, boss(30)])
  assert.deepEqual(computeMove(board, {}, bossLvl(), economy, 'left', never).board[13], boss(30))
  const walled = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(30)])
  const res = computeMove(walled, {}, bossLvl({ walls: [{ row: 3, col: 2, type: 'vertical' }] }), economy, 'left', never)
  assert.deepEqual(res.board[15], boss(30))
})

test('attack tomes drop from small merges while a boss is alive, not on normal levels', () => {
  assert.deepEqual(rollGift(4, economy, always, true), tome)
  assert.equal(rollGift(4, economy, always, false), null)
  // a merge on a boss level can drop a tome onto the floor
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [2, 2, S, boss(30)])
  const res = computeMove(board, {}, bossLvl(), economy, 'left', always)
  assert.deepEqual(res.floorGifts[12], tome)
})

test('walking over a tome blasts the boss: mid-boss takes maxHp/2, raised by Power %', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(30)])
  const res = computeMove(board, { 1: tome }, bossLvl(), economy, 'right', never)
  assert.deepEqual(res.collected, [tome])
  assert.equal(res.bossDamage, 15)
  assert.deepEqual(res.board[15], boss(15, 30))
  const geared = computeMove(board, { 1: tome }, bossLvl(), economy, 'right', never, 40)
  assert.equal(geared.bossDamage, 21, 'Power 40 = +40% on every tome (15 → 21)')
})

test('a final boss (level x10) takes maxHp/3 per tome', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(50)])
  const res = computeMove(board, { 1: tome }, bossLvl({ id: 20, bossHp: 50 }), economy, 'right', never)
  assert.equal(res.bossDamage, 17)
})

test('the last tome kills the boss, clears its cell and grants the reward', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(8, 30)])
  const res = computeMove(board, { 1: tome }, bossLvl(), economy, 'right', () => 0)
  assert.equal(res.bossDefeated, true)
  assert.equal(res.board[15], null)
  assert.equal(res.bossDamage, 8, 'overkill is not counted')
  assert.deepEqual(res.bossReward, { gold: 100, keys: 1 })
})

test('on a normal level a tome is just gear (no boss to blast)', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  const res = computeMove(board, { 1: tome }, lvl(), economy, 'right', never)
  assert.deepEqual(res.collected, [tome])
  assert.equal(res.bossDamage, 0)
})

test('the boss hits the player when it slides into contact', () => {
  const board = grid([P, S, S, boss(30)], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  const res = computeMove(board, {}, bossLvl(), economy, 'left', never)
  assert.deepEqual(res.board[1], boss(30))
  assert.equal(res.bossHitPlayer, true)
})

test('walking into a boss that cannot move: no step, and it hits the player', () => {
  const board = grid([P, boss(30), 2, 4], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  const res = computeMove(board, {}, bossLvl(), economy, 'right', never)
  assert.equal(res.bumpedBoss, true)
  assert.equal(res.bossHitPlayer, true)
  assert.equal(res.board[0], P)
})

test('standing still next to the boss is safe', () => {
  const board = grid([P, boss(30), S, S], [S, S, S, S], [S, S, 2, S], [S, S, S, S])
  const res = computeMove(board, {}, bossLvl(), economy, 'up', never) // only the 2 moves
  assert.equal(res.changed, true)
  assert.equal(res.bossHitPlayer, false)
})

test('the door stays sealed while the boss is alive, and opens once it is dead', () => {
  const sealed = grid([P, 'exit', S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(30)])
  const blocked = computeMove(sealed, {}, bossLvl(), economy, 'right', never)
  assert.equal(blocked.doorSealed, true)
  assert.equal(blocked.reachedDoor, false)
  assert.equal(blocked.board[0], P)
  const open = grid([P, 'exit', S, S], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  assert.equal(computeMove(open, {}, bossLvl(), economy, 'right', never).reachedDoor, true)
})

test('only walking into the boss (nothing else can move) is not an available move', () => {
  const board = grid([P, boss(30), 2, 4], [2, 4, 8, 2], [4, 8, 2, 4], [2, 4, 8, 2])
  assert.equal(hasAnyMove(board, {}, bossLvl(), economy), false)
})

const sortM = (ms) => [...ms].sort((a, b) => a.from - b.from || a.to - b.to)

test('motions: plain slides, merges and the player slide are recorded', () => {
  const board = grid([null, 2, null, 2], [null, null, 4, null], [null, null, null, null], [P, null, null, null])
  const res = computeMove(board, {}, lvl({ target: 2048 }), economy, 'left', never)
  assert.deepEqual(sortM(res.motions), sortM([
    { from: 1, to: 0, merged: true }, { from: 3, to: 0, merged: true }, // 2+2 -> cell 0
    { from: 6, to: 4 },                                                // 4 slides left
  ]), 'player at the left edge does not move')
  const step = computeMove(grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]), {}, lvl(), economy, 'right', never)
  assert.deepEqual(step.motions, [{ from: 0, to: 3 }], 'the player slides all the way')
})

test('motions: tiles that do not move are not listed', () => {
  const board = grid([2, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  assert.deepEqual(computeMove(board, {}, lvl(), economy, 'up', never).motions, [{ from: 15, to: 3 }])
})

test('motions: a tile crashing into a numbered stone flies in and vanishes', () => {
  const board = grid([null, ns(8), null, 8], [null, null, null, null], [null, null, null, null], [null, null, null, P])
  const res = computeMove(board, {}, lvl(), economy, 'left', never)
  assert.deepEqual(sortM(res.motions), sortM([{ from: 3, to: 1, vanish: true }, { from: 15, to: 12 }]), 'tile crash + player slide')
})

test('bossAt reports where the boss ended up (and where it died)', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(8, 30)])
  assert.equal(computeMove(board, {}, bossLvl(), economy, 'left', never).bossAt, 12, 'slid to the left edge')
  const kill = computeMove(board, { 1: tome }, bossLvl(), economy, 'right', never)
  assert.equal(kill.bossDefeated, true)
  assert.equal(kill.bossAt, 15)
})

test('two tomes slid over in one move blast the boss twice', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(30)])
  const res = computeMove(board, { 1: tome, 2: tome }, bossLvl(), economy, 'right', never)
  assert.equal(res.bossDamage, 30)
  assert.equal(res.bossDefeated, true)
})

test('after the boss is dead, merges no longer drop attack tomes', () => {
  // boss level, boss already defeated (not on the board); an 8 merge with rng that always hits
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [4, 4, S, S])
  const res = computeMove(board, {}, bossLvl(), economy, 'left', always)
  assert.equal(res.floorGifts[12], undefined, 'no tome (and nothing else qualifies for an 8)')
  assert.equal(rollGift(8, economy, always, false, false), null)
  // while the boss lives, the same merge drops a tome
  const alive = grid([P, S, S, S], [S, S, S, S], [S, S, S, boss(30)], [4, 4, S, S])
  assert.deepEqual(computeMove(alive, {}, bossLvl(), economy, 'left', always).floorGifts[12], tome)
})

test('killing the boss makes leftover tomes on the floor fade; other loot stays', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(10, 30)])
  const gold = { type: 'gold', amount: 30 }
  const res = computeMove(board, { 1: tome, 6: tome, 9: tome, 10: gold }, bossLvl(), economy, 'right', never)
  assert.equal(res.bossDefeated, true)
  assert.equal(res.tomesFaded, 2, 'the two tomes the player did not touch')
  assert.deepEqual(res.floorGifts, { 10: gold })
})

test('tomes stay on the floor while the boss is still alive', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, boss(30)])
  const res = computeMove(board, { 1: tome, 6: tome }, bossLvl(), economy, 'right', never)
  assert.equal(res.bossDefeated, false)
  assert.equal(res.tomesFaded, 0)
  assert.deepEqual(res.floorGifts, { 6: tome })
})

test('regular levels (no boss) never drop attack tomes', () => {
  // an 8 merge with an rng that always hits: only a tome would qualify, and tomes are boss-only
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [4, 4, S, S])
  assert.equal(computeMove(board, {}, lvl(), economy, 'left', always).floorGifts[12], undefined)
})

test('hammer: smashes a stone or a numbered stone, nothing else', async () => {
  const { applyHammer } = await import('../lib/game-logic.ts')
  const board = grid([P, 'stone', ns(8), 'exit'], [2, boss(30), S, S], [S, S, S, S], [S, S, S, S])
  assert.equal(applyHammer(board, 1)[1], null)
  assert.equal(applyHammer(board, 2)[2], null)
  assert.equal(applyHammer(board, 1)[2] !== null, true, 'only the target changes')
  for (const k of [0, 3, 4, 5, 6]) assert.equal(applyHammer(board, k), null, `cell ${k} cannot be smashed`)
})

test('purge scroll: removes every tile of that value and reports where', async () => {
  const { applyPurge } = await import('../lib/game-logic.ts')
  const board = grid([P, 2, 4, 2], [8, 2, S, 4], [S, S, S, S], [S, S, S, boss(30)])
  const two = applyPurge(board, 2)
  assert.deepEqual(two.removed, [1, 3, 5])
  assert.deepEqual(two.board.filter((c) => c === 2), [])
  assert.equal(two.board[2], 4)
  assert.deepEqual(applyPurge(board, 4).removed, [2, 7])
  assert.deepEqual(applyPurge(grid([P, 8, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, S]), 2).removed, [], 'nothing to purge')
})

test('heart potion: +1 heart up to the maximum, refused when full', async () => {
  const { applyHeartPotion } = await import('../lib/game-logic.ts')
  assert.equal(applyHeartPotion(1, 3), 2)
  assert.equal(applyHeartPotion(3, 3), null)
})

test('gauntlets: sliding into a stone or numbered stone shatters it (one charge)', () => {
  const board = grid([P, S, S, 'stone'], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  const res = computeMove(board, {}, lvl(), economy, 'right', never, 0, 1)
  assert.equal(res.smashedStone, 3)
  assert.equal(res.board[3], null)
  assert.equal(res.board[2], P, 'the wizard stops where he hit it')
  const ns8 = grid([P, ns(8), S, S], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  assert.equal(computeMove(ns8, {}, lvl(), economy, 'right', never, 0, 1).smashedStone, 1, 'already adjacent also counts')
})

test('gauntlets do nothing without charges, through a wall, or against other pieces', () => {
  const board = grid([P, S, S, 'stone'], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  assert.equal(computeMove(board, {}, lvl(), economy, 'right', never, 0, 0).smashedStone, -1)
  const walled = computeMove(board, {}, lvl({ walls: [{ row: 0, col: 2, type: 'vertical' }] }), economy, 'right', never, 0, 1)
  assert.equal(walled.smashedStone, -1)
  assert.equal(walled.board[3], 'stone')
  const tile = grid([P, S, S, 8], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  assert.equal(computeMove(tile, {}, lvl(), economy, 'right', never, 0, 1).smashedStone, -1)
})

test('spikesCrossed counts every spike slid over', () => {
  const board = grid([P, S, S, S], [S, S, S, S], [S, S, S, S], [S, S, S, S])
  const res = computeMove(board, {}, lvl({ spikeTraps: [[0, 1], [0, 3]] }), economy, 'right', never)
  assert.equal(res.spikesCrossed, 2)
  assert.equal(res.steppedOnSpike, true)
})

test('Rune of Passage: a dissolved wall no longer blocks, the others still do', () => {
  const walls = [{ row: 0, col: 1, type: 'vertical' }, { row: 3, col: 2, type: 'vertical' }]
  const level = lvl({ walls })
  const board = grid(
    [null, null, 2, null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, P],
  )
  assert.equal(computeMove(board, {}, level, economy, 'left', never).board[2], 2, 'wall 0 blocks')
  const opened = withoutWalls(level, [0])
  assert.equal(computeMove(board, {}, opened, economy, 'left', never).board[0], 2, 'wall 0 dissolved')
  assert.deepEqual(opened.walls, [walls[1]])
  assert.deepEqual(level.walls, walls, 'the level config is not changed')
  assert.equal(withoutWalls(level, []), level)
})

// ---------- keys, spikes, magnets, early bosses ----------
const keyGift = { type: 'key' }
const gold = (amount) => ({ type: 'gold', amount })

test('a door that needs keys stays shut until the player carries them', () => {
  const board = grid([P, 'exit', null, null], [null, null, null, null], [null, null, null, null], [null, null, null, 2])
  const level = lvl({ requiredKeys: 1 })
  const locked = computeMove(board, {}, level, economy, 'right', never, 0, 0, { keys: 0 })
  assert.equal(locked.reachedDoor, false)
  assert.equal(locked.doorLocked, true)
  assert.equal(computeMove(board, {}, level, economy, 'right', never, 0, 0, { keys: 1 }).reachedDoor, true)
  assert.equal(computeMove(board, {}, lvl(), economy, 'right', never).reachedDoor, true, 'no keys needed')
})

test('a key picked up on the way to the door opens it in the same move', () => {
  const board = grid([P, null, null, 'exit'], [null, null, null, null], [null, null, null, null], [null, null, null, 2])
  const res = computeMove(board, { 1: keyGift }, lvl({ requiredKeys: 1 }), economy, 'right', never, 0, 0, { keys: 0 })
  assert.equal(res.reachedDoor, true)
})

test('keys drop only while the level still needs them, never on boss levels', () => {
  const board = grid([P, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, 8, 8])
  const need = lvl({ target: 2048, requiredKeys: 1 })
  assert.deepEqual(computeMove(board, {}, need, economy, 'right', always).floorGifts[15], keyGift)
  assert.notDeepEqual(computeMove(board, {}, need, economy, 'right', always, 0, 0, { keys: 1 }).floorGifts[15], keyGift, 'already carried')
  assert.notDeepEqual(computeMove(board, { 4: keyGift }, need, economy, 'right', always).floorGifts[15], keyGift, 'already on the floor')
  assert.notDeepEqual(computeMove(board, {}, lvl({ target: 2048 }), economy, 'right', always).floorGifts[15], keyGift, 'no keys needed')
  const bossBoard = grid([P, null, null, boss(30)], [null, null, null, null], [null, null, null, null], [null, null, 8, 8])
  const res = computeMove(bossBoard, {}, bossLvl({ target: 2048, requiredKeys: 1 }), economy, 'right', always)
  assert.notDeepEqual(res.floorGifts[15], keyGift, 'boss levels: the boss drops the key')
})

test('spikes no longer stop the wizard at the door: he escapes (the page charges the heart)', () => {
  const board = grid([P, null, null, 'exit'], [null, null, null, null], [null, null, null, null], [null, null, null, 2])
  const res = computeMove(board, {}, lvl({ spikeTraps: [[0, 1]] }), economy, 'right', never)
  assert.equal(res.spikesCrossed, 1)
  assert.equal(res.reachedDoor, true)
})

const scroll = { type: 'scroll', targetValue: 2 }

test('keys always jump to a wizard stopping next to them; magnets pull gold, or everything', () => {
  const board = grid([null, null, null, null], [null, P, null, null], [null, null, null, null], [null, null, null, 2])
  const gifts = { 0: gold(10), 2: keyGift, 6: gold(30), 4: scroll, 15: gold(99) }
  // the wizard slides up to cell 1; neighbours are 0, 2, 4, 5, 6
  const none = computeMove(board, gifts, lvl(), economy, 'up', never)
  assert.deepEqual(none.collected, [keyGift], 'without a magnet only the key comes')
  const g = computeMove(board, gifts, lvl(), economy, 'up', never, 0, 0, { magnet: 'gold' })
  assert.deepEqual(g.collected.filter((x) => x.type === 'gold'), [gold(10), gold(30)])
  assert.ok(g.collected.includes(keyGift) && !g.collected.includes(scroll), 'gold magnet: gold (and keys), not other loot')
  const all = computeMove(board, gifts, lvl(), economy, 'up', never, 0, 0, { magnet: 'all' })
  assert.equal(all.collected.length, 4)
  assert.deepEqual(Object.keys(all.floorGifts), ['15'], 'far loot stays')
})

test('magnet-pulled tomes are cast at the boss like tomes slid over', () => {
  const board = grid([null, null, null, boss(60)], [P, null, null, null], [null, null, null, null], [null, null, null, null])
  const res = computeMove(board, { 4: tome }, bossLvl({ bossHp: 60 }), economy, 'up', never, 0, 0, { magnet: 'all' })
  assert.equal(res.tomesCast, 1)
  assert.ok(res.bossDamage > 0)
})

test('chapter-1 bosses fall to fewer tomes while players learn', () => {
  const hits = economy.bossTomeHits
  assert.equal(tomeDamage(100, 5, hits), 100, 'level 5: one tome')
  assert.equal(tomeDamage(100, 10, hits), 50, 'level 10: two tomes')
  assert.equal(tomeDamage(100, 15, hits), 50, 'level 15: back to two')
  assert.equal(tomeDamage(99, 20, hits), 33, 'level 20: three')
  assert.equal(tomeDamage(99, 20, hits, 50), 50, 'Power 50 = +50% (33 × 1.5, rounded up)')
})

test('later bosses need more tomes, so their HP really matters', () => {
  const hits = economy.bossTomeHits
  const need = (id) => tomesToKill(id, hits)
  assert.equal(need(20), 3)
  assert.equal(need(100), 11, 'final boss: 11 tomes without Power')
  assert.equal(need(95), 6)
  for (const id of [30, 50, 70, 90]) assert.ok(need(id + 10) > need(id), `final bosses keep growing at L${id + 10}`)
  for (const id of [15, 35, 55, 75]) assert.ok(need(id + 20) > need(id), `mid bosses keep growing at L${id + 20}`)
  assert.equal(tomeDamage(1000, 100, hits), 91)
  const maxPower = 140
  assert.equal(Math.ceil(1000 / tomeDamage(1000, 100, hits, maxPower)), 5, 'maxed Arcane Might still needs 5 tomes at L100')
  assert.equal(tomesToKill(100, { mid: 2, final: 3 }), 3, 'no growth configured: fixed counts')
})
