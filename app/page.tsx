'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ChevronDown, DoorOpen, HelpCircle, RotateCcw,
  Skull, Undo2, Volume2
} from 'lucide-react'
import gameConfig from '../lib/game_config.json'
import { LEGACY_SAVE_KEY, SAVE_KEY, freshSave, loadSave, recordWin, starsForLevel, type SaveData } from '../lib/save'
import { effectiveEconomy, gearPower, startingRun, type TalentConfig, type TalentLevels } from '../lib/talents'
import {
  addRandomTile, computeMove, hasAnyMove, isBoss, isFusionLevel, makeBoard as buildBoard, spikeCells,
  type Direction, type EconomyConfig, type FloorGift, type FloorGifts, type LevelConfig, type Motion, type Tile,
} from '../lib/game-logic'

const levels = gameConfig.levels as unknown as (LevelConfig & {
  name: string; chapter: number; chapterName: string; subtitle: string
})[]
const economy = gameConfig.economyConfig as unknown as EconomyConfig
const talentCfg = gameConfig.economyConfig.talentTreeConfig as unknown as TalentConfig

// Gold is the persistent wallet; keys, power and scrolls belong to the current run of a level.
// Hearts only matter on boss levels: each touch of the boss costs one. Talents (bought with
// stars) decide the Power and hearts a level starts with.
type Inventory = { gold: number; keys: number; power: number; hearts: number; scrolls: { 2: number; 4: number } }
const freshRun = (gold: number, talents: TalentLevels = {}): Inventory => {
  const start = startingRun(talents, talentCfg)
  return { gold, keys: 0, power: start.power, hearts: start.hearts, scrolls: { 2: 0, 4: 0 } }
}
type Snapshot = { board: Tile[]; moves: number; score: number; floorGifts: FloorGifts; inventory: Inventory }

const makeBoard = (levelIndex: number) => buildBoard(levels[levelIndex])

function applyGift(inv: Inventory, gift: FloorGift, talents: TalentLevels): Inventory {
  switch (gift.type) {
    case 'gold': return { ...inv, gold: inv.gold + gift.amount }
    case 'key': return { ...inv, keys: inv.keys + 1 }
    case 'equipment': return { ...inv, power: inv.power + gearPower(gift.item.power, talents, talentCfg) }
    case 'scroll': return { ...inv, scrolls: { ...inv.scrolls, [gift.targetValue]: inv.scrolls[gift.targetValue] + 1 } }
  }
}

/** Display names for the config's equipment slots (the "sword" is the wizard's spellbook). */
const EQUIPMENT_NAMES = { sword: 'Fire Tome', armor: 'Chest Armor', gauntlet: 'Gauntlets' } as const

function giftLabel(gift: FloorGift): string {
  switch (gift.type) {
    case 'gold': return `+${gift.amount} gold`
    case 'key': return 'Picked up a key'
    case 'equipment': return gift.item.type === 'sword'
      ? `Learned the ${EQUIPMENT_NAMES.sword} (+${gift.item.power} Power)`
      : `Equipped ${EQUIPMENT_NAMES[gift.item.type]} (+${gift.item.power} Power)`
    case 'scroll': return `Gained Purge [${gift.targetValue}] Scroll`
  }
}

const loot = (name: string) => `/assets/icons/loot/${name}.png`
const craft = (name: string) => `/assets/icons/craft/${name}.png`

// Painted art for everything that is not a merge tile (from public/assets/icons).
const item = (name: string) => `/assets/icons/items/${name}.png`

// CraftPix fantasy icon packs (scripts/import_icon_packs.py) for items and HUD;
// the painted sheets still provide the board art (boulders, scrolls, brand).
const ART = {
  gold: item('coins_gold'),
  key: item('key'),
  power: item('spellbook_arcane'),
  padlock: item('padlock'),
  medal: item('medal'),
  scroll: loot('old_parchment'),
  // The config's "sword" slot is the wizard's weapon: an attack spellbook.
  sword: item('spellbook_fire'),
  armor: item('chest_armor'),
  gauntlet: item('gauntlets'),
  stone: loot('boulder'),
  brand: craft('sapphire_stone'),
}

/** Bigger gold drops look richer: copper pile, silver pile, gold pile. */
const goldArt = (amount: number) => item(amount >= 250 ? 'coins_gold' : amount >= 60 ? 'coins_silver' : 'coins_copper')

