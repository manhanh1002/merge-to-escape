'use client'

// Upgrades: spend stars (from first clears) on five permanent talents. Changes apply from
// the next level the player starts; a level already in progress keeps its starting stats.
// Resetting one branch or all of them gives the stars back for gold (resetGoldPerStar each).
import Link from 'next/link'
import { useState } from 'react'
import { Heart } from 'lucide-react'
import { talentCfg } from '../../lib/levels'
import { tomeFor } from '../../lib/tomes'
import {
  TALENT_IDS, TALENT_NAMES, canUpgrade, describeTalent, refund, resetCost, starsSpent, talentLevel, upgrade, upgradeCost, type TalentId,
} from '../../lib/talents'
import { Purse } from '../../components/Purse'
import { TopBar } from '../../components/TopBar'
import { useSave } from '../../components/useSave'

const ICONS: Record<Exclude<TalentId, 'bonusHearts' | 'basePower'>, string> = {
  goldRate: '/assets/icons/items/coins_gold.png',
  weaponRate: '/assets/icons/loot/treasure_map.png', // Treasure Sense: finds more tomes & gear
  weaponBonusPower: '/assets/icons/items/chest_armor_royal.png', // Gear Mastery: starting armor
}

export default function UpgradesPage() {
  const { save, setSave, loaded } = useSave()
  const [flash, setFlash] = useState<{ id: TalentId; n: number } | null>(null)
  /** The branch (or 'all') the player is about to reset. */
  const [resetTarget, setResetTarget] = useState<TalentId | 'all' | null>(null)

  const spent = starsSpent(save.talents, talentCfg)
  const resetStars = resetTarget === null ? 0
    : resetTarget === 'all' ? spent : starsSpent({ [resetTarget]: talentLevel(save, resetTarget) }, talentCfg)
  const resetGold = resetCost(resetStars, talentCfg)
  const canPayReset = save.gold >= resetGold
  const coin = <img src="/assets/icons/items/coins_gold.png" alt="" className="price-coin" draggable={false} />

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
          Clear a chamber for the first time to earn <b>★ stars</b>. Each level costs more than the last, and
          there are not enough stars to max every branch, so choose your path. A reset gives the stars back
          for {talentCfg.resetGoldPerStar ?? 0} gold each. New levels apply from the next chamber you start.
        </p>

        <div className="talent-list">
          {TALENT_IDS.map((id) => {
            const lv = talentLevel(save, id)
            const info = describeTalent(id, lv, talentCfg)
            const maxed = lv >= talentCfg.maxLevel
            const affordable = canUpgrade(save, id, talentCfg)
            const cost = upgradeCost(lv, talentCfg)
            const flashing = flash?.id === id
            return (
              <div key={flashing ? `${id}-${flash.n}` : id} className={`talent-row${flashing ? ' just-upgraded' : ''}${maxed ? ' maxed' : ''}`}>
                <span className="talent-icon">
                  {id === 'bonusHearts' ? <Heart size={30} fill="currentColor" aria-hidden />
                    // Arcane Might shows the tome the wizard currently wields
                    : <img src={id === 'basePower' ? `/assets/icons/items/${tomeFor(lv * talentCfg.statsBonusPerLevel.basePower).icon}.png` : ICONS[id]} alt="" draggable={false} />}
                </span>
                <div className="talent-body">
                  <div className="talent-title">
                    <strong>{info.name}</strong>
                    <span className="talent-level">Lv {lv}/{talentCfg.maxLevel}</span>
                    {lv > 0 && (
                      <button className="talent-reset" onClick={() => setResetTarget(id)} aria-label={`Reset ${info.name}`}>Reset</button>
                    )}
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
          {resetTarget ? (
            <span className="confirm-reset">
              <span>
                {resetTarget === 'all' ? 'Reset every talent' : `Reset ${TALENT_NAMES[resetTarget]}`} and get ★{resetStars} back
                for {coin}{resetGold} gold?{!canPayReset && ' Not enough gold.'}
              </span>
              <button className="secondary-button" onClick={() => setResetTarget(null)}>Cancel</button>
              <button
                className="danger-button"
                disabled={!canPayReset}
                onClick={() => { setSave((s) => refund(s, talentCfg, resetTarget === 'all' ? undefined : resetTarget)); setResetTarget(null) }}
              >
                Reset
              </button>
            </span>
          ) : (
            <button className="secondary-button" disabled={spent === 0} onClick={() => setResetTarget('all')}>
              Reset all talents (★{spent} for {coin}{resetCost(spent, talentCfg)})
            </button>
          )}
          <Link href="/levels" className="secondary-button">Level Map</Link>
        </div>
      </section>
    </main>
  )
}
