// Wallet / bag chips shown on the home screen and above the board. A chip briefly "bumps"
// whenever its value goes up (not on first render).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ART } from './art'

function Chip({ className, title, value, label, children }: { className: string; title: string; value: number; label?: string; children: ReactNode }) {
  const prev = useRef(value)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (value > prev.current) setBump((n) => n + 1)
    prev.current = value
  }, [value])
  return (
    <span key={bump} className={`purse-chip ${className}${bump ? ' bump' : ''}`} title={title}>
      {children}{label ?? value}
    </span>
  )
}

export function Purse({ gold, stars, hearts, maxHearts, keys, keysNeeded = 0, power, armor, gauntlets, scrolls }: {
  gold: number
  stars: number
  /** In-run values: only shown while playing a level. */
  hearts?: number
  maxHearts?: number
  keys?: number
  /** Keys this level's door needs: the chip shows held / needed. */
  keysNeeded?: number
  power?: number
  armor?: number
  gauntlets?: number
  scrolls?: { 2: number; 4: number }
}) {
  return (
    <div className="purse" aria-label="Inventory">
      <Chip className="gold" title="Gold" value={gold}><img src={ART.gold} alt="" draggable={false} /></Chip>
      {hearts !== undefined && (
        <span className={`purse-chip hearts-chip${hearts <= 1 ? ' low' : ''}`} title={`Hearts: ${hearts} of ${maxHearts ?? hearts} — a boss touch or a spike costs one`}>
          <i aria-hidden>♥</i>{hearts}
        </span>
      )}
      {keys !== undefined && (keysNeeded > 0
        ? <span className={`purse-chip keys${keys >= keysNeeded ? ' ready' : ''}`} title={`Keys: ${keys} of ${keysNeeded} needed to open the door`}><img src={ART.key} alt="" draggable={false} />{keys}/{keysNeeded}</span>
        : <Chip className="keys" title="Keys" value={keys}><img src={ART.key} alt="" draggable={false} /></Chip>)}
      {power !== undefined && <Chip className="power" title={`Power (Arcane Might) — every attack tome deals +${power}% damage`} value={power} label={`+${power}%`}><img src={ART.power} alt="" draggable={false} /></Chip>}
      {armor !== undefined && <Chip className="armor" title="Armor — absorbs one hit (boss touch or spike)" value={armor}><img src={ART.armor} alt="" draggable={false} /></Chip>}
      {gauntlets !== undefined && <Chip className="gauntlets" title="Gauntlets — shatter a stone you slide into" value={gauntlets}><img src={ART.gauntlet} alt="" draggable={false} /></Chip>}
      <Chip className="stars" title="Stars — earned by clearing a level for the first time" value={stars}><i aria-hidden>★</i></Chip>
      {scrolls && (scrolls[2] > 0 || scrolls[4] > 0) && (
        <span className="purse-chip scrolls" title="Purge scrolls (2 / 4)"><img src={ART.scroll} alt="" draggable={false} />{scrolls[2]}/{scrolls[4]}</span>
      )}
    </div>
  )
}