// Wizard hero animations (public/assets/sprites/wizard, built by scripts/extract_wizard.py).
// Each strip holds 5 frames; loop actions repeat, one-shot actions hold their last frame.
type HeroAction = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'die'
const HERO_ACTIONS: HeroAction[] = ['idle', 'walk', 'run', 'jump', 'attack', 'hurt', 'die']
const heroStrip = (a: HeroAction) => `/assets/sprites/wizard/${a}.png`
const heroGif = (a: HeroAction) => `/assets/sprites/wizard/${a}.gif`
/** Short reactions that return to idle when they finish (jump/die stay on their last frame). */
const RETURNS_TO_IDLE = new Set<HeroAction>(['walk', 'run', 'attack', 'hurt'])

function WizardSprite({ action, nonce, facing, onDone }: {
  action: HeroAction; nonce: number; facing: 1 | -1; onDone: () => void
}) {
  return (
    <span
      key={`${action}-${nonce}`}
      className={`wizard wizard-${action}`}
      style={{ backgroundImage: `url(${heroStrip(action)})`, ['--face' as string]: facing }}
      onAnimationEnd={() => { if (RETURNS_TO_IDLE.has(action)) onDone() }}
      role="img"
      aria-label={`Wizard (${action})`}
    />
  )
}

// Bosses (public/assets/sprites/bosses, built by scripts/extract_bosses.py). Each chapter
// group has its own boss; the boss turns to face the player.
type BossKind = 'caveman' | 'goblin' | 'viking'
type BossAction = 'idle' | 'attack' | 'hurt' | 'dying'
type BossDir = 'front' | 'back' | 'left' | 'right'
const BOSS_NAMES: Record<BossKind, string> = { caveman: 'Grok the Caveman', goblin: 'Giant Goblin', viking: 'Viking Warlord' }
const BOSS_FRAMES: Record<BossAction, number> = { idle: 8, attack: 10, hurt: 10, dying: 10 }
const bossKindFor = (chapter: number): BossKind => (chapter <= 3 ? 'caveman' : chapter <= 7 ? 'goblin' : 'viking')
const bossClip = (kind: BossKind, action: BossAction, dir: BossDir) =>
  `/assets/sprites/bosses/${kind}/${action === 'dying' ? 'dying' : `${action}-${dir}`}.png`

/** Which way the boss at `boss` should look to face the player at `player`. */
function bossFacing(boss: number, player: number, size: number): BossDir {
  if (boss < 0 || player < 0) return 'front'
  const dr = Math.floor(player / size) - Math.floor(boss / size)
  const dc = (player % size) - (boss % size)
  // Same column: look straight up/down. Otherwise show the side profile toward the player
  // (the boss usually sits in a bottom corner, so 'back' would mostly show its head).
  if (dc === 0) return dr >= 0 ? 'front' : 'back'
  return dc > 0 ? 'right' : 'left'
}

function BossSprite({ kind, action, dir, nonce, onDone }: {
  kind: BossKind; action: BossAction; dir: BossDir; nonce: number; onDone: () => void
}) {
  const frames = BOSS_FRAMES[action]
  return (
    <span
      key={`${action}-${dir}-${nonce}`}
      className={`boss-sprite boss-${action}`}
      style={{ backgroundImage: `url(${bossClip(kind, action, dir)})`, ['--frames' as string]: frames }}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && action !== 'idle') onDone() }}
      role="img"
      aria-label={`${BOSS_NAMES[kind]} (${action})`}
    />
  )
}

function GiftArt({ gift }: { gift: FloorGift }) {
  const src = gift.type === 'gold' ? goldArt(gift.amount)
    : gift.type === 'key' ? ART.key
      : gift.type === 'scroll' ? ART.scroll
        : ART[gift.item.type]
  return <img src={src} alt="" draggable={false} />
}

function pieceKind(cell: Tile): string {
  if (cell === null) return ''
  if (typeof cell === 'number') return `item n${Math.min(cell, MAX_ICON_VALUE)}`
  if (typeof cell === 'string') return cell // player | exit | stone | locked_exit
  return cell.type === 'numbered_stone' ? 'numbered-stone' : 'boss'
}

