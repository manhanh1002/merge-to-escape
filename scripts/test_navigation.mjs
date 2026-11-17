// Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { freshSave } from '../lib/save.ts'
import { resolveStartLevel } from '../lib/navigation.ts'

const run = (level) => ({ level, moves: 3, score: 0, keys: 0, power: 0, hearts: 3, scrolls: { 2: 0, 4: 0 }, board: [], floorGifts: {} })
const save = (over = {}) => ({ ...freshSave(), unlocked: 9, current: 4, ...over })

test('no ?level: continue the current level, resuming its run if there is one', () => {
  assert.deepEqual(resolveStartLevel(null, save(), 100), { level: 4, resume: false })
  assert.deepEqual(resolveStartLevel('', save({ run: run(4) }), 100), { level: 4, resume: true })
})

test('?level=N is 1-based and opens any unlocked level fresh', () => {
  assert.deepEqual(resolveStartLevel('1', save(), 100), { level: 0, resume: false })
  assert.deepEqual(resolveStartLevel('10', save(), 100), { level: 9, resume: false })
})

test('?level of the current level resumes its run', () => {
  assert.deepEqual(resolveStartLevel('5', save({ run: run(4) }), 100), { level: 4, resume: true })
  assert.deepEqual(resolveStartLevel('3', save({ run: run(4) }), 100), { level: 2, resume: false }, 'other level starts fresh')
})

test('locked or invalid levels are refused (null -> back to Home)', () => {
  assert.equal(resolveStartLevel('11', save(), 100), null, 'locked (unlocked = index 9)')
  assert.equal(resolveStartLevel('0', save(), 100), null)
  assert.equal(resolveStartLevel('101', save(), 100), null)
  assert.equal(resolveStartLevel('abc', save(), 100), null)
  assert.equal(resolveStartLevel('2.5', save(), 100), null)
})

test('there is no unlock-all override: a locked level stays closed', () => {
  assert.equal(resolveStartLevel('100', save(), 100, true), null)
})
