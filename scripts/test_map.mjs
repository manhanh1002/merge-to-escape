// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { freshSave } from '../lib/save.ts'
import { chapterSummaries, levelStatus } from '../lib/map.ts'

const levels = JSON.parse(readFileSync(new URL('../lib/game_config.json', import.meta.url), 'utf8')).levels
const rec = { bestMoves: 20, bestScore: 100 }
const save = (over = {}) => ({ ...freshSave(), ...over })

test('level status: locked beyond unlocked, current, cleared, otherwise open', () => {
  const s = save({ unlocked: 12, current: 11, records: { 0: rec, 3: rec } })
  assert.equal(levelStatus(0, s, 12), 'cleared')
  assert.equal(levelStatus(1, s, 12), 'open')
  assert.equal(levelStatus(11, s, 12), 'current')
  assert.equal(levelStatus(13, s, 12), 'locked')
  assert.equal(levelStatus(13, s, 99), 'open', 'dev unlock-all opens everything')
})

test('a cleared level that is also the current one reads as current', () => {
  assert.equal(levelStatus(3, save({ unlocked: 5, current: 3, records: { 3: rec } }), 5), 'current')
})

test('ten chapters of ten levels with names, boss levels and board sizes', () => {
  const ch = chapterSummaries(levels, save(), 0)
  assert.equal(ch.length, 10)
  assert.deepEqual(ch.map((c) => [c.from, c.to]), Array.from({ length: 10 }, (_, i) => [i * 10, i * 10 + 9]))
  assert.equal(ch[0].name, 'The Catacombs')
  assert.deepEqual(ch[0].bossLevels, [4, 9])
  assert.deepEqual(ch[0].sizes, [4])
  assert.deepEqual(ch[3].sizes, [5], 'levels 31-40 are 5x5')
  assert.deepEqual(ch[7].sizes, [7])
})

test('chapter progress: cleared count and stars earned / available', () => {
  const s = save({ unlocked: 25, current: 25, records: { 0: rec, 1: rec, 9: rec, 10: rec, 19: rec } })
  const ch = chapterSummaries(levels, s, 25)
  assert.equal(ch[0].cleared, 3)
  assert.equal(ch[0].starsEarned, 3)
  assert.equal(ch[0].starsTotal, 10)
  assert.equal(ch[1].cleared, 2)
  assert.equal(ch[1].starsEarned, 4, 'chapter 2 pays 2 stars per level')
  assert.equal(ch[1].starsTotal, 20)
  assert.equal(ch[9].starsTotal, 100)
})

test('a chapter is locked until its first level is unlocked; current chapter is flagged', () => {
  const ch = chapterSummaries(levels, save({ unlocked: 10, current: 10 }), 10)
  assert.equal(ch[0].locked, false)
  assert.equal(ch[1].locked, false, 'level 11 (index 10) is unlocked')
  assert.equal(ch[2].locked, true)
  assert.equal(ch.findIndex((c) => c.isCurrent), 1)
})