// Merge chain art: raw materials -> refined metals -> gems, so bigger tiles look more valuable.
const TILE_ICONS: Record<number, string> = {
  2: 'wood_logs',
  4: 'wood_planks',
  8: 'stone_pile',
  16: 'copper_ore',
  32: 'iron_ore',
  64: 'silver_ingot',
  128: 'gold_ore',
  256: 'gold_ingot',
  512: 'sapphire_stone',
  1024: 'blue_crystal',
  2048: 'sapphire_crystals',
  4096: 'amethyst_stone',
  8192: 'green_scales',
}
const MAX_ICON_VALUE = 8192
const tileIconSrc = (value: number) => `/assets/icons/craft/${TILE_ICONS[Math.min(value, MAX_ICON_VALUE)] ?? TILE_ICONS[MAX_ICON_VALUE]}.png`

function renderTileIcon(value: number) {
  return <img src={tileIconSrc(value)} alt="" draggable={false} className="tile-item-img" />
}

const START_MESSAGE = 'Merge the stones to reach the exit.'

function statusMessage(level: LevelConfig, doorOpen: boolean, bossAlive = false) {
  if (bossAlive) return doorOpen
    ? 'The door is sealed while the boss lives. Walk over Fire Tomes to blast it.'
    : 'A boss roams this room. Merge to drop Fire Tomes, walk over them to blast it — and don\'t let it touch you.'
  if (doorOpen) return 'The door is open. Move onto it to escape.'
  if (isFusionLevel(level)) return `Slide ${level.targetFormula[0]} into ${level.targetFormula[1]} to fuse the door.`
  return 'Merge matching tiles to reveal the door.'
}

