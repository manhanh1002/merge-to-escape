'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronDown, DoorOpen, Gem, HelpCircle, RotateCcw, Shield, Undo2, UserRound, Volume2 } from 'lucide-react'

type Level = { name: string; target: number; stones: number; subtitle: string; size: number }
type Tile = number | 'stone' | 'player' | 'exit' | null

type Snapshot = { board: Tile[]; moves: number; score: number }

const levels: Level[] = [
  { name: 'Easy', target: 64, stones: 1, subtitle: 'Find your way out', size: 4 },
  { name: 'Normal', target: 256, stones: 2, subtitle: 'Think two steps ahead', size: 5 },
  { name: 'Hard', target: 1024, stones: 3, subtitle: 'Master the maze', size: 6 },
]

// Stone obstacle positions by (row, col) coordinates for each level
const stoneCoordinates: [number, number][][] = [
  [[1, 1]], // Easy 4x4
  [[1, 2], [3, 2]], // Normal 5x5
  [[1, 2], [2, 4], [4, 1]], // Hard 6x6
]

function makeBoard(levelIndex: number): Tile[] {
  const lvl = levels[levelIndex]
  const size = lvl.size
  const board: Tile[] = Array(size * size).fill(null)
  board[0] = 'player'
  stoneCoordinates[levelIndex].forEach(([r, c]) => {
    board[r * size + c] = 'stone'
  })
  // Initial spawn tiles
  board[size - 1] = 2
  board[size * (size - 1)] = 2
  board[Math.floor((size * size) / 2)] = 4
  return board
}

function slideLine(line: Tile[]): { line: Tile[]; merged: number; moved: boolean } {
  const values = line.filter((cell): cell is number => typeof cell === 'number')
  const result: number[] = []
  let merged = 0
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const value = values[i] * 2
      result.push(value)
      merged += value
      i++
    } else result.push(values[i])
  }
  const output = [...result, ...Array(line.length - result.length).fill(null)]
  return { line: output, merged, moved: output.some((cell, index) => cell !== line[index]) }
}

function addRandomTile(board: Tile[]): Tile[] {
  const empty = board.flatMap((cell, index) => cell === null ? [index] : [])
  if (!empty.length) return board
  const next = [...board]
  const index = empty[Math.floor(Math.random() * empty.length)]
  next[index] = Math.random() < 0.9 ? 2 : 4
  return next
}

