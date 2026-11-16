'use client'

// Upgrades: spend stars (from first clears) on five permanent talents. Changes apply from
// the next level the player starts; a level already in progress keeps its starting stats.
import Link from 'next/link'
import { useState } from 'react'
import { Heart } from 'lucide-react'
import { talentCfg } from '../../lib/levels'
import {
  TALENT_IDS, canUpgrade, describeTalent, refundAll, starsSpent, talentLevel, upgrade, upgradeCost, type TalentId,
} from '../../lib/talents'
import { Purse } from '../../components/Purse'
import { TopBar } from '../../components/TopBar'
import { useSave } from '../../components/useSave'

const ICONS: Record<Exclude<TalentId, 'bonusHearts'>, string> = {
  goldRate: '/assets/icons/items/coins_gold.png',
  weaponRate: '/assets/icons/items/spellbook_fire.png',
  basePower: '/assets/icons/items/spellbook_radiant.png',
  weaponBonusPower: '/assets/icons/items/chest_armor_royal.png', // Gear Mastery: starting armor
}

export default function UpgradesPage() {
  const { save, setSave, loaded } = useSave()
  const [flash, setFlash] = useState<{ id: TalentId; n: number } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const spent = starsSpent(save.talents)

  const buy = (id: TalentId) => {
    setSave((s) => upgrade(s, id, talentCfg))
    setFlash((f) => ({ id, n: (f?.n ?? 0) + 1 }))
  }

  return (
    <main className="game-shell upgrades-screen">
      <TopBar back="/" />

      <section className="upgrades-content">
        <div className="map-heading">
          <div>
            <p className="eyebrow">Permanent talents</p>
            <h1>Upgrades</h1>
          </div>
          <Purse gold={save.gold} stars={save.stars} />
        </div>
        <p className="upgrades-intro">
          Clear a chamber for the first time to earn <b>★ stars</b>. Going to level L costs L stars.
          New levels apply from the next chamber you start.
        </p>

        <div className="talent-list">
          {TALENT_IDS.map((id) => {
            const lv = talentLevel(save, id)
            const info = describeTalent(id, lv, talentCfg)
            const maxed = lv >= talentCfg.maxLevel
            const affordable = canUpgrade(save, id, talentCfg)
            const cost = upgradeCost(lv)
            const flashing = flash?.id === id
            return (
              <div key={flashing ? `${id}-${flash.n}` : id} className={`talent-row${flashing ? ' just-upgraded' : ''}${maxed ? ' maxed' : ''}`}>
                <span className="talent-icon">
                  {id === 'bonusHearts' ? <Heart size={30} fill="currentColor" aria-hidden /> : <img src={ICONS[id]} alt="" draggable={false} />}
                </span>
                <div className="talent-body">
                  <div className="talent-title">
                    <strong>{info.name}</strong>
                    <span className="talent-level">Lv {lv}/{talentCfg.maxLevel}</span>
                  </div>
                  <p className="talent-effect">
                    {info.now}
                    {info.next && <span className="talent-next"> ➜ {info.next}</span>}
                  </p>
                  <span className="talent-pips" aria-hidden>
                    {Array.from({ length: talentCfg.maxLevel }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}
                  </span>
                </div>
                <button
                  className="primary-button talent-buy"
                  disabled={!loaded || !affordable}
                  onClick={() => buy(id)}
                  aria-label={maxed ? `${info.name} is maxed` : `Upgrade ${info.name} for ${cost} stars`}
                >
                  {maxed ? 'Max' : <><i aria-hidden>★</i>{cost}</>}
                </button>
              </div>
            )
          })}
        </div>

        <div className="upgrades-footer">
          {confirmReset ? (
            <span className="confirm-reset">
              <span>Refund ★{spent} and reset every talent to Lv 0?</span>
              <button className="secondary-button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="danger-button" onClick={() => { setSave((s) => refundAll(s)); setConfirmReset(false) }}>Reset talents</button>
            </span>
          ) : (
            <button className="secondary-button" disabled={spent === 0} onClick={() => setConfirmReset(true)}>
              Reset talents (refund ★{spent})
            </button>
          )}
          <Link href="/levels" className="secondary-button">Level Map</Link>
        </div>
      </section>
    </main>
  )
}
