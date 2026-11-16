// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshSave, loadSave, migrateV1, parseSave, parseSaveV1, recordWin, starsForLevel } from '../lib/save.ts'

const v2 = (over = {}) => ({ ...freshSave(), ...over })
const json = (o) => JSON.stringify(o)

test('missing or corrupt save starts fresh', () => {
  assert.deepEqual(parseSave(null, 100), freshSave())
  assert.deepEqual(parseSave('{not json', 100), freshSave())
  assert.deepEqual(parseSave('{"version":3,"unlocked":50}', 100), freshSave())
  assert.deepEqual(parseSave('[]', 100), freshSave())
})

test('valid v2 save round-trips', () => {
  const save = v2({ unlocked: 12, current: 7, gold: 340, records: { 3: { bestMoves: 40, bestScore: 500 } },
    stars: 9, talents: { goldRate: 3, basePower: 1 }, stash: { hammer: 2, purge2: 0, purge4: 1, heartPotion: 0 }, settings: { sound: false } })
  assert.deepEqual(parseSave(json(save), 100), save)
})

test('out-of-range values are clamped, not trusted', () => {
  const s = parseSave(json({ version: 2, unlocked: 999, current: 500, gold: -5, records: { 400: { bestMoves: 1, bestScore: 1 }, x: {} },
    stars: -3, talents: { goldRate: 99, basePower: -2, 'bad key!': 3 }, stash: { hammer: -1, purge2: 'x', bogus: 5 } }), 100)
  assert.equal(s.unlocked, 99)
  assert.equal(s.current, 99)
  assert.equal(s.gold, 0)
  assert.deepEqual(s.records, {})
  assert.equal(s.stars, 0)
  assert.deepEqual(s.talents, { goldRate: 14, basePower: 0 })
  assert.deepEqual(s.stash, { hammer: 0, purge2: 0, purge4: 0, heartPotion: 0 })
  assert.deepEqual(s.settings, { sound: true })
})

test('current level can never be beyond the unlocked level', () => {
  assert.equal(parseSave(json(v2({ unlocked: 2, current: 9 })), 100).current, 2)
})

test('stars per level: 1 for levels 1-10 ... 10 for 91-100, 550 in total', () => {
  assert.equal(starsForLevel(0), 1)
  assert.equal(starsForLevel(9), 1)
  assert.equal(starsForLevel(10), 2)
  assert.equal(starsForLevel(99), 10)
  assert.equal(Array.from({ length: 100 }, (_, i) => starsForLevel(i)).reduce((a, b) => a + b, 0), 550)
})

test('winning unlocks the next level, keeps best results, and pays stars only the first time', () => {
  let r = recordWin(freshSave(), 0, 30, 200, 100)
  assert.equal(r.starsEarned, 1)
  assert.equal(r.save.stars, 1)
  assert.equal(r.save.unlocked, 1)
  assert.deepEqual(r.save.records[0], { bestMoves: 30, bestScore: 200 })
  r = recordWin(r.save, 0, 45, 260, 100)
  assert.equal(r.starsEarned, 0, 'replay pays no stars')
  assert.equal(r.save.stars, 1)
  assert.equal(r.save.unlocked, 1, 'replaying an old level does not skip ahead')
  assert.deepEqual(r.save.records[0], { bestMoves: 30, bestScore: 260 })
  assert.equal(recordWin(freshSave(), 54, 30, 200, 100).starsEarned, 6, 'level 55 pays 6 stars')
})

test('winning an earlier level never re-locks progress, last level stays in range', () => {
  assert.equal(recordWin(v2({ unlocked: 10 }), 3, 20, 100, 100).save.unlocked, 10)
  assert.equal(recordWin(v2({ unlocked: 99 }), 99, 20, 100, 100).save.unlocked, 99)
})

test('v1 saves are still parsed (for migration) with the same validation', () => {
  const v1 = { version: 1, unlocked: 12, current: 7, gold: 340, records: { 3: { bestMoves: 40, bestScore: 500 } } }
  assert.deepEqual(parseSaveV1(json(v1), 100), v1)
  assert.equal(parseSaveV1(json({ ...v1, unlocked: 999 }), 100).unlocked, 99)
  assert.deepEqual(parseSaveV1('{nope', 100), { version: 1, unlocked: 0, current: 0, gold: 0, records: {} })
})

test('migrating v1 keeps progress and back-pays stars for cleared levels', () => {
  const v1 = parseSaveV1(json({ version: 1, unlocked: 15, current: 15, gold: 271, records: {
    0: { bestMoves: 20, bestScore: 100 }, 9: { bestMoves: 30, bestScore: 300 }, 14: { bestMoves: 50, bestScore: 900 } } }), 100)
  const s = migrateV1(v1)
  assert.equal(s.version, 2)
  assert.equal(s.unlocked, 15)
  assert.equal(s.current, 15)
  assert.equal(s.gold, 271)
  assert.deepEqual(s.records, v1.records)
  assert.equal(s.stars, 1 + 1 + 2, 'levels 1 and 10 pay 1, level 15 pays 2')
  assert.deepEqual(s.talents, {})
  assert.deepEqual(s.stash, { hammer: 0, purge2: 0, purge4: 0, heartPotion: 0 })
})

test('loadSave prefers a v2 save, migrates a v1 save, else starts fresh', () => {
  const v1raw = json({ version: 1, unlocked: 4, current: 2, gold: 50, records: { 0: { bestMoves: 9, bestScore: 9 } } })
  const v2raw = json(v2({ unlocked: 7, stars: 3 }))
  assert.deepEqual(loadSave(v2raw, v1raw, 100), { save: parseSave(v2raw, 100), migrated: false })
  const m = loadSave(null, v1raw, 100)
  assert.equal(m.migrated, true)
  assert.equal(m.save.unlocked, 4)
  assert.equal(m.save.stars, 1)
  assert.deepEqual(loadSave(null, null, 100), { save: freshSave(), migrated: false })
  assert.equal(loadSave('{broken', v1raw, 100).migrated, true, 'a broken v2 falls back to the v1 backup')
})

const run = (over = {}) => ({
  level: 2, moves: 7, score: 40, keys: 1, power: 15, hearts: 3, scrolls: { 2: 0, 4: 1 }, armor: 1, gauntlets: 2,
  board: ['player', 2, null, 4, null, 'stone', { type: 'numbered_stone', value: 8 }, null,
    null, null, 'exit', null, null, 8, null, { type: 'boss', hp: 12, maxHp: 20 }],
  floorGifts: { 2: { type: 'gold', amount: 30 }, 7: { type: 'equipment', item: { type: 'sword', power: 15 } } },
  ...over,
})
const withRun = (r, extra = {}) => JSON.stringify(v2({ unlocked: 5, current: 2, gold: 10, run: r, ...extra }))
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
  assert.equal(recordWin(s, 2, 30, 200, 100).save.run, undefined)
})

test('a v1 run in progress survives migration', () => {
  const raw = JSON.stringify({ version: 1, unlocked: 5, current: 2, gold: 10, records: {}, run: run() })
  assert.deepEqual(loadSave(null, raw, 100, size4).save.run, run())
})

test('older runs without gear charges load with 0 armor / gauntlets; bad values drop the run', () => {
  const { armor, gauntlets, ...old } = run()
  assert.deepEqual(parseSave(withRun(old), 100, size4).run, { ...old, armor: 0, gauntlets: 0 })
  assert.equal(parseSave(withRun(run({ armor: -1 })), 100, size4).run, undefined)
})
