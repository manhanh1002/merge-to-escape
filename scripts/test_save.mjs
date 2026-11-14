// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshSave, parseSave, recordWin } from '../lib/save.ts'

test('missing or corrupt save starts fresh', () => {
  assert.deepEqual(parseSave(null, 100), freshSave())
  assert.deepEqual(parseSave('{not json', 100), freshSave())
  assert.deepEqual(parseSave('{"version":2,"unlocked":50}', 100), freshSave())
  assert.deepEqual(parseSave('[]', 100), freshSave())
})

test('valid save round-trips', () => {
  const save = { version: 1, unlocked: 12, current: 7, gold: 340, records: { 3: { bestMoves: 40, bestScore: 500 } } }
  assert.deepEqual(parseSave(JSON.stringify(save), 100), save)
})

test('out-of-range values are clamped, not trusted', () => {
  const s = parseSave(JSON.stringify({ version: 1, unlocked: 999, current: 500, gold: -5, records: { 400: { bestMoves: 1, bestScore: 1 }, x: {} } }), 100)
  assert.equal(s.unlocked, 99)
  assert.equal(s.current, 99)
  assert.equal(s.gold, 0)
  assert.deepEqual(s.records, {})
})

test('current level can never be beyond the unlocked level', () => {
  const s = parseSave(JSON.stringify({ version: 1, unlocked: 2, current: 9, gold: 0, records: {} }), 100)
  assert.equal(s.current, 2)
})

test('winning unlocks the next level and keeps best results', () => {
  let s = recordWin(freshSave(), 0, 30, 200, 100)
  assert.equal(s.unlocked, 1)
  assert.deepEqual(s.records[0], { bestMoves: 30, bestScore: 200 })
  s = recordWin(s, 0, 45, 260, 100)
  assert.equal(s.unlocked, 1, 'replaying an old level does not skip ahead')
  assert.deepEqual(s.records[0], { bestMoves: 30, bestScore: 260 })
})

test('winning an earlier level never re-locks progress, last level stays in range', () => {
  const s = recordWin({ ...freshSave(), unlocked: 10 }, 3, 20, 100, 100)
  assert.equal(s.unlocked, 10)
  assert.equal(recordWin({ ...freshSave(), unlocked: 99 }, 99, 20, 100, 100).unlocked, 99)
})

const run = (over = {}) => ({
  level: 2, moves: 7, score: 40, keys: 1, power: 15, hearts: 3, scrolls: { 2: 0, 4: 1 },
  board: ['player', 2, null, 4, null, 'stone', { type: 'numbered_stone', value: 8 }, null,
    null, null, 'exit', null, null, 8, null, { type: 'boss', hp: 12, maxHp: 20 }],
  floorGifts: { 2: { type: 'gold', amount: 30 }, 7: { type: 'equipment', item: { type: 'sword', power: 15 } } },
  ...over,
})
const withRun = (r, extra = {}) => JSON.stringify({ version: 1, unlocked: 5, current: 2, gold: 10, records: {}, run: r, ...extra })
const size4 = () => 4

test('an in-progress run round-trips', () => {
  assert.deepEqual(parseSave(withRun(run()), 100, size4).run, run())
})

test('a run is dropped if the board is not playable', () => {
  assert.equal(parseSave(withRun(run({ board: run().board.slice(0, 9) })), 100, size4).run, undefined, 'wrong size')
  assert.equal(parseSave(withRun(run({ board: run().board.map((t) => (t === 'player' ? null : t)) })), 100, size4).run, undefined, 'no player')
  assert.equal(parseSave(withRun(run({ board: [...run().board.slice(0, 15), 'player'] })), 100, size4).run, undefined, 'two players')
  assert.equal(parseSave(withRun(run({ board: [...run().board.slice(0, 15), 3] })), 100, size4).run, undefined, 'not a power of two')
  assert.equal(parseSave(withRun(run({ board: [...run().board.slice(0, 15), { type: 'dragon' }] })), 100, size4).run, undefined, 'unknown piece')
  assert.equal(parseSave(withRun(run({ floorGifts: { 3: { type: 'chest' } } })), 100, size4).run, undefined, 'unknown gift')
  assert.equal(parseSave(withRun(run({ hearts: 0 })), 100, size4).run, undefined, 'dead run')
})

test('a run only resumes on the current, unlocked level', () => {
  assert.equal(parseSave(withRun(run(), { current: 3 }), 100, size4).run, undefined, 'player moved to another level')
  assert.equal(parseSave(withRun(run({ level: 9 }), { current: 9 }), 100, size4).run, undefined, 'level 9 is locked (unlocked = 5)')
})

test('winning a level clears the saved run', () => {
  const s = parseSave(withRun(run()), 100, size4)
  assert.ok(s.run)
  assert.equal(recordWin(s, 2, 30, 200, 100).run, undefined)
})
