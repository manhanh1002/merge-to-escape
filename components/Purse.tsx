// Wallet / bag chips shown on the home screen and above the board.
import { ART } from './art'

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
      <span className="purse-chip gold" title="Gold"><img src={ART.gold} alt="" draggable={false} />{gold}</span>
      {keys !== undefined && <span className="purse-chip keys" title="Keys"><img src={ART.key} alt="" draggable={false} />{keys}</span>}
      {power !== undefined && <span className="purse-chip power" title="Power (spellbooks & gear)"><img src={ART.power} alt="" draggable={false} />{power}</span>}
      <span className="purse-chip stars" title="Stars — earned by clearing a level for the first time"><i aria-hidden>★</i>{stars}</span>
      {scrolls && (scrolls[2] > 0 || scrolls[4] > 0) && (
        <span className="purse-chip scrolls" title="Purge scrolls (2 / 4)"><img src={ART.scroll} alt="" draggable={false} />{scrolls[2]}/{scrolls[4]}</span>
      )}
    </div>
  )
}
