// Animated characters drawn from sprite strips (CSS steps() animation, see globals.css).

// Wizard hero animations (public/assets/sprites/wizard, built by scripts/extract_wizard.py).
// Each strip holds 5 frames; loop actions repeat, one-shot actions hold their last frame.
export type HeroAction = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'die'
export const HERO_ACTIONS: HeroAction[] = ['idle', 'walk', 'run', 'jump', 'attack', 'hurt', 'die']
export const heroStrip = (a: HeroAction) => `/assets/sprites/wizard/${a}.png`
export const heroGif = (a: HeroAction) => `/assets/sprites/wizard/${a}.gif`
/** Short reactions that return to idle when they finish (jump/die stay on their last frame). */
const RETURNS_TO_IDLE = new Set<HeroAction>(['walk', 'run', 'attack', 'hurt'])

export function WizardSprite({ action, nonce, facing, onDone }: {
  action: HeroAction; nonce: number; facing: 1 | -1; onDone?: () => void
}) {
  return (
    <span
      key={`${action}-${nonce}`}
      className={`wizard wizard-${action}`}
      style={{ backgroundImage: `url(${heroStrip(action)})`, ['--face' as string]: facing }}
      onAnimationEnd={() => { if (RETURNS_TO_IDLE.has(action)) onDone?.() }}
      role="img"
      aria-label={`Wizard (${action})`}
    />
  )
}

// Bosses (public/assets/sprites/bosses, built by scripts/extract_bosses.py). Each chapter
// group has its own boss; the boss turns to face the player.
export type BossKind = 'caveman' | 'goblin' | 'viking'
export type BossAction = 'idle' | 'attack' | 'hurt' | 'dying'
export type BossDir = 'front' | 'back' | 'left' | 'right'
export const BOSS_NAMES: Record<BossKind, string> = { caveman: 'Grok the Caveman', goblin: 'Giant Goblin', viking: 'Viking Warlord' }
const BOSS_FRAMES: Record<BossAction, number> = { idle: 8, attack: 10, hurt: 10, dying: 10 }
export const bossKindFor = (chapter: number): BossKind => (chapter <= 3 ? 'caveman' : chapter <= 7 ? 'goblin' : 'viking')
export const bossClip = (kind: BossKind, action: BossAction, dir: BossDir) =>
  `/assets/sprites/bosses/${kind}/${action === 'dying' ? 'dying' : `${action}-${dir}`}.png`

/** Which way the boss at `boss` should look to face the player at `player`. */
export function bossFacing(boss: number, player: number, size: number): BossDir {
  if (boss < 0 || player < 0) return 'front'
  const dr = Math.floor(player / size) - Math.floor(boss / size)
  const dc = (player % size) - (boss % size)
  // Same column: look straight up/down. Otherwise show the side profile toward the player
  // (the boss usually sits in a bottom corner, so 'back' would mostly show its head).
  if (dc === 0) return dr >= 0 ? 'front' : 'back'
  return dc > 0 ? 'right' : 'left'
}

export function BossSprite({ kind, action, dir, nonce, onDone }: {
  kind: BossKind; action: BossAction; dir: BossDir; nonce: number; onDone?: () => void
}) {
  const frames = BOSS_FRAMES[action]
  return (
    <span
      key={`${action}-${dir}-${nonce}`}
      className={`boss-sprite boss-${action}`}
      style={{ backgroundImage: `url(${bossClip(kind, action, dir)})`, ['--frames' as string]: frames }}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && action !== 'idle') onDone?.() }}
      role="img"
      aria-label={`${BOSS_NAMES[kind]} (${action})`}
    />
  )
}
