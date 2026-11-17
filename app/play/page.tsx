'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DoorOpen, Map as MapIcon, RotateCcw, Skull, Undo2 } from 'lucide-react'
import { recordWin, starsForLevel, type Stash } from '../../lib/save'
import { effectiveEconomy, startingRun, type TalentLevels } from '../../lib/talents'
import { economy, levels, talentCfg } from '../../lib/levels'
import { resolveStartLevel } from '../../lib/navigation'
import { tomeFor } from '../../lib/tomes'
import { levelEconomy } from '../../lib/economy'
import {
  addRandomTile, applyHammer, applyHeartPotion, applyPurge, computeMove, hasAnyMove, isBoss, isFusionLevel, tomeDamage as tomeDamageFor, withoutWalls,
  makeBoard as buildBoard, spikeCells,
  type Direction, type FloorGift, type FloorGifts, type LevelConfig, type Motion, type Tile,
} from '../../lib/game-logic'
import { ART, goldArt } from '../../components/art'
import {
  BOSS_NAMES, BossSprite, HERO_ACTIONS, WizardSprite, bossClip, bossFacing, bossKindFor, heroGif, heroStrip,
  type BossAction, type HeroAction,
} from '../../components/sprites'
import { Purse } from '../../components/Purse'
import { BOOSTERS, BOOSTER_BAR } from '../../components/boosters'
import { magnetOf, type ShopItem } from '../../lib/shop'
import { TopBar } from '../../components/TopBar'
import { useSave } from '../../components/useSave'

// Gold is the persistent wallet; keys, power and scrolls belong to the current run of a level.
// Hearts: a boss touch or a spike slid over costs one; none left loses the level. Talents
// (bought with stars) decide the Power and hearts a level starts with. Keys unlock the door
// of levels that need them (dropped by merges, or by the boss in boss rooms).
// Gear gives charges, not Power: armor absorbs one hit (boss touch or a spike), gauntlets
// shatter a stone the wizard slides into. Power comes only from the Arcane Might talent.
type Inventory = {
  gold: number; keys: number; power: number; hearts: number; scrolls: { 2: number; 4: number }
  armor: number; gauntlets: number
}
const MAX_GEAR = 3
const freshRun = (gold: number, talents: TalentLevels = {}): Inventory => {
  const start = startingRun(talents, talentCfg)
  return { gold, keys: 0, power: start.power, hearts: start.hearts, scrolls: { 2: 0, 4: 0 }, armor: start.armor, gauntlets: 0 }
}
/** Free Undos per level; after that each Undo spends an Amulet of Rewind from the stash. */
const FREE_UNDOS = 3
/** Undo restores the board, the run and the stash (so undoing a booster gives it back). */
type Snapshot = { board: Tile[]; moves: number; score: number; floorGifts: FloorGifts; inventory: Inventory; stash: Stash; brokenWalls: number[] }

const makeBoard = (levelIndex: number) => buildBoard(levels[levelIndex])

function applyGift(inv: Inventory, gift: FloorGift): Inventory {
  switch (gift.type) {
    case 'gold': return { ...inv, gold: inv.gold + gift.amount }
    case 'key': return { ...inv, keys: inv.keys + 1 }
    case 'equipment':
      if (gift.item.type === 'armor') return { ...inv, armor: Math.min(MAX_GEAR, inv.armor + 1) }
      if (gift.item.type === 'gauntlet') return { ...inv, gauntlets: Math.min(MAX_GEAR, inv.gauntlets + 1) }
      return inv // an attack tome with no boss left to hit
    case 'scroll': return { ...inv, scrolls: { ...inv.scrolls, [gift.targetValue]: inv.scrolls[gift.targetValue] + 1 } }
  }
}

/** Display names for the config's equipment slots (the "sword" is the wizard's spellbook). */
const EQUIPMENT_NAMES = { armor: 'Chest Armor', gauntlet: 'Gauntlets' } as const