export default function Page() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [board, setBoard] = useState<Tile[]>(() => makeBoard(0))
  const [history, setHistory] = useState<Snapshot[]>([])
  const [moves, setMoves] = useState(0)
  const [score, setScore] = useState(0)
  const [message, setMessage] = useState('Merge the stones to reach the exit.')
  const [won, setWon] = useState(false)
  const [lost, setLost] = useState(false)

  const level = levels[levelIndex]
  const best = useMemo(() => Math.max(...board.filter((cell): cell is number => typeof cell === 'number'), 0), [board])

  const reset = useCallback((index = levelIndex) => {
    setBoard(makeBoard(index)); setHistory([]); setMoves(0); setScore(0); setWon(false); setLost(false)
    setMessage('Merge the stones to reach the exit.')
  }, [levelIndex])

  const chooseLevel = (index: number) => { setLevelIndex(index); reset(index) }

  const move = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (won || lost) return
    const previous: Snapshot = { board: [...board], moves, score }
    const player = board.indexOf('player')
    const exit = board.indexOf('exit')
    // The character and exit are hard collision boundaries for numbered tiles.
    // They must stay in the merge lanes, otherwise tiles would slide through them.
    const base = [...board]
    const next = [...board]
    let changed = false
    let gained = 0
    const size = level.size
    const indices = (r: number, c: number) => r * size + c
    const rows: number[][] = []
    for (let i = 0; i < size; i++) rows.push((direction === 'left' || direction === 'right') ? [...Array(size)].map((_, c) => indices(i, c)) : [...Array(size)].map((_, r) => indices(r, i)))
    rows.forEach((row) => {
      const ordered = direction === 'right' || direction === 'down' ? [...row].reverse() : row
      let segment: number[] = []
      const flush = () => {
        if (!segment.length) return
        const values = segment.map((idx) => base[idx])
        const result = slideLine(values)
        result.line.forEach((value, i) => { next[segment[i]] = value })
        changed ||= result.moved
        gained += result.merged
        segment = []
      }
      ordered.forEach((idx) => {
        const cell = base[idx]
        if (cell === 'stone' || cell === 'player' || cell === 'exit') {
          flush()
          next[idx] = cell
        } else segment.push(idx)
      })
      flush()
    })
    const playerRow = Math.floor(player / size), playerCol = player % size
    // Remove only the old character marker after tile sliding; it was a blocker during the slide.
    next[player] = null
    const delta = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[direction]
    const nextRow = Math.max(0, Math.min(size - 1, playerRow + delta[0]))
    const nextCol = Math.max(0, Math.min(size - 1, playerCol + delta[1]))
    const candidate = nextRow * size + nextCol
    const canMovePlayer = candidate !== player && (next[candidate] === null || next[candidate] === 'exit' || candidate === exit)
    const nextPlayer = canMovePlayer ? candidate : player
    if (canMovePlayer) changed = true
    if (!changed) return

    // Check if player stepped directly onto an existing exit
    const enteredExistingExit = exit !== -1 && nextPlayer === exit

    next[nextPlayer] = 'player'
    const afterSpawn = addRandomTile(next)

    // Check if any tile meets or exceeds target (or if door was already unlocked)
    const currentMaxTile = Math.max(
      ...afterSpawn.filter((cell): cell is number => typeof cell === 'number'),
      best,
      0
    )
    const targetIndex = afterSpawn.findIndex((cell) => typeof cell === 'number' && cell >= level.target)
    const doorUnlocked = targetIndex !== -1 || exit !== -1 || currentMaxTile >= level.target

    let doorIndex = exit
    if (doorIndex === -1 && targetIndex !== -1) {
      doorIndex = targetIndex
    }

    if (doorUnlocked && doorIndex !== -1 && doorIndex !== nextPlayer) {
      afterSpawn[doorIndex] = 'exit'
    }

    const reachedDoor = enteredExistingExit || (doorUnlocked && nextPlayer === doorIndex)
    if (reachedDoor) {
      afterSpawn[nextPlayer] = 'exit'
    } else {
      afterSpawn[nextPlayer] = 'player'
    }

    const nextMessage = doorUnlocked ? 'The door is open. Move onto it to escape.' : 'Merge matching tiles to reveal the door.'
    setHistory((items) => [...items, previous]); setBoard(afterSpawn); setMoves((value) => value + 1); setScore((value) => value + gained)
    if (reachedDoor) { setWon(true); setMessage('You made it out!') }
    else setMessage(nextMessage)
  }, [board, best, level.size, level.target, lost, moves, score, won])

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setBoard(previous.board); setMoves(previous.moves); setScore(previous.score); setHistory((items) => items.slice(0, -1)); setWon(false); setLost(false)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      if (keys[event.key]) { event.preventDefault(); move(keys[event.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="icon-button" aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="brand"><div className="brand-mark"><Gem size={18} /></div><span>Merge to Escape</span></div>
        <div className="top-actions"><button className="icon-button" aria-label="Sound"><Volume2 size={19} /></button><button className="icon-button" aria-label="Help"><HelpCircle size={19} /></button></div>
      </header>

      <section className="game-content">
        <div className="level-heading"><div><p className="eyebrow">LEVEL {levelIndex + 1} OF 3</p><h1>{level.name}</h1><p className="subtitle">{level.subtitle}</p></div><button className="level-select"><span>{level.name}</span><ChevronDown size={16} /></button></div>
        <div className="level-tabs">{levels.map((item, index) => <button key={item.name} className={index === levelIndex ? 'level-tab active' : 'level-tab'} onClick={() => chooseLevel(index)}><span className="tab-dot">{item.stones}</span>{item.name}<small>{item.target}</small></button>)}</div>

        <div className="stats"><div><span>BEST TILE</span><strong>{best || 0}</strong></div><div><span>MOVES</span><strong>{moves}</strong></div><div><span>SCORE</span><strong>{score}</strong></div></div>
        <div className="board-wrap">
          <div
            className={`board board-${level.size}x${level.size}`}
            style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}
            aria-label="Game board"
          >
            {board.map((cell, index) => (
              <div
                className={`tile ${cell === null ? 'empty' : typeof cell === 'number' ? `number n${Math.min(cell, 1024)}` : cell}`}
                key={index}
              >
                {cell === 'stone' ? <Shield size={level.size >= 6 ? 20 : 25} /> : cell === 'player' ? <UserRound size={level.size >= 6 ? 20 : 24} /> : cell === 'exit' ? <DoorOpen size={level.size >= 6 ? 20 : 25} /> : cell}
              </div>
            ))}
          </div>
          {(won || lost) && <div className="result-card"><div className="result-icon">{won ? <DoorOpen size={28} /> : <RotateCcw size={27} />}</div><h2>{won ? 'You escaped!' : 'Try again'}</h2><p>{message}</p><button className="primary-button" onClick={() => reset()}>Play again</button></div>}
        </div>
        <p className="hint">{message}</p>
        <div className="controls"><button className="secondary-button" onClick={undo} disabled={!history.length}><Undo2 size={17} /> Undo</button><button className="secondary-button" onClick={() => reset()}><RotateCcw size={17} /> Restart</button></div>
        <div className="how-to"><h2>HOW TO PLAY</h2><p>Swipe or use the arrow keys to move. Merge matching tiles until the target tile appears. That tile becomes the door — then move onto it to escape.</p><div className="legend"><span><Shield size={16} /> Obstacle</span><span><UserRound size={16} /> You</span><span><DoorOpen size={16} /> Exit</span></div></div>
        <p className="no-buffs"><Gem size={14} /> No paid buffs. Just clever moves.</p>
      </section>
    </main>
  )
}
