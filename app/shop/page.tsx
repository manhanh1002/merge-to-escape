'use client'

// Shop: spend gold on consumables kept in the stash and used from the booster bar in play.
import Link from 'next/link'
import { useState } from 'react'
import { shopPrices as prices } from '../../lib/levels'
import { SHOP_ITEMS, buy, type ShopItem } from '../../lib/shop'
import { BOOSTERS } from '../../components/boosters'
import { Purse } from '../../components/Purse'
import { TopBar } from '../../components/TopBar'
import { useSave } from '../../components/useSave'

export default function ShopPage() {
  const { save, setSave, loaded } = useSave()
  const [bought, setBought] = useState<{ item: ShopItem; n: number } | null>(null)

  const purchase = (item: ShopItem) => {
    setSave((s) => buy(s, item, prices) ?? s)
    setBought((b) => ({ item, n: (b?.n ?? 0) + 1 }))
  }

  return (
    <main className="game-shell shop-screen">
      <TopBar back="/" />

      <section className="upgrades-content">
        <div className="map-heading">
          <div>
            <p className="eyebrow">The dungeon merchant</p>
            <h1>Shop</h1>
          </div>
          <Purse gold={save.gold} stars={save.stars} />
        </div>
        <p className="upgrades-intro">
          Spend the <b>gold</b> you collect in the chambers. Items wait in your stash and are used from the
          booster bar under the board.
        </p>

        <div className="talent-list">
          {SHOP_ITEMS.map((item) => {
            const b = BOOSTERS[item]
            const price = prices[item]
            const affordable = save.gold >= price
            const flashing = bought?.item === item
            return (
              <div key={flashing ? `${item}-${bought.n}` : item} className={`talent-row shop-row${flashing ? ' just-upgraded' : ''}`}>
                <span className="talent-icon shop-icon">
                  <img src={b.icon} alt="" draggable={false} />
                  {b.badge && <em className="booster-badge">{b.badge}</em>}
                </span>
                <div className="talent-body">
                  <div className="talent-title">
                    <strong>{b.name}</strong>
                    <span className="talent-level">Owned: {save.stash[item]}</span>
                  </div>
                  <p className="talent-effect">{b.blurb}</p>
                </div>
                <button
                  className="primary-button talent-buy"
                  disabled={!loaded || !affordable}
                  onClick={() => purchase(item)}
                  aria-label={`Buy ${b.name} for ${price} gold`}
                >
                  <img src="/assets/icons/items/coins_gold.png" alt="" className="price-coin" draggable={false} />{price}
                </button>
              </div>
            )
          })}
        </div>

        <div className="upgrades-footer">
          <span className="shop-note">Purge scrolls you find in the chambers are added to your stash too.</span>
          <Link href="/levels" className="secondary-button">Level Map</Link>
        </div>
      </section>
    </main>
  )
}