export default function Page() {
  const [levelIndex, setLevelIndex] = useState(0)
  const [board, setBoard] = useState<Tile[]>(() => makeBoard(0))
  const [floorGifts, setFloorGifts] = useState<FloorGifts>({})
  const [history, setHistory] = useState<Snapshot[]>([])
  const [moves, setMoves] = useState(0)
  const [score, setScore] = useState(0)
  const [inventory, setInventory] = useState<Inventory>(() => freshRun(0))
  const [message, setMessage] = useState(START_MESSAGE)
  const [hero, setHero] = useState<{ action: HeroAction; nonce: number }>({ action: 'idle', nonce: 0 })
  const [facing, setFacing] = useState<1 | -1>(1)
  const playHero = useCallback((action: HeroAction) => setHero((h) => ({ action, nonce: h.nonce + 1 })), [])
  const [won, setWon] = useState(false)
  /** Stars paid by the last win (0 on a replay), shown on the result card. */
  const [winStars, setWinStars] = useState<number | null>(null)
  const [lost, setLost] = useState(false)
  // Boss animation + transient effects. `corpseAt` keeps the dying animation on screen after
  // the boss cell has already been cleared by the rules.
  const [bossAnim, setBossAnim] = useState<{ action: BossAction; nonce: number; corpseAt: number | null }>({ action: 'idle', nonce: 0, corpseAt: null })
  const [popup, setPopup] = useState<{ text: string; at: number; nonce: number } | null>(null)
  // Last move's piece motions, so pieces slide from where they were instead of jumping.
  const [boardAnim, setBoardAnim] = useState<{ nonce: number; motions: Motion[]; prev: Tile[]; spawned: number } | null>(null)
  const playBoss = useCallback((action: BossAction, corpseAt: number | null = null) =>
    setBossAnim((b) => ({ action, nonce: b.nonce + 1, corpseAt })), [])
  const [progress, setProgress] = useState<SaveData>(freshSave)
  // Drop rates for this player's talents (goldRate / weaponRate), and boss-room max hearts.
  const runEconomy = useMemo(() => effectiveEconomy(economy, progress.talents, talentCfg), [progress.talents])
  const maxHearts = startingRun(progress.talents, talentCfg).hearts
  const [saveLoaded, setSaveLoaded] = useState(false)
  // ?dev in the URL opens every level for testing without touching the real save.
  const [devUnlockAll, setDevUnlockAll] = useState(false)
  const unlocked = devUnlockAll ? levels.length - 1 : progress.unlocked

  const level = levels[levelIndex]
  const spikes = spikeCells(level)

  const reset = useCallback((index = levelIndex) => {
    setBoard(makeBoard(index)); setFloorGifts({}); setHistory([]); setMoves(0); setScore(0); setWon(false); setLost(false)
    setInventory((inv) => freshRun(inv.gold, progress.talents))
    setMessage(levels[index].hasBoss ? statusMessage(levels[index], false, true) : START_MESSAGE)
    setHero((h) => ({ action: 'idle', nonce: h.nonce + 1 })); setFacing(1)
    setBossAnim((b) => ({ action: 'idle', nonce: b.nonce + 1, corpseAt: null })); setPopup(null); setBoardAnim(null)
    setWinStars(null)
  }, [levelIndex, progress.talents])

  const chooseLevel = useCallback((index: number) => {
    if (index > unlocked) return
    setLevelIndex(index); reset(index)
    setProgress((p) => ({ ...p, current: Math.min(index, p.unlocked) }))
  }, [reset, unlocked])

  // Load the save once on the client (localStorage is not available during SSR).
  useEffect(() => {
    let save = freshSave()
    try {
      // v2 save if present, otherwise migrate the v1 save (left in place as a backup)
      save = loadSave(window.localStorage.getItem(SAVE_KEY), window.localStorage.getItem(LEGACY_SAVE_KEY),
        levels.length, (i) => levels[i].size).save
    } catch { /* storage blocked */ }
    setDevUnlockAll(new URLSearchParams(window.location.search).has('dev'))
    setProgress(save)
    setLevelIndex(save.current); reset(save.current)
    const run = save.run
    if (run) {
      // Resume the unfinished level exactly where it was left (undo history is not kept).
      setBoard(run.board); setFloorGifts(run.floorGifts); setMoves(run.moves); setScore(run.score)
      setInventory({ gold: save.gold, keys: run.keys, power: run.power, hearts: run.hearts, scrolls: run.scrolls })
      setMessage(`Welcome back — your run is restored. ${statusMessage(levels[run.level], run.board.includes('exit'), run.board.some(isBoss))}`)
    } else {
      setInventory(freshRun(save.gold, save.talents))
    }
    setSaveLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist progress whenever it changes (after the initial load).
  useEffect(() => {
    if (!saveLoaded) return
    try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress)) } catch { /* storage full or blocked */ }
  }, [progress, saveLoaded])

  // Gold is a wallet that survives reloads.
  useEffect(() => {
    if (saveLoaded) setProgress((p) => (p.gold === inventory.gold ? p : { ...p, gold: inventory.gold }))
  }, [inventory.gold, saveLoaded])

  // Auto-save the level in progress after every move; a finished (won/lost) or untouched
  // level has nothing to resume.
  useEffect(() => {
    if (!saveLoaded) return
    const active = !won && !lost && moves > 0
    setProgress((p) => {
      if (!active) return p.run ? { ...p, run: undefined } : p
      const { keys, power, hearts, scrolls } = inventory
      return { ...p, run: { level: levelIndex, board, floorGifts, moves, score, keys, power, hearts, scrolls } }
    })
  }, [board, floorGifts, inventory, levelIndex, lost, moves, saveLoaded, score, won])

  const nextLevel = useCallback(() => {
    if (levelIndex < levels.length - 1) chooseLevel(levelIndex + 1)
    else reset(levelIndex)
  }, [chooseLevel, levelIndex, reset])

  const move = useCallback((direction: Direction) => {
    if (won || lost) return
    const res = computeMove(board, floorGifts, level, runEconomy, direction, Math.random, inventory.power)
    if (!res.changed) return

    // Attack tomes picked up while a boss lives are cast at it, not kept as Power; every other
    // item slid over goes into the bag.
    const tomeCast = res.tomesCast > 0
    let castLeft = res.tomesCast
    let nextInventory = inventory
    for (const gift of res.collected) {
      if (castLeft > 0 && gift.type === 'equipment' && gift.item.type === 'sword') { castLeft--; continue }
      nextInventory = applyGift(nextInventory, gift, progress.talents)
    }
    if (res.bossReward) {
      nextInventory = { ...nextInventory, gold: nextInventory.gold + res.bossReward.gold, keys: nextInventory.keys + res.bossReward.keys }
    }
    if (res.bossHitPlayer) nextInventory = { ...nextInventory, hearts: nextInventory.hearts - 1 }
    const slain = res.bossHitPlayer && nextInventory.hearts <= 0
    const finished = res.reachedDoor || res.steppedOnSpike || slain
    const nextBoard = finished ? res.board : addRandomTile(res.board)
    const spawned = nextBoard.findIndex((c, i) => c !== null && res.board[i] === null)
    setBoardAnim((a) => ({ nonce: (a?.nonce ?? 0) + 1, motions: res.motions, prev: board, spawned }))
    if (tomeCast) setPopup((p) => ({ text: `-${res.bossDamage}`, at: res.bossAt, nonce: (p?.nonce ?? 0) + 1 }))

    setHistory((h) => [...h, { board, moves, score, floorGifts, inventory }])
    setBoard(nextBoard); setFloorGifts(res.floorGifts); setInventory(nextInventory)
    setMoves((m) => m + 1); setScore((s) => s + res.gained)

    if (direction === 'left') setFacing(-1)
    if (direction === 'right') setFacing(1)

    if (res.reachedDoor) {
      playHero('jump'); setWon(true); setMessage('You made it out!')
      setWinStars(progress.records[levelIndex] ? 0 : starsForLevel(levelIndex))
      setProgress((p) => recordWin(p, levelIndex, moves + 1, score + res.gained, levels.length).save)
      return
    }
    const bossName = BOSS_NAMES[bossKindFor(level.chapter)]
    if (slain) {
      playBoss('attack'); playHero('die'); setLost(true)
      setMessage(`${bossName} struck you down. Keep your distance and blast it with Fire Tomes.`)
      return
    }
    if (res.steppedOnSpike) { playHero('die'); setLost(true); setMessage('You stepped into a deadly Spike Trap!'); return }
    if (!hasAnyMove(nextBoard, res.floorGifts, level, runEconomy, nextInventory.power)) { playHero('die'); setLost(true); setMessage('No moves left — the room has sealed shut.'); return }

    // Boss reacts: swings when it touches you, dies, or flinches from a tome.
    if (res.bossHitPlayer) playBoss('attack')
    else if (res.bossDefeated) playBoss('dying', res.bossAt)
    else if (tomeCast) playBoss('hurt')
    // The wizard reacts: casts on a tome/stone, ouch on a hit or wall, steps otherwise.
    if (res.bossHitPlayer || res.bumpedWall || res.doorSealed) playHero('hurt')
    else if (tomeCast || res.shattered > 0) playHero('attack')
    else if (res.playerMoved) {
      // a long slide is a run, a short one a walk
      const slide = res.motions.find((m) => m.from === board.indexOf('player'))
      const dist = slide ? Math.abs((slide.to % level.size) - (slide.from % level.size)) + Math.abs(Math.floor(slide.to / level.size) - Math.floor(slide.from / level.size)) : 1
      playHero(dist >= 2 ? 'run' : 'walk')
    }

    const note = res.bossReward
      ? `${bossName} is defeated! +${res.bossReward.gold} gold, +${res.bossReward.keys} key.${res.tomesFaded ? ' The unused Fire Tomes fade away.' : ''} `
      : tomeCast
        ? `🔥 ${res.tomesCast > 1 ? `${res.tomesCast} Fire Tomes blast` : 'The Fire Tome blasts'} ${bossName} for ${res.bossDamage}! `
        : res.collected.length ? `${res.collected.map(giftLabel).join(', ')}. ` : ''
    setMessage(
      res.bossHitPlayer
        ? `${bossName} hits you! ${nextInventory.hearts} ❤️ left — don't let it touch you.`
        : res.doorSealed
          ? 'The door is sealed — defeat the boss first. Walk over Fire Tomes to blast it!'
          : note + statusMessage(level, res.doorOpen, res.board.some(isBoss)),
    )
  }, [board, floorGifts, inventory, level, levelIndex, lost, moves, playBoss, playHero, progress.records, progress.talents, runEconomy, score, won])

  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory(history.slice(0, -1))
    setBoard(previous.board); setMoves(previous.moves); setScore(previous.score)
    setFloorGifts(previous.floorGifts); setInventory(previous.inventory)
    setWon(false); setLost(false)
    playHero('idle'); playBoss('idle'); setPopup(null); setBoardAnim(null)
    setMessage(statusMessage(level, previous.board.includes('exit'), previous.board.some(isBoss)))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
      if (keys[event.key]) { event.preventDefault(); move(keys[event.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  // Warm the image cache so a newly merged value never pops in late.
  useEffect(() => {
    Object.keys(TILE_ICONS).forEach((v) => { new Image().src = tileIconSrc(Number(v)) })
    HERO_ACTIONS.forEach((a) => { new Image().src = heroStrip(a) })
  }, [])

  // Preload only this level's boss (all three bosses together are ~12 MB).
  useEffect(() => {
    if (!level.hasBoss) return
    const kind = bossKindFor(level.chapter)
    ;(['front', 'back', 'left', 'right'] as const).forEach((d) =>
      (['idle', 'attack', 'hurt'] as const).forEach((a) => { new Image().src = bossClip(kind, a, d) }))
    new Image().src = bossClip(kind, 'dying', 'front')
  }, [level])

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    setTouchStart({ x: touch.clientX, y: touch.clientY })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStart.x
    const dy = touch.clientY - touchStart.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) {
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left')
      else move(dy > 0 ? 'down' : 'up')
    }
    setTouchStart(null)
  }

  const bossIdx = board.findIndex(isBoss)
  const bossCellTile = bossIdx === -1 ? null : (board[bossIdx] as { hp: number; maxHp: number })
  const bossKind = bossKindFor(level.chapter)
  const bossDir = bossFacing(bossIdx === -1 ? (bossAnim.corpseAt ?? -1) : bossIdx, board.indexOf('player'), level.size)
  const bossAlive = bossIdx !== -1
  const tomeHits = economy.bossTomeHits ?? { mid: 2, final: 3 }
  const tomeDamage = bossCellTile ? Math.ceil(bossCellTile.maxHp / (level.id % 10 === 0 ? tomeHits.final : tomeHits.mid)) + inventory.power : 0
  const tomesLeft = bossCellTile ? Math.ceil(bossCellTile.hp / tomeDamage) : 0
  const iconSize = level.size >= 7 ? 22 : level.size === 6 ? 26 : level.size === 5 ? 32 : 38
  const specialSize = level.size >= 7 ? 26 : level.size === 6 ? 30 : level.size === 5 ? 36 : 44

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="icon-button" aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="brand">
          <div className="brand-mark"><img src={ART.brand} alt="" draggable={false} /></div>
          <span>Merge to Escape</span>
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Sound"><Volume2 size={19} /></button>
          <button className="icon-button" aria-label="Help"><HelpCircle size={19} /></button>
        </div>
      </header>

      <section className="game-content">
        <div className="purse" aria-label="Inventory">
          <span className="purse-chip gold" title="Gold"><img src={ART.gold} alt="" draggable={false} />{inventory.gold}</span>
          <span className="purse-chip keys" title="Keys"><img src={ART.key} alt="" draggable={false} />{inventory.keys}</span>
          <span className="purse-chip power" title="Power (spellbooks & gear)"><img src={ART.power} alt="" draggable={false} />{inventory.power}</span>
          <span className="purse-chip stars" title="Stars — earned by clearing a level for the first time"><i aria-hidden>★</i>{progress.stars}</span>
          {(inventory.scrolls[2] > 0 || inventory.scrolls[4] > 0) && (
            <span className="purse-chip scrolls" title="Purge scrolls (2 / 4)"><img src={ART.scroll} alt="" draggable={false} />{inventory.scrolls[2]}/{inventory.scrolls[4]}</span>
          )}
        </div>

        <div className="level-heading">
          <div>
            <p className="eyebrow">{level.chapterName} · Level {levelIndex + 1}</p>
            <h1>{level.name}</h1>
            <p className="subtitle">{level.subtitle}</p>
            {progress.records[levelIndex] && (
              <p className="best-record"><img src={ART.medal} alt="" draggable={false} />Cleared · best {progress.records[levelIndex].bestMoves} moves · {progress.records[levelIndex].bestScore} pts</p>
            )}
          </div>
          <div className="dropdown-wrapper">
            <select className="level-select-native" value={levelIndex} onChange={(e) => chooseLevel(Number(e.target.value))} aria-label="Select level">
              {levels.map((item, index) => (
                <option key={item.id} value={index} disabled={index > unlocked}>
                  {index > unlocked ? '🔒 ' : progress.records[index] ? '✓ ' : ''}{item.name}: {item.target} target ({item.size}x{item.size})
                </option>
              ))}
            </select>
            <div className="level-select-badge"><span>{level.name}</span><ChevronDown size={15} /></div>
          </div>
        </div>

        {level.hasBoss && (
          <div className={`boss-panel${bossAlive ? '' : ' defeated'}`}>
            <span className="boss-portrait" style={{ backgroundImage: `url(/assets/sprites/bosses/${bossKind}/idle-front.png)` }} aria-hidden />
            <div className="boss-panel-body">
              <div className="boss-panel-title">
                <span>{BOSS_NAMES[bossKind]}</span>
                <span className="hearts" title={`${inventory.hearts} of ${maxHearts} hearts`} aria-label={`${inventory.hearts} hearts`}>
                  {Array.from({ length: maxHearts }, (_, i) => <i key={i} className={i < inventory.hearts ? 'full' : ''}>♥</i>)}
                </span>
                <em>{bossCellTile ? `${bossCellTile.hp} / ${bossCellTile.maxHp} HP` : 'Defeated'}</em>
              </div>
              <div className="boss-panel-bar"><span style={{ width: `${bossCellTile ? (bossCellTile.hp / bossCellTile.maxHp) * 100 : 0}%` }} /></div>
              <div className={`boss-panel-hint${tomesLeft === 1 ? ' ready' : ''}`}>
                {!bossAlive
                  ? 'The door is unsealed.'
                  : <>
                      <img src={ART.sword} alt="" draggable={false} className="hint-tome" />
                      {`Each Fire Tome deals ${tomeDamage} — ${tomesLeft === 1 ? 'one more finishes it!' : `${tomesLeft} more to win.`} Don't let it touch you.`}
                    </>}
              </div>
            </div>
          </div>
        )}

        <div className="stats">
          <div><span>Target</span><strong>{level.targetFormula.join(' + ')}</strong></div>
          <div><span>Moves</span><strong>{moves}</strong></div>
          <div><span>Score</span><strong>{score}</strong></div>
        </div>

        <div className="board-wrap" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className={`board board-${level.size}x${level.size}`} style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }} aria-label="Game board">
            {board.map((cell, index) => {
              const gift = floorGifts[index]
              const isSpike = spikes.has(index)
              const row = Math.floor(index / level.size), col = index % level.size
              const offset = (from: number) => ({
                ['--dx' as string]: (from % level.size) - col,
                ['--dy' as string]: Math.floor(from / level.size) - row,
              })
              // Pieces arriving here this move: the one that stays, plus "ghosts" (the other
              // half of a merge, or tiles that flew in and were used up by a stone/boss).
              const arrivals = boardAnim?.motions.filter((m) => m.to === index) ?? []
              const primary = cell === null ? undefined : arrivals.find((m) => !m.vanish)
              const ghosts = arrivals.filter((m) => m !== primary)
              const spawnedHere = boardAnim?.spawned === index
              const stateClass = primary ? (primary.merged ? ' merged' : ' sliding') : spawnedHere ? ' spawned' : ''
              const animKey = primary || spawnedHere ? `m${boardAnim?.nonce}` : 'still'
              return (
                <div className={`cell${isSpike ? ' has-spike' : ''}${cell !== null ? ' occupied' : ''}`} key={index}>
                  {isSpike && (
                    <div className="floor-spike" aria-label="Spike trap"><Skull size={iconSize} strokeWidth={2.2} /></div>
                  )}
                  {gift && <div className="floor-gift"><GiftArt gift={gift} /></div>}

                  {cell !== null && (
                    <div
                      key={animKey}
                      className={`piece ${pieceKind(cell)}${stateClass}${cell === 'exit' && bossAlive ? ' sealed' : ''}`}
                      style={primary ? offset(primary.from) : undefined}
                    >
                      {cell === 'stone' ? (
                        <div className="special-tile-content"><img className="art" src={ART.stone} alt="Stone" draggable={false} /></div>
                      ) : cell === 'player' ? (
                        <div className="special-tile-content">
                          <WizardSprite action={hero.action} nonce={hero.nonce} facing={facing} onDone={() => playHero('idle')} />
                        </div>
                      ) : cell === 'exit' ? (
                        <div className="special-tile-content">
                          <span className="portal">{bossAlive ? <img className="padlock" src={ART.padlock} alt="Sealed" draggable={false} /> : <DoorOpen size={specialSize} strokeWidth={2.4} />}</span>
                        </div>
                      ) : typeof cell === 'object' && cell.type === 'numbered_stone' ? (
                        <div className="special-tile-content">
                          <img className="art" src={ART.stone} alt="" draggable={false} />
                          <span className="rune-value">{cell.value}</span>
                        </div>
                      ) : typeof cell === 'object' && cell.type === 'boss' ? (
                        <div className="special-tile-content">
                          <BossSprite kind={bossKind} action={bossAnim.action === 'dying' ? 'idle' : bossAnim.action} dir={bossDir}
                            nonce={bossAnim.nonce} onDone={() => playBoss('idle')} />
                          <span className="boss-hp" title={`${cell.hp} / ${cell.maxHp} HP`}>
                            <span style={{ width: `${(cell.hp / cell.maxHp) * 100}%` }} />
                            <em>{cell.hp}</em>
                          </span>
                        </div>
                      ) : typeof cell === 'number' ? (
                        <div className="number-tile-content">{renderTileIcon(cell)}<span className="tile-value">{cell}</span></div>
                      ) : null}
                    </div>
                  )}

                  {ghosts.map((g, i) => {
                    const v = boardAnim?.prev[g.from]
                    if (typeof v !== 'number') return null
                    return (
                      <div key={`g${boardAnim?.nonce}-${i}`} className={`piece item n${Math.min(v, MAX_ICON_VALUE)} ghost${g.vanish ? ' crash' : ''}`} style={offset(g.from)} aria-hidden>
                        <div className="number-tile-content">{renderTileIcon(v)}<span className="tile-value">{v}</span></div>
                      </div>
                    )
                  })}

                  {cell === null && bossAnim.corpseAt === index && (
                    <div className="piece corpse">
                      <div className="special-tile-content">
                        <BossSprite kind={bossKind} action="dying" dir="front" nonce={bossAnim.nonce}
                          onDone={() => setBossAnim((b) => ({ ...b, action: 'idle', corpseAt: null }))} />
                      </div>
                    </div>
                  )}
                  {popup && popup.at === index && <span key={popup.nonce} className="dmg-popup">{popup.text}</span>}
                </div>
              )
            })}

            {/* Walls: one overlay cell per wall, aligned to the same grid as the tiles, so each
                wall is drawn on exactly the cell edge that blocks movement. */}
            <div className="wall-layer" style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)`, gridTemplateRows: `repeat(${level.size}, 1fr)` }} aria-hidden>
              {level.walls?.map((w, i) => (
                <div key={`wall-${i}`} className="wall-cell" style={{ gridRow: w.row + 1, gridColumn: w.col + 1 }}>
                  <span className={`wall-line wall-${w.type}`} />
                </div>
              ))}
            </div>
          </div>
          {(won || lost) && (
            <div className="result-card">
              <div className="result-icon"><img src={heroGif(won ? 'jump' : 'hurt')} alt="" draggable={false} /></div>
              <h2>{won ? (levelIndex === levels.length - 1 ? 'Champion!' : 'Escaped!') : 'Try again'}</h2>
              <p>{message}</p>
              {won && winStars !== null && (
                <p className={`star-line${winStars ? ' earned' : ''}`}>
                  {winStars ? <><i aria-hidden>★</i> +{winStars} {winStars === 1 ? 'star' : 'stars'} — first clear!</> : 'Replay — no stars this time'}
                </p>
              )}
              <div className="result-actions">
                {won && levelIndex < levels.length - 1 ? (
                  <button className="primary-button" onClick={nextLevel}>Next Level →</button>
                ) : (
                  <button className="primary-button" onClick={() => reset()}>{won ? 'Play From Start' : 'Play again'}</button>
                )}
                {lost && history.length > 0 ? (
                  <button className="secondary-button" onClick={undo}>Undo last move</button>
                ) : (
                  <button className="secondary-button" onClick={() => reset()}>Replay Level</button>
                )}
              </div>
            </div>
          )}
        </div>
        <p className="hint">{message}</p>
        <div className="controls">
          <button className="secondary-button" onClick={undo} disabled={history.length === 0}><Undo2 size={17} /> Undo</button>
          <button className="secondary-button" onClick={() => reset()}><RotateCcw size={17} /> Restart</button>
        </div>
        <div className="how-to">
          <h2>How to play</h2>
          <p>
            Swipe or use arrow keys — everything slides as far as it can, the wizard too, picking up whatever he slides over. {isFusionLevel(level)
              ? `Slide ${level.targetFormula[0]} directly into ${level.targetFormula[1]} to fuse the exit door.`
              : `Merge matching tiles until you reach ${level.target} — that tile becomes the door.`} Then
            move onto the door to escape. Numbered stones shatter when a tile of the same value crashes into them; never step on a spike trap. In boss rooms the boss slides with every swipe: merge to drop Fire Tomes and walk over them to blast it, but every time it touches you costs a heart.
          </p>
          <div className="legend">
            <span><img src={ART.stone} alt="" draggable={false} /> Obstacle</span>
            <span><img src="/assets/sprites/wizard/frames/idle_1.png" alt="" draggable={false} className="legend-hero" /> You</span>
            <span><DoorOpen size={16} /> Exit</span>
            <span><Skull size={16} /> Spike trap</span>
          </div>
        </div>
      </section>
    </main>
  )
}