function giftLabel(gift: FloorGift): string {
  switch (gift.type) {
    case 'gold': return `+${gift.amount} gold`
    case 'key': return 'Picked up a key'
    case 'equipment': return gift.item.type === 'sword'
      ? 'The tome fizzles — no boss to hit'
      : gift.item.type === 'armor'
        ? `${EQUIPMENT_NAMES.armor} — absorbs one hit (boss or spikes)`
        : `${EQUIPMENT_NAMES.gauntlet} — shatter a stone you slide into`
    case 'scroll': return `Gained Purge [${gift.targetValue}] Scroll`
  }
}

const tomeArt = (power: number) => `/assets/icons/items/${tomeFor(power).icon}.png`

/** Floor loot; attack tomes look grander the more Power the wizard has (lib/tomes.ts). */
function GiftArt({ gift, power }: { gift: FloorGift; power: number }) {
  const src = gift.type === 'gold' ? goldArt(gift.amount)
    : gift.type === 'key' ? ART.key
      : gift.type === 'scroll' ? ART.scroll
        : gift.item.type === 'sword' ? tomeArt(power) : ART[gift.item.type]
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

/** Keys still missing for this level's door (boss levels: the boss drops them). */
const keysMissingFor = (level: LevelConfig, keys: number) => Math.max(0, (level.requiredKeys ?? 0) - keys)
const keyWord = (n: number) => `${n} key${n === 1 ? '' : 's'}`

/** `keysMissing`: keys the player still needs for the door (0 when none are required). */
function statusMessage(level: LevelConfig, doorOpen: boolean, bossAlive = false, keysMissing = 0) {
  if (bossAlive) return doorOpen
    ? 'The door is sealed while the boss lives. Walk over attack tomes to blast it.'
    : 'A boss roams this room. Merge to drop attack tomes, walk over them to blast it — and don\'t let it touch you.'
  if (keysMissing > 0) return doorOpen
    ? `The door is locked — find ${keyWord(keysMissing)}. Merges drop them; stop next to one to grab it.`
    : `This door needs ${keyWord(keysMissing)}. Merges drop them — stop next to one to grab it.`
  if (doorOpen) return 'The door is open. Move onto it to escape.'
  if (isFusionLevel(level)) return `Slide ${level.targetFormula[0]} into ${level.targetFormula[1]} to fuse the door.`
  return 'Merge matching tiles to reveal the door.'
}

export default function PlayPage() {
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
  /** 'stuck' losses (no moves left) can be rescued with a booster; spikes and the boss cannot. */
  const [stuck, setStuck] = useState(false)
  const [hammerMode, setHammerMode] = useState(false)
  /** Rune of Passage: picking a wall to dissolve. */
  const [wallMode, setWallMode] = useState(false)
  /** Undos taken this level (the first FREE_UNDOS are free). */
  const [undosUsed, setUndosUsed] = useState(0)
  /** Walls dissolved this run (indices into level.walls). */
  const [brokenWalls, setBrokenWalls] = useState<number[]>([])
  // Boss animation + transient effects. `corpseAt` keeps the dying animation on screen after
  // the boss cell has already been cleared by the rules.
  const [bossAnim, setBossAnim] = useState<{ action: BossAction; nonce: number; corpseAt: number | null }>({ action: 'idle', nonce: 0, corpseAt: null })
  const [popup, setPopup] = useState<{ text: string; at: number; nonce: number } | null>(null)
  // Last move's piece motions, so pieces slide from where they were instead of jumping.
  const [boardAnim, setBoardAnim] = useState<{ nonce: number; motions: Motion[]; prev: Tile[]; spawned: number } | null>(null)
  const playBoss = useCallback((action: BossAction, corpseAt: number | null = null) =>
    setBossAnim((b) => ({ action, nonce: b.nonce + 1, corpseAt })), [])
  const router = useRouter()
  const { save: progress, setSave: setProgress, loaded: saveLoaded, unlocked } = useSave()
  /** True once the board has been set up from the save; gates the effects that write back. */
  const [ready, setReady] = useState(false)
  const level = levels[levelIndex]
  // Drop rates for this player's talents (goldRate / weaponRate) plus the early-level gold
  // boost, and boss-room max hearts.
  const runEconomy = useMemo(
    () => levelEconomy(effectiveEconomy(economy, progress.talents, talentCfg), levels[levelIndex].id),
    [progress.talents, levelIndex],
  )
  const maxHearts = startingRun(progress.talents, talentCfg).hearts
  /** Loot magnet perk from the shop (permanent). */
  const magnet = magnetOf(progress.perks)

  const spikes = spikeCells(level)
  /** The level as the rules see it: without the walls a rune has dissolved. */
  const playLevel = useMemo(() => withoutWalls(level, brokenWalls), [level, brokenWalls])

  const reset = useCallback((index = levelIndex) => {
    setBoard(makeBoard(index)); setFloorGifts({}); setHistory([]); setMoves(0); setScore(0); setWon(false); setLost(false)
    setInventory((inv) => freshRun(inv.gold, progress.talents))
    setMessage(levels[index].hasBoss ? statusMessage(levels[index], false, true)
      : levels[index].requiredKeys ? statusMessage(levels[index], false, false, levels[index].requiredKeys) : START_MESSAGE)
    setHero((h) => ({ action: 'idle', nonce: h.nonce + 1 })); setFacing(1)
    setBossAnim((b) => ({ action: 'idle', nonce: b.nonce + 1, corpseAt: null })); setPopup(null); setBoardAnim(null)
    setWinStars(null); setStuck(false); setHammerMode(false); setWallMode(false); setBrokenWalls([]); setUndosUsed(0)
  }, [levelIndex, progress.talents])

  const chooseLevel = useCallback((index: number) => {
    if (index > unlocked) return
    setLevelIndex(index); reset(index)
    window.history.replaceState(null, '', `/play?level=${index + 1}`) // a reload reopens this level
    setProgress((p) => ({ ...p, current: Math.min(index, p.unlocked) }))
  }, [reset, unlocked])

  // Set up the board once the save is loaded: ?level=N opens that level (if unlocked),
  // no param continues the current level; resuming its saved run when there is one.
  useEffect(() => {
    if (!saveLoaded || ready) return
    const start = resolveStartLevel(new URLSearchParams(window.location.search).get('level'), progress, levels.length)
    if (!start) { router.replace('/levels'); return } // locked or unknown level: pick one on the map
    setLevelIndex(start.level); reset(start.level)
    window.history.replaceState(null, '', `/play?level=${start.level + 1}`)
    const run = progress.run
    if (start.resume && run) {
      // Resume the unfinished level exactly where it was left (undo history is not kept).
      setBoard(run.board); setFloorGifts(run.floorGifts); setMoves(run.moves); setScore(run.score)
      setInventory({ gold: progress.gold, keys: run.keys, power: run.power, hearts: run.hearts, scrolls: run.scrolls, armor: run.armor, gauntlets: run.gauntlets })
      setBrokenWalls(run.brokenWalls.filter((i) => i < (levels[run.level].walls?.length ?? 0)))
      setMessage(`Welcome back — your run is restored. ${statusMessage(levels[run.level], run.board.includes('exit'), run.board.some(isBoss), keysMissingFor(levels[run.level], run.keys))}`)
    } else {
      setInventory(freshRun(progress.gold, progress.talents))
      if (start.level !== progress.current) setProgress((p) => ({ ...p, current: start.level, run: undefined }))
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveLoaded])

  // Gold is a wallet that survives reloads.
  useEffect(() => {
    if (ready) setProgress((p) => (p.gold === inventory.gold ? p : { ...p, gold: inventory.gold }))
  }, [inventory.gold, ready, setProgress])

  // Auto-save the level in progress after every move; a finished (won/lost) or untouched
  // level has nothing to resume.
  useEffect(() => {
    if (!ready) return
    const active = !won && !lost && moves > 0
    setProgress((p) => {
      if (!active) return p.run ? { ...p, run: undefined } : p
      const { keys, power, hearts, scrolls, armor, gauntlets } = inventory
      return { ...p, run: { level: levelIndex, board, floorGifts, moves, score, keys, power, hearts, scrolls, armor, gauntlets, brokenWalls } }
    })
  }, [board, brokenWalls, floorGifts, inventory, levelIndex, lost, moves, ready, score, setProgress, won])

  const nextLevel = useCallback(() => {
    if (levelIndex < levels.length - 1) chooseLevel(levelIndex + 1)
    else reset(levelIndex)
  }, [chooseLevel, levelIndex, reset])

  const move = useCallback((direction: Direction) => {
    if (won || lost) return
    const res = computeMove(board, floorGifts, playLevel, runEconomy, direction, Math.random, inventory.power, inventory.gauntlets, { keys: inventory.keys, magnet })
    if (!res.changed) return

    // Attack tomes picked up while a boss lives are cast at it, not kept as Power; every other
    // item slid over goes into the bag.
    const tomeCast = res.tomesCast > 0
    let castLeft = res.tomesCast
    let nextInventory = inventory
    const scrollsFound = { purge2: 0, purge4: 0 }
    for (const gift of res.collected) {
      if (castLeft > 0 && gift.type === 'equipment' && gift.item.type === 'sword') { castLeft--; continue }
      if (gift.type === 'scroll') { scrollsFound[gift.targetValue === 2 ? 'purge2' : 'purge4']++; continue }
      nextInventory = applyGift(nextInventory, gift)
    }
    if (res.smashedStone !== -1) nextInventory = { ...nextInventory, gauntlets: nextInventory.gauntlets - 1 }
    // Armor absorbs one spike each; every other spike slid over costs a heart.
    const armorOnSpikes = Math.min(res.spikesCrossed, nextInventory.armor)
    const spikeHits = res.spikesCrossed - armorOnSpikes
    if (res.spikesCrossed) {
      nextInventory = { ...nextInventory, armor: nextInventory.armor - armorOnSpikes, hearts: nextInventory.hearts - spikeHits }
    }
    const spikeDeath = spikeHits > 0 && nextInventory.hearts <= 0
    if (res.bossReward) {
      nextInventory = { ...nextInventory, gold: nextInventory.gold + res.bossReward.gold, keys: nextInventory.keys + res.bossReward.keys }
    }
    // A boss hit breaks armor first, then costs a heart.
    const armorBlocked = res.bossHitPlayer && nextInventory.armor > 0
    if (res.bossHitPlayer) {
      nextInventory = armorBlocked
        ? { ...nextInventory, armor: nextInventory.armor - 1 }
        : { ...nextInventory, hearts: nextInventory.hearts - 1 }
    }
    const slain = res.bossHitPlayer && !armorBlocked && nextInventory.hearts <= 0 && !spikeDeath
    const escaped = res.reachedDoor && !spikeDeath && !slain
    const finished = escaped || spikeDeath || slain
    const nextBoard = finished ? res.board : addRandomTile(res.board)
    const spawned = nextBoard.findIndex((c, i) => c !== null && res.board[i] === null)
    setBoardAnim((a) => ({ nonce: (a?.nonce ?? 0) + 1, motions: res.motions, prev: board, spawned }))
    if (tomeCast) setPopup((p) => ({ text: `-${res.bossDamage}`, at: res.bossAt, nonce: (p?.nonce ?? 0) + 1 }))

    setHistory((h) => [...h, { board, moves, score, floorGifts, inventory, stash: progress.stash, brokenWalls }])
    if (scrollsFound.purge2 || scrollsFound.purge4) {
      // scrolls found in a chamber go to the permanent stash
      setProgress((p) => ({ ...p, stash: { ...p.stash, purge2: p.stash.purge2 + scrollsFound.purge2, purge4: p.stash.purge4 + scrollsFound.purge4 } }))
    }
    setBoard(nextBoard); setFloorGifts(res.floorGifts); setInventory(nextInventory)
    setMoves((m) => m + 1); setScore((s) => s + res.gained)

    if (direction === 'left') setFacing(-1)
    if (direction === 'right') setFacing(1)

    if (escaped) {
      playHero('jump'); setWon(true); setMessage('You made it out!')
      setWinStars(progress.records[levelIndex] ? 0 : starsForLevel(levelIndex))
      setProgress((p) => recordWin(p, levelIndex, moves + 1, score + res.gained, levels.length).save)
      return
    }
    const bossName = BOSS_NAMES[bossKindFor(level.chapter)]
    if (slain) {
      playBoss('attack'); playHero('die'); setLost(true)
      setMessage(`${bossName} struck you down. Keep your distance and blast it with your tomes.`)
      return
    }
    if (spikeDeath) { playHero('die'); setLost(true); setMessage('The spikes took your last heart!'); return }
    if (!hasAnyMove(nextBoard, res.floorGifts, playLevel, runEconomy, nextInventory.power, nextInventory.gauntlets, { keys: nextInventory.keys, magnet })) {
      playHero('die'); setLost(true); setStuck(true)
      setMessage('No moves left — the room has sealed shut.')
      return
    }

    // Boss reacts: swings when it touches you, dies, or flinches from a tome.
    if (res.bossHitPlayer) playBoss('attack')
    else if (res.bossDefeated) playBoss('dying', res.bossAt)
    else if (tomeCast) playBoss('hurt')
    // The wizard reacts: casts on a tome/stone, ouch on a hit or wall, steps otherwise.
    if (res.bossHitPlayer || res.bumpedWall || res.doorSealed || res.doorLocked || res.spikesCrossed) playHero('hurt')
    else if (tomeCast || res.shattered > 0) playHero('attack')
    else if (res.playerMoved) {
      // a long slide is a run, a short one a walk
      const slide = res.motions.find((m) => m.from === board.indexOf('player'))
      const dist = slide ? Math.abs((slide.to % level.size) - (slide.from % level.size)) + Math.abs(Math.floor(slide.to / level.size) - Math.floor(slide.from / level.size)) : 1
      playHero(dist >= 2 ? 'run' : 'walk')
    }

    const gearNote = (res.smashedStone !== -1 ? 'Your gauntlets shatter the stone! ' : '')
      + (armorOnSpikes ? `Your armor takes the spikes${armorOnSpikes > 1 ? ` (×${armorOnSpikes})` : ''}${spikeHits ? '' : ' — you\'re unhurt'}! ` : '')
      + (spikeHits ? `The spikes cut you${spikeHits > 1 ? ` (×${spikeHits})` : ''} — ${nextInventory.hearts} ❤️ left. ` : '')
    const note = gearNote + (res.bossReward
      ? `${bossName} is defeated! +${res.bossReward.gold} gold, +${res.bossReward.keys} key.${res.tomesFaded ? ' The unused tomes fade away.' : ''} `
      : tomeCast
        ? `🔥 ${res.tomesCast > 1 ? `${res.tomesCast} ${tomeFor(inventory.power).name}s blast` : `The ${tomeFor(inventory.power).name} blasts`} ${bossName} for ${res.bossDamage}! `
        : res.collected.length ? `${res.collected.map(giftLabel).join(', ')}. ` : '')
    setMessage(
      res.bossHitPlayer
        ? armorBlocked
          ? `${bossName} smashes your armor — it breaks, but you're unhurt.`
          : `${bossName} hits you! ${nextInventory.hearts} ❤️ left — don't let it touch you.`
        : res.doorSealed
          ? 'The door is sealed — defeat the boss first. Walk over attack tomes to blast it!'
          : note + statusMessage(level, res.doorOpen, res.board.some(isBoss), keysMissingFor(level, nextInventory.keys)),
    )
  }, [board, brokenWalls, floorGifts, inventory, level, levelIndex, lost, magnet, moves, playBoss, playHero, playLevel, progress.records, progress.stash, progress.talents, runEconomy, score, setProgress, won])

  const freeUndosLeft = Math.max(0, FREE_UNDOS - undosUsed)
  const canUndo = history.length > 0 && (freeUndosLeft > 0 || progress.stash.undoCharm > 0)
  const undo = () => {
    const previous = history[history.length - 1]
    if (!previous || !canUndo) return
    // the 3 free Undos go first, then an Amulet of Rewind (which Undo never gives back)
    const charmsLeft = progress.stash.undoCharm - (freeUndosLeft > 0 ? 0 : 1)
    setUndosUsed((n) => n + 1)
    setHistory(history.slice(0, -1))
    setBoard(previous.board); setMoves(previous.moves); setScore(previous.score)
    setFloorGifts(previous.floorGifts); setInventory(previous.inventory); setBrokenWalls(previous.brokenWalls)
    setProgress((p) => ({ ...p, stash: { ...previous.stash, undoCharm: charmsLeft } }))
    setWon(false); setLost(false); setStuck(false); setHammerMode(false); setWallMode(false)
    playHero('idle'); playBoss('idle'); setPopup(null); setBoardAnim(null)
    setMessage(statusMessage(level, previous.board.includes('exit'), previous.board.some(isBoss), keysMissingFor(level, previous.inventory.keys)))
  }

  // ---------- Boosters (stash items, used between moves; undoable; no tile spawns) ----------
  const bossAliveNow = board.some(isBoss)
  const canUseBoosters = !won && (!lost || stuck)
  const smashable = board.flatMap((c, i) => (applyHammer(board, i) ? [i] : []))
  const boosterUsable: Record<ShopItem, boolean> = {
    hammer: progress.stash.hammer > 0 && smashable.length > 0,
    purge2: progress.stash.purge2 > 0 && board.includes(2),
    purge4: progress.stash.purge4 > 0 && board.includes(4),
    heartPotion: progress.stash.heartPotion > 0 && applyHeartPotion(inventory.hearts, maxHearts) !== null,
    wallRune: progress.stash.wallRune > 0 && (playLevel.walls?.length ?? 0) > 0,
    undoCharm: false, // spent by the Undo button
  }

  /** Applies a booster's new board/inventory, spends one item, and lifts a "stuck" loss
   *  when moves are possible again. */
  const spendBooster = (item: ShopItem, nextBoard: Tile[], nextInventory: Inventory, note: string, nextBroken = brokenWalls) => {
    setHistory((h) => [...h, { board, moves, score, floorGifts, inventory, stash: progress.stash, brokenWalls }])
    setProgress((p) => ({ ...p, stash: { ...p.stash, [item]: p.stash[item] - 1 } }))
    setBoard(nextBoard); setInventory(nextInventory); setBoardAnim(null); setHammerMode(false); setWallMode(false)
    setBrokenWalls(nextBroken)
    if (stuck && hasAnyMove(nextBoard, floorGifts, withoutWalls(level, nextBroken), runEconomy, nextInventory.power, nextInventory.gauntlets)) {
      setLost(false); setStuck(false); playHero('idle')
      setMessage(`${note} You can move again!`)
    } else {
      setMessage(note)
    }
  }

  const activateBooster = (item: ShopItem) => {
    if (!canUseBoosters || !boosterUsable[item]) return
    if (item === 'hammer') { setWallMode(false); setHammerMode((m) => !m); setMessage('Pick a glowing stone to smash it.'); return }
    if (item === 'wallRune') { setHammerMode(false); setWallMode((m) => !m); setMessage('Tap a glowing wall to dissolve it.'); return }
    if (item === 'heartPotion') {
      spendBooster(item, board, { ...inventory, hearts: applyHeartPotion(inventory.hearts, maxHearts) ?? inventory.hearts }, 'The potion restores a heart.')
      return
    }
    const value = item === 'purge2' ? 2 : 4
    const res = applyPurge(board, value)
    spendBooster(item, res.board, inventory, `The scroll burns away ${res.removed.length} × ${value}.`)
  }

  const smash = (index: number) => {
    const next = hammerMode && canUseBoosters ? applyHammer(board, index) : null
    if (next) spendBooster('hammer', next, inventory, 'The hammer shatters the stone!')
  }

  const dissolveWall = (wallIndex: number) => {
    if (!wallMode || !canUseBoosters || brokenWalls.includes(wallIndex)) return
    spendBooster('wallRune', board, inventory, 'The rune flares — the wall dissolves!', [...brokenWalls, wallIndex])
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setHammerMode(false); setWallMode(false); return }
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
  const undoTitle = freeUndosLeft > 0
    ? `${freeUndosLeft} free Undo${freeUndosLeft === 1 ? '' : 's'} left this chamber`
    : `Free Undos used — each Undo spends an Amulet of Rewind (${progress.stash.undoCharm} left)`
  const undoBadge = <em className="undo-count">{freeUndosLeft > 0 ? freeUndosLeft : <><img src={BOOSTERS.undoCharm.icon} alt="" draggable={false} />{progress.stash.undoCharm}</>}</em>
  const tomeDamage = bossCellTile ? tomeDamageFor(bossCellTile.maxHp, level.id, tomeHits, inventory.power) : 0
  /** Door can't be entered yet: boss alive, or keys missing. */
  const doorLocked = bossAlive || keysMissingFor(level, inventory.keys) > 0
  const tomesLeft = bossCellTile ? Math.ceil(bossCellTile.hp / tomeDamage) : 0
  const iconSize = level.size >= 7 ? 22 : level.size === 6 ? 26 : level.size === 5 ? 32 : 38
  const specialSize = level.size >= 7 ? 26 : level.size === 6 ? 30 : level.size === 5 ? 36 : 44

  return (
    <main className="game-shell">
      <TopBar back="/" />

      <section className="game-content play-content">
        <Purse gold={inventory.gold} stars={progress.stars} hearts={inventory.hearts} maxHearts={maxHearts} keys={inventory.keys} keysNeeded={level.hasBoss ? 0 : level.requiredKeys ?? 0} power={inventory.power} armor={inventory.armor} gauntlets={inventory.gauntlets} />

        <div className="level-heading">
          <div>
            <p className="eyebrow">{level.chapterName} · Level {levelIndex + 1}</p>
            <h1>{level.name}</h1>
            <p className="subtitle">{level.subtitle}</p>
            {progress.records[levelIndex] && (
              <p className="best-record"><img src={ART.medal} alt="" draggable={false} />Cleared · best {progress.records[levelIndex].bestMoves} moves · {progress.records[levelIndex].bestScore} pts</p>
            )}
          </div>
          <Link href="/levels" className="level-select-badge map-link" aria-label="Open the level map">
            <MapIcon size={15} /><span>Map</span>
          </Link>
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
                      <img src={tomeArt(inventory.power)} alt="" draggable={false} className="hint-tome" />
                      {`Each ${tomeFor(inventory.power).name} deals ${tomeDamage} — ${tomesLeft === 1 ? 'one more finishes it!' : `${tomesLeft} more to win.`} Don't let it touch you.`}
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
          <div className={`board board-${level.size}x${level.size}${hammerMode ? ' hammer-mode' : ''}${wallMode ? ' wall-mode' : ''}`} style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }} aria-label="Game board">
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
                <div
                  className={`cell${isSpike ? ' has-spike' : ''}${cell !== null ? ' occupied' : ''}${hammerMode && smashable.includes(index) ? ' smashable' : ''}`}
                  key={index}
                  onClick={hammerMode ? () => smash(index) : undefined}
                >
                  {isSpike && (
                    <div className="floor-spike" aria-label="Spike trap"><Skull size={iconSize} strokeWidth={2.2} /></div>
                  )}
                  {gift && <div className="floor-gift"><GiftArt gift={gift} power={inventory.power} /></div>}

                  {cell !== null && (
                    <div
                      key={animKey}
                      className={`piece ${pieceKind(cell)}${stateClass}${cell === 'exit' && doorLocked ? ' sealed' : ''}`}
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
                          <span className="portal">{doorLocked ? <img className="padlock" src={ART.padlock} alt={bossAlive ? 'Sealed' : 'Locked'} draggable={false} /> : <DoorOpen size={specialSize} strokeWidth={2.4} />}</span>
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
            <div className="wall-layer" style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)`, gridTemplateRows: `repeat(${level.size}, 1fr)` }} aria-hidden={!wallMode}>
              {level.walls?.map((w, i) => brokenWalls.includes(i) ? null : (
                <div key={`wall-${i}`} className="wall-cell" style={{ gridRow: w.row + 1, gridColumn: w.col + 1 }}>
                  {wallMode
                    ? <button type="button" className={`wall-line wall-${w.type} pickable`} onClick={() => dissolveWall(i)} aria-label={`Dissolve wall ${i + 1}`} />
                    : <span className={`wall-line wall-${w.type}`} />}
                </div>
              ))}
            </div>
          </div>
          {(won || lost) && !hammerMode && !wallMode && (
            <div className="result-card">
              <div className="result-icon-wrap">
                <div className="result-icon"><img src={heroGif(won ? 'jump' : 'hurt')} alt="" draggable={false} /></div>
                {won && !!winStars && (
                  <span className="star-burst" aria-hidden>
                    {Array.from({ length: Math.min(Math.max(winStars, 3), 10) }, (_, i) => i).map((i, _, all) => (
                      <i key={i} style={{ ['--a' as string]: `${(i / all.length) * 360}deg`, ['--d' as string]: `${i * 40}ms` }}>★</i>
                    ))}
                  </span>
                )}
              </div>
              <h2>{won ? (levelIndex === levels.length - 1 ? 'Champion!' : 'Escaped!') : 'Try again'}</h2>
              <p>{message}</p>
              {won && winStars !== null && (
                <p className={`star-line${winStars ? ' earned' : ''}`}>
                  {winStars ? <><i aria-hidden>★</i> +{winStars} {winStars === 1 ? 'star' : 'stars'} — first clear!</> : 'Replay — no stars this time'}
                </p>
              )}
              {lost && stuck && BOOSTER_BAR.some((i) => boosterUsable[i]) && (
                <p className="star-line earned">Use a booster below to clear some space and keep going.</p>
              )}
              <div className="result-actions">
                {won && levelIndex < levels.length - 1 ? (
                  <button className="primary-button" onClick={nextLevel}>Next Level →</button>
                ) : (
                  <button className="primary-button" onClick={() => reset()}>{won ? 'Play From Start' : 'Play again'}</button>
                )}
                {lost && canUndo ? (
                  <button className="secondary-button" onClick={undo}>Undo last move{undoBadge}</button>
                ) : (
                  <button className="secondary-button" onClick={() => reset()}>Replay Level</button>
                )}
                <Link href="/levels" className="secondary-button"><MapIcon size={16} /> Map</Link>
                {won && progress.stars > 0 && (
                  <Link href="/upgrades" className="secondary-button upgrades-link">Upgrades <i aria-hidden>★</i>{progress.stars}</Link>
                )}
              </div>
            </div>
          )}
        </div>
        {/* status right under the board so it stays in view while swiping on a phone */}
        <p className="hint" aria-live="polite">{message}</p>
        {hammerMode && <p className="booster-hint">Pick a glowing stone to smash · Esc to cancel</p>}
        {wallMode && <p className="booster-hint">Tap a glowing wall to dissolve it · Esc to cancel</p>}
        <div className="booster-bar" aria-label="Boosters">
          {BOOSTER_BAR.map((item) => {
            const b = BOOSTERS[item]
            return (
              <button
                key={item}
                className={`booster-btn${(item === 'hammer' && hammerMode) || (item === 'wallRune' && wallMode) ? ' active' : ''}`}
                disabled={!canUseBoosters || !boosterUsable[item]}
                onClick={() => activateBooster(item)}
                title={`${b.name}: ${b.blurb}`}
                aria-label={`${b.name} (${progress.stash[item]} left)`}
              >
                <img src={b.icon} alt="" draggable={false} />
                {b.badge && <em className="booster-badge">{b.badge}</em>}
                <span>{b.short}</span>
                <span className="count">{progress.stash[item]}</span>
              </button>
            )
          })}
        </div>
        <div className="controls">
          <button className="secondary-button" onClick={undo} disabled={!canUndo} title={undoTitle}><Undo2 size={17} /> Undo{undoBadge}</button>
          <button className="secondary-button" onClick={() => reset()}><RotateCcw size={17} /> Restart</button>
        </div>
        <div className="how-to">
          <h2>How to play</h2>
          <p>
            Swipe or use arrow keys — everything slides as far as it can, the wizard too, picking up whatever he slides over. {isFusionLevel(level)
              ? `Slide ${level.targetFormula[0]} directly into ${level.targetFormula[1]} to fuse the exit door.`
              : `Merge matching tiles until you reach ${level.target} — that tile becomes the door.`} Then
            move onto the door to escape. Numbered stones shatter when a tile of the same value crashes into them. Spikes and boss touches cost a heart each (armor absorbs one first); lose every heart and the level is lost. Later doors need keys: merges drop them and they jump to you when you stop next to one; boss rooms get theirs from the boss. Gauntlets shatter a stone you slide into; a Rune of Passage from the shop dissolves one wall line. You get 3 free Undos per level — an Amulet of Rewind buys one more. In boss rooms the boss slides with every swipe: merge to drop attack tomes and walk over them to blast it. Power (Arcane Might) adds a percentage to every tome's damage, and tomes grow grander as it rises.
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
