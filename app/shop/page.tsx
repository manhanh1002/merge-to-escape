'use client'

// Shop: spend gold on consumables kept in the stash (used from the booster bar, or by Undo
// for the amulet) and on permanent perks. Every purchase raises that entry's price by 15%.
import Link from 'next/link'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { shopPrices as prices } from '../../lib/levels'
import { PRICE_STEP, SHOP_ITEMS, SHOP_PERKS, buy, priceOf, type ShopEntry } from '../../lib/shop'
import { BOOSTERS, PERKS } from '../../components/boosters'
import { Purse } from '../../components/Purse'
import { TopBar } from '../../components/TopBar'
import { useSave } from '../../components/useSave'

const coin = <img src="/assets/icons/items/coins_gold.png" alt="" className="price-coin" draggable={false} />

export default function ShopPage() {
  const { save, setSave, loaded } = useSave()
  const [bought, setBought] = useState<{ id: ShopEntry; n: number } | null>(null)

  const purchase = (id: ShopEntry) => {
    setSave((s) => buy(s, id, prices) ?? s)
    setBought((b) => ({ id, n: (b?.n ?? 0) + 1 }))
  }
  const rowKey = (id: ShopEntry) => (bought?.id === id ? `${id}-${bought.n}` : id)
  const rowClass = (id: ShopEntry, extra = '') => `talent-row shop-row${bought?.id === id ? ' just-upgraded' : ''}${extra}`

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
          booster bar under the board. Each purchase raises that item&apos;s price by {Math.round(PRICE_STEP * 100)}%.
        </p>

        <div className="talent-list">
          {SHOP_ITEMS.map((item) => {
            const b = BOOSTERS[item]
            const price = priceOf(save, item, prices) ?? 0
            return (
              <div key={rowKey(item)} className={rowClass(item)}>
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
                  disabled={!loaded || save.gold < price}
                  onClick={() => purchase(item)}
                  aria-label={`Buy ${b.name} for ${price} gold`}
                >
                  {coin}{price}
                </button>
              </div>
            )
          })}
        </div>

        <h2 className="shop-section">Permanent relics</h2>
        <div className="talent-list">
          {SHOP_PERKS.map((id) => {
            const p = PERKS[id]
            const owned = save.perks[id]
            const price = priceOf(save, id, prices) ?? 0
            return (
              <div key={rowKey(id)} className={rowClass(id, owned ? ' maxed' : '')}>
                <span className="talent-icon shop-icon"><img src={p.icon} alt="" draggable={false} /></span>
                <div className="talent-body">
                  <div className="talent-title">
                    <strong>{p.name}</strong>
                    <span className="talent-level">{owned ? 'Owned' : 'Relic'}</span>
                  </div>
                  <p className="talent-effect">{p.blurb}</p>
                </div>
                {owned
                  ? <span className="talent-owned" aria-label={`${p.name} owned`}><Check size={20} /></span>
                  : (
                    <button
                      className="primary-button talent-buy"
                      disabled={!loaded || save.gold < price}
                      onClick={() => purchase(id)}
                      aria-label={`Buy ${p.name} for ${price} gold`}
                    >
                      {coin}{price}
                    </button>
                  )}
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
