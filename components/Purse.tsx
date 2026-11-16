// Wallet / bag chips shown on the home screen and above the board. A chip briefly "bumps"
// whenever its value goes up (not on first render).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ART } from './art'

function Chip({ className, title, value, children }: { className: string; title: string; value: number; children: ReactNode }) {
  const prev = useRef(value)
  const [bump, setBump] = useState(0)
  useEffect(() => {
    if (value > prev.current) setBump((n) => n + 1)
    prev.current = value
  }, [value])
  return (
    <span key={bump} className={`purse-chip ${className}${bump ? ' bump' : ''}`} title={title}>
      {children}{value}
    </span>
  )
}

export function Purse({ gold, stars, keys, power, scrolls }: {
  gold: number
  stars: number
  /** In-run values: only shown while playing a level. */
  keys?: number
  power?: number
  scrolls?: { 2: number; 4: number }
}) {
  return (
    <div className="purse" aria-label="Inventory">
      <Chip className="gold" title="Gold" value={gold}><img src={ART.gold} alt="" draggable={false} /></Chip>
      {keys !== undefined && <Chip className="keys" title="Keys" value={keys}><img src={ART.key} alt="" draggable={false} /></Chip>}
      {power !== undefined && <Chip className="power" title="Power (spellbooks & gear)" value={power}><img src={ART.power} alt="" draggable={false} /></Chip>}
      <Chip className="stars" title="Stars — earned by clearing a level for the first time" value={stars}><i aria-hidden>★</i></Chip>
      {scrolls && (scrolls[2] > 0 || scrolls[4] > 0) && (
        <span className="purse-chip scrolls" title="Purge scrolls (2 / 4)"><img src={ART.scroll} alt="" draggable={false} />{scrolls[2]}/{scrolls[4]}</span>
      )}
    </div>
  )
}
